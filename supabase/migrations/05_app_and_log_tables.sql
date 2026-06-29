-- Section 5: Application + log tables
-- Amendments §B folded in: recommendations (auditor sub-scores + is_on_demand),
-- generated_assets (moderation_flagged/checked_at/result), agent_job_logs (data_quality_score).

CREATE TABLE action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  scan_week date NOT NULL,
  scan_job_id uuid REFERENCES scan_jobs(id),
  total_recommendations integer DEFAULT 0,
  urgent_count integer DEFAULT 0,
  watch_count integer DEFAULT 0,
  opportunity_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(brand_id, scan_week)
);

CREATE TABLE recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_plan_id uuid NOT NULL REFERENCES action_plans(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES brands(id),
  scan_week date NOT NULL,
  urgency text NOT NULL DEFAULT 'watch'
    CHECK (urgency IN ('urgent','watch','opportunity','info')),
  category text NOT NULL,
  headline text NOT NULL,
  trigger_reason text NOT NULL,
  full_analysis text,
  confidence_score numeric(3,2) NOT NULL,
  confidence_level text NOT NULL CHECK (confidence_level IN ('high','medium','low','rejected')),
  evidence jsonb DEFAULT '[]',
  assumption_flags text[] DEFAULT '{}',
  is_direct_evidence boolean DEFAULT true,
  competitor_id uuid REFERENCES competitors(id),
  status text DEFAULT 'open'
    CHECK (status IN ('open','accepted','snoozed','dismissed','completed')),
  status_changed_at timestamptz,
  status_changed_by uuid REFERENCES profiles(id),
  snoozed_until timestamptz,
  rank integer NOT NULL DEFAULT 0,
  evidence_traceability_score numeric(3,2),   -- amendment §B
  brand_alignment_score numeric(3,2),         -- amendment §B
  logic_quality_score numeric(3,2),           -- amendment §B
  compliance_score numeric(3,2),              -- amendment §B
  is_on_demand boolean NOT NULL DEFAULT false, -- amendment §B
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE action_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES brands(id),
  action_taken text NOT NULL,
  action_taken_at timestamptz,
  outcome_metric text,
  outcome_value numeric(10,2),
  outcome_unit text,
  result text CHECK (result IN ('positive','neutral','negative')),
  notes text,
  logged_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE generated_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  recommendation_id uuid REFERENCES recommendations(id),
  scan_week date,
  asset_type text NOT NULL
    CHECK (asset_type IN ('campaign_brief','ad_copy','email','sms','push_notification','whatsapp','social_post','seo_brief','spend_memo','team_brief','report')),
  title text NOT NULL,
  content jsonb NOT NULL,
  word_count integer,
  model_used text,
  prompt_version text,
  generation_cost_usd numeric(10,6),
  is_pinned boolean DEFAULT false,
  is_pre_generated boolean DEFAULT false,
  share_token text UNIQUE,
  share_expires_at timestamptz,
  moderation_flagged boolean NOT NULL DEFAULT false,  -- amendment §B
  moderation_checked_at timestamptz,                  -- amendment §B
  moderation_result jsonb,                            -- amendment §B
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE performance_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  memory_type text NOT NULL
    CHECK (memory_type IN ('timing_insight','pricing_insight','channel_insight','audience_insight','product_insight','pattern')),
  title text NOT NULL,
  description text NOT NULL,
  confidence_score numeric(3,2),
  supporting_evidence jsonb,
  scan_weeks_observed integer DEFAULT 1,
  first_observed_week date,
  last_confirmed_week date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE brand_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  scan_week date NOT NULL,
  ctr_pct numeric(5,2),
  new_depositors integer,
  revenue_kobo bigint,
  app_rating numeric(3,2),
  market_avg_ctr_pct numeric(5,2),
  market_avg_new_depositors integer,
  market_avg_revenue_kobo bigint,
  market_avg_app_rating numeric(3,2),
  created_at timestamptz DEFAULT now(),
  UNIQUE(brand_id, scan_week)
);

CREATE TABLE regulatory_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text NOT NULL,
  regulatory_body text NOT NULL,
  document_name text NOT NULL,
  document_type text NOT NULL,
  version text,
  effective_date date,
  source_url text NOT NULL,
  r2_path text NOT NULL,
  file_hash text NOT NULL,
  file_size_bytes bigint,
  page_count integer,
  chunk_count integer DEFAULT 0,
  embedding_status text DEFAULT 'pending'
    CHECK (embedding_status IN ('pending','processing','complete','failed')),
  last_verified_at timestamptz,
  needs_review boolean DEFAULT false,
  review_notes text,
  is_active boolean DEFAULT true,
  superseded_by uuid REFERENCES regulatory_documents(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  section_title text,
  page_number integer,
  char_start integer,
  char_end integer,
  embedding extensions.vector(1536),
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(document_id, chunk_index)
);

CREATE TABLE alert_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  bonus_change_threshold_pct numeric(5,2) DEFAULT 15,
  bonus_change_enabled boolean DEFAULT true,
  new_ad_campaign_enabled boolean DEFAULT true,
  competitor_dark_on_ads_days integer DEFAULT 3,
  competitor_dark_enabled boolean DEFAULT false,
  traffic_drop_threshold_pct numeric(5,2) DEFAULT 20,
  traffic_drop_enabled boolean DEFAULT true,
  new_market_entry_enabled boolean DEFAULT true,
  scan_completion_enabled boolean DEFAULT true,
  feature_failure_enabled boolean DEFAULT true,
  data_source_failure_enabled boolean DEFAULT false,
  credit_balance_low_enabled boolean DEFAULT true,
  email_enabled boolean DEFAULT true,
  email_address text,
  whatsapp_enabled boolean DEFAULT false,
  whatsapp_number text,
  slack_enabled boolean DEFAULT false,
  slack_webhook_url text,
  webhook_enabled boolean DEFAULT false,
  webhook_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(brand_id)
);

CREATE TABLE alert_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  message text NOT NULL,
  payload jsonb,
  status text DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolved_at timestamptz,
  delivered_via text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE agent_job_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_job_id uuid REFERENCES scan_jobs(id),
  brand_id uuid REFERENCES brands(id),
  agent_name text NOT NULL
    CHECK (agent_name IN ('supervisor','researcher','drafter','auditor','reviewer','deployer','analytics')),
  task_type text,
  model_used text,
  prompt_version text,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  cost_usd numeric(10,6),
  duration_ms integer,
  status text NOT NULL CHECK (status IN ('passed','failed','retried')),
  retry_count integer DEFAULT 0,
  error_message text,
  input_snapshot jsonb,
  output_snapshot jsonb,
  langfuse_trace_id text,
  data_quality_score numeric(3,2),   -- amendment §B
  created_at timestamptz DEFAULT now()
);

CREATE TABLE prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL,
  version text NOT NULL,
  prompt_text text NOT NULL,
  system_prompt text,
  plain_english_config text,
  status text DEFAULT 'draft'
    CHECK (status IN ('draft','active','stable','deprecated')),
  deployed_at timestamptz,
  deployed_by uuid REFERENCES profiles(id),
  rollback_from text,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(agent_name, version)
);

CREATE TABLE chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id),
  title text,
  message_count integer DEFAULT 0,
  last_message_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  inline_data jsonb,
  tokens_used integer,
  cost_usd numeric(10,6),
  model_used text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN ('weekly_intelligence','market_entry','competitive_summary')),
  title text NOT NULL,
  scan_week date,
  page_count integer,
  r2_path text,
  share_token text UNIQUE,
  share_expires_at timestamptz,
  generated_by uuid REFERENCES profiles(id),
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  report_type text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('weekly','monthly')),
  day_of_week text,
  time_of_day time,
  recipients text[] NOT NULL DEFAULT '{}',
  format text DEFAULT 'pdf' CHECK (format IN ('pdf','email')),
  is_active boolean DEFAULT true,
  last_sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE UNIQUE,
  plan text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free','growth','professional','enterprise')),
  mrr_kobo bigint DEFAULT 0,
  status text DEFAULT 'active'
    CHECK (status IN ('active','past_due','cancelled','trialing')),
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  payment_provider text DEFAULT 'paystack',
  payment_provider_subscription_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  amount_kobo bigint NOT NULL,
  currency text DEFAULT 'NGN',
  status text NOT NULL CHECK (status IN ('paid','failed','refunded','pending')),
  payment_provider_reference text,
  invoice_url text,
  r2_invoice_path text,
  paid_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE usage_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  api_calls_used integer DEFAULT 0,
  api_calls_limit integer,
  assets_generated integer DEFAULT 0,
  assets_limit integer,
  reports_downloaded integer DEFAULT 0,
  reports_limit integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organisation_id, period_start)
);

CREATE TABLE api_health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('healthy','degraded','down')),
  latency_ms integer,
  error_rate_24h numeric(5,2),
  credit_balance numeric(10,2),
  credit_currency text,
  checked_at timestamptz DEFAULT now(),
  error_message text
);

CREATE TABLE cron_job_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  schedule text NOT NULL,
  status text NOT NULL CHECK (status IN ('success','failed','warning','running')),
  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds integer,
  error_message text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id),
  organisation_id uuid REFERENCES organisations(id),
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  ip_address inet,
  user_agent text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
