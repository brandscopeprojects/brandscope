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
import { languageCode } from "../_shared/dataforseo.ts";
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

  const language = languageCode(msg.markets);

  // 1. Gather DataForSEO promo signals (each source isolated; partial is fine).
  const [mentionsR, newsR, volumeR] = await Promise.allSettled([
    fetchBonusMentions(competitor.domain, competitor.name, location, undefined, language),
    fetchPromoNews(competitor.name, competitor.domain, location, undefined, language),
    fetchBonusKeywordVolume(competitor.name, competitor.domain, location, language),
  ]);

  const allMentions: ContentMention[] = mentionsR.status === "fulfilled" ? mentionsR.value : [];
  const allNews: NewsItem[] = newsR.status === "fulfilled" ? newsR.value : [];
  const volume = volumeR.status === "fulfilled"
    ? volumeR.value
    : { total: null, monthlyDeltaPct: null };

  // FRESHNESS GATE: a promo signal is only actionable if it is CURRENT. A dated
  // item older than the window must never become evidence for an "active
  // campaign" recommendation (a 13-month-old rewards article once drove a
  // "counter this now" rec). News MUST be dated and fresh; mentions keep
  // undated items (content search is recency-ranked) but drop dated-stale ones.
  const freshNews = allNews.filter((n) => isFresh(n.timestamp, /*requireDate*/ true));
  const freshMentions = allMentions.filter((m) => isFresh(m.timestamp, /*requireDate*/ false));
  const staleNewsDropped = allNews.length - freshNews.length;
  const staleMentionsDropped = allMentions.length - freshMentions.length;

  // ENTITY-RELEVANCE GATE: keyword search fuzzy-matches similar brand names
  // (e.g. "Betvita" → BelVita biscuits), polluting evidence with off-topic
  // content. Keep an item only if it names the competitor, links to its own
  // site, or is clearly betting/gaming content.
  const label = (competitor.name ?? "").trim() || stripDomain(competitor.domain);
  const apex = stripDomain(competitor.domain).toLowerCase();
  const news = freshNews.filter((n) => isRelevant(n.title, n.url, label, apex));
  const mentions = freshMentions.filter((m) => isRelevant(m.text, m.url, label, apex));
  const offtopicNewsDropped = freshNews.length - news.length;
  const offtopicMentionsDropped = freshMentions.length - mentions.length;

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
      // Freshness accounting — how many dated-stale items were excluded, and the
      // real publication time of the item backing source_url (evidence honesty).
      stale_news_dropped: staleNewsDropped,
      stale_mentions_dropped: staleMentionsDropped,
      offtopic_news_dropped: offtopicNewsDropped,
      offtopic_mentions_dropped: offtopicMentionsDropped,
      evidence_published_at: news.find((n) => n.url === promoUrl)?.timestamp ??
        mentions.find((m) => m.url === promoUrl)?.timestamp ?? null,
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

// Promo-signal freshness window. Dated items older than this never become
// evidence. `requireDate` (news announcements) also drops undated items;
// mentions keep undated ones (the content endpoint is recency-ranked).
const FRESHNESS_DAYS = 60;

function isFresh(timestamp: string | null | undefined, requireDate: boolean): boolean {
  if (!timestamp) return !requireDate;
  const t = Date.parse(timestamp);
  if (Number.isNaN(t)) return !requireDate;
  return Date.now() - t <= FRESHNESS_DAYS * 24 * 60 * 60 * 1000;
}

// Betting/gaming context — \b keeps "bet" from matching inside "BelVita".
const GAMING_CONTEXT =
  /\b(bet|bets|betting|casino|gambl\w*|odds|wager\w*|punter\w*|bookmaker\w*|jackpot|stake\w*|free\s?bet|promo\s?code|sportsbook)\b/i;

/** Item is about THIS competitor: names it, links to its site, or is gaming content. */
function isRelevant(
  text: string | null | undefined,
  url: string | null | undefined,
  label: string,
  apexDomain: string,
): boolean {
  const t = (text ?? "").toLowerCase();
  const u = (url ?? "").toLowerCase();
  const l = label.toLowerCase();
  if (l && (t.includes(l) || u.includes(l))) return true;
  if (apexDomain && u.includes(apexDomain)) return true;
  return GAMING_CONTEXT.test(t);
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
