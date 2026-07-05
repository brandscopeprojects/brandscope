import { NextResponse } from "next/server";
import { getInternalCtx } from "@/lib/server/internal-guard";
import { SLOT_KEYS, codeTemplate } from "@/lib/server/agent-slots";

/**
 * Prompt versions per slot (P2c editable prompts; schema-amendments D.7 —
 * prompt_versions.agent_name holds the slot key).
 *
 * GET  ?slot=researcher:promotions → { versions, activeText, codeTemplate }
 * POST { slot, systemPrompt, notes? } → creates the next DRAFT version.
 * Legacy pointer rows ("Code-defined: …") are listed but never treated as text.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });

  const slot = new URL(req.url).searchParams.get("slot") ?? "";
  if (!SLOT_KEYS.includes(slot)) {
    return NextResponse.json({ ok: false, error: "Unknown slot." }, { status: 400 });
  }

  const { data: versions } = await ctx.admin
    .from("prompt_versions")
    .select("id, version, status, system_prompt, prompt_text, notes, deployed_at, created_at")
    .eq("agent_name", slot)
    .order("created_at", { ascending: false })
    .limit(30);

  const active = (versions ?? []).find((v) => v.status === "active");
  const activeText = (() => {
    const t = (active?.system_prompt ?? active?.prompt_text ?? "").trim();
    return t && !t.startsWith("Code-defined:") ? t : null;
  })();

  return NextResponse.json({
    ok: true,
    versions: (versions ?? []).map((v) => ({
      id: v.id,
      version: v.version,
      status: v.status,
      notes: v.notes,
      deployedAt: v.deployed_at,
      createdAt: v.created_at,
      isPointer: (v.system_prompt ?? v.prompt_text ?? "").trim().startsWith("Code-defined:"),
      text: (v.system_prompt ?? v.prompt_text ?? "").trim(),
    })),
    activeText,
    codeTemplate: codeTemplate(slot),
  });
}

export async function POST(req: Request) {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });

  let body: { slot?: string; systemPrompt?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  const slot = body.slot ?? "";
  const text = (body.systemPrompt ?? "").trim();
  if (!SLOT_KEYS.includes(slot)) return NextResponse.json({ ok: false, error: "Unknown slot." }, { status: 400 });
  if (text.length < 40) {
    return NextResponse.json({ ok: false, error: "Prompt is too short to be a system prompt." }, { status: 400 });
  }
  if (text.length > 20000) {
    return NextResponse.json({ ok: false, error: "Prompt too long (20k char cap)." }, { status: 400 });
  }

  // Next version number for this slot: v{n+1} over existing "v\d+" versions.
  const { data: existing } = await ctx.admin
    .from("prompt_versions")
    .select("version")
    .eq("agent_name", slot);
  const maxN = Math.max(
    1,
    ...((existing ?? [])
      .map((r) => /^v(\d+)$/.exec(r.version ?? ""))
      .filter(Boolean)
      .map((m) => Number((m as RegExpExecArray)[1]))),
  );
  const version = `v${maxN + 1}`;

  const { data, error } = await ctx.admin
    .from("prompt_versions")
    .insert({
      agent_name: slot,
      version,
      prompt_text: text,
      system_prompt: text,
      status: "draft",
      deployed_by: ctx.userId,
      notes: body.notes?.slice(0, 500) ?? null,
    })
    .select("id, version, status, created_at")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, draft: data });
}
