import { NextResponse } from "next/server";
import { getInternalCtx } from "@/lib/server/internal-guard";
import {
  loadDraftOrPublished,
  normalizeConfig,
  validateHqEnv,
  textModel,
  realtimeModel,
  SUPPORTED_VOICES,
  DEFAULT_HQ_CONFIG,
} from "@/lib/hq-agent/config";
import type { ToolCategory } from "@/lib/hq-agent/types";

/**
 * GET  /api/hq-agent/config → current (draft-or-published) config + env status +
 *        read-only model display + supported voices. super_admin/internal_admin.
 * POST /api/hq-agent/config → { action: 'save_draft' | 'publish' | 'restore', config? }
 *        save_draft edits the draft; publish promotes it; restore discards the draft.
 * Never accepts or returns the OpenAI API key.
 */

export const dynamic = "force-dynamic";

const TOOL_CATEGORIES: { key: ToolCategory; label: string }[] = [
  { key: "customers", label: "Customers" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "finance", label: "Finance" },
  { key: "campaigns", label: "Campaigns" },
  { key: "operations", label: "Operations" },
  { key: "llm_usage", label: "AI usage" },
  { key: "provider_health", label: "Provider health" },
];

export async function GET() {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });
  const { admin } = ctx;

  const { config, status } = await loadDraftOrPublished(admin);
  const env = validateHqEnv();
  return NextResponse.json({
    ok: true,
    config,
    status,
    env: { ok: env.ok, missing: env.missing, usingDefaults: env.usingDefaults },
    models: { text: textModel(), realtime: realtimeModel() },
    voices: SUPPORTED_VOICES,
    toolCategories: TOOL_CATEGORIES,
    defaults: DEFAULT_HQ_CONFIG,
  });
}

export async function POST(req: Request) {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });
  const { admin, userId, role } = ctx;
  if (role !== "super_admin" && role !== "internal_admin") {
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  let body: { action?: string; config?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  const action = body.action ?? "save_draft";

  if (action === "restore") {
    await admin.from("hq_agent_config").delete().eq("status", "draft");
    const { config, status } = await loadDraftOrPublished(admin);
    return NextResponse.json({ ok: true, config, status });
  }

  const config = normalizeConfig(body.config);

  if (action === "publish") {
    // Upsert the published singleton and clear the draft.
    const { data: existing } = await admin.from("hq_agent_config").select("id").eq("status", "published").maybeSingle();
    if (existing) {
      await admin.from("hq_agent_config").update({ config, updated_by: userId, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await admin.from("hq_agent_config").insert({ status: "published", config, updated_by: userId });
    }
    await admin.from("hq_agent_config").delete().eq("status", "draft");
    return NextResponse.json({ ok: true, config, status: "published" });
  }

  // save_draft (default): upsert the draft singleton.
  const { data: existing } = await admin.from("hq_agent_config").select("id").eq("status", "draft").maybeSingle();
  if (existing) {
    await admin.from("hq_agent_config").update({ config, updated_by: userId, updated_at: new Date().toISOString() }).eq("id", existing.id);
  } else {
    await admin.from("hq_agent_config").insert({ status: "draft", config, updated_by: userId });
  }
  return NextResponse.json({ ok: true, config, status: "draft" });
}
