// Cache loaders + signal assembly for cache-population. Reads the module cache
// tables for one (brand_id, scan_week), strictly brand-scoped, and folds them into
// per-entity EntitySignals consumed by scoring.ts.
//
// Brand-self convention: module caches (seo_cache, promotions_cache, customer_intel_
// cache, tech_stack_cache …) are keyed by competitor_id. The brand's OWN row is the
// one whose competitor_id points at a `competitors` record sharing the brand's
// domain (the self-competitor). geo_cache is the exception — the brand's own AI
// visibility is stored directly brand-keyed; competitors live in
// geo_cache.competitor_ai_scores jsonb.

import type { SupabaseClient } from "../_shared/supabase.ts";
import type { EntitySignals, AiCheck } from "./scoring.ts";

export type CompetitorRow = { id: string; name: string; domain: string };

// ---- small json helpers (defensive: shapes from raw_data aren't strictly specced) ----
function asNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
function pick(obj: unknown, ...keys: string[]): unknown {
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  for (const k of keys) if (rec[k] != null) return rec[k];
  return null;
}

// ---- loaded module rows for the brand+week ----
export type ModuleData = {
  seoByCompetitor: Map<string, Record<string, unknown>>;
  promoByCompetitor: Map<string, Record<string, unknown>[]>; // promotions_cache rows per competitor
  techByCompetitor: Map<string, Record<string, unknown>>;
  customerByCompetitor: Map<string, Record<string, unknown>>;
  geo: Record<string, unknown> | null; // brand's geo_cache row
};

/**
 * Load module caches for (brandId, scanWeek). Each query is scoped to brandId
 * except tech_stack_cache (keyed by competitor_id only) which is scoped to the
 * tracked competitor ids — never batch across brands.
 */
export async function loadModuleData(
  sb: SupabaseClient,
  brandId: string,
  scanWeek: string,
  competitorIds: string[],
): Promise<ModuleData> {
  const [seo, promo, tech, customer, geo] = await Promise.all([
    sb.from("seo_cache").select("*").eq("brand_id", brandId).eq("scan_week", scanWeek),
    sb.from("promotions_cache").select("*").eq("brand_id", brandId).eq("scan_week", scanWeek),
    competitorIds.length
      ? sb.from("tech_stack_cache").select("*").eq("scan_week", scanWeek).in("competitor_id", competitorIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    sb.from("customer_intel_cache").select("*").eq("brand_id", brandId).eq("scan_week", scanWeek),
    sb.from("geo_cache").select("*").eq("brand_id", brandId).eq("scan_week", scanWeek).maybeSingle(),
  ]);

  const seoByCompetitor = new Map<string, Record<string, unknown>>();
  for (const r of (seo.data ?? []) as Record<string, unknown>[]) {
    seoByCompetitor.set(String(r.competitor_id), r);
  }
  const promoByCompetitor = new Map<string, Record<string, unknown>[]>();
  for (const r of (promo.data ?? []) as Record<string, unknown>[]) {
    const k = String(r.competitor_id);
    const arr = promoByCompetitor.get(k);
    if (arr) arr.push(r);
    else promoByCompetitor.set(k, [r]);
  }
  const techByCompetitor = new Map<string, Record<string, unknown>>();
  for (const r of (tech.data ?? []) as Record<string, unknown>[]) {
    techByCompetitor.set(String(r.competitor_id), r);
  }
  const customerByCompetitor = new Map<string, Record<string, unknown>>();
  for (const r of (customer.data ?? []) as Record<string, unknown>[]) {
    customerByCompetitor.set(String(r.competitor_id), r);
  }

  return {
    seoByCompetitor,
    promoByCompetitor,
    techByCompetitor,
    customerByCompetitor,
    geo: (geo.data as Record<string, unknown> | null) ?? null,
  };
}

/** Derive raw signals for one entity (brand-self or a competitor) keyed by competitorId. */
export function signalsForCompetitor(
  md: ModuleData,
  competitorId: string,
  aiVisibility: number | null,
): EntitySignals {
  const seo = md.seoByCompetitor.get(competitorId) ?? null;
  const tech = md.techByCompetitor.get(competitorId) ?? null;
  const customer = md.customerByCompetitor.get(competitorId) ?? null;
  const promos = md.promoByCompetitor.get(competitorId) ?? [];

  const estTraffic = asNum(seo?.estimated_traffic);
  const organic = asNum(seo?.organic_traffic);
  const paid = asNum(seo?.paid_traffic);
  // paid split % — prefer explicit raw_data field, else derive from organic/paid columns.
  let paidTrafficPct: number | null = asNum(pick(seo?.raw_data, "paid_traffic_pct"));
  if (paidTrafficPct == null && paid != null && organic != null && paid + organic > 0) {
    paidTrafficPct = (100 * paid) / (paid + organic);
  }

  const organicKeywordCount = asNum(pick(seo?.raw_data, "organic_keyword_count", "keyword_count"));
  const bonusKeywordMovement = asNum(pick(seo?.raw_data, "bonus_keyword_movement"));

  const adNetworks = tech?.ad_networks;
  const adNetworkCount = Array.isArray(adNetworks) ? adNetworks.length : null;

  // promo_signal_count: number of distinct promo signals seen this week for the entity.
  const promoSignalCount = promos.length > 0 ? promos.length : null;

  return {
    estMonthlyTraffic: estTraffic,
    organicKeywordCount,
    paidTrafficPct,
    adNetworkCount,
    promoSignalCount,
    bonusKeywordMovement,
    domainAuthority: asNum(seo?.domain_authority),
    avgAppRating: asNum(customer?.app_rating),
    aiVisibility,
  };
}

// ---- AI visibility check extraction (geo_cache → §5 inputs) ----
const GEO_PLATFORMS = ["chatgpt", "claude", "gemini", "perplexity"] as const; // MVP 4 (no Grok/Meta)

/** Build per-platform AiChecks for the BRAND from its geo_cache row. */
export function brandAiChecks(geo: Record<string, unknown> | null): { checks: AiCheck[]; total: number } {
  if (!geo) return { checks: [], total: 0 };
  const checks: AiCheck[] = [];
  for (const p of GEO_PLATFORMS) {
    const mentioned = Boolean(geo[`${p}_mentioned`]);
    const sentiment = (geo[`${p}_sentiment`] as AiCheck["sentiment"]) ?? null;
    const position = asNum(geo[`${p}_position`]);
    checks.push({ mentioned, sentiment, position });
  }
  return { checks, total: GEO_PLATFORMS.length };
}

/**
 * Pre-computed AI visibility per competitor from geo_cache.competitor_ai_scores jsonb.
 * Shape (per researcher contract): { [competitorId]: { ai_visibility_score: number } }.
 * Returns null per competitor when absent (never fabricate).
 */
export function competitorAiScores(geo: Record<string, unknown> | null): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  const raw = geo?.competitor_ai_scores;
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      out[k] = asNum(pick(v, "ai_visibility_score", "score"));
    }
  }
  return out;
}
