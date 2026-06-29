import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBrand, type BrandSummary } from "@/lib/data/brand";
import {
  getBrandCompetitors,
  competitorNameMap,
  latestScanWeek,
} from "@/lib/data/competitors";

export { getCurrentBrand, type BrandSummary } from "@/lib/data/brand";

// Promotion Signals — Screen 6 (`/promotions`). Reads the per-competitor
// `promotions_cache` (DataForSEO OnPage + Content parsing, cron-populated) for the
// latest scan_week.
//
// MVP POLICY — SIGNALS ONLY (mvp-constraints.md module 8): this page is titled
// "Promotion Signals", not a tracker. The columns `bonus_amount_kobo` and
// `wagering_requirement` EXIST in the cache but MUST NOT be surfaced as exact
// figures. This data layer deliberately NEVER selects or returns those columns —
// only the existence/type/novelty of a promo and the DIRECTION of a WoW change.
// `wow_bonus_change_pct` / `wow_wagering_change_pct` are deltas (a directional
// signal), not the bonus amount itself, so they are permitted.

// ── view models ──────────────────────────────────────────────────────────────

/** One detected competitor promotion signal for the latest scan_week,
 *  name-resolved. No exact bonus/wagering figures — signals only. */
export type PromotionSignal = {
  competitorId: string;
  name: string;
  tier: string | null;
  /** Promotion title/headline as parsed (e.g. "Welcome Offer", "Acca Boost"). */
  promoTitle: string | null;
  /** Promotion type/category (e.g. "welcome", "deposit", "free_bet"). */
  promoType: string | null;
  /** True when this promo was first detected in this week's scan. */
  isNew: boolean;
  /** Direct link to the promotion page (preferred for the source link). */
  promoUrl: string | null;
  /** Evidence URL the signal was parsed from. */
  sourceUrl: string | null;
  /** When the source was scraped (ISO) — rendered mono as evidence. */
  scrapedAt: string | null;
  /** SHA-256 evidence hash (provenance; not rendered prominently). */
  evidenceHash: string | null;
  /** WoW DIRECTION of bonus-value change (delta %, a signal — not the amount). */
  wowBonusChangePct: number | null;
};

export type PromotionsData = {
  scanWeek: string;
  signals: PromotionSignal[];
  /** Real signal counts for the StatStrip — no fabricated amounts. */
  activeCount: number;
  newCount: number;
  competitorsWithPromos: number;
};

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Latest `promotions_cache` snapshot for the brand, mapped to signal view models.
 * `promotions_cache` is PER-COMPETITOR (brand_id + competitor_id + scan_week): we
 * fetch every row for the brand, pick the most recent scan_week, filter to it, and
 * resolve competitor_id → display name/tier via brand_competitors. Returns null
 * when no scan cache exists yet (pre-first-scan empty state — no fabricated data).
 *
 * NOTE: `bonus_amount_kobo` / `wagering_requirement` are intentionally NOT selected
 * — the page is signals-only and must never render exact bonus/wagering figures.
 */
export async function getPromotionsData(
  brand: BrandSummary,
): Promise<PromotionsData | null> {
  const supabase = createClient();

  const { data: rows } = await supabase
    .from("promotions_cache")
    .select(
      "competitor_id, scan_week, promo_title, promo_type, promo_url, source_url, scraped_at, is_new, evidence_hash, wow_bonus_change_pct",
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

  const signals: PromotionSignal[] = latest
    // Only surface rows we can resolve to a tracked competitor name.
    .filter((r) => nameMap.has(r.competitor_id))
    .map((r) => ({
      competitorId: r.competitor_id,
      name: nameMap.get(r.competitor_id) ?? r.competitor_id,
      tier: tierMap.get(r.competitor_id) ?? null,
      promoTitle: str(r.promo_title),
      promoType: str(r.promo_type),
      isNew: r.is_new === true,
      promoUrl: str(r.promo_url),
      sourceUrl: str(r.source_url),
      scrapedAt: str(r.scraped_at),
      evidenceHash: str(r.evidence_hash),
      wowBonusChangePct: num(r.wow_bonus_change_pct),
    }))
    // New promos first, then alphabetical by competitor for a stable read.
    .sort((a, b) => {
      if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  if (signals.length === 0) return null;

  const competitorsWithPromos = new Set(signals.map((s) => s.competitorId)).size;
  const newCount = signals.filter((s) => s.isNew).length;

  return {
    scanWeek,
    signals,
    activeCount: signals.length,
    newCount,
    competitorsWithPromos,
  };
}
