import { NextResponse } from "next/server";
import { getInternalCtx } from "@/lib/server/internal-guard";

/**
 * Owner-curated memory (facts/preferences/lessons) injected into the agent's
 * system prompt. The agent never writes here — only management does.
 *   GET    → active memory entries
 *   POST   → { kind: 'fact'|'preference'|'lesson', content }
 *   DELETE → { id } soft-deactivates
 * Internal-admin only.
 */

export const dynamic = "force-dynamic";

const KINDS = ["fact", "preference", "lesson"];

export async function GET() {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });
  const { data } = await ctx.admin
    .from("hq_agent_memory")
    .select("id, kind, content, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(100);
  return NextResponse.json({ ok: true, memory: data ?? [] });
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
  const kind = KINDS.includes(body.kind ?? "") ? body.kind! : "fact";
  const content = typeof body.content === "string" ? body.content.trim().slice(0, 2000) : "";
  if (!content) return NextResponse.json({ ok: false, error: "Content required." }, { status: 400 });
  const { data } = await ctx.admin
    .from("hq_agent_memory")
    .insert({ kind, content, created_by: ctx.userId })
    .select("id, kind, content, created_at")
    .single();
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
  await ctx.admin.from("hq_agent_memory").update({ is_active: false }).eq("id", body.id);
  return NextResponse.json({ ok: true });
}
