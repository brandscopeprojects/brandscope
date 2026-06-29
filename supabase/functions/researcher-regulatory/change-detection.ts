// Regulatory change detection via DataForSEO Google News (mvp-module-sources.md
// §7: serp/google/news/live/advanced). Surfaces recent regulator announcements
// per market; results feed (a) the raw_data audit trail and (b) optional
// best-effort discovery of new regulator-doc URLs for ingestion. NO Firecrawl /
// Apify (excluded at MVP).

import { dfsPost, firstResult } from "../_shared/dataforseo.ts";

// DataForSEO Google location codes per market (same mapping as traffic-seo).
const LOCATION_BY_MARKET: Record<string, number> = {
  nigeria: 2566,
  kenya: 2404,
  south_africa: 2710,
};

// Regulator + regulatory-change keywords per market. The regulator names anchor
// the query so News returns filings/announcements, not generic gambling press.
const KEYWORDS_BY_MARKET: Record<string, string> = {
  nigeria: "Nigeria gambling regulation NLRC betting licence compliance",
  kenya: "Kenya BCLB betting control licensing board gambling regulation",
  south_africa: "South Africa gambling board WCGRB betting regulation licence",
};

export type NewsItem = {
  title: string;
  url: string;
  snippet: string | null;
  source: string | null;
  datePublished: string | null;
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Fetch recent regulatory news for a market. Bounded (depth 20) to stay within
 * the module budget. Returns [] on any failure — change detection is advisory and
 * must never block compliance scoring.
 */
export async function fetchRegulatoryNews(market: string): Promise<NewsItem[]> {
  const location = LOCATION_BY_MARKET[market.toLowerCase()];
  const keyword = KEYWORDS_BY_MARKET[market.toLowerCase()];
  if (!location || !keyword) return [];

  try {
    const body = await dfsPost(
      "serp/google/news/live/advanced",
      [{ keyword, location_code: location, language_code: "en", depth: 20 }],
    );
    const results = firstResult<Record<string, unknown>>(
      body as { tasks?: Array<{ result?: Record<string, unknown>[] }> },
    );
    const items = Array.isArray(results[0]?.items)
      ? (results[0].items as Record<string, unknown>[])
      : [];

    return items
      .map((it): NewsItem | null => {
        const url = str(it.url) ?? str(it.source_url);
        const title = str(it.title);
        if (!url || !title) return null;
        return {
          title,
          url,
          snippet: str(it.snippet),
          source: str(it.source) ?? str((it.domain as string) ?? null),
          datePublished: str(it.timestamp) ?? str(it.date),
        };
      })
      .filter((x): x is NewsItem => x !== null);
  } catch {
    return [];
  }
}

/** Heuristic: does a news URL look like a regulator PDF worth ingesting? */
export function looksLikeRegulatorDoc(url: string): boolean {
  const u = url.toLowerCase();
  if (!u.endsWith(".pdf")) return false;
  // Only consider official-looking hosts; never ingest arbitrary press PDFs.
  return /(gov|gob|reg|board|commission|control|gaming|gambling|lottery)/.test(u);
}
