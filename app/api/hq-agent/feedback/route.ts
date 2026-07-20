import { NextResponse } from "next/server";
import { getInternalCtx } from "@/lib/server/internal-guard";

/**
 * POST /api/hq-agent/feedback — thumbs up/down + optional note on an assistant
 * message. Internal-admin only; ownership of the parent conversation is verified
 * before the write.
 */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });
  const { admin, userId } = ctx;

  let body: { messageId?: string; reaction?: "up" | "down" | null; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.messageId) return NextResponse.json({ ok: false, error: "messageId required." }, { status: 400 });
  const reaction = body.reaction === "up" || body.reaction === "down" ? body.reaction : null;

  // Verify the message belongs to a conversation the caller owns.
  const { data: msg } = await admin
    .from("hq_messages")
    .select("id, conversation_id")
    .eq("id", body.messageId)
    .maybeSingle();
  if (!msg) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  const { data: conv } = await admin.from("hq_conversations").select("profile_id").eq("id", msg.conversation_id).maybeSingle();
  if (!conv || conv.profile_id !== userId) return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });

  await admin
    .from("hq_messages")
    .update({ reaction, feedback_note: typeof body.note === "string" ? body.note.slice(0, 2000) : null })
    .eq("id", body.messageId);
  return NextResponse.json({ ok: true });
}
