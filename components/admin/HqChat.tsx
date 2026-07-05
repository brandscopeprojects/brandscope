"use client";

// HqChat — the internal HQ Agent surface (/brandscope-admin/chat), v2.1
// (owner-approved 2026-07): persistent conversations (migration 16),
// WhatsApp-style thread (bubbles with tails, in-bubble timestamps, date chips),
// reactions (👍/👎 + feedback note = the learning signal), one-click briefings,
// and the Memory panel (owner-curated facts/preferences/lessons injected into
// the agent's system prompt; 👎-notes surface as suggested lessons to promote).
// NO SDK — talks to the hand-rolled /api/hq-chat routes.

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Send,
  Plus,
  History,
  BrainCircuit,
  ThumbsUp,
  ThumbsDown,
  X,
  Sun,
  Wrench,
  PieChart,
} from "lucide-react";

type Msg = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
  reaction?: "up" | "down" | null;
  created_at?: string;
};
type Conversation = { id: string; title: string; message_count: number; last_message_at: string };
type MemoryEntry = { id: string; kind: string; content: string; created_at: string };
type Suggestion = { messageId: string; note: string; answerExcerpt: string; at: string };

const TOOL_LABEL: Record<string, string> = {
  brands_overview: "Brands",
  revenue_pnl: "Revenue & P&L",
  operations_status: "Operations",
  agent_performance: "Agent telemetry",
  user_growth: "Users",
};

const BRIEFINGS = [
  {
    icon: Sun,
    label: "Daily briefing",
    prompt:
      "Daily founder briefing: summarise new brand signups, revenue/churn events, scan pipeline status (failures, dead-letter queue), agent errors, LLM spend, and anything needing my attention today. End with the top 3 actions.",
  },
  {
    icon: Wrench,
    label: "Ops check",
    prompt:
      "Weekly ops briefing: scan job failures, cron run status, dead-letter queue, feature health failures, agent failure rates and slowest tasks. What is broken and what should be fixed first?",
  },
  {
    icon: PieChart,
    label: "Margin view",
    prompt:
      "Monthly margin briefing: MRR by plan, payments received, churn, LLM cost by task, and your best estimate of gross margin given what is metered. Flag anything unprofitable or spiking.",
  },
];

const SUGGESTED = [
  "How many brands have registered, and on which plans?",
  "Are scans running? Anything stuck or failing?",
  "What did we spend on LLMs in the last 30 days, by task?",
];

function timeOf(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function dayOf(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(Date.now() - 864e5);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

export function HqChat() {
  const reduced = useReducedMotion();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [panel, setPanel] = useState<"none" | "history" | "memory">("none");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [memory, setMemory] = useState<MemoryEntry[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [newMemory, setNewMemory] = useState("");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const endRef = useRef<HTMLDivElement>(null);
  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: "end" }));
  }, []);

  // ── data loads ──────────────────────────────────────────────────────────────
  async function loadConversations() {
    const res = await fetch("/api/hq-chat/history");
    const data = await res.json();
    if (data.ok) setConversations(data.conversations);
  }
  async function openConversation(id: string) {
    const res = await fetch(`/api/hq-chat/history?id=${id}`);
    const data = await res.json();
    if (data.ok) {
      setConversationId(id);
      setMessages(
        (data.messages as Msg[]).map((m) => ({
          ...m,
          toolsUsed: (m as { tools_used?: string[] }).tools_used ?? undefined,
        })),
      );
      setPanel("none");
      scrollToEnd();
    }
  }
  async function loadMemory() {
    const res = await fetch("/api/hq-chat/memory");
    const data = await res.json();
    if (data.ok) {
      setMemory(data.memory);
      setSuggestions(data.suggestions);
    }
  }
  useEffect(() => {
    if (panel === "history") void loadConversations();
    if (panel === "memory") void loadMemory();
  }, [panel]);

  // ── actions ─────────────────────────────────────────────────────────────────
  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q, created_at: new Date().toISOString() }]);
    setBusy(true);
    scrollToEnd();
    try {
      const res = await fetch("/api/hq-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: q }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "The agent could not answer. Try again.");
      } else {
        setConversationId(data.conversationId);
        setMessages((m) => {
          const withIds = [...m];
          const lastUser = withIds[withIds.length - 1];
          if (lastUser?.role === "user" && data.userMessage) {
            lastUser.id = data.userMessage.id;
            lastUser.created_at = data.userMessage.created_at;
          }
          return [
            ...withIds,
            {
              id: data.assistantMessage?.id,
              role: "assistant",
              content: data.reply,
              toolsUsed: data.toolsUsed,
              reaction: null,
              created_at: data.assistantMessage?.created_at ?? new Date().toISOString(),
            },
          ];
        });
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
      scrollToEnd();
    }
  }

  async function react(msg: Msg, reaction: "up" | "down" | null, note?: string) {
    if (!msg.id) return;
    setMessages((m) => m.map((x) => (x.id === msg.id ? { ...x, reaction } : x)));
    await fetch("/api/hq-chat/reaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: msg.id, reaction, note }),
    }).catch(() => {});
  }

  async function addMemory(kind: string, content: string) {
    const res = await fetch("/api/hq-chat/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, content }),
    });
    const data = await res.json();
    if (data.ok) setMemory((m) => [data.entry, ...m]);
  }
  async function removeMemory(id: string) {
    setMemory((m) => m.filter((x) => x.id !== id));
    await fetch("/api/hq-chat/memory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }

  function newChat() {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setPanel("none");
  }

  // ── render ──────────────────────────────────────────────────────────────────
  let lastDay = "";
  const bubbleTransition = reduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 480, damping: 38 };

  return (
    <div className="relative flex h-[calc(100vh-210px)] min-h-[440px] flex-col overflow-hidden rounded-card border border-divider bg-base-secondary/60">
      {/* ── Header bar (WhatsApp-style identity strip) ── */}
      <div className="flex items-center gap-3 border-b border-divider bg-card px-4 py-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cobalt text-sm font-bold text-white" aria-hidden>
          HQ
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">HQ Agent</p>
          <p className="truncate text-xs text-ink-faint">
            {busy ? "consulting internal data…" : "grounded in live business data · cites sources"}
          </p>
        </div>
        <button
          type="button"
          onClick={newChat}
          title="New chat"
          aria-label="New chat"
          className="rounded-chip p-2 text-ink-secondary hover:bg-base-secondary hover:text-ink"
        >
          <Plus className="h-[18px] w-[18px]" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setPanel(panel === "history" ? "none" : "history")}
          title="Chat history"
          aria-label="Chat history"
          className="rounded-chip p-2 text-ink-secondary hover:bg-base-secondary hover:text-ink"
        >
          <History className="h-[18px] w-[18px]" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setPanel(panel === "memory" ? "none" : "memory")}
          title="Agent memory"
          aria-label="Agent memory"
          className="rounded-chip p-2 text-ink-secondary hover:bg-base-secondary hover:text-ink"
        >
          <BrainCircuit className="h-[18px] w-[18px]" aria-hidden />
        </button>
      </div>

      {/* ── Thread ── */}
      <div className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4 md:px-6">
        {messages.length === 0 && (
          <div className="mx-auto max-w-lg space-y-4 pt-6 text-center">
            <p className="text-sm font-medium text-ink">Ask anything about the Brandscope business.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {BRIEFINGS.map(({ icon: Icon, label, prompt }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => send(prompt)}
                  className="flex items-center gap-1.5 rounded-chip bg-cobalt/10 px-3 py-2 text-xs font-medium text-cobalt transition-colors hover:bg-cobalt/20"
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-chip border border-divider bg-card px-3 py-1.5 text-xs text-ink-secondary transition-colors hover:border-cobalt hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m, i) => {
            const day = dayOf(m.created_at);
            const showDay = day && day !== lastDay;
            lastDay = day || lastDay;
            const mine = m.role === "user";
            return (
              <div key={m.id ?? `i-${i}`}>
                {showDay && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-card px-3 py-1 text-[11px] font-medium text-ink-faint shadow-sh1">
                      {day}
                    </span>
                  </div>
                )}
                <motion.div
                  initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={bubbleTransition}
                  className={mine ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={[
                      "relative max-w-[86%] px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap shadow-sh1 md:max-w-[70%]",
                      mine
                        ? "rounded-2xl rounded-br-md bg-cobalt text-white"
                        : "rounded-2xl rounded-bl-md bg-card text-ink",
                    ].join(" ")}
                  >
                    {m.content}
                    <span
                      className={[
                        "mt-1 flex items-center justify-end gap-1 text-[10px]",
                        mine ? "text-white/70" : "text-ink-faint",
                      ].join(" ")}
                    >
                      {timeOf(m.created_at)}
                    </span>
                    {!mine && (m.toolsUsed?.length ?? 0) > 0 && (
                      <span className="mt-1.5 flex flex-wrap gap-1 border-t border-divider pt-1.5">
                        {Array.from(new Set(m.toolsUsed)).map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-base-secondary px-2 py-0.5 text-[10px] font-medium text-ink-faint"
                          >
                            {TOOL_LABEL[t] ?? t}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                </motion.div>
                {!mine && m.id && (
                  <div className="mt-0.5 flex gap-1 pl-1">
                    <button
                      type="button"
                      aria-label="Good answer"
                      onClick={() => react(m, m.reaction === "up" ? null : "up")}
                      className={[
                        "rounded-full p-1",
                        m.reaction === "up" ? "text-cobalt" : "text-ink-faint hover:text-ink-secondary",
                      ].join(" ")}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label="Bad answer"
                      onClick={() => {
                        if (m.reaction === "down") void react(m, null);
                        else {
                          setNoteFor(m.id!);
                          setNoteText("");
                        }
                      }}
                      className={[
                        "rounded-full p-1",
                        m.reaction === "down" ? "text-urgent" : "text-ink-faint hover:text-ink-secondary",
                      ].join(" ")}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    {noteFor === m.id && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void react(m, "down", noteText);
                          setNoteFor(null);
                        }}
                        className="flex flex-1 items-center gap-1"
                      >
                        <input
                          autoFocus
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="What was wrong? (teaches the agent)"
                          className="min-w-0 flex-1 rounded-chip border border-divider bg-card px-2 py-1 text-xs text-ink outline-none focus:border-cobalt"
                        />
                        <button type="submit" className="text-xs font-medium text-cobalt">
                          Save
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </AnimatePresence>

        {busy && (
          <div className="flex justify-start">
            <span className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-card px-4 py-3 shadow-sh1">
              {[0, 1, 2].map((d) => (
                <motion.span
                  key={d}
                  className="h-1.5 w-1.5 rounded-full bg-ink-faint"
                  animate={reduced ? {} : { opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: d * 0.18 }}
                />
              ))}
            </span>
          </div>
        )}
        {error && <p className="px-1 text-sm text-urgent">{error}</p>}
        <div ref={endRef} />
      </div>

      {/* ── Composer ── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex items-center gap-2 border-t border-divider bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the HQ Agent…"
          aria-label="Message the HQ Agent"
          className="min-w-0 flex-1 rounded-full border border-divider bg-base-secondary/60 px-4 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-cobalt"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send"
          className="rounded-full bg-cobalt p-3 text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </form>

      {/* ── Slide-over panel: history / memory ── */}
      <AnimatePresence>
        {panel !== "none" && (
          <motion.aside
            initial={reduced ? { opacity: 0 } : { x: "100%" }}
            animate={reduced ? { opacity: 1 } : { x: 0 }}
            exit={reduced ? { opacity: 0 } : { x: "100%" }}
            transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 38 }}
            className="absolute inset-y-0 right-0 z-10 flex w-full max-w-sm flex-col border-l border-divider bg-card shadow-sh1"
          >
            <div className="flex items-center justify-between border-b border-divider px-4 py-3">
              <p className="text-sm font-semibold text-ink">
                {panel === "history" ? "Chats" : "Agent memory"}
              </p>
              <button
                type="button"
                onClick={() => setPanel("none")}
                aria-label="Close panel"
                className="rounded-chip p-1.5 text-ink-secondary hover:bg-base-secondary"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {panel === "history" && (
                <>
                  {conversations.length === 0 && (
                    <p className="pt-6 text-center text-xs text-ink-faint">No conversations yet.</p>
                  )}
                  {conversations.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => void openConversation(c.id)}
                      className={[
                        "block w-full rounded-card px-3 py-2.5 text-left transition-colors hover:bg-base-secondary",
                        c.id === conversationId ? "bg-base-secondary" : "",
                      ].join(" ")}
                    >
                      <p className="truncate text-sm text-ink">{c.title}</p>
                      <p className="text-[11px] text-ink-faint">
                        {c.message_count} messages · {dayOf(c.last_message_at)} {timeOf(c.last_message_at)}
                      </p>
                    </button>
                  ))}
                </>
              )}

              {panel === "memory" && (
                <>
                  <p className="text-[11px] leading-4 text-ink-faint">
                    Owner-approved context injected into every answer. The agent never writes
                    here itself — you do.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newMemory.trim()) {
                        void addMemory("fact", newMemory);
                        setNewMemory("");
                      }
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      value={newMemory}
                      onChange={(e) => setNewMemory(e.target.value)}
                      placeholder="Add a fact/preference the agent should remember…"
                      className="min-w-0 flex-1 rounded-chip border border-divider bg-card px-2.5 py-2 text-xs text-ink outline-none focus:border-cobalt"
                    />
                    <button type="submit" className="rounded-chip bg-cobalt px-2.5 py-2 text-xs font-medium text-white">
                      Add
                    </button>
                  </form>

                  {suggestions.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                        Suggested lessons (from your 👎 notes)
                      </p>
                      {suggestions.map((s) => (
                        <div key={s.messageId} className="rounded-card bg-base-secondary/60 p-2.5">
                          <p className="text-xs text-ink">{s.note}</p>
                          <p className="mt-1 line-clamp-2 text-[11px] text-ink-faint">
                            Answer: {s.answerExcerpt}
                          </p>
                          <button
                            type="button"
                            onClick={() => void addMemory("lesson", s.note)}
                            className="mt-1.5 text-[11px] font-medium text-cobalt"
                          >
                            Promote to memory →
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1.5 pt-2">
                    {memory.length === 0 && (
                      <p className="pt-4 text-center text-xs text-ink-faint">Memory is empty.</p>
                    )}
                    {memory.map((m) => (
                      <div key={m.id} className="flex items-start gap-2 rounded-card bg-base-secondary/60 p-2.5">
                        <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-medium uppercase text-ink-faint">
                          {m.kind}
                        </span>
                        <p className="min-w-0 flex-1 text-xs leading-4 text-ink">{m.content}</p>
                        <button
                          type="button"
                          onClick={() => void removeMemory(m.id)}
                          aria-label="Forget"
                          className="text-ink-faint hover:text-urgent"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
