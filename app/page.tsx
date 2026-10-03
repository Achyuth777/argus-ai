"use client";
import dynamic from "next/dynamic";
const CommandCenter = dynamic(() => import("@/components/v2/CommandCenter"), {
  ssr: false,
  loading: () => (
    <div className="boot">
      <span className="brand">◈ ARGUS</span>
      <p>Initializing command center…</p>
    </div>
  ),
});
export default function Home() {
  return <CommandCenter />;
}
