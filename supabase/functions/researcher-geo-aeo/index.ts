// researcher-geo-aeo — GEO/AEO Researcher (AI answer-engine visibility).
//
// Module task_type 'geo_aeo' (contracts.ts). Consumes a ScanModuleMessage from
// brand-scan (direct invoke) / the scan_modules queue. Per agent-orchestration.md
// §"Per-agent I/O contracts": reads competitors + external APIs, writes its OWN
// cache table (geo_cache), logs every LLM call to agent_job_logs, and on the
// fan-out-completing call enqueues synthesis.
//
// Sources (mvp-module-sources.md §2 GEO + §3 AEO):
//   - ChatGPT / Claude / Gemini → DataForSEO ai_optimization/<engine>/llm_responses
//        task_post + poll task_get (Standard Queue), bounded to ~60s.
//   - Perplexity → ai_optimization/perplexity/llm_responses/live (Live only).
//   - Mentions → ai_optimization/llm_mentions/search/live + aggregated_metrics/live.
//   - AEO → serp/google/organic/live/advanced (featured snippets + PAA).
// 4 platforms ONLY. Grok (xAI) + Meta/Llama (Together) are Phase 2 → geo_cache
// grok_* columns left NULL, never faked. (geo_cache has no meta_ai_* columns.)
//
// Budget: ≤90s (data-flow-rules.md §4). Poll waits are bounded; engines run with
// Promise.allSettled so one engine failing never blocks the others.

import { serviceClient } from "../_shared/supabase.ts";
import { json, preflight, isAuthorizedInternal } from "../_shared/http.ts";
import { completeModule, invokeFunction } from "../_shared/scan.ts";
import { recordFeatureHealth, toDeadLetter } from "../_shared/logging.ts";
import type { ScanModuleMessage } from "../_shared/contracts.ts";
import { languageCode } from "../_shared/dataforseo.ts";
import {
  PLATFORMS,
  loadQueries,
  runEngine,
  analysePlatform,
  visibilityScore,
  fetchMentionMetrics,
  fetchAeo,
  type PlatformAnalysis,
} from "./geo.ts";

// Bounded poll window for the three task_post engines, well under the 90s budget.
const ENGINE_MAX_WAIT_MS = 60_000;

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
  if (!msg?.scan_job_id || !msg?.brand_id || !msg?.scan_week) {
    return json({ error: "scan_job_id, brand_id, scan_week are required" }, 400);
  }
  if (msg.task_type !== "geo_aeo") {
    return json({ error: `wrong task_type for researcher-geo-aeo: ${msg.task_type}` }, 400);
  }

  const market = msg.markets?.[0] ?? "nigeria";

  try {
    // 1. Load the 15-query GEO set (brand name + market injected).
    const queries = await loadQueries(sb, msg.brand_name, market);
    if (queries.length === 0) {
      // No templates seeded → we cannot run the module meaningfully. Treat as
      // partial: record health, do not write a fabricated row.
      await recordFeatureHealth(sb, {
        scan_job_id: msg.scan_job_id,
        brand_id: msg.brand_id,
        scan_week: msg.scan_week,
        feature_category: "geo",
        feature_name: "GEO/AEO Visibility",
        status: "partial",
        root_cause: "geo_query_templates returned no active queries for this market",
        resolution_suggested: "Seed geo_query_templates (15-query set) for the brand's market",
      });
      return await finish(sb, msg, "partial");
    }

    // 2. Dispatch the four engines in parallel (allSettled — isolate failures).
    const engineResults = await Promise.allSettled(
      PLATFORMS.map((p) =>
        runEngine(p, queries, { maxWaitMs: ENGINE_MAX_WAIT_MS }).then((responses) => ({ p, responses })),
      ),
    );

    // 2b. Mentions + AEO in parallel with each other (independent of engines).
    const [mentionsSettled, aeoSettled] = await Promise.allSettled([
      fetchMentionMetrics(msg.brand_name),
      fetchAeo(msg.brand_domain, queries, market, languageCode(msg.markets)),
    ]);
    const mentions =
      mentionsSettled.status === "fulfilled" ? mentionsSettled.value : { topMentions: [], raw: null };
    const aeo =
      aeoSettled.status === "fulfilled"
        ? aeoSettled.value
        : { featuredSnippets: [], paaAppearances: [], raw: null };

    // 3. Haiku-classify each engine's responses → per-platform analysis.
    const analyses: Partial<Record<string, PlatformAnalysis>> = {};
    const rawByPlatform: Record<string, unknown> = {};
    let engineSuccessCount = 0;

    for (const settled of engineResults) {
      if (settled.status !== "fulfilled") continue;
      const { p, responses } = settled.value;
      rawByPlatform[p.key] = responses;
      if (responses.length === 0) continue;
      engineSuccessCount++;
      try {
        const { analysis } = await analysePlatform(
          sb,
          { scanJobId: msg.scan_job_id, brandId: msg.brand_id },
          msg.brand_name,
          p,
          responses,
        );
        analyses[p.key] = analysis;
      } catch (_e) {
        // a single engine's Haiku pass failing shouldn't drop the whole module
      }
    }

    const orderedAnalyses = PLATFORMS.map((p) => analyses[p.key]).filter(
      (a): a is PlatformAnalysis => Boolean(a),
    );

    // 4. AI Visibility Score (mentions×50 + sentiment×30 + position×20, 0-100).
    const aiVisibilityScore = orderedAnalyses.length > 0 ? visibilityScore(orderedAnalyses) : null;

    // 5. score_change_wow vs the previous week's geo_cache row, if any.
    const scoreChangeWow = await computeWowDelta(sb, msg.brand_id, msg.scan_week, aiVisibilityScore);

    // 6. Competitor AI scores — placeholder structure derived from mentions is NOT
    // computed here (would require per-competitor engine passes beyond budget);
    // we persist an empty array so the frontend contract holds. Populated in a
    // later sub-step / by the brand's own pass. (Never fabricated.)
    const competitorAiScores: Array<{ competitorName: string; score: number }> = [];

    // 7. Build the per-platform column payload (4 platforms; grok_* left NULL).
    const checkedAt = new Date().toISOString();
    const platformColumns: Record<string, unknown> = {};
    for (const p of PLATFORMS) {
      const a = analyses[p.key];
      platformColumns[`${p.key}_mentioned`] = a ? a.mentioned : null;
      platformColumns[`${p.key}_position`] = a ? a.position : null;
      platformColumns[`${p.key}_sentiment`] = a ? a.sentiment : null;
      platformColumns[`${p.key}_response_sample`] = a ? a.responseSample : null;
      platformColumns[`${p.key}_checked_at`] = a ? checkedAt : null;
    }

    // 8. UPSERT geo_cache on (brand_id, scan_week). Grok columns stay NULL (Phase 2).
    const { error: upsertError } = await sb.from("geo_cache").upsert(
      {
        brand_id: msg.brand_id,
        scan_week: msg.scan_week,
        ai_visibility_score: aiVisibilityScore,
        score_change_wow: scoreChangeWow,
        ...platformColumns,
        competitor_ai_scores: competitorAiScores,
        featured_snippets: aeo.featuredSnippets,
        paa_appearances: aeo.paaAppearances,
        top_ai_mentions: mentions.topMentions,
        raw_data: {
          engines: rawByPlatform,
          mentions: mentions.raw,
          aeo: aeo.raw,
          query_count: queries.length,
        },
      },
      { onConflict: "brand_id,scan_week" },
    );
    if (upsertError) throw new Error(`geo_cache upsert: ${upsertError.message}`);

    // 9. Health + completion. Partial if not all four engines returned data.
    const fullCoverage = engineSuccessCount === PLATFORMS.length && aiVisibilityScore !== null;
    await recordFeatureHealth(sb, {
      scan_job_id: msg.scan_job_id,
      brand_id: msg.brand_id,
      scan_week: msg.scan_week,
      feature_category: "geo",
      feature_name: "GEO/AEO Visibility",
      status: fullCoverage ? "passed" : "partial",
      root_cause: fullCoverage
        ? null
        : `${engineSuccessCount}/${PLATFORMS.length} answer engines returned data`,
    });

    return await finish(sb, msg, fullCoverage ? "ok" : "partial");
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await recordFeatureHealth(sb, {
      scan_job_id: msg.scan_job_id,
      brand_id: msg.brand_id,
      scan_week: msg.scan_week,
      feature_category: "geo",
      feature_name: "GEO/AEO Visibility",
      status: "failed",
      root_cause: message,
    });
    await toDeadLetter(sb, {
      task_type: "geo_aeo",
      payload: msg,
      brand_id: msg.brand_id,
      scan_job_id: msg.scan_job_id,
      failure_reason: "researcher-geo-aeo failed",
      last_error: message,
    });
    try {
      await finish(sb, msg, "failed");
    } catch (_e) {
      // completion bookkeeping failed too — DLQ already holds the task
    }
    return json({ ok: false, error: message }, 500);
  }
});

/**
 * Record the module outcome on scan_jobs; if this call completed the fan-out,
 * enqueue synthesis (synthesis-draft-audit). Mirrors the shared researcher skeleton.
 */
async function finish(
  sb: ReturnType<typeof serviceClient>,
  msg: ScanModuleMessage,
  outcome: "ok" | "partial" | "failed",
): Promise<Response> {
  const completedFanout = await completeModule(sb, msg.scan_job_id, "geo_aeo", outcome);
  if (completedFanout) {
    await invokeFunction("synthesis-draft-audit", {
      scan_job_id: msg.scan_job_id,
      brand_id: msg.brand_id,
      scan_week: msg.scan_week,
    });
  }
  return json({ ok: outcome !== "failed", outcome, synthesis_enqueued: completedFanout });
}

/**
 * score_change_wow = thisWeek - prevWeek's ai_visibility_score, or null when there
 * is no prior row / no score this week.
 */
async function computeWowDelta(
  sb: ReturnType<typeof serviceClient>,
  brandId: string,
  scanWeek: string,
  thisScore: number | null,
): Promise<number | null> {
  if (thisScore === null) return null;
  const { data: prev } = await sb
    .from("geo_cache")
    .select("ai_visibility_score, scan_week")
    .eq("brand_id", brandId)
    .lt("scan_week", scanWeek)
    .order("scan_week", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!prev || prev.ai_visibility_score === null) return null;
  return thisScore - (prev.ai_visibility_score as number);
}
