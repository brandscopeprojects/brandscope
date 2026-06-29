import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBrand, type BrandSummary } from "@/lib/data/brand";
import { getDashboardData } from "@/lib/data/dashboard";
import {
  getBrandCompetitors,
  competitorNameMap,
} from "@/lib/data/competitors";
import type { ScatterPoint } from "@/types/view-models";
import { isDemoMode } from "@/lib/data/demo-mode";

export { getCurrentBrand, type BrandSummary } from "@/lib/data/brand";

// Screen 4 — Market Intelligence (`/market-intel`). There is NO
// `market_intelligence_cache` table (screen-specs lists one that doesn't exist);
// the market position map is sourced from the latest `weekly_cache` row (reusing
// dashboard.ts' scatter mapping) and the "what just changed" feed from
// `competitor_changes`, keyed by the brand's tracked competitor ids.

/**
 * `competitor_changes.detail` jsonb shape.
 *
 * Sprint-3 WRITE TARGET: the between-cycle change detector writes this when it
 * spots a competitor move. All fields optional — a change may carry no
 * before/after pair (e.g. a brand-new signal). Keep this in sync with the
 * detector when it lands.
 */
export type CompetitorChangeDetail = {
  before?: string;
  after?: string;
  metric?: string;
};

/** One row of the market-wide recent-changes feed (mapped for MarketTrendFeed). */
export type MarketChange = {
  id: string;
  competitorId: string;
  competitorName: string;
  changeType: string;
  summary: string;
  impactLevel: string | null;
  detectedAt: string; // ISO timestamp, rendered in JetBrains Mono
  sourceUrl: string | null;
  detail: CompetitorChangeDetail | null;
  evidenceHash: string | null;
};

export type MarketIntelData = {
  scanWeek: string | null;
  /** Market Position Map props — null until the first weekly_cache row exists. */
  scatter: { brand: ScatterPoint; competitors: ScatterPoint[] } | null;
  /** Market-wide recent competitor moves (empty when none detected yet). */
  changes: MarketChange[];
  /** Count of distinct competitors the brand tracks (real, for the StatStrip). */
  competitorsTracked: number;
};

function normaliseDetail(value: unknown): CompetitorChangeDetail | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const detail: CompetitorChangeDetail = {};
  if (typeof v.before === "string") detail.before = v.before;
  if (typeof v.after === "string") detail.after = v.after;
  if (typeof v.metric === "string") detail.metric = v.metric;
  return Object.keys(detail).length > 0 ? detail : null;
}

/**
 * Market Intelligence page data. The scatter half is null when no weekly_cache
 * row exists yet; the changes half is [] when no moves have been detected.
 */
export async function getMarketIntelData(
  brand: BrandSummary,
): Promise<MarketIntelData> {
  if (isDemoMode()) {
    const { DEMO_MARKET_INTEL } = await import("@/lib/data/demo/market-intel");
    return DEMO_MARKET_INTEL;
  }

  const supabase = createClient();

  // Reuse dashboard.ts' weekly_cache → ScatterPoint mapping (do NOT duplicate).
  const dashboard = await getDashboardData(brand);

  // Recent competitor moves: competitor_changes keys by competitor_id (no
  // brand_id), so scope via the brand's tracked competitors.
  const competitors = await getBrandCompetitors(brand.id);
  const ids = competitors.map((c) => c.id);
  const nameById = competitorNameMap(competitors);

  let changes: MarketChange[] = [];
  if (ids.length > 0) {
    const { data: rows } = await supabase
      .from("competitor_changes")
      .select(
        "id, competitor_id, change_type, summary, impact_level, detected_at, source_url, detail, evidence_hash",
      )
      .in("competitor_id", ids)
      .order("detected_at", { ascending: false })
      .limit(30);

    changes = (rows ?? []).map(
      (r): MarketChange => ({
        id: r.id,
        competitorId: r.competitor_id,
        competitorName: nameById.get(r.competitor_id) ?? "Unknown competitor",
        changeType: r.change_type,
        summary: r.summary,
        impactLevel: r.impact_level,
        detectedAt: r.detected_at,
        sourceUrl: r.source_url,
        detail: normaliseDetail(r.detail),
        evidenceHash: r.evidence_hash,
      }),
    );
  }

  return {
    scanWeek: dashboard?.scanWeek ?? null,
    scatter: dashboard?.scatter ?? null,
    changes,
    competitorsTracked: competitors.length,
  };
}
