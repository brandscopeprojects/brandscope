import { NextResponse } from "next/server";
import { getInternalCtx } from "@/lib/server/internal-guard";
import { resolveConversation, insertMessage, bumpConversation } from "@/lib/hq-agent/conversation";
import type { Modality } from "@/lib/hq-agent/types";

/**
 * GET  /api/hq-agent/conversations         → the caller's conversations (list).
 * GET  /api/hq-agent/conversations?id=<id> → messages for one owned conversation.
 * POST /api/hq-agent/conversations         → append voice transcript turns to the
 *        shared conversation (§11: voice transcripts become normal messages).
 * All internal-admin only; ownership verified server-side.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });
  const { admin, userId } = ctx;

  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const { data: conv } = await admin.from("hq_conversations").select("id, profile_id").eq("id", id).maybeSingle();
    if (!conv || conv.profile_id !== userId) {
      return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    }
    const { data: messages } = await admin
      .from("hq_messages")
      .select("id, role, content, modality, model, tools_used, reaction, feedback_note, metadata, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    return NextResponse.json({ ok: true, messages: messages ?? [] });
  }

  const { data: conversations } = await admin
    .from("hq_conversations")
    .select("id, title, message_count, last_message_at")
    .eq("profile_id", userId)
    .order("last_message_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ ok: true, conversations: conversations ?? [] });
}

export async function POST(req: Request) {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });
  const { admin, userId } = ctx;

  let body: { conversationId?: string | null; messages?: Array<{ role?: string; content?: string }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  const turns = (body.messages ?? [])
    .map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: typeof m.content === "string" ? m.content.trim() : "" }))
    .filter((m) => m.content.length > 0)
    .slice(0, 50);
  if (turns.length === 0) return NextResponse.json({ ok: false, error: "No transcript to save." }, { status: 400 });

  const first = turns.find((t) => t.role === "user")?.content ?? turns[0].content;
  const conversationId = await resolveConversation(admin, userId, body.conversationId ?? null, first);
  if (!conversationId) return NextResponse.json({ ok: false, error: "Could not resolve conversation." }, { status: 500 });

  const saved: Array<{ id: string; created_at: string }> = [];
  for (const t of turns) {
    const row = await insertMessage(admin, {
      conversationId,
      role: t.role,
      content: t.content,
      modality: "voice" as Modality,
      status: "complete",
    });
    if (row) saved.push(row);
  }
  await bumpConversation(admin, conversationId, saved.length);
  return NextResponse.json({ ok: true, conversationId, saved });
}
