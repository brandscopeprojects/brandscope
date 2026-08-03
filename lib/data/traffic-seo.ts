import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBrand, type BrandSummary } from "@/lib/data/brand";
import {
  getBrandCompetitors,
  competitorNameMap,
  latestScanWeek,
} from "@/lib/data/competitors";
import type { Json } from "@/types/database.types";

export { getCurrentBrand, type BrandSummary } from "@/lib/data/brand";

// ── jsonb contracts (Sprint 3 cache-population WRITE TARGET) ─────────────────
// These local types document the exact shapes the Researcher agent must write
// into `seo_cache`'s jsonb columns during the weekly DataForSEO Labs scan. The
// page reads them back; the populator (Sprint 3, step 18) must satisfy them so
// the UI renders real data with no client-side reshaping. Unknown/absent values
// are nullable, never faked.

/** One row of `seo_cache.keyword_gaps[]` — a keyword the competitor ranks for
 *  and the brand does (or does not). `brandRank` null = brand not ranking. */
export type KeywordGap = {
  keyword: string;
  volume: number | null;
  competitorRank: number | null;
  brandRank: number | null;
  difficulty: number | null;
};

/** One row of `seo_cache.content_gaps[]` — a content topic/cluster the
 *  competitor covers that the brand is thin on. */
export type ContentGap = {
  topic: string;
  competitorPages: number | null;
  brandPages: number | null;
};

/** One row of `seo_cache.serp_positions[]` — the competitor's organic position
 *  for a tracked keyword and the ranking URL. */
export type SerpPosition = {
  keyword: string;
  position: number | null;
  url: string | null;
};

// ── view models ──────────────────────────────────────────────────────────────

/** Per-competitor SEO snapshot for the latest scan_week, name-resolved. */
export type CompetitorSeo = {
  competitorId: string;
  name: string;
  tier: string | null;
  /** True for the synthetic "you" row (the brand's own snapshot). */
  isOwnBrand?: boolean;
  domainAuthority: number | null;
  estimatedTraffic: number | null;
  organicTraffic: number | null;
  paidTraffic: number | null;
  /** Organic share of (organic + paid), 0–100, null when no traffic split. */
  organicPct: number | null;
  /** Paid share of (organic + paid), 0–100, null when no traffic split. */
  paidPct: number | null;
  keywordGaps: KeywordGap[];
};

/** A keyword gap flattened across competitors, tagged with which competitor
 *  surfaced it (used by the union gap table). */
export type RankedKeywordGap = KeywordGap & {
  competitorId: string;
  competitorName: string;
};

/** One keyword's competitive ranking landscape (keyword-centric view): search
 *  volume, the brand's own rank, and each competitor's rank. Powers the mobile
 *  keyword cards. Sorted by volume desc; money/discovery terms only. */
export type KeywordLandscapeRow = {
  keyword: string;
  volume: number | null;
  brandRank: number | null;
  competitors: Array<{ name: string; rank: number }>;
};

export type TrafficSeoData = {
  scanWeek: string;
  competitors: CompetitorSeo[];
  /** Union of every keyword gap across competitors, dedup'd by keyword keeping
   *  the highest-volume occurrence, sorted volume-desc. Full list (the page
   *  caps + flags truncation rather than silently dropping). */
  keywordGaps: RankedKeywordGap[];
  /** Keyword-centric ranking landscape (real volume, your rank + rivals' ranks). */
  landscape: KeywordLandscapeRow[];
};

function asArray(json: Json | null): unknown[] {
  return Array.isArray(json) ? json : [];
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Map a raw jsonb keyword-gap element to the KeywordGap contract. */
function toKeywordGap(raw: unknown): KeywordGap | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const keyword = typeof r.keyword === "string" ? r.keyword : null;
  if (!keyword) return null;
  return {
    keyword,
    volume: num(r.volume),
    competitorRank: num(r.competitorRank),
    brandRank: num(r.brandRank),
    difficulty: num(r.difficulty),
  };
}

/** Pull the brand's own visibility snapshot from any row's `raw_data.brand_self`
 *  (the researcher writes the same blob on every competitor row). Null if absent
 *  (e.g. a pre-refactor scan). */
function readBrandSelf(
  rows: Array<{ raw_data?: Json | null }>,
): { name: string; visibilityScore: number | null; organicHits: number; paidHits: number } | null {
  for (const r of rows) {
    const rd = r.raw_data;
    if (!rd || typeof rd !== "object" || Array.isArray(rd)) continue;
    const bs = (rd as Record<string, unknown>).brand_self;
    if (bs && typeof bs === "object" && !Array.isArray(bs)) {
      const b = bs as Record<string, unknown>;
      return {
        name: typeof b.name === "string" ? b.name : "",
        visibilityScore: num(b.visibility_score),
        organicHits: num(b.organic_hits) ?? 0,
        paidHits: num(b.paid_hits) ?? 0,
      };
    }
  }
  return null;
}

/** Pull the keyword-ranking landscape from any row's `raw_data.keyword_landscape`
 *  (same blob on every competitor row). [] if absent (pre-refactor scan). */
function readLandscape(rows: Array<{ raw_data?: Json | null }>): KeywordLandscapeRow[] {
  for (const r of rows) {
    const rd = r.raw_data;
    if (!rd || typeof rd !== "object" || Array.isArray(rd)) continue;
    const kl = (rd as Record<string, unknown>).keyword_landscape;
    if (!Array.isArray(kl)) continue;
    return kl
      .map((raw): KeywordLandscapeRow | null => {
        if (!raw || typeof raw !== "object") return null;
        const o = raw as Record<string, unknown>;
        const keyword = typeof o.keyword === "string" ? o.keyword : null;
        if (!keyword) return null;
        const competitors = Array.isArray(o.competitors)
          ? (o.competitors as unknown[])
              .map((c) => {
                const cc = (c ?? {}) as Record<string, unknown>;
                const name = typeof cc.name === "string" ? cc.name : null;
                const rank = num(cc.rank);
                return name && rank != null ? { name, rank } : null;
              })
              .filter((x): x is { name: string; rank: number } => x !== null)
          : [];
        return { keyword, volume: num(o.volume), brandRank: num(o.brandRank), competitors };
      })
      .filter((x): x is KeywordLandscapeRow => x !== null);
  }
  return [];
}

/**
 * Latest `seo_cache` snapshot for the brand, mapped to view models.
 * `seo_cache` is PER-COMPETITOR (brand_id + competitor_id + scan_week): we fetch
 * every row for the brand, pick the most recent scan_week, filter to it, and
 * resolve competitor_id → display name/tier via brand_competitors. Returns null
 * when no scan cache exists yet (pre-first-scan empty state — no fabricated data).
 */
export async function getTrafficSeoData(
  brand: BrandSummary,
): Promise<TrafficSeoData | null> {
  const supabase = createClient();

  const { data: rows } = await supabase
    .from("seo_cache")
    .select(
      "competitor_id, scan_week, domain_authority, estimated_traffic, organic_traffic, paid_traffic, keyword_gaps, raw_data",
    )
    .eq("brand_id", brand.id);

  if (!rows || rows.length === 0) return null;

  const scanWeek = latestScanWeek(rows);
  if (!scanWeek) return null;

  const latest = rows.filter((r) => r.scan_week === scanWeek);
  if (latest.length === 0) return null;

  const brandCompetitors = await getBrandCompetitors(brand.id);
  const nameMap = competitorNameMap(brandCompetitors);
  const tierMap = new Map(brandCompetitors.map((c) => [c.id, c.tier]));

  const competitorRows: CompetitorSeo[] = latest
    // Only surface rows we can resolve to a tracked competitor name.
    .filter((r) => nameMap.has(r.competitor_id))
    .map((r) => {
      const organic = num(r.organic_traffic);
      const paid = num(r.paid_traffic);
      const split = (organic ?? 0) + (paid ?? 0);
      const hasSplit = organic != null || paid != null;
      const keywordGaps = asArray(r.keyword_gaps)
        .map(toKeywordGap)
        .filter((g): g is KeywordGap => g !== null);

      return {
        competitorId: r.competitor_id,
        name: nameMap.get(r.competitor_id) ?? r.competitor_id,
        tier: tierMap.get(r.competitor_id) ?? null,
        isOwnBrand: false,
        domainAuthority: num(r.domain_authority),
        estimatedTraffic: num(r.estimated_traffic),
        organicTraffic: organic,
        paidTraffic: paid,
        organicPct: hasSplit && split > 0 ? Math.round(((organic ?? 0) / split) * 100) : null,
        paidPct: hasSplit && split > 0 ? Math.round(((paid ?? 0) / split) * 100) : null,
        keywordGaps,
      } satisfies CompetitorSeo;
    });

  // The brand's OWN snapshot (raw_data.brand_self, written by the researcher) →
  // a highlighted "you" row so the customer sees where THEY stand, not just rivals.
  const self = readBrandSelf(latest);
  const ownRow: CompetitorSeo | null = self
    ? (() => {
        const split = self.organicHits + self.paidHits;
        return {
          competitorId: `self:${brand.id}`,
          name: self.name || brand.name,
          tier: null,
          isOwnBrand: true,
          domainAuthority: self.visibilityScore,
          estimatedTraffic: null,
          organicTraffic: self.organicHits,
          paidTraffic: self.paidHits,
          organicPct: split > 0 ? Math.round((self.organicHits / split) * 100) : null,
          paidPct: split > 0 ? Math.round((self.paidHits / split) * 100) : null,
          keywordGaps: [],
        } satisfies CompetitorSeo;
      })()
    : null;

  // Own brand + competitors, strongest search visibility first (own row sorts in
  // by its real score; the highlight makes it identifiable regardless of position).
  const competitors: CompetitorSeo[] = [...(ownRow ? [ownRow] : []), ...competitorRows].sort(
    (a, b) => (b.domainAuthority ?? 0) - (a.domainAuthority ?? 0),
  );

  // Union of keyword gaps across competitors, dedup'd by keyword (keep the
  // highest-volume occurrence), sorted volume-desc.
  const byKeyword = new Map<string, RankedKeywordGap>();
  for (const c of competitors) {
    for (const g of c.keywordGaps) {
      const existing = byKeyword.get(g.keyword);
      const candidate: RankedKeywordGap = {
        ...g,
        competitorId: c.competitorId,
        competitorName: c.name,
      };
      if (!existing || (candidate.volume ?? 0) > (existing.volume ?? 0)) {
        byKeyword.set(g.keyword, candidate);
      }
    }
  }
  const keywordGaps = Array.from(byKeyword.values()).sort(
    (a, b) => (b.volume ?? 0) - (a.volume ?? 0),
  );

  return { scanWeek, competitors, keywordGaps, landscape: readLandscape(latest) };
}
