// Haiku extraction for the App-Store Researcher. Two structured jobs run off the
// raw DataForSEO app data, both via loggedLlm (Rule 4 — every LLM call writes
// agent_job_logs, agent_name 'researcher', task_type 'app_store', with a
// data_quality_score). Reviews are UNTRUSTED third-party text → wrapped with
// asUntrustedData before they ever enter the prompt (guard.ts).
//
// HARD RULE: never fabricate numbers. Bonus amounts (amountKobo / wagering) stay
// null unless a verbatim figure appears in the source text. Vertical statuses are
// constrained to 'active'|'growing'|'declining'|'absent'.

import { MODELS } from "../_shared/contracts.ts";
import { loggedLlm, callClaude, parseJsonFromModel } from "../_shared/llm.ts";
import { asUntrustedData } from "../_shared/guard.ts";
import type { SupabaseClient } from "../_shared/supabase.ts";
import type { AppInfo, AppReview } from "./dfs-app.ts";

export type VerticalStatus = "active" | "growing" | "declining" | "absent";

export type ComplaintTheme = { theme: string; count: number; sentiment: number | null };

export type ReviewExtraction = {
  complaint_themes: ComplaintTheme[];
  /** Overall app-review sentiment, -1..1. null when not enough signal. */
  sentiment_score: number | null;
  /** Distinct new-feature mentions surfaced by reviewers. */
  new_feature_mentions: string[];
};

export type ProductExtraction = {
  sports_betting_status: VerticalStatus;
  casino_status: VerticalStatus;
  crash_games_status: VerticalStatus;
  lottery_status: VerticalStatus;
  aviator_promo_active: boolean;
  aviator_bonus_structure: {
    headline?: string;
    amountKobo?: number;
    wageringRequirement?: number;
    promoType?: string;
  } | null;
  /** Newly detected products/features from store metadata + release notes. */
  new_products_detected: string[];
};

const VALID: VerticalStatus[] = ["active", "growing", "declining", "absent"];
function coerceVertical(v: unknown): VerticalStatus {
  return typeof v === "string" && (VALID as string[]).includes(v) ? (v as VerticalStatus) : "absent";
}

type LlmCtx = { scanJobId: string; brandId: string; competitorId: string };

/**
 * Job 1 — reviews → complaint themes, overall sentiment, new-feature mentions.
 * Returns a neutral empty extraction when there are no reviews (no LLM call).
 */
export async function extractFromReviews(
  sb: SupabaseClient,
  ctx: LlmCtx,
  reviews: AppReview[],
): Promise<ReviewExtraction> {
  if (reviews.length === 0) {
    return { complaint_themes: [], sentiment_score: null, new_feature_mentions: [] };
  }

  // Cap and compact the corpus we feed the model (budget + token control).
  const corpus = reviews
    .slice(0, 200)
    .map((r, i) => `[#${i + 1} ${r.store} ${r.rating ?? "?"}★] ${r.text.slice(0, 400)}`)
    .join("\n");

  const dataQuality = Math.min(1, reviews.length / 100);

  const system =
    "You are a product-intelligence analyst for an iGaming brand. You extract " +
    "structured signals from app-store reviews. Return STRICT JSON only — no prose. " +
    "Base every field strictly on the review text provided. Never invent numbers.";

  const prompt = [
    "Analyse the app reviews below and return JSON with exactly these keys:",
    '{"complaint_themes":[{"theme":string,"count":number,"sentiment":number}],',
    '"sentiment_score":number,"new_feature_mentions":[string]}',
    "- complaint_themes: recurring complaints; count = how many reviews mention it; " +
      "sentiment = -1..1 for that theme (more negative = worse). Max 8 themes.",
    "- sentiment_score: overall sentiment of ALL reviews, -1 (very negative) .. 1 (very positive).",
    "- new_feature_mentions: distinct new features/products reviewers reference. [] if none.",
    "Use null for sentiment_score only if there is genuinely no signal.",
    "",
    asUntrustedData("app_reviews", corpus),
  ].join("\n");

  const r = await loggedLlm(
    sb,
    {
      scan_job_id: ctx.scanJobId,
      brand_id: ctx.brandId,
      agent_name: "researcher",
      task_type: "app_store",
      prompt_version: "app-store-reviews-v1",
      data_quality_score: dataQuality,
      input_snapshot: { competitor_id: ctx.competitorId, review_count: reviews.length },
    },
    () =>
      callClaude({
        model: MODELS.haiku,
        system,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 1200,
      }),
  );

  try {
    const parsed = parseJsonFromModel<Record<string, unknown>>(r.text);
    const themes = Array.isArray(parsed.complaint_themes) ? parsed.complaint_themes : [];
    return {
      complaint_themes: themes
        .map((t) => normaliseTheme(t))
        .filter((t): t is ComplaintTheme => t !== null)
        .slice(0, 8),
      sentiment_score: clampSentiment(parsed.sentiment_score),
      new_feature_mentions: toStringArray(parsed.new_feature_mentions).slice(0, 12),
    };
  } catch (_e) {
    return { complaint_themes: [], sentiment_score: null, new_feature_mentions: [] };
  }
}

/**
 * Job 2 — store metadata (title/categories/description/release notes) + vertical
 * keyword signals → vertical statuses, aviator promo signal, new products.
 * Returns an all-'absent' extraction with no LLM call when there is no app info.
 */
export async function extractProductSignals(
  sb: SupabaseClient,
  ctx: LlmCtx,
  info: AppInfo | null,
  verticalKeywords: string[],
  reviewFeatureMentions: string[],
): Promise<ProductExtraction> {
  const empty: ProductExtraction = {
    sports_betting_status: "absent",
    casino_status: "absent",
    crash_games_status: "absent",
    lottery_status: "absent",
    aviator_promo_active: false,
    aviator_bonus_structure: null,
    new_products_detected: [],
  };
  if (!info) return empty;

  const metaParts = [
    info.title ? `TITLE: ${info.title}` : "",
    info.categories.length ? `CATEGORIES: ${info.categories.join(", ")}` : "",
    info.description ? `DESCRIPTION: ${info.description.slice(0, 1500)}` : "",
    info.releaseNotes ? `RELEASE_NOTES: ${info.releaseNotes.slice(0, 800)}` : "",
    verticalKeywords.length ? `RANKED_KEYWORDS: ${verticalKeywords.slice(0, 40).join(", ")}` : "",
    reviewFeatureMentions.length ? `REVIEW_FEATURE_MENTIONS: ${reviewFeatureMentions.join(", ")}` : "",
  ].filter(Boolean).join("\n");

  const system =
    "You are a product-intelligence analyst for an iGaming brand. You classify a " +
    "competitor's app verticals and promo signals from store metadata. Return STRICT " +
    "JSON only. NEVER invent monetary amounts — leave amountKobo/wageringRequirement " +
    "out unless a verbatim figure is present in the source text.";

  const prompt = [
    "From the app metadata below, return JSON with exactly these keys:",
    '{"sports_betting_status":"active|growing|declining|absent",',
    '"casino_status":"active|growing|declining|absent",',
    '"crash_games_status":"active|growing|declining|absent",',
    '"lottery_status":"active|growing|declining|absent",',
    '"aviator_promo_active":boolean,',
    '"aviator_bonus_structure":null OR {"headline":string,"amountKobo":number,"wageringRequirement":number,"promoType":string},',
    '"new_products_detected":[string]}',
    "Rules:",
    "- A vertical is 'absent' unless the metadata clearly indicates the app offers it.",
    "- 'crash_games' covers Aviator/JetX/Spaceman-style instant crash games.",
    "- aviator_promo_active=true only if metadata/release notes mention an Aviator/crash promo.",
    "- aviator_bonus_structure: include ONLY fields actually stated. Omit amountKobo and",
    "  wageringRequirement entirely unless a real figure appears (no guesses). null if no promo.",
    "- new_products_detected: new features/products from release notes or keywords. [] if none.",
    "",
    asUntrustedData("app_store_metadata", metaParts),
  ].join("\n");

  const r = await loggedLlm(
    sb,
    {
      scan_job_id: ctx.scanJobId,
      brand_id: ctx.brandId,
      agent_name: "researcher",
      task_type: "app_store",
      prompt_version: "app-store-product-v1",
      data_quality_score: 1,
      input_snapshot: { competitor_id: ctx.competitorId, app_id: info.ref.appId },
    },
    () =>
      callClaude({
        model: MODELS.haiku,
        system,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 800,
      }),
  );

  try {
    const p = parseJsonFromModel<Record<string, unknown>>(r.text);
    return {
      sports_betting_status: coerceVertical(p.sports_betting_status),
      casino_status: coerceVertical(p.casino_status),
      crash_games_status: coerceVertical(p.crash_games_status),
      lottery_status: coerceVertical(p.lottery_status),
      aviator_promo_active: p.aviator_promo_active === true,
      aviator_bonus_structure: normaliseBonus(p.aviator_bonus_structure),
      new_products_detected: toStringArray(p.new_products_detected).slice(0, 12),
    };
  } catch (_e) {
    return empty;
  }
}

// ── normalisers ────────────────────────────────────────────────────────────────
function normaliseTheme(raw: unknown): ComplaintTheme | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const theme = typeof r.theme === "string" ? r.theme.trim() : "";
  if (!theme) return null;
  const count = typeof r.count === "number" && Number.isFinite(r.count) ? Math.max(0, Math.round(r.count)) : 0;
  return { theme, count, sentiment: clampSentiment(r.sentiment) };
}

function clampSentiment(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.max(-1, Math.min(1, v));
}

/** Keep only explicitly-present bonus fields; drop fabricated/placeholder numbers. */
function normaliseBonus(raw: unknown): ProductExtraction["aviator_bonus_structure"] {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out: NonNullable<ProductExtraction["aviator_bonus_structure"]> = {};
  if (typeof r.headline === "string" && r.headline.trim()) out.headline = r.headline.trim();
  if (typeof r.amountKobo === "number" && Number.isFinite(r.amountKobo) && r.amountKobo > 0) {
    out.amountKobo = Math.round(r.amountKobo);
  }
  if (typeof r.wageringRequirement === "number" && Number.isFinite(r.wageringRequirement) && r.wageringRequirement > 0) {
    out.wageringRequirement = r.wageringRequirement;
  }
  if (typeof r.promoType === "string" && r.promoType.trim()) out.promoType = r.promoType.trim();
  return Object.keys(out).length > 0 ? out : null;
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of v) {
    const s = typeof x === "string" ? x.trim() : "";
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
  }
  return out;
}

/**
 * Odds-competitiveness heuristic in code (NOT from the LLM). Derived from real
 * signals: average app rating × 20 nudged by sports-betting status. Returns null
 * when there's no rating to anchor on (no fabricated score).
 */
export function computeOddsCompetitiveness(
  rating: number | null,
  sportsStatus: VerticalStatus,
): number | null {
  if (rating == null) return null;
  let score = Math.max(0, Math.min(100, rating * 20)); // 5★ → 100
  if (sportsStatus === "growing" || sportsStatus === "active") score = Math.min(100, score + 5);
  if (sportsStatus === "declining") score = Math.max(0, score - 5);
  return Math.round(score);
}
