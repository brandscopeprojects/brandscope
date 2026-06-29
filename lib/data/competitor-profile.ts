import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBrand, type BrandSummary } from "@/lib/data/brand";
import { getBrandCompetitors } from "@/lib/data/competitors";
import { isDemoMode } from "@/lib/data/demo-mode";
import type { ThreatGaugeData, ThreatLevel } from "@/types/view-models";

export { getCurrentBrand, type BrandSummary } from "@/lib/data/brand";

// Screen 5 — Competitor Profile (`/competitors/[competitor_id]`). The deep,
// tabbed profile of a single competitor the brand tracks. Reads three tables:
//   - competitor_profiles (keyed by competitor_id, NO brand_id) — latest scan.
//   - competitor_changes  (keyed by competitor_id, NO brand_id) — recent moves.
//   - product_intel_cache (brand_id + competitor_id) — product/app-store data,
//     which does NOT ship as a standalone /products page at MVP; it renders here.
//
// Access control: a competitor row carries no brand scope, so we FIRST confirm
// `competitorId` is one of the current brand's tracked competitors (via
// getBrandCompetitors). If not, we return null and the page 404s — this is what
// prevents one brand from reading another brand's tracked competitor profile.

/**
 * `competitor_changes.detail` jsonb shape (shared contract with the change
 * detector and the Market Intel feed). All fields optional — a brand-new signal
 * may carry no before/after pair.
 *
 * Sprint-3 WRITE TARGET: written by the between-cycle change detector.
 */
export type CompetitorChangeDetail = {
  before?: string;
  after?: string;
  metric?: string;
};

/**
 * `product_intel_cache.aviator_bonus_structure` jsonb shape. The Aviator/crash
 * promo's bonus terms when an Aviator promo is active. All fields optional.
 *
 * Sprint-3 WRITE TARGET: written by the Product Intelligence researcher when it
 * detects an active Aviator/crash-game promotion. Keep in sync with that writer.
 */
export type AviatorBonusStructure = {
  /** Plain-language bonus headline, e.g. "100% up to ₦50,000". */
  headline?: string;
  /** Bonus amount in kobo (minor units), when a numeric figure is detected. */
  amountKobo?: number;
  /** Wagering / rollover multiplier, e.g. 3 for 3x. */
  wageringRequirement?: number;
  /** Promo type label, e.g. "deposit_match", "free_bet", "cashback". */
  promoType?: string;
};

/** One recent competitor move (mapped for the Intelligence-tab timeline). */
export type CompetitorChange = {
  id: string;
  changeType: string;
  summary: string;
  impactLevel: string | null;
  detectedAt: string; // ISO timestamp, rendered in JetBrains Mono
  sourceUrl: string | null;
  detail: CompetitorChangeDetail | null;
};

/** A single product vertical's status (Promotions tab). */
export type VerticalStatus = {
  label: string;
  /** Raw status string from the cache, e.g. "active" / "growing" / "absent". */
  status: string | null;
};

/** Digital-footprint metrics (Digital tab), straight off competitor_profiles. */
export type DigitalProfile = {
  domainAuthority: number | null;
  estimatedMonthlyTraffic: number | null;
  organicTrafficPct: number | null;
  paidTrafficPct: number | null;
  socialFollowersTotal: number | null;
  activeAdsCount: number | null;
  techStackCount: number | null;
};

/** Overview-tab headline scores, straight off competitor_profiles. */
export type OverviewScores = {
  reachScore: number | null;
  aggressionScore: number | null;
  sovPct: number | null;
  threatScore: number | null;
};

/** Product-intelligence section (Promotions tab); null when no cache row. */
export type ProductIntel = {
  verticals: VerticalStatus[];
  aviatorPromoActive: boolean | null;
  aviatorBonus: AviatorBonusStructure | null;
  oddsCompetitivenessScore: number | null;
  newProductsDetected: string[];
};

export type CompetitorProfileData = {
  competitor: {
    id: string;
    name: string;
    domain: string;
    tier: string | null;
  };
  scanWeek: string | null;
  /** null until the first weekly scan profiles this competitor. */
  threat: ThreatGaugeData | null;
  overview: OverviewScores | null;
  digital: DigitalProfile | null;
  /** null when no product_intel_cache row exists for (brand, competitor). */
  product: ProductIntel | null;
  /** Recent moves (empty when none detected yet). */
  changes: CompetitorChange[];
};

/** Map a 0–100 threat score to a ThreatLevel (scoring-formulas §3). */
function threatLevel(score: number): ThreatLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/**
 * Derive up to three one-line threat reasons from REAL profile fields only.
 * Never fabricated: each reason is gated on its backing field being present and
 * meaningfully high. May return [] — ThreatGauge renders fine with no reasons.
 */
function threatReasons(p: {
  estimated_monthly_traffic: number | null;
  aggression_score: number | null;
  sov_pct: number | null;
  active_ads_count: number | null;
}): string[] {
  const reasons: string[] = [];
  if (p.estimated_monthly_traffic != null && p.estimated_monthly_traffic >= 100_000) {
    reasons.push("High estimated monthly traffic");
  }
  if (p.aggression_score != null && p.aggression_score >= 60) {
    reasons.push("Aggressive competitive posture");
  }
  if (p.sov_pct != null && p.sov_pct >= 25) {
    reasons.push("Commands a large share of voice");
  }
  if (p.active_ads_count != null && p.active_ads_count >= 20) {
    reasons.push("Running a heavy active-ad campaign");
  }
  return reasons.slice(0, 3);
}

function normaliseChangeDetail(value: unknown): CompetitorChangeDetail | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const detail: CompetitorChangeDetail = {};
  if (typeof v.before === "string") detail.before = v.before;
  if (typeof v.after === "string") detail.after = v.after;
  if (typeof v.metric === "string") detail.metric = v.metric;
  return Object.keys(detail).length > 0 ? detail : null;
}

function normaliseAviatorBonus(value: unknown): AviatorBonusStructure | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const bonus: AviatorBonusStructure = {};
  if (typeof v.headline === "string") bonus.headline = v.headline;
  if (typeof v.amountKobo === "number") bonus.amountKobo = v.amountKobo;
  if (typeof v.wageringRequirement === "number") {
    bonus.wageringRequirement = v.wageringRequirement;
  }
  if (typeof v.promoType === "string") bonus.promoType = v.promoType;
  return Object.keys(bonus).length > 0 ? bonus : null;
}

/**
 * Resolve the full Competitor Profile for one competitor the brand tracks.
 * Returns null when the competitor is not tracked by the current brand (→ 404)
 * or when there is no current brand. Individual sections may be null when their
 * cache is absent (e.g. no profile row yet, or no product_intel row).
 */
export async function getCompetitorProfile(
  competitorId: string,
): Promise<CompetitorProfileData | null> {
  // Demo mode: return the SportyBet sample (competitorId ignored).
  if (isDemoMode()) {
    const { DEMO_COMPETITOR_PROFILE } = await import(
      "@/lib/data/demo/competitor-profile"
    );
    return DEMO_COMPETITOR_PROFILE;
  }

  const brand = await getCurrentBrand();
  if (!brand) return null;

  // Access gate: the competitor must be one of THIS brand's tracked competitors.
  const competitors = await getBrandCompetitors(brand.id);
  const competitor = competitors.find((c) => c.id === competitorId);
  if (!competitor) return null;

  const supabase = createClient();

  // Latest competitor_profiles row (keyed by competitor_id, no brand_id).
  const { data: profile } = await supabase
    .from("competitor_profiles")
    .select(
      "scan_week, reach_score, aggression_score, threat_score, sov_pct, domain_authority, estimated_monthly_traffic, organic_traffic_pct, paid_traffic_pct, social_followers_total, active_ads_count, tech_stack_count",
    )
    .eq("competitor_id", competitorId)
    .order("scan_week", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Latest product_intel_cache row (brand_id + competitor_id).
  const { data: productRow } = await supabase
    .from("product_intel_cache")
    .select(
      "sports_betting_status, casino_status, crash_games_status, lottery_status, aviator_promo_active, aviator_bonus_structure, odds_competitiveness_score, new_products_detected",
    )
    .eq("brand_id", brand.id)
    .eq("competitor_id", competitorId)
    .order("scan_week", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Recent competitor moves (keyed by competitor_id, no brand_id).
  const { data: changeRows } = await supabase
    .from("competitor_changes")
    .select("id, change_type, summary, impact_level, detected_at, source_url, detail")
    .eq("competitor_id", competitorId)
    .order("detected_at", { ascending: false })
    .limit(20);

  const changes: CompetitorChange[] = (changeRows ?? []).map((r) => ({
    id: r.id,
    changeType: r.change_type,
    summary: r.summary,
    impactLevel: r.impact_level,
    detectedAt: r.detected_at,
    sourceUrl: r.source_url,
    detail: normaliseChangeDetail(r.detail),
  }));

  // No profile row → every score section is null; page shows an empty state.
  let threat: ThreatGaugeData | null = null;
  let overview: OverviewScores | null = null;
  let digital: DigitalProfile | null = null;

  if (profile) {
    if (profile.threat_score != null) {
      const score = profile.threat_score;
      threat = {
        score,
        level: threatLevel(score),
        reasons: threatReasons(profile),
      };
    }
    overview = {
      reachScore: profile.reach_score,
      aggressionScore: profile.aggression_score,
      sovPct: profile.sov_pct,
      threatScore: profile.threat_score,
    };
    digital = {
      domainAuthority: profile.domain_authority,
      estimatedMonthlyTraffic: profile.estimated_monthly_traffic,
      organicTrafficPct: profile.organic_traffic_pct,
      paidTrafficPct: profile.paid_traffic_pct,
      socialFollowersTotal: profile.social_followers_total,
      activeAdsCount: profile.active_ads_count,
      techStackCount: profile.tech_stack_count,
    };
  }

  const product: ProductIntel | null = productRow
    ? {
        verticals: [
          { label: "Sports Betting", status: productRow.sports_betting_status },
          { label: "Casino", status: productRow.casino_status },
          { label: "Crash Games", status: productRow.crash_games_status },
          { label: "Lottery", status: productRow.lottery_status },
        ],
        aviatorPromoActive: productRow.aviator_promo_active,
        aviatorBonus: normaliseAviatorBonus(productRow.aviator_bonus_structure),
        oddsCompetitivenessScore: productRow.odds_competitiveness_score,
        newProductsDetected: productRow.new_products_detected ?? [],
      }
    : null;

  return {
    competitor: {
      id: competitor.id,
      name: competitor.name,
      domain: competitor.domain,
      tier: competitor.tier,
    },
    scanWeek: profile?.scan_week ?? null,
    threat,
    overview,
    digital,
    product,
    changes,
  };
}
