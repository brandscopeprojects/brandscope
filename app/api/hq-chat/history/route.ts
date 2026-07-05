import { NextResponse } from "next/server";
import { getInternalCtx } from "@/lib/server/internal-guard";

/**
 * GET /api/hq-chat/history            → conversation list (newest first)
 * GET /api/hq-chat/history?id=<uuid>  → messages of one conversation
 * Internal admins only. Service-role reads (Class-2 tables, migration 16).
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");

  if (!id) {
    const { data } = await ctx.admin
      .from("hq_conversations")
      .select("id, title, message_count, last_message_at")
      .order("last_message_at", { ascending: false })
      .limit(50);
    return NextResponse.json({ ok: true, conversations: data ?? [] });
  }

  const { data } = await ctx.admin
    .from("hq_messages")
    .select("id, role, content, tools_used, reaction, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(200);
  return NextResponse.json({ ok: true, messages: data ?? [] });
}
