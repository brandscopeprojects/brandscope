// Firecrawl client (owner-approved 2026-08-06; mvp-module-sources.md §8). Scrapes a
// single URL to markdown via the v2 /scrape endpoint. Used by researcher-promotions
// to read competitor promotions pages directly (DataForSEO signals supplement it).
// Best-effort: returns null on any failure so the caller falls back gracefully.
// Self-meters into provider_spend (provider 'firecrawl') like dataforseo.ts.

import { addProviderSpend } from "./spend.ts";

export type FirecrawlScrape = {
  url: string;
  markdown: string;
  title: string | null;
  statusCode: number | null;
};

// Rough per-scrape credit cost for metering (Firecrawl bills per credit; a basic
// scrape ≈ 1 credit). Exact billing is on their side — this is the cost signal.
const FIRECRAWL_SCRAPE_COST_USD = 0.001;

/** Scrape one URL to main-content markdown. Returns null on any non-success. */
export async function scrapeUrl(
  url: string,
  opts?: { timeoutMs?: number },
): Promise<FirecrawlScrape | null> {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) return null; // unconfigured → degrade to DataForSEO signals, never throw
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, proxy: "auto" }),
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 30_000),
    });
    addProviderSpend("firecrawl", FIRECRAWL_SCRAPE_COST_USD); // meter attempt (no-op off-context)
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as
      | { success?: boolean; data?: { markdown?: string; metadata?: { title?: string; statusCode?: number } } }
      | null;
    const md = body?.data?.markdown ?? "";
    if (body?.success !== true || md.length === 0) return null;
    return {
      url,
      markdown: md,
      title: body.data?.metadata?.title ?? null,
      statusCode: body.data?.metadata?.statusCode ?? null,
    };
  } catch {
    return null; // best-effort — promotions falls back to DataForSEO signals
  }
}
