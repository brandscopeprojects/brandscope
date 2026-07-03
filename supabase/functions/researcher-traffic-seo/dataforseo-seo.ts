// SEO-specific DataForSEO Labs helpers for researcher-traffic-seo.
// Scoped to this function only (file ownership). Uses the shared dfsPost/firstResult
// client (../_shared/dataforseo.ts). DataForSEO Labs Google endpoints take a `[ {task} ]`
// array body with `location_code`/`language_code` (or location_name) and `target`/`targets`.
// All responses are tolerated for missing fields — partial data is fine, fabrication is not.
//
// Endpoints used (mvp-module-sources.md §1 SEO):
//   dataforseo_labs/google/bulk_traffic_estimation/live   → estimated monthly traffic + organic/paid split
//   dataforseo_labs/google/domain_intersection/live       → keyword gaps competitor-vs-brand (both rank)
//   dataforseo_labs/google/competitors_domain/live        → competitor overlap (brandRank null gaps)
//   dataforseo_labs/google/ranked_keywords/live           → competitor SERP positions + ranking URLs
//   keywords_data/google_ads/search_volume/live           → search volume backfill for gap keywords

import { dfsPost, firstResult, locationCode } from "../_shared/dataforseo.ts";
import type { KeywordGap, SerpPosition } from "./types.ts";

// Location resolution lives in _shared/dataforseo.ts (MARKET_LOCATION, keyed by
// brands.market values e.g. 'nigeria'). Re-exported for this function's index.ts.
export { locationCode };

const LANGUAGE = "en";

// ── number coercion (tolerate strings / missing) ─────────────────────────────
function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

// ── 1. Bulk traffic estimation: estimated traffic + organic/paid split ────────
export type TrafficEstimate = {
  estimatedTraffic: number | null;
  organicTraffic: number | null;
  paidTraffic: number | null;
};

/** bulk_traffic_estimation/live for one domain. Tolerates the metrics shape. */
export async function fetchTrafficEstimate(
  domain: string,
  location: number,
): Promise<TrafficEstimate> {
  const body = await dfsPost(
    "dataforseo_labs/google/bulk_traffic_estimation/live",
    [{ targets: [domain], location_code: location, language_code: LANGUAGE }],
  );
  const items = firstResult<Record<string, unknown>>(
    body as { tasks?: Array<{ result?: Record<string, unknown>[] }> },
  );
  // Result rows carry `items[]` each with `metrics.organic.etv` / `metrics.paid.etv`.
  const first = items[0] ?? {};
  const row =
    (Array.isArray(first.items) ? (first.items[0] as Record<string, unknown>) : first) ?? {};
  const metrics = (row.metrics ?? {}) as Record<string, unknown>;
  const organic = metrics.organic as Record<string, unknown> | undefined;
  const paid = metrics.paid as Record<string, unknown> | undefined;

  const organicTraffic = organic ? num(organic.etv) : null;
  const paidTraffic = paid ? num(paid.etv) : null;
  const estimatedTraffic =
    organicTraffic == null && paidTraffic == null
      ? null
      : Math.round((organicTraffic ?? 0) + (paidTraffic ?? 0));

  return {
    estimatedTraffic,
    organicTraffic: organicTraffic == null ? null : Math.round(organicTraffic),
    paidTraffic: paidTraffic == null ? null : Math.round(paidTraffic),
  };
}

// ── 2. Domain intersection: keyword gaps where BOTH rank (brandRank present) ──
/** domain_intersection/live — keywords both `target1` (competitor) and `target2` (brand) rank for. */
export async function fetchKeywordIntersection(
  competitorDomain: string,
  brandDomain: string,
  location: number,
  limit = 200,
): Promise<KeywordGap[]> {
  const body = await dfsPost(
    "dataforseo_labs/google/domain_intersection/live",
    [{
      target1: competitorDomain,
      target2: brandDomain,
      location_code: location,
      language_code: LANGUAGE,
      intersections: true,
      limit,
      order_by: ["keyword_data.keyword_info.search_volume,desc"],
    }],
  );
  const items = firstResult<Record<string, unknown>>(
    body as { tasks?: Array<{ result?: Record<string, unknown>[] }> },
  );
  const rows = Array.isArray(items[0]?.items)
    ? (items[0].items as Record<string, unknown>[])
    : [];

  return rows.map((r) => parseIntersectionRow(r)).filter((g): g is KeywordGap => g !== null);
}

/** Row shape: { keyword_data:{keyword, keyword_info:{search_volume, competition...}},
 *  first_domain_serp_element:{rank_group}, second_domain_serp_element:{rank_group} } */
function parseIntersectionRow(r: Record<string, unknown>): KeywordGap | null {
  const kd = (r.keyword_data ?? {}) as Record<string, unknown>;
  const keyword = str(kd.keyword);
  if (!keyword) return null;
  const ki = (kd.keyword_info ?? {}) as Record<string, unknown>;
  const first = (r.first_domain_serp_element ?? {}) as Record<string, unknown>;
  const second = (r.second_domain_serp_element ?? {}) as Record<string, unknown>;

  return {
    keyword,
    volume: num(ki.search_volume),
    competitorRank: num(first.rank_group ?? first.rank_absolute),
    brandRank: num(second.rank_group ?? second.rank_absolute),
    difficulty: keywordDifficulty(ki),
  };
}

// ── 3. Ranked keywords: competitor SERP positions + ranking URLs, and the gaps
//       where the BRAND does NOT rank (brandRank stays null) ───────────────────
export type RankedKeywordsResult = {
  serpPositions: SerpPosition[];
  /** Keyword gaps from the competitor's ranked keywords (brandRank null unless
   *  later merged with intersection data). */
  gaps: KeywordGap[];
};

/** ranked_keywords/live — keywords the competitor domain currently ranks for. */
export async function fetchRankedKeywords(
  competitorDomain: string,
  location: number,
  limit = 200,
): Promise<RankedKeywordsResult> {
  const body = await dfsPost(
    "dataforseo_labs/google/ranked_keywords/live",
    [{
      target: competitorDomain,
      location_code: location,
      language_code: LANGUAGE,
      limit,
      order_by: ["keyword_data.keyword_info.search_volume,desc"],
    }],
  );
  const items = firstResult<Record<string, unknown>>(
    body as { tasks?: Array<{ result?: Record<string, unknown>[] }> },
  );
  const rows = Array.isArray(items[0]?.items)
    ? (items[0].items as Record<string, unknown>[])
    : [];

  const serpPositions: SerpPosition[] = [];
  const gaps: KeywordGap[] = [];

  for (const r of rows) {
    const kd = (r.keyword_data ?? {}) as Record<string, unknown>;
    const keyword = str(kd.keyword);
    if (!keyword) continue;
    const ki = (kd.keyword_info ?? {}) as Record<string, unknown>;
    const serp = (r.ranked_serp_element ?? {}) as Record<string, unknown>;
    const el = (serp.serp_item ?? {}) as Record<string, unknown>;
    const position = num(el.rank_group ?? el.rank_absolute);
    const url = str(el.url);

    serpPositions.push({ keyword, position, url });
    gaps.push({
      keyword,
      volume: num(ki.search_volume),
      competitorRank: position,
      brandRank: null, // unknown from this endpoint; intersection fills it where both rank
      difficulty: keywordDifficulty(ki),
    });
  }

  return { serpPositions, gaps };
}

// ── 4. Search volume backfill (keywords_data/google_ads/search_volume/live) ───
/** Backfill search_volume for gap keywords that came back without volume. */
export async function fetchSearchVolumes(
  keywords: string[],
  location: number,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (keywords.length === 0) return out;
  // Google Ads search_volume accepts up to ~1000 keywords per task; cap to be safe.
  const capped = keywords.slice(0, 700);
  const body = await dfsPost(
    "keywords_data/google_ads/search_volume/live",
    [{ keywords: capped, location_code: location, language_code: LANGUAGE }],
  );
  const items = firstResult<Record<string, unknown>>(
    body as { tasks?: Array<{ result?: Record<string, unknown>[] }> },
  );
  for (const r of items) {
    const kw = str(r.keyword);
    const vol = num(r.search_volume);
    if (kw && vol != null) out.set(kw.toLowerCase(), vol);
  }
  return out;
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Approximate keyword difficulty (0–100) from DataForSEO competition signals.
 *  Prefers an explicit `keyword_difficulty`/`competition_index`, else derives
 *  from the 0–1 `competition` float. Null when no signal. */
function keywordDifficulty(ki: Record<string, unknown>): number | null {
  const kd = num(ki.keyword_difficulty);
  if (kd != null) return Math.round(kd);
  const ci = num(ki.competition_index);
  if (ci != null) return Math.round(ci);
  const c = num(ki.competition);
  if (c != null) return Math.round(c * 100);
  return null;
}

/** Merge competitor ranked-keyword gaps with intersection gaps (which carry the
 *  brandRank), dedup by keyword, prefer the richest row, backfill volumes, sort
 *  by volume desc. Matches lib/data/traffic-seo.ts KeywordGap element shape. */
export function mergeKeywordGaps(
  rankedGaps: KeywordGap[],
  intersectionGaps: KeywordGap[],
  volumes: Map<string, number>,
  cap = 100,
): KeywordGap[] {
  const byKw = new Map<string, KeywordGap>();
  // Intersection rows first (authoritative brandRank), then ranked-keyword rows.
  for (const g of [...intersectionGaps, ...rankedGaps]) {
    const key = g.keyword.toLowerCase();
    const existing = byKw.get(key);
    const volume = g.volume ?? volumes.get(key) ?? existing?.volume ?? null;
    if (!existing) {
      byKw.set(key, { ...g, volume });
      continue;
    }
    // Merge: keep brandRank if either has it; prefer non-null fields.
    byKw.set(key, {
      keyword: existing.keyword,
      volume,
      competitorRank: existing.competitorRank ?? g.competitorRank,
      brandRank: existing.brandRank ?? g.brandRank,
      difficulty: existing.difficulty ?? g.difficulty,
    });
  }
  return Array.from(byKw.values())
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, cap);
}

/** Organic / paid share percentages (0–100) from the traffic split, or null. */
export function trafficSplitPct(
  organic: number | null,
  paid: number | null,
): { organicPct: number | null; paidPct: number | null } {
  if (organic == null && paid == null) return { organicPct: null, paidPct: null };
  const total = (organic ?? 0) + (paid ?? 0);
  if (total <= 0) return { organicPct: null, paidPct: null };
  return {
    organicPct: Math.round(((organic ?? 0) / total) * 100),
    paidPct: Math.round(((paid ?? 0) / total) * 100),
  };
}
