import type { RadarData } from "./view-models";

// Contracts for the weekly_cache jsonb columns. cache-population (Sprint 3) WRITES
// these; the dashboard READS them. Keep both sides in sync with this file.

/** One element of weekly_cache.competitor_states. */
export type CompetitorState = {
  id: string;
  name: string;
  reachScore: number; // 0..100
  aggressionScore: number; // 0..100
  sovPct: number; // 0..100
  threatScore: number | null;
  estimatedMonthlyTraffic: number | null;
  /** Basis of reachScore: Labs traffic vs brand-search-demand proxy (§1 amendment). */
  reachBasis?: "traffic" | "brand_demand" | null;
};

export type CompetitorStatesCache = CompetitorState[]; // weekly_cache.competitor_states
export type RadarCache = RadarData; // weekly_cache.radar_data
