/** Single-collateral / USDC-debt model. No oracle prediction or liquidation guarantee. */
export type RiskState = "SAFE" | "WATCH" | "WARNING" | "CRITICAL";
export interface Position {
  id: string;
  asset: string;
  protocol: string;
  units: number;
  price: number;
  debt: number;
  liquidationLtv: number;
  borrowApy: number;
  baselineHf: number;
  history: number[];
}
export interface Portfolio {
  positions: Position[];
  walletUsdc: number;
  mode: "demo" | "live";
}
export interface SimulationState {
  drop: number;
  targetHf: number;
}
export interface ProtectionRule {
  id: string;
  positionId: string;
  action: "Repay Debt" | "Top Up Collateral" | "Deleverage" | "Notify Only";
  threshold: number;
  percent: number;
  maxAmount: number;
  dailyLimit: number;
  slippage: number;
  expiresAt: string;
  sessionExpiresAt: string;
  manualApproval: boolean;
  armed: boolean;
  spent: number;
}
export interface Transaction {
  status: "pending" | "confirmed" | "failed" | "simulated";
  signature?: string;
  amount: number;
}
export interface ProtectionEvent {
  id: string;
  time: string;
  category:
    | "Protection Actions"
    | "Alerts"
    | "Transactions"
    | "Rule Changes"
    | "Wallet Events";
  title: string;
  detail: string;
  status: "info" | "pending" | "success" | "failed";
  transaction?: Transaction;
}
export type Alert = ProtectionEvent;
export const THRESHOLDS = { safe: 1.6, watch: 1.3, warning: 1.1 };
export const money = (n: number, digits = 0) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
  });
export const hfText = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "∞");
export const riskState = (hf: number): RiskState =>
  hf >= THRESHOLDS.safe
    ? "SAFE"
    : hf >= THRESHOLDS.watch
      ? "WATCH"
      : hf >= THRESHOLDS.warning
        ? "WARNING"
        : "CRITICAL";
export function metrics(p: Position) {
  const collateral = p.units * p.price;
  const hf = p.debt > 0 ? (collateral * p.liquidationLtv) / p.debt : Infinity;
  const liquidationPrice =
    p.units > 0 ? p.debt / (p.units * p.liquidationLtv) : 0;
  return {
    collateral,
    hf,
    ltv: collateral > 0 ? p.debt / collateral : 0,
    liquidationPrice,
    buffer: p.price > 0 ? (1 - liquidationPrice / p.price) * 100 : 0,
    risk: riskState(hf),
  };
}
export function simulate(p: Position, drop: number): Position {
  return { ...p, price: p.price * (1 - Math.max(0, Math.min(50, drop)) / 100) };
}
export const requiredCollateral = (
  p: Position,
  target: number,
  addedCollateralLtv = p.liquidationLtv,
) =>
  Math.max(
    0,
    (target * p.debt - metrics(p).collateral * p.liquidationLtv) /
      addedCollateralLtv,
  );
export const requiredRepayment = (p: Position, target: number) =>
  Math.max(0, p.debt - (metrics(p).collateral * p.liquidationLtv) / target);
export function portfolioMetrics(positions: Position[]) {
  const sorted = [...positions].sort((a, b) => metrics(a).hf - metrics(b).hf);
  const hf = sorted[0] ? metrics(sorted[0]).hf : Infinity;
  return {
    collateral: positions.reduce((s, p) => s + metrics(p).collateral, 0),
    debt: positions.reduce((s, p) => s + p.debt, 0),
    nearest: sorted[0],
    risk: riskState(hf),
    score: Math.round(Math.max(0, Math.min(100, ((2.2 - hf) / 1.2) * 100))),
  };
}
export function explain(p: Position, target = 1.6) {
  const m = metrics(p);
  return `${p.asset}/USDC has a ${m.buffer.toFixed(1)}% liquidation buffer and ${hfText(m.hf)} health factor. ${m.hf < p.baselineHf ? `Collateral value has fallen while USDC debt remains outstanding; HF moved from ${hfText(p.baselineHf)} to ${hfText(m.hf)}.` : "Its collateral currently covers the modeled liquidation threshold."} ${requiredRepayment(p, target) > 0 ? `Repaying ${money(requiredRepayment(p, target), 2)} USDC would bring estimated HF to ${target.toFixed(2)}.` : `It already exceeds the ${target.toFixed(2)} target.`} Borrow interest accrues at approximately ${money((p.debt * p.borrowApy) / 365, 2)}/day (simple estimate).`;
}
export function evaluateRule(
  rule: ProtectionRule,
  p: Position,
  walletUsdc: number,
  now = Date.now(),
) {
  const m = metrics(p);
  if (!rule.armed) return { ok: false, amount: 0, reason: "Rule paused" };
  if (
    now >= Date.parse(rule.expiresAt) ||
    now >= Date.parse(rule.sessionExpiresAt)
  )
    return { ok: false, amount: 0, reason: "Permission or rule expired" };
  if (m.hf >= rule.threshold)
    return {
      ok: false,
      amount: 0,
      reason: `HF ${hfText(m.hf)} is above trigger ${rule.threshold.toFixed(2)}`,
    };
  if (m.hf <= 1)
    return {
      ok: false,
      amount: 0,
      reason: "Liquidation threshold reached; execution cannot be assumed",
    };
  const desired = (p.debt * rule.percent) / 100;
  const amount =
    rule.action === "Notify Only"
      ? 0
      : Math.min(
          desired,
          rule.maxAmount,
          Math.max(0, rule.dailyLimit - rule.spent),
          rule.action === "Deleverage" ? m.collateral : walletUsdc,
        );
  if (rule.action !== "Notify Only" && amount <= 0)
    return {
      ok: false,
      amount: 0,
      reason: "Insufficient balance or daily allowance",
    };
  return {
    ok: true,
    amount,
    reason: rule.manualApproval
      ? "Manual approval required"
      : "Simulation permitted",
  };
}
export function applyProtection(
  p: Position,
  rule: ProtectionRule,
  amount: number,
): Position {
  if (rule.action === "Notify Only") return p;
  if (rule.action === "Top Up Collateral")
    return { ...p, units: p.units + amount / p.price };
  if (rule.action === "Deleverage")
    return {
      ...p,
      units: Math.max(0, p.units - amount / p.price),
      debt: Math.max(0, p.debt - amount * (1 - rule.slippage / 100)),
    };
  return { ...p, debt: Math.max(0, p.debt - amount) };
}
export const DEMO_POSITIONS: Position[] = [
  {
    id: "sol",
    asset: "SOL",
    protocol: "Kamino",
    units: 40,
    price: 126.3,
    debt: 2350,
    liquidationLtv: 0.8,
    borrowApy: 0.064,
    baselineHf: (5052 * 0.8) / 2350,
    history: [1.79, 1.77, 1.8, 1.76, 1.78, 1.75, 1.74, 1.76, 1.73, 1.72],
  },
  {
    id: "msol",
    asset: "mSOL",
    protocol: "Kamino",
    units: 52,
    price: 157.4,
    debt: 3200,
    liquidationLtv: 0.75,
    borrowApy: 0.058,
    baselineHf: (52 * 157.4 * 0.75) / 3200,
    history: [1.97, 1.96, 1.99, 1.95, 1.98, 1.96, 1.94, 1.95, 1.93, 1.9183],
  },
  {
    id: "jitosol",
    asset: "JitoSOL",
    protocol: "Kamino",
    units: 32,
    price: 149.8,
    debt: 1650,
    liquidationLtv: 0.75,
    borrowApy: 0.071,
    baselineHf: (32 * 149.8 * 0.75) / 1650,
    history: [2.22, 2.24, 2.23, 2.2, 2.23, 2.22, 2.21, 2.19, 2.2, 2.1789],
  },
];
export function defaultRule(positionId = "sol"): ProtectionRule {
  return {
    id: `rule-${Date.now()}`,
    positionId,
    action: "Repay Debt",
    threshold: 1.3,
    percent: 22,
    maxAmount: 500,
    dailyLimit: 1000,
    slippage: 0.5,
    expiresAt: new Date(Date.now() + 86400000 * 7).toISOString(),
    sessionExpiresAt: new Date(Date.now() + 86400000).toISOString(),
    manualApproval: false,
    armed: true,
    spent: 0,
  };
}
