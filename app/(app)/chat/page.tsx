// Brand Chat — Screen 19 (/chat). Ask questions about your competitive data in
// plain language. Auth + brand are gated by the (app) layout. This page is a
// functional surface over REAL chat history: it lists the brand's conversations
// (chat_conversations) and renders a selected conversation's real messages
// (chat_messages), both RLS-scoped to the brand.
//
// The ONLY thing not live is the assistant's answer generation: that runs in a
// Supabase Edge Function (GPT-4.1 Mini, brand context injected) which is not
// deployed yet (Sprint 3, blocked on API keys). Sending persists the user's
// message and surfaces an HONEST "assistant pending" notice — it never fabricates
// a reply (CLAUDE.md: no fake data inside a v1 page).

import { getConversations, getMessages, getCurrentBrand } from "@/lib/data/chat";
import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { ChatSurface } from "@/components/intelligence/ChatSurface";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: { c?: string };
}) {
  const brand = await getCurrentBrand();

  // The (app) layout already redirects when there's no brand; this guard keeps
  // the page type-safe and renders an honest empty state if it's ever reached.
  if (!brand) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Brand Chat"
          subtitle="Ask questions about your competitive data in plain language."
        />
        <EmptyState
          title="No brand configured"
          message="Finish onboarding to start chatting with your competitive data."
          intent="scanning"
        />
      </div>
    );
  }

  const conversations = await getConversations(brand);

  // Resolve the active conversation. Honour `?c=` only if it belongs to this
  // brand's conversations (the message read is RLS-scoped regardless); otherwise
  // default to the most recent conversation, or none for a fresh start.
  const requested = searchParams.c;
  const activeConversationId =
    requested && conversations.some((c) => c.id === requested)
      ? requested
      : null;

  const messages = activeConversationId
    ? await getMessages(activeConversationId)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brand Chat"
        subtitle="Ask questions about your competitive data in plain language."
      />
      <ChatSurface
        conversations={conversations}
        activeConversationId={activeConversationId}
        messages={messages}
      />
    </div>
  );
}
