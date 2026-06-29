import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBrand, type BrandSummary } from "@/lib/data/brand";
import type { Json } from "@/types/database.types";

export { getCurrentBrand, type BrandSummary } from "@/lib/data/brand";

// --- JSONB contracts (geo_cache) ---------------------------------------------
// These are the shapes the Sprint-3 GEO Researcher (DataForSEO AI Optimization)
// WRITES into the geo_cache jsonb columns. Documented here so the page can read
// them type-safely; the Researcher must satisfy these contracts on write.

/** geo_cache.competitor_ai_scores — WRITE TARGET (Sprint 3).
 *  One entry per competitor: their AI visibility score (0–100). */
export type CompetitorAIScore = {
  competitorName: string;
  score: number;
};

/** geo_cache.top_ai_mentions — WRITE TARGET (Sprint 3).
 *  Notable mentions of the brand surfaced by AI answer engines. */
export type TopAIMention = {
  platform: string;
  url: string;
  snippet?: string | null;
};

/** geo_cache.featured_snippets — WRITE TARGET (Sprint 3).
 *  Featured-snippet appearances feeding AI answers (AEO overlap). */
export type FeaturedSnippet = {
  query: string;
  url: string;
  snippet?: string | null;
};

// --- Normalized view model ----------------------------------------------------

export type GeoPlatform = {
  name: string;
  mentioned: boolean;
  position: number | null;
  sentiment: string | null;
  checkedAt: string | null;
  responseSample: string | null;
};

export type GeoData = {
  scanWeek: string;
  score: number | null;
  scoreChangeWow: number | null;
  platforms: GeoPlatform[];
  competitorScores: CompetitorAIScore[];
  topMentions: TopAIMention[];
  featuredSnippets: FeaturedSnippet[];
};

// The four MVP answer engines. Grok/Meta = Phase 2 (mvp-constraints §2) — the
// grok_* columns exist in geo_cache but are deliberately never surfaced here.
const PLATFORMS = [
  { name: "ChatGPT", prefix: "chatgpt" },
  { name: "Claude", prefix: "claude" },
  { name: "Gemini", prefix: "gemini" },
  { name: "Perplexity", prefix: "perplexity" },
] as const;

/** Latest per-brand geo_cache row mapped to a view model.
 *  geo_cache is PER-BRAND (brand_id + scan_week, no competitor_id).
 *  Returns null when no row exists yet (pre-first-scan empty state). */
export async function getGeoData(brand: BrandSummary): Promise<GeoData | null> {
  const supabase = createClient();

  const { data: cache } = await supabase
    .from("geo_cache")
    .select("*")
    .eq("brand_id", brand.id)
    .order("scan_week", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!cache) return null;

  const row = cache as Record<string, unknown>;

  const platforms: GeoPlatform[] = PLATFORMS.map(({ name, prefix }) => ({
    name,
    mentioned: (row[`${prefix}_mentioned`] as boolean | null) ?? false,
    position: (row[`${prefix}_position`] as number | null) ?? null,
    sentiment: (row[`${prefix}_sentiment`] as string | null) ?? null,
    checkedAt: (row[`${prefix}_checked_at`] as string | null) ?? null,
    responseSample: (row[`${prefix}_response_sample`] as string | null) ?? null,
  }));

  const competitorScores = jsonArray<CompetitorAIScore>(cache.competitor_ai_scores).filter(
    (c) => typeof c?.competitorName === "string" && typeof c?.score === "number",
  );
  const topMentions = jsonArray<TopAIMention>(cache.top_ai_mentions).filter(
    (m) => typeof m?.url === "string",
  );
  const featuredSnippets = jsonArray<FeaturedSnippet>(cache.featured_snippets).filter(
    (s) => typeof s?.url === "string",
  );

  return {
    scanWeek: cache.scan_week,
    score: cache.ai_visibility_score,
    scoreChangeWow: cache.score_change_wow,
    platforms,
    competitorScores,
    topMentions,
    featuredSnippets,
  };
}

function jsonArray<T>(value: Json | null | undefined): T[] {
  return Array.isArray(value) ? (value as unknown as T[]) : [];
}
