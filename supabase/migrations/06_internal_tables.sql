-- Section 6: Internal-admin / config tables (schema-amendments.md §C).
-- All service-role-only (NO RLS — see docs/skills/rls-policies.md).

CREATE TABLE agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
    CHECK (name IN ('supervisor','researcher','drafter','auditor','reviewer','deployer','analytics')),
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','error')),
  model text NOT NULL,
  current_version text,
  description text,
  config jsonb DEFAULT '{}',
  last_updated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE agent_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL,
  is_active boolean DEFAULT true,
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE model_router_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type text NOT NULL UNIQUE,
  primary_model text NOT NULL,
  fallback_model text,
  max_tokens integer,
  temperature numeric(3,2),
  requests_per_min integer,
  daily_spend_cap_usd numeric(10,2),
  circuit_breaker_threshold_pct numeric(5,2) DEFAULT 15,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE revenue_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_week date NOT NULL UNIQUE,
  mrr_kobo bigint DEFAULT 0,
  active_brands integer DEFAULT 0,
  new_brands integer DEFAULT 0,
  churned_brands integer DEFAULT 0,
  arpb_kobo bigint DEFAULT 0,
  revenue_kobo bigint DEFAULT 0,
  infra_cost_kobo bigint DEFAULT 0,
  api_cost_kobo bigint DEFAULT 0,
  gross_margin_pct numeric(5,2),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE churn_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES brands(id),
  event_type text NOT NULL CHECK (event_type IN ('churned','downgraded','paused','reactivated')),
  mrr_delta_kobo bigint,
  from_plan text,
  to_plan text,
  reason text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organisation_id uuid REFERENCES organisations(id),
  brand_id uuid REFERENCES brands(id),
  role text,
  ip_address inet,
  location text,
  user_agent text,
  login_at timestamptz DEFAULT now(),
  last_activity_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE failed_logins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address inet,
  attempted_email text,
  location text,
  status text NOT NULL DEFAULT 'blocked' CHECK (status IN ('blocked','allowed')),
  reason text,
  attempted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE rbac_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key text NOT NULL,
  role text NOT NULL
    CHECK (role IN ('super_admin','internal_admin','brand_admin','brand_editor','brand_viewer')),
  allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(permission_key, role)
);

CREATE TABLE system_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL
    CHECK (service_name IN ('database','vector_store','storage','frontend','edge_functions')),
  status text NOT NULL CHECK (status IN ('healthy','degraded','down')),
  detail text,
  checked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE dead_letter_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_job_id uuid REFERENCES scan_jobs(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES brands(id),
  task_type text NOT NULL,
  payload jsonb NOT NULL,
  failure_reason text,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','retrying','permanently_failed','resolved')),
  next_retry_at timestamptz,
  last_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE geo_query_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text text NOT NULL,
  query_category text NOT NULL
    CHECK (query_category IN ('awareness','intent','comparison','brand_specific','market')),
  market text,
  is_brand_specific boolean DEFAULT false,
  context_injection text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE ingestion_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES regulatory_documents(id) ON DELETE CASCADE,
  step text NOT NULL CHECK (step IN ('downloaded','classified','chunked','embedded','verified')),
  status text NOT NULL CHECK (status IN ('success','processing','failed')),
  step_timestamp timestamptz DEFAULT now(),
  detail jsonb,
  error_message text,
  created_at timestamptz DEFAULT now()
);
