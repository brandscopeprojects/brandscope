import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentBrand } from "@/lib/data/brand";
import {
  anthropicComplete,
  moderateText,
  hasAnthropicKey,
  hasOpenAiKey,
  CLAUDE_SONNET_MODEL,
} from "@/lib/server/llm";
import { resolveModel } from "@/lib/server/model-router";
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

// Per-type drafting spec. Every asset shares the same JSON shape
// ({sections, channels?, budget?}) so the parser + UI are unchanged; only the
// drafting INSTRUCTION differs per type. asset_type must match the
// generated_assets CHECK constraint (schema). iGaming compliance rules
// (no fabricated bonus figures; responsible-gambling awareness) apply to all.
const ASSET_SPECS: Record<string, { label: string; instruction: string }> = {
  campaign_brief: {
    label: "Campaign brief",
    instruction:
      "an executable campaign brief. Sections must cover Objective, Key message, Target audience, and Execution steps. Populate channels[] and budget with a sensible split.",
  },
  ad_copy: {
    label: "Ad copy",
    instruction:
      "paid ad copy. Produce 2–3 variants; make each variant a section labelled 'Variant A/B/C' whose body contains a headline, primary text (<=125 words) and a call-to-action. Populate channels[] with the ad platforms.",
  },
  email: {
    label: "Email",
    instruction:
      "a marketing email. Sections: 'Subject line' (with 1 alternative), 'Preheader', 'Body' (skimmable, one clear CTA), 'CTA button'. channels[] = ['Email'].",
  },
  sms: {
    label: "SMS",
    instruction:
      "SMS campaign copy. Produce 2 variants as sections 'Variant A/B', each <=160 characters, with the sender-compliant opt-out note. channels[] = ['SMS'].",
  },
  push_notification: {
    label: "Push notification",
    instruction:
      "push-notification copy. 2 variants as sections; each body has a title (<=40 chars) and message (<=120 chars). channels[] = ['Push'].",
  },
  whatsapp: {
    label: "WhatsApp message",
    instruction:
      "a WhatsApp broadcast message — conversational, compliant, one CTA link placeholder. Sections: 'Message', 'Follow-up'. channels[] = ['WhatsApp'].",
  },
  social_post: {
    label: "Social post",
    instruction:
      "organic social posts. One section per platform (Instagram, X, Facebook) with caption + hashtags tailored to each. channels[] = the platforms.",
  },
  seo_brief: {
    label: "SEO brief",
    instruction:
      "an SEO content brief. Sections: 'Target keywords', 'Working title', 'Outline (H2s)', 'Entities to cover', 'Meta description'. Omit budget.",
  },
  spend_memo: {
    label: "Spend memo",
    instruction:
      "a marketing-spend reallocation memo. Sections: 'Recommendation', 'Where to shift spend', 'Rationale', 'Expected impact'. Use budget for the proposed split.",
  },
  team_brief: {
    label: "Team brief",
    instruction:
      "an internal team action brief. Sections: 'What happened', 'Response', 'Owners & deadlines', 'Success metric'. Omit budget/channels.",
  },
  report: {
    label: "Report",
    instruction:
      "a concise written report. Sections: 'Summary', 'What we found', 'Why it matters', 'Recommended next step'. Omit budget/channels.",
  },
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
  if (!ASSET_SPECS[assetType]) {
    return NextResponse.json(
      { ok: false, error: `Unsupported asset type. Choose one of: ${Object.keys(ASSET_SPECS).join(", ")}.` },
      { status: 400 },
    );
  }

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
    .eq("asset_type", assetType)
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
  const markets = brand.market.join(", ");
  const spec = ASSET_SPECS[assetType];
  const system =
    (markets
      ? `You are a senior iGaming marketing strategist for the brand "${brand.name}" competing in ${markets}. `
      : `You are a senior iGaming marketing strategist for the brand "${brand.name}". `) +
    `Draft ${spec.instruction} ` +
    "It must respond directly to the competitive recommendation provided and be executable as-is. " +
    "Compliance is mandatory: never state exact competitor bonus amounts or wagering requirements, keep claims substantiable, and include a brief responsible-gambling note where a consumer-facing message invites play. " +
    "Respond with ONLY valid JSON of shape " +
    '{"sections":[{"label":string,"body":string}],"channels":string[],"budget":string}. ' +
    "Use channels[] and budget only where the asset type calls for them (omit or leave empty otherwise). No markdown, no prose outside the JSON.";

  const userPrompt =
    `Recommendation headline: ${rec.headline}\n` +
    `Why it triggered: ${rec.trigger_reason}\n` +
    `Category: ${rec.category}\n` +
    `Evidence:\n${evidenceText || "(no structured evidence provided)"}`;

  // Runtime model router (model_router_config is service-role-only → admin client).
  const model = await resolveModel(createAdminClient(), "asset_generation", CLAUDE_SONNET_MODEL);

  const draft = await anthropicComplete({
    system,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: 2048,
    model,
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

  const title = deriveTitle(`${spec.label}: ${rec.headline}`);

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
