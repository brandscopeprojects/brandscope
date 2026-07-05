import { NextResponse } from "next/server";
import { getInternalCtx } from "@/lib/server/internal-guard";
import { MVP_MODULES } from "@/lib/onboarding/module-tasks";

/**
 * PATCH /api/agent-control/agent — the kill switch (P2c).
 * { name, status: 'active'|'inactive' }        → pause/resume an agent
 * { name: 'researcher', disabledModules: [] }  → per-module pause (merged into
 *   agents.config.disabled_modules; enforced by brand-scan fan-out)
 * Internal admins only. Enforcement is fail-safe in the pipeline: a read error
 * there means everything runs.
 */

export const dynamic = "force-dynamic";

const AGENT_NAMES = ["supervisor", "researcher", "drafter", "auditor", "analytics"];

export async function PATCH(req: Request) {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });

  let body: { name?: string; status?: string; disabledModules?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  const name = body.name ?? "";
  if (!AGENT_NAMES.includes(name)) {
    return NextResponse.json({ ok: false, error: "Unknown agent." }, { status: 400 });
  }

  if (body.status !== undefined) {
    if (!["active", "inactive"].includes(body.status ?? "")) {
      return NextResponse.json({ ok: false, error: "status must be active|inactive." }, { status: 400 });
    }
    const { error } = await ctx.admin
      .from("agents")
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq("name", name);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (body.disabledModules !== undefined) {
    if (name !== "researcher") {
      return NextResponse.json({ ok: false, error: "disabledModules applies to researcher only." }, { status: 400 });
    }
    const list = Array.isArray(body.disabledModules) ? body.disabledModules.map(String) : null;
    if (!list || list.some((m) => !(MVP_MODULES as readonly string[]).includes(m))) {
      return NextResponse.json({ ok: false, error: "disabledModules must be valid module tasks." }, { status: 400 });
    }
    const { data: row } = await ctx.admin.from("agents").select("config").eq("name", name).single();
    const config = { ...((row?.config as Record<string, unknown>) ?? {}), disabled_modules: list };
    const { error } = await ctx.admin
      .from("agents")
      .update({ config, updated_at: new Date().toISOString() })
      .eq("name", name);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
