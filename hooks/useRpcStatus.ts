"use client";
import { useConnection } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
export function useRpcStatus(enabled: boolean) {
  const { connection } = useConnection();
  const [status, setStatus] = useState("Not checked");
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    async function check() {
      setStatus("Checking");
      try {
        const hash = await Promise.race([
          connection.getGenesisHash(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 8000),
          ),
        ]);
        if (active)
          setStatus(
            hash === "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
              ? "Online"
              : "Wrong network",
          );
      } catch {
        if (active) setStatus("RPC unavailable");
      }
    }
    void check();
    const timer = setInterval(check, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [enabled, connection]);
  return enabled ? status : "Not checked";
}
