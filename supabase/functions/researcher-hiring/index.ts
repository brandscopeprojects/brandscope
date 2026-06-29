// researcher-hiring — Hiring-Signals Researcher (mvp-module-sources.md §9).
// PARTIAL COVERAGE: the ONLY source is the DataForSEO Google Jobs SERP
// (serp/google/jobs/live/advanced). NO Firecrawl, NO career-page crawl, NO full
// job-description bodies — we surface job titles/locations/dates and the strategic
// signals Haiku interprets from them, and never imply full coverage. Job text is
// UNTRUSTED → wrapped via asUntrustedData before it reaches the model (guard.ts).
//
// Pipeline position (agent-orchestration.md): a scan_modules consumer. Invoked by
// brand-scan with `Authorization: Bearer ${CRON_SECRET}` and a ScanModuleMessage
// body (task_type 'hiring'). Per competitor × market: fetch Jobs SERP → Haiku
// classify (one LLM call, agent_name 'researcher') → UPSERT hiring_signals_cache.
// On finish: completeModule → (if fan-out done) enqueue + invoke synthesis.
// Per data-flow-rules.md §4: Promise.allSettled over competitors, 90s budget,
// single-competitor failure never blocks others.
//
// FILE OWNERSHIP: only researcher-hiring/**; never edits _shared or siblings.

import { serviceClient } from "../_shared/supabase.ts";
import { json, preflight, isAuthorizedInternal } from "../_shared/http.ts";
import { logAgentJob, recordFeatureHealth, toDeadLetter } from "../_shared/logging.ts";
import { completeModule, enqueueSynthesis, invokeFunction } from "../_shared/scan.ts";
import {
  type CompetitorRef,
  type ScanModuleMessage,
  type ScanSynthesisMessage,
} from "../_shared/contracts.ts";
import type { SupabaseClient } from "../_shared/supabase.ts";
import { fetchJobPostings, type JobPosting } from "./dataforseo-jobs.ts";
import { classifyHiring } from "./classify.ts";

const MODULE_BUDGET_MS = 90_000; // data-flow-rules.md §4 per-module timeout.
const TASK = "hiring" as const;

/** Fetch all markets' postings for a competitor, settling per market so one
 *  failed market never drops the others. Bounded result count per market. */
async function fetchAllMarkets(
  competitorName: string,
  markets: string[],
): Promise<JobPosting[]> {
  const ms = markets.length > 0 ? markets : ["NG"]; // default Nigeria (MVP market)
  const settled = await Promise.allSettled(
    ms.map((m) => fetchJobPostings(competitorName, m)),
  );
  const out: JobPosting[] = [];
  for (const r of settled) if (r.status === "fulfilled") out.push(...r.value);
  return out;
}

/** Fetch + classify + UPSERT one competitor. Returns whether it succeeded. */
async function processCompetitor(
  sb: SupabaseClient,
  msg: ScanModuleMessage,
  competitor: CompetitorRef,
): Promise<{ ok: boolean }> {
  const start = Date.now();
  try {
    // 1. DataForSEO Google Jobs SERP across the brand's markets (PARTIAL source).
    const postings = await fetchAllMarkets(competitor.name, msg.markets ?? []);

    // 2. Haiku classification → roles / interpreted signals / geo expansion / tags.
    //    The single LLM step; it writes its own agent_job_logs row (loggedLlm).
    const classified = await classifyHiring(
      sb,
      {
        scanJobId: msg.scan_job_id,
        brandId: msg.brand_id,
        taskType: TASK,
        competitorName: competitor.name,
      },
      postings,
    );

    // 3. UPSERT hiring_signals_cache (onConflict brand_id,scan_week,competitor_id).
    //    raw_data keeps the real Jobs SERP payload for the evidence chain — no JD bodies.
    const { error: upsertError } = await sb
      .from("hiring_signals_cache")
      .upsert(
        {
          brand_id: msg.brand_id,
          competitor_id: competitor.id,
          scan_week: msg.scan_week,
          roles: classified.roles as unknown as Record<string, unknown>[],
          interpreted_signals: classified.interpretedSignals as unknown as Record<string, unknown>[],
          geographic_expansion: classified.geographicExpansion as unknown as Record<string, unknown>[],
          signal_types: classified.signalTypes,
          raw_data: {
            source: "dataforseo:serp/google/jobs/live/advanced",
            coverage: "partial", // titles/locations/dates only — no career crawl, no JD text
            markets: msg.markets ?? [],
            postings_found: postings.length,
            postings, // titles/locations/dates/urls — the verifiable source rows
            scanned_at: new Date().toISOString(),
          } as unknown as Record<string, unknown>,
        },
        { onConflict: "brand_id,scan_week,competitor_id" },
      );
    if (upsertError) throw new Error(`upsert hiring_signals_cache: ${upsertError.message}`);

    // 4. Observability (the Haiku call already logged via loggedLlm; this records
    //    the per-competitor module outcome + data quality).
    await logAgentJob(sb, {
      scan_job_id: msg.scan_job_id,
      brand_id: msg.brand_id,
      agent_name: "researcher",
      task_type: TASK,
      model_used: null, // module-level summary row (the LLM row is logged separately)
      status: "passed",
      duration_ms: Date.now() - start,
      data_quality_score: classified.dataQualityScore,
      input_snapshot: { competitor_id: competitor.id, name: competitor.name, postings: postings.length },
      output_snapshot: {
        roles: classified.roles.length,
        interpreted_signals: classified.interpretedSignals.length,
        geographic_expansion: classified.geographicExpansion.length,
        signal_types: classified.signalTypes,
      },
    });

    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logAgentJob(sb, {
      scan_job_id: msg.scan_job_id,
      brand_id: msg.brand_id,
      agent_name: "researcher",
      task_type: TASK,
      model_used: null,
      status: "failed",
      duration_ms: Date.now() - start,
      data_quality_score: 0,
      error_message: message,
      input_snapshot: { competitor_id: competitor.id, name: competitor.name },
    });
    return { ok: false };
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
  if (!msg?.scan_job_id || !msg?.brand_id || msg?.task_type !== TASK) {
    return json({ error: "expected ScanModuleMessage with task_type 'hiring'" }, 400);
  }

  try {
    const competitors = Array.isArray(msg.competitors) ? msg.competitors : [];

    // Bound the whole module to 90s — never let a slow SERP/LLM hang the worker.
    const budget = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), MODULE_BUDGET_MS)
    );
    const work = Promise.allSettled(
      competitors.map((c) => processCompetitor(sb, msg, c)),
    );
    const raced = await Promise.race([work, budget]);

    let anyFail = false;
    let anyOk = false;

    if (raced === "timeout") {
      anyFail = true; // budget exhausted → partial; monitor retries via DLQ
    } else {
      for (const r of raced) {
        if (r.status === "fulfilled" && r.value.ok) anyOk = true;
        else anyFail = true;
      }
    }

    // A genuine failure with zero successes → DLQ for the 6h monitor to retry.
    if (anyFail && !anyOk && competitors.length > 0) {
      await toDeadLetter(sb, {
        task_type: TASK,
        payload: msg,
        brand_id: msg.brand_id,
        scan_job_id: msg.scan_job_id,
        failure_reason: "all competitors failed in researcher-hiring",
      });
      await recordFeatureHealth(sb, {
        scan_job_id: msg.scan_job_id,
        brand_id: msg.brand_id,
        scan_week: msg.scan_week,
        feature_category: "hiring",
        feature_name: "Hiring & Signals",
        status: "down",
        root_cause: "Google Jobs SERP / classification failed for all competitors",
        resolution_suggested: "Retry via between-cycle monitor; check DataForSEO Jobs SERP availability.",
      });
    } else if (anyFail) {
      // Partial: some competitors/markets failed → previous-week fallback applies.
      await recordFeatureHealth(sb, {
        scan_job_id: msg.scan_job_id,
        brand_id: msg.brand_id,
        scan_week: msg.scan_week,
        feature_category: "hiring",
        feature_name: "Hiring & Signals",
        status: "degraded",
        root_cause: "Hiring signals unavailable for some competitors this week",
        resolution_suggested: "Falls back to previous week for affected competitors; retries in 6h.",
      });
    }

    // No competitors is a valid no-op (brand tracks none) → module is 'ok'.
    const outcome = competitors.length === 0 ? "ok" : anyFail ? "partial" : "ok";

    // completeModule returns true exactly once when the fan-out finishes → only
    // then enqueue + invoke synthesis (agent-orchestration.md completion detection).
    const fanOutComplete = await completeModule(sb, msg.scan_job_id, TASK, outcome);
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
      module: TASK,
      outcome,
      competitors: competitors.length,
      synthesis_triggered: fanOutComplete,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Unexpected fatal error: DLQ + mark partial so the job can still complete
    // with previous-week fallback (data-flow-rules.md §4).
    await toDeadLetter(sb, {
      task_type: TASK,
      payload: msg,
      brand_id: msg.brand_id,
      scan_job_id: msg.scan_job_id,
      failure_reason: "fatal error in researcher-hiring",
      last_error: message,
    });
    try {
      const done = await completeModule(sb, msg.scan_job_id, TASK, "partial");
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
      // completeModule itself failed — the 6h monitor reconciles via DLQ.
    }
    return json({ ok: false, error: message }, 500);
  }
});
