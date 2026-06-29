// researcher-customer — Customer-Intelligence Researcher (PARTIAL module,
// mvp-module-sources.md §6; agent-orchestration.md Researcher pattern). Edge
// Function (Deno). Invoked by brand-scan (and the queue drainer) with a
// ScanModuleMessage { task_type: 'customer' } and Authorization: Bearer ${CRON_SECRET}.
//
// What it does (per competitor, Promise.allSettled so one failure never blocks
// the others — data-flow-rules.md §4):
//   1. DataForSEO ONLY: bulk_traffic_estimation (traffic mix), content_analysis
//      search + sentiment_analysis (sentiment + complaint corpus),
//      domain_intersection (audience-overlap proxy), search_intent.
//   2. Haiku (MODELS.haiku via loggedLlm) structures → traffic_sources[],
//      complaint_themes[], sentiment_score, 12-wk sentiment trend, data_quality_score.
//   3. Demographics / geographic / social: Phase 2 — left NULL. NEVER fabricated.
//   4. MERGE-don't-clobber UPSERT into customer_intel_cache: read the existing row
//      first; set ONLY customer-derived columns (traffic_sources, demographics=null,
//      geographic_distribution=null, raw_data with search-intent etc). DO NOT touch
//      app_rating/app_review_count (owned by researcher-app-store). For
//      sentiment_score/complaint_themes, only set when not already present.
//   5. completeModule → if this call finished the fan-out, trigger synthesis.
//
// Service-role client (RLS bypassed) — every query is scoped to msg.brand_id
// (isolation rule). 90s module budget. DataForSEO secrets via _shared/env.

import { serviceClient } from "../_shared/supabase.ts";
import { json, preflight, isAuthorizedInternal } from "../_shared/http.ts";
import { completeModule, enqueueSynthesis, invokeFunction } from "../_shared/scan.ts";
import { recordFeatureHealth, toDeadLetter } from "../_shared/logging.ts";
import type { ScanModuleMessage, ScanSynthesisMessage, CompetitorRef } from "../_shared/contracts.ts";
import {
  fetchAudienceOverlap,
  fetchContentMentions,
  fetchSearchIntent,
  fetchSentimentDistribution,
  fetchTopRankedKeywords,
  fetchTrafficMix,
  locationCode,
  type AudienceOverlap,
  type ContentMention,
  type SearchIntentMix,
  type SentimentDistribution,
  type TrafficMix,
} from "./dataforseo-customer.ts";
import { inferCustomerIntel } from "./infer.ts";
import type { CustomerInference } from "./types.ts";

const MODULE_BUDGET_MS = 90_000;
const SYNTHESIS_FN = "synthesis-draft-audit";

/** Retry a single async op twice with backoff (1s, 3s) — data-flow-rules.md §4. */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const delays = [1000, 3000];
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < delays.length) await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
  throw new Error(`${label} failed after retries: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}

/** Best-effort fetch: returns the value or a fallback, never throws (partial is fine). */
async function soft<T>(fn: () => Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await withRetry(fn, label);
  } catch (_e) {
    return fallback;
  }
}

type CompetitorResult = {
  competitorId: string;
  inference: CustomerInference;
  rawData: Record<string, unknown>;
};

/** Run the full customer pipeline for one competitor. Throws only on a fatal error. */
async function processCompetitor(
  sb: ReturnType<typeof serviceClient>,
  msg: ScanModuleMessage,
  competitor: CompetitorRef,
  location: number,
): Promise<CompetitorResult> {
  const domain = competitor.domain;
  const name = competitor.name;

  // ── 1. DataForSEO signals (each soft — one missing signal never aborts) ────
  const [traffic, mentions, sentiment, overlap, topKeywords]: [
    TrafficMix,
    ContentMention[],
    SentimentDistribution,
    AudienceOverlap,
    string[],
  ] = await Promise.all([
    soft(() => fetchTrafficMix(domain, location), { organic: null, paid: null, total: null }, "traffic_mix"),
    soft(() => fetchContentMentions(name, location), [], "content_mentions"),
    soft(() => fetchSentimentDistribution(name, location), { byConnotation: {}, totalCitations: null }, "sentiment"),
    soft(() => fetchAudienceOverlap(domain, msg.brand_domain, location), { sharedKeywords: null }, "overlap"),
    soft(() => fetchTopRankedKeywords(domain, location), [], "ranked_keywords"),
  ]);

  const intent: SearchIntentMix = await soft(
    () => fetchSearchIntent(topKeywords, location),
    { byIntent: {} },
    "search_intent",
  );

  // ── 2. Haiku structuring (wraps untrusted mention text internally) ─────────
  const inference = await inferCustomerIntel(
    sb,
    { scan_job_id: msg.scan_job_id, brand_id: msg.brand_id, competitorName: name },
    { traffic, mentions, sentiment, intent },
  );

  // raw_data: the evidence/signals behind the inference (search-intent lives here —
  // there is no dedicated column for it in customer_intel_cache).
  const rawData: Record<string, unknown> = {
    source: "dataforseo",
    module: "customer",
    scraped_at: new Date().toISOString(),
    traffic_mix: traffic,
    sentiment_distribution: sentiment,
    audience_overlap: overlap, // shared-keyword proxy only — NOT exact audience overlap
    search_intent: intent,
    mention_sample: mentions.slice(0, 10),
    sentiment_trend: inference.sentiment_trend,
    // Phase 2 — explicitly not computed (UI renders the Phase-2 sub-state):
    demographics_status: "phase_2_social_intelligence",
    geographic_status: "phase_2_social_intelligence",
  };

  return { competitorId: competitor.id, inference, rawData };
}

/**
 * MERGE-don't-clobber UPSERT into customer_intel_cache for one competitor.
 * researcher-app-store also writes this table (app_rating, app_review_count,
 * complaint_themes, sentiment_score). We read the row first and write ONLY
 * customer-derived columns; app_rating/app_review_count are NEVER included in
 * our payload (so they survive whichever researcher ran first). For
 * sentiment_score/complaint_themes we set them only when the existing row has
 * none, so we never overwrite App-Store review-derived values.
 */
async function upsertCustomerRow(
  sb: ReturnType<typeof serviceClient>,
  msg: ScanModuleMessage,
  result: CompetitorResult,
): Promise<void> {
  // Read any existing row for this (brand, week, competitor) — could be ours from
  // a retry, or App-Store's from earlier in the same scan.
  const { data: existing } = await sb
    .from("customer_intel_cache")
    .select("complaint_themes, sentiment_score")
    .eq("brand_id", msg.brand_id)
    .eq("scan_week", msg.scan_week)
    .eq("competitor_id", result.competitorId)
    .maybeSingle();

  const existingComplaints = Array.isArray(existing?.complaint_themes)
    ? (existing!.complaint_themes as unknown[])
    : null;
  const existingHasComplaints = existingComplaints != null && existingComplaints.length > 0;
  const existingHasSentiment =
    existing?.sentiment_score != null && typeof existing.sentiment_score === "number";

  // Customer-derived columns only. Demographics + geographic stay NULL (Phase 2).
  const payload: Record<string, unknown> = {
    brand_id: msg.brand_id,
    scan_week: msg.scan_week,
    competitor_id: result.competitorId,
    traffic_sources: result.inference.traffic_sources, // always ours to own
    demographics: null, // Phase 2 — never fabricated
    geographic_distribution: null, // Phase 2 — never fabricated
    raw_data: result.rawData,
    // NOTE: app_rating / app_review_count deliberately OMITTED — owned by
    // researcher-app-store; omitting them from an upsert leaves them untouched.
  };

  // sentiment_score: only set if App-Store hasn't already (its review sentiment wins).
  if (!existingHasSentiment && result.inference.sentiment_score != null) {
    payload.sentiment_score = result.inference.sentiment_score;
  }
  // complaint_themes: only set if not already present (App-Store mines richer
  // review complaints; don't clobber). We contribute content-mined themes only
  // when the row has none yet.
  if (!existingHasComplaints && result.inference.complaint_themes.length > 0) {
    payload.complaint_themes = result.inference.complaint_themes;
  }

  const { error } = await sb
    .from("customer_intel_cache")
    .upsert(payload, { onConflict: "brand_id,scan_week,competitor_id" });
  if (error) throw new Error(`upsert customer_intel_cache: ${error.message}`);
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
  if (!msg?.scan_job_id || !msg?.brand_id || !msg?.scan_week || msg?.task_type !== "customer") {
    return json(
      { error: "expected ScanModuleMessage with task_type 'customer'", required: ["scan_job_id", "brand_id", "scan_week"] },
      400,
    );
  }

  const deadline = Date.now() + MODULE_BUDGET_MS;
  const competitors = Array.isArray(msg.competitors) ? msg.competitors : [];
  const location = locationCode(msg.markets);

  let succeeded = 0;
  let failed = 0;

  try {
    // Per-competitor, in parallel — Promise.allSettled so one failure is isolated.
    const settled = await Promise.allSettled(
      competitors.map((c) => processCompetitor(sb, msg, c, location)),
    );

    for (const r of settled) {
      if (Date.now() > deadline) break; // honour the 90s budget; remaining fall back to prev week
      if (r.status === "fulfilled") {
        try {
          await upsertCustomerRow(sb, msg, r.value);
          succeeded += 1;
        } catch (_e) {
          failed += 1;
        }
      } else {
        failed += 1;
      }
    }

    // Module outcome: ok if every competitor wrote; partial if some did; failed if
    // there were competitors but none succeeded. Zero competitors → ok (no-op).
    const outcome: "ok" | "partial" | "failed" =
      competitors.length === 0 || failed === 0
        ? "ok"
        : succeeded > 0
          ? "partial"
          : "failed";

    await recordFeatureHealth(sb, {
      scan_job_id: msg.scan_job_id,
      brand_id: msg.brand_id,
      scan_week: msg.scan_week,
      feature_category: "customer_intelligence",
      feature_name: "customer_intel",
      status: outcome === "ok" ? "healthy" : outcome === "partial" ? "degraded" : "down",
      root_cause: outcome === "failed" ? "all competitors failed in customer module" : null,
    });

    if (outcome === "failed" && competitors.length > 0) {
      await toDeadLetter(sb, {
        task_type: "customer",
        payload: msg,
        brand_id: msg.brand_id,
        scan_job_id: msg.scan_job_id,
        failure_reason: "customer module produced no rows",
      });
    }

    // 5. Advance the state machine; if we closed the fan-out, trigger synthesis.
    const finishedFanout = await completeModule(sb, msg.scan_job_id, "customer", outcome);
    if (finishedFanout) {
      const synth: ScanSynthesisMessage = {
        scan_job_id: msg.scan_job_id,
        brand_id: msg.brand_id,
        scan_week: msg.scan_week,
      };
      await enqueueSynthesis(sb, synth);
      await invokeFunction(SYNTHESIS_FN, synth);
    }

    return json({ ok: true, outcome, competitors: competitors.length, succeeded, failed });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Fatal module error (e.g. completeModule RPC failed): record + DLQ, mark the
    // module failed in the state machine so the fan-out can still complete.
    await recordFeatureHealth(sb, {
      scan_job_id: msg.scan_job_id,
      brand_id: msg.brand_id,
      scan_week: msg.scan_week,
      feature_category: "customer_intelligence",
      feature_name: "customer_intel",
      status: "down",
      root_cause: message,
    });
    await toDeadLetter(sb, {
      task_type: "customer",
      payload: msg,
      brand_id: msg.brand_id,
      scan_job_id: msg.scan_job_id,
      failure_reason: "customer module fatal error",
      last_error: message,
    });
    try {
      const finishedFanout = await completeModule(sb, msg.scan_job_id, "customer", "failed");
      if (finishedFanout) {
        const synth: ScanSynthesisMessage = {
          scan_job_id: msg.scan_job_id,
          brand_id: msg.brand_id,
          scan_week: msg.scan_week,
        };
        await enqueueSynthesis(sb, synth);
        await invokeFunction(SYNTHESIS_FN, synth);
      }
    } catch (_e) {
      // state-machine advance failed too; the 6h monitor / DLQ drainer recovers it.
    }
    return json({ ok: false, error: message }, 500);
  }
});
