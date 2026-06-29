import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBrand } from "@/lib/data/brand";
import {
  getBrandCompetitors,
  latestScanWeek,
  type BrandCompetitor,
} from "@/lib/data/competitors";

// Social & Ads Intelligence data layer (Screen 8, /social-ads).
//
// MVP scope: this is a PLACEHOLDER page. Social intelligence (follower counts,
// engagement, content analysis) is Phase 2 and needs Apify — a HARD EXCLUSION —
// so we DO NOT read social_cache here and we NEVER surface estimated social
// numbers we cannot verify.
//
// The one section with real data is the Ad Network summary, sourced from
// tech_stack_cache (DetectZeStack), exactly like lib/data/tech-stack.ts.
// tech_stack_cache has NO brand_id — it keys by competitor_id only. We resolve
// the brand's tracked competitors via brand_competitors (RLS-scoped), read the
// cache .in("competitor_id", ids), and filter to the latest scan_week.

/** One competitor's detected ad-network presence for the latest scan week. */
export type CompetitorAdNetworks = {
  competitorId: string;
  name: string;
  tier: string | null;
  adNetworks: string[];
};

export type SocialAdsData = {
  scanWeek: string;
  /** Per-competitor ad-network presence, in onboarding priority order. */
  competitors: CompetitorAdNetworks[];
};

const asStringArray = (v: string[] | null): string[] => v ?? [];

/** Latest ad-network presence for the brand's competitors, mapped to view models.
 *  Returns null when no tech_stack_cache rows exist yet (pre-first-scan state). */
export async function getSocialAdsData(): Promise<SocialAdsData | null> {
  const brand = await getCurrentBrand();
  if (!brand) return null;

  const competitors = await getBrandCompetitors(brand.id);
  if (competitors.length === 0) return null;

  const byId = new Map<string, BrandCompetitor>(competitors.map((c) => [c.id, c]));
  const ids = competitors.map((c) => c.id);

  const supabase = createClient();
  const { data: rows } = await supabase
    .from("tech_stack_cache")
    .select("competitor_id, scan_week, ad_networks")
    .in("competitor_id", ids);

  const scanWeek = latestScanWeek(rows ?? null);
  if (!rows || rows.length === 0 || !scanWeek) return null;

  const mapped: CompetitorAdNetworks[] = rows
    .filter((r) => r.scan_week === scanWeek)
    .map((r): CompetitorAdNetworks | null => {
      const comp = byId.get(r.competitor_id);
      if (!comp) return null;
      return {
        competitorId: r.competitor_id,
        name: comp.name,
        tier: comp.tier,
        adNetworks: asStringArray(r.ad_networks),
      };
    })
    .filter((c): c is CompetitorAdNetworks => c !== null)
    // Preserve onboarding priority order.
    .sort((a, b) => {
      const pa = byId.get(a.competitorId)?.priority ?? 0;
      const pb = byId.get(b.competitorId)?.priority ?? 0;
      return pa - pb;
    });

  if (mapped.length === 0) return null;

  return { scanWeek, competitors: mapped };
}
