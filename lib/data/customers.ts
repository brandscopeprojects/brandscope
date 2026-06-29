import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/demo-mode";
import { getCurrentBrand, type BrandSummary } from "@/lib/data/brand";
import {
  getBrandCompetitors,
  competitorNameMap,
  latestScanWeek,
} from "@/lib/data/competitors";
import type { Json } from "@/types/database.types";

export { getCurrentBrand, type BrandSummary } from "@/lib/data/brand";

// ── jsonb contracts (Sprint 3 cache-population WRITE TARGET) ─────────────────
// These local types document the exact shapes the Researcher agent (Customer
// module, step 20 — DataForSEO traffic / content analysis / app reviews) must
// write into `customer_intel_cache`'s jsonb columns during the weekly scan. The
// page reads them back; the populator must satisfy them so the UI renders real
// data with no client-side reshaping. Unknown/absent values are nullable, never
// faked. Customer Intelligence is a PARTIAL module (mvp-constraints §2): only
// inferred fields ship; any field that needs social intelligence is deferred to
// Phase 2 and surfaced via the phase2 EmptyState, never with placeholder numbers.

/** One row of `customer_intel_cache.complaint_themes[]` — a recurring complaint
 *  theme mined from app reviews, with how often it appears and (optionally) the
 *  sentiment of that theme. `sentiment` is normalised to -1..1 (negative→0 maps
 *  to red/amber tinting); null when the populator can't score it. */
export type ComplaintTheme = {
  theme: string;
  count: number;
  sentiment: number | null;
};

/** `customer_intel_cache.demographics` — inferred age/gender bands. Either band
 *  array may be absent when DataForSEO returns no inference; an absent/empty
 *  object renders the Phase-2 sub-state, not zeros. */
export type DemographicBand = { label: string; pct: number };
export type Demographics = {
  ageBands: DemographicBand[];
  gender: DemographicBand[];
};

/** One row of `customer_intel_cache.geographic_distribution[]` — share of the
 *  competitor's audience in a region (0–100). */
export type GeoDistribution = {
  region: string;
  pct: number;
};

/** One row of `customer_intel_cache.traffic_sources[]` — share of the
 *  competitor's traffic from a channel (0–100). */
export type TrafficSource = {
  source: string;
  pct: number;
};

// ── view models ──────────────────────────────────────────────────────────────

/** Per-competitor customer-intelligence snapshot for the latest scan_week,
 *  name-resolved. `sentiment` is the raw app-review sentiment score as stored
 *  (scale not fixed in schema — the page formats defensively). */
export type CompetitorCustomerIntel = {
  competitorId: string;
  name: string;
  tier: string | null;
  appRating: number | null;
  appReviewCount: number | null;
  sentiment: number | null;
  complaintThemes: ComplaintTheme[];
  demographics: Demographics | null;
  geographic: GeoDistribution[];
  trafficSources: TrafficSource[];
};

export type CustomerIntelData = {
  scanWeek: string;
  competitors: CompetitorCustomerIntel[];
};

function asArray(json: Json | null): unknown[] {
  return Array.isArray(json) ? json : [];
}

function asObject(json: Json | null): Record<string, unknown> | null {
  return json && typeof json === "object" && !Array.isArray(json)
    ? (json as Record<string, unknown>)
    : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

/** Map a raw jsonb complaint-theme element to the contract. */
function toComplaintTheme(raw: unknown): ComplaintTheme | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const theme = str(r.theme);
  const count = num(r.count);
  if (!theme || count == null) return null;
  return { theme, count, sentiment: num(r.sentiment) };
}

/** Map a raw jsonb {label,pct} element to a demographic band. */
function toBand(raw: unknown): DemographicBand | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const label = str(r.label);
  const pct = num(r.pct);
  if (!label || pct == null) return null;
  return { label, pct };
}

/** Parse `demographics` jsonb into the contract, or null when nothing usable
 *  (so the page can show the Phase-2 sub-state rather than empty bars). */
function toDemographics(raw: Json | null): Demographics | null {
  const obj = asObject(raw);
  if (!obj) return null;
  const ageBands = (Array.isArray(obj.ageBands) ? obj.ageBands : [])
    .map(toBand)
    .filter((b): b is DemographicBand => b !== null);
  const gender = (Array.isArray(obj.gender) ? obj.gender : [])
    .map(toBand)
    .filter((b): b is DemographicBand => b !== null);
  if (ageBands.length === 0 && gender.length === 0) return null;
  return { ageBands, gender };
}

function toGeo(raw: unknown): GeoDistribution | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const region = str(r.region);
  const pct = num(r.pct);
  if (!region || pct == null) return null;
  return { region, pct };
}

function toTrafficSource(raw: unknown): TrafficSource | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const source = str(r.source);
  const pct = num(r.pct);
  if (!source || pct == null) return null;
  return { source, pct };
}

/**
 * Latest `customer_intel_cache` snapshot for the brand, mapped to view models.
 * `customer_intel_cache` is PER-COMPETITOR (brand_id + competitor_id +
 * scan_week): we fetch every row for the brand, pick the most recent scan_week,
 * filter to it, and resolve competitor_id → display name/tier via
 * brand_competitors. Returns null when no scan cache exists yet (pre-first-scan
 * empty state — no fabricated data).
 */
export async function getCustomerIntelData(
  brand: BrandSummary,
): Promise<CustomerIntelData | null> {
  if (isDemoMode()) {
    const { DEMO_CUSTOMERS } = await import("@/lib/data/demo/customers");
    return DEMO_CUSTOMERS;
  }

  const supabase = createClient();

  const { data: rows } = await supabase
    .from("customer_intel_cache")
    .select(
      "competitor_id, scan_week, app_rating, app_review_count, sentiment_score, complaint_themes, demographics, geographic_distribution, traffic_sources",
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

  const competitors: CompetitorCustomerIntel[] = latest
    // Only surface rows we can resolve to a tracked competitor name.
    .filter((r) => nameMap.has(r.competitor_id))
    .map((r) => {
      const complaintThemes = asArray(r.complaint_themes)
        .map(toComplaintTheme)
        .filter((t): t is ComplaintTheme => t !== null)
        // Most-frequent complaints first.
        .sort((a, b) => b.count - a.count);

      const geographic = asArray(r.geographic_distribution)
        .map(toGeo)
        .filter((g): g is GeoDistribution => g !== null)
        .sort((a, b) => b.pct - a.pct);

      const trafficSources = asArray(r.traffic_sources)
        .map(toTrafficSource)
        .filter((t): t is TrafficSource => t !== null)
        .sort((a, b) => b.pct - a.pct);

      return {
        competitorId: r.competitor_id,
        name: nameMap.get(r.competitor_id) ?? r.competitor_id,
        tier: tierMap.get(r.competitor_id) ?? null,
        appRating: num(r.app_rating),
        appReviewCount: num(r.app_review_count),
        sentiment: num(r.sentiment_score),
        complaintThemes,
        demographics: toDemographics(r.demographics),
        geographic,
        trafficSources,
      } satisfies CompetitorCustomerIntel;
    })
    // Stable, useful order: best-reviewed competitors first.
    .sort((a, b) => (b.appRating ?? 0) - (a.appRating ?? 0));

  return { scanWeek, competitors };
}
