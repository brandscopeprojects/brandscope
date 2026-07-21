// researcher-geo-aeo — GEO/AEO Researcher (AI answer-engine visibility).
//
// Module task_type 'geo_aeo' (contracts.ts). Consumes a ScanModuleMessage from
// brand-scan (direct invoke) / the scan_modules queue. Per agent-orchestration.md
// §"Per-agent I/O contracts": reads competitors + external APIs, writes its OWN
// cache table (geo_cache), logs every LLM call to agent_job_logs, and on the
// fan-out-completing call enqueues synthesis.
//
// Sources (mvp-module-sources.md §2 GEO + §3 AEO) — GEO v2 provider routing:
//   - ChatGPT   → OpenAI Responses API + web_search (direct, our OPENAI key).
//   - Claude    → Anthropic Messages + web_search server tool (direct, our key).
//   - Gemini    → DataForSEO ai_optimization/gemini/llm_responses/live.
//   - Perplexity→ DataForSEO ai_optimization/perplexity/llm_responses/live.
//   - Mentions  → ai_optimization/llm_mentions/search/live + aggregated_metrics/live.
//   - AEO       → serp/google/organic/live/advanced (featured snippets + PAA).
// 4 platforms ONLY. Grok (xAI) + Meta/Llama (Together) are Phase 2 → geo_cache
// grok_* columns left NULL, never faked. (geo_cache has no meta_ai_* columns.)
//
// Cost model (GEO v2): brand-agnostic MARKET queries are fetched once per
// (market, week, engine) and SHARED across every brand via market_intel_cache;
// brand-specific queries run direct-provider only. ChatGPT/Claude direct replace
// the ~$0.20/query DataForSEO route with ~$0.01/query token cost.
//
// Budget: ≤90s (data-flow-rules.md §4). Per-call waits are bounded; engines run
// with Promise.allSettled so one engine failing never blocks the others.

import { serviceClient } from "../_shared/supabase.ts";
import { json, preflight, isAuthorizedInternal } from "../_shared/http.ts";
import { withMeter, setMeterCtx } from "../_shared/spend.ts";
import { completeModule, invokeFunction } from "../_shared/scan.ts";
import { recordFeatureHealth, toDeadLetter } from "../_shared/logging.ts";
import type { ScanModuleMessage } from "../_shared/contracts.ts";
import { languageCode } from "../_shared/dataforseo.ts";
import { optionalEnv } from "../_shared/env.ts";
import { getOrFetchMarketIntelKeyed } from "../_shared/market-cache.ts";
import {
  PLATFORMS,
  loadQueries,
  runQueriesConcurrent,
  analysePlatform,
  visibilityScore,
  fetchMentionMetrics,
  fetchAeo,
  type EngineResponse,
  type GeoQuery,
  type PlatformAnalysis,
  type PlatformDef,
} from "./geo.ts";

// COST CONTROL (GEO v2).
// Market queries (brand-agnostic, e.g. "best betting sites in {market}") run once
// per (market, week, engine) and are SHARED across every brand in the market via
// market_intel_cache — the biggest per-brand cost cut. Brand queries (name the
// brand) can't be shared, so they run direct-provider only (ChatGPT/Claude tokens
// are cheap) and never touch the expensive DataForSEO engines.
const MARKET_QUERY_LIMIT = 5; // shared across the market; ChatGPT/Claude direct + Gemini/Perplexity cached
const BRAND_QUERY_LIMIT = 3; // per-brand reputation checks, direct providers only

// Engine kill-switch dial: comma-separated platform keys to skip (Gemini is the
// first to cut — its DataForSEO grounding fee dominates GEO cost). e.g. "gemini".
const DISABLED_ENGINES = new Set(
  (optionalEnv("GEO_DISABLED_ENGINES") ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

Deno.serve(withMeter(async (req) => {
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
  setMeterCtx({ sb, organisation_id: msg.organisation_id ?? null, brand_id: msg.brand_id, scan_job_id: msg.scan_job_id, task_type: msg.task_type });

  const market = msg.markets?.[0] ?? "nigeria";

  try {
    // 1. Load the active GEO query set (brand name + market injected), then split:
    //    - MARKET queries (brand-agnostic) → shared across the market via cache.
    //    - BRAND queries (name the brand)  → per-brand, direct providers only.
    const allLoaded = await loadQueries(sb, msg.brand_name, market);
    const marketQueries = allLoaded.filter((q) => !q.brandSpecific).slice(0, MARKET_QUERY_LIMIT);
    const brandQueries = allLoaded.filter((q) => q.brandSpecific).slice(0, BRAND_QUERY_LIMIT);
    const queries = [...marketQueries, ...brandQueries];
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

    const activeEngines = PLATFORMS.filter((p) => !DISABLED_ENGINES.has(p.key));
    const logCtx = { sb, scanJobId: msg.scan_job_id, brandId: msg.brand_id };

    // 2. Dispatch the active engines in parallel (allSettled — isolate failures).
    //    Market queries hit the shared cache; brand queries run direct-only.
    const engineResults = await Promise.allSettled(
      activeEngines.map((p) =>
        gatherEngineResponses(sb, p, market, marketQueries, brandQueries, logCtx).then(
          (responses) => ({ p, responses }),
        ),
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

    // 9. Health + completion. Partial if not all active engines returned data.
    const fullCoverage = engineSuccessCount === activeEngines.length && aiVisibilityScore !== null;
    await recordFeatureHealth(sb, {
      scan_job_id: msg.scan_job_id,
      brand_id: msg.brand_id,
      scan_week: msg.scan_week,
      feature_category: "geo",
      feature_name: "GEO/AEO Visibility",
      status: fullCoverage ? "passed" : "partial",
      root_cause: fullCoverage
        ? null
        : `${engineSuccessCount}/${activeEngines.length} answer engines returned data`,
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
}));

/**
 * Collect one engine's answers for a brand: brand-agnostic MARKET queries served
 * from the shared (market, week, engine) cache — fetched once and reused by every
 * brand in the market — plus per-brand BRAND queries run only on direct providers
 * (OpenAI/Anthropic), never on the pay-per-call DataForSEO engines. Returns the
 * per-query EngineResponse[] the classifier consumes. Never throws.
 */
async function gatherEngineResponses(
  sb: ReturnType<typeof serviceClient>,
  platform: PlatformDef,
  market: string,
  marketQueries: GeoQuery[],
  brandQueries: GeoQuery[],
  logCtx: { sb: ReturnType<typeof serviceClient>; scanJobId: string; brandId: string },
): Promise<EngineResponse[]> {
  const responses: EngineResponse[] = [];

  // Shared market queries: one cache row per (market, week, engine); only the
  // MISSING query texts are fetched (getOrFetchMarketIntelKeyed dedupes + merges).
  if (marketQueries.length > 0) {
    const texts = marketQueries.map((q) => q.text);
    const answers = await getOrFetchMarketIntelKeyed<string>(
      sb,
      market,
      `geo:${platform.key}`,
      texts,
      (missing) => runQueriesConcurrent(platform, missing, logCtx),
    );
    for (const q of marketQueries) {
      const text = answers[q.text.toLowerCase().trim()] ?? "";
      if (text) responses.push({ query: q.text, category: q.category, text });
    }
  }

  // Brand queries: reputation checks that can't be market-shared. Run them only
  // on direct providers (cheap tokens); DataForSEO engines skip them entirely.
  if (brandQueries.length > 0 && platform.provider !== "dataforseo") {
    const texts = brandQueries.map((q) => q.text);
    const answers = await runQueriesConcurrent(platform, texts, logCtx);
    for (const q of brandQueries) {
      const text = answers[q.text] ?? "";
      if (text) responses.push({ query: q.text, category: q.category, text });
    }
  }

  return responses;
}

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
