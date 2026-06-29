// Shared contracts for the scan pipeline: module task types, queue message
// shapes, model ids, and the jsonb cache shapes the Researchers WRITE and the
// frontend READS. These jsonb shapes mirror the frontend's documented contracts
// (lib/data/*.ts, types/cache-contracts.ts) — keep both sides in sync.

// ---- Models (MVP stack only) ----
// Exact API model ids — confirm against the Anthropic/OpenAI model list at deploy.
export const MODELS = {
  sonnet: "claude-sonnet-4-6", // Supervisor / Drafter / Auditor / Regulatory RAG
  haiku: "claude-haiku-4-5", // Researcher structuring / classification / Analytics
  gpt: "gpt-4.1-mini", // Brand chat
  embed: "text-embedding-3-small", // 1536-dim, regulatory ingestion
  moderation: "omni-moderation-latest", // asset moderation
} as const;

// ---- Module task types (one Researcher per module) ----
export type ModuleTask =
  | "traffic_seo"
  | "geo_aeo"
  | "tech_stack"
  | "app_store"
  | "customer"
  | "regulatory"
  | "promotions"
  | "hiring";

/** Enabled-by-default scan modules at MVP. Social is a placeholder (no scan). */
export const MVP_MODULES: ModuleTask[] = [
  "traffic_seo",
  "geo_aeo",
  "tech_stack",
  "app_store",
  "customer",
  "regulatory",
  "promotions",
  "hiring",
];

/** Maps a module task to the Edge Function that consumes it. */
export const MODULE_FUNCTION: Record<ModuleTask, string> = {
  traffic_seo: "researcher-traffic-seo",
  geo_aeo: "researcher-geo-aeo",
  tech_stack: "researcher-tech-stack",
  app_store: "researcher-app-store",
  customer: "researcher-customer",
  regulatory: "researcher-regulatory",
  promotions: "researcher-promotions",
  hiring: "researcher-hiring",
};

/** brand_preferences column gating each module (null = always on). */
export const MODULE_PREF_COLUMN: Record<ModuleTask, string | null> = {
  traffic_seo: "traffic_seo_enabled",
  geo_aeo: "geo_aeo_enabled",
  tech_stack: "social_ads_enabled", // ad-network section lives under Social & Ads
  app_store: "product_intel_enabled",
  customer: "customer_intel_enabled",
  regulatory: "regulatory_enabled",
  promotions: "promotions_enabled",
  hiring: "hiring_signals_enabled",
};

// ---- Queue messages (pgmq) ----
export type CompetitorRef = { id: string; name: string; domain: string; tier: string | null };

/** scan_modules queue message — one per module per job. */
export type ScanModuleMessage = {
  scan_job_id: string;
  brand_id: string;
  brand_domain: string;
  brand_name: string;
  scan_week: string; // YYYY-MM-DD (Monday)
  markets: string[];
  task_type: ModuleTask;
  competitors: CompetitorRef[];
};

/** scan_synthesis queue message — enqueued when all modules for a job finish. */
export type ScanSynthesisMessage = {
  scan_job_id: string;
  brand_id: string;
  scan_week: string;
};

export const QUEUES = {
  modules: "scan_modules",
  synthesis: "scan_synthesis",
} as const;

// ---- jsonb cache shapes (Researcher WRITE targets; mirror frontend reads) ----

/** weekly_cache.competitor_states (types/cache-contracts.ts CompetitorState). */
export type CompetitorState = {
  id: string;
  name: string;
  reachScore: number;
  aggressionScore: number;
  sovPct: number;
  threatScore: number | null;
  estimatedMonthlyTraffic: number | null;
};

/** weekly_cache.radar_data (types/view-models.ts RadarData). */
export type RadarData = {
  axes: string[];
  brand: (number | null)[];
  marketAvg: (number | null)[];
};

/** recommendations.evidence element (types/view-models EvidenceItem source shape). */
export type RecommendationEvidence = {
  source_url: string;
  timestamp: string;
  extracted_text: string;
  change_before?: string | null;
  change_after?: string | null;
  evidence_hash?: string | null;
};
