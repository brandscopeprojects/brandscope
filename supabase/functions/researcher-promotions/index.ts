// researcher-promotions — the Promotion-SIGNALS Researcher (mvp-module-sources.md
// §8). Consumes a ScanModuleMessage (task_type 'promotions') from the POST body
// (brand-scan invokes researchers directly; the durable scan_modules queue is the
// recovery path). For each competitor it gathers DataForSEO promo SIGNALS, has
// Haiku classify the promo TYPE + extract a TITLE/novelty, computes DIRECTIONAL
// week-over-week bonus-keyword movement, and UPSERTs one promotions_cache row.
//
// SIGNALS ONLY — this function NEVER writes bonus_amount_kobo or
// wagering_requirement; both stay null at MVP (UI explains via tooltip). DataForSEO
// ONLY (no Firecrawl/Apify). All external content is UNTRUSTED → asUntrustedData
// before any LLM. Service-role client; every query scoped to msg.brand_id.
//
// Budget ≤90s. Per agent-orchestration.md: completeModule records the outcome and
// returns true exactly once when the fan-out finishes → we trigger synthesis.

import { serviceClient } from "../_shared/supabase.ts";
import { json, preflight, isAuthorizedInternal } from "../_shared/http.ts";
import { completeModule, enqueueSynthesis, invokeFunction } from "../_shared/scan.ts";
import { recordFeatureHealth, toDeadLetter } from "../_shared/logging.ts";
import { sha256 } from "../_shared/evidence.ts";
import type { ScanModuleMessage, CompetitorRef } from "../_shared/contracts.ts";
import type { SupabaseClient } from "../_shared/supabase.ts";
import {
  locationCode,
  fetchBonusMentions,
  fetchPromoNews,
  fetchBonusKeywordVolume,
  wowVolumeChangePct,
  type ContentMention,
  type NewsItem,
} from "./dataforseo-promotions.ts";
import { classifyPromo, type PromoClassification } from "./classify.ts";

const MODULE = "promotions" as const;
// Overall wall-clock guard — leave headroom under the 90s module budget.
const TIME_BUDGET_MS = 80_000;

Deno.serve(async (req: Request): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!isAuthorizedInternal(req)) return json({ error: "unauthorized" }, 401);

  let msg: ScanModuleMessage;
  try {
    msg = (await req.json()) as ScanModuleMessage;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!msg?.scan_job_id || !msg?.brand_id || !msg?.scan_week) {
    return json(
      { error: "missing_fields", required: ["scan_job_id", "brand_id", "scan_week"] },
      400,
    );
  }
  if (msg.task_type && msg.task_type !== MODULE) {
    return json({ error: "wrong_task_type", expected: MODULE, got: msg.task_type }, 400);
  }

  const sb = serviceClient();
  const competitors = Array.isArray(msg.competitors) ? msg.competitors : [];
  const location = locationCode(msg.markets);
  const deadline = Date.now() + TIME_BUDGET_MS;

  try {
    // Previous-week bonus-keyword volume per competitor (for the directional WoW delta).
    const prevVolume = await loadPreviousVolume(sb, msg.brand_id, msg.scan_week);

    // Process competitors in parallel; one failure never blocks the others.
    const settled = await Promise.allSettled(
      competitors.map((c) =>
        processCompetitor(sb, msg, c, location, prevVolume.get(c.id) ?? null, deadline),
      ),
    );

    const total = settled.length;
    const ok = settled.filter((s) => s.status === "fulfilled").length;
    const failed = total - ok;

    // Module outcome: ok if everything (or nothing-to-do) succeeded; partial if some
    // competitors failed but others wrote; failed only if every competitor errored.
    const outcome: "ok" | "partial" | "failed" =
      total === 0 || failed === 0 ? "ok" : ok === 0 ? "failed" : "partial";

    await recordFeatureHealth(sb, {
      scan_job_id: msg.scan_job_id,
      brand_id: msg.brand_id,
      scan_week: msg.scan_week,
      feature_category: "promotions",
      feature_name: "Promotion Signals",
      status: outcome === "ok" ? "healthy" : outcome === "partial" ? "degraded" : "down",
      root_cause:
        failed > 0 ? `${failed}/${total} competitor promo signals failed` : null,
    });

    // Record this module's result on the fan-out; trigger synthesis exactly once.
    await finishAndMaybeSynthesise(sb, msg, outcome);

    return json({ ok: true, module: MODULE, competitors: total, succeeded: ok, failed });
  } catch (e) {
    // Whole-module failure → DLQ for the 6-hourly monitor, mark module failed, still
    // advance the fan-out so the job can complete (partial) rather than hang.
    const message = e instanceof Error ? e.message : String(e);
    await toDeadLetter(sb, {
      task_type: MODULE,
      payload: msg,
      brand_id: msg.brand_id,
      scan_job_id: msg.scan_job_id,
      failure_reason: "researcher-promotions module error",
      last_error: message,
    });
    await recordFeatureHealth(sb, {
      scan_job_id: msg.scan_job_id,
      brand_id: msg.brand_id,
      scan_week: msg.scan_week,
      feature_category: "promotions",
      feature_name: "Promotion Signals",
      status: "down",
      root_cause: message,
    });
    try {
      await finishAndMaybeSynthesise(sb, msg, "failed");
    } catch (_e) {
      // completion bookkeeping best-effort; monitor will reconcile via DLQ.
    }
    return json({ ok: false, module: MODULE, error: message }, 500);
  }
});

// ---------------------------------------------------------------------------
// Per-competitor pipeline: DataForSEO signals → Haiku classify → UPSERT.
// ---------------------------------------------------------------------------

async function processCompetitor(
  sb: SupabaseClient,
  msg: ScanModuleMessage,
  competitor: CompetitorRef,
  location: number,
  previousTotal: number | null,
  deadline: number,
): Promise<void> {
  if (Date.now() > deadline) throw new Error("time budget exceeded before competitor start");

  // 1. Gather DataForSEO promo signals (each source isolated; partial is fine).
  const [mentionsR, newsR, volumeR] = await Promise.allSettled([
    fetchBonusMentions(competitor.domain, competitor.name, location),
    fetchPromoNews(competitor.name, competitor.domain, location),
    fetchBonusKeywordVolume(competitor.name, competitor.domain, location),
  ]);

  const mentions: ContentMention[] = mentionsR.status === "fulfilled" ? mentionsR.value : [];
  const news: NewsItem[] = newsR.status === "fulfilled" ? newsR.value : [];
  const volume = volumeR.status === "fulfilled"
    ? volumeR.value
    : { total: null, monthlyDeltaPct: null };

  // 2. Haiku classifies promo TYPE + TITLE + novelty (SIGNALS ONLY, no amounts).
  const cls: PromoClassification = await classifyPromo(
    sb,
    { scan_job_id: msg.scan_job_id, brand_id: msg.brand_id },
    competitor.name,
    mentions,
    news,
  );

  // 3. Directional WoW bonus-keyword movement (a permitted % delta — NOT an amount).
  const wowBonusChangePct = wowVolumeChangePct(volume, previousTotal);
  // No independent wagering signal exists at MVP; mirror the bonus-interest direction
  // as the wagering-direction signal (still a % delta, never an exact requirement).
  const wowWageringChangePct = wowBonusChangePct;

  // 4. Pick the best source/promo URL for the evidence chain.
  const promoUrl =
    pickUrl(news, mentions) ?? null;
  const sourceUrl = promoUrl ?? `https://${stripDomain(competitor.domain)}`;

  // Evidence hash over (source + the classified signal text) — provenance only.
  const evidenceText = [
    cls.promoTitle ?? "",
    cls.promoType ?? "",
    ...mentions.slice(0, 5).map((m) => m.text),
    ...news.slice(0, 5).map((n) => n.title),
  ].join("\n");
  const evidenceHash = await sha256(`${sourceUrl}\n${evidenceText}`);

  // 5. UPSERT one promotions_cache row. EXACT-AMOUNT COLUMNS STAY NULL.
  const row = {
    brand_id: msg.brand_id,
    scan_week: msg.scan_week,
    competitor_id: competitor.id,
    promo_title: cls.promoTitle,
    promo_type: cls.promoType,
    promo_url: promoUrl,
    source_url: sourceUrl,
    scraped_at: new Date().toISOString(),
    is_new: cls.isNew,
    evidence_hash: evidenceHash,
    wow_bonus_change_pct: wowBonusChangePct,
    wow_wagering_change_pct: wowWageringChangePct,
    // SIGNALS ONLY — never write exact figures at MVP:
    bonus_amount_kobo: null,
    wagering_requirement: null,
    raw_data: {
      has_promo: cls.hasPromo,
      data_quality_score: cls.dataQualityScore,
      mention_count: mentions.length,
      news_count: news.length,
      bonus_keyword_volume_total: volume.total,
      bonus_keyword_monthly_delta_pct: volume.monthlyDeltaPct,
      mentions: mentions.slice(0, 10),
      news: news.slice(0, 10),
    },
  };

  const { error } = await sb
    .from("promotions_cache")
    .upsert(row, { onConflict: "brand_id,scan_week,competitor_id" });
  if (error) throw new Error(`promotions_cache upsert (${competitor.id}): ${error.message}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Most recent previous-week bonus-keyword volume total per competitor (for WoW). */
async function loadPreviousVolume(
  sb: SupabaseClient,
  brandId: string,
  scanWeek: string,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const { data } = await sb
    .from("promotions_cache")
    .select("competitor_id, scan_week, raw_data")
    .eq("brand_id", brandId)
    .lt("scan_week", scanWeek)
    .order("scan_week", { ascending: false });
  if (!data) return out;
  // First (most recent) row per competitor wins.
  for (const r of data) {
    const cid = r.competitor_id as string;
    if (out.has(cid)) continue;
    const raw = (r.raw_data ?? {}) as Record<string, unknown>;
    const total = raw.bonus_keyword_volume_total;
    if (typeof total === "number" && Number.isFinite(total)) out.set(cid, total);
  }
  return out;
}

/** Prefer a news announcement URL, then a content-mention URL. */
function pickUrl(news: NewsItem[], mentions: ContentMention[]): string | null {
  for (const n of news) if (n.url) return n.url;
  for (const m of mentions) if (m.url) return m.url;
  return null;
}

function stripDomain(domain: string): string {
  return (domain || "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? domain;
}

/** Record the module outcome on the fan-out; enqueue + invoke synthesis once. */
async function finishAndMaybeSynthesise(
  sb: SupabaseClient,
  msg: ScanModuleMessage,
  outcome: "ok" | "partial" | "failed",
): Promise<void> {
  const isLast = await completeModule(sb, msg.scan_job_id, MODULE, outcome);
  if (!isLast) return;
  const synth = {
    scan_job_id: msg.scan_job_id,
    brand_id: msg.brand_id,
    scan_week: msg.scan_week,
  };
  await enqueueSynthesis(sb, synth);
  await invokeFunction("synthesis-draft-audit", synth);
}
