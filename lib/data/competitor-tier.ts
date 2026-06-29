import "server-only";

/**
 * Competitor tier detection (onboarding step 10 / "Detect Brand").
 * Spec: docs/skills/mvp-module-sources.md → "Competitor Tier Detection".
 *
 * Two outputs per domain:
 *  - name: derived from the domain (strip TLD/subdomain, title-case). Always available, editable.
 *  - tier: from DataForSEO bulk_traffic_estimation thresholds:
 *      > 1,000,000           → dominant
 *      100,000 – 1,000,000   → challenger
 *      10,000 – 100,000      → mid_market
 *      < 10,000              → niche
 *      no data / no key      → challenger (default)
 *
 * NOTE: the DataForSEO call is NOT wired yet (key absent at Sprint 2). The seam is
 * `estimateMonthlyVisits()` below — plug the live call in there at Sprint 3 (step 18).
 * Until then every domain resolves to the `challenger` default. The field stays
 * user-editable in onboarding (step 4) and /admin/competitors.
 */

export type CompetitorTier = "dominant" | "challenger" | "mid_market" | "niche";

/** Normalise a raw user input into a bare host (lowercase, no scheme/path/www). */
export function normaliseDomain(raw: string): string {
  let value = raw.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, "");
  value = value.replace(/^www\./, "");
  value = value.split("/")[0];
  value = value.split("?")[0];
  value = value.split("#")[0];
  return value;
}

/**
 * Derive a human display name from a domain.
 * e.g. "promo.bet9ja.com" → "Bet9ja"; "sportybet.co.ke" → "Sportybet".
 */
export function brandNameFromDomain(raw: string): string {
  const host = normaliseDomain(raw);
  if (!host) return "";
  const labels = host.split(".").filter(Boolean);
  if (labels.length === 0) return "";

  // Common multi-part TLDs we should drop wholesale (e.g. co.ke, co.za, com.ng).
  const compoundTldTails = new Set(["co", "com", "org", "net", "gov", "edu"]);
  // The significant label is the one immediately left of the TLD. For a 2-label
  // host (foo.com) that's labels[0]; for 3+ labels we take the second-from-last,
  // unless that is itself a compound-TLD prefix (foo.co.ke → "foo").
  let significant: string;
  if (labels.length <= 2) {
    significant = labels[0];
  } else {
    const candidate = labels[labels.length - 2];
    significant = compoundTldTails.has(candidate) ? labels[labels.length - 3] : candidate;
  }

  // Title-case, splitting on hyphens.
  return significant
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Map estimated monthly visits → tier, per the spec thresholds. */
export function tierFromMonthlyVisits(visits: number | null): CompetitorTier {
  if (visits === null) return "challenger";
  if (visits > 1_000_000) return "dominant";
  if (visits >= 100_000) return "challenger";
  if (visits >= 10_000) return "mid_market";
  return "niche";
}

/**
 * SEAM: estimated monthly visits for a domain.
 *
 * TODO(Sprint 3, step 18): call DataForSEO Labs
 *   POST dataforseo_labs/google/bulk_traffic_estimation/live
 *   (Basic auth btoa(DATAFORSEO_LOGIN:DATAFORSEO_PASSWORD)), read the estimated
 *   monthly visits, and return it here. Server-side only; key is absent at MVP
 *   Sprint 2, so this returns null and the tier falls back to `challenger`.
 */
async function estimateMonthlyVisits(_domain: string): Promise<number | null> {
  // No DataForSEO key wired yet — see TODO above.
  return null;
}

export type DetectedBrand = {
  domain: string;
  name: string;
  tier: CompetitorTier;
};

/**
 * Detect a competitor's display name + tier from a domain.
 * Name is always derived locally; tier defaults to `challenger` until the
 * DataForSEO seam (`estimateMonthlyVisits`) is wired in Sprint 3.
 */
export async function detectBrandFromDomain(rawDomain: string): Promise<DetectedBrand> {
  const domain = normaliseDomain(rawDomain);
  const name = brandNameFromDomain(domain);
  const visits = await estimateMonthlyVisits(domain);
  const tier = tierFromMonthlyVisits(visits);
  return { domain, name, tier };
}
