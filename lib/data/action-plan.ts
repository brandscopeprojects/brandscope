import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBrand, type BrandSummary } from "@/lib/data/brand";
import type {
  Recommendation,
  RecommendationStatus,
  EvidenceItem,
  Urgency,
  ConfidenceLevel,
} from "@/types/view-models";

export { getCurrentBrand, type BrandSummary } from "@/lib/data/brand";

/** Per-recommendation outcome logged by a brand user (action_outcomes row). */
export type OutcomeRecord = {
  id: string;
  recommendationId: string;
  actionTaken: string;
  outcomeMetric: string | null;
  outcomeValue: number | null;
  outcomeUnit: string | null;
  result: "positive" | "neutral" | "negative" | null;
  notes: string | null;
  loggedAt: string | null;
};

/** Summary counts from the latest action_plans row. */
export type ActionPlanSummary = {
  totalRecommendations: number;
  urgentCount: number;
  watchCount: number;
  opportunityCount: number;
};

export type ActionPlanData = {
  scanWeek: string;
  summary: ActionPlanSummary;
  recommendations: Recommendation[];
  outcomesByRecId: Record<string, OutcomeRecord>;
};

// Map a raw DB status string to the RecommendationStatus view model. Unknown /
// null statuses fall back to "open".
const STATUS_MAP: Record<string, RecommendationStatus> = {
  open: "open",
  accepted: "accepted",
  snoozed: "snoozed",
  dismissed: "dismissed",
  completed: "completed",
};

function toResult(
  value: string | null,
): "positive" | "neutral" | "negative" | null {
  if (value === "positive" || value === "neutral" || value === "negative") {
    return value;
  }
  return null;
}

/**
 * The full action plan for a brand at its latest scan_week: summary counts from
 * the action_plans row, EVERY recommendation (all statuses, ranked) mapped to the
 * view model exactly like lib/data/dashboard.ts, and any logged outcomes keyed by
 * recommendation_id. Returns null when no recommendations exist yet.
 */
export async function getActionPlanData(
  brand: BrandSummary,
): Promise<ActionPlanData | null> {
  const supabase = createClient();

  // Latest action_plans row for this brand → scan_week + summary counts.
  const { data: plan } = await supabase
    .from("action_plans")
    .select("*")
    .eq("brand_id", brand.id)
    .order("scan_week", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plan) return null;

  const scanWeek = plan.scan_week;

  // Every recommendation at that scan_week, all statuses, ranked.
  const { data: recs } = await supabase
    .from("recommendations")
    .select("*")
    .eq("brand_id", brand.id)
    .eq("scan_week", scanWeek)
    .order("rank", { ascending: true });

  const recommendations: Recommendation[] = (recs ?? [])
    .filter((r) => r.confidence_level !== "rejected")
    .map((r): Recommendation => {
      const ev = Array.isArray(r.evidence)
        ? (r.evidence as Record<string, unknown>[])
        : [];
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
        status: STATUS_MAP[r.status ?? "open"] ?? "open",
        rank: r.rank,
      };
    });

  if (recommendations.length === 0) return null;

  // Logged outcomes for this brand, keyed by recommendation_id (most recent wins).
  const { data: outcomes } = await supabase
    .from("action_outcomes")
    .select("*")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: true });

  const outcomesByRecId: Record<string, OutcomeRecord> = {};
  for (const o of outcomes ?? []) {
    outcomesByRecId[o.recommendation_id] = {
      id: o.id,
      recommendationId: o.recommendation_id,
      actionTaken: o.action_taken,
      outcomeMetric: o.outcome_metric,
      outcomeValue: o.outcome_value,
      outcomeUnit: o.outcome_unit,
      result: toResult(o.result),
      notes: o.notes,
      loggedAt: o.action_taken_at ?? o.created_at,
    };
  }

  const summary: ActionPlanSummary = {
    totalRecommendations: plan.total_recommendations ?? recommendations.length,
    urgentCount: plan.urgent_count ?? 0,
    watchCount: plan.watch_count ?? 0,
    opportunityCount: plan.opportunity_count ?? 0,
  };

  return { scanWeek, summary, recommendations, outcomesByRecId };
}
