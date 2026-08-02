// Live-SERP visibility for researcher-traffic-seo (Route A).
// DataForSEO Labs is blind to small country-specific betting domains (betika.co.zm
// etc. → all dashes). This module instead reads LIVE Google SERPs for a small,
// curated, CRO-grade keyword set (brand-defense · conquesting · money terms) via
// serp/google/organic/live/advanced — the same live endpoint GEO/onboarding use,
// which DOES return data for any market. From ONE market-shared sweep we derive,
// for every tracked competitor: a search-visibility score, organic/paid presence,
// SERP positions, and real keyword gaps.
//
// Cost: each keyword's SERP is cached per (market, scan_week, keyword) via
// market_intel_cache, so sibling brands in the same market and same-week re-scans
// are cache hits. ~16 calls for the first brand in a market, ~4 thereafter.

import { dfsPost, firstResult } from "../_shared/dataforseo.ts";
import { getOrFetchMarketIntelKeyed } from "../_shared/market-cache.ts";
import type { SupabaseClient } from "../_shared/supabase.ts";
import type { CompetitorRef } from "../_shared/contracts.ts";
import type { KeywordGap, SerpPosition } from "./types.ts";

const SWEEP_KIND = "serp_sweep";
const SERP_DEPTH = 20;
const SWEEP_CONCURRENCY = 4;
const MAX_GAPS_PER_COMPETITOR = 50;
const MAX_SERP_POSITIONS = 100;
const MAX_CONQUEST_TERMS = 5;

export type SerpItem = { domain: string; rank: number | null; type: "organic" | "paid" };

/** One tracked competitor's SERP-derived SEO snapshot (maps to seo_cache). */
export type CompetitorVisibility = {
  competitor: CompetitorRef;
  /** 0–100 share-of-search-voice across the swept keywords (relative to the
   *  strongest tracked competitor). null when the sweep returned nothing at all. */
  visibilityScore: number | null;
  /** # swept keywords where this competitor appears organically (top 20). */
  organicHits: number;
  /** # swept keywords where this competitor runs a paid ad. */
  paidHits: number;
  serpPositions: SerpPosition[];
  keywordGaps: KeywordGap[];
};

export type SweepResult = {
  /** keyword → the market-relevant keyword bucket it belongs to. */
  keywords: string[];
  /** keyword → parsed SERP items. */
  serpByKeyword: Record<string, SerpItem[]>;
  /** true when at least one keyword returned at least one result. */
  hadData: boolean;
};

// ── domain helpers ───────────────────────────────────────────────────────────
function normDomain(raw: string): string {
  return (raw ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}
function baseLabel(d: string): string {
  return normDomain(d).split(".")[0] ?? "";
}
/** Match a SERP domain to a tracked competitor domain, tolerating country/www
 *  variants (betway.co.zm ≈ betway.com) without short-label collisions. */
function domainMatches(serpDomain: string, compDomain: string): boolean {
  const a = normDomain(serpDomain);
  const b = normDomain(compDomain);
  if (!a || !b) return false;
  if (a === b || a.endsWith("." + b) || b.endsWith("." + a)) return true;
  const la = baseLabel(a);
  return la.length >= 4 && la === baseLabel(b);
}

// ── keyword set (CRO-grade: defense · conquest · money · discovery) ───────────
/** Build the curated sweep keyword set. Market slug is used verbatim in queries
 *  (Google normalises "zambia" fine); brand/competitor names ground the
 *  defense/conquest buckets. */
export function buildSweepKeywords(
  brandName: string,
  marketSlug: string,
  competitors: CompetitorRef[],
): string[] {
  const market = (marketSlug || "").replace(/_/g, " ").trim();
  const brand = (brandName || "").trim();
  const set = new Set<string>();

  // A. Brand-defense — is anyone outranking/outbidding you on your OWN name.
  if (brand) {
    for (const t of [brand, `${brand} login`, `${brand} app`, `${brand} bonus`]) set.add(t);
  }
  // B. Conquesting — top competitors' brand terms (one SERP reveals who owns it
  //    AND whether you show up there).
  for (const c of competitors.slice(0, MAX_CONQUEST_TERMS)) {
    const name = (c.name || "").trim();
    if (name) set.add(name);
  }
  // C. Money & discovery terms — commercial intent, where conversions happen.
  // A wider set so the gap table has substance (a 6-term set was too thin, and
  // DataForSEO's long-tail volume for small markets is sparse). Each is one live
  // SERP, cached per (market, week, keyword) — sibling brands pay nothing.
  if (market) {
    for (const t of [
      // discovery / category
      `betting sites ${market}`,
      `sports betting ${market}`,
      `online casino ${market}`,
      `betting app ${market}`,
      `mobile betting ${market}`,
      // product / vertical intent
      `aviator ${market}`,
      `football betting ${market}`,
      `live betting ${market}`,
      `virtual betting ${market}`,
      `jackpot betting ${market}`,
      `casino games ${market}`,
      `premier league betting ${market}`,
      // offer / bonus intent
      `deposit bonus ${market}`,
      `welcome bonus ${market}`,
      `free bets ${market}`,
      `betting promotions ${market}`,
      // decision / conversion intent
      `best betting odds ${market}`,
      `fastest withdrawal betting ${market}`,
    ]) set.add(t);
  }
  return [...set].filter((k) => k.length > 1);
}

// ── one keyword's live SERP (organic + paid) ─────────────────────────────────
async function fetchSerpForKeyword(
  keyword: string,
  location: number,
  language: string,
): Promise<SerpItem[]> {
  const body = await dfsPost(
    "serp/google/organic/live/advanced",
    [{ keyword, location_code: location, language_code: language, depth: SERP_DEPTH }],
  );
  const results = firstResult<Record<string, unknown>>(
    body as { tasks?: Array<{ result?: Record<string, unknown>[] }> },
  );
  const items = Array.isArray(results[0]?.items)
    ? (results[0].items as Record<string, unknown>[])
    : [];
  const out: SerpItem[] = [];
  for (const it of items) {
    const type = it.type === "paid" ? "paid" : it.type === "organic" ? "organic" : null;
    if (!type) continue; // ignore featured snippets / PAA / maps etc.
    const domain = typeof it.domain === "string" ? normDomain(it.domain) : "";
    if (!domain) continue;
    const rankRaw = it.rank_group ?? it.rank_absolute;
    const rank = typeof rankRaw === "number" && Number.isFinite(rankRaw) ? rankRaw : null;
    out.push({ domain, rank, type });
  }
  return out;
}

/**
 * Run the sweep, one SERP per keyword, cached per (market, week, keyword) so
 * sibling brands / same-week re-scans don't re-pay. Never throws — a keyword that
 * fails resolves to [] (degrades to fewer signals, not a module failure).
 */
export async function runSerpSweep(
  sb: SupabaseClient,
  market: string,
  keywords: string[],
  location: number,
  language: string,
): Promise<SweepResult> {
  const serpByKeyword = await getOrFetchMarketIntelKeyed<SerpItem[]>(
    sb, market, SWEEP_KIND, keywords,
    async (missing) => {
      const out: Record<string, SerpItem[]> = {};
      let next = 0;
      async function worker() {
        while (true) {
          const i = next++;
          if (i >= missing.length) return;
          const kw = missing[i];
          out[kw] = await fetchSerpForKeyword(kw, location, language).catch(() => []);
        }
      }
      await Promise.all(
        Array.from({ length: Math.min(SWEEP_CONCURRENCY, missing.length) }, () => worker()),
      );
      return out;
    },
  );
  const hadData = Object.values(serpByKeyword).some((items) => (items?.length ?? 0) > 0);
  return { keywords, serpByKeyword, hadData };
}

// ── derive per-competitor visibility / positions / gaps from the shared sweep ─
function organicWeight(rank: number | null): number {
  if (rank == null) return 1;
  if (rank <= 3) return 3;
  if (rank <= 10) return 2;
  return 1;
}

/**
 * Pure derivation (no provider calls). For each tracked competitor, scan the swept
 * SERPs for its domain and compute a visibility score, organic/paid presence,
 * SERP positions, and keyword gaps (keyword a rival ranks for and the brand does
 * not). `volumes` backfills search volume per keyword (lowercased) for gap ranking.
 */
/** The BRAND's own SERP visibility snapshot (so the UI can show "where do I
 *  stand?", not just rivals). Scored on the same scale as competitors. */
export type BrandSelfVisibility = {
  visibilityScore: number | null;
  organicHits: number;
  paidHits: number;
};

export type VisibilityResult = {
  competitors: CompetitorVisibility[];
  brandSelf: BrandSelfVisibility;
};

export function deriveCompetitorVisibility(
  sweep: SweepResult,
  competitors: CompetitorRef[],
  brandDomain: string,
  brandName: string,
  volumes: Map<string, number>,
): VisibilityResult {
  const brand = normDomain(brandDomain);
  const brandTerms = new Set(
    [brandName, `${brandName} login`, `${brandName} app`, `${brandName} bonus`]
      .map((t) => t.toLowerCase().trim()),
  );
  // Navigational/brand terms — the brand's own defense terms AND every tracked
  // competitor's brand name (the conquest bucket). A rival ranking #1 for its OWN
  // name is conquest signal, NOT an actionable content gap, and its huge brand-
  // search volume would otherwise bury the real money-term gaps. Excluded from gaps.
  const navTerms = new Set(brandTerms);
  for (const cc of competitors) {
    const n = (cc.name || "").toLowerCase().trim();
    if (n) navTerms.add(n);
  }

  // Score any domain over the sweep: raw SOSV points, organic/paid hit counts,
  // SERP positions, and best organic rank per keyword.
  function scoreEntity(dom: string) {
    let rawScore = 0;
    let organicHits = 0;
    let paidHits = 0;
    const serpPositions: SerpPosition[] = [];
    const bestByKw = new Map<string, number | null>();
    for (const kw of sweep.keywords) {
      const items = sweep.serpByKeyword[kw.toLowerCase()] ?? sweep.serpByKeyword[kw] ?? [];
      let bestOrganic: number | null = null;
      let hasPaid = false;
      for (const it of items) {
        if (!domainMatches(it.domain, dom)) continue;
        if (it.type === "organic") {
          if (bestOrganic == null || (it.rank ?? 99) < bestOrganic) bestOrganic = it.rank ?? bestOrganic;
        } else if (it.type === "paid") {
          hasPaid = true;
        }
      }
      bestByKw.set(kw, bestOrganic);
      if (bestOrganic != null) {
        organicHits += 1;
        rawScore += organicWeight(bestOrganic);
        serpPositions.push({ keyword: kw, position: bestOrganic, url: null });
      }
      if (hasPaid) {
        paidHits += 1;
        rawScore += 1; // spending on this term is real acquisition signal
      }
    }
    return { rawScore, organicHits, paidHits, serpPositions, bestByKw };
  }

  const brandScored = scoreEntity(brand);
  const brandRankByKw = brandScored.bestByKw; // gap = competitor ranks, brand does not

  const raw = competitors.map((c) => {
    const s = scoreEntity(c.domain);
    const gaps: KeywordGap[] = [];
    for (const kw of sweep.keywords) {
      const isNavTerm = navTerms.has(kw.toLowerCase());
      const bestOrganic = s.bestByKw.get(kw) ?? null;
      if (!isNavTerm && bestOrganic != null && bestOrganic <= 10 && brandRankByKw.get(kw) == null) {
        gaps.push({
          keyword: kw,
          volume: volumes.get(kw.toLowerCase()) ?? null,
          competitorRank: bestOrganic,
          brandRank: null,
          difficulty: null,
        });
      }
    }
    gaps.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
    return {
      competitor: c,
      rawScore: s.rawScore,
      organicHits: s.organicHits,
      paidHits: s.paidHits,
      serpPositions: s.serpPositions.slice(0, MAX_SERP_POSITIONS),
      keywordGaps: gaps.slice(0, MAX_GAPS_PER_COMPETITOR),
    };
  });

  // Normalise against the strongest of {brand, all competitors} so the brand sits
  // on the same 0–100 scale as its rivals.
  const maxScore = Math.max(0, brandScored.rawScore, ...raw.map((r) => r.rawScore));
  const vis = (rawScore: number): number | null =>
    !sweep.hadData ? null : maxScore > 0 ? Math.round((rawScore / maxScore) * 100) : 0;

  return {
    competitors: raw.map((r) => ({
      competitor: r.competitor,
      visibilityScore: vis(r.rawScore),
      organicHits: r.organicHits,
      paidHits: r.paidHits,
      serpPositions: r.serpPositions,
      keywordGaps: r.keywordGaps,
    })),
    brandSelf: {
      visibilityScore: vis(brandScored.rawScore),
      organicHits: brandScored.organicHits,
      paidHits: brandScored.paidHits,
    },
  };
}
