// researcher-app-store — the App-Store Researcher (agent-orchestration.md step 3).
// Module task_type 'app_store'. Provider: DataForSEO App Data ONLY
// (mvp-module-sources.md §5). Per competitor it pulls app reviews + app info +
// vertical signals, runs two Haiku extractions, then UPSERTs:
//   - product_intel_cache  (vertical statuses, aviator promo/bonus, odds score,
//     new_products_detected, raw_data)
//   - customer_intel_cache (app_rating, app_review_count, sentiment_score,
//     complaint_themes) — APP-DERIVED FIELDS ONLY, written WITHOUT clobbering the
//     Customer researcher's demographics/geographic_distribution/traffic_sources.
//
// Pattern mirrors the other researchers: internal-auth skeleton → Promise.allSettled
// over competitors (one failure never blocks others, data-flow-rules.md §4) →
// completeModule('ok'|'partial'|'failed') → if the fan-out finished, enqueue +
// invoke synthesis. 90s budget: review counts capped, task_post polling bounded.
//
// Isolation: service role bypasses RLS, so every query is scoped to msg.brand_id.
// Reviews are UNTRUSTED → wrapped via asUntrustedData inside extract.ts.

import { serviceClient } from "../_shared/supabase.ts";
import { json, preflight, isAuthorizedInternal } from "../_shared/http.ts";
import { completeModule, enqueueSynthesis, invokeFunction } from "../_shared/scan.ts";
import { recordFeatureHealth, toDeadLetter } from "../_shared/logging.ts";
import { type ScanModuleMessage, type CompetitorRef } from "../_shared/contracts.ts";
import { languageCode } from "../_shared/dataforseo.ts";
import {
  guessPackageIds,
  fetchGoogleAppInfo,
  fetchGoogleReviews,
  fetchVerticalSignals,
  type AppInfo,
} from "./dfs-app.ts";
import {
  extractFromReviews,
  extractProductSignals,
  computeOddsCompetitiveness,
} from "./extract.ts";

const MODULE_BUDGET_MS = 85_000; // keep inside the 90s module timeout
const REVIEW_CAP = 200; // ~200 reviews/competitor (mvp-module-sources.md §5)

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
  if (!msg?.scan_job_id || !msg?.brand_id || msg.task_type !== "app_store") {
    return json({ error: "expected ScanModuleMessage with task_type 'app_store'" }, 400);
  }

  const deadline = Date.now() + MODULE_BUDGET_MS;
  const competitors = msg.competitors ?? [];

  try {
    // Fan out across competitors; one failure never blocks the others.
    const settled = await Promise.allSettled(
      competitors.map((c) => processCompetitor(sb, msg, c, deadline)),
    );

    const total = settled.length;
    const failures = settled.filter((s) => s.status === "rejected").length;
    const successes = total - failures;

    // Outcome semantics (data-flow-rules.md §4):
    //  - zero competitors → 'ok' (nothing to do, not a failure)
    //  - all failed (and there were some) → 'failed'
    //  - some failed → 'partial'; all succeeded → 'ok'
    let outcome: "ok" | "partial" | "failed";
    if (total === 0) outcome = "ok";
    else if (successes === 0) outcome = "failed";
    else if (failures > 0) outcome = "partial";
    else outcome = "ok";

    await recordFeatureHealth(sb, {
      scan_job_id: msg.scan_job_id,
      brand_id: msg.brand_id,
      scan_week: msg.scan_week,
      feature_category: "product_intel",
      feature_name: "App-Store Researcher",
      status: outcome === "ok" ? "healthy" : outcome === "partial" ? "degraded" : "down",
      root_cause: failures > 0 ? `${failures}/${total} competitors failed app-store fetch` : null,
    });

    // Record the module result; if THIS call closed the fan-out, drive synthesis.
    const finished = await completeModule(sb, msg.scan_job_id, "app_store", outcome);
    if (finished) {
      const synth = { scan_job_id: msg.scan_job_id, brand_id: msg.brand_id, scan_week: msg.scan_week };
      await enqueueSynthesis(sb, synth);
      await invokeFunction("synthesis-draft-audit", synth);
    }

    return json({ ok: true, outcome, competitors: total, failures });
  } catch (e) {
    // Fatal module failure (not a single-competitor failure): DLQ + mark failed.
    const message = e instanceof Error ? e.message : String(e);
    await toDeadLetter(sb, {
      task_type: "app_store",
      payload: msg as unknown,
      brand_id: msg.brand_id,
      scan_job_id: msg.scan_job_id,
      failure_reason: "researcher-app-store fatal",
      last_error: message,
    });
    await recordFeatureHealth(sb, {
      scan_job_id: msg.scan_job_id,
      brand_id: msg.brand_id,
      scan_week: msg.scan_week,
      feature_category: "product_intel",
      feature_name: "App-Store Researcher",
      status: "down",
      root_cause: message,
    });
    try {
      const finished = await completeModule(sb, msg.scan_job_id, "app_store", "failed");
      if (finished) {
        const synth = { scan_job_id: msg.scan_job_id, brand_id: msg.brand_id, scan_week: msg.scan_week };
        await enqueueSynthesis(sb, synth);
        await invokeFunction("synthesis-draft-audit", synth);
      }
    } catch (_e) { /* best-effort */ }
    return json({ ok: false, error: message }, 500);
  }
});

/**
 * One competitor: discover its Google-Play app, pull reviews + info + vertical
 * signals, run the two Haiku extractions, and UPSERT both cache tables. Throws on
 * a hard failure so allSettled marks it rejected (→ partial/failed at module level).
 */
async function processCompetitor(
  sb: ReturnType<typeof serviceClient>,
  msg: ScanModuleMessage,
  competitor: CompetitorRef,
  deadline: number,
): Promise<void> {
  const remaining = () => Math.max(0, deadline - Date.now());
  const language = languageCode(msg.markets);

  // 1. Resolve the app (best-effort; degrade to "no app found" without faking).
  const candidateIds = guessPackageIds(competitor.domain, competitor.name);
  const info: AppInfo | null = await fetchGoogleAppInfo(
    candidateIds,
    Math.min(25_000, remaining()),
    language,
  );

  // 2. Reviews + vertical signals (only when we resolved an app).
  let reviews: Awaited<ReturnType<typeof fetchGoogleReviews>> = [];
  let verticalKeywords: string[] = [];
  if (info) {
    reviews = await fetchGoogleReviews(info.ref.appId, REVIEW_CAP, Math.min(35_000, remaining()), language);
    if (remaining() > 8_000) {
      const signals = await fetchVerticalSignals(info.ref.appId, language);
      verticalKeywords = signals.keywords;
    }
  }

  const ctx = {
    scanJobId: msg.scan_job_id,
    brandId: msg.brand_id,
    competitorId: competitor.id,
  };

  // 3. Haiku extractions (reviews are wrapped untrusted inside these helpers).
  const reviewExtract = await extractFromReviews(sb, ctx, reviews);
  const productExtract = await extractProductSignals(
    sb,
    ctx,
    info,
    verticalKeywords,
    reviewExtract.new_feature_mentions,
  );

  const oddsScore = computeOddsCompetitiveness(
    info?.rating ?? null,
    productExtract.sports_betting_status,
  );

  // 4. UPSERT product_intel_cache (this researcher OWNS this table).
  const { error: prodErr } = await sb
    .from("product_intel_cache")
    .upsert(
      {
        brand_id: msg.brand_id,
        scan_week: msg.scan_week,
        competitor_id: competitor.id,
        sports_betting_status: productExtract.sports_betting_status,
        casino_status: productExtract.casino_status,
        crash_games_status: productExtract.crash_games_status,
        lottery_status: productExtract.lottery_status,
        aviator_promo_active: productExtract.aviator_promo_active,
        aviator_bonus_structure: productExtract.aviator_bonus_structure as unknown,
        odds_competitiveness_score: oddsScore,
        new_products_detected: productExtract.new_products_detected,
        raw_data: {
          app_id: info?.ref.appId ?? null,
          store_url: info?.storeUrl ?? null,
          app_rating: info?.rating ?? null,
          review_count_fetched: reviews.length,
          vertical_keywords: verticalKeywords.slice(0, 50),
          new_feature_mentions: reviewExtract.new_feature_mentions,
        } as unknown,
      },
      { onConflict: "brand_id,scan_week,competitor_id" },
    );
  if (prodErr) throw new Error(`product_intel_cache upsert: ${prodErr.message}`);

  // 5. customer_intel_cache — write ONLY app-derived fields, WITHOUT clobbering the
  // Customer researcher's demographics/geographic_distribution/traffic_sources.
  // The Customer researcher writes the SAME (brand,week,competitor) row. A blind
  // upsert with our subset would null its columns (upsert replaces the row), so we
  // branch on whether the row already exists and write ONLY the app columns either
  // way. Both writers are idempotent on the app fields; order-independent.
  await writeCustomerAppFields(sb, {
    brandId: msg.brand_id,
    scanWeek: msg.scan_week,
    competitorId: competitor.id,
    appRating: info?.rating ?? null,
    appReviewCount: info?.reviewCount ?? null,
    sentimentScore: reviewExtract.sentiment_score,
    complaintThemes: reviewExtract.complaint_themes,
  });
}

/**
 * Write ONLY the app-derived columns of customer_intel_cache, never touching the
 * Customer researcher's demographics / geographic_distribution / traffic_sources.
 * If a row already exists for (brand, week, competitor) we UPDATE just the app
 * columns; otherwise we INSERT a row with only the app columns set (the rest stay
 * null until the Customer researcher fills them). This avoids the row-replacement
 * clobber a plain upsert would cause.
 */
async function writeCustomerAppFields(
  sb: ReturnType<typeof serviceClient>,
  p: {
    brandId: string;
    scanWeek: string;
    competitorId: string;
    appRating: number | null;
    appReviewCount: number | null;
    sentimentScore: number | null;
    complaintThemes: unknown;
  },
): Promise<void> {
  const appCols = {
    app_rating: p.appRating,
    app_review_count: p.appReviewCount,
    sentiment_score: p.sentimentScore,
    complaint_themes: p.complaintThemes as unknown,
  };

  const { data: existing } = await sb
    .from("customer_intel_cache")
    .select("id")
    .eq("brand_id", p.brandId)
    .eq("scan_week", p.scanWeek)
    .eq("competitor_id", p.competitorId)
    .maybeSingle();

  if (existing) {
    const { error } = await sb
      .from("customer_intel_cache")
      .update(appCols)
      .eq("id", existing.id);
    if (error) throw new Error(`customer_intel_cache update: ${error.message}`);
  } else {
    const { error } = await sb.from("customer_intel_cache").insert({
      brand_id: p.brandId,
      scan_week: p.scanWeek,
      competitor_id: p.competitorId,
      ...appCols,
    });
    // A race with the Customer researcher inserting first can hit the unique
    // constraint; fall back to updating the app columns only.
    if (error) {
      const { error: updErr } = await sb
        .from("customer_intel_cache")
        .update(appCols)
        .eq("brand_id", p.brandId)
        .eq("scan_week", p.scanWeek)
        .eq("competitor_id", p.competitorId);
      if (updErr) throw new Error(`customer_intel_cache insert+update: ${error.message} / ${updErr.message}`);
    }
  }
}
