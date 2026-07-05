import { NextResponse } from "next/server";
import { getInternalCtx } from "@/lib/server/internal-guard";

/**
 * POST /api/agent-control/prompts/activate — { id } promotes a draft/stable
 * version to ACTIVE for its slot (P2c). Current active → 'stable'. Records
 * deployed_at/by and rollback_from (the previous active id) so Rollback is
 * one call with the old id. Warn-don't-block (owner decision): the response
 * carries sandboxTested so the UI can warn on untested activations.
 * Runtime picks the change up within 5 minutes (loadPrompt cache TTL).
 */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ ok: false, error: "id required." }, { status: 400 });

  const { data: target } = await ctx.admin
    .from("prompt_versions")
    .select("id, agent_name, status, system_prompt, prompt_text")
    .eq("id", body.id)
    .single();
  if (!target) return NextResponse.json({ ok: false, error: "Version not found." }, { status: 404 });
  const text = (target.system_prompt ?? target.prompt_text ?? "").trim();
  if (!text || text.startsWith("Code-defined:")) {
    return NextResponse.json({ ok: false, error: "Legacy pointer rows cannot be activated." }, { status: 400 });
  }

  // Was this version ever sandbox-tested? (warn-don't-block)
  const { data: sandboxRuns } = await ctx.admin
    .from("agent_job_logs")
    .select("input_snapshot")
    .eq("task_type", "sandbox")
    .order("created_at", { ascending: false })
    .limit(200);
  const sandboxTested = (sandboxRuns ?? []).some((r) =>
    JSON.stringify(r.input_snapshot ?? "").includes(target.id),
  );

  // Demote current active for the slot, then promote the target.
  const { data: currentActive } = await ctx.admin
    .from("prompt_versions")
    .select("id")
    .eq("agent_name", target.agent_name)
    .eq("status", "active")
    .maybeSingle();

  if (currentActive && currentActive.id !== target.id) {
    const { error: demoteErr } = await ctx.admin
      .from("prompt_versions")
      .update({ status: "stable" })
      .eq("id", currentActive.id);
    if (demoteErr) return NextResponse.json({ ok: false, error: demoteErr.message }, { status: 500 });
  }

  const { error } = await ctx.admin
    .from("prompt_versions")
    .update({
      status: "active",
      deployed_at: new Date().toISOString(),
      deployed_by: ctx.userId,
      rollback_from: currentActive?.id ?? null,
    })
    .eq("id", target.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    sandboxTested,
    note: "Active. Edge functions pick this up within ~5 minutes (prompt cache TTL).",
  });
}
