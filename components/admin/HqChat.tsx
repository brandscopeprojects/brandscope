"use client";

// HqChat — client surface for the internal HQ Agent (/brandscope-admin/chat).
// Ephemeral conversation (v1, no persistence); calls /api/hq-chat, which runs
// the tool-calling loop. Assistant replies show which tools were consulted so
// the founder can see WHERE every number came from (evidence-first, same
// doctrine as the brand product).

import { useRef, useState } from "react";
import { Send } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; toolsUsed?: string[] };

const SUGGESTED = [
  "How many brands have registered, and on which plans?",
  "Give me this month's P&L picture.",
  "Are scans running? Anything stuck or failing?",
  "What did we spend on LLMs in the last 30 days, by task?",
  "Any churn or failed payments I should know about?",
];

const TOOL_LABEL: Record<string, string> = {
  brands_overview: "Brands",
  revenue_pnl: "Revenue & P&L",
  operations_status: "Operations",
  agent_performance: "Agent telemetry",
  user_growth: "Users",
};

export function HqChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setError(null);
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await fetch("/api/hq-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        reply?: string;
        toolsUsed?: string[];
        error?: string;
      };
      if (!data.ok || !data.reply) {
        setError(data.error ?? "The agent could not answer. Try again.");
      } else {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data.reply!, toolsUsed: data.toolsUsed },
        ]);
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: "end" }));
    }
  }

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[420px] flex-col rounded-card border border-divider bg-card">
      <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
        {messages.length === 0 && (
          <div className="mx-auto max-w-lg space-y-3 pt-8 text-center">
            <p className="text-sm font-medium text-ink">
              Ask anything about the Brandscope business.
            </p>
            <p className="text-xs text-ink-faint">
              Grounded in live internal data — brands, revenue, operations, agents, users.
              Every answer shows which sources were consulted.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-chip border border-divider px-3 py-1.5 text-xs text-ink-secondary transition-colors hover:border-cobalt hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={[
                "max-w-[85%] rounded-card px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-cobalt text-white"
                  : "bg-base-secondary text-ink",
              ].join(" ")}
            >
              {m.content}
              {m.role === "assistant" && (m.toolsUsed?.length ?? 0) > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-divider pt-2">
                  {Array.from(new Set(m.toolsUsed)).map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-card px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-faint"
                    >
                      {TOOL_LABEL[t] ?? t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <p className="flex items-center gap-2 text-xs text-ink-faint">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cobalt" aria-hidden />
            Consulting internal data…
          </p>
        )}
        {error && <p className="text-sm text-urgent">{error}</p>}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-divider p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the HQ Agent…"
          aria-label="Message the HQ Agent"
          className="min-w-0 flex-1 rounded-chip border border-divider bg-card px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-cobalt"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send"
          className="rounded-chip bg-cobalt p-2.5 text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}
