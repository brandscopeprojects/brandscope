import { NextResponse } from "next/server";
import { getInternalCtx } from "@/lib/server/internal-guard";
import { APPROVED_MODELS } from "@/lib/agent-control-shared";

/**
 * PATCH /api/agent-control/router — edit a model_router_config row (P2c).
 * { task, primaryModel?, fallbackModel?, temperature?, maxTokens? }
 * Models are LOCKED to the approved MVP list (owner decision); temperature and
 * maxTokens are bounded. Pass temperature/maxTokens as null to fall back to the
 * code default. Runtime picks changes up within 5 minutes (router cache TTL).
 */

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });

  let body: {
    task?: string;
    primaryModel?: string;
    fallbackModel?: string | null;
    temperature?: number | null;
    maxTokens?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.task) return NextResponse.json({ ok: false, error: "task required." }, { status: 400 });

  const patch: {
    updated_at: string;
    primary_model?: string;
    fallback_model?: string | null;
    temperature?: number | null;
    max_tokens?: number | null;
  } = { updated_at: new Date().toISOString() };
  if (body.primaryModel !== undefined) {
    if (!APPROVED_MODELS.includes(body.primaryModel)) {
      return NextResponse.json({ ok: false, error: "primaryModel not in the approved list." }, { status: 400 });
    }
    patch.primary_model = body.primaryModel;
  }
  if (body.fallbackModel !== undefined) {
    if (body.fallbackModel !== null && !APPROVED_MODELS.includes(body.fallbackModel)) {
      return NextResponse.json({ ok: false, error: "fallbackModel not in the approved list." }, { status: 400 });
    }
    patch.fallback_model = body.fallbackModel;
  }
  if (body.temperature !== undefined) {
    if (body.temperature !== null && (typeof body.temperature !== "number" || body.temperature < 0 || body.temperature > 1)) {
      return NextResponse.json({ ok: false, error: "temperature must be 0–1 or null." }, { status: 400 });
    }
    patch.temperature = body.temperature;
  }
  if (body.maxTokens !== undefined) {
    if (body.maxTokens !== null && (!Number.isInteger(body.maxTokens) || body.maxTokens < 100 || body.maxTokens > 4000)) {
      return NextResponse.json({ ok: false, error: "maxTokens must be 100–4000 or null." }, { status: 400 });
    }
    patch.max_tokens = body.maxTokens;
  }

  const { error } = await ctx.admin.from("model_router_config").update(patch).eq("task_type", body.task);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, note: "Live within ~5 minutes (router cache TTL)." });
}
