import { NextResponse } from "next/server";
import { getInternalCtx } from "@/lib/server/internal-guard";

/**
 * PATCH /api/agent-control/skill — toggle an agent_skills row (P2c).
 * { id, isActive }. Skills are registry METADATA (they document capabilities;
 * execution gating is the kill switch / module switches) — the toggle keeps the
 * registry honest, it does not gate code paths.
 */

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });

  let body: { id?: string; isActive?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.id || typeof body.isActive !== "boolean") {
    return NextResponse.json({ ok: false, error: "id and isActive required." }, { status: 400 });
  }
  const { error } = await ctx.admin
    .from("agent_skills")
    .update({ is_active: body.isActive, updated_at: new Date().toISOString() })
    .eq("id", body.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
