"use server";

// Brand Chat server actions (Screen 19, `/chat`).
//
// chat_conversations carries a FOR ALL RLS policy scoped to the brand and
// chat_messages a FOR ALL policy joined through its conversation, so we write
// through the USER-SESSION client and rely on RLS — no service-role bypass.
//
// IMPORTANT (CLAUDE.md hard rule — never fake a working pipeline): the assistant
// reply is produced by a Supabase Edge Function (GPT-4.1 Mini, brand context
// injected) that is NOT deployed yet (Sprint 3, blocked on API keys). This action
// therefore persists ONLY the user's message and returns `assistantPending: true`.
// It never generates or inserts an assistant row — the UI surfaces an honest
// "assistant activates once your data pipeline is live" notice instead.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getCurrentBrand } from "@/lib/data/brand";

export type SendMessageResult =
  | { ok: true; conversationId: string; assistantPending: true }
  | { ok: false; error: string };

const MAX_MESSAGE_LENGTH = 4000;

/** Derive a short, readable conversation title from the first user message. */
function deriveTitle(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= 60) return collapsed;
  return `${collapsed.slice(0, 57).trimEnd()}…`;
}

/**
 * Persist a user message. When `conversationId` is null, create the conversation
 * first (scoped to the caller's brand, owned by the caller) and title it from the
 * message. Does NOT generate an assistant reply — returns assistantPending so the
 * UI can show the honest pending notice.
 */
export async function sendMessage(
  conversationId: string | null,
  text: string,
): Promise<SendMessageResult> {
  const user = await requireUser();

  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: "Type a question to send." };
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: "Message is too long." };
  }

  const supabase = createClient();

  let targetConversationId = conversationId;

  // Start a new conversation when none was supplied. The insert is RLS-scoped to
  // the caller's brand, so brand_id must be the caller's own brand.
  if (!targetConversationId) {
    const brand = await getCurrentBrand();
    if (!brand) {
      return { ok: false, error: "No brand configured." };
    }

    const { data: conversation, error: convError } = await supabase
      .from("chat_conversations")
      .insert({
        brand_id: brand.id,
        profile_id: user.id,
        title: deriveTitle(trimmed),
        last_message_at: new Date().toISOString(),
        message_count: 1,
      })
      .select("id")
      .single();

    if (convError || !conversation) {
      return {
        ok: false,
        error: convError?.message ?? "Could not start the conversation.",
      };
    }
    targetConversationId = conversation.id;
  }

  // Persist the user's message. RLS verifies the conversation belongs to the
  // caller's brand via the chat_messages join policy.
  const { error: messageError } = await supabase.from("chat_messages").insert({
    conversation_id: targetConversationId,
    role: "user",
    content: trimmed,
  });

  if (messageError) {
    return { ok: false, error: messageError.message };
  }

  // For an existing conversation, advance its activity stamp / count so the list
  // re-sorts. (A new conversation already stamped these on insert.)
  if (conversationId) {
    const { data: existing } = await supabase
      .from("chat_conversations")
      .select("message_count")
      .eq("id", conversationId)
      .maybeSingle();

    await supabase
      .from("chat_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        message_count: (existing?.message_count ?? 0) + 1,
      })
      .eq("id", conversationId);
  }

  revalidatePath("/chat");
  return { ok: true, conversationId: targetConversationId, assistantPending: true };
}
