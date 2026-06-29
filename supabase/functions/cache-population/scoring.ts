// Scoring formulas — EXACT implementation of docs/skills/scoring-formulas.md.
// Coefficients/constants live ONLY here (mirroring the skill file); never inline a
// coefficient elsewhere. cache-population is the sole caller (orchestration §step 6).
//
// All scores 0–100 unless noted. Inputs that are unavailable arrive as `null` and
// must propagate as `null` (never silently coerced to 0) — except radar axes, where
// the rules say Social/Engagement render greyed/"Phase 2" → stored as null, and the
// other axes use 0-floored norms by formula.

// ---- Reference constants (scoring-formulas.md §1,§2) ----
export const REACH_TRAFFIC_REF = 5_000_000; // §1
export const REACH_KEYWORD_REF = 50_000; // §1
export const AGG_ADNET_REF = 5; // §2
export const AGG_PROMO_REF = 10; // §2
export const AGG_BONUSKW_REF = 100; // §2

// ---- Primitives ----
export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
/** pos(x)=clamp(x,0,100) — floors a brand-relative gap at 0 (only-ahead-adds-threat). */
export function pos(x: number): number {
  return clamp(x, 0, 100);
}
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

// ---- Per-entity raw signal inputs (brand or one competitor) ----
export type EntitySignals = {
  // §1 reach
  estMonthlyTraffic: number | null; // DataForSEO bulk_traffic_estimation
  organicKeywordCount: number | null; // keywords_for_site count
  // §2 aggression
  paidTrafficPct: number | null; // organic/paid split (0–100)
  adNetworkCount: number | null; // DetectZeStack ad_networks.length
  promoSignalCount: number | null; // promotions_cache signal count
  bonusKeywordMovement: number | null; // Keywords Data bonus-kw movement
  // §7 radar trust
  domainAuthority: number | null; // 0–100
  avgAppRating: number | null; // 0–5
  // §5 ai
  aiVisibility: number | null; // computed elsewhere, fed in for threat §3
};

// ---- §1 reach_score = 0.50*traffic_norm + 0.30*keyword_norm + 0.20*sov_pct ----
export function trafficNorm(estMonthlyTraffic: number | null): number | null {
  if (estMonthlyTraffic == null) return null;
  return round2(
    clamp(
      (100 * Math.log10(estMonthlyTraffic + 1)) / Math.log10(REACH_TRAFFIC_REF),
      0,
      100,
    ),
  );
}
export function keywordNorm(organicKeywordCount: number | null): number | null {
  if (organicKeywordCount == null) return null;
  return round2(clamp((100 * organicKeywordCount) / REACH_KEYWORD_REF, 0, 100));
}
/** reach_score. sovPct (§4) is computed across the set, passed in here. */
export function reachScore(
  s: EntitySignals,
  sovPct: number | null,
): number | null {
  const t = trafficNorm(s.estMonthlyTraffic);
  const k = keywordNorm(s.organicKeywordCount);
  // Need at least one reach signal; SOV alone (always present) is not enough to claim reach.
  if (t == null && k == null) return null;
  return round2(0.5 * (t ?? 0) + 0.3 * (k ?? 0) + 0.2 * (sovPct ?? 0));
}

// ---- §2 aggression_score (MVP-available signals only) ----
export function adtechNorm(adNetworkCount: number | null): number | null {
  if (adNetworkCount == null) return null;
  return round2(clamp((100 * adNetworkCount) / AGG_ADNET_REF, 0, 100));
}
export function promoActivityNorm(promoSignalCount: number | null): number | null {
  if (promoSignalCount == null) return null;
  return round2(clamp((100 * promoSignalCount) / AGG_PROMO_REF, 0, 100));
}
export function bonusKwNorm(bonusKeywordMovement: number | null): number | null {
  if (bonusKeywordMovement == null) return null;
  return round2(clamp((100 * bonusKeywordMovement) / AGG_BONUSKW_REF, 0, 100));
}
export function paidTrafficNorm(paidTrafficPct: number | null): number | null {
  if (paidTrafficPct == null) return null;
  return round2(clamp(paidTrafficPct, 0, 100));
}
export function aggressionScore(s: EntitySignals): number | null {
  const paid = paidTrafficNorm(s.paidTrafficPct);
  const adtech = adtechNorm(s.adNetworkCount);
  const promo = promoActivityNorm(s.promoSignalCount);
  const bonus = bonusKwNorm(s.bonusKeywordMovement);
  if (paid == null && adtech == null && promo == null && bonus == null) return null;
  return round2(0.35 * (paid ?? 0) + 0.25 * (adtech ?? 0) + 0.25 * (promo ?? 0) + 0.15 * (bonus ?? 0));
}

// ---- §4 SOV — entity_est_traffic / SUM(est_traffic over brand+all tracked) ----
/** Returns map keyed by entity id → sov_pct (0–100). Entities with null traffic get 0. */
export function shareOfVoice(
  entities: { id: string; estMonthlyTraffic: number | null }[],
): Record<string, number> {
  const total = entities.reduce((acc, e) => acc + (e.estMonthlyTraffic ?? 0), 0);
  const out: Record<string, number> = {};
  for (const e of entities) {
    out[e.id] = total > 0 ? round2((100 * (e.estMonthlyTraffic ?? 0)) / total) : 0;
  }
  return out;
}

// ---- §5 AI Visibility (50/30/20) ----
export type AiCheck = {
  mentioned: boolean;
  sentiment: "positive" | "neutral" | "negative" | null;
  position: number | null; // 1..10
};
const SENTIMENT_VALUE: Record<string, number> = { positive: 1.0, neutral: 0.5, negative: 0.0 };
/**
 * ai_visibility_score over the 4 MVP platform×query checks (ChatGPT/Claude/Gemini/Perplexity).
 * `totalChecks` is the denominator (query×platform). Returns null if no checks ran.
 */
export function aiVisibilityScore(checks: AiCheck[], totalChecks: number): number | null {
  if (totalChecks <= 0) return null;
  const mentions = checks.filter((c) => c.mentioned);
  const mentionsRatio = mentions.length / totalChecks; // 0..1
  const avgSentiment =
    mentions.length > 0
      ? mentions.reduce((a, c) => a + (SENTIMENT_VALUE[c.sentiment ?? "neutral"] ?? 0.5), 0) /
        mentions.length
      : 0;
  const positioned = mentions.filter((c) => c.position != null);
  const avgPosition =
    positioned.length > 0
      ? positioned.reduce((a, c) => a + (11 - (c.position as number)) / 10, 0) / positioned.length
      : 0;
  return round2(mentionsRatio * 50 + avgSentiment * 30 + avgPosition * 20);
}

// ---- §3 threat_score (brand-relative, aggregated over tracked competitors) ----
export type ThreatInputs = {
  aggression: number | null;
  promoActivityNorm: number | null;
  reach: number | null;
  aiVisibility: number | null;
};
export type ThreatLevel = "low" | "medium" | "high" | "critical";
export type ThreatResult = {
  score: number | null;
  level: ThreatLevel | null;
  reasons: string[];
};

function perThreat(c: ThreatInputs, brand: ThreatInputs): { value: number; terms: { label: string; v: number }[] } {
  const aggGap = pos((c.aggression ?? 0) - (brand.aggression ?? 0));
  const promoGap = pos((c.promoActivityNorm ?? 0) - (brand.promoActivityNorm ?? 0));
  const reachGap = pos((c.reach ?? 0) - (brand.reach ?? 0));
  const aiGap = pos((c.aiVisibility ?? 0) - (brand.aiVisibility ?? 0));
  const value = 0.4 * aggGap + 0.3 * promoGap + 0.2 * reachGap + 0.1 * aiGap;
  return {
    value,
    terms: [
      { label: "marketing aggression", v: 0.4 * aggGap },
      { label: "promotional activity", v: 0.3 * promoGap },
      { label: "market reach", v: 0.2 * reachGap },
      { label: "AI visibility", v: 0.1 * aiGap },
    ],
  };
}

export function levelOf(score: number): ThreatLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/**
 * threat_score = 0.60*max + 0.40*mean of per_threat(c). Only competitors AHEAD add threat.
 * threat_reasons = top 2–3 contributing terms (from the strongest competitor) as one-liners.
 */
export function threatScore(
  brand: ThreatInputs,
  competitors: { name: string; t: ThreatInputs }[],
): ThreatResult {
  if (competitors.length === 0) return { score: null, level: null, reasons: [] };
  const scored = competitors.map((c) => ({ name: c.name, ...perThreat(c.t, brand) }));
  const values = scored.map((s) => s.value);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const score = round2(0.6 * max + 0.4 * mean);
  const level = levelOf(score);

  // Reasons: take the strongest competitor, surface its top 2–3 positive-contributing terms.
  const strongest = scored.reduce((a, b) => (b.value > a.value ? b : a));
  const reasons = strongest.terms
    .filter((t) => t.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, 3)
    .map((t) => `${strongest.name} leads on ${t.label}`);
  return { score, level, reasons };
}

// ---- §7 Radar (6 axes, brand vs market average) ----
export const RADAR_AXES = ["Promotions", "Traffic", "SEO", "Social", "Trust", "Engagement"] as const;

export function trustNorm(domainAuthority: number | null, avgAppRating: number | null): number | null {
  if (domainAuthority == null && avgAppRating == null) return null;
  // clamp(100 * (DA/100 + rating/5)/2, 0, 100). Missing half contributes 0.
  const daPart = (domainAuthority ?? 0) / 100;
  const ratingPart = (avgAppRating ?? 0) / 5;
  return round2(clamp((100 * (daPart + ratingPart)) / 2, 0, 100));
}

/**
 * Build a 6-axis vector for one entity. Social & Engagement are Apify-dependent and
 * NOT available at MVP → always null (rendered greyed/"Phase 2", never 0).
 */
export function radarAxes(s: EntitySignals): (number | null)[] {
  return [
    promoActivityNorm(s.promoSignalCount), // Promotions
    trafficNorm(s.estMonthlyTraffic), // Traffic
    keywordNorm(s.organicKeywordCount), // SEO
    null, // Social — Phase 2 (Apify)
    trustNorm(s.domainAuthority, s.avgAppRating), // Trust
    null, // Engagement — Phase 2 (Apify)
  ];
}

/** Mean per axis across competitors, ignoring nulls; axis with no data → null. */
export function marketAverage(vectors: (number | null)[][]): (number | null)[] {
  const n = RADAR_AXES.length;
  const out: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    const vals = vectors.map((v) => v[i]).filter((x): x is number => x != null);
    out.push(vals.length > 0 ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : null);
  }
  return out;
}
