// Shared UI view-model contracts for components. Decoupled from the raw DB row
// shapes so components stay stable. Build components to THESE types.

export type Urgency = "urgent" | "watch" | "opportunity" | "info";
export type ConfidenceLevel = "high" | "medium" | "low";
export type RecommendationStatus =
  | "open"
  | "accepted"
  | "snoozed"
  | "dismissed"
  | "completed";

/** One verbatim evidence record (ui-constraints §9, evidence chain). */
export type EvidenceItem = {
  sourceUrl: string;
  scrapedAt: string; // ISO timestamp, rendered in JetBrains Mono
  extractedText: string; // verbatim quote block
  changeBefore?: string | null;
  changeAfter?: string | null;
  evidenceHash?: string | null;
};

/** Action-feed card view model (ui-constraints §7 card anatomy). */
export type Recommendation = {
  id: string;
  urgency: Urgency;
  category: string; // e.g. 'promotions', 'traffic_seo', 'geo_aeo'
  headline: string; // specific, time-bound
  triggerReason: string; // "why now", muted
  confidenceScore: number; // 0..1
  confidenceLevel: ConfidenceLevel;
  evidence: EvidenceItem[];
  assumptionFlags: string[]; // amber callout when present (LOW/MED)
  isDirectEvidence: boolean;
  status: RecommendationStatus;
  rank: number;
};

// ---- Positioning visuals (Dashboard Screen 3) ----

/** Market Position Map point. x = reach, y = aggression (both 0..100). */
export type ScatterPoint = {
  id: string;
  label: string;
  reach: number;
  aggression: number;
  isOwnBrand: boolean; // own brand = larger pulsing cobalt dot
  traffic?: number | null; // tooltip
  sovPct?: number | null; // tooltip
  threatScore?: number | null; // tooltip
};

/**
 * Competitive Radar. Each axis 0..100. A null axis = data not available at MVP
 * (e.g. Social/Engagement need Apify) → render the axis muted/"Phase 2", never as 0.
 */
export type RadarData = {
  axes: string[]; // e.g. ['Promotions','Traffic','SEO','Social','Trust','Engagement']
  brand: (number | null)[];
  marketAvg: (number | null)[];
};

/** Share of Voice donut slice. Own slice is always cobalt. */
export type SovSlice = { label: string; value: number; isOwnBrand: boolean };

export type ThreatLevel = "low" | "medium" | "high" | "critical";
export type ThreatGaugeData = {
  score: number; // 0..100
  level: ThreatLevel;
  reasons: string[]; // 2-3 one-liners shown beneath the gauge
};

// ---- Filtering ----

export type FilterStatus = "all" | "urgent" | "watch" | "opportunity" | "completed";
export type FilterChip = { label: string; count: number; status: FilterStatus };
