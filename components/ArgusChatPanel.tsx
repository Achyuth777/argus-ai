import React, { useEffect, useRef, useState } from "react";
import { useKaminoPositions } from "@/hooks/useKaminoPositions";
import { useWallet } from "@solana/wallet-adapter-react";
import { useDemo } from "@/contexts/DemoContext";
import ReactMarkdown from "react-markdown";
const truncateAddress = (addr: string) =>
  `${addr.slice(0, 4)}...${addr.slice(-4)}`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ArgusChatPanelProps {
  isCollapsible?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const QUICK_QUESTIONS = [
  "Am I safe right now?",
  "What happens if SOL drops 30%?",
  "Explain my health factor",
  "Should I repay some debt?",
];

export default function ArgusChatPanel({
  isCollapsible = false,
  isCollapsed = false,
  onToggleCollapse = () => {},
}: ArgusChatPanelProps) {
  const { publicKey } = useWallet();
  const { isDemoMode, demoPublicKey } = useDemo();
  const { positions, loading } = useKaminoPositions();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const autoProtectTriggered = true;

  // Determine which wallet address to use
  const walletAddress = isDemoMode
    ? demoPublicKey
    : publicKey?.toBase58() || "Not Connected";

  // Prepare position data for system prompt
  const positionData = {
    positions: positions.map((p) => ({
      protocol: p.market,
      collateral_asset: p.pair.split(" / ")[0],
      collateral_value_usd: p.collateralValue,
      borrowed_asset:
        p.pair.split(" / ")[1]?.replace("- Mainnet", "").trim() || "USDC",
      borrowed_amount: p.borrowValue,
      borrowed_value_usd: p.borrowValue,
      health_factor: p.healthFactor,
      liquidation_price_usd: p.liquidationPrice,
      current_price_usd: p.liquidationPrice + p.liquidationDistance, // Approximation
      distance_to_liquidation_pct: p.liquidationDistance,
      borrow_rate_apy: p.borrow_rate_apy,
      interest_accrued_usd: p.interest_accrued_usd,
      interest_accruing_per_day_usd: p.interest_accruing_per_day_usd,
    })),
    wallet: truncateAddress(walletAddress),
    last_updated: new Date().toISOString(),
  };

  useEffect(() => {
    // Scroll to bottom on new message
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // Initial system message
  useEffect(() => {
    if (messages.length === 0 && positions.length > 0) {
      setIsLoading(true);
      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [],
          positionData,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          const content =
            data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            "Argus is ready.";
          setMessages([{ role: "assistant", content }]);
        })
        .catch(() =>
          setMessages([{ role: "assistant", content: "Argus is ready." }]),
        )
        .finally(() => setIsLoading(false));
    }
    // eslint-disable-next-line
  }, [positions, publicKey]);

  const sendMessage = async (msg: string) => {
    setIsLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setInput("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: msg }],
          positionData,
        }),
      });
      const data = await res.json();
      const content =
        data?.candidates?.[0]?.content?.parts?.[0]?.text || "(No response)";
      setMessages((prev) => [...prev, { role: "assistant", content }]);
    } catch (e: any) {
      setError("Failed to contact Argus AI.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0A0A0F] rounded-xl border border-slate-800">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800 justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
            <span className="text-blue-400">👁️</span>
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <div className="font-semibold text-white truncate">Argus</div>
              <div className="text-xs text-green-400">
                ● Watching your positions
              </div>
            </div>
          )}
        </div>
        {isCollapsible && (
          <button
            onClick={onToggleCollapse}
            className="shrink-0 text-slate-400 hover:text-slate-200 p-1 transition-colors"
            title="Close chat panel"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {!isCollapsed && (
        <>
          {/* Quick Questions */}
          <div className="px-6 pt-3 pb-2">
            <div className="text-xs text-slate-500 font-semibold mb-2">
              QUICK QUESTIONS
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs hover:bg-blue-900/40 transition"
                  onClick={() => sendMessage(q)}
                  disabled={isLoading}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
          {/* Chat Area */}
          <div
            ref={chatRef}
            className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
          >
            {autoProtectTriggered && (
              <div className="flex items-start">
                <div className="flex flex-col items-center mr-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mb-1">
                    <span className="text-blue-400">👁️</span>
                  </div>
                  <span className="text-xs text-slate-500">Argus</span>
                </div>
                <div
                  className="max-w-xl px-4 py-3 rounded-lg text-sm bg-slate-900 border border-slate-800"
                  style={{ borderLeft: "3px solid #e04060" }}
                >
                  <p
                    className="text-xs font-bold tracking-widest mb-2"
                    style={{ color: "#e04060" }}
                  >
                    ARGUS ACTED
                  </p>
                  <p className="text-slate-100 leading-relaxed">
                    Your mSOL health factor dropped to 1.18 at 03:14 AM — that's
                    inside the danger zone. I automatically repaid $1,200 USDC
                    on your behalf using your session key. Your health factor is
                    now 1.52 and your position is safe. Your session key limits
                    me to loan repayments only — I can never move funds to
                    external wallets.
                  </p>
                  <a
                    href="https://solscan.io"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-3 px-3 py-1.5 rounded border border-slate-600 text-slate-300 text-xs hover:border-slate-400 hover:text-white transition-colors"
                  >
                    ↗ View on Solscan
                  </a>
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "assistant" ? "items-start" : "justify-end"}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex flex-col items-center mr-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mb-1">
                      <span className="text-blue-400">👁️</span>
                    </div>
                    <span className="text-xs text-slate-500">Argus</span>
                  </div>
                )}
                <div
                  className={`max-w-xl px-4 py-3 rounded-lg text-sm whitespace-pre-line ${
                    msg.role === "assistant"
                      ? "bg-slate-900 text-slate-100 border border-slate-800"
                      : "bg-blue-600 text-white"
                  }`}
                >
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start">
                <div className="flex flex-col items-center mr-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mb-1">
                    <span className="text-blue-400">👁️</span>
                  </div>
                  <span className="text-xs text-slate-500">Argus</span>
                </div>
                <div className="max-w-xl px-4 py-3 rounded-lg bg-slate-900 text-slate-100 border border-slate-800">
                  <span className="inline-block animate-pulse">● ● ●</span>
                </div>
              </div>
            )}
            {error && <div className="text-red-500 text-xs">{error}</div>}
          </div>
          {/* Input Bar */}
          <form
            className="flex items-center gap-2 px-6 py-4 border-t border-slate-800 bg-[#0A0A0F]"
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim()) sendMessage(input.trim());
            }}
          >
            <input
              className="flex-1 bg-slate-900 text-white rounded-lg px-4 py-2 border border-slate-700 focus:outline-none"
              placeholder="Ask Argus anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
              disabled={isLoading || !input.trim()}
            >
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}