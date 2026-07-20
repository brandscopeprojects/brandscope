import "server-only";

// Conversation persistence for the HQ Agent. Text and voice messages share one
// hq_conversations thread; modality is recorded per message. A recent-message
// window (config.text.recentMessageLimit) bounds what we resend to the model.

import type { Admin, Modality } from "./types";

export type StoredMessage = { role: "user" | "assistant"; content: string; modality: Modality; created_at: string; id: string };

/** Resolve an existing conversation (verifying ownership) or create a new one. */
export async function resolveConversation(
  admin: Admin,
  profileId: string,
  conversationId: string | null,
  firstMessage: string,
): Promise<string | null> {
  if (conversationId) {
    const { data } = await admin
      .from("hq_conversations")
      .select("id, profile_id")
      .eq("id", conversationId)
      .maybeSingle();
    // Tenant/ownership check: never trust a conversation id the browser supplies.
    if (data && data.profile_id === profileId) return conversationId;
  }
  const title = firstMessage.length > 64 ? `${firstMessage.slice(0, 61)}…` : firstMessage || "New conversation";
  const { data: created } = await admin
    .from("hq_conversations")
    .insert({ profile_id: profileId, title })
    .select("id")
    .single();
  return created?.id ?? null;
}

/** Load the recent message window for a conversation, oldest-first. */
export async function loadRecentMessages(admin: Admin, conversationId: string, limit: number): Promise<StoredMessage[]> {
  const { data } = await admin
    .from("hq_messages")
    .select("id, role, content, modality, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));
  const rows = (data ?? []).reverse();
  return rows.map((m) => ({
    id: m.id,
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
    modality: (m.modality as Modality) ?? "text",
    created_at: m.created_at,
  }));
}

export async function insertMessage(
  admin: Admin,
  row: {
    conversationId: string;
    role: "user" | "assistant";
    content: string;
    modality: Modality;
    model?: string | null;
    toolsUsed?: string[];
    status?: "streaming" | "complete" | "error";
    metadata?: Record<string, unknown>;
  },
): Promise<{ id: string; created_at: string } | null> {
  const { data } = await admin
    .from("hq_messages")
    .insert({
      conversation_id: row.conversationId,
      role: row.role,
      content: row.content,
      modality: row.modality,
      model: row.model ?? null,
      tools_used: row.toolsUsed ?? null,
      status: row.status ?? "complete",
      metadata: (row.metadata ?? null) as never,
    })
    .select("id, created_at")
    .single();
  return data ?? null;
}

export async function bumpConversation(admin: Admin, conversationId: string, addedMessages: number): Promise<void> {
  const { data } = await admin.from("hq_conversations").select("message_count").eq("id", conversationId).maybeSingle();
  await admin
    .from("hq_conversations")
    .update({ last_message_at: new Date().toISOString(), message_count: (data?.message_count ?? 0) + addedMessages })
    .eq("id", conversationId);
}

/** Count a user's messages in the last windowSec seconds (rate limiting). */
export async function recentUserMessageCount(admin: Admin, profileId: string, windowSec: number): Promise<number> {
  const since = new Date(Date.now() - windowSec * 1000).toISOString();
  const { data: convs } = await admin.from("hq_conversations").select("id").eq("profile_id", profileId);
  const ids = (convs ?? []).map((c) => c.id);
  if (ids.length === 0) return 0;
  const { count } = await admin
    .from("hq_messages")
    .select("id", { count: "exact", head: true })
    .in("conversation_id", ids)
    .eq("role", "user")
    .gte("created_at", since);
  return count ?? 0;
}

/** Owner-approved memory block injected into the system prompt (agent never self-writes). */
export async function loadMemoryBlock(admin: Admin, limit = 40): Promise<string> {
  const { data } = await admin
    .from("hq_agent_memory")
    .select("kind, content")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (!data || data.length === 0) return "";
  return ["APPROVED MEMORY (owner-curated; treat as reliable context):", ...data.map((m) => `- [${m.kind}] ${m.content}`)].join("\n");
}
