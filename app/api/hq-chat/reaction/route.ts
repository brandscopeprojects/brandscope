import { NextResponse } from "next/server";
import { getInternalCtx } from "@/lib/server/internal-guard";

/**
 * POST /api/hq-chat/reaction — { messageId, reaction: 'up'|'down'|null, note? }
 * Stores the owner's verdict on an assistant answer (the learning signal:
 * 👎 + note surfaces in the Memory panel as a suggested lesson the owner can
 * promote). Internal admins only.
 */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });

  let body: { messageId?: string; reaction?: "up" | "down" | null; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.messageId || (body.reaction != null && !["up", "down"].includes(body.reaction))) {
    return NextResponse.json({ ok: false, error: "messageId and a valid reaction required." }, { status: 400 });
  }

  const { error } = await ctx.admin
    .from("hq_messages")
    .update({
      reaction: body.reaction ?? null,
      feedback_note: typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null,
    })
    .eq("id", body.messageId)
    .eq("role", "assistant");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
