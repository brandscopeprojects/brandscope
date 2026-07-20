"use client";

// Hq Agent — composer. Growing textarea (Enter = send, Shift+Enter = newline),
// a Stop button while streaming, a Send button, and an optional voice slot.

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Square } from "lucide-react";
import { VoiceLauncher } from "./voice-launcher";
import type { HqAgentMessage } from "./hq-agent-message";

const MAX_TEXTAREA_PX = 160;

export function HqAgentComposer({
  onSend,
  onStop,
  busy,
  disabled,
  disabledNote,
  voiceEnabled,
  conversationId,
  onConversationId,
  onVoiceMessages,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  busy: boolean;
  disabled?: boolean;
  disabledNote?: string;
  voiceEnabled?: boolean;
  conversationId: string | null;
  onConversationId: (id: string) => void;
  onVoiceMessages: (
    msgs: Array<Pick<HqAgentMessage, "role" | "content" | "created_at">>,
  ) => void;
}) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Grow the textarea to fit content, capped.
  const autosize = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }, []);

  useEffect(() => {
    autosize();
  }, [value, autosize]);

  const submit = useCallback(() => {
    const q = value.trim();
    if (!q || busy || disabled) return;
    onSend(q);
    setValue("");
  }, [value, busy, disabled, onSend]);

  if (disabled) {
    return (
      <div className="border-t border-divider bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <p className="rounded-card bg-base-secondary/70 px-3 py-2.5 text-center text-xs text-ink-secondary">
          {disabledNote ?? "Text chat is currently disabled."}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-end gap-2 border-t border-divider bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <textarea
        ref={taRef}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Ask the HQ Agent…"
        aria-label="Message the HQ Agent"
        className="min-h-[44px] min-w-0 flex-1 resize-none rounded-card border border-divider bg-base-secondary/60 px-3.5 py-3 text-sm leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:border-cobalt"
      />

      {voiceEnabled && (
        <VoiceLauncher
          conversationId={conversationId}
          onConversationId={onConversationId}
          onVoiceMessages={onVoiceMessages}
          disabled={busy}
        />
      )}

      {busy ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="Stop generating"
          title="Stop"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-base-secondary text-ink-secondary transition-colors hover:bg-base-secondary/80 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt/40"
        >
          <Square className="h-4 w-4" aria-hidden />
        </button>
      ) : (
        <button
          type="submit"
          disabled={!value.trim()}
          aria-label="Send message"
          title="Send"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-cobalt text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt/40 disabled:opacity-40"
        >
          <Send className="h-4 w-4" aria-hidden />
        </button>
      )}
    </form>
  );
}
