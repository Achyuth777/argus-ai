"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, ShieldCheck, ArrowUpRight } from "lucide-react";
import {
  Position,
  metrics,
  hfText,
  money,
  RiskState,
  ProtectionEvent,
} from "@/lib/risk";
export function RiskBadge({ risk }: { risk: RiskState }) {
  return (
    <span className={`risk-badge ${risk.toLowerCase()}`}>
      <i />
      {risk}
    </span>
  );
}
export function HealthFactor({ value }: { value: number }) {
  return <span className={`hf ${metricsColor(value)}`}>{hfText(value)}</span>;
}
function metricsColor(v: number) {
  return v >= 1.6
    ? "safe"
    : v >= 1.3
      ? "watch"
      : v >= 1.1
        ? "warning"
        : "critical";
}
export function LiquidationDistance({
  position,
  compact = false,
}: {
  position: Position;
  compact?: boolean;
}) {
  const m = metrics(position);
  return (
    <div className={`distance ${compact ? "compact" : ""}`}>
      <div className="distance-label">
        <span>LIQUIDATION BUFFER</span>
        <b className={m.risk.toLowerCase()}>{m.buffer.toFixed(1)}%</b>
      </div>
      <div className="distance-track">
        <span className="danger-line" />
        <span
          className="distance-marker"
          style={{ left: `${Math.max(1, Math.min(96, m.buffer * 1.6))}%` }}
        >
          <i />
          {!compact && <small>CURRENT</small>}
        </span>
      </div>
      {!compact && (
        <div className="distance-prices">
          <span>
            <b>{money(m.liquidationPrice, 2)}</b>
            <small>Liquidation</small>
          </span>
          <span>
            <b>{money(position.price, 2)}</b>
            <small>Oracle · simulated</small>
          </span>
          <span>SAFE →</span>
        </div>
      )}
    </div>
  );
}
export function RiskGauge({ score, risk }: { score: number; risk: RiskState }) {
  return (
    <div className="gauge">
      <svg
        viewBox="0 0 240 150"
        role="img"
        aria-label={`Risk score ${score} out of 100`}
      >
        <path
          d="M 28 124 A 92 92 0 0 1 212 124"
          fill="none"
          stroke="#242C37"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 28 124 A 92 92 0 0 1 212 124"
          fill="none"
          stroke={risk === "CRITICAL" ? "#FF4757" : "#FFB547"}
          strokeWidth="12"
          pathLength="100"
          strokeDasharray={`${Math.max(score, 1)} 100`}
          strokeLinecap="round"
        />
        <text
          x="120"
          y="103"
          textAnchor="middle"
          fill="#F5F7FA"
          fontSize="57"
          fontWeight="550"
        >
          {score}
        </text>
        <text x="120" y="128" textAnchor="middle" fill="#667085" fontSize="11">
          OUT OF 100
        </text>
      </svg>
      <RiskBadge risk={risk} />
    </div>
  );
}
export function TrendChart({
  values,
  large = false,
}: {
  values: number[];
  large?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 600,
    height = large ? 170 : 70;
  const min = Math.min(1, ...values) - 0.05,
    max = Math.max(2.2, ...values) + 0.1;
  const y = (v: number) =>
    height - 15 - ((v - min) / (max - min)) * (height - 30);
  const points = values
    .map(
      (v, i) =>
        `${15 + (i * (width - 30)) / Math.max(1, values.length - 1)},${y(v)}`,
    )
    .join(" ");
  return (
    <div className="trend" onMouseLeave={() => setHover(null)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Health factor history. Latest ${hfText(values.at(-1) ?? 0)}`}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHover(
            Math.max(
              0,
              Math.min(
                values.length - 1,
                Math.round(
                  ((e.clientX - rect.left) / rect.width) * (values.length - 1),
                ),
              ),
            ),
          );
        }}
      >
        {large &&
          [1, 1.3, 1.6, 2].map((v) => (
            <g key={v}>
              <line
                x1="15"
                x2="585"
                y1={y(v)}
                y2={y(v)}
                stroke="#242C37"
                strokeDasharray={v === 1 ? "4 4" : "0"}
              />
              <text x="16" y={y(v) - 4} fill="#667085" fontSize="9">
                {v.toFixed(1)}
                {v === 1 ? " LIQUIDATION" : ""}
              </text>
            </g>
          ))}
        <polygon
          points={`15,${height} ${points} 585,${height}`}
          fill="#FFB547"
          opacity=".045"
        />
        <polyline
          points={points}
          fill="none"
          stroke="#FFB547"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        {hover !== null && (
          <circle
            cx={15 + (hover * (width - 30)) / Math.max(1, values.length - 1)}
            cy={y(values[hover])}
            r="4"
            fill="#FFB547"
          />
        )}
      </svg>
      {hover !== null && (
        <span className="chart-tip">
          Sample {hover + 1} · HF {hfText(values[hover])}
        </span>
      )}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  drawer = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={drawer ? "drawer" : "modal"}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-inner">
        <header>
          <div>
            <span className="eyebrow">ARGUS INTELLIGENCE</span>
            <h2>{title}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function ProtectionTimeline({ events }: { events: ProtectionEvent[] }) {
  return (
    <div className="timeline">
      {events.length ? (
        events.map((e) => (
          <div className="timeline-item" key={e.id}>
            <span className={`timeline-dot ${e.status}`} />
            <div>
              <div className="between">
                <b>{e.title}</b>
                <time>{new Date(e.time).toLocaleTimeString("en-GB")}</time>
              </div>
              <p>{e.detail}</p>
              {e.transaction?.signature && (
                <a
                  href={`https://explorer.solana.com/tx/${encodeURIComponent(e.transaction.signature)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction <ArrowUpRight size={12} />
                </a>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="empty small">
          <ShieldCheck size={25} />
          <h3>Standing by</h3>
          <p>Run a market shock to watch the protection sequence.</p>
        </div>
      )}
    </div>
  );
}
export function Stat({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong className={accent ? "orange" : ""}>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
