// DetectZeStack client (mvp-module-sources.md §4). CONFIRMED endpoint:
//   GET https://detectzestack.com/analyze?url={domain}  header X-API-Key: {key}
// Direct route verified working 2026-08-06 (X-API-Key, HTTP 200). The
// api.detectzestack.com/v1/detect host in the API map is WRONG (DNS failure).
// RapidAPI alternative is supported via DETECTZESTACK_RAPIDAPI_HOST if the owner
// uses that route. Response is already structured (no LLM needed).
//
// Response shape (Wappalyzer-style):
//   {
//     categories: { "CDN": ["Cloudflare"], "Analytics": ["Google Analytics"], ... },
//     technologies: [{ name, categories: string[], confidence, description, ... }],
//     ...
//   }
// The five cache buckets are derived by routing the `categories` map's LABELS
// (not a non-existent top-level `ad_networks` key) through keyword patterns.

import { requireEnv, optionalEnv } from "./env.ts";

export type TechStackResult = {
  domain: string;
  adNetworks: string[];
  analyticsTools: string[];
  cdnProviders: string[];
  crmTools: string[];
  paymentGateways: string[];
  technologies: { name: string; category: string }[];
  raw: unknown;
};

// Label → bucket routing over the DetectZeStack/Wappalyzer category taxonomy.
// A label can only ever feed one bucket here; order is irrelevant (disjoint patterns).
const BUCKET_PATTERNS: { field: keyof CategoryBuckets; re: RegExp }[] = [
  { field: "adNetworks", re: /advertis|ad network|ad exchange|retarget|\bdsp\b|\bssp\b/i },
  { field: "analyticsTools", re: /analytic|tag manager|heatmap|a\/b testing|tracking/i },
  { field: "cdnProviders", re: /\bcdn\b/i },
  { field: "paymentGateways", re: /payment|checkout|buy now pay later|\bpos\b/i },
  { field: "crmTools", re: /\bcrm\b|live chat|help desk|marketing automation|email marketing|customer engagement/i },
];

type CategoryBuckets = {
  adNetworks: string[];
  analyticsTools: string[];
  cdnProviders: string[];
  crmTools: string[];
  paymentGateways: string[];
};

/** Route the `categories` map ({label: [techNames]}) into the five cache buckets. */
function routeCategories(categories: Record<string, unknown>): CategoryBuckets {
  const sets: Record<keyof CategoryBuckets, Set<string>> = {
    adNetworks: new Set(),
    analyticsTools: new Set(),
    cdnProviders: new Set(),
    crmTools: new Set(),
    paymentGateways: new Set(),
  };
  for (const [label, techs] of Object.entries(categories)) {
    if (!Array.isArray(techs)) continue;
    for (const { field, re } of BUCKET_PATTERNS) {
      if (re.test(label)) {
        for (const t of techs) sets[field].add(String(t));
      }
    }
  }
  return {
    adNetworks: [...sets.adNetworks],
    analyticsTools: [...sets.analyticsTools],
    cdnProviders: [...sets.cdnProviders],
    crmTools: [...sets.crmTools],
    paymentGateways: [...sets.paymentGateways],
  };
}

/** Analyze a single competitor domain. Throws on non-200 so caller can retry/DLQ. */
export async function analyzeDomain(domain: string): Promise<TechStackResult> {
  const rapidHost = optionalEnv("DETECTZESTACK_RAPIDAPI_HOST");
  const key = requireEnv("DETECTZESTACK_API_KEY");
  const clean = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  const url = rapidHost
    ? `https://${rapidHost}/analyze?url=${encodeURIComponent(clean)}`
    : `https://detectzestack.com/analyze?url=${encodeURIComponent(clean)}`;
  const headers: Record<string, string> = rapidHost
    ? { "X-RapidAPI-Key": key, "X-RapidAPI-Host": rapidHost }
    : { "X-API-Key": key };

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`DetectZeStack ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as Record<string, unknown>;

  // Per-technology category: DetectZeStack returns `categories` (array), NOT
  // `category`. Use the first category label; fall back to "other".
  const tech = Array.isArray(data.technologies)
    ? (data.technologies as Record<string, unknown>[]).map((t) => {
        const cats = Array.isArray(t.categories) ? (t.categories as unknown[]).map(String) : [];
        return {
          name: String(t.name ?? t.technology ?? ""),
          category: cats[0] ?? String(t.category ?? "other"),
        };
      })
    : [];

  // Buckets come from the `categories` MAP, routed by label keyword.
  const categories =
    data.categories && typeof data.categories === "object" && !Array.isArray(data.categories)
      ? (data.categories as Record<string, unknown>)
      : {};
  const buckets = routeCategories(categories);

  return {
    domain: clean,
    adNetworks: buckets.adNetworks,
    analyticsTools: buckets.analyticsTools,
    cdnProviders: buckets.cdnProviders,
    crmTools: buckets.crmTools,
    paymentGateways: buckets.paymentGateways,
    technologies: tech,
    raw: data,
  };
}
