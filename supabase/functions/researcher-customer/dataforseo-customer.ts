// Customer-Intelligence DataForSEO helpers for researcher-customer (PARTIAL
// module, mvp-module-sources.md §6). Scoped to this function only (file
// ownership). Uses the shared dfsPost/firstResult client (../_shared/dataforseo.ts).
//
// DataForSEO ONLY — no Firecrawl/Apify/social. Every field is tolerated for
// missing data: partial data is fine, fabrication is NOT. Demographics / social
// are Phase 2 and never invented here.
//
// Endpoints used (mvp-module-sources.md §6 Customer):
//   dataforseo_labs/google/bulk_traffic_estimation/live  → traffic mix (organic/paid/referral signal)
//   content_analysis/search/live                          → brand-mention content corpus
//   content_analysis/sentiment_analysis/live              → sentiment distribution over mentions
//   dataforseo_labs/google/domain_intersection/live       → audience overlap (shared-keyword proxy)
//   dataforseo_labs/google/search_intent/live             → search-intent mix for the brand's keywords

import { dfsPost, firstResult, locationCode } from "../_shared/dataforseo.ts";

// Location resolution lives in _shared/dataforseo.ts (MARKET_LOCATION, keyed by
// brands.market values e.g. 'nigeria'). Re-exported for this function's index.ts.
export { locationCode };

// ── coercion helpers (tolerate strings / missing) ────────────────────────────
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

// ── 1. Bulk traffic estimation → traffic-channel mix signal ──────────────────
export type TrafficMix = {
  organic: number | null;
  paid: number | null;
  /** Total estimated traffic value (organic + paid), or null when neither known. */
  total: number | null;
};

/**
 * bulk_traffic_estimation/live for one domain — the organic/paid estimated
 * traffic value (etv). This is the ONLY traffic-channel signal DataForSEO gives
 * us at MVP; "referral / direct / social" channel splits are NOT available, so
 * we never invent them. Haiku turns this mix into traffic_sources[] downstream.
 */
export async function fetchTrafficMix(domain: string, location: number, language = "en"): Promise<TrafficMix> {
  const body = await dfsPost(
    "dataforseo_labs/google/bulk_traffic_estimation/live",
    [{ targets: [domain], location_code: location, language_code: language }],
  );
  const items = firstResult<Record<string, unknown>>(
    body as { tasks?: Array<{ result?: Record<string, unknown>[] }> },
  );
  const first = items[0] ?? {};
  const row =
    (Array.isArray(first.items) ? (first.items[0] as Record<string, unknown>) : first) ?? {};
  const metrics = (row.metrics ?? {}) as Record<string, unknown>;
  const organicM = metrics.organic as Record<string, unknown> | undefined;
  const paidM = metrics.paid as Record<string, unknown> | undefined;

  const organic = organicM ? num(organicM.etv) : null;
  const paid = paidM ? num(paidM.etv) : null;
  const total = organic == null && paid == null ? null : Math.round((organic ?? 0) + (paid ?? 0));
  return {
    organic: organic == null ? null : Math.round(organic),
    paid: paid == null ? null : Math.round(paid),
    total,
  };
}

// ── 2. Content analysis search + sentiment → mention corpus + distribution ───
export type ContentMention = {
  title: string | null;
  snippet: string | null;
  url: string | null;
  /** Per-item sentiment label if the search endpoint returns one. */
  sentiment: string | null;
};

export type SentimentDistribution = {
  /** Connotation share map, e.g. { positive: 0.4, negative: 0.35, neutral: 0.25 }. 0–1. */
  byConnotation: Record<string, number>;
  /** Total citations the distribution is built from (confidence signal). */
  totalCitations: number | null;
};

/**
 * content_analysis/search/live — content across the web mentioning the brand
 * keyword (here the competitor name/domain). Returns a small corpus of titles +
 * snippets + URLs that Haiku mines for recurring complaint themes. Untrusted
 * third-party text — the caller wraps it via asUntrustedData before any LLM call.
 */
export async function fetchContentMentions(
  keyword: string,
  location: number,
  limit = 30,
  language = "en",
): Promise<ContentMention[]> {
  const body = await dfsPost(
    "content_analysis/search/live",
    [{
      keyword,
      location_code: location,
      language_code: language,
      limit,
      order_by: ["content_info.sentiment_connotations,desc"],
      page_type: ["ecommerce", "news", "blogs", "message-boards", "organization", "review-sites"],
    }],
  );
  const items = firstResult<Record<string, unknown>>(
    body as { tasks?: Array<{ result?: Record<string, unknown>[] }> },
  );
  const rows = Array.isArray(items[0]?.items)
    ? (items[0].items as Record<string, unknown>[])
    : [];

  const out: ContentMention[] = [];
  for (const r of rows) {
    const ci = (r.content_info ?? {}) as Record<string, unknown>;
    const pageCat = (r.page_category ?? {}) as Record<string, unknown>;
    const title = str(r.title ?? ci.title);
    const snippet = str(ci.snippet ?? ci.text ?? r.snippet);
    const url = str(r.url ?? r.domain);
    // Strongest connotation label, if present.
    const connotations = (ci.sentiment_connotations ?? {}) as Record<string, unknown>;
    let sentiment: string | null = null;
    let best = -Infinity;
    for (const [k, v] of Object.entries(connotations)) {
      const n = num(v);
      if (n != null && n > best) {
        best = n;
        sentiment = k;
      }
    }
    if (title || snippet) {
      out.push({ title, snippet, url, sentiment: sentiment ?? str(pageCat.primary_category) });
    }
  }
  return out;
}

/**
 * content_analysis/sentiment_analysis/live — aggregate connotation distribution
 * over content mentioning the keyword. Gives an objective sentiment signal that
 * Haiku reconciles with the mention corpus into a single sentiment_score.
 */
export async function fetchSentimentDistribution(
  keyword: string,
  location: number,
  language = "en",
): Promise<SentimentDistribution> {
  const body = await dfsPost(
    "content_analysis/sentiment_analysis/live",
    [{ keyword, location_code: location, language_code: language }],
  );
  const items = firstResult<Record<string, unknown>>(
    body as { tasks?: Array<{ result?: Record<string, unknown>[] }> },
  );
  const first = (items[0] ?? {}) as Record<string, unknown>;
  const raw = (first.sentiment_connotations ?? {}) as Record<string, unknown>;
  const byConnotation: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = num(v);
    if (n != null) byConnotation[k] = n;
  }
  return { byConnotation, totalCitations: num(first.total_count ?? first.citations) };
}

// ── 3. Domain intersection → audience-overlap proxy ──────────────────────────
export type AudienceOverlap = {
  /** Count of keywords both the brand and competitor rank for (shared-audience proxy). */
  sharedKeywords: number | null;
};

/**
 * domain_intersection/live — number of keywords the competitor and the brand
 * both rank for. There is NO exact-audience-overlap API at MVP; shared search
 * demand is the closest legitimate proxy. Used only as a low-confidence signal
 * for Haiku; it is NEVER rendered as an exact audience-overlap percentage.
 */
export async function fetchAudienceOverlap(
  competitorDomain: string,
  brandDomain: string,
  location: number,
  limit = 100,
  language = "en",
): Promise<AudienceOverlap> {
  const body = await dfsPost(
    "dataforseo_labs/google/domain_intersection/live",
    [{
      target1: competitorDomain,
      target2: brandDomain,
      location_code: location,
      language_code: language,
      intersections: true,
      limit,
    }],
  );
  const items = firstResult<Record<string, unknown>>(
    body as { tasks?: Array<{ result?: Record<string, unknown>[] }> },
  );
  const first = (items[0] ?? {}) as Record<string, unknown>;
  const total = num(first.total_count);
  if (total != null) return { sharedKeywords: total };
  const rows = Array.isArray(first.items) ? (first.items as unknown[]) : [];
  return { sharedKeywords: rows.length > 0 ? rows.length : null };
}

// ── 4. Search intent → intent mix for the competitor's ranked keywords ───────
export type SearchIntentMix = {
  /** intent label → share 0–1 (e.g. { informational: 0.5, commercial: 0.2, ... }). */
  byIntent: Record<string, number>;
};

/**
 * search_intent/live — classifies a set of keywords by search intent
 * (informational / navigational / commercial / transactional). We feed the
 * competitor's top ranked keywords; the resulting mix is a structured signal
 * stored in raw_data and given to Haiku (it never becomes a fake demographic).
 */
export async function fetchSearchIntent(
  keywords: string[],
  location: number,
  language = "en",
): Promise<SearchIntentMix> {
  const capped = keywords.filter((k) => k && k.length > 0).slice(0, 100);
  if (capped.length === 0) return { byIntent: {} };
  const body = await dfsPost(
    "dataforseo_labs/google/search_intent/live",
    [{ keywords: capped, location_code: location, language_code: language }],
  );
  const items = firstResult<Record<string, unknown>>(
    body as { tasks?: Array<{ result?: Record<string, unknown>[] }> },
  );
  const rows = Array.isArray(items[0]?.items)
    ? (items[0].items as Record<string, unknown>[])
    : (items as Record<string, unknown>[]);

  const counts: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    const ki = (r.keyword_intent ?? r.search_intent_info ?? {}) as Record<string, unknown>;
    const label = str(ki.label ?? ki.main_intent ?? r.label);
    if (!label) continue;
    counts[label] = (counts[label] ?? 0) + 1;
    total += 1;
  }
  const byIntent: Record<string, number> = {};
  if (total > 0) {
    for (const [k, v] of Object.entries(counts)) byIntent[k] = Number((v / total).toFixed(3));
  }
  return { byIntent };
}

/** A competitor's top ranked keywords (search-intent input). ranked_keywords/live. */
export async function fetchTopRankedKeywords(
  domain: string,
  location: number,
  limit = 100,
  language = "en",
): Promise<string[]> {
  const body = await dfsPost(
    "dataforseo_labs/google/ranked_keywords/live",
    [{
      target: domain,
      location_code: location,
      language_code: language,
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
  const out: string[] = [];
  for (const r of rows) {
    const kd = (r.keyword_data ?? {}) as Record<string, unknown>;
    const kw = str(kd.keyword);
    if (kw) out.push(kw);
  }
  return out;
}
