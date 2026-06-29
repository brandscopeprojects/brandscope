// researcher-tech-stack — Tech-Stack & Ad-Network Researcher (DetectZeStack).
// mvp-module-sources.md §4: DetectZeStack /analyze is ALREADY STRUCTURED → NO LLM.
// Spend-intensity is computed in CODE (heuristic), never fabricated. Writes
// tech_stack_cache, which is keyed by competitor_id + scan_week (NO brand_id) —
// but we only ever process this brand's own msg.competitors (isolation rule).
//
// Pipeline position (agent-orchestration.md): a scan_modules consumer. Invoked by
// brand-scan with `Authorization: Bearer ${CRON_SECRET}` and a ScanModuleMessage
// body (task_type 'tech_stack'). On finish: completeModule → (if fan-out done)
// enqueue + invoke synthesis. Per data-flow-rules.md §4: Promise.allSettled over
// competitors, 90s budget, single-competitor failure never blocks others.
//
// FILE OWNERSHIP: only researcher-tech-stack/**; never edits _shared or siblings.

import { serviceClient } from "../_shared/supabase.ts";
import { json, preflight, isAuthorizedInternal } from "../_shared/http.ts";
import { analyzeDomain, type TechStackResult } from "../_shared/detectzestack.ts";
import { logAgentJob, recordFeatureHealth, toDeadLetter } from "../_shared/logging.ts";
import { completeModule, enqueueSynthesis, invokeFunction } from "../_shared/scan.ts";
import {
  type CompetitorRef,
  type ScanModuleMessage,
  type ScanSynthesisMessage,
} from "../_shared/contracts.ts";
import type { SupabaseClient } from "../_shared/supabase.ts";

const MODULE_BUDGET_MS = 90_000; // data-flow-rules.md §4 per-module timeout.

/** changes_detected jsonb element (mirrors lib/data/tech-stack.ts TechStackChange). */
type TechStackChange = { type: "added" | "removed"; technology: string; detectedAt: string };

/**
 * SPEND-INTENSITY HEURISTIC (0–100), computed in CODE — NOT a spend amount.
 * Rationale: DetectZeStack returns no spend figures, so we never fabricate money.
 * We proxy *investment in paid acquisition + monetisation infrastructure* from the
 * count of detected ad networks and payment gateways (both correlate with how much
 * a competitor is spending to acquire and convert).
 *
 *   adSignal      = min(adNetworks.length, 6) / 6        → 0..1  (paid-acquisition surface)
 *   paySignal     = min(paymentGateways.length, 4) / 4   → 0..1  (monetisation surface)
 *   intensity     = round( 100 * (0.7 * adSignal + 0.3 * paySignal) )
 *
 * Ad networks dominate (0.7) because they are the direct paid-marketing signal;
 * payment gateways (0.3) indicate conversion infrastructure depth. Caps prevent a
 * single noisy field from saturating the score. Result is a relative 0–100 signal.
 */
function computeSpendIntensity(adNetworks: string[], paymentGateways: string[]): number {
  const adSignal = Math.min(adNetworks.length, 6) / 6;
  const paySignal = Math.min(paymentGateways.length, 4) / 4;
  return Math.round(100 * (0.7 * adSignal + 0.3 * paySignal));
}

/** Data-quality score (0–1) from completeness of the structured response. */
function dataQuality(r: TechStackResult): number {
  const surfaces = [
    r.adNetworks.length,
    r.analyticsTools.length,
    r.cdnProviders.length,
    r.crmTools.length,
    r.paymentGateways.length,
    r.technologies.length,
  ];
  const populated = surfaces.filter((n) => n > 0).length;
  return Number((populated / surfaces.length).toFixed(2));
}

/** A 401 from DetectZeStack means the key is invalid/awaiting the owner (mvp §4). */
function isUnauthorized(message: string): boolean {
  return /\b401\b/.test(message) || /invalid api key/i.test(message);
}

/** Diff this week's technology names vs the previous week's tech_stack_cache row. */
function diffTechnologies(
  prevNames: string[],
  currNames: string[],
  detectedAt: string,
): TechStackChange[] {
  const prev = new Set(prevNames);
  const curr = new Set(currNames);
  const changes: TechStackChange[] = [];
  for (const name of curr) if (!prev.has(name)) changes.push({ type: "added", technology: name, detectedAt });
  for (const name of prev) if (!curr.has(name)) changes.push({ type: "removed", technology: name, detectedAt });
  return changes;
}

/** All distinct technology names across every detected surface (for diffing). */
function allTechNames(r: TechStackResult): string[] {
  return [
    ...r.adNetworks,
    ...r.analyticsTools,
    ...r.cdnProviders,
    ...r.crmTools,
    ...r.paymentGateways,
    ...r.technologies.map((t) => t.name),
  ];
}

type CompetitorOutcome = { ok: boolean; unauthorized: boolean };

/** Analyze + UPSERT one competitor. Returns whether it succeeded / hit a 401. */
async function processCompetitor(
  sb: SupabaseClient,
  msg: ScanModuleMessage,
  competitor: CompetitorRef,
): Promise<CompetitorOutcome> {
  const start = Date.now();
  try {
    // 1. Structured fetch — NO LLM (response already structured, mvp §4).
    const result = await analyzeDomain(competitor.domain);

    // 2. Spend-intensity signal computed in CODE (never a fabricated amount).
    const spendIntensity = computeSpendIntensity(result.adNetworks, result.paymentGateways);

    // 3. Detect changes vs the previous week's row for this competitor.
    const detectedAt = new Date().toISOString();
    const { data: prevRow } = await sb
      .from("tech_stack_cache")
      .select("scan_week, ad_networks, analytics_tools, cdn_providers, crm_tools, payment_gateways, technologies")
      .eq("competitor_id", competitor.id)
      .neq("scan_week", msg.scan_week)
      .order("scan_week", { ascending: false })
      .limit(1)
      .maybeSingle();

    let changes: TechStackChange[] = [];
    if (prevRow) {
      const prevTech = Array.isArray(prevRow.technologies)
        ? (prevRow.technologies as { name?: string }[]).map((t) => String(t.name ?? ""))
        : [];
      const prevNames = [
        ...(prevRow.ad_networks ?? []),
        ...(prevRow.analytics_tools ?? []),
        ...(prevRow.cdn_providers ?? []),
        ...(prevRow.crm_tools ?? []),
        ...(prevRow.payment_gateways ?? []),
        ...prevTech,
      ];
      changes = diffTechnologies(prevNames, allTechNames(result), detectedAt);
    }

    // 4. UPSERT tech_stack_cache (onConflict competitor_id,scan_week — NO brand_id).
    // spend_intensity has no dedicated column → stored inside raw_response (a real
    // computed value alongside the raw API payload, per data-flow-rules §2 evidence).
    const { error: upsertError } = await sb
      .from("tech_stack_cache")
      .upsert(
        {
          competitor_id: competitor.id,
          scan_week: msg.scan_week,
          ad_networks: result.adNetworks,
          analytics_tools: result.analyticsTools,
          cdn_providers: result.cdnProviders,
          crm_tools: result.crmTools,
          payment_gateways: result.paymentGateways,
          technologies: result.technologies as unknown as Record<string, unknown>[],
          changes_detected: changes as unknown as Record<string, unknown>[],
          scanned_at: detectedAt,
          raw_response: {
            source: "detectzestack",
            domain: result.domain,
            spend_intensity: spendIntensity, // computed signal (0–100), not money
            api: result.raw,
          } as unknown as Record<string, unknown>,
        },
        { onConflict: "competitor_id,scan_week" },
      );
    if (upsertError) throw new Error(`upsert tech_stack_cache: ${upsertError.message}`);

    // 5. Observability — Researcher row even though there is no LLM call (Rule 4 spirit).
    await logAgentJob(sb, {
      scan_job_id: msg.scan_job_id,
      brand_id: msg.brand_id,
      agent_name: "researcher-tech-stack",
      task_type: msg.task_type,
      model_used: null, // no LLM — structured API response
      status: "passed",
      duration_ms: Date.now() - start,
      data_quality_score: dataQuality(result),
      input_snapshot: { competitor_id: competitor.id, domain: competitor.domain },
      output_snapshot: {
        ad_networks: result.adNetworks.length,
        technologies: result.technologies.length,
        spend_intensity: spendIntensity,
        changes: changes.length,
      },
    });

    return { ok: true, unauthorized: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const unauthorized = isUnauthorized(message);

    await logAgentJob(sb, {
      scan_job_id: msg.scan_job_id,
      brand_id: msg.brand_id,
      agent_name: "researcher-tech-stack",
      task_type: msg.task_type,
      model_used: null,
      status: "failed",
      duration_ms: Date.now() - start,
      data_quality_score: 0,
      error_message: message,
      input_snapshot: { competitor_id: competitor.id, domain: competitor.domain },
    });

    return { ok: false, unauthorized };
  }
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (!isAuthorizedInternal(req)) return json({ error: "unauthorized" }, 401);

  const sb = serviceClient();

  let msg: ScanModuleMessage;
  try {
    msg = (await req.json()) as ScanModuleMessage;
  } catch {
    return json({ error: "invalid json body" }, 400);
  }
  if (!msg?.scan_job_id || !msg?.brand_id || msg?.task_type !== "tech_stack") {
    return json({ error: "expected ScanModuleMessage with task_type 'tech_stack'" }, 400);
  }

  try {
    const competitors = Array.isArray(msg.competitors) ? msg.competitors : [];

    // Bound the whole module to 90s — never let one slow API hang the worker.
    const budget = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), MODULE_BUDGET_MS)
    );
    const work = Promise.allSettled(
      competitors.map((c) => processCompetitor(sb, msg, c)),
    );
    const raced = await Promise.race([work, budget]);

    let anyFail = false;
    let anyOk = false;
    let anyUnauthorized = false;

    if (raced === "timeout") {
      // Budget exhausted: treat as partial; the monitor retries via DLQ.
      anyFail = true;
    } else {
      for (const r of raced) {
        if (r.status === "fulfilled") {
          if (r.value.ok) anyOk = true;
          else {
            anyFail = true;
            if (r.value.unauthorized) anyUnauthorized = true;
          }
        } else {
          anyFail = true;
        }
      }
    }

    // 401 → key invalid / awaiting owner (mvp-module-sources.md §4). Degrade
    // gracefully: record feature health, mark module partial, do NOT crash.
    if (anyUnauthorized) {
      await recordFeatureHealth(sb, {
        scan_job_id: msg.scan_job_id,
        brand_id: msg.brand_id,
        scan_week: msg.scan_week,
        feature_category: "tech_stack",
        feature_name: "Tech Stack & Ad Network Intelligence",
        status: "degraded",
        root_cause: "awaiting valid DetectZeStack key",
        resolution_suggested: "Owner to confirm direct-vs-RapidAPI route and supply a valid DETECTZESTACK_API_KEY.",
      });
    }

    // A genuine (non-401) failure with zero successes → DLQ for monitor retry.
    if (anyFail && !anyOk && !anyUnauthorized && competitors.length > 0) {
      await toDeadLetter(sb, {
        task_type: msg.task_type,
        payload: msg,
        brand_id: msg.brand_id,
        scan_job_id: msg.scan_job_id,
        failure_reason: "all competitors failed in researcher-tech-stack",
      });
    }

    // No competitors is a valid no-op (brand tracks none) → module is 'ok'.
    const outcome = competitors.length === 0
      ? "ok"
      : anyFail
        ? "partial"
        : "ok";

    // completeModule returns true exactly once when the fan-out finishes → only
    // then enqueue + invoke synthesis (agent-orchestration.md completion detection).
    const fanOutComplete = await completeModule(sb, msg.scan_job_id, "tech_stack", outcome);
    if (fanOutComplete) {
      const synth: ScanSynthesisMessage = {
        scan_job_id: msg.scan_job_id,
        brand_id: msg.brand_id,
        scan_week: msg.scan_week,
      };
      await enqueueSynthesis(sb, synth);
      await invokeFunction("synthesis-draft-audit", synth);
    }

    return json({
      ok: true,
      module: "tech_stack",
      outcome,
      competitors: competitors.length,
      degraded: anyUnauthorized,
      synthesis_triggered: fanOutComplete,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Unexpected fatal error: route to DLQ and mark the module partial so the job
    // can still complete with previous-week fallback (data-flow-rules.md §4).
    await toDeadLetter(sb, {
      task_type: msg.task_type,
      payload: msg,
      brand_id: msg.brand_id,
      scan_job_id: msg.scan_job_id,
      failure_reason: "fatal error in researcher-tech-stack",
      last_error: message,
    });
    try {
      const done = await completeModule(sb, msg.scan_job_id, "tech_stack", "partial");
      if (done) {
        const synth: ScanSynthesisMessage = {
          scan_job_id: msg.scan_job_id,
          brand_id: msg.brand_id,
          scan_week: msg.scan_week,
        };
        await enqueueSynthesis(sb, synth);
        await invokeFunction("synthesis-draft-audit", synth);
      }
    } catch (_e) {
      // completeModule itself failed — the 6h monitor will reconcile via DLQ.
    }
    return json({ ok: false, error: message }, 500);
  }
});
