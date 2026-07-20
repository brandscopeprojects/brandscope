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
  SlidersHorizontal,
  Mic,
  Square,
  Volume2,
  VolumeX,
  Loader2,
} from "lucide-react";

type Msg = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
  reaction?: "up" | "down" | null;
  created_at?: string;
  streaming?: boolean;
};
type Conversation = { id: string; title: string; message_count: number; last_message_at: string };
type MemoryEntry = { id: string; kind: string; content: string; created_at: string };
type Suggestion = { messageId: string; note: string; answerExcerpt: string; at: string };
type HqSettings = {
  model: string;
  temperature: number;
  maxTokens: number;
  requestsPerMin: number;
  active: boolean;
  systemPrompt: string;
  codeDefaultPrompt: string;
  models: string[];
};

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

  const [panel, setPanel] = useState<"none" | "history" | "memory" | "settings">("none");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [memory, setMemory] = useState<MemoryEntry[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [newMemory, setNewMemory] = useState("");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [settings, setSettings] = useState<HqSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // ── Voice (OpenAI Whisper in, OpenAI TTS out) ──────────────────────────────
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speakOn, setSpeakOn] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: "end" }));
  }, []);

  // Remember the speaker preference across sessions.
  useEffect(() => {
    if (typeof window !== "undefined") setSpeakOn(window.localStorage.getItem("hq-speak") === "1");
  }, []);
  const toggleSpeak = useCallback(() => {
    setSpeakOn((on) => {
      const next = !on;
      if (typeof window !== "undefined") window.localStorage.setItem("hq-speak", next ? "1" : "0");
      if (!next && audioRef.current) audioRef.current.pause(); // silence any in-flight playback
      return next;
    });
  }, []);

  // Speak a finished reply via OpenAI TTS (best-effort; voice is additive).
  const speak = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    try {
      const res = await fetch("/api/hq-chat/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean }),
      });
      if (!res.ok) return;
      const url = URL.createObjectURL(await res.blob());
      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play().catch(() => URL.revokeObjectURL(url));
    } catch {
      /* playback is non-critical — swallow */
    }
  }, []);

  // Send a recorded clip to Whisper; drop the transcript into the composer to review.
  const transcribe = useCallback(async (blob: Blob) => {
    setTranscribing(true);
    try {
      const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
      const fd = new FormData();
      fd.append("audio", blob, `recording.${ext}`);
      const res = await fetch("/api/hq-chat/voice/transcribe", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; text?: string; error?: string };
      if (data.ok && data.text) {
        setInput((prev) => (prev ? `${prev} ${data.text}` : data.text!));
      } else {
        setError(data.error ?? "Could not transcribe the recording.");
      }
    } catch {
      setError("Could not transcribe the recording.");
    } finally {
      setTranscribing(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Microphone is not available in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        if (blob.size > 0) void transcribe(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      setError("Microphone access was blocked.");
    }
  }, [transcribe]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
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
  async function loadSettings() {
    const res = await fetch("/api/hq-chat/settings");
    const data = await res.json();
    if (data.ok) setSettings(data as HqSettings);
  }
  async function saveSettings() {
    if (!settings) return;
    setSavingSettings(true);
    setSettingsSaved(false);
    try {
      const res = await fetch("/api/hq-chat/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.ok) {
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 2500);
      }
    } finally {
      setSavingSettings(false);
    }
  }
  useEffect(() => {
    if (panel === "history") void loadConversations();
    if (panel === "memory") void loadMemory();
    if (panel === "settings") void loadSettings();
  }, [panel]);

  // ── actions ─────────────────────────────────────────────────────────────────
  // Patch the most recent assistant message (the one currently streaming).
  const patchLastAssistant = useCallback((fn: (a: Msg) => Msg) => {
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
  }, []);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setError(null);
    setInput("");
    setMessages((m) => [
      ...m,
      { role: "user", content: q, created_at: new Date().toISOString() },
      { role: "assistant", content: "", toolsUsed: [], reaction: null, streaming: true, created_at: new Date().toISOString() },
    ]);
    setBusy(true);
    scrollToEnd();
    try {
      const res = await fetch("/api/hq-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: q }),
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "The agent could not answer. Try again.");
        // drop the empty streaming placeholder
        setMessages((m) => (m[m.length - 1]?.role === "assistant" && !m[m.length - 1]?.content ? m.slice(0, -1) : m));
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
          let evt: { type: string; text?: string; name?: string; conversationId?: string; error?: string; reply?: string; userMessage?: { id: string; created_at: string }; assistantMessage?: { id: string; created_at: string } };
          try {
            evt = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }
          if (evt.type === "delta" && evt.text) {
            patchLastAssistant((a) => ({ ...a, content: a.content + evt.text }));
            scrollToEnd();
          } else if (evt.type === "reset") {
            patchLastAssistant((a) => ({ ...a, content: "" }));
          } else if (evt.type === "tool" && evt.name) {
            patchLastAssistant((a) => ({ ...a, toolsUsed: [...(a.toolsUsed ?? []), evt.name!] }));
          } else if (evt.type === "done") {
            if (evt.conversationId) setConversationId(evt.conversationId);
            patchLastAssistant((a) => ({
              ...a,
              id: evt.assistantMessage?.id,
              created_at: evt.assistantMessage?.created_at ?? a.created_at,
              streaming: false,
            }));
            if (speakOn && evt.reply) void speak(evt.reply);
            if (evt.userMessage) {
              setMessages((m) => {
                const c = [...m];
                for (let i = c.length - 1; i >= 0; i--) {
                  if (c[i].role === "user") {
                    c[i] = { ...c[i], id: evt.userMessage!.id, created_at: evt.userMessage!.created_at };
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
    } catch {
      setError("Network error — try again.");
      patchLastAssistant((a) => ({ ...a, streaming: false }));
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
        <button
          type="button"
          onClick={toggleSpeak}
          title={speakOn ? "Voice replies on" : "Voice replies off"}
          aria-label={speakOn ? "Turn voice replies off" : "Turn voice replies on"}
          aria-pressed={speakOn}
          className={[
            "rounded-chip p-2 hover:bg-base-secondary",
            speakOn ? "text-cobalt" : "text-ink-secondary hover:text-ink",
          ].join(" ")}
        >
          {speakOn ? <Volume2 className="h-[18px] w-[18px]" aria-hidden /> : <VolumeX className="h-[18px] w-[18px]" aria-hidden />}
        </button>
        <button
          type="button"
          onClick={() => setPanel(panel === "settings" ? "none" : "settings")}
          title="Chat settings"
          aria-label="Chat settings"
          className="rounded-chip p-2 text-ink-secondary hover:bg-base-secondary hover:text-ink"
        >
          <SlidersHorizontal className="h-[18px] w-[18px]" aria-hidden />
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
                    {m.streaming && !m.content ? (
                      <span className="flex items-center gap-1 py-1">
                        {[0, 1, 2].map((d) => (
                          <motion.span
                            key={d}
                            className="h-1.5 w-1.5 rounded-full bg-ink-faint"
                            animate={reduced ? {} : { opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1.1, repeat: Infinity, delay: d * 0.18 }}
                          />
                        ))}
                      </span>
                    ) : (
                      <>
                        {m.content}
                        {m.streaming && (
                          <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-[2px] animate-pulse bg-current align-middle" />
                        )}
                      </>
                    )}
                    {!m.streaming && (
                      <span
                        className={[
                          "mt-1 flex items-center justify-end gap-1 text-[10px]",
                          mine ? "text-white/70" : "text-ink-faint",
                        ].join(" ")}
                      >
                        {timeOf(m.created_at)}
                      </span>
                    )}
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
          placeholder={recording ? "Listening… tap the mic to stop" : transcribing ? "Transcribing…" : "Ask the HQ Agent…"}
          aria-label="Message the HQ Agent"
          className="min-w-0 flex-1 rounded-full border border-divider bg-base-secondary/60 px-4 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-cobalt"
        />
        <button
          type="button"
          onClick={() => (recording ? stopRecording() : void startRecording())}
          disabled={busy || transcribing}
          title={recording ? "Stop recording" : "Record a voice message"}
          aria-label={recording ? "Stop recording" : "Record a voice message"}
          aria-pressed={recording}
          className={[
            "rounded-full p-3 transition-colors disabled:opacity-50",
            recording
              ? "animate-pulse bg-urgent text-white"
              : "bg-base-secondary text-ink-secondary hover:bg-base-secondary/80 hover:text-ink",
          ].join(" ")}
        >
          {transcribing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : recording ? (
            <Square className="h-4 w-4" aria-hidden />
          ) : (
            <Mic className="h-4 w-4" aria-hidden />
          )}
        </button>
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
                {panel === "history" ? "Chats" : panel === "memory" ? "Agent memory" : "Chat settings"}
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

              {panel === "settings" && (
                <>
                  {!settings ? (
                    <p className="pt-6 text-center text-xs text-ink-faint">Loading settings…</p>
                  ) : (
                    <div className="space-y-4">
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-ink">Model</span>
                        <select
                          value={settings.model}
                          onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                          className="w-full rounded-chip border border-divider bg-card px-2.5 py-2 text-xs text-ink outline-none focus:border-cobalt"
                        >
                          {settings.models.map((m) => (
                            <option key={m} value={m}>
                              {m}
                              {m.includes("haiku") ? " (faster, cheaper)" : m.includes("sonnet") ? " (smart, default)" : ""}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block space-y-1">
                        <span className="flex items-center justify-between text-xs font-medium text-ink">
                          <span>Temperature</span>
                          <span className="text-ink-faint">{settings.temperature.toFixed(2)}</span>
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={settings.temperature}
                          onChange={(e) => setSettings({ ...settings, temperature: Number(e.target.value) })}
                          className="w-full accent-cobalt"
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-3">
                        <label className="block space-y-1">
                          <span className="text-xs font-medium text-ink">Max tokens</span>
                          <input
                            type="number"
                            min={256}
                            max={4096}
                            value={settings.maxTokens}
                            onChange={(e) => setSettings({ ...settings, maxTokens: Number(e.target.value) })}
                            className="w-full rounded-chip border border-divider bg-card px-2.5 py-2 text-xs text-ink outline-none focus:border-cobalt"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs font-medium text-ink">Rate limit /min</span>
                          <input
                            type="number"
                            min={0}
                            max={600}
                            value={settings.requestsPerMin}
                            onChange={(e) => setSettings({ ...settings, requestsPerMin: Number(e.target.value) })}
                            className="w-full rounded-chip border border-divider bg-card px-2.5 py-2 text-xs text-ink outline-none focus:border-cobalt"
                          />
                        </label>
                      </div>

                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={settings.active}
                          onChange={(e) => setSettings({ ...settings, active: e.target.checked })}
                          className="h-4 w-4 accent-cobalt"
                        />
                        <span className="text-xs font-medium text-ink">Agent enabled</span>
                      </label>

                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-ink">System prompt</span>
                        <textarea
                          rows={8}
                          value={settings.systemPrompt}
                          onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                          placeholder="Leave blank to use the built-in default prompt."
                          className="w-full rounded-card border border-divider bg-card px-2.5 py-2 font-mono text-[11px] leading-4 text-ink outline-none focus:border-cobalt"
                        />
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, systemPrompt: settings.codeDefaultPrompt })}
                          className="text-[11px] font-medium text-cobalt"
                        >
                          Load default prompt to edit
                        </button>
                      </label>

                      <div className="flex items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => void saveSettings()}
                          disabled={savingSettings}
                          className="rounded-chip bg-cobalt px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {savingSettings ? "Saving…" : "Save settings"}
                        </button>
                        {settingsSaved && <span className="text-xs text-opportunity">Saved — applies to the next message.</span>}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
