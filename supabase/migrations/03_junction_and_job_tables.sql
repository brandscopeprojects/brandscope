-- Section 3: Junction table + scan/feature-health tables
-- Amendment: feature_health_logs.status adds 'not_applicable_mvp' for P2 features
-- (per docs/skills/feature-health-registry.md).

CREATE TABLE brand_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  competitor_id uuid NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 1,
  track_promotions boolean DEFAULT true,
  track_seo boolean DEFAULT true,
  track_social boolean DEFAULT true,
  track_ads boolean DEFAULT true,
  track_tech_stack boolean DEFAULT true,
  track_regulatory boolean DEFAULT true,
  track_product boolean DEFAULT true,
  track_hiring boolean DEFAULT true,
  added_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(brand_id, competitor_id)
);

CREATE TABLE scan_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  scan_week date NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','partial','failed')),
  triggered_by text DEFAULT 'cron'
    CHECK (triggered_by IN ('cron','manual','alert')),
  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds integer,
  progress_percentage numeric(5,2) DEFAULT 0,
  completed_steps text[] DEFAULT '{}',
  failed_modules text[] DEFAULT '{}',
  partial_modules text[] DEFAULT '{}',
  total_cost_usd numeric(10,4) DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(brand_id, scan_week)
);

CREATE TABLE feature_health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_job_id uuid NOT NULL REFERENCES scan_jobs(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES brands(id),
  scan_week date NOT NULL,
  feature_name text NOT NULL,
  feature_category text NOT NULL,
  feature_tier text NOT NULL DEFAULT 'important'
    CHECK (feature_tier IN ('critical','important','supplementary')),
  status text NOT NULL
    CHECK (status IN ('passed','partial','failed','not_applicable_mvp')),
  root_cause text,
  resolution_suggested text,
  created_at timestamptz DEFAULT now()
);
