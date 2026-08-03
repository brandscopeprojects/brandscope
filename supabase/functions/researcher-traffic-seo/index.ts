// researcher-traffic-seo — SEO/Traffic Researcher (agent-orchestration.md step 3).
// Consumes a `scan_modules` message (task_type 'traffic_seo') and builds each
// competitor's SEO snapshot from a LIVE Google SERP sweep (serp/google/organic/
// live/advanced) instead of DataForSEO Labs — Labs is blind to small country-
// specific betting domains (betika.co.zm → all dashes). One curated, market-shared
// keyword set (brand-defense · conquest · money terms) yields, per competitor: a
// search-visibility score, organic/paid presence, SERP positions and real keyword
// gaps. Each keyword's SERP is cached per (market, week, keyword) so sibling brands
// and same-week re-scans are cache hits (~16 calls first brand, ~4 thereafter).
// Structures into seo_cache + competitor_profiles, then (when it completes the
// job's module fan-out) triggers synthesis. Service-role; scoped to msg.brand_id.
//
// Reach/demand signals (brand search-volume + Google Trends) are kept — they are
// cheap, market-cached and DO return data for these markets.

import { serviceClient } from "../_shared/supabase.ts";
import type { SupabaseClient } from "../_shared/supabase.ts";
import { json, preflight, isAuthorizedInternal } from "../_shared/http.ts";
import { withMeter, setMeterCtx } from "../_shared/spend.ts";
import { MODELS, type ScanModuleMessage, type CompetitorRef } from "../_shared/contracts.ts";
import { completeModule, invokeFunction, enqueueSynthesis } from "../_shared/scan.ts";
import { recordFeatureHealth, toDeadLetter } from "../_shared/logging.ts";
import { loggedLlm, callClaude, parseJsonFromModel } from "../_shared/llm.ts";
import { resolveRoute } from "../_shared/router.ts";
import { loadPrompt } from "../_shared/prompts.ts";
import { makeEvidence } from "../_shared/evidence.ts";
import type { ContentGap, KeywordGap, SerpPosition } from "./types.ts";
import {
  locationCode,
  fetchSearchVolumes,
  fetchBrandDemandBatch,
  fetchBrandTrends,
  trafficSplitPct,
} from "./dataforseo-seo.ts";
import {
  buildSweepKeywords,
  discoverMoneyKeywords,
  curatedMoneyKeywords,
  runSerpSweep,
  deriveCompetitorVisibility,
} from "./serp-visibility.ts";
import { languageCode } from "../_shared/dataforseo.ts";
import { getOrFetchMarketIntel, getOrFetchMarketIntelKeyed } from "../_shared/market-cache.ts";

const PROMPT_VERSION = "traffic_seo.v2";

// Slot researcher:traffic_seo — DB-active prompt_versions row overrides this code default.
export const TRAFFIC_SYSTEM = `You cluster SEO keywords into content topics for a competitive-intelligence tool. Given keywords a competitor ranks for that the brand does NOT, group them into 3-8 content topics. Respond ONLY with a JSON array of objects {"topic": string, "keywordCount": number}. No prose.`;

// ── per-competitor structured result ─────────────────────────────────────────
type CompetitorSeoResult = {
  competitor: CompetitorRef;
  domainAuthority: number | null; // repurposed → "Search Visibility" (SOSV 0–100)
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

Deno.serve(withMeter(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (!isAuthorizedInternal(req)) return json({ error: "unauthorized" }, 401);

  const sb = serviceClient();
  const msg = (await req.json()) as ScanModuleMessage;
  setMeterCtx({ sb, organisation_id: msg.organisation_id ?? null, brand_id: msg.brand_id, scan_job_id: msg.scan_job_id, task_type: msg.task_type });

  try {
    const location = locationCode(msg.markets);
    const language = languageCode(msg.markets);
    const competitors = Array.isArray(msg.competitors) ? msg.competitors : [];
    const market0 = (msg.markets?.[0] ?? "global").toLowerCase();
    const domainKey = (d: string) => (d || "").replace(/^www\./, "").toLowerCase();

    // 0. Market-level demand signals — fetched once per (market, scan_week) and
    // shared across every brand in the market (market_intel_cache). These DO
    // return data for small markets (Google Ads search volume), so they stay.
    const demandByDomain = await getOrFetchMarketIntelKeyed<number | null>(
      sb, market0, "brand_demand",
      competitors.map((c) => domainKey(c.domain)),
      async (missing) => {
        const missingSet = new Set(missing);
        const seen = new Set<string>();
        const entities: Array<{ key: string; name: string; domain: string }> = [];
        for (const c of competitors) {
          const key = domainKey(c.domain);
          if (!missingSet.has(key) || seen.has(key)) continue;
          seen.add(key);
          entities.push({ key, name: c.name, domain: c.domain });
        }
        const demandMap = await fetchBrandDemandBatch(entities, location, language)
          .catch(() => new Map<string, number | null>());
        const out: Record<string, number | null> = {};
        for (const k of missing) out[k] = demandMap.get(k) ?? null;
        return out;
      },
    );

    // Google Trends (owner-approved): ONE comparison call for up to 5 tracked
    // names, cached per market/week. Scores are a relative interest index.
    const { value: trendsByName } = await getOrFetchMarketIntel<Record<string, number>>(
      sb, market0, "brand_trends",
      async () => {
        const m = await fetchBrandTrends(competitors.slice(0, 5).map((c) => c.name), location);
        return Object.fromEntries(m.entries());
      },
    ).catch(() => ({ value: {} as Record<string, number>, fromCache: false }));

    // 1. EVIDENCE-BASED keyword discovery — the real top keywords by Google search
    // volume for this market (cached), instead of hand-guessed terms. Falls back to
    // a curated set only if discovery returns nothing.
    const discovered = await discoverMoneyKeywords(
      sb, market0, location, language, msg.brand_name, competitors,
    );
    const money = discovered.length >= 5
      ? discovered.map((d) => d.keyword)
      : curatedMoneyKeywords(market0);

    // 2. LIVE-SERP visibility sweep. brand-defense + conquest + money terms; each
    // keyword's SERP cached per (market, week, keyword).
    const sweepKeywords = buildSweepKeywords(msg.brand_name, market0, competitors, money);
    const sweep = await runSerpSweep(sb, market0, sweepKeywords, location, language);

    // Search-volume backfill for the swept keywords (one batched Google Ads call,
    // cached per market/week) — ranks keyword gaps by real demand.
    const volumeByKw = await getOrFetchMarketIntelKeyed<number | null>(
      sb, market0, "sweep_kw_vol", sweepKeywords,
      async (missing) => {
        const vols = await fetchSearchVolumes(missing, location, language).catch(
          () => new Map<string, number>(),
        );
        const out: Record<string, number | null> = {};
        for (const k of missing) out[k] = vols.get(k.toLowerCase()) ?? null;
        return out;
      },
    );
    const volumes = new Map<string, number>();
    for (const [k, v] of Object.entries(volumeByKw)) if (v != null) volumes.set(k.toLowerCase(), v);
    // Discovery volumes are authoritative (real Google search volume) — prefer them.
    for (const d of discovered) if (d.volume != null) volumes.set(d.keyword, d.volume);

    // 2. Derive per-competitor visibility / positions / gaps from the shared sweep
    // (pure — no extra provider calls) + a Haiku content-gap clustering.
    const { competitors: visList, brandSelf, landscape } = deriveCompetitorVisibility(
      sweep, competitors, msg.brand_domain, msg.brand_name, volumes,
    );

    const results: CompetitorSeoResult[] = [];
    for (const vis of visList) {
      const c = vis.competitor;
      const contentGaps = await deriveContentGaps(sb, msg, c, vis.keywordGaps);
      const { organicPct, paidPct } = trafficSplitPct(vis.organicHits, vis.paidHits);
      const signals = [
        vis.visibilityScore != null,
        vis.keywordGaps.length > 0,
        vis.serpPositions.length > 0,
      ];
      const dataQualityScore =
        Math.round((signals.filter(Boolean).length / signals.length) * 100) / 100;

      const evidence: unknown[] = [];
      if (vis.visibilityScore != null || vis.keywordGaps.length > 0) {
        evidence.push(
          await makeEvidence({
            sourceUrl: `https://${c.domain}`,
            extractedText:
              `Live Google SERP (location ${location}): visibility ${vis.visibilityScore ?? "n/a"}/100, ` +
              `${vis.organicHits} organic + ${vis.paidHits} paid keyword hits, ` +
              `${vis.keywordGaps.length} keyword gaps, ${vis.serpPositions.length} ranked positions.`,
          }),
        );
      }

      results.push({
        competitor: c,
        domainAuthority: vis.visibilityScore,
        estimatedTraffic: null, // SERP visibility is not visit volume — honest null
        organicTraffic: vis.organicHits,
        paidTraffic: vis.paidHits,
        organicPct,
        paidPct,
        keywordGaps: vis.keywordGaps,
        serpPositions: vis.serpPositions,
        contentGaps,
        dataQualityScore,
        rawData: {
          source: "serp_visibility",
          location_code: location,
          language_code: language,
          brand_domain: msg.brand_domain,
          visibility_score: vis.visibilityScore,
          organic_hits: vis.organicHits,
          paid_hits: vis.paidHits,
          keywords_swept: sweep.keywords.length,
          sweep_had_data: sweep.hadData,
          // The brand's OWN visibility, so the frontend can show a "you" row/bar.
          // Same on every row (cheap); the data layer reads it from the first row.
          brand_self: {
            name: msg.brand_name,
            visibility_score: brandSelf.visibilityScore,
            organic_hits: brandSelf.organicHits,
            paid_hits: brandSelf.paidHits,
          },
          // Keyword-centric ranking landscape (same blob on each row; the data
          // layer reads it from the first row) — powers the mobile keyword cards.
          keyword_landscape: landscape,
          brand_demand_volume: demandByDomain[domainKey(c.domain)] ?? null,
          brand_trends_score: trendsByName[c.name.trim().toLowerCase()] ?? null,
          fetched_at: new Date().toISOString(),
        },
        evidence,
      });
    }

    // 3. UPSERT seo_cache (per competitor) + competitor_profiles (per competitor).
    for (const res of results) {
      await upsertSeoCache(sb, msg, res);
      await upsertCompetitorProfile(sb, msg, res);
    }

    // The sweep runs once; a competitor simply not appearing is real "invisible"
    // data, not a failure. Only a market that returned NO SERP results at all is
    // degraded (honest partial). Zero competitors configured is a clean 'ok'.
    const noData = competitors.length > 0 && !sweep.hadData;
    const outcome: "ok" | "failed" | "partial" = noData ? "partial" : "ok";

    await recordFeatureHealth(sb, {
      scan_job_id: msg.scan_job_id,
      brand_id: msg.brand_id,
      scan_week: msg.scan_week,
      feature_category: "traffic_seo",
      feature_name: "Traffic & SEO",
      status: noData ? "degraded" : "healthy",
      ...(noData
        ? { root_cause: "Live Google SERP returned no results for this market/keywords this week" }
        : {}),
    });

    // 4. Record module completion; if this call finished the fan-out → synthesis.
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
}));

// ── Haiku: cluster ranked keyword gaps → content_gaps ────────────────────────
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
      async () => {
        const route = await resolveRoute(sb, "researcher_structuring", {
          model: MODELS.haiku,
          temperature: 0.1,
          maxTokens: 700,
        });
        return callClaude({
          model: route.model,
          temperature: route.temperature,
          maxTokens: route.maxTokens,
          system: await loadPrompt(sb, "researcher:traffic_seo", TRAFFIC_SYSTEM),
          messages: [
            {
              role: "user",
              content:
                `Competitor: ${competitor.name}\nKeywords:\n` + gapKeywords.join("\n"),
            },
          ],
        });
      },
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
