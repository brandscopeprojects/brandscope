"use client";

// §13-H Test & publish — a live text test (SSE), a voice-session smoke test, and
// the draft/publish/restore controls. Shows current status and an env warning when
// required server config is missing. Never renders an API-key input.

import { useState } from "react";
import { AlertTriangle, Send, Mic, Save, Rocket, Undo2 } from "lucide-react";
import { inputClass } from "./fields";
import type { ConfigStatus, EnvStatus } from "./types";

const STATUS_LABEL: Record<ConfigStatus, string> = {
  draft: "Draft (unpublished changes)",
  published: "Published (live)",
  default: "Defaults (never saved)",
};

const STATUS_CLASS: Record<ConfigStatus, string> = {
  draft: "bg-watch/10 text-watch",
  published: "bg-opportunity/10 text-opportunity",
  default: "bg-info/10 text-info",
};

export function TestPublishBar({
  status,
  env,
  dirty,
  busy,
  saveMessage,
  saveError,
  onSaveDraft,
  onPublish,
  onRestore,
}: {
  status: ConfigStatus;
  env: EnvStatus;
  dirty: boolean;
  busy: boolean;
  saveMessage: string | null;
  saveError: string | null;
  onSaveDraft: () => void;
  onPublish: () => void;
  onRestore: () => void;
}) {
  // ── Text test ──
  const [testMessage, setTestMessage] = useState("");
  const [reply, setReply] = useState("");
  const [textTesting, setTextTesting] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);

  async function runTextTest() {
    const msg = testMessage.trim();
    if (!msg) return;
    setTextTesting(true);
    setTextError(null);
    setReply("");
    try {
      const res = await fetch("/api/hq-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: null, message: msg }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: "Request failed." }));
        setTextError(data.error ?? `Request failed (${res.status}).`);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          try {
            const evt = JSON.parse(line.slice(5).trim());
            if (evt.type === "delta" && typeof evt.text === "string") {
              acc += evt.text;
              setReply(acc);
            } else if (evt.type === "reset") {
              acc = "";
              setReply("");
            } else if (evt.type === "done" && typeof evt.reply === "string") {
              setReply(evt.reply);
            } else if (evt.type === "error") {
              setTextError(evt.error ?? "The assistant returned an error.");
            }
          } catch {
            /* ignore malformed frame */
          }
        }
      }
    } catch {
      setTextError("Could not reach the assistant.");
    } finally {
      setTextTesting(false);
    }
  }

  // ── Voice test ──
  const [voiceTesting, setVoiceTesting] = useState(false);
  const [voiceResult, setVoiceResult] = useState<
    { ok: true; text: string } | { ok: false; text: string } | null
  >(null);

  async function runVoiceTest() {
    setVoiceTesting(true);
    setVoiceResult(null);
    try {
      const res = await fetch("/api/hq-agent/realtime/session", { method: "POST" });
      const data = await res.json().catch(() => ({ ok: false, error: "Bad response." }));
      if (data.ok) {
        const when = data.expiresAt
          ? new Date(data.expiresAt * 1000).toLocaleTimeString()
          : "soon";
        setVoiceResult({ ok: true, text: `Voice session OK (expires ${when}).` });
      } else {
        setVoiceResult({ ok: false, text: data.error ?? "Voice session failed." });
      }
    } catch {
      setVoiceResult({ ok: false, text: "Could not reach the voice endpoint." });
    } finally {
      setVoiceTesting(false);
    }
  }

  return (
    <section className="space-y-5 rounded-card bg-card p-5 shadow-sh1 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Test &amp; publish</h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Try the assistant, then save a draft or publish it live.
          </p>
        </div>
        <span
          className={`rounded-chip px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[status]}`}
        >
          {STATUS_LABEL[status]}
        </span>
      </header>

      {!env.ok && (
        <div
          className="flex items-start gap-2 rounded-chip border border-urgent/30 bg-urgent/5 p-3"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-urgent" aria-hidden />
          <div className="text-sm text-urgent">
            <p className="font-semibold">Server configuration incomplete.</p>
            {env.missing.length > 0 && (
              <p className="mt-0.5">
                Missing:{" "}
                <span className="font-mono text-xs">{env.missing.join(", ")}</span>
              </p>
            )}
            <p className="mt-0.5 text-xs text-urgent/80">
              Tests and live answers may fail until this is resolved.
            </p>
          </div>
        </div>
      )}

      {/* Test text */}
      <div className="space-y-2">
        <label htmlFor="hq-test-text" className="text-sm font-medium text-ink-secondary">
          Test text
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="hq-test-text"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !textTesting) runTextTest();
            }}
            placeholder="Ask the assistant something…"
            className={inputClass}
          />
          <button
            type="button"
            onClick={runTextTest}
            disabled={textTesting || !testMessage.trim()}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-chip border border-divider px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:border-cobalt hover:text-cobalt disabled:opacity-50"
          >
            <Send className="h-4 w-4" aria-hidden />
            {textTesting ? "Testing…" : "Send"}
          </button>
        </div>
        {textError && (
          <p className="text-sm font-medium text-urgent" role="alert">
            {textError}
          </p>
        )}
        {reply && (
          <div className="whitespace-pre-wrap rounded-chip border border-divider bg-base-secondary p-3 text-sm text-ink">
            {reply}
          </div>
        )}
      </div>

      {/* Test voice */}
      <div className="space-y-2">
        <span className="text-sm font-medium text-ink-secondary">Test voice</span>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={runVoiceTest}
            disabled={voiceTesting}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-chip border border-divider px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:border-cobalt hover:text-cobalt disabled:opacity-50"
          >
            <Mic className="h-4 w-4" aria-hidden />
            {voiceTesting ? "Checking…" : "Test voice session"}
          </button>
          {voiceResult && (
            <p
              className={`text-sm font-medium ${voiceResult.ok ? "text-opportunity" : "text-urgent"}`}
              role="status"
            >
              {voiceResult.text}
            </p>
          )}
        </div>
      </div>

      {/* Publish controls */}
      <div className="flex flex-col gap-3 border-t border-divider pt-4 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={busy || !dirty}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-chip border border-divider px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-cobalt hover:text-cobalt disabled:opacity-50"
        >
          <Save className="h-4 w-4" aria-hidden />
          Save draft
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={busy}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-chip bg-cobalt px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Rocket className="h-4 w-4" aria-hidden />
          {busy ? "Working…" : "Publish"}
        </button>
        <button
          type="button"
          onClick={onRestore}
          disabled={busy}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-chip px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:text-ink disabled:opacity-50"
        >
          <Undo2 className="h-4 w-4" aria-hidden />
          Restore last published
        </button>
        {saveMessage && (
          <p className="text-sm font-medium text-opportunity" role="status">
            {saveMessage}
          </p>
        )}
        {saveError && (
          <p className="text-sm font-medium text-urgent" role="alert">
            {saveError}
          </p>
        )}
      </div>
    </section>
  );
}
