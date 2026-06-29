// researcher-traffic-seo — SEO/Traffic Researcher (agent-orchestration.md step 3).
// Consumes a `scan_modules` message (task_type 'traffic_seo'), calls DataForSEO Labs
// per competitor (Promise.allSettled, bounded concurrency, 90s budget), structures the
// result into the seo_cache jsonb contract (lib/data/traffic-seo.ts), UPSERTs
// seo_cache + competitor_profiles, then (when it completes the job's module fan-out)
// triggers synthesis. Service-role; every query scoped to msg.brand_id. DataForSEO only.
//
// Endpoints (mvp-module-sources.md §1):
//   dataforseo_labs/google/bulk_traffic_estimation/live
//   dataforseo_labs/google/domain_intersection/live
//   dataforseo_labs/google/ranked_keywords/live
//   keywords_data/google_ads/search_volume/live
// (competitors_domain/live is reserved for brand-side overlap; not required for the
//  per-competitor gap rows the frontend reads, which come from intersection + ranked.)

import { serviceClient } from "../_shared/supabase.ts";
import type { SupabaseClient } from "../_shared/supabase.ts";
import { json, preflight, isAuthorizedInternal } from "../_shared/http.ts";
import { MODELS, type ScanModuleMessage, type CompetitorRef } from "../_shared/contracts.ts";
import { completeModule, invokeFunction, enqueueSynthesis } from "../_shared/scan.ts";
import { recordFeatureHealth, toDeadLetter } from "../_shared/logging.ts";
import { loggedLlm, callClaude, parseJsonFromModel } from "../_shared/llm.ts";
import { makeEvidence } from "../_shared/evidence.ts";
import type { ContentGap, KeywordGap, SerpPosition } from "./types.ts";
import {
  locationCode,
  fetchTrafficEstimate,
  fetchKeywordIntersection,
  fetchRankedKeywords,
  fetchSearchVolumes,
  mergeKeywordGaps,
  trafficSplitPct,
} from "./dataforseo-seo.ts";

const PROMPT_VERSION = "traffic_seo.v1";
// Bound concurrency so 10 competitors × 4 DataForSEO calls stay within the 90s budget.
const MAX_CONCURRENCY = 4;

// ── per-competitor structured result ─────────────────────────────────────────
type CompetitorSeoResult = {
  competitor: CompetitorRef;
  domainAuthority: number | null;
  estimatedTraffic: number | null;
  organicTraffic: number | null;
  paidTraffic: number | null;
  organicPct: number | null;
  paidPct: number | null;
  keywordGaps: KeywordGap[];
  serpPositions: SerpPosition[];
  contentGaps: ContentGap[];
  dataQualityScore: number;
  rawData: Record<string, unknown>;
  evidence: unknown[];
};

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (!isAuthorizedInternal(req)) return json({ error: "unauthorized" }, 401);

  const sb = serviceClient();
  const msg = (await req.json()) as ScanModuleMessage;

  try {
    const location = locationCode(msg.markets);
    const competitors = Array.isArray(msg.competitors) ? msg.competitors : [];

    // 1. Fetch + structure per competitor (Promise.allSettled, bounded concurrency).
    const settled = await mapWithConcurrency(
      competitors,
      MAX_CONCURRENCY,
      (c) => fetchCompetitorSeo(sb, msg, c, location, msg.brand_domain),
    );

    let anyFailures = false;
    const results: CompetitorSeoResult[] = [];
    for (const r of settled) {
      if (r.status === "fulfilled") results.push(r.value);
      else anyFailures = true; // a single competitor failing → partial, never aborts others
    }

    // 2. UPSERT seo_cache (per competitor) + competitor_profiles (per competitor).
    for (const res of results) {
      await upsertSeoCache(sb, msg, res);
      await upsertCompetitorProfile(sb, msg, res);
    }

    // A module with zero usable results (e.g. brand has competitors but every fetch
    // failed) is 'failed'; some-failed is 'partial'; all-ok is 'ok'. Zero competitors
    // configured is a clean 'ok' (nothing to scan).
    const outcome: "ok" | "failed" | "partial" =
      competitors.length > 0 && results.length === 0
        ? "failed"
        : anyFailures
        ? "partial"
        : "ok";

    if (outcome === "failed") {
      await recordFeatureHealth(sb, {
        scan_job_id: msg.scan_job_id,
        brand_id: msg.brand_id,
        scan_week: msg.scan_week,
        feature_category: "traffic_seo",
        feature_name: "Traffic & SEO",
        status: "down",
        root_cause: "All competitor SEO fetches failed",
      });
    } else if (outcome === "partial") {
      await recordFeatureHealth(sb, {
        scan_job_id: msg.scan_job_id,
        brand_id: msg.brand_id,
        scan_week: msg.scan_week,
        feature_category: "traffic_seo",
        feature_name: "Traffic & SEO",
        status: "degraded",
        root_cause: "Some competitor SEO fetches failed",
      });
    } else {
      await recordFeatureHealth(sb, {
        scan_job_id: msg.scan_job_id,
        brand_id: msg.brand_id,
        scan_week: msg.scan_week,
        feature_category: "traffic_seo",
        feature_name: "Traffic & SEO",
        status: "healthy",
      });
    }

    // 3. Record module completion; if this call finished the fan-out → synthesis.
    const done = await completeModule(sb, msg.scan_job_id, "traffic_seo", outcome);
    if (done) {
      await enqueueSynthesis(sb, {
        scan_job_id: msg.scan_job_id,
        brand_id: msg.brand_id,
        scan_week: msg.scan_week,
      });
      await invokeFunction("synthesis-draft-audit", {
        scan_job_id: msg.scan_job_id,
        brand_id: msg.brand_id,
        scan_week: msg.scan_week,
      });
    }

    return json({ ok: true });
  } catch (e) {
    // Fatal module failure → feature-health down + DLQ + mark module failed.
    await recordFeatureHealth(sb, {
      scan_job_id: msg.scan_job_id,
      brand_id: msg.brand_id,
      scan_week: msg.scan_week,
      feature_category: "traffic_seo",
      feature_name: "Traffic & SEO",
      status: "down",
      root_cause: String(e),
    });
    await toDeadLetter(sb, {
      task_type: "traffic_seo",
      payload: msg,
      brand_id: msg.brand_id,
      scan_job_id: msg.scan_job_id,
      failure_reason: String(e),
    });
    const done = await completeModule(sb, msg.scan_job_id, "traffic_seo", "failed");
    if (done) {
      await invokeFunction("synthesis-draft-audit", {
        scan_job_id: msg.scan_job_id,
        brand_id: msg.brand_id,
        scan_week: msg.scan_week,
      });
    }
    return json({ ok: false }, 200);
  }
});

// ── per-competitor fetch + structure ─────────────────────────────────────────
async function fetchCompetitorSeo(
  sb: SupabaseClient,
  msg: ScanModuleMessage,
  competitor: CompetitorRef,
  location: number,
  brandDomain: string,
): Promise<CompetitorSeoResult> {
  const domain = competitor.domain;

  // Each DataForSEO call is independent → allSettled so a missing dataset doesn't
  // wipe the others. Tolerate per-call failure with null/[] (no fabrication).
  const [estR, interR, rankedR] = await Promise.allSettled([
    fetchTrafficEstimate(domain, location),
    fetchKeywordIntersection(domain, brandDomain, location),
    fetchRankedKeywords(domain, location),
  ]);

  const traffic = estR.status === "fulfilled"
    ? estR.value
    : { estimatedTraffic: null, organicTraffic: null, paidTraffic: null };
  const intersectionGaps: KeywordGap[] = interR.status === "fulfilled" ? interR.value : [];
  const ranked = rankedR.status === "fulfilled"
    ? rankedR.value
    : { serpPositions: [] as SerpPosition[], gaps: [] as KeywordGap[] };

  // Backfill missing search volumes for the top gap keywords (one batched call).
  const needVolume = [...intersectionGaps, ...ranked.gaps]
    .filter((g) => g.volume == null)
    .map((g) => g.keyword)
    .slice(0, 700);
  let volumes = new Map<string, number>();
  if (needVolume.length > 0) {
    try {
      volumes = await fetchSearchVolumes(needVolume, location);
    } catch {
      volumes = new Map(); // tolerate; gaps keep null volume
    }
  }

  const keywordGaps = mergeKeywordGaps(ranked.gaps, intersectionGaps, volumes, 100);
  const serpPositions = ranked.serpPositions.slice(0, 100);

  const { organicPct, paidPct } = trafficSplitPct(traffic.organicTraffic, traffic.paidTraffic);

  // data_quality_score: fraction of the expected datasets that returned usable data.
  const signals = [
    traffic.estimatedTraffic != null,
    keywordGaps.length > 0,
    serpPositions.length > 0,
  ];
  const dataQualityScore =
    Math.round((signals.filter(Boolean).length / signals.length) * 100) / 100;

  // 4. Minimal Haiku: derive content_gaps (topic clusters) from the competitor's
  // ranked keywords — the ONLY part not already structured by DataForSEO. Skipped
  // when there's nothing to cluster (don't over-call the LLM). content_gaps are a
  // derived view (no source URL) → not attached to evidence.
  const contentGaps = await deriveContentGaps(sb, msg, competitor, keywordGaps);

  // Evidence: SEO claims are sourced from the competitor domain's DataForSEO profile.
  // Attach one evidence record per competitor pointing at the analysed domain.
  const evidence: unknown[] = [];
  if (traffic.estimatedTraffic != null || keywordGaps.length > 0) {
    const ev = await makeEvidence({
      sourceUrl: `https://${domain}`,
      extractedText:
        `DataForSEO Labs (location ${location}): est. traffic ${traffic.estimatedTraffic ?? "n/a"}, ` +
        `${keywordGaps.length} keyword gaps, ${serpPositions.length} ranked positions.`,
    });
    evidence.push(ev);
  }

  return {
    competitor,
    domainAuthority: null, // DataForSEO Labs has no first-party "domain authority"; null, not faked
    estimatedTraffic: traffic.estimatedTraffic,
    organicTraffic: traffic.organicTraffic,
    paidTraffic: traffic.paidTraffic,
    organicPct,
    paidPct,
    keywordGaps,
    serpPositions,
    contentGaps,
    dataQualityScore,
    rawData: {
      location_code: location,
      brand_domain: brandDomain,
      traffic_estimate: traffic,
      intersection_count: intersectionGaps.length,
      ranked_count: ranked.gaps.length,
      fetched_at: new Date().toISOString(),
    },
    evidence,
  };
}

// ── Haiku: cluster ranked keywords → content_gaps ────────────────────────────
async function deriveContentGaps(
  sb: SupabaseClient,
  msg: ScanModuleMessage,
  competitor: CompetitorRef,
  keywordGaps: KeywordGap[],
): Promise<ContentGap[]> {
  // Only keywords the BRAND does not rank for (brandRank null) are true content gaps.
  const gapKeywords = keywordGaps
    .filter((g) => g.brandRank == null && g.keyword)
    .slice(0, 60)
    .map((g) => g.keyword);
  if (gapKeywords.length < 5) return []; // not enough signal → don't call the LLM

  try {
    const r = await loggedLlm(
      sb,
      {
        scan_job_id: msg.scan_job_id,
        brand_id: msg.brand_id,
        agent_name: "researcher",
        task_type: "traffic_seo",
        prompt_version: PROMPT_VERSION,
        data_quality_score: 1,
        input_snapshot: gapKeywords,
      },
      () =>
        callClaude({
          model: MODELS.haiku,
          temperature: 0.1,
          maxTokens: 700,
          system:
            "You cluster SEO keywords into content topics for a competitive-intelligence tool. " +
            "Given keywords a competitor ranks for that the brand does NOT, group them into 3-8 " +
            "content topics. Respond ONLY with a JSON array of objects " +
            '{"topic": string, "keywordCount": number}. No prose.',
          messages: [
            {
              role: "user",
              content:
                `Competitor: ${competitor.name}\nKeywords:\n` + gapKeywords.join("\n"),
            },
          ],
        }),
    );
    const parsed = parseJsonFromModel<Array<{ topic?: unknown; keywordCount?: unknown }>>(r.text);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((p): ContentGap | null => {
        const topic = typeof p.topic === "string" && p.topic.trim() ? p.topic.trim() : null;
        if (!topic) return null;
        const count =
          typeof p.keywordCount === "number" && Number.isFinite(p.keywordCount)
            ? Math.round(p.keywordCount)
            : null;
        // brandPages 0: these are topics the brand does not cover (brandRank null set).
        return { topic, competitorPages: count, brandPages: 0 };
      })
      .filter((c): c is ContentGap => c !== null)
      .slice(0, 8);
  } catch {
    // LLM failure must not fail the module — content_gaps is supplementary.
    return [];
  }
}

// ── UPSERTs ──────────────────────────────────────────────────────────────────
async function upsertSeoCache(
  sb: SupabaseClient,
  msg: ScanModuleMessage,
  res: CompetitorSeoResult,
): Promise<void> {
  const { error } = await sb.from("seo_cache").upsert(
    {
      brand_id: msg.brand_id,
      competitor_id: res.competitor.id,
      scan_week: msg.scan_week,
      domain_authority: res.domainAuthority,
      estimated_traffic: res.estimatedTraffic,
      organic_traffic: res.organicTraffic,
      paid_traffic: res.paidTraffic,
      keyword_gaps: res.keywordGaps as never,
      content_gaps: res.contentGaps as never,
      serp_positions: res.serpPositions as never,
      raw_data: { ...res.rawData, evidence: res.evidence } as never,
    },
    { onConflict: "brand_id,scan_week,competitor_id" },
  );
  if (error) throw new Error(`upsert seo_cache (${res.competitor.id}): ${error.message}`);
}

async function upsertCompetitorProfile(
  sb: SupabaseClient,
  msg: ScanModuleMessage,
  res: CompetitorSeoResult,
): Promise<void> {
  const { error } = await sb.from("competitor_profiles").upsert(
    {
      competitor_id: res.competitor.id,
      scan_week: msg.scan_week,
      domain_authority: res.domainAuthority,
      estimated_monthly_traffic: res.estimatedTraffic,
      organic_traffic_pct: res.organicPct,
      paid_traffic_pct: res.paidPct,
      raw_data: {
        source: "researcher-traffic-seo",
        brand_id: msg.brand_id,
        scan_week: msg.scan_week,
      } as never,
    },
    { onConflict: "competitor_id,scan_week" },
  );
  if (error) {
    throw new Error(`upsert competitor_profiles (${res.competitor.id}): ${error.message}`);
  }
}

// ── bounded-concurrency allSettled ───────────────────────────────────────────
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i]) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
