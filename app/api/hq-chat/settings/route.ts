import { NextResponse } from "next/server";
import { getInternalCtx } from "@/lib/server/internal-guard";
import { HQ_SYSTEM_PROMPT } from "@/lib/server/hq-agent";
import { CLAUDE_SONNET_MODEL } from "@/lib/server/llm";

/**
 * GET/POST /api/hq-chat/settings — internal-admin config for the HQ Agent.
 * Model / temperature / max_tokens / rate-limit live on the model_router_config
 * row (task_type 'internal_hq_chat'); the system-prompt override lives on the
 * active prompt_versions row (agent_name 'internal_hq_chat'). Internal admins only.
 */

export const dynamic = "force-dynamic";

const SLOT = "internal_hq_chat";
const ALLOWED_MODELS = ["claude-sonnet-4-6", "claude-haiku-4-5"];

function clampNum(v: unknown, min: number, max: number, dflt: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}
function clampInt(v: unknown, min: number, max: number, dflt: number): number {
  return Math.round(clampNum(v, min, max, dflt));
}

export async function GET() {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });
  const { admin } = ctx;

  const [{ data: cfg }, { data: pv }] = await Promise.all([
    admin
      .from("model_router_config")
      .select("primary_model, temperature, max_tokens, requests_per_min, is_active")
      .eq("task_type", SLOT)
      .maybeSingle(),
    admin
      .from("prompt_versions")
      .select("system_prompt, prompt_text")
      .eq("agent_name", SLOT)
      .eq("status", "active")
      .order("deployed_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const override = ((pv?.system_prompt ?? pv?.prompt_text ?? "") as string).trim();
  return NextResponse.json({
    ok: true,
    model: cfg?.primary_model ?? CLAUDE_SONNET_MODEL,
    temperature: cfg?.temperature ?? 0.2,
    maxTokens: cfg?.max_tokens ?? 1500,
    requestsPerMin: cfg?.requests_per_min ?? 20,
    active: cfg?.is_active ?? true,
    systemPrompt: override && !override.startsWith("Code-defined:") ? override : "",
    codeDefaultPrompt: HQ_SYSTEM_PROMPT,
    models: ALLOWED_MODELS,
  });
}

export async function POST(req: Request) {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });
  const { admin, userId } = ctx;

  let body: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    requestsPerMin?: number;
    active?: boolean;
    systemPrompt?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const model = ALLOWED_MODELS.includes(String(body.model)) ? String(body.model) : CLAUDE_SONNET_MODEL;
  const temperature = clampNum(body.temperature, 0, 1, 0.2);
  const maxTokens = clampInt(body.maxTokens, 256, 4096, 1500);
  const requestsPerMin = clampInt(body.requestsPerMin, 0, 600, 20);
  const active = body.active !== false;

  // Update the existing router row (seeded); insert if somehow absent.
  const { data: existing } = await admin
    .from("model_router_config")
    .select("id")
    .eq("task_type", SLOT)
    .maybeSingle();
  const patch = {
    primary_model: model,
    temperature,
    max_tokens: maxTokens,
    requests_per_min: requestsPerMin,
    is_active: active,
    updated_at: new Date().toISOString(),
  };
  if (existing) {
    await admin.from("model_router_config").update(patch).eq("task_type", SLOT);
  } else {
    await admin.from("model_router_config").insert({ task_type: SLOT, ...patch });
  }

  // Prompt override: deactivate any active row, then insert a new active one when
  // a non-empty prompt is supplied (empty → revert to the code default).
  const prompt = typeof body.systemPrompt === "string" ? body.systemPrompt.trim() : "";
  await admin.from("prompt_versions").update({ status: "inactive" }).eq("agent_name", SLOT).eq("status", "active");
  if (prompt) {
    await admin.from("prompt_versions").insert({
      agent_name: SLOT,
      version: `${SLOT}@${Date.now()}`,
      system_prompt: prompt,
      prompt_text: prompt,
      status: "active",
      deployed_at: new Date().toISOString(),
      deployed_by: userId,
    });
  }

  return NextResponse.json({ ok: true });
}
