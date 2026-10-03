"use client";

import { KaminoPosition } from "@/hooks/useKaminoPositions";

interface PositionCardProps {
  position: KaminoPosition;
}

const getProtocolIcon = (market: string) => {
  const icons: { [key: string]: string } = {
    "Aave": "🔵",
    "Compound": "🟢",
    "MakerDAO": "🟢",
    "Spark": "🟡",
    "Kamino": "K",
  };
  return icons[market] || market.charAt(0);
};

const getBorderColor = (riskStatus: string) => {
  switch (riskStatus) {
    case "safe": return "#22C55E";
    case "caution": return "#F59E0B";
    case "danger": return "#EF4444";
    default: return "#3B82F6";
  }
};

export default function PositionCard({ position }: PositionCardProps) {
  const borderColor = getBorderColor(position.riskStatus);
  const textColor =
    position.riskStatus === "safe"
      ? "#22C55E"
      : position.riskStatus === "caution"
        ? "#F59E0B"
        : "#EF4444";

  return (
    <div
      className="rounded-lg bg-slate-900/50 p-6 backdrop-blur-sm border border-slate-700/30 overflow-hidden group hover:bg-slate-900/70 transition-colors"
      style={{
        borderLeft: `4px solid ${borderColor}`,
      }}
    >
      {/* Header - Protocol Name and Health Factor */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
            style={{
              backgroundColor: `${borderColor}20`,
              color: borderColor,
            }}
          >
            {getProtocolIcon(position.market)}
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">{position.market}</h3>
            <p className="text-xs text-slate-400">{position.pair}</p>
          </div>
        </div>
        
        {/* Health Factor */}
        <div className="text-right">
          <p className="text-xs text-slate-400 mb-1">Health Factor</p>
          <p className="text-3xl font-bold" style={{ color: textColor }}>
            {position.healthFactor.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Data Grid - 2x2 */}
      <div className="grid grid-cols-2 gap-6 mb-4">
        {/* Collateral */}
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">
            Collateral
          </p>
          <p className="text-xl font-semibold text-white">
            ${position.collateralValue.toLocaleString()}
          </p>
        </div>

        {/* Borrowed */}
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">
            Borrowed
          </p>
          <p className="text-xl font-semibold text-white">
            ${position.borrowValue.toLocaleString()}
          </p>
        </div>

        {/* Liquidation Price */}
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">
            Liquidation Price
          </p>
          <p className="text-xl font-semibold text-white">
            ${position.liquidationPrice.toLocaleString()}
          </p>
        </div>

        {/* Distance to Liquidation */}
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">
            Distance to Liq.
          </p>
          <p className="text-xl font-semibold" style={{ color: textColor }}>
            {position.liquidationDistance.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 w-full rounded-full bg-slate-700/50 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min((position.liquidationDistance / 100) * 100, 100)}%`,
            backgroundColor: borderColor,
          }}
        />
      </div>
    </div>
  );
}
