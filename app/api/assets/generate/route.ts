import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBrand } from "@/lib/data/brand";
import { anthropicComplete, moderateText, hasAnthropicKey, hasOpenAiKey } from "@/lib/server/llm";
import type { Json } from "@/types/database.types";

/**
 * POST /api/assets/generate — generate (or return a pre-generated) marketing asset
 * for a recommendation.
 *
 * Flow (docs/skills/data-flow-rules.md §5):
 *  1. Auth + resolve the caller's brand.
 *  2. Verify the recommendation belongs to the brand (RLS read, user-session client).
 *  3. If a pre-generated asset already exists → return it (no LLM call).
 *  4. Else draft with Claude Sonnet 4.6, run OpenAI Moderation, INSERT via RLS client.
 *     Flagged → stored but HELD (returns { flagged:true }), never delivered.
 *
 * Server-only. API keys via process.env (never exposed). All reads/writes use the
 * user-session client so Class-1 RLS scopes them to the brand.
 */

export const dynamic = "force-dynamic";

type AssetSection = { label: string; body: string };
type AssetContent = {
  sections: AssetSection[];
  channels?: string[];
  budget?: string;
};

export async function POST(req: Request) {
  await requireUser();

  // --- Parse + validate input -------------------------------------------------
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const recommendationId = (payload as { recommendationId?: unknown })?.recommendationId;
  const assetTypeRaw = (payload as { assetType?: unknown })?.assetType;
  if (typeof recommendationId !== "string" || !recommendationId) {
    return NextResponse.json({ ok: false, error: "recommendationId is required." }, { status: 400 });
  }
  const assetType = typeof assetTypeRaw === "string" && assetTypeRaw ? assetTypeRaw : "campaign_brief";

  const brand = await getCurrentBrand();
  if (!brand) {
    return NextResponse.json({ ok: false, error: "No brand configured." }, { status: 400 });
  }

  const supabase = createClient();

  // --- Verify the recommendation belongs to the brand (RLS read) --------------
  const { data: rec, error: recError } = await supabase
    .from("recommendations")
    .select("id, brand_id, headline, trigger_reason, evidence, category")
    .eq("id", recommendationId)
    .eq("brand_id", brand.id)
    .maybeSingle();

  if (recError) {
    return NextResponse.json({ ok: false, error: recError.message }, { status: 500 });
  }
  if (!rec) {
    return NextResponse.json({ ok: false, error: "Recommendation not found." }, { status: 404 });
  }

  // --- Pre-generated asset short-circuit --------------------------------------
  const { data: existing } = await supabase
    .from("generated_assets")
    .select("*")
    .eq("recommendation_id", recommendationId)
    .eq("brand_id", brand.id)
    .eq("is_pre_generated", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (existing.moderation_flagged) {
      return NextResponse.json({ ok: true, flagged: true });
    }
    return NextResponse.json({ ok: true, asset: existing });
  }

  // --- Missing-key guard (honest error, no fabricated asset) ------------------
  if (!hasAnthropicKey() || !hasOpenAiKey()) {
    return NextResponse.json(
      { ok: false, error: "AI not configured — asset generation is unavailable." },
      { status: 503 },
    );
  }

  // --- Draft with Claude Sonnet 4.6 -------------------------------------------
  const evidenceText = summariseEvidence(rec.evidence);
  const system =
    "You are a senior iGaming marketing strategist for a Nigerian/Kenyan/South African brand. " +
    "Draft an executable, compliant campaign brief responding to the competitive recommendation provided. " +
    "Respond with ONLY valid JSON of shape " +
    '{"sections":[{"label":string,"body":string}],"channels":string[],"budget":string}. ' +
    "Sections should cover objective, key message, audience, and execution steps. No markdown, no prose outside the JSON.";

  const userPrompt =
    `Recommendation headline: ${rec.headline}\n` +
    `Why it triggered: ${rec.trigger_reason}\n` +
    `Category: ${rec.category}\n` +
    `Evidence:\n${evidenceText || "(no structured evidence provided)"}`;

  const draft = await anthropicComplete({
    system,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: 2048,
  });

  if (!draft.ok) {
    const status = draft.reason === "not_configured" ? 503 : 502;
    const error =
      draft.reason === "not_configured"
        ? "AI not configured — asset generation is unavailable."
        : "Asset generation failed upstream. Please retry.";
    return NextResponse.json({ ok: false, error }, { status });
  }

  const content = parseAssetContent(draft.text);
  if (!content) {
    return NextResponse.json(
      { ok: false, error: "Asset draft was malformed. Please retry." },
      { status: 502 },
    );
  }

  const moderationText = contentToText(content);
  const wordCount = moderationText.split(/\s+/).filter(Boolean).length;

  // --- Moderation gate --------------------------------------------------------
  const moderation = await moderateText(moderationText);
  if (!moderation.ok) {
    const status = moderation.reason === "not_configured" ? 503 : 502;
    const error =
      moderation.reason === "not_configured"
        ? "AI not configured — moderation is unavailable."
        : "Moderation check failed. Asset not stored.";
    return NextResponse.json({ ok: false, error }, { status });
  }

  const title = deriveTitle(rec.headline);

  // --- Persist (RLS user-session client) --------------------------------------
  const { data: inserted, error: insertError } = await supabase
    .from("generated_assets")
    .insert({
      brand_id: brand.id,
      recommendation_id: recommendationId,
      asset_type: assetType,
      title,
      content: content as unknown as Json,
      word_count: wordCount,
      model_used: draft.model,
      moderation_flagged: moderation.flagged,
      moderation_checked_at: new Date().toISOString(),
      moderation_result: moderation.raw as Json,
      is_pre_generated: false,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { ok: false, error: insertError?.message ?? "Could not store the asset." },
      { status: 500 },
    );
  }

  // Flagged → stored but HELD, not delivered.
  if (moderation.flagged) {
    return NextResponse.json({ ok: true, flagged: true });
  }

  return NextResponse.json({ ok: true, asset: inserted });
}

function summariseEvidence(evidence: unknown): string {
  if (!Array.isArray(evidence)) return "";
  return evidence
    .slice(0, 8)
    .map((e) => {
      const item = e as Record<string, unknown>;
      const url = typeof item.source_url === "string" ? item.source_url : "";
      const text = typeof item.extracted_text === "string" ? item.extracted_text : "";
      return [text, url].filter(Boolean).join(" — ");
    })
    .filter(Boolean)
    .join("\n");
}

function parseAssetContent(raw: string): AssetContent | null {
  const jsonText = stripCodeFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }
  const sections = (parsed as { sections?: unknown }).sections;
  if (!Array.isArray(sections) || sections.length === 0) return null;

  const cleanSections: AssetSection[] = [];
  for (const s of sections) {
    const label = (s as { label?: unknown }).label;
    const body = (s as { body?: unknown }).body;
    if (typeof label === "string" && typeof body === "string") {
      cleanSections.push({ label, body });
    }
  }
  if (cleanSections.length === 0) return null;

  const channelsRaw = (parsed as { channels?: unknown }).channels;
  const channels = Array.isArray(channelsRaw)
    ? channelsRaw.filter((c): c is string => typeof c === "string")
    : undefined;
  const budgetRaw = (parsed as { budget?: unknown }).budget;
  const budget = typeof budgetRaw === "string" ? budgetRaw : undefined;

  return { sections: cleanSections, channels, budget };
}

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1].trim() : trimmed;
}

function contentToText(content: AssetContent): string {
  const parts = content.sections.map((s) => `${s.label}: ${s.body}`);
  if (content.channels?.length) parts.push(`Channels: ${content.channels.join(", ")}`);
  if (content.budget) parts.push(`Budget: ${content.budget}`);
  return parts.join("\n");
}

function deriveTitle(headline: string): string {
  const collapsed = headline.replace(/\s+/g, " ").trim();
  if (collapsed.length <= 80) return collapsed;
  return `${collapsed.slice(0, 77).trimEnd()}…`;
}
