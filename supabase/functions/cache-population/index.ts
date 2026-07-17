// cache-population — orchestrator step 6 (agent-orchestration.md §"End-to-end
// sequence"). The ONLY writer of weekly_cache / action_plans / recommendations /
// generated_assets / feature_health_logs. Invoked by synthesis-draft-audit with the
// drafted+audited recommendations once a job's modules have finished.
//
// Responsibilities (in order):
//  1. Load the brand's module caches for (brand_id, scan_week) + previous week's
//     weekly_cache (partial fallback) + the scan_jobs row (failed/partial modules).
//  2. Compute per-competitor + own-brand scores via scoring.ts (formulas live there).
//  3. Fall back to previous-week values for any failed module's contribution; record
//     feature_health_logs (healthy/degraded/down, not_applicable_mvp for social).
//  4. UPSERT weekly_cache (brand_id,scan_week) + competitor_profiles (competitor_id,
//     scan_week). expires_at = now()+8 days (data-flow-rules.md §3.1).
//  5. INSERT action_plans + each non-rejected recommendation.
//  6. (Asset pre-generation is OUT OF SCOPE here — /api/assets/generate owns it.)
//  7. Set final scan_jobs status (completed / partial / failed).
//  8. Scan-complete email — Resend is EXCLUDED; left as a TODO (Supabase Auth channel).
//
// Service-role; strictly scoped by brand_id. No fabricated numbers — a module with no
// data and no previous-week fallback leaves its fields null + degraded health.

import { serviceClient, type SupabaseClient } from "../_shared/supabase.ts";
import { json, preflight, isAuthorizedInternal } from "../_shared/http.ts";
import { setScanStatus } from "../_shared/scan.ts";
import { recordFeatureHealth } from "../_shared/logging.ts";
import type { CompetitorState, RadarData, RecommendationEvidence } from "../_shared/contracts.ts";
import {
  loadModuleData,
  signalsForCompetitor,
  brandAiChecks,
  competitorAiScores,
  type CompetitorRow,
} from "./loader.ts";
import {
  reachScore,
  aggressionScore,
  promoActivityNorm,
  shareOfVoice,
  aiVisibilityScore,
  threatScore,
  radarAxes,
  marketAverage,
  RADAR_AXES,
  type EntitySignals,
  type ThreatInputs,
} from "./scoring.ts";

const AGENT = "cache-population";
const EIGHT_DAYS_MS = 8 * 24 * 3600 * 1000;

// ---- incoming body (from synthesis-draft-audit) ----
type IncomingRecommendation = {
  category: string;
  urgency: "urgent" | "watch" | "opportunity" | "info";
  headline: string;
  trigger_reason: string;
  confidence_score: number; // 0..1
  confidence_level: "high" | "medium" | "low" | "rejected";
  evidence: RecommendationEvidence[];
  assumption_flags?: string[];
  is_direct_evidence?: boolean;
  competitor_id?: string | null;
  full_analysis?: string | null;
  // optional Auditor sub-scores (persisted if provided)
  evidence_traceability_score?: number | null;
  brand_alignment_score?: number | null;
  logic_quality_score?: number | null;
  compliance_score?: number | null;
};

type Body = {
  scan_job_id: string;
  brand_id: string;
  scan_week: string; // YYYY-MM-DD (Monday)
  recommendations: IncomingRecommendation[];
  brief?: unknown;
};

// Module → feature_health_logs category metadata.
const MODULE_HEALTH: Record<string, { category: string; name: string }> = {
  traffic_seo: { category: "traffic_seo", name: "Traffic & SEO" },
  geo_aeo: { category: "geo_aeo", name: "AI Visibility (GEO/AEO)" },
  tech_stack: { category: "tech_stack", name: "Tech Stack" },
  app_store: { category: "product_intel", name: "Product Intelligence" },
  customer: { category: "customer_intel", name: "Customer Intelligence" },
  regulatory: { category: "regulatory", name: "Regulatory" },
  promotions: { category: "promotions", name: "Promotions" },
  hiring: { category: "hiring_signals", name: "Hiring Signals" },
};

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (!isAuthorizedInternal(req)) return json({ error: "unauthorized" }, 401);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const { scan_job_id, brand_id, scan_week } = body;
  if (!scan_job_id || !brand_id || !scan_week) {
    return json({ error: "scan_job_id, brand_id, scan_week required" }, 400);
  }

  const sb = serviceClient();

  try {
    // ── Step 1: load job + competitors + module caches + previous-week cache ──
    const { data: job, error: jobErr } = await sb
      .from("scan_jobs")
      .select("id, brand_id, failed_modules, partial_modules, total_cost_usd, started_at")
      .eq("id", scan_job_id)
      .eq("brand_id", brand_id)
      .single();
    if (jobErr || !job) throw new Error(`scan_job not found: ${jobErr?.message ?? "missing"}`);

    const { data: brand } = await sb
      .from("brands")
      .select("id, name, domain")
      .eq("id", brand_id)
      .single();
    if (!brand) throw new Error("brand not found");

    // Tracked competitors (join brand_competitors → competitors).
    const { data: bcRows } = await sb
      .from("brand_competitors")
      .select("competitor_id, competitors(id, name, domain)")
      .eq("brand_id", brand_id);
    const competitors: CompetitorRow[] = (bcRows ?? [])
      .map((r) => {
        const c = (r as Record<string, unknown>).competitors as Record<string, unknown> | null;
        return c ? { id: String(c.id), name: String(c.name), domain: String(c.domain) } : null;
      })
      .filter((c): c is CompetitorRow => c != null);
    const competitorIds = competitors.map((c) => c.id);

    // Brand-self competitor: resolved by a DIRECT domain match against `competitors`
    // (brand-scan seeds this self row but does NOT link it in brand_competitors, so
    // it isn't in the tracked list above). Its per-competitor module rows carry the
    // brand's OWN data. Absent → own-brand module scores null (no fabrication).
    const { data: selfRow } = await sb
      .from("competitors")
      .select("id, name, domain")
      .eq("domain", brand.domain)
      .limit(1)
      .maybeSingle();
    const selfCompetitor: CompetitorRow | null = selfRow
      ? { id: String(selfRow.id), name: String(selfRow.name), domain: String(selfRow.domain) }
      : null;
    // Rivals = tracked competitors, excluding the self row if it also happens to be tracked.
    const rivals = selfCompetitor
      ? competitors.filter((c) => c.id !== selfCompetitor.id)
      : competitors;

    // tech_stack_cache is keyed by competitor_id only — include the self id so the
    // brand's own tech row loads alongside the rivals'.
    const loadIds = selfCompetitor ? [...competitorIds, selfCompetitor.id] : competitorIds;
    const md = await loadModuleData(sb, brand_id, scan_week, loadIds);

    const failedModules: string[] = job.failed_modules ?? [];
    const partialModules: string[] = job.partial_modules ?? [];

    // Previous week's weekly_cache for fallback (most recent strictly-earlier scan_week).
    const { data: prevCache } = await sb
      .from("weekly_cache")
      .select("*")
      .eq("brand_id", brand_id)
      .lt("scan_week", scan_week)
      .order("scan_week", { ascending: false })
      .limit(1)
      .maybeSingle();

    // ── Step 2: compute scores ──
    // AI visibility — brand from geo_cache row; competitors from competitor_ai_scores jsonb.
    const geoFailed = failedModules.includes("geo_aeo");
    const { checks: brandChecks, total: aiTotal } = brandAiChecks(md.geo);
    const brandAiVisibility = geoFailed ? null : aiVisibilityScore(brandChecks, aiTotal);
    // WoW trend: prefer geo_cache.score_change_wow, else compute against prev weekly_cache.
    let aiTrend: number | null = asNumLocal(md.geo?.score_change_wow);
    if (aiTrend == null && brandAiVisibility != null && prevCache?.ai_visibility_score != null) {
      aiTrend = round2(brandAiVisibility - Number(prevCache.ai_visibility_score));
    }
    const compAi = competitorAiScores(md.geo);

    // Per-entity signals.
    const brandSelfId = selfCompetitor?.id ?? null;
    const brandSignals: EntitySignals = brandSelfId
      ? signalsForCompetitor(md, brandSelfId, brandAiVisibility)
      : emptySignals(brandAiVisibility);

    const rivalSignals = new Map<string, EntitySignals>();
    for (const c of rivals) {
      rivalSignals.set(c.id, signalsForCompetitor(md, c.id, compAi[c.id] ?? null));
    }

    // SOV across brand + tracked rivals (§4; demand-basis fallback when the whole
    // set has no Labs traffic — scoring-formulas §4 amendment).
    const sovInput = [
      {
        id: brand_id,
        estMonthlyTraffic: brandSignals.estMonthlyTraffic,
        brandDemandVolume: brandSignals.brandDemandVolume,
      },
      ...rivals.map((c) => ({
        id: c.id,
        estMonthlyTraffic: rivalSignals.get(c.id)!.estMonthlyTraffic,
        brandDemandVolume: rivalSignals.get(c.id)!.brandDemandVolume,
      })),
    ];
    const { sov, basis: sovBasis } = shareOfVoice(sovInput);

    // Brand scalar scores (reach carries its basis: traffic vs brand_demand proxy).
    const { score: brandReach, basis: brandReachBasis } = reachScore(brandSignals, sov[brand_id]);
    const brandAggression = aggressionScore(brandSignals);
    const brandPromoNorm = promoActivityNorm(brandSignals.promoSignalCount);

    // Competitor states + threat inputs.
    const competitorStates: CompetitorState[] = [];
    const threatComps: { name: string; t: ThreatInputs }[] = [];
    for (const c of rivals) {
      const s = rivalSignals.get(c.id)!;
      const { score: cReach, basis: cReachBasis } = reachScore(s, sov[c.id]);
      const cAggr = aggressionScore(s);
      const cPromoNorm = promoActivityNorm(s.promoSignalCount);
      competitorStates.push({
        id: c.id,
        name: c.name,
        reachScore: cReach ?? 0,
        aggressionScore: cAggr ?? 0,
        sovPct: sov[c.id] ?? 0,
        // per-competitor threat is a brand-relative rollup, not a per-competitor scalar at MVP
        threatScore: null,
        estimatedMonthlyTraffic: s.estMonthlyTraffic,
        reachBasis: cReachBasis,
      });
      threatComps.push({
        name: c.name,
        t: { aggression: cAggr, promoActivityNorm: cPromoNorm, reach: cReach, aiVisibility: s.aiVisibility },
      });
    }

    const brandThreatInputs: ThreatInputs = {
      aggression: brandAggression,
      promoActivityNorm: brandPromoNorm,
      reach: brandReach,
      aiVisibility: brandAiVisibility,
    };
    const threat = threatScore(brandThreatInputs, threatComps);

    // Radar: brand vector + market-average across rivals (§7; Social/Engagement = null).
    const brandRadar = radarAxes(brandSignals);
    const rivalVectors = rivals.map((c) => radarAxes(rivalSignals.get(c.id)!));
    const radar_data: RadarData = {
      axes: [...RADAR_AXES],
      brand: brandRadar,
      marketAvg: marketAverage(rivalVectors),
    };

    // ── Step 3: partial fallback (failed modules borrow last week's contribution) ──
    // weekly_cache merges new-where-available + prev-where-failed (data-flow-rules §4).
    // Apply scalar-level fallback for the brand's headline scores when their primary
    // module failed and we have a previous value (pickScore handles the merge).
    const reach_score = pickScore(brandReach, failedModules.includes("traffic_seo"), prevCache?.reach_score);
    const aggression_score = pickScore(
      brandAggression,
      failedModules.includes("promotions") && failedModules.includes("tech_stack"),
      prevCache?.aggression_score,
    );
    const sov_pct = pickScore(sov[brand_id], failedModules.includes("traffic_seo"), prevCache?.sov_pct);
    const ai_visibility_score = pickScore(brandAiVisibility, geoFailed, prevCache?.ai_visibility_score);
    const threat_score = threat.score;

    // Feature health per module.
    const healthRows = MODULE_KEYS.map((key) => {
      const meta = MODULE_HEALTH[key];
      let status = "healthy";
      let root: string | null = null;
      if (failedModules.includes(key)) {
        status = prevCache ? "degraded" : "down";
        root = prevCache ? "module failed; using previous-week cache" : "module failed; no fallback available";
      } else if (partialModules.includes(key)) {
        status = "degraded";
        root = "partial data this week";
      }
      return { key, meta, status, root };
    });
    await Promise.allSettled(
      healthRows.map((h) =>
        recordFeatureHealth(sb, {
          scan_job_id,
          brand_id,
          scan_week,
          feature_category: h.meta.category,
          feature_name: h.meta.name,
          status: h.status,
          root_cause: h.root,
        })
      ),
    );
    // Social/Engagement = Apify, never built at MVP → not_applicable_mvp.
    await recordFeatureHealth(sb, {
      scan_job_id,
      brand_id,
      scan_week,
      feature_category: "social",
      feature_name: "Social & Engagement",
      status: "not_applicable_mvp",
      root_cause: "Apify excluded at MVP (Phase 2)",
    });

    // ── Step 4: UPSERT weekly_cache + competitor_profiles ──
    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + EIGHT_DAYS_MS).toISOString();

    const { error: wcErr } = await sb.from("weekly_cache").upsert(
      {
        brand_id,
        scan_week,
        scan_job_id,
        reach_score,
        aggression_score,
        threat_score,
        sov_pct,
        threat_level: threat.level,
        threat_reasons: threat.reasons,
        ai_visibility_score,
        ai_visibility_trend: aiTrend,
        competitors_tracked: rivals.length,
        competitor_states: competitorStates as unknown as Record<string, unknown>[],
        radar_data: radar_data as unknown as Record<string, unknown>,
        // Score-basis honesty flags (scoring-formulas §1/§4 amendments): traffic vs
        // brand_demand proxy. competitor_states rows carry per-entity reachBasis.
        raw_data: { reach_basis: brandReachBasis, sov_basis: sovBasis } as unknown as Record<string, unknown>,
        cached_at: nowIso,
        expires_at: expiresIso,
        updated_at: nowIso,
      },
      { onConflict: "brand_id,scan_week" },
    );
    if (wcErr) throw new Error(`weekly_cache upsert: ${wcErr.message}`);

    // competitor_profiles per rival (onConflict competitor_id,scan_week).
    await Promise.allSettled(
      rivals.map((c) => {
        const s = rivalSignals.get(c.id)!;
        const { score: cReach } = reachScore(s, sov[c.id]);
        const cAggr = aggressionScore(s);
        const organic = s.estMonthlyTraffic;
        const tech = md.techByCompetitor.get(c.id);
        const techCount = Array.isArray(tech?.technologies)
          ? (tech!.technologies as unknown[]).length
          : Array.isArray(tech?.ad_networks)
            ? (tech!.ad_networks as unknown[]).length
            : null;
        return sb.from("competitor_profiles").upsert(
          {
            competitor_id: c.id,
            scan_week,
            reach_score: cReach,
            aggression_score: cAggr,
            threat_score: null, // brand-relative threat is a brand-level rollup, not per-competitor at MVP
            sov_pct: sov[c.id] ?? null,
            estimated_monthly_traffic: organic,
            paid_traffic_pct: s.paidTrafficPct,
            domain_authority: s.domainAuthority,
            tech_stack_count: techCount,
            updated_at: nowIso,
          },
          { onConflict: "competitor_id,scan_week" },
        );
      }),
    );

    // ── Step 5: action_plans + recommendations ──
    const recs = (body.recommendations ?? []).filter((r) => r.confidence_level !== "rejected");
    // Rank by urgency (urgent>watch>opportunity>info) then confidence desc.
    const urgencyRank: Record<string, number> = { urgent: 0, watch: 1, opportunity: 2, info: 3 };
    const ordered = [...recs].sort((a, b) => {
      const u = (urgencyRank[a.urgency] ?? 9) - (urgencyRank[b.urgency] ?? 9);
      if (u !== 0) return u;
      return (b.confidence_score ?? 0) - (a.confidence_score ?? 0);
    });

    const urgent_count = ordered.filter((r) => r.urgency === "urgent").length;
    const watch_count = ordered.filter((r) => r.urgency === "watch").length;
    const opportunity_count = ordered.filter((r) => r.urgency === "opportunity").length;

    // IDEMPOTENT (at-least-once delivery): synthesis can legitimately run twice for
    // the same job (queue redelivery, reconciler re-fire). A plain INSERT here hit
    // the (brand_id,scan_week) unique constraint on the second run and marked an
    // otherwise-successful scan 'failed'. Upsert the plan, then REPLACE the week's
    // recommendations so a re-run converges to the latest synthesis instead of erroring.
    const { data: plan, error: planErr } = await sb
      .from("action_plans")
      .upsert(
        {
          brand_id,
          scan_week,
          scan_job_id,
          total_recommendations: ordered.length,
          urgent_count,
          watch_count,
          opportunity_count,
        },
        { onConflict: "brand_id,scan_week" },
      )
      .select("id")
      .single();
    if (planErr || !plan) throw new Error(`action_plans upsert: ${planErr?.message ?? "missing"}`);

    // Replace (not append) this week's recommendations for the brand.
    const { error: delErr } = await sb
      .from("recommendations")
      .delete()
      .eq("brand_id", brand_id)
      .eq("scan_week", scan_week);
    if (delErr) throw new Error(`recommendations replace-delete: ${delErr.message}`);

    let recommendationsInserted = 0;
    if (ordered.length > 0) {
      const rows = ordered.map((r, i) => ({
        brand_id,
        action_plan_id: plan.id,
        scan_week,
        rank: i + 1,
        urgency: r.urgency,
        category: r.category,
        headline: r.headline,
        trigger_reason: r.trigger_reason,
        confidence_score: r.confidence_score,
        confidence_level: r.confidence_level,
        evidence: (r.evidence ?? []) as unknown as Record<string, unknown>[],
        assumption_flags: r.assumption_flags ?? [],
        is_direct_evidence: r.is_direct_evidence ?? true,
        competitor_id: r.competitor_id ?? null,
        full_analysis: r.full_analysis ?? null,
        evidence_traceability_score: r.evidence_traceability_score ?? null,
        brand_alignment_score: r.brand_alignment_score ?? null,
        logic_quality_score: r.logic_quality_score ?? null,
        compliance_score: r.compliance_score ?? null,
        status: "open",
      }));
      const { error: recErr, count } = await sb
        .from("recommendations")
        .insert(rows, { count: "exact" });
      if (recErr) throw new Error(`recommendations insert: ${recErr.message}`);
      recommendationsInserted = count ?? rows.length;
    }

    // ── Step 6: asset pre-generation — OUT OF SCOPE (owned by /api/assets/generate). ──
    // Do NOT fabricate generated_assets here.

    // ── Step 7: final scan_jobs status ──
    // completed: no failed modules. partial: ≥1 failed but some data produced.
    // failed: zero modules produced any data (no caches at all this week).
    const anyData =
      md.seoByCompetitor.size > 0 ||
      md.promoByCompetitor.size > 0 ||
      md.techByCompetitor.size > 0 ||
      md.customerByCompetitor.size > 0 ||
      md.geo != null;
    let status: "completed" | "partial" | "failed";
    if (!anyData) status = "failed";
    else if (failedModules.length > 0 || partialModules.length > 0) status = "partial";
    else status = "completed";

    const startedMs = job.started_at ? new Date(job.started_at as string).getTime() : Date.now();
    await setScanStatus(sb, scan_job_id, status, {
      completed_at: nowIso,
      progress_percentage: 100,
      duration_seconds: Math.max(0, Math.round((Date.now() - startedMs) / 1000)),
      total_cost_usd: job.total_cost_usd ?? null,
    });

    // ── Step 8: scan-complete notification ──
    // TODO(notify): send scan-complete email via Supabase Auth email (documented
    // channel). Resend is an MVP hard-exclusion — do NOT integrate it here.

    return json({ ok: true, status, recommendationsInserted });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Surface a failed terminal state so the brand falls back to previous-week cache.
    await setScanStatus(sb, scan_job_id, "failed", {
      error_message: message,
      completed_at: new Date().toISOString(),
    }).catch(() => {});
    return json({ ok: false, error: message }, 500);
  }
});

// ---- local helpers ----
const MODULE_KEYS = [
  "traffic_seo",
  "geo_aeo",
  "tech_stack",
  "app_store",
  "customer",
  "regulatory",
  "promotions",
  "hiring",
] as const;

function emptySignals(aiVisibility: number | null): EntitySignals {
  return {
    estMonthlyTraffic: null,
    organicKeywordCount: null,
    paidTrafficPct: null,
    adNetworkCount: null,
    promoSignalCount: null,
    bonusKeywordMovement: null,
    domainAuthority: null,
    avgAppRating: null,
    aiVisibility,
  };
}

function asNumLocal(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
/** Use the fresh value unless its module failed and a previous-week value exists. */
function pickScore(fresh: number | null, moduleFailed: boolean, prev: unknown): number | null {
  if (!moduleFailed) return fresh;
  const p = asNumLocal(prev);
  return p ?? fresh;
}
