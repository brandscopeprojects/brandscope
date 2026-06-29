import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  Recommendation,
  EvidenceItem,
  ScatterPoint,
  RadarData,
  SovSlice,
  ThreatGaugeData,
  ThreatLevel,
  Urgency,
  ConfidenceLevel,
} from "@/types/view-models";
import type { CompetitorState } from "@/types/cache-contracts";

export type BrandSummary = { id: string; name: string; market: string[]; slug: string };

/** The signed-in user's brand (RLS scopes to their org). MVP = one brand per org. */
export async function getCurrentBrand(): Promise<BrandSummary | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("brands")
    .select("id, name, market, slug")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export type DashboardData = {
  scanWeek: string;
  scatter: { brand: ScatterPoint; competitors: ScatterPoint[] };
  radar: RadarData | null;
  sov: SovSlice[];
  threat: ThreatGaugeData | null;
  aiVisibility: { score: number | null; trend: number | null };
  recommendations: Recommendation[];
};

/** Latest weekly_cache + open recommendations for a brand, mapped to view models.
 *  Returns null when no scan cache exists yet (pre-first-scan empty state). */
export async function getDashboardData(brand: BrandSummary): Promise<DashboardData | null> {
  const supabase = createClient();

  const { data: cache } = await supabase
    .from("weekly_cache")
    .select("*")
    .eq("brand_id", brand.id)
    .order("scan_week", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!cache) return null;

  const competitors = (cache.competitor_states as CompetitorState[] | null) ?? [];

  const brandPoint: ScatterPoint = {
    id: brand.id,
    label: brand.name,
    reach: cache.reach_score ?? 0,
    aggression: cache.aggression_score ?? 0,
    isOwnBrand: true,
    sovPct: cache.sov_pct,
    threatScore: cache.threat_score,
  };
  const competitorPoints: ScatterPoint[] = competitors.map((c) => ({
    id: c.id,
    label: c.name,
    reach: c.reachScore,
    aggression: c.aggressionScore,
    isOwnBrand: false,
    traffic: c.estimatedMonthlyTraffic,
    sovPct: c.sovPct,
    threatScore: c.threatScore,
  }));

  const sov: SovSlice[] = [
    { label: brand.name, value: cache.sov_pct ?? 0, isOwnBrand: true },
    ...competitors.map((c) => ({ label: c.name, value: c.sovPct, isOwnBrand: false })),
  ];

  const radar = (cache.radar_data as RadarData | null) ?? null;

  const threat: ThreatGaugeData | null =
    cache.threat_score != null && cache.threat_level
      ? {
          score: cache.threat_score,
          level: cache.threat_level as ThreatLevel,
          reasons: cache.threat_reasons ?? [],
        }
      : null;

  const { data: recs } = await supabase
    .from("recommendations")
    .select("*")
    .eq("brand_id", brand.id)
    .eq("scan_week", cache.scan_week)
    .eq("status", "open")
    .order("rank", { ascending: true });

  const recommendations: Recommendation[] = (recs ?? [])
    .filter((r) => r.confidence_level !== "rejected")
    .map((r): Recommendation => {
      const ev = Array.isArray(r.evidence) ? (r.evidence as Record<string, unknown>[]) : [];
      return {
        id: r.id,
        urgency: r.urgency as Urgency,
        category: r.category,
        headline: r.headline,
        triggerReason: r.trigger_reason,
        confidenceScore: Number(r.confidence_score),
        confidenceLevel: r.confidence_level as ConfidenceLevel,
        evidence: ev.map(
          (e): EvidenceItem => ({
            sourceUrl: String(e.source_url ?? ""),
            scrapedAt: String(e.timestamp ?? ""),
            extractedText: String(e.extracted_text ?? ""),
            changeBefore: (e.change_before as string | null) ?? null,
            changeAfter: (e.change_after as string | null) ?? null,
            evidenceHash: (e.evidence_hash as string | null) ?? null,
          }),
        ),
        assumptionFlags: r.assumption_flags ?? [],
        isDirectEvidence: r.is_direct_evidence ?? true,
        status: "open",
        rank: r.rank,
      };
    });

  return {
    scanWeek: cache.scan_week,
    scatter: { brand: brandPoint, competitors: competitorPoints },
    radar,
    sov,
    threat,
    aiVisibility: { score: cache.ai_visibility_score, trend: cache.ai_visibility_trend },
    recommendations,
  };
}
