-- 16_market_intel_cache.sql — shared market-level intelligence cache
-- (schema-amendments.md D.8; owner decision 2026-07-17: market facts are fetched
-- once per market per scan_week and shared across brands — Monday's Mozambique
-- fetch serves Wednesday's signup; a new scan_week triggers a fresh fetch).
--
-- Class-2 service-role-only table (rls-policies.md): RLS enabled, NO policies —
-- only the service role (edge functions) reads/writes. Contains no brand data,
-- only market-level provider evidence (SERP domains, brand demand volumes,
-- Google Trends scores) keyed inside payload.

CREATE TABLE market_intel_cache (
  market text NOT NULL,
  scan_week date NOT NULL,
  kind text NOT NULL, -- 'serp_betting' | 'brand_demand' | 'brand_trends' | 'site_kw_count'
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (market, scan_week, kind)
);

ALTER TABLE market_intel_cache ENABLE ROW LEVEL SECURITY;

-- Additive: weekly_cache score-basis honesty flags (scoring-formulas §1/§4
-- amendments) — cache-population writes { reach_basis, sov_basis } here.
ALTER TABLE weekly_cache ADD COLUMN IF NOT EXISTS raw_data jsonb;
