"use client";

// ChatSurface — the Brand Chat client shell (Screen 19, /chat). Owns the two-pane
// layout: left = ChatConversationList (real conversations + New chat), right =
// ChatThread (real message history) + ChatComposer. Server-rendered data arrives
// as props (no fetching here); switching conversations updates the `?c=` query and
// lets the server re-render the thread; sending calls the sendMessage server
// action then router.refresh()es to pull the persisted message back.
//
// The assistant reply is NOT generated here (GPT-4.1 Mini Edge Function undeployed,
// Sprint 3). After a send we flip a local flag so ChatThread shows the honest
// "assistant pending" notice — never a fabricated answer. Tokens only.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendMessage } from "@/app/(app)/chat/actions";
import type { ChatConversation, ChatMessage } from "@/lib/data/chat";
import { ChatConversationList } from "@/components/intelligence/ChatConversationList";
import { ChatThread } from "@/components/intelligence/ChatThread";
import { ChatComposer } from "@/components/intelligence/ChatComposer";
import { ChatSuggestedPrompts } from "@/components/intelligence/ChatSuggestedPrompts";

export function ChatSurface({
  conversations,
  activeConversationId,
  messages,
}: {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  messages: ChatMessage[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Whether to show the honest "assistant pending" notice. Set when the user
  // sends a message; cleared whenever the active conversation or its server-
  // rendered messages change (a new selection / a fresh load).
  const [pendingNotice, setPendingNotice] = useState(false);
  useEffect(() => {
    setPendingNotice(false);
    setError(null);
  }, [activeConversationId, messages]);

  function selectConversation(id: string) {
    if (id === activeConversationId) return;
    router.push(`/chat?c=${id}`);
  }

  function newChat() {
    router.push("/chat");
  }

  function send(text: string) {
    setError(null);
    startTransition(async () => {
      const res = await sendMessage(activeConversationId, text);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Show the honest pending notice immediately; never invent a reply.
      setPendingNotice(true);
      if (res.conversationId !== activeConversationId) {
        // A new conversation was created — move into it (server re-renders the
        // thread with the just-persisted user message).
        router.push(`/chat?c=${res.conversationId}`);
      } else {
        // Existing conversation — pull the persisted message back from the server.
        router.refresh();
      }
    });
  }

  const hasConversations = conversations.length > 0;
  const isEmptyStarter = !hasConversations && !activeConversationId;

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-13rem)] lg:flex-row">
      {/* Left pane — conversation list. Collapses above the thread on mobile. */}
      <aside className="shrink-0 overflow-hidden rounded-card bg-card shadow-sh1 lg:h-full lg:w-72">
        <ChatConversationList
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={selectConversation}
          onNewChat={newChat}
        />
      </aside>

      {/* Right pane — thread + composer. */}
      <section className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isEmptyStarter ? (
            <div className="rounded-card bg-card p-5 shadow-sh1">
              <ChatSuggestedPrompts onSelect={send} disabled={pending} />
            </div>
          ) : messages.length === 0 && !pendingNotice ? (
            <div className="flex h-full items-center justify-center rounded-card bg-card p-6 text-center shadow-sh1">
              <p className="max-w-sm text-sm leading-6 text-ink-secondary">
                Send a message to start this conversation. Answers draw on your
                real competitive data once the assistant is live.
              </p>
            </div>
          ) : (
            <div className="rounded-card bg-card p-5 shadow-sh1">
              <ChatThread messages={messages} showPendingNotice={pendingNotice} />
            </div>
          )}
        </div>

        <ChatComposer onSend={send} pending={pending} error={error} />
      </section>
    </div>
  );
}
