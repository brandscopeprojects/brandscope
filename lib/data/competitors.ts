import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Shared competitor-resolution helpers. Several cache tables key by
// `competitor_id` (no brand_id) and resolve to the brand via brand_competitors
// (e.g. tech_stack_cache, competitor_profiles, competitor_changes). Per-competitor
// cache pages (SEO, Promotions, Regulatory, Customers, Hiring, Social, Tech Stack,
// Competitor Profile) use these to scope to the brand's tracked competitors and to
// turn competitor_ids into display names. RLS already restricts brand_competitors
// to the user's brand; we still pass brandId explicitly for clarity.

export type BrandCompetitor = {
  id: string;
  name: string;
  domain: string;
  tier: string | null;
  priority: number;
};

/** The brand's tracked competitors, ordered by onboarding priority. */
export const getBrandCompetitors = cache(async function getBrandCompetitors(
  brandId: string,
): Promise<BrandCompetitor[]> {
  const supabase = createClient();

  const { data: links } = await supabase
    .from("brand_competitors")
    .select("competitor_id, priority")
    .eq("brand_id", brandId)
    .order("priority", { ascending: true });

  if (!links || links.length === 0) return [];

  const ids = links.map((l) => l.competitor_id);
  const { data: comps } = await supabase
    .from("competitors")
    .select("id, name, domain, tier")
    .in("id", ids);

  const byId = new Map((comps ?? []).map((c) => [c.id, c]));
  return links
    .map((l) => {
      const c = byId.get(l.competitor_id);
      if (!c) return null;
      return {
        id: c.id,
        name: c.name,
        domain: c.domain,
        tier: c.tier,
        priority: l.priority,
      } satisfies BrandCompetitor;
    })
    .filter((c): c is BrandCompetitor => c !== null);
});

/** competitor_id → display name lookup built from getBrandCompetitors. */
export function competitorNameMap(competitors: BrandCompetitor[]): Map<string, string> {
  return new Map(competitors.map((c) => [c.id, c.name]));
}

/** The most recent scan_week among a set of cache rows (or null if empty). */
export function latestScanWeek<T extends { scan_week: string }>(rows: T[] | null): string | null {
  if (!rows || rows.length === 0) return null;
  return rows.reduce((max, r) => (r.scan_week > max ? r.scan_week : max), rows[0].scan_week);
}
