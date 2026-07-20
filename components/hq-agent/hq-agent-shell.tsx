"use client";

// HqAgentShell — the HQ Agent text-chat surface. Owns all state: config load,
// the message thread, the SSE send loop, feedback, and a History slide-over.
// A cleaner, uncramped successor to components/admin/HqChat.tsx.

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { History, Plus, X } from "lucide-react";
import { HqAgentEmptyState } from "./hq-agent-empty-state";
import { HqAgentMessageList } from "./hq-agent-message-list";
import { HqAgentComposer } from "./hq-agent-composer";
import type { HqAgentMessage } from "./hq-agent-message";
import type { HqAgentSource } from "./hq-agent-source-card";

type Conversation = {
  id: string;
  title: string;
  message_count: number;
  last_message_at: string;
};

type Config = {
  identity: { name: string; welcomeMessage: string; suggestedQuestions: string[] };
  text: { streaming: boolean; enabled: boolean };
  voice: { enabled: boolean };
};

const FALLBACK_SUGGESTIONS = [
  "How many brands have registered, and on which plans?",
  "Are scans running? Anything stuck or failing?",
  "What did we spend on LLMs in the last 30 days, by task?",
  "Which campaigns are live and how are they performing?",
];

function timeOf(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function dayOf(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const yest = new Date(Date.now() - 864e5);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

export function HqAgentShell() {
  const reduced = useReducedMotion();

  const [config, setConfig] = useState<Config | null>(null);
  const [messages, setMessages] = useState<HqAgentMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  // ── config ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/hq-agent/config");
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; config?: Config };
        if (!cancelled && data.ok && data.config) setConfig(data.config);
      } catch {
        /* config load is best-effort; fall back to defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestions =
    config?.identity.suggestedQuestions?.length
      ? config.identity.suggestedQuestions
      : FALLBACK_SUGGESTIONS;
  const voiceEnabled = config?.voice.enabled ?? false;
  const textDisabled = config?.text.enabled === false;

  // ── patch the currently-streaming assistant bubble ──────────────────────
  const patchLastAssistant = useCallback(
    (fn: (a: HqAgentMessage) => HqAgentMessage) => {
      setMessages((m) => {
        const copy = [...m];
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === "assistant") {
            copy[i] = fn(copy[i]);
            break;
          }
        }
        return copy;
      });
    },
    [],
  );

  // ── send + SSE loop ─────────────────────────────────────────────────────
  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy || textDisabled) return;
      setError(null);

      setMessages((m) => [
        ...m,
        { role: "user", content: q, modality: "text", created_at: new Date().toISOString() },
        {
          role: "assistant",
          content: "",
          modality: "text",
          toolsUsed: [],
          reaction: null,
          streaming: true,
          created_at: new Date().toISOString(),
        },
      ]);
      setBusy(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/hq-agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, message: q }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? "The agent could not answer. Try again.");
          // drop the empty streaming placeholder
          setMessages((m) =>
            m[m.length - 1]?.role === "assistant" && !m[m.length - 1]?.content
              ? m.slice(0, -1)
              : m,
          );
          return;
        }

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n\n")) !== -1) {
            const chunk = buf.slice(0, nl);
            buf = buf.slice(nl + 2);
            const line = chunk.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            let evt: {
              type: string;
              text?: string;
              name?: string;
              sources?: HqAgentSource[];
              conversationId?: string;
              reply?: string;
              toolsUsed?: string[];
              messageId?: string;
              createdAt?: string;
              userMessageId?: string;
              error?: string;
            };
            try {
              evt = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }

            if (evt.type === "delta" && evt.text) {
              patchLastAssistant((a) => ({ ...a, content: a.content + evt.text }));
            } else if (evt.type === "reset") {
              patchLastAssistant((a) => ({ ...a, content: "" }));
            } else if (evt.type === "tool" && evt.name) {
              patchLastAssistant((a) => ({
                ...a,
                toolsUsed: [...(a.toolsUsed ?? []), evt.name!],
              }));
            } else if (evt.type === "sources" && evt.sources) {
              patchLastAssistant((a) => ({ ...a, sources: evt.sources }));
            } else if (evt.type === "done") {
              if (evt.conversationId) setConversationId(evt.conversationId);
              patchLastAssistant((a) => ({
                ...a,
                id: evt.messageId ?? a.id,
                content: evt.reply ?? a.content,
                toolsUsed: evt.toolsUsed ?? a.toolsUsed,
                created_at: evt.createdAt ?? a.created_at,
                streaming: false,
              }));
              if (evt.userMessageId) {
                setMessages((m) => {
                  const c = [...m];
                  for (let i = c.length - 1; i >= 0; i--) {
                    if (c[i].role === "user") {
                      c[i] = { ...c[i], id: evt.userMessageId };
                      break;
                    }
                  }
                  return c;
                });
              }
            } else if (evt.type === "error") {
              setError(evt.error ?? "The agent failed. Try again.");
              patchLastAssistant((a) => ({ ...a, streaming: false }));
            }
          }
        }
      } catch (e) {
        if ((e as Error)?.name === "AbortError") {
          // user pressed Stop — finalize the partial bubble quietly
          patchLastAssistant((a) => ({ ...a, streaming: false }));
        } else {
          setError("Network error — try again.");
          patchLastAssistant((a) => ({ ...a, streaming: false }));
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, textDisabled, conversationId, patchLastAssistant],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // ── feedback ────────────────────────────────────────────────────────────
  const react = useCallback(
    (messageId: string, reaction: "up" | "down" | null) => {
      setMessages((m) => m.map((x) => (x.id === messageId ? { ...x, reaction } : x)));
      fetch("/api/hq-agent/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, reaction }),
      }).catch(() => {});
    },
    [],
  );

  // ── voice bridge ────────────────────────────────────────────────────────
  const appendVoiceMessages = useCallback(
    (msgs: Array<Pick<HqAgentMessage, "role" | "content" | "created_at">>) => {
      if (!msgs.length) return;
      setMessages((m) => [
        ...m,
        ...msgs.map((v) => ({
          role: v.role,
          content: v.content,
          modality: "voice" as const,
          created_at: v.created_at ?? new Date().toISOString(),
        })),
      ]);
    },
    [],
  );

  // ── history ─────────────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/hq-agent/conversations");
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        conversations?: Conversation[];
      };
      if (data.ok && data.conversations) setConversations(data.conversations);
    } catch {
      /* ignore */
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (historyOpen) void loadConversations();
  }, [historyOpen, loadConversations]);

  const openConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/hq-agent/conversations?id=${encodeURIComponent(id)}`);
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        messages?: Array<{
          id: string;
          role: "user" | "assistant";
          content: string;
          modality?: "text" | "voice";
          model?: string;
          tools_used?: string[];
          reaction?: "up" | "down" | null;
          metadata?: { sources?: HqAgentSource[] };
          created_at: string;
        }>;
      };
      if (data.ok && data.messages) {
        setConversationId(id);
        setMessages(
          data.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            modality: m.modality,
            toolsUsed: m.tools_used ?? undefined,
            sources: m.metadata?.sources ?? undefined,
            reaction: m.reaction ?? null,
            created_at: m.created_at,
          })),
        );
        setHistoryOpen(false);
        setError(null);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    setConversationId(null);
    setMessages([]);
    setError(null);
    setHistoryOpen(false);
  }, []);

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div className="relative flex h-[calc(100vh-210px)] min-h-[440px] flex-col overflow-hidden rounded-card border border-divider bg-base-secondary/60">
      {/* Header strip — roomy, only New chat + History. */}
      <div className="flex items-center gap-3 border-b border-divider bg-card px-4 py-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cobalt text-sm font-bold text-white"
          aria-hidden
        >
          HQ
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">
            {config?.identity.name ?? "HQ Agent"}
          </p>
          <p className="truncate text-xs text-ink-faint">
            {busy ? "consulting internal data…" : "grounded in live business data · cites sources"}
          </p>
        </div>
        <button
          type="button"
          onClick={newChat}
          aria-label="New chat"
          title="New chat"
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-chip px-3 text-sm font-medium text-ink-secondary transition-colors hover:bg-base-secondary hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt/40"
        >
          <Plus className="h-[18px] w-[18px]" aria-hidden />
          <span className="hidden sm:inline">New chat</span>
        </button>
        <button
          type="button"
          onClick={() => setHistoryOpen((o) => !o)}
          aria-label="Chat history"
          aria-pressed={historyOpen}
          title="Chat history"
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-chip px-3 text-sm font-medium text-ink-secondary transition-colors hover:bg-base-secondary hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt/40"
        >
          <History className="h-[18px] w-[18px]" aria-hidden />
          <span className="hidden sm:inline">History</span>
        </button>
      </div>

      {/* Thread or empty state. */}
      {messages.length === 0 ? (
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 md:px-6">
          <HqAgentEmptyState suggestions={suggestions} onPick={send} />
          {error && (
            <p role="alert" className="mx-auto mt-4 max-w-xl text-center text-sm text-urgent">
              {error}
            </p>
          )}
        </div>
      ) : (
        <HqAgentMessageList messages={messages} error={error} onReact={react} />
      )}

      {/* Composer. */}
      <HqAgentComposer
        onSend={send}
        onStop={stop}
        busy={busy}
        disabled={textDisabled}
        disabledNote="Text chat is currently disabled by configuration."
        voiceEnabled={voiceEnabled}
        conversationId={conversationId}
        onConversationId={setConversationId}
        onVoiceMessages={appendVoiceMessages}
      />

      {/* History slide-over. */}
      <AnimatePresence>
        {historyOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reduced ? { duration: 0 } : { duration: 0.2 }}
              onClick={() => setHistoryOpen(false)}
              className="absolute inset-0 z-10 bg-ink/10"
              aria-hidden
            />
            <motion.aside
              initial={reduced ? { opacity: 0 } : { x: "100%" }}
              animate={reduced ? { opacity: 1 } : { x: 0 }}
              exit={reduced ? { opacity: 0 } : { x: "100%" }}
              transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 38 }}
              className="absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col border-l border-divider bg-card shadow-sh2"
              aria-label="Chat history"
            >
              <div className="flex items-center justify-between border-b border-divider px-4 py-3">
                <p className="text-sm font-semibold text-ink">Chats</p>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  aria-label="Close history"
                  className="flex h-11 w-11 items-center justify-center rounded-chip text-ink-secondary transition-colors hover:bg-base-secondary hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt/40"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
                {loadingHistory && (
                  <p className="pt-6 text-center text-xs text-ink-faint">Loading chats…</p>
                )}
                {!loadingHistory && conversations.length === 0 && (
                  <p className="pt-6 text-center text-xs text-ink-faint">No conversations yet.</p>
                )}
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => void openConversation(c.id)}
                    className={[
                      "block w-full rounded-card px-3 py-2.5 text-left transition-colors hover:bg-base-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt/40",
                      c.id === conversationId ? "bg-base-secondary" : "",
                    ].join(" ")}
                  >
                    <p className="truncate text-sm text-ink">{c.title || "Untitled chat"}</p>
                    <p className="mt-0.5 text-[11px] text-ink-faint">
                      {c.message_count} message{c.message_count === 1 ? "" : "s"} ·{" "}
                      {dayOf(c.last_message_at)} {timeOf(c.last_message_at)}
                    </p>
                  </button>
                ))}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
