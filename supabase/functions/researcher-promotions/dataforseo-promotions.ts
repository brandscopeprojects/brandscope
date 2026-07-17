// Promotion-SIGNALS DataForSEO helpers for researcher-promotions.
// Scoped to this function only (file ownership). Uses the shared dfsPost/firstResult
// client (../_shared/dataforseo.ts). DataForSEO ONLY — NO Firecrawl/Apify.
//
// SIGNALS ONLY policy (mvp-module-sources.md §8 Promotions): these helpers surface
// the EXISTENCE / TYPE / NOVELTY of a promo, a candidate promo title + URL, and the
// DIRECTION of bonus-keyword search-volume movement (a permitted % delta). They NEVER
// return an exact bonus amount or wagering requirement — those columns stay null.
//
// Endpoints used (all DataForSEO, all NG-betting scoped by default):
//   content_analysis/search/live                  → bonus MENTIONS across NG betting content (citations)
//   serp/google/news/live/advanced                → promo ANNOUNCEMENTS (news items)
//   keywords_data/google_ads/search_volume/live   → bonus-keyword search volume (WoW movement → directional signal)
//
// All responses tolerate missing fields — partial data is fine, fabrication is not.

import { dfsPost, firstResult, locationCode } from "../_shared/dataforseo.ts";

// Location resolution lives in _shared/dataforseo.ts (MARKET_LOCATION, keyed by
// brands.market values e.g. 'nigeria'). Re-exported for this function's index.ts.
export { locationCode };

// Bonus-keyword set used to probe promo intensity. These are TOPIC keywords (the
// % movement of their search volume is a directional signal); none of these read
// out an exact bonus amount.
const BONUS_KEYWORD_TEMPLATES = [
  "bonus",
  "welcome bonus",
  "free bet",
  "deposit bonus",
  "cashback",
  "odds boost",
  "accumulator bonus",
  "promo code",
];

// ── number / string coercion (tolerate strings / missing) ────────────────────
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

/** Brand label for a competitor domain (strip scheme + www + TLD path). */
function brandLabel(domain: string): string {
  return (domain || "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? domain;
}

// ── 1. Content Analysis: bonus MENTIONS across NG betting content ─────────────
export type ContentMention = {
  text: string; // snippet / title (mention text — NOT an exact amount)
  url: string | null; // citation URL → source_url / promo_url candidate
  timestamp: string | null; // content publication time (content_info.timestamp) — freshness gate
};

/**
 * content_analysis/search/live — find betting content that mentions the competitor
 * alongside bonus terms. Returns citation snippets + URLs (mention SIGNALS only).
 * The DataForSEO keyword combines the competitor brand label with bonus terms.
 */
export async function fetchBonusMentions(
  competitorDomain: string,
  competitorName: string,
  location: number,
  limit = 20,
  language = "en",
): Promise<ContentMention[]> {
  const label = competitorName?.trim() || brandLabel(competitorDomain);
  const keyword = `${label} bonus OR "free bet" OR promo`;
  const body = await dfsPost(
    "content_analysis/search/live",
    [{
      keyword,
      location_code: location,
      language_code: language,
      limit,
      order_by: ["content_info.timestamp,desc"],
    }],
  );
  const items = firstResult<Record<string, unknown>>(
    body as { tasks?: Array<{ result?: Record<string, unknown>[] }> },
  );
  // result[0].items[] — each item carries page/content info with title + url.
  const rows = Array.isArray(items[0]?.items)
    ? (items[0].items as Record<string, unknown>[])
    : [];

  const out: ContentMention[] = [];
  for (const r of rows) {
    const ci = (r.content_info ?? r.page_content ?? {}) as Record<string, unknown>;
    const main = (ci.main_topic ?? ci) as Record<string, unknown>;
    const text =
      str(r.snippet) ??
      str(ci.title) ??
      str(main.title) ??
      str(r.title) ??
      null;
    const url = str(r.url) ?? str(ci.url) ?? str(r.page_url) ?? null;
    const timestamp = str(ci.timestamp) ?? str(main.timestamp) ?? str(r.timestamp) ?? null;
    if (text || url) out.push({ text: text ?? "", url, timestamp });
  }
  return out;
}

// ── 2. Google News: promo ANNOUNCEMENTS ──────────────────────────────────────
export type NewsItem = {
  title: string;
  url: string | null;
  timestamp: string | null;
};

/** serp/google/news/live/advanced — competitor promo announcements (news). */
export async function fetchPromoNews(
  competitorName: string,
  competitorDomain: string,
  location: number,
  limit = 15,
  language = "en",
): Promise<NewsItem[]> {
  const label = competitorName?.trim() || brandLabel(competitorDomain);
  const body = await dfsPost(
    "serp/google/news/live/advanced",
    [{
      keyword: `${label} bonus OR promo OR offer`,
      location_code: location,
      language_code: language,
      depth: limit,
    }],
  );
  const items = firstResult<Record<string, unknown>>(
    body as { tasks?: Array<{ result?: Record<string, unknown>[] }> },
  );
  const rows = Array.isArray(items[0]?.items)
    ? (items[0].items as Record<string, unknown>[])
    : [];

  const out: NewsItem[] = [];
  for (const r of rows) {
    if (str(r.type) && r.type !== "news_search" && r.type !== "news") {
      // skip non-news SERP features when the endpoint mixes types
    }
    const title = str(r.title);
    if (!title) continue;
    out.push({
      title,
      url: str(r.url) ?? str(r.source_url),
      timestamp: str(r.timestamp) ?? str(r.date),
    });
  }
  return out.slice(0, limit);
}

// ── 3. Bonus-keyword search-volume movement → DIRECTIONAL WoW signal ──────────
export type VolumeSnapshot = {
  /** Total monthly search volume across the bonus-keyword set (sum). */
  total: number | null;
  /** Most-recent-vs-prior-month % delta from DataForSEO's monthly_searches, if present. */
  monthlyDeltaPct: number | null;
};

/**
 * keywords_data/google_ads/search_volume/live — pull search volume for the
 * competitor-scoped bonus keywords. We compute a DIRECTIONAL movement signal:
 *  - `total`: summed current search_volume (used for week-over-week comparison in code)
 *  - `monthlyDeltaPct`: % change of the latest month vs the prior month (from the
 *    per-keyword `monthly_searches` history) — a permitted directional signal.
 * No exact bonus amount is derived here.
 */
export async function fetchBonusKeywordVolume(
  competitorName: string,
  competitorDomain: string,
  location: number,
  language = "en",
): Promise<VolumeSnapshot> {
  const label = competitorName?.trim() || brandLabel(competitorDomain);
  const keywords = BONUS_KEYWORD_TEMPLATES.map((t) => `${label} ${t}`).slice(0, 50);
  const body = await dfsPost(
    "keywords_data/google_ads/search_volume/live",
    [{ keywords, location_code: location, language_code: language }],
  );
  const items = firstResult<Record<string, unknown>>(
    body as { tasks?: Array<{ result?: Record<string, unknown>[] }> },
  );

  let total: number | null = null;
  let latestSum = 0;
  let priorSum = 0;
  let haveMonthly = false;

  for (const r of items) {
    const vol = num(r.search_volume);
    if (vol != null) total = (total ?? 0) + vol;

    // monthly_searches: [{ year, month, search_volume }, ...] newest-first or oldest-first.
    const monthly = Array.isArray(r.monthly_searches)
      ? (r.monthly_searches as Record<string, unknown>[])
      : [];
    if (monthly.length >= 2) {
      // Sort by (year, month) ascending then take last two.
      const sorted = [...monthly].sort((a, b) => {
        const ay = num(a.year) ?? 0, by = num(b.year) ?? 0;
        if (ay !== by) return ay - by;
        return (num(a.month) ?? 0) - (num(b.month) ?? 0);
      });
      const latest = num(sorted[sorted.length - 1]?.search_volume);
      const prior = num(sorted[sorted.length - 2]?.search_volume);
      if (latest != null && prior != null) {
        latestSum += latest;
        priorSum += prior;
        haveMonthly = true;
      }
    }
  }

  let monthlyDeltaPct: number | null = null;
  if (haveMonthly && priorSum > 0) {
    monthlyDeltaPct = Math.round(((latestSum - priorSum) / priorSum) * 1000) / 10; // 1dp
  }

  return { total, monthlyDeltaPct };
}

/**
 * Directional WoW % change of bonus-keyword interest vs the previous scan week's
 * recorded total. Falls back to the intra-source `monthlyDeltaPct` when no previous
 * week total is available. Returns null when neither signal exists. SIGNAL ONLY —
 * this is a % delta, never an amount.
 */
export function wowVolumeChangePct(
  current: VolumeSnapshot,
  previousTotal: number | null,
): number | null {
  if (current.total != null && previousTotal != null && previousTotal > 0) {
    return Math.round(((current.total - previousTotal) / previousTotal) * 1000) / 10;
  }
  return current.monthlyDeltaPct;
}
