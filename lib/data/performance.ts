import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBrand, type BrandSummary } from "@/lib/data/brand";

export { getCurrentBrand, type BrandSummary } from "@/lib/data/brand";

// ── jsonb contract (Sprint 3 WRITE TARGET) ──────────────────────────────────
// `performance_memory.supporting_evidence` is a jsonb array of small labelled
// facts that justify a learned insight (e.g. the scan-week metrics that confirm
// it). The page reads them back verbatim; the populator (the memory-distillation
// agent) must satisfy this shape so the UI renders real evidence with no
// client-side reshaping. Anything that doesn't parse is dropped, never faked.
export type SupportingEvidence = {
  label: string;
  value: string;
};

// ── view models ──────────────────────────────────────────────────────────────

/** A logged outcome of an action the brand took, name-stable for the table. */
export type ActionOutcome = {
  id: string;
  actionTaken: string;
  outcomeMetric: string | null;
  outcomeValue: number | null;
  outcomeUnit: string | null;
  /** Normalised to the three states the UI knows; unknown → null (hidden pill). */
  result: "positive" | "neutral" | "negative" | null;
  notes: string | null;
  actionTakenAt: string | null;
  recommendationId: string;
};

/** A learned, persistent insight about the brand's market (performance memory). */
export type PerformanceMemory = {
  id: string;
  memoryType: string;
  title: string;
  description: string;
  /** 0–1 model confidence; null when not scored. */
  confidenceScore: number | null;
  scanWeeksObserved: number | null;
  firstObservedWeek: string | null;
  lastConfirmedWeek: string | null;
  supportingEvidence: SupportingEvidence[];
};

/** One brand-vs-market benchmark snapshot for a scan_week. Sensitive metrics
 *  (revenue, depositors) are nullable and only surfaced when present. */
export type Benchmark = {
  scanWeek: string;
  appRating: number | null;
  marketAvgAppRating: number | null;
  ctrPct: number | null;
  marketAvgCtrPct: number | null;
  newDepositors: number | null;
  marketAvgNewDepositors: number | null;
  /** Naira (kobo ÷ 100, defensive); null when not reported. */
  revenueNaira: number | null;
  marketAvgRevenueNaira: number | null;
};

export type PerformanceData = {
  outcomes: ActionOutcome[];
  memories: PerformanceMemory[];
  /** Most recent benchmark snapshot, or null when none exists. */
  benchmark: Benchmark | null;
  /** Benchmark snapshots oldest→newest, for charting a brand-vs-market trend. */
  benchmarkTrend: Benchmark[];
};

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** kobo → naira, defensively (null in → null out, non-finite → null). */
function koboToNaira(kobo: unknown): number | null {
  const n = num(kobo);
  return n == null ? null : n / 100;
}

function normaliseResult(v: unknown): ActionOutcome["result"] {
  return v === "positive" || v === "neutral" || v === "negative" ? v : null;
}

function toSupportingEvidence(raw: unknown): SupportingEvidence | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const label = typeof r.label === "string" ? r.label : null;
  const value = typeof r.value === "string" ? r.value : null;
  if (label == null || value == null) return null;
  return { label, value };
}

function toBenchmark(r: {
  scan_week: string;
  app_rating: number | null;
  market_avg_app_rating: number | null;
  ctr_pct: number | null;
  market_avg_ctr_pct: number | null;
  new_depositors: number | null;
  market_avg_new_depositors: number | null;
  revenue_kobo: number | null;
  market_avg_revenue_kobo: number | null;
}): Benchmark {
  return {
    scanWeek: r.scan_week,
    appRating: num(r.app_rating),
    marketAvgAppRating: num(r.market_avg_app_rating),
    ctrPct: num(r.ctr_pct),
    marketAvgCtrPct: num(r.market_avg_ctr_pct),
    newDepositors: num(r.new_depositors),
    marketAvgNewDepositors: num(r.market_avg_new_depositors),
    revenueNaira: koboToNaira(r.revenue_kobo),
    marketAvgRevenueNaira: koboToNaira(r.market_avg_revenue_kobo),
  };
}

/**
 * Performance & Outcomes data for the brand (Screen 17). Reads three brand-scoped
 * tables (RLS scopes each to the signed-in user's brand):
 *   - `action_outcomes`     — what was done + what happened (newest first).
 *   - `performance_memory`  — active learned insights (latest-confirmed first).
 *   - `brand_benchmarks`    — brand-vs-market snapshots (trend asc; latest derived).
 * Returns empty arrays / null when a source has no rows — the page renders the
 * honest "scanning" empty state rather than fabricating numbers (CLAUDE.md).
 */
export async function getPerformanceData(
  brand: BrandSummary,
): Promise<PerformanceData> {
  const supabase = createClient();

  const [outcomesRes, memoriesRes, benchmarksRes] = await Promise.all([
    supabase
      .from("action_outcomes")
      .select(
        "id, action_taken, outcome_metric, outcome_value, outcome_unit, result, notes, action_taken_at, recommendation_id",
      )
      .eq("brand_id", brand.id)
      .order("action_taken_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("performance_memory")
      .select(
        "id, memory_type, title, description, confidence_score, scan_weeks_observed, first_observed_week, last_confirmed_week, supporting_evidence",
      )
      .eq("brand_id", brand.id)
      .eq("is_active", true)
      .order("last_confirmed_week", { ascending: false, nullsFirst: false }),
    supabase
      .from("brand_benchmarks")
      .select(
        "scan_week, app_rating, market_avg_app_rating, ctr_pct, market_avg_ctr_pct, new_depositors, market_avg_new_depositors, revenue_kobo, market_avg_revenue_kobo",
      )
      .eq("brand_id", brand.id)
      .order("scan_week", { ascending: true }),
  ]);

  const outcomes: ActionOutcome[] = (outcomesRes.data ?? []).map((r) => ({
    id: r.id,
    actionTaken: r.action_taken,
    outcomeMetric: r.outcome_metric,
    outcomeValue: num(r.outcome_value),
    outcomeUnit: r.outcome_unit,
    result: normaliseResult(r.result),
    notes: r.notes,
    actionTakenAt: r.action_taken_at,
    recommendationId: r.recommendation_id,
  }));

  const memories: PerformanceMemory[] = (memoriesRes.data ?? []).map((r) => ({
    id: r.id,
    memoryType: r.memory_type,
    title: r.title,
    description: r.description,
    confidenceScore: num(r.confidence_score),
    scanWeeksObserved: num(r.scan_weeks_observed),
    firstObservedWeek: r.first_observed_week,
    lastConfirmedWeek: r.last_confirmed_week,
    supportingEvidence: (Array.isArray(r.supporting_evidence)
      ? r.supporting_evidence
      : []
    )
      .map(toSupportingEvidence)
      .filter((e): e is SupportingEvidence => e !== null),
  }));

  const benchmarkTrend: Benchmark[] = (benchmarksRes.data ?? []).map(toBenchmark);
  const benchmark =
    benchmarkTrend.length > 0 ? benchmarkTrend[benchmarkTrend.length - 1] : null;

  return { outcomes, memories, benchmark, benchmarkTrend };
}
