// jsonb element shapes researcher-customer WRITES into customer_intel_cache.
// These MUST match lib/data/customers.ts exactly (the frontend reads them back
// with no reshaping). Every numeric field is nullable; demographics/geographic
// are Phase 2 and stay NULL unless a real DataForSEO signal exists — never faked.

/** customer_intel_cache.traffic_sources[] element — channel share 0–100. */
export type TrafficSource = {
  source: string;
  pct: number;
};

/** customer_intel_cache.complaint_themes[] element. sentiment normalised -1..1 or null. */
export type ComplaintTheme = {
  theme: string;
  count: number;
  sentiment: number | null;
};

/** customer_intel_cache.demographics.{ageBands,gender}[] band. */
export type DemographicBand = { label: string; pct: number };
export type Demographics = {
  ageBands: DemographicBand[];
  gender: DemographicBand[];
};

/** customer_intel_cache.geographic_distribution[] element — region share 0–100. */
export type GeoDistribution = {
  region: string;
  pct: number;
};

/** What Haiku returns after structuring the DataForSEO signals for one competitor. */
export type CustomerInference = {
  traffic_sources: TrafficSource[];
  complaint_themes: ComplaintTheme[];
  /** Overall sentiment, normalised -1..1, or null when no signal. */
  sentiment_score: number | null;
  /** 12-week sentiment trend label: 'improving' | 'declining' | 'stable' | null. */
  sentiment_trend: string | null;
  /** 0..1 self-assessed confidence in the structuring → agent_job_logs.data_quality_score. */
  data_quality_score: number | null;
};
