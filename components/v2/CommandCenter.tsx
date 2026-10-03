"use client";
import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Eye,
  FlaskConical,
  LayoutDashboard,
  Menu,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Wallet,
  Zap,
} from "lucide-react";
import { useDemo } from "@/contexts/DemoContext";
import { useKaminoPositions } from "@/hooks/useKaminoPositions";
import { useRpcStatus } from "@/hooks/useRpcStatus";
import {
  Position,
  ProtectionRule,
  ProtectionEvent,
  DEMO_POSITIONS,
  defaultRule,
  metrics,
  money,
  hfText,
  portfolioMetrics,
  simulate,
  requiredCollateral,
  requiredRepayment,
  explain,
  evaluateRule,
  applyProtection,
} from "@/lib/risk";
import {
  RiskBadge,
  HealthFactor,
  LiquidationDistance,
  RiskGauge,
  TrendChart,
  Modal,
  ProtectionTimeline,
  Stat,
} from "./Primitives";
const NAV = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Positions", icon: Wallet },
  { name: "Risk Radar", icon: Radio },
  { name: "Simulator", icon: FlaskConical },
  { name: "Protection", icon: Shield },
  { name: "Activity", icon: Activity },
  { name: "AI Guardian", icon: Sparkles },
];
const newEvent = (
  title: string,
  detail: string,
  category: ProtectionEvent["category"] = "Alerts",
  status: ProtectionEvent["status"] = "info",
): ProtectionEvent => ({
  id: crypto.randomUUID(),
  time: new Date().toISOString(),
  title,
  detail,
  category,
  status,
});
export default function CommandCenter() {
  const { isDemoMode, enableDemoMode, disableDemoMode } = useDemo();
  const { connected, connecting, publicKey } = useWallet();
  const live = useKaminoPositions();
  const rpc = useRpcStatus(connected && !isDemoMode);
  const [page, setPage] = useState("Landing"),
    [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false);
  const [positions, setPositions] = useState<Position[]>(
      DEMO_POSITIONS.map((p) => ({ ...p, history: [...p.history] })),
    ),
    [walletUsdc, setWalletUsdc] = useState(2400),
    [rules, setRules] = useState<ProtectionRule[]>([]),
    [events, setEvents] = useState<ProtectionEvent[]>([]);
  const [selected, setSelected] = useState<string | null>(null),
    [ruleEditor, setRuleEditor] = useState<ProtectionRule | null>(null),
    [drop, setDrop] = useState(0),
    [target, setTarget] = useState(1.6),
    [question, setQuestion] = useState(
      "Which position is closest to liquidation?",
    ),
    [answer, setAnswer] = useState(""),
    [toast, setToast] = useState("");
  const [riskFilter, setRiskFilter] = useState("All risk"),
    [assetFilter, setAssetFilter] = useState("All assets"),
    [protectionFilter, setProtectionFilter] = useState("All protection"),
    [sort, setSort] = useState("Highest Risk"),
    [activityFilter, setActivityFilter] = useState("All events"),
    [notifications, setNotifications] = useState(false),
    [settings, setSettings] = useState(false);
  const [shockStep, setShockStep] = useState(-1),
    [shockRunning, setShockRunning] = useState(false),
    [pending, setPending] = useState<{
      rule: ProtectionRule;
      position: Position;
      amount: number;
    } | null>(null),
    [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]),
    stateRef = useRef({ positions, rules, walletUsdc });
  stateRef.current = { positions, rules, walletUsdc };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  const current = isDemoMode ? positions : [];
  const summary = portfolioMetrics(current);
  const nearest = summary.nearest;
  const selectedPosition = current.find((p) => p.id === selected);
  const activeRules = isDemoMode
    ? rules.filter(
        (r) =>
          r.armed &&
          Date.parse(r.expiresAt) > Date.now() &&
          Date.parse(r.sessionExpiresAt) > Date.now(),
      )
    : [];
  function addEvent(e: ProtectionEvent) {
    setEvents((v) => [e, ...v]);
    setToast(e.title);
  }
  function navigate(p: string) {
    setPage(p);
    setMobile(false);
    setNotifications(false);
  }
  function resetDemo() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setShockRunning(false);
    setShockStep(-1);
    setPending(null);
    setPositions(
      DEMO_POSITIONS.map((p) => ({ ...p, history: [...p.history] })),
    );
    setWalletUsdc(2400);
    setRules([defaultRule()]);
    setEvents([
      newEvent(
        "Demo portfolio initialized",
        "3 simulated Kamino positions · 2,400 USDC available. No real funds or transactions.",
        "Wallet Events",
      ),
    ]);
    setDrop(0);
  }
  function launchDemo() {
    resetDemo();
    enableDemoMode();
    navigate("Overview");
  }
  function leaveDemo() {
    timers.current.forEach(clearTimeout);
    setShockRunning(false);
    setPending(null);
    setEvents([]);
    disableDemoMode();
    navigate("Overview");
  }
  function execute(rule: ProtectionRule, p: Position, amount: number) {
    const actual = stateRef.current.positions.find((x) => x.id === p.id);
    const currentRule = stateRef.current.rules.find((r) => r.id === rule.id);
    if (!actual || !currentRule) return;
    const check = evaluateRule(
      currentRule,
      actual,
      stateRef.current.walletUsdc,
    );
    if (!check.ok) {
      addEvent(
        newEvent(
          "Action blocked",
          check.reason,
          "Protection Actions",
          "failed",
        ),
      );
      return;
    }
    const bounded = Math.min(amount, check.amount);
    const result = applyProtection(actual, currentRule, bounded);
    setPositions((ps) =>
      ps.map((x) =>
        x.id === p.id
          ? { ...result, history: [...actual.history, metrics(result).hf] }
          : x,
      ),
    );
    if (rule.action !== "Deleverage" && rule.action !== "Notify Only")
      setWalletUsdc((v) => v - bounded);
    setRules((rs) =>
      rs.map((r) =>
        r.id === rule.id ? { ...r, spent: r.spent + bounded } : r,
      ),
    );
    const e = newEvent(
      rule.action === "Notify Only"
        ? "Risk notification simulated"
        : "Protection completed · SIMULATED",
      `${rule.action} ${money(bounded, 2)} · HF ${hfText(metrics(actual).hf)} → ${hfText(metrics(result).hf)}. No blockchain transaction.`,
      "Transactions",
      "success",
    );
    e.transaction = { status: "simulated", amount: bounded };
    addEvent(e);
    setPending(null);
  }
  function triggerRules() {
    const s = stateRef.current;
    const p = s.positions.find((p) => p.id === "sol");
    if (!p) return;
    const rule = s.rules.find((r) => r.positionId === p.id && r.armed);
    if (!rule) {
      addEvent(
        newEvent(
          "No active protection rule",
          "The position remains exposed. Create or arm a rule to simulate protection.",
          "Protection Actions",
          "failed",
        ),
      );
      return;
    }
    const check = evaluateRule(rule, p, s.walletUsdc);
    if (!check.ok) {
      addEvent(
        newEvent(
          "Protection blocked",
          check.reason,
          "Protection Actions",
          "failed",
        ),
      );
      return;
    }
    addEvent(
      newEvent(
        "Protection rule triggered",
        `HF ${hfText(metrics(p).hf)} < ${rule.threshold.toFixed(2)} · ${rule.action} up to ${money(check.amount, 2)}`,
        "Protection Actions",
        "pending",
      ),
    );
    if (rule.manualApproval) {
      setPending({ rule, position: p, amount: check.amount });
      return;
    }
    timers.current.push(
      setTimeout(() => {
        addEvent(
          newEvent(
            "Repayment prepared · SIMULATED",
            "Balance, execution cap, daily limit and permission expiry checked.",
            "Protection Actions",
            "pending",
          ),
        );
      }, 3000),
    );
    timers.current.push(setTimeout(() => execute(rule, p, check.amount), 6000));
  }
  function marketShock() {
    if (!isDemoMode || shockRunning) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPending(null);
    setPositions(
      DEMO_POSITIONS.map((p) => ({ ...p, history: [...p.history] })),
    );
    setShockRunning(true);
    setShockStep(0);
    addEvent(
      newEvent(
        "Market shock started · DEMO",
        "A 26% correlated SOL decline will unfold over 36 seconds.",
        "Alerts",
      ),
    );
    [4, 8, 13, 18, 23, 26].forEach((d, i) =>
      timers.current.push(
        setTimeout(
          () => {
            setShockStep(i + 1);
            setPositions((ps) =>
              ps.map((p, j) => {
                const updated = {
                  ...p,
                  price: DEMO_POSITIONS[j].price * (1 - d / 100),
                };
                return {
                  ...updated,
                  history: [...p.history, metrics(updated).hf],
                };
              }),
            );
            if (i === 2)
              addEvent(
                newEvent(
                  "SOL/USDC entered WATCH",
                  "SOL collateral declined 13%; USDC debt is unchanged.",
                  "Alerts",
                ),
              );
            if (i === 5) {
              addEvent(
                newEvent(
                  "SOL/USDC entered WARNING",
                  "26% collateral-price decline detected. Evaluating the protection rule.",
                  "Alerts",
                ),
              );
              timers.current.push(setTimeout(triggerRules, 1000));
            }
          },
          (i + 1) * 4500,
        ),
      ),
    );
    timers.current.push(
      setTimeout(() => {
        setShockRunning(false);
        setShockStep(8);
      }, 37000),
    );
  }
  function guardian(q: string) {
    setQuestion(q);
    if (!nearest) {
      setAnswer(
        "No verified portfolio is available. Launch Demo or connect a wallet; live Kamino indexing must be configured before analysis.",
      );
      return;
    }
    const shock = q.match(/(\d+)\s*%/);
    if (shock) {
      const d = Math.min(50, Number(shock[1]));
      const projected = simulate(nearest, d);
      setAnswer(
        `Under a ${d}% correlated SOL price decline, ${nearest.asset}/USDC changes from HF ${hfText(metrics(nearest).hf)} to ${hfText(metrics(projected).hf)} (${metrics(projected).risk}). ${explain(projected, target)} Scenario assumes constant USDC debt and unchanged liquidation thresholds.`,
      );
    } else if (q.includes("1.8")) setAnswer(explain(nearest, 1.8));
    else setAnswer(explain(nearest, target));
  }
  const sorted = [...current]
    .filter(
      (p) =>
        (riskFilter === "All risk" || metrics(p).risk === riskFilter) &&
        (assetFilter === "All assets" || p.asset === assetFilter) &&
        (protectionFilter === "All protection" ||
          activeRules.some((r) => r.positionId === p.id) ===
            (protectionFilter === "Armed")),
    )
    .sort((a, b) =>
      sort === "Position Size"
        ? metrics(b).collateral - metrics(a).collateral
        : sort === "Liquidation Distance"
          ? metrics(a).buffer - metrics(b).buffer
          : metrics(a).hf - metrics(b).hf,
    );
  const protectedCapital = current
    .filter((p) => activeRules.some((r) => r.positionId === p.id))
    .reduce((s, p) => s + metrics(p).collateral, 0);
  function positionTable() {
    return (
      <div className="position-list">
        <div className="table-head">
          <span>POSITION / PROTOCOL</span>
          <span>COLLATERAL</span>
          <span>DEBT</span>
          <span>HEALTH FACTOR</span>
          <span>LIQ. BUFFER</span>
          <span>STATUS</span>
        </div>
        {sorted.map((p) => (
          <button
            className="position-row"
            key={p.id}
            onClick={() => setSelected(p.id)}
          >
            <span className="asset-name">
              <span className={`coin ${p.asset.toLowerCase()}`}>
                {p.asset === "SOL" ? "≋" : p.asset === "mSOL" ? "m" : "J"}
              </span>
              <span>
                <b>
                  {p.asset} <em>/ USDC</em>
                </b>
                <small>
                  <i className="protocol-dot" /> Kamino{" "}
                  <span className="market-label">MAIN MARKET</span>
                </small>
              </span>
            </span>
            <span data-label="Collateral">{money(metrics(p).collateral)}</span>
            <span data-label="Debt">{money(p.debt)}</span>
            <span data-label="Health factor">
              <HealthFactor value={metrics(p).hf} />
              <small className="hf-change">
                {(metrics(p).hf - p.baselineHf).toFixed(2)} from start
              </small>
            </span>
            <span className="table-distance">
              <LiquidationDistance position={p} compact />
            </span>
            <span className="row-end">
              <RiskBadge risk={metrics(p).risk} />
              <ChevronRight size={15} />
            </span>
          </button>
        ))}
        {!sorted.length && (
          <div className="empty small">No positions match these filters.</div>
        )}
      </div>
    );
  }
  if (page === "Landing")
    return (
      <main className="landing">
        <header className="landing-nav">
          <a className="brand" href="#" aria-label="Argus home">
            <span className="brand-mark">A</span>ARGUS <sup>V2</sup>
          </a>
          <span className="landing-tag">BUILT FOR THE FRONTIER</span>
          <button className="button" onClick={() => navigate("Overview")}>
            Launch App <ArrowUpRight size={15} />
          </button>
        </header>
        <div className="hero">
          <section>
            <span className="eyebrow">
              <i className="status-dot" /> AUTONOMOUS RISK INTELLIGENCE FOR
              SOLANA
            </span>
            <h1>
              See liquidation
              <br />
              coming.
              <br />
              <span>
                Act before
                <br />
                it happens.
              </span>
            </h1>
            <p>
              The autonomous risk layer for Solana DeFi. Monitor your positions,
              explore the downside, and define your next move before the market
              makes it for you.
            </p>
            <div className="actions">
              <button
                className="button primary"
                onClick={() => navigate("Overview")}
              >
                Launch App <ArrowUpRight size={17} />
              </button>
              <button className="button" onClick={launchDemo}>
                Explore Demo <Play size={14} />
              </button>
            </div>
            <small className="hero-foot">
              <ShieldCheck size={14} /> Non-custodial by design <span>·</span>{" "}
              Transparent by default
            </small>
          </section>
          <section className="hero-terminal">
            <div className="panel-heading">
              <span className="eyebrow">ARGUS / RISK PREVIEW</span>
              <span className="demo-label">INTERACTIVE DEMO</span>
            </div>
            <div className="preview-orbit">
              <div className="orbit-ring" />
              <div className="orbit-ring inner" />
              <span className="orbit-cross">+</span>
              <RiskGauge
                score={
                  portfolioMetrics(DEMO_POSITIONS.map((p) => simulate(p, drop)))
                    .score
                }
                risk={
                  portfolioMetrics(DEMO_POSITIONS.map((p) => simulate(p, drop)))
                    .risk
                }
              />
            </div>
            <div className="preview-position">
              <b>SOL / USDC</b>
              <HealthFactor
                value={metrics(simulate(DEMO_POSITIONS[0], drop)).hf}
              />
            </div>
            <LiquidationDistance position={simulate(DEMO_POSITIONS[0], drop)} />
            <div className="preview-slider">
              <div className="between">
                <span>WHAT IF SOL FALLS?</span>
                <b className="orange">−{drop}%</b>
              </div>
              <input
                aria-label="Landing SOL price decline"
                type="range"
                min="0"
                max="50"
                value={drop}
                onChange={(e) => setDrop(+e.target.value)}
              />
            </div>
            <div className="terminal-footer">
              <span className="status-dot" /> Move the slider. See the risk.
            </div>
          </section>
        </div>
        <div className="landing-steps">
          {[
            [
              "01",
              "MONITOR",
              "Watch every position.",
              "One clear view of your liquidation exposure.",
            ],
            [
              "02",
              "PREDICT",
              "Explore the downside.",
              "Stress-test a changing market in real time.",
            ],
            [
              "03",
              "PROTECT",
              "Set your boundaries.",
              "Test rules with explicit limits and permissions.",
            ],
            [
              "04",
              "VERIFY",
              "See every action.",
              "Transparent timelines. No invisible decisions.",
            ],
          ].map(([n, t, h, p]) => (
            <section key={n}>
              <span className="eyebrow">
                {n} / {t}
              </span>
              <h3>{h}</h3>
              <p>{p}</p>
            </section>
          ))}
        </div>
        <footer className="landing-footer">
          <span>ARGUS © 2026</span>
          <span>WATCH → PREDICT → SIMULATE → PROTECT</span>
          <span>Live execution is not enabled. Explore the simulation.</span>
        </footer>
      </main>
    );
  return (
    <div
      className={`app-shell ${collapsed ? "collapsed" : ""} ${mobile ? "mobile-open" : ""}`}
    >
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("Landing")}>
          <span className="brand-mark">A</span>
          <span className="nav-label">
            ARGUS <sup>V2</sup>
          </span>
        </button>
        <div className="workspace-label nav-label">
          RISK INTELLIGENCE <span>01</span>
        </div>
        <nav>
          {NAV.map(({ name, icon: Icon }) => (
            <button
              title={name}
              className={page === name ? "active" : ""}
              key={name}
              onClick={() => navigate(name)}
            >
              <Icon size={18} />
              <span className="nav-label">{name}</span>
              {name === "AI Guardian" && (
                <span className="nav-label tiny-badge">AI</span>
              )}
              {page === name && <i className="nav-active" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="guardian-status nav-label">
            <span className="status-dot" />{" "}
            {isDemoMode ? "DEMO GUARDIAN" : "READ-ONLY MODE"}
            <p>
              {isDemoMode
                ? "Your next move, before the market."
                : "Connect to inspect your wallet."}
            </p>
          </div>
          <div className="network nav-label">
            <span>
              <i className="solana-icon">≋</i> Solana Mainnet
            </span>
            <small>
              RPC{" "}
              <b className={rpc === "Online" ? "safe" : ""}>
                {isDemoMode ? "Not used in demo" : rpc}
              </b>
            </small>
          </div>
          <button className="sidebar-setting" onClick={() => setSettings(true)}>
            <Settings size={17} />
            <span className="nav-label">Settings</span>
          </button>
          <div className="wallet-box">
            {isDemoMode ? (
              <>
                <span className="wallet-avatar">
                  <Wallet size={17} />
                </span>
                <span className="nav-label">
                  <b>Demo portfolio</b>
                  <small>No wallet connected to demo</small>
                </span>
              </>
            ) : (
              <WalletMultiButton />
            )}
          </div>
          <button
            className="collapse-toggle"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight size={15} />
            ) : (
              <>
                <ChevronLeft size={15} />
                <span className="nav-label">Collapse sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle navigation"
              onClick={() => setMobile((v) => !v)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <b>{page}</b>
          </div>
          <div className="top-actions">
            <span className="system-status">
              <i className="status-dot" />
              {isDemoMode
                ? "SIMULATED FEED"
                : connected
                  ? "WALLET CONNECTED"
                  : "DISCONNECTED"}
            </span>
            {isDemoMode ? (
              <button className="demo-label" onClick={leaveDemo}>
                DEMO MODE <XSmall />
              </button>
            ) : (
              <button className="button small" onClick={launchDemo}>
                Explore Demo
              </button>
            )}
            <button
              className="notification-button icon-button"
              aria-label="Open notifications"
              onClick={() => setNotifications((v) => !v)}
            >
              <Bell size={18} />
              {events.some((e) => e.category === "Alerts") && <i />}
            </button>
          </div>
        </header>
        {notifications && (
          <div className="notification-panel">
            <div className="panel-heading">
              <h3>Notifications</h3>
              <button
                className="text-button"
                onClick={() => navigate("Activity")}
              >
                View all
              </button>
            </div>
            {events
              .filter((e) => e.category === "Alerts")
              .slice(0, 4)
              .map((e) => (
                <div className="notification" key={e.id}>
                  <b>{e.title}</b>
                  <p>{e.detail}</p>
                  <div className="actions">
                    <button
                      onClick={() => {
                        setSelected("sol");
                        setNotifications(false);
                      }}
                    >
                      View position
                    </button>
                    <button onClick={() => navigate("Simulator")}>
                      Simulate
                    </button>
                    <button onClick={() => navigate("Protection")}>
                      Protect
                    </button>
                  </div>
                </div>
              ))}
            {!events.some((e) => e.category === "Alerts") && (
              <p className="muted">No alerts yet.</p>
            )}
          </div>
        )}
        <main className="workspace">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {page === "Overview"
                  ? "YOUR DEFI, UNDER WATCH"
                  : `INTELLIGENCE / ${page.toUpperCase()}`}
              </span>
              <h1>{page === "Overview" ? "Command center" : page}</h1>
              <p>
                {page === "Overview"
                  ? `A clear view of your risk. ${current.length ? `Argus is watching ${current.length} simulated positions.` : "Connect a wallet or launch the demo portfolio."}`
                  : page === "Protection"
                    ? "Your rules. Your limits. Your next line of defense."
                    : page === "Simulator"
                      ? "Explore the downside before the market gets there."
                      : page === "AI Guardian"
                        ? "Portfolio-aware intelligence. Every answer grounded in your numbers."
                        : "Every signal, in context."}
              </p>
            </div>
            <div className="heading-actions">
              {isDemoMode && (
                <button
                  className="button"
                  onClick={resetDemo}
                  disabled={shockRunning}
                >
                  <RotateCcw size={14} /> Reset
                </button>
              )}
              {isDemoMode && (
                <button
                  className="button primary"
                  onClick={marketShock}
                  disabled={shockRunning}
                >
                  <Zap size={15} />
                  {shockRunning
                    ? "Shock in progress…"
                    : "Simulate market shock"}
                </button>
              )}
            </div>
          </div>
          {isDemoMode && (
            <div className="demo-strip">
              <span>
                <span className="demo-label">DEMO</span> Simulated positions &
                actions. No real funds are moved.
              </span>
              <span>
                Session balance <b>{money(walletUsdc, 2)} USDC</b>
              </span>
            </div>
          )}
          {shockStep >= 0 && isDemoMode && (
            <div className="shock-strip">
              <span className={shockRunning ? "pulsing" : ""}>
                <Radio size={16} />
              </span>
              <div>
                <b>
                  {shockRunning
                    ? "Market shock simulation running"
                    : "Market shock complete"}
                </b>
                <p>
                  {shockStep < 6
                    ? "SOL price is falling. Risk calculations update from the same portfolio state."
                    : pending
                      ? "Protection is awaiting your approval."
                      : shockStep < 8
                        ? "Risk detected. Checking protection permissions and limits."
                        : "Review the timeline below to inspect what happened."}
                </p>
              </div>
              <div className="shock-progress">
                <i
                  style={{ width: `${Math.min(100, (shockStep / 8) * 100)}%` }}
                />
              </div>
            </div>
          )}
          {!isDemoMode ? (
            <section className="panel connection-empty">
              <Compass size={42} />
              <span className="eyebrow">YOUR WALLET. YOUR CONTROL.</span>
              <h2>
                {connecting
                  ? "Connecting wallet…"
                  : connected
                    ? "Wallet connected. Position data unavailable."
                    : "Bring your positions into focus."}
              </h2>
              <p>
                {connected
                  ? `${publicKey?.toBase58().slice(0, 6)}…${publicKey?.toBase58().slice(-4)} · ${rpc}. Wallet access is read-only. Live Kamino indexing and transaction execution are not configured in this version.`
                  : "Connect Phantom or Solflare for read-only wallet access, or explore the full command center with a simulated portfolio."}
              </p>
              <div className="actions">
                <WalletMultiButton />
                <button className="button primary" onClick={launchDemo}>
                  Launch demo portfolio <ArrowRight size={16} />
                </button>
              </div>
              {live.loading ? (
                <div className="skeleton">Checking position service…</div>
              ) : (
                live.error && (
                  <div className="error-state">
                    {live.error}
                    <button className="button small" onClick={live.refetch}>
                      Retry scan
                    </button>
                  </div>
                )
              )}
              <small>
                Argus never asks for your seed phrase. Connecting a wallet
                grants no spending permission.
              </small>
            </section>
          ) : (
            <>
              {page === "Overview" && (
                <>
                  <div className="overview-grid">
                    <section className="panel risk-panel">
                      <div className="panel-heading">
                        <h2>Portfolio risk</h2>
                        <span className="eyebrow">
                          ARGUS SCORE{" "}
                          <span title="Heuristic based on the lowest position HF; not a probability of liquidation.">
                            ⓘ
                          </span>
                        </span>
                      </div>
                      <div className="risk-layout">
                        <RiskGauge score={summary.score} risk={summary.risk} />
                        <div className="risk-explanation">
                          <span className="eyebrow">
                            {summary.risk === "SAFE"
                              ? "ROOM TO BREATHE"
                              : "ATTENTION REQUIRED"}
                          </span>
                          <h3>
                            {summary.risk === "SAFE"
                              ? "You’re in safe territory."
                              : "The buffer is getting thinner."}
                          </h3>
                          <p>
                            Your portfolio can withstand approximately a{" "}
                            <b>
                              {nearest
                                ? Math.max(0, metrics(nearest).buffer).toFixed(
                                    1,
                                  )
                                : "—"}
                              % correlated SOL decline
                            </b>{" "}
                            before the first modeled liquidation threshold.
                          </p>
                          <button
                            className="text-button"
                            onClick={() => navigate("Simulator")}
                          >
                            Stress-test portfolio <ArrowUpRight size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="risk-panel-footer">
                        <span>
                          <i className="status-dot" /> {current.length}{" "}
                          positions analyzed
                        </span>
                        <span>
                          Single-collateral model{" "}
                          <span title="Assumes all collateral moves together; fixed USDC debt and liquidation thresholds.">
                            ⓘ
                          </span>
                        </span>
                      </div>
                    </section>
                    <section className="panel guardian-card">
                      <div className="panel-heading">
                        <span className="guardian-icon">
                          <Sparkles size={18} />
                        </span>
                        <span className="eyebrow">GUARDIAN BRIEFING</span>
                        <span className="tiny-badge">CONTEXTUAL</span>
                      </div>
                      <h3>
                        {nearest && metrics(nearest).risk === "SAFE"
                          ? "Eyes on the horizon."
                          : "Your next move matters."}
                      </h3>
                      <p>
                        {nearest ? explain(nearest) : "Waiting for positions."}
                      </p>
                      <div className="guardian-card-footer">
                        <span>Based on current demo state</span>
                        <button
                          className="icon-button"
                          aria-label="Open AI Guardian"
                          onClick={() => navigate("AI Guardian")}
                        >
                          <ArrowUpRight size={18} />
                        </button>
                      </div>
                    </section>
                  </div>
                  <div className="stats-grid">
                    <Stat
                      label="TOTAL COLLATERAL"
                      value={money(summary.collateral)}
                      note="Across 3 Kamino positions"
                    />
                    <Stat
                      label="TOTAL DEBT"
                      value={money(summary.debt)}
                      note={`${((summary.debt / summary.collateral) * 100).toFixed(1)}% portfolio LTV`}
                    />
                    <Stat
                      label="RULE-COVERED CAPITAL"
                      value={money(protectedCapital)}
                      note={`${activeRules.length} active demo rule · not guaranteed`}
                    />
                    <Stat
                      label="NEAREST LIQUIDATION"
                      value={
                        nearest
                          ? money(metrics(nearest).liquidationPrice, 2)
                          : "—"
                      }
                      note={`${nearest?.asset} · ${nearest ? metrics(nearest).buffer.toFixed(1) : 0}% below current`}
                      accent
                    />
                  </div>
                  <section className="panel">
                    <div className="panel-heading">
                      <div className="heading-inline">
                        <h2>Your positions</h2>
                        <span className="count">{current.length}</span>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => navigate("Positions")}
                      >
                        View all positions <ArrowUpRight size={14} />
                      </button>
                    </div>
                    {positionTable()}
                  </section>
                  <div className="bottom-grid">
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>Health factor trajectory</h2>
                        <span className="chart-legend">
                          <i /> SOL / USDC · DEMO
                        </span>
                      </div>
                      <div className="chart-summary">
                        <strong>{hfText(metrics(current[0]).hf)}</strong>
                        <span>Current health factor</span>
                        <RiskBadge risk={metrics(current[0]).risk} />
                      </div>
                      <TrendChart values={current[0].history} large />
                      <div className="chart-axis">
                        <span>Session start</span>
                        <span>Latest simulated sample</span>
                      </div>
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>Protection timeline</h2>
                        <button
                          className="text-button"
                          onClick={() => navigate("Activity")}
                        >
                          All activity <ArrowUpRight size={14} />
                        </button>
                      </div>
                      <ProtectionTimeline
                        events={events
                          .filter((e) => e.category !== "Wallet Events")
                          .slice(0, 3)}
                      />
                    </section>
                  </div>
                </>
              )}
              {(page === "Positions" || page === "Risk Radar") && (
                <>
                  <div className="radar-summary">
                    {["SAFE", "WATCH", "WARNING", "CRITICAL"].map((r) => (
                      <button
                        className={`panel ${riskFilter === r ? "selected" : ""}`}
                        key={r}
                        onClick={() =>
                          setRiskFilter(riskFilter === r ? "All risk" : r)
                        }
                      >
                        <span className={`signal ${r.toLowerCase()}`} />
                        <span>{r}</span>
                        <strong>
                          {current.filter((p) => metrics(p).risk === r).length}
                        </strong>
                      </button>
                    ))}
                  </div>
                  <section className="panel">
                    <div className="filters">
                      <label>
                        Protocol
                        <select aria-label="Protocol">
                          <option>Kamino</option>
                        </select>
                      </label>
                      <label>
                        Asset
                        <select
                          value={assetFilter}
                          onChange={(e) => setAssetFilter(e.target.value)}
                        >
                          {["All assets", "SOL", "mSOL", "JitoSOL"].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Risk
                        <select
                          value={riskFilter}
                          onChange={(e) => setRiskFilter(e.target.value)}
                        >
                          {[
                            "All risk",
                            "SAFE",
                            "WATCH",
                            "WARNING",
                            "CRITICAL",
                          ].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Protection
                        <select
                          value={protectionFilter}
                          onChange={(e) => setProtectionFilter(e.target.value)}
                        >
                          {["All protection", "Armed", "Unprotected"].map(
                            (v) => (
                              <option key={v}>{v}</option>
                            ),
                          )}
                        </select>
                      </label>
                      <label className="sort-select">
                        Sort by
                        <select
                          value={sort}
                          onChange={(e) => setSort(e.target.value)}
                        >
                          {[
                            "Highest Risk",
                            "Liquidation Distance",
                            "Position Size",
                            "Health Factor",
                          ].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {positionTable()}
                  </section>
                  <p className="footnote">
                    SAFE ≥ 1.60 · WATCH ≥ 1.30 · WARNING ≥ 1.10 · CRITICAL &lt;
                    1.10. HF ≤ 1.00 reaches the modeled liquidation threshold.
                    Changes are measured from demo start, not a live 24h feed.
                  </p>
                </>
              )}
              {page === "Simulator" && (
                <>
                  <div className="simulator-grid">
                    <section className="panel scenario-controls">
                      <div className="panel-heading">
                        <h2>Market scenario</h2>
                        <FlaskConical size={17} />
                      </div>
                      <span className="eyebrow">
                        CORRELATED SOL PRICE CHANGE
                      </span>
                      <div className="scenario-number">
                        −{drop}
                        <span>%</span>
                      </div>
                      <input
                        type="range"
                        aria-label="SOL price change"
                        min="0"
                        max="50"
                        step="1"
                        value={drop}
                        onChange={(e) => setDrop(+e.target.value)}
                      />
                      <div className="between muted">
                        <span>0% · current</span>
                        <span>−50% · severe</span>
                      </div>
                      <div className="presets">
                        {[5, 10, 20, 30].map((n) => (
                          <button
                            className={drop === n ? "chosen" : ""}
                            key={n}
                            onClick={() => setDrop(n)}
                          >
                            −{n}%
                          </button>
                        ))}
                      </div>
                      <label className="field">
                        Target health factor
                        <input
                          type="number"
                          step=".05"
                          min="1.1"
                          max="3"
                          value={target}
                          onChange={(e) =>
                            setTarget(
                              Math.max(
                                1.1,
                                Math.min(3, +e.target.value || 1.6),
                              ),
                            )
                          }
                        />
                      </label>
                      <div className="assumptions">
                        <span className="eyebrow">MODEL ASSUMPTIONS</span>
                        <p>
                          SOL, mSOL and JitoSOL move together. USDC debt and
                          liquidation thresholds stay fixed. No interest growth,
                          depeg, fees or oracle delay during the shock.
                        </p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => setDrop(0)}
                      >
                        <RotateCcw size={14} /> Reset scenario
                      </button>
                    </section>
                    <section className="scenario-results">
                      <div className="scenario-banner">
                        <span className="eyebrow">IF SOL FALLS {drop}%</span>
                        <h2>
                          {
                            current.filter(
                              (p) => metrics(simulate(p, drop)).hf < 1.3,
                            ).length
                          }{" "}
                          positions in warning or critical
                        </h2>
                        <p>
                          Deterministic estimates from your current demo
                          portfolio.
                        </p>
                      </div>
                      {current.map((p) => {
                        const projected = simulate(p, drop);
                        const m = metrics(projected);
                        return (
                          <article className="panel simulation-card" key={p.id}>
                            <div className="panel-heading">
                              <h3>
                                {p.asset} / USDC <small>Kamino</small>
                              </h3>
                              <RiskBadge risk={m.risk} />
                            </div>
                            <div className="simulation-metrics">
                              <div>
                                <span>HEALTH FACTOR</span>
                                <b>
                                  <em>{hfText(metrics(p).hf)}</em> →{" "}
                                  <HealthFactor value={m.hf} />
                                </b>
                              </div>
                              <div>
                                <span>LIQUIDATION BUFFER</span>
                                <b>
                                  <em>{metrics(p).buffer.toFixed(1)}%</em> →{" "}
                                  {m.buffer.toFixed(1)}%
                                </b>
                              </div>
                              <div>
                                <span>COLLATERAL VALUE</span>
                                <b>{money(m.collateral)}</b>
                              </div>
                            </div>
                            <LiquidationDistance position={projected} compact />
                            <div className="recommendation">
                              <Sparkles size={16} />
                              <p>
                                {m.hf <= 1 ? (
                                  "Modeled liquidation threshold crossed. A rescue cannot be assumed."
                                ) : requiredRepayment(projected, target) > 0 ? (
                                  <>
                                    Repay{" "}
                                    <b>
                                      {money(
                                        requiredRepayment(projected, target),
                                        2,
                                      )}{" "}
                                      USDC
                                    </b>{" "}
                                    or add{" "}
                                    <b>
                                      {money(
                                        requiredCollateral(projected, target),
                                        2,
                                      )}{" "}
                                      of {p.asset}
                                    </b>{" "}
                                    collateral to reach HF {target.toFixed(2)}.
                                  </>
                                ) : (
                                  `Already above your ${target.toFixed(2)} target health factor.`
                                )}
                              </p>
                            </div>
                          </article>
                        );
                      })}
                    </section>
                  </div>
                </>
              )}
              {page === "Protection" && (
                <>
                  <div className="protection-toolbar">
                    <div>
                      <ShieldCheck size={20} />
                      <span>
                        <b>
                          {activeRules.length} demo rule
                          {activeRules.length !== 1 ? "s" : ""} armed
                        </b>
                        <small>
                          Local to this session · simulated execution only
                        </small>
                      </span>
                    </div>
                    <div className="actions">
                      <button
                        className="button danger"
                        onClick={() => {
                          setRules((rs) =>
                            rs.map((r) => ({ ...r, armed: false })),
                          );
                          setPending(null);
                          addEvent(
                            newEvent(
                              "Automation revoked",
                              "All demo rules paused. No on-chain permissions were granted.",
                              "Rule Changes",
                            ),
                          );
                        }}
                      >
                        Revoke automation
                      </button>
                      <button
                        className="button primary"
                        disabled={shockRunning}
                        onClick={() => setRuleEditor(defaultRule())}
                      >
                        <Plus size={16} /> Create rule
                      </button>
                    </div>
                  </div>
                  <div className="rule-grid">
                    {rules.map((r) => {
                      const p = current.find((p) => p.id === r.positionId)!;
                      return (
                        <article className="panel rule-card" key={r.id}>
                          <div className="panel-heading">
                            <span className="heading-inline">
                              <Shield size={17} />
                              <h3>{p.asset} / USDC</h3>
                            </span>
                            <span
                              className={`risk-badge ${r.armed ? "safe" : "watch"}`}
                            >
                              {r.armed ? "ARMED · DEMO" : "PAUSED"}
                            </span>
                          </div>
                          <div className="rule-flow">
                            <span>IF</span>
                            <h3>
                              Health factor{" "}
                              <em>&lt; {r.threshold.toFixed(2)}</em>
                            </h3>
                            <span>THEN</span>
                            <h3>
                              {r.action}{" "}
                              <em>
                                {r.action === "Notify Only"
                                  ? ""
                                  : `${r.percent}%`}
                              </em>
                            </h3>
                            <small>
                              {r.action === "Top Up Collateral"
                                ? "Model converts wallet USDC into the same collateral asset."
                                : r.action === "Deleverage"
                                  ? "Sell collateral and repay debt; slippage haircut applied."
                                  : "Using simulated wallet USDC balance."}
                            </small>
                          </div>
                          <div className="rule-limits">
                            <span>
                              Max execution<b>{money(r.maxAmount)}</b>
                            </span>
                            <span>
                              Daily cap<b>{money(r.dailyLimit)}</b>
                            </span>
                            <span>
                              Max slippage<b>{r.slippage}%</b>
                            </span>
                            <span>
                              Approval
                              <b>
                                {r.manualApproval ? "Manual" : "Demo automatic"}
                              </b>
                            </span>
                          </div>
                          <div className="rule-expiry">
                            Session expires{" "}
                            {new Date(r.sessionExpiresAt).toLocaleString()}
                            <br />
                            Rule expires{" "}
                            {new Date(r.expiresAt).toLocaleString()}
                          </div>
                          <div className="rule-actions">
                            <button
                              disabled={shockRunning}
                              onClick={() => setRuleEditor({ ...r })}
                            >
                              Edit rule
                            </button>
                            <button
                              onClick={() => {
                                setRules((rs) =>
                                  rs.map((x) =>
                                    x.id === r.id
                                      ? { ...x, armed: !x.armed }
                                      : x,
                                  ),
                                );
                                addEvent(
                                  newEvent(
                                    r.armed ? "Rule paused" : "Rule armed",
                                    "Demo rule state updated.",
                                    "Rule Changes",
                                  ),
                                );
                              }}
                            >
                              {r.armed ? (
                                <Pause size={13} />
                              ) : (
                                <Play size={13} />
                              )}{" "}
                              {r.armed ? "Pause" : "Arm"}
                            </button>
                            <button
                              onClick={() => {
                                const check = evaluateRule(r, p, walletUsdc);
                                addEvent(
                                  newEvent(
                                    "Rule dry run",
                                    `${check.reason}. ${check.ok ? `Proposed ${money(check.amount, 2)} ${r.action}.` : ""} No state changed.`,
                                    "Protection Actions",
                                  ),
                                );
                              }}
                            >
                              Test
                            </button>
                            <button
                              aria-label="Delete rule"
                              onClick={() => setConfirmDelete(r.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                    {!rules.length && (
                      <div className="panel empty">
                        <Shield size={30} />
                        <h3>No rules yet</h3>
                        <p>
                          Create your first protection rule to test a response.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="permission-note">
                    <ShieldCheck size={20} />
                    <div>
                      <h3>Explicit permission. Bounded execution.</h3>
                      <p>
                        This version cannot spend real wallet funds. Rules run
                        only in the open demo session. Limits, expiry, available
                        balance and manual approval are checked before a
                        simulated action. Top-up and deleverage are simplified
                        models, not executable swap quotes. Daily allowances
                        apply to this demo session; reset starts a new session.
                      </p>
                    </div>
                  </div>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Protection timeline</h2>
                      <span className="demo-label">SIMULATION</span>
                    </div>
                    <ProtectionTimeline
                      events={events.filter((e) =>
                        ["Protection Actions", "Transactions"].includes(
                          e.category,
                        ),
                      )}
                    />
                  </section>
                </>
              )}
              {page === "Activity" && (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>
                      Activity center{" "}
                      <span className="count">{events.length}</span>
                    </h2>
                    <select
                      aria-label="Activity category"
                      value={activityFilter}
                      onChange={(e) => setActivityFilter(e.target.value)}
                    >
                      {[
                        "All events",
                        "Protection Actions",
                        "Alerts",
                        "Transactions",
                        "Rule Changes",
                        "Wallet Events",
                      ].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <ProtectionTimeline
                    events={events.filter(
                      (e) =>
                        activityFilter === "All events" ||
                        e.category === activityFilter,
                    )}
                  />
                </section>
              )}
              {page === "AI Guardian" && (
                <div className="guardian-workspace">
                  <section className="panel guardian-main">
                    <div className="guardian-title">
                      <span className="guardian-icon">
                        <Sparkles size={24} />
                      </span>
                      <span className="eyebrow">
                        PORTFOLIO INTELLIGENCE / DETERMINISTIC ENGINE
                      </span>
                    </div>
                    <h2>
                      Understand the signal.
                      <br />
                      <span>Know your next move.</span>
                    </h2>
                    <p>
                      Contextual explanations from the same calculations
                      powering your command center. No fabricated forecasts or
                      API calls.
                    </p>
                    <div className="suggestions">
                      {[
                        "Why did my risk increase?",
                        "What happens if SOL drops 15%?",
                        "Which position is closest to liquidation?",
                        "How can I reach 1.8 HF?",
                        "Explain my Kamino position.",
                      ].map((q) => (
                        <button key={q} onClick={() => guardian(q)}>
                          {q}
                          <ArrowUpRight size={16} />
                        </button>
                      ))}
                    </div>
                    <form
                      className="guardian-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        guardian(question);
                      }}
                    >
                      <input
                        aria-label="Ask about your portfolio"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="Ask about your portfolio…"
                      />
                      <button
                        className="button primary"
                        type="submit"
                        aria-label="Analyze portfolio question"
                      >
                        <ArrowRight size={19} />
                      </button>
                    </form>
                    {answer && (
                      <div className="guardian-answer" aria-live="polite">
                        <span className="eyebrow">
                          <Sparkles size={13} /> ARGUS INSIGHT · DEMO
                        </span>
                        <p>{answer}</p>
                        <small>
                          Re-run after a market change to update this answer.
                          Unsupported questions receive a portfolio risk
                          summary.
                        </small>
                      </div>
                    )}
                  </section>
                  <section className="panel guardian-context">
                    <span className="eyebrow">CURRENT CONTEXT</span>
                    <h3>Your portfolio, in focus.</h3>
                    {current.map((p) => (
                      <button key={p.id} onClick={() => setSelected(p.id)}>
                        <span>
                          {p.asset} / USDC
                          <small>
                            {money(metrics(p).collateral)} collateral
                          </small>
                        </span>
                        <HealthFactor value={metrics(p).hf} />
                      </button>
                    ))}
                    <div className="permission-note">
                      <Eye size={18} />
                      <p>
                        Read-only insights. Your assets stay in your wallet and
                        protocol positions.
                      </p>
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
          <footer className="workspace-footer">
            <span>
              <ShieldCheck size={12} /> Non-custodial ·{" "}
              {isDemoMode ? "Demo environment" : "Read-only wallet access"}
            </span>
            <span>
              ARGUS V2 <i /> THE AUTONOMOUS RISK LAYER
            </span>
            <span>
              Solana <i className="protocol-dot" />
            </span>
          </footer>
        </main>
      </div>
      {selectedPosition && (
        <Modal
          title={`${selectedPosition.asset} / USDC`}
          drawer
          onClose={() => setSelected(null)}
        >
          <div className="drawer-meta">
            <span>Kamino · main market</span>
            <span className="demo-label">SIMULATED POSITION</span>
          </div>
          <div className="drawer-hf">
            <span>HEALTH FACTOR</span>
            <HealthFactor value={metrics(selectedPosition).hf} />
            <RiskBadge risk={metrics(selectedPosition).risk} />
          </div>
          <LiquidationDistance position={selectedPosition} />
          <div className="detail-grid">
            {[
              ["Collateral", money(metrics(selectedPosition).collateral, 2)],
              ["Debt", money(selectedPosition.debt, 2)],
              ["LTV", `${(metrics(selectedPosition).ltv * 100).toFixed(1)}%`],
              ["Liquidation LTV", `${selectedPosition.liquidationLtv * 100}%`],
              ["Oracle price (demo)", money(selectedPosition.price, 2)],
              [
                "Borrow APY",
                `${(selectedPosition.borrowApy * 100).toFixed(2)}%`,
              ],
              [
                "Interest / day",
                money(
                  (selectedPosition.debt * selectedPosition.borrowApy) / 365,
                  2,
                ),
              ],
              [
                "Protection",
                activeRules.some((r) => r.positionId === selectedPosition.id)
                  ? "Demo rule armed"
                  : "Not armed",
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <span>{k}</span>
                <b>{v}</b>
              </div>
            ))}
          </div>
          <h3>Health factor history</h3>
          <TrendChart values={selectedPosition.history} large />
          <div className="drawer-insight">
            <span className="eyebrow">WHY AM I AT RISK?</span>
            <p>{explain(selectedPosition)}</p>
          </div>
          <div className="actions">
            <button
              className="button"
              onClick={() => {
                setSelected(null);
                navigate("Simulator");
              }}
            >
              Simulate impact
            </button>
            <button
              className="button primary"
              onClick={() => {
                setRuleEditor(defaultRule(selectedPosition.id));
                setSelected(null);
                navigate("Protection");
              }}
            >
              Create protection rule
            </button>
          </div>
        </Modal>
      )}
      {ruleEditor && (
        <Modal
          title={
            rules.some((r) => r.id === ruleEditor.id)
              ? "Edit protection rule"
              : "Create protection rule"
          }
          onClose={() => setRuleEditor(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (
                Date.parse(ruleEditor.expiresAt) <= Date.now() ||
                Date.parse(ruleEditor.sessionExpiresAt) <= Date.now()
              ) {
                setToast("Expiry must be in the future");
                return;
              }
              setRules((rs) => [
                ...rs.filter((r) => r.id !== ruleEditor.id),
                ruleEditor,
              ]);
              addEvent(
                newEvent(
                  "Protection rule saved",
                  `${ruleEditor.action} below HF ${ruleEditor.threshold.toFixed(2)}. Demo session only.`,
                  "Rule Changes",
                ),
              );
              setRuleEditor(null);
            }}
          >
            <div className="form-grid">
              <label className="field">
                Position
                <select
                  value={ruleEditor.positionId}
                  onChange={(e) =>
                    setRuleEditor({ ...ruleEditor, positionId: e.target.value })
                  }
                >
                  {current.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.asset} / USDC
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Action
                <select
                  value={ruleEditor.action}
                  onChange={(e) =>
                    setRuleEditor({
                      ...ruleEditor,
                      action: e.target.value as ProtectionRule["action"],
                    })
                  }
                >
                  {[
                    "Repay Debt",
                    "Top Up Collateral",
                    "Deleverage",
                    "Notify Only",
                  ].map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
              {(
                [
                  ["threshold", "Trigger below HF", 1.01, 3, 0.01],
                  ["percent", "Percent of debt", 1, 100, 1],
                  ["maxAmount", "Max execution (USDC)", 1, 100000, 1],
                  ["dailyLimit", "Daily cap (USDC)", 1, 100000, 1],
                  ["slippage", "Maximum slippage (%)", 0, 5, 0.1],
                ] as const
              ).map(([k, label, min, max, step]) => (
                <label className="field" key={k}>
                  {label}
                  <input
                    required
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={ruleEditor[k]}
                    onChange={(e) =>
                      setRuleEditor({ ...ruleEditor, [k]: +e.target.value })
                    }
                  />
                </label>
              ))}
              <label className="field">
                Rule expires (UTC)
                <input
                  required
                  type="datetime-local"
                  value={ruleEditor.expiresAt.slice(0, 16)}
                  onChange={(e) => {
                    if (e.target.value)
                      setRuleEditor({
                        ...ruleEditor,
                        expiresAt: new Date(e.target.value + "Z").toISOString(),
                      });
                  }}
                />
              </label>
              <label className="field">
                Session expires (UTC)
                <input
                  required
                  type="datetime-local"
                  value={ruleEditor.sessionExpiresAt.slice(0, 16)}
                  onChange={(e) => {
                    if (e.target.value)
                      setRuleEditor({
                        ...ruleEditor,
                        sessionExpiresAt: new Date(
                          e.target.value + "Z",
                        ).toISOString(),
                      });
                  }}
                />
              </label>
            </div>
            <label className="check-field">
              <input
                type="checkbox"
                checked={ruleEditor.manualApproval}
                onChange={(e) =>
                  setRuleEditor({
                    ...ruleEditor,
                    manualApproval: e.target.checked,
                  })
                }
              />{" "}
              Require manual approval before every simulated action
            </label>
            <p className="footnote">
              No on-chain permission is created. Rules disappear when this demo
              session is reset or the page is reloaded.
            </p>
            <button className="button primary" type="submit">
              Save demo rule <Check size={16} />
            </button>
          </form>
        </Modal>
      )}
      {pending && (
        <Modal
          title="Approve simulated protection"
          onClose={() => setPending(null)}
        >
          <p>
            {pending.rule.action}: {money(pending.amount, 2)}. Current health
            factor: {hfText(metrics(pending.position).hf)}.
          </p>
          <p>No real funds move. Limits are rechecked when you approve.</p>
          <div className="actions">
            <button
              className="button"
              onClick={() => {
                setPending(null);
                addEvent(
                  newEvent(
                    "Action declined",
                    "Manual approval declined.",
                    "Protection Actions",
                    "failed",
                  ),
                );
              }}
            >
              Decline
            </button>
            <button
              className="button primary"
              onClick={() =>
                execute(pending.rule, pending.position, pending.amount)
              }
            >
              Approve simulation
            </button>
          </div>
        </Modal>
      )}
      {confirmDelete && (
        <Modal
          title="Delete protection rule?"
          onClose={() => setConfirmDelete(null)}
        >
          <p>This removes the rule from this demo session.</p>
          <div className="actions">
            <button className="button" onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
            <button
              className="button danger"
              onClick={() => {
                setRules((rs) => rs.filter((r) => r.id !== confirmDelete));
                setConfirmDelete(null);
                addEvent(
                  newEvent(
                    "Rule deleted",
                    "Demo protection rule removed.",
                    "Rule Changes",
                  ),
                );
              }}
            >
              Delete rule
            </button>
          </div>
        </Modal>
      )}
      {settings && (
        <Modal title="Workspace settings" onClose={() => setSettings(false)}>
          <div className="detail-grid">
            <div>
              <span>Network</span>
              <b>Solana Mainnet</b>
            </div>
            <div>
              <span>RPC status</span>
              <b>{isDemoMode ? "Not used in demo" : rpc}</b>
            </div>
            <div>
              <span>Monitoring interval</span>
              <b>30 seconds (live service)</b>
            </div>
            <div>
              <span>Execution permission</span>
              <b>None · demo only</b>
            </div>
          </div>
          <p>
            Risk thresholds: SAFE ≥ 1.60, WATCH ≥ 1.30, WARNING ≥ 1.10, CRITICAL
            below 1.10. These are shared across every screen.
          </p>
          <p>
            Reduced motion follows your device setting. Demo data and rules are
            kept only in this page session.
          </p>
          <button
            className="button"
            onClick={() => {
              setCollapsed((v) => !v);
            }}
          >
            {collapsed ? "Expand" : "Collapse"} sidebar
          </button>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <span className="guardian-icon">
            <Activity size={16} />
          </span>
          {toast}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
function XSmall() {
  return <span aria-hidden="true">×</span>;
}
