"use client";

// ChatConversationList — the left pane of Brand Chat (Screen 19). Lists the
// brand's real conversations (newest activity first) and a "New chat" button.
// Selecting a conversation swaps the right-hand thread. The active row is
// cobalt-tinted (cobalt = the user's own context marker). Tokens only.

import type { ChatConversation } from "@/lib/data/chat";

/** Compact "when" label for a conversation row. Local to this component to avoid
 *  touching the shared formatter module. */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function ChatConversationList({
  conversations,
  activeId,
  onSelect,
  onNewChat,
}: {
  conversations: ChatConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <button
        type="button"
        onClick={onNewChat}
        className="m-3 flex items-center justify-center gap-2 rounded-chip bg-cobalt px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cobalt/90"
      >
        <span aria-hidden className="text-base leading-none">
          +
        </span>
        New chat
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 ? (
          <p className="px-3 py-4 text-sm leading-6 text-ink-faint">
            No conversations yet. Start one to ask about your competitive data.
          </p>
        ) : (
          <ul className="space-y-1">
            {conversations.map((c) => {
              const active = c.id === activeId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    aria-current={active ? "true" : undefined}
                    className={[
                      "w-full rounded-chip px-3 py-2 text-left transition-colors",
                      active
                        ? "bg-cobalt/10 text-ink"
                        : "text-ink-secondary hover:bg-base-secondary hover:text-ink",
                    ].join(" ")}
                  >
                    <span className="block truncate text-sm font-medium">
                      {c.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-ink-faint">
                      {c.lastMessageAt && (
                        <span>{formatWhen(c.lastMessageAt)}</span>
                      )}
                      <span>
                        {c.messageCount} {c.messageCount === 1 ? "msg" : "msgs"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
