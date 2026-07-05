import { NextResponse } from "next/server";
import { getInternalCtx } from "@/lib/server/internal-guard";

/**
 * The HQ Agent's owner-curated memory (hq_agent_memory, migration 16).
 * Nothing enters memory without explicit owner action — the agent NEVER writes
 * here itself (Backoffice-advisory rule). Active rows are injected into the
 * agent's system prompt on every run.
 *
 * GET    → { memory: active rows, suggestions: recent 👎-with-note messages }
 * POST   → { kind: 'fact'|'preference'|'lesson', content } — add a memory
 * DELETE → { id } — deactivate (soft delete; keeps the audit trail)
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });

  const [{ data: memory }, { data: flagged }] = await Promise.all([
    ctx.admin
      .from("hq_agent_memory")
      .select("id, kind, content, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(60),
    ctx.admin
      .from("hq_messages")
      .select("id, content, feedback_note, created_at")
      .eq("reaction", "down")
      .not("feedback_note", "is", null)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  return NextResponse.json({
    ok: true,
    memory: memory ?? [],
    suggestions: (flagged ?? []).map((m) => ({
      messageId: m.id,
      note: m.feedback_note,
      answerExcerpt: m.content.slice(0, 160),
      at: m.created_at,
    })),
  });
}

export async function POST(req: Request) {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });

  let body: { kind?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  const kind = body.kind ?? "";
  const content = (body.content ?? "").trim();
  if (!["fact", "preference", "lesson"].includes(kind) || !content) {
    return NextResponse.json({ ok: false, error: "kind (fact|preference|lesson) and content required." }, { status: 400 });
  }
  const { data, error } = await ctx.admin
    .from("hq_agent_memory")
    .insert({ kind, content: content.slice(0, 600), created_by: ctx.userId })
    .select("id, kind, content, created_at")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, entry: data });
}

export async function DELETE(req: Request) {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ ok: false, error: "id required." }, { status: 400 });

  const { error } = await ctx.admin
    .from("hq_agent_memory")
    .update({ is_active: false })
    .eq("id", body.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
