"use client";

// ChatComposer — the message input for Brand Chat (Screen 19). A textarea + cobalt
// send button. Enter sends, Shift+Enter inserts a newline. Disabled while a send
// is in flight. Presentational + controlled by the parent ChatSurface (which owns
// the sendMessage call); this component only collects and submits text. Tokens only.

import { useState } from "react";

export function ChatComposer({
  onSend,
  pending,
  error,
}: {
  onSend: (text: string) => void;
  pending: boolean;
  error: string | null;
}) {
  const [text, setText] = useState("");

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-chip bg-urgent/10 px-3 py-2 text-xs text-urgent">
          {error}
        </p>
      )}
      <div className="flex items-end gap-2 rounded-card border border-divider bg-card p-2 shadow-sh1">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder="Ask about your competitors, market position, regulatory standing…"
          aria-label="Message"
          className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-6 text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || text.trim().length === 0}
          className="rounded-chip bg-cobalt px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cobalt/90 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
