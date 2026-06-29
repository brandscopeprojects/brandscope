import "server-only";

// Brand-admin Competitors page data (Screen 21, /admin/competitors).
// Reuses getBrandCompetitors (user-session RLS on brand_competitors) to list the
// brand's tracked competitors, and derives the cap state (count + remaining slots)
// from COMPETITOR_MAX. Read-only; all writes live in the page's server actions.

import { getBrandCompetitors, type BrandCompetitor } from "@/lib/data/competitors";
import { COMPETITOR_MAX } from "@/lib/onboarding/constants";

export type AdminCompetitorsData = {
  competitors: BrandCompetitor[];
  /** Number of competitors currently tracked by the brand. */
  count: number;
  /** The hard cap (CLAUDE.md Decision 1 — 10/brand). */
  max: number;
  /** Free slots left before the cap (never negative). */
  remaining: number;
  /** True when the brand is at the cap and cannot add more. */
  atCap: boolean;
};

/** Tracked competitors + cap state for the brand-admin Competitors page. */
export async function getAdminCompetitors(
  brandId: string,
): Promise<AdminCompetitorsData> {
  const competitors = await getBrandCompetitors(brandId);
  const count = competitors.length;
  const remaining = Math.max(0, COMPETITOR_MAX - count);
  return {
    competitors,
    count,
    max: COMPETITOR_MAX,
    remaining,
    atCap: count >= COMPETITOR_MAX,
  };
}
