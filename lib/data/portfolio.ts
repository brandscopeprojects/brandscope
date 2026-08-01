import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { listOrgBrands } from "@/lib/data/brand";

export type PortfolioBrand = {
  id: string;
  name: string;
  slug: string;
  market: string[];
  scanned: boolean;
  lastScanWeek: string | null;
  scanStatus: string | null;
  scanProgress: number | null;
  aiVisibility: number | null;
  threatLevel: string | null;
  sovPct: number | null;
  competitorsTracked: number | null;
  openUrgent: number;
};

export type NeedsAttentionItem = {
  brandId: string;
  brandName: string;
  headline: string;
  urgency: string;
  category: string | null;
};

export type Portfolio = {
  brands: PortfolioBrand[];
  needsAttention: NeedsAttentionItem[];
};

/** Keep the first row seen per brand_id (callers pass rows pre-sorted newest-first). */
function latestByBrand<T extends { brand_id: string }>(rows: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const r of rows) if (!m.has(r.brand_id)) m.set(r.brand_id, r);
  return m;
}

/**
 * Cross-brand portfolio for the signed-in org (RLS-scoped): one summary card per
 * brand + a ranked "needs attention" feed of the most urgent open recommendations
 * across every brand. Powers Portfolio Home (the post-login landing).
 */
export const getPortfolio = cache(async function getPortfolio(): Promise<Portfolio> {
  const brands = await listOrgBrands();
  if (brands.length === 0) return { brands: [], needsAttention: [] };

  const ids = brands.map((b) => b.id);
  const supabase = createClient();

  const [weeklyRes, scanRes, recsRes] = await Promise.all([
    supabase
      .from("weekly_cache")
      .select("brand_id, scan_week, ai_visibility_score, threat_level, sov_pct, competitors_tracked")
      .in("brand_id", ids)
      .order("scan_week", { ascending: false }),
    supabase
      .from("scan_jobs")
      .select("brand_id, status, progress_percentage, scan_week, created_at")
      .in("brand_id", ids)
      .order("created_at", { ascending: false }),
    supabase
      .from("recommendations")
      .select("brand_id, headline, urgency, category, rank, status, scan_week")
      .in("brand_id", ids)
      .eq("status", "open"),
  ]);

  const weekly = latestByBrand((weeklyRes.data ?? []) as Array<{ brand_id: string } & Record<string, unknown>>);
  const scans = latestByBrand((scanRes.data ?? []) as Array<{ brand_id: string } & Record<string, unknown>>);
  const recs = (recsRes.data ?? []) as Array<{
    brand_id: string;
    headline: string;
    urgency: string;
    category: string | null;
    rank: number | null;
  }>;

  const urgentByBrand = new Map<string, number>();
  for (const r of recs) {
    if (r.urgency === "urgent") urgentByBrand.set(r.brand_id, (urgentByBrand.get(r.brand_id) ?? 0) + 1);
  }
  const brandName = new Map(brands.map((b) => [b.id, b.name]));

  const portfolioBrands: PortfolioBrand[] = brands.map((b) => {
    const w = weekly.get(b.id);
    const s = scans.get(b.id);
    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      market: b.market,
      scanned: Boolean(w),
      lastScanWeek: (w?.scan_week as string) ?? null,
      scanStatus: (s?.status as string) ?? null,
      scanProgress: (s?.progress_percentage as number) ?? null,
      aiVisibility: (w?.ai_visibility_score as number) ?? null,
      threatLevel: (w?.threat_level as string) ?? null,
      sovPct: (w?.sov_pct as number) ?? null,
      competitorsTracked: (w?.competitors_tracked as number) ?? null,
      openUrgent: urgentByBrand.get(b.id) ?? 0,
    };
  });

  // Needs-attention feed: urgent first, then watch; then by rank; cap 12.
  const rank = (u: string) => (u === "urgent" ? 0 : u === "watch" ? 1 : 2);
  const needsAttention: NeedsAttentionItem[] = recs
    .filter((r) => r.urgency === "urgent" || r.urgency === "watch")
    .sort((a, b) => rank(a.urgency) - rank(b.urgency) || (a.rank ?? 99) - (b.rank ?? 99))
    .slice(0, 12)
    .map((r) => ({
      brandId: r.brand_id,
      brandName: brandName.get(r.brand_id) ?? "",
      headline: r.headline,
      urgency: r.urgency,
      category: r.category,
    }));

  return { brands: portfolioBrands, needsAttention };
});
