// DataForSEO Google Jobs SERP helper for researcher-hiring (mvp-module-sources.md
// §9 Hiring — PARTIAL coverage). The ONLY hiring source at MVP: the Google Jobs
// SERP. NO Firecrawl, NO career-page crawl, NO full job-description bodies.
// File ownership: researcher-hiring/** only — never edits _shared or siblings.
//
// Endpoint: serp/google/jobs/live/advanced  (a LIVE endpoint — returns inline,
//   no task_post / polling). DataForSEO SERP endpoints take a `[ {task} ]` array
//   body with `keyword` + `location_code`/`location_name` + `language_code`.
//   Response: { tasks: [ { result: [ { items: [ {type:"google_jobs_search",
//   items:[ <job postings> ]} ] } ] } ] }. The job postings live in the nested
//   `items[]` of the `google_jobs_search` SERP element. We tolerate every field
//   being absent — partial data is fine, fabrication is not.

import { dfsPost, firstResult } from "../_shared/dataforseo.ts";

// market code → DataForSEO Google Jobs location_code / human label. Default
// Nigeria (the MVP launch market); query string mirrors `"[competitor] Lagos
// Nigeria"` from mvp-module-sources.md §9.
const MARKET_META: Record<string, { location: number; label: string; city: string }> = {
  NG: { location: 2566, label: "Nigeria", city: "Lagos" },
  KE: { location: 2404, label: "Kenya", city: "Nairobi" },
  ZA: { location: 2710, label: "South Africa", city: "Johannesburg" },
};
const DEFAULT_MARKET = { location: 2566, label: "Nigeria", city: "Lagos" };
const LANGUAGE = "en";

/** Resolve display label + DataForSEO location for a market code. */
export function marketMeta(market: string): { location: number; label: string; city: string } {
  return MARKET_META[(market ?? "").toUpperCase()] ?? DEFAULT_MARKET;
}

/** One raw job posting parsed from the Jobs SERP (PARTIAL — title-level only). */
export type JobPosting = {
  title: string;
  location: string | null;
  /** ISO-ish date/datetime the posting was first seen (or null when undated). */
  postedAt: string | null;
  /** Coarse role grouping the SERP element exposes (often absent). */
  category: string | null;
  employer: string | null;
  /** The market this posting was discovered under (our query market, not the JD). */
  market: string;
  /** A clickable source for the evidence chain when the SERP exposes one. */
  url: string | null;
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

/** Normalise the SERP element's date fields to an ISO string when possible. */
function normaliseDate(item: Record<string, unknown>): string | null {
  // DataForSEO Jobs exposes a `date_posted` (sometimes ISO, sometimes relative
  // like "3 days ago") and/or `timestamp`. Prefer a parseable absolute value;
  // never fabricate a date when only a relative string is present.
  const candidates = [item.date_posted, item.timestamp, item.time_ago];
  for (const c of candidates) {
    const s = str(c);
    if (!s) continue;
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  return null;
}

/**
 * Fetch Google Jobs SERP postings for one competitor in one market.
 * Query mirrors `"[competitor] [City] [Country]"` (mvp-module-sources.md §9).
 * Bounded by `depth` so a single competitor/market can't return unbounded rows.
 */
export async function fetchJobPostings(
  competitorName: string,
  market: string,
  depth = 20,
): Promise<JobPosting[]> {
  const meta = marketMeta(market);
  const keyword = `${competitorName} ${meta.city} ${meta.label}`.trim();

  const body = await dfsPost(
    "serp/google/jobs/live/advanced",
    [{
      keyword,
      location_code: meta.location,
      language_code: LANGUAGE,
      depth,
    }],
  );

  const result = firstResult<Record<string, unknown>>(
    body as { tasks?: Array<{ result?: Record<string, unknown>[] }> },
  );

  // The result row carries a flat `items[]` of SERP elements; the job postings
  // are the `google_jobs_search` element's nested `items[]`. Flatten both shapes
  // defensively (some responses nest, some return postings at the top level).
  const postings: JobPosting[] = [];
  for (const row of result) {
    const serpElements = Array.isArray(row.items) ? (row.items as Record<string, unknown>[]) : [];
    for (const el of serpElements) {
      const type = str(el.type);
      // Job postings live inside the google_jobs_search element OR are themselves
      // job items at the top level — handle both.
      const nested = Array.isArray(el.items) ? (el.items as Record<string, unknown>[]) : [];
      const candidates = type === "google_jobs_search" && nested.length > 0 ? nested : [el];
      for (const job of candidates) {
        const title = str(job.title);
        if (!title) continue;
        postings.push({
          title,
          location: str(job.location),
          postedAt: normaliseDate(job),
          category: str(job.category) ?? str(job.job_type),
          employer: str(job.employer_name) ?? str(job.company_name),
          market,
          url: str(job.url) ?? str(job.link) ?? null,
        });
      }
    }
  }

  // Bound the per-competitor-per-market result count (depth is a hint, not a cap
  // DataForSEO always honours).
  return postings.slice(0, depth);
}
