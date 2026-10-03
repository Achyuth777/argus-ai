"use client";
import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useDemo } from "@/contexts/DemoContext";
// Legacy component contract retained. V2 does not substitute demo positions for live data.
export interface KaminoPosition {
  id: string;
  market: string;
  pair: string;
  healthFactor: number;
  collateralValue: number;
  borrowValue: number;
  liquidationThreshold: number;
  liquidationDistance: number;
  riskStatus: "safe" | "caution" | "danger";
  ltvPercentage: number;
  liquidationPrice: number;
  borrow_rate_apy: number;
  interest_accrued_usd: number;
  interest_accruing_per_day_usd: number;
}
export function useKaminoPositions() {
  const { publicKey } = useWallet();
  const { isDemoMode } = useDemo();
  const address = publicKey?.toBase58();
  const [positions, setPositions] = useState<KaminoPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const refetch = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    setPositions([]);
    setError(null);
    setLastScan(null);
    if (!address || isDemoMode) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const scan = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/kamino/positions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: address }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Position service unavailable");
        if (!Array.isArray(data.positions))
          throw new Error("Invalid position response");
        setPositions(data.positions);
        setError(null);
        setLastScan(Date.now());
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(
            e instanceof Error ? e.message : "Position service unavailable",
          );
          setPositions([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void scan();
    const timer = setInterval(scan, 30000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [address, isDemoMode, revision]);
  return { positions, loading, error, lastScan, refetch };
}
