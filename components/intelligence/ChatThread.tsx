"use client";

// ChatThread — the right pane of Brand Chat (Screen 19). Renders a conversation's
// message bubbles: the user's own messages are cobalt-tinted and right-aligned
// (cobalt = "this is you"); the assistant's are card-surface and left-aligned, and
// may carry an inline data table (inline_data). After a just-sent user message we
// render an HONEST "assistant pending" notice — never a fabricated reply, because
// the GPT-4.1 Mini Edge Function is not deployed yet (Sprint 3). Tokens only.

import type { ChatInlineData, ChatMessage } from "@/lib/data/chat";

function InlineDataTable({ data }: { data: ChatInlineData }) {
  const table = data.table;
  if (!table || (table.columns.length === 0 && table.rows.length === 0)) {
    return null;
  }

  return (
    <div className="mt-3 overflow-x-auto rounded-chip border border-divider">
      <table className="w-full border-collapse text-left text-sm">
        {table.columns.length > 0 && (
          <thead>
            <tr className="bg-base-secondary">
              {table.columns.map((col, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-xs font-medium text-ink-secondary"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri} className="border-t border-divider">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 font-mono text-xs text-ink">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  // System messages render as a centred, muted note (rarely surfaced to brands).
  if (message.role === "system") {
    return (
      <p className="mx-auto max-w-prose text-center text-xs leading-6 text-ink-faint">
        {message.content}
      </p>
    );
  }

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={[
          "max-w-[85%] rounded-card px-4 py-3 text-sm leading-6",
          isUser
            ? "bg-cobalt/10 text-ink"
            : "bg-card text-ink shadow-sh1",
        ].join(" ")}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {!isUser && message.inlineData && (
          <InlineDataTable data={message.inlineData} />
        )}
      </div>
    </div>
  );
}

/** The honest assistant-pending notice. Shown after a user message while the
 *  GPT-4.1 Mini Edge Function is not yet deployed — this is NOT a fake answer. */
export function AssistantPendingNotice() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-card border border-dashed border-divider bg-card/50 px-4 py-3">
        <p className="font-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">
          Assistant pending
        </p>
        <p className="mt-1 text-sm leading-6 text-ink-secondary">
          The Brandscope assistant will respond once your data pipeline is live.
          Your question is saved and will be answered against your real
          competitive data the moment the assistant activates.
        </p>
      </div>
    </div>
  );
}

export function ChatThread({
  messages,
  showPendingNotice,
}: {
  messages: ChatMessage[];
  showPendingNotice: boolean;
}) {
  return (
    <div className="space-y-4">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      {showPendingNotice && <AssistantPendingNotice />}
    </div>
  );
}
