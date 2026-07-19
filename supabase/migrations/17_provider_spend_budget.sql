-- 17_provider_spend_budget.sql — DataForSEO spend metering + per-org cost cap
-- (owner decision 2026-07-19: persist per-scan provider spend and hard-fail a scan
-- when an organisation's daily DataForSEO spend hits its cap or the account balance
-- falls below a floor). Both tables are Class-2 service-role-only (rls-policies.md):
-- RLS enabled, NO policies — only edge functions (service role) read/write.

-- Per-call/per-module provider spend, captured from DataForSEO's response `cost`.
CREATE TABLE IF NOT EXISTS provider_spend (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid,                       -- brand's org (nullable = unattributed)
  brand_id uuid,
  scan_job_id uuid,
  task_type text,                             -- module ('traffic_seo'…) or 'onboarding'
  provider text NOT NULL DEFAULT 'dataforseo',
  cost_usd numeric NOT NULL DEFAULT 0,
  spend_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provider_spend_org_date_idx
  ON provider_spend (organisation_id, provider, spend_date);
CREATE INDEX IF NOT EXISTS provider_spend_job_idx ON provider_spend (scan_job_id);
ALTER TABLE provider_spend ENABLE ROW LEVEL SECURITY;

-- Budget config: one global default row (organisation_id NULL) + optional per-org
-- overrides. A scan resolves the org-specific row first, else the global default.
CREATE TABLE IF NOT EXISTS provider_budget_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid,                        -- NULL = global default
  provider text NOT NULL DEFAULT 'dataforseo',
  daily_cap_usd numeric NOT NULL DEFAULT 3,    -- per-org per-day ceiling
  balance_floor_usd numeric NOT NULL DEFAULT 10, -- account balance floor (global signal)
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- One config row per (org, provider); the global default uses a sentinel via a
-- partial unique index (NULLs are not unique by default in Postgres).
CREATE UNIQUE INDEX IF NOT EXISTS provider_budget_config_org_provider_idx
  ON provider_budget_config (organisation_id, provider) WHERE organisation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS provider_budget_config_global_idx
  ON provider_budget_config (provider) WHERE organisation_id IS NULL;
ALTER TABLE provider_budget_config ENABLE ROW LEVEL SECURITY;

-- Seed the global default: $3/org/day, stop all scanning below $10 balance.
INSERT INTO provider_budget_config (organisation_id, provider, daily_cap_usd, balance_floor_usd, enabled)
VALUES (NULL, 'dataforseo', 3, 10, true)
ON CONFLICT DO NOTHING;

-- Atomic per-scan cost accumulator (parallel modules increment concurrently).
CREATE OR REPLACE FUNCTION app_increment_scan_cost(p_scan_job_id uuid, p_delta numeric)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE scan_jobs
     SET total_cost_usd = COALESCE(total_cost_usd, 0) + p_delta,
         updated_at = now()
   WHERE id = p_scan_job_id;
$$;
REVOKE ALL ON FUNCTION app_increment_scan_cost(uuid, numeric) FROM public;
GRANT EXECUTE ON FUNCTION app_increment_scan_cost(uuid, numeric) TO service_role;
