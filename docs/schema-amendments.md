# Brandscope — Schema Amendments

**Status:** AUTHORITATIVE amendment to `brandscopeschema.md` (the LOCKED schema, doc 5 of 10).
**Rule:** The original schema document is **not** modified. This file is the delta and overrides the original wherever they differ. Apply the original schema **with these amendments** when implementing Sprint 1, Step 1.
**Source of these changes:** Decisions 1–5 (competitor cap, service-role-only tables, internal-admin backing tables, orchestration, extension fix) confirmed by the project owner.

**Apply order (unchanged):** extensions → tables → new columns → indexes → RLS → triggers.

---

## A. Extension fixes (Decision 5)

Replace the original `Extensions Required` block with:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;     -- FIX: was "pgvector" (invalid). Supabase extension name is `vector`.
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- trigram fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_cron;    -- ADD: weekly + between-cycle cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_net;     -- ADD: net.http_post from cron → Edge Functions
CREATE EXTENSION IF NOT EXISTS pgmq;       -- ADD: durable queue for scan orchestration (Decision 4)
```

> Note: on Supabase these may be created in the `extensions` schema. The `vector` typmod `vector(1536)` and the ivfflat index in the original `document_chunks` definition are unchanged (only the extension *name* was wrong).

---

## B. New columns on existing tables (Decision 3)

```sql
-- competitor_changes: webhook-queue processing flag (data-flow §3 Check 1)
ALTER TABLE competitor_changes
  ADD COLUMN processed boolean NOT NULL DEFAULT false,
  ADD COLUMN processed_at timestamptz;

-- recommendations: persist Auditor dimension sub-scores + on-demand marker
ALTER TABLE recommendations
  ADD COLUMN evidence_traceability_score numeric(3,2),
  ADD COLUMN brand_alignment_score numeric(3,2),
  ADD COLUMN logic_quality_score numeric(3,2),
  ADD COLUMN compliance_score numeric(3,2),
  ADD COLUMN is_on_demand boolean NOT NULL DEFAULT false;

-- generated_assets: OpenAI moderation gate (API-map §6.4, data-flow §2.2)
ALTER TABLE generated_assets
  ADD COLUMN moderation_flagged boolean NOT NULL DEFAULT false,
  ADD COLUMN moderation_checked_at timestamptz,
  ADD COLUMN moderation_result jsonb;

-- agent_job_logs: Researcher data-quality score (agent-arch §2 Data Quality Scoring)
ALTER TABLE agent_job_logs
  ADD COLUMN data_quality_score numeric(3,2);
```

---

## C. New tables (Decision 3)

All new tables below are **internal-admin / config only** → **NO RLS** (service-role access only; never exposed to anon/authenticated). See `docs/skills/rls-policies.md`.

### C.1 `agents` — agent registry (Screen 25)
```sql
CREATE TABLE agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
    CHECK (name IN ('supervisor','researcher','drafter','auditor','reviewer','deployer','analytics')),
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','error')),
  model text NOT NULL,
  current_version text,                 -- references prompt_versions.version for this agent
  description text,
  config jsonb DEFAULT '{}',            -- {max_tokens, temperature, timeout_ms}
  last_updated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### C.2 `agent_skills` — plain-English skills per agent (Screen 25)
```sql
CREATE TABLE agent_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL,             -- plain-English config
  is_active boolean DEFAULT true,
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_agent_skills_agent ON agent_skills(agent_id);
```

### C.3 `model_router_config` — task→model routing + per-row caps/breakers (Screen 26)
```sql
CREATE TABLE model_router_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type text NOT NULL UNIQUE,        -- 'extraction','web_scraping','content_analysis','asset_generation','chat','geo_monitoring','embeddings','summarisation'
  primary_model text NOT NULL,
  fallback_model text,
  max_tokens integer,
  temperature numeric(3,2),
  requests_per_min integer,              -- rate limit
  daily_spend_cap_usd numeric(10,2),     -- cost cap
  circuit_breaker_threshold_pct numeric(5,2) DEFAULT 15,  -- open breaker above this 1h error rate
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```
> Screen 26's per-API "Rate Limit & Circuit Breaker" table is served by these columns (rate/cap/breaker), with live status read from `api_health_logs`. If a dedicated per-API config table is later wanted, flag before adding.

### C.4 `revenue_metrics` — weekly revenue rollup (Screen 29)
```sql
CREATE TABLE revenue_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_week date NOT NULL UNIQUE,      -- Monday of the week
  mrr_kobo bigint DEFAULT 0,
  active_brands integer DEFAULT 0,
  new_brands integer DEFAULT 0,
  churned_brands integer DEFAULT 0,
  arpb_kobo bigint DEFAULT 0,            -- avg revenue per brand
  revenue_kobo bigint DEFAULT 0,
  infra_cost_kobo bigint DEFAULT 0,
  api_cost_kobo bigint DEFAULT 0,
  gross_margin_pct numeric(5,2),
  created_at timestamptz DEFAULT now()
);
```

### C.5 `churn_events` (Screen 29)
```sql
CREATE TABLE churn_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES brands(id),
  event_type text NOT NULL CHECK (event_type IN ('churned','downgraded','paused','reactivated')),
  mrr_delta_kobo bigint,                 -- negative for loss
  from_plan text,
  to_plan text,
  reason text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_churn_events_org ON churn_events(organisation_id, occurred_at DESC);
```

### C.6 `active_sessions` — Security Centre session view (Screen 28)
```sql
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
CREATE INDEX idx_active_sessions_profile ON active_sessions(profile_id, last_activity_at DESC);
```
> Populated by server-side auth middleware / Edge Function (service role). Supabase Auth remains the source of truth for tokens; this is the denormalised admin view.

### C.7 `failed_logins` (Screen 28)
```sql
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
CREATE INDEX idx_failed_logins_time ON failed_logins(attempted_at DESC);
```

### C.8 `rbac_config` — RBAC matrix (Screen 28)
```sql
CREATE TABLE rbac_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key text NOT NULL,          -- 'view_intelligence','generate_assets','configure_alerts','manage_competitors','view_billing','access_admin','configure_agents','view_all_brands'
  role text NOT NULL
    CHECK (role IN ('super_admin','internal_admin','brand_admin','brand_editor','brand_viewer')),
  allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(permission_key, role)
);
```

### C.9 `system_health` — service status strip (Screen 24)
```sql
CREATE TABLE system_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL
    CHECK (service_name IN ('database','vector_store','storage','frontend','edge_functions')),
  status text NOT NULL CHECK (status IN ('healthy','degraded','down')),
  detail text,
  checked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_system_health_service ON system_health(service_name, checked_at DESC);
```

### C.10 `dead_letter_queue` — failed-task retry (Decision 4, data-flow §9.3)
```sql
CREATE TABLE dead_letter_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_job_id uuid REFERENCES scan_jobs(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES brands(id),
  task_type text NOT NULL,               -- e.g. 'promotions_scan'
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
CREATE INDEX idx_dlq_status ON dead_letter_queue(status, next_retry_at);
```

### C.11 `geo_query_templates` — GEO query set (data-flow §1.4)
```sql
CREATE TABLE geo_query_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text text NOT NULL,              -- may contain {brand_name} placeholder
  query_category text NOT NULL
    CHECK (query_category IN ('awareness','intent','comparison','brand_specific','market')),
  market text,                           -- 'nigeria'|'kenya'|'south_africa'|NULL(global)
  is_brand_specific boolean DEFAULT false,
  context_injection text,                -- persona system prompt for this market
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### C.12 `ingestion_logs` — reg-doc pipeline steps (Screen 27, data-flow §5)
```sql
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
CREATE INDEX idx_ingestion_logs_doc ON ingestion_logs(document_id, step_timestamp);
```

---

## D. RLS amendments (Decisions 2 + fixing default-deny)

### D.1 Add the MISSING policies for already-RLS-enabled brand tables
The original schema enabled RLS on these but defined no policy (default-deny). Add:

```sql
-- brand_id present → standard policy
CREATE POLICY "brand_preferences_own_brands" ON brand_preferences
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));
CREATE POLICY "brand_competitors_own_brands" ON brand_competitors
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));
CREATE POLICY "brand_benchmarks_own_brands" ON brand_benchmarks
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));
CREATE POLICY "report_schedules_own_brands" ON report_schedules
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

-- join-based (no brand_id column)
CREATE POLICY "tech_stack_cache_own_brands" ON tech_stack_cache
  FOR ALL USING (
    competitor_id IN (
      SELECT bc.competitor_id FROM brand_competitors bc
      WHERE bc.brand_id IN (SELECT get_user_brand_ids())
    )
  );
CREATE POLICY "chat_messages_own_brands" ON chat_messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM chat_conversations
      WHERE brand_id IN (SELECT get_user_brand_ids())
    )
  );
```

### D.2 Service-role-only tables — ENABLE RLS, NO policy (Decision 2) [corrected — see §11]
`profiles`, `organisations`, `organisation_members`, `subscriptions`, `payment_history`, `usage_metrics`, plus all internal/log/config tables: `agent_job_logs`, `prompt_versions`, `api_health_logs`, `cron_job_logs`, `audit_logs`, `feature_health_logs`, and all new tables in §C (`agents`, `agent_skills`, `model_router_config`, `revenue_metrics`, `churn_events`, `active_sessions`, `failed_logins`, `rbac_config`, `system_health`, `dead_letter_queue`, `geo_query_templates`, `ingestion_logs`).

> **Correction (verified against the Supabase linter):** these must have **RLS ENABLED with NO policy** — NOT "no RLS". In Supabase, a public-schema table with RLS *disabled* is exposed to the REST API for anon/authenticated. RLS enabled + no policy blocks anon/authenticated while `service_role` bypasses. No policy is added → still honours Decision 2. Implemented in migration `11_rls_hardening.sql`. All access goes server-side via `SUPABASE_SERVICE_ROLE_KEY`.

### D.3 Shared reference tables — ENABLE RLS + SELECT-to-authenticated [corrected — see §11]
`competitors`, `competitor_profiles`, `competitor_changes`, `regulatory_documents`, `document_chunks` are shared master data (read cross-brand). They get **RLS enabled + a read-only policy for `authenticated`** (`FOR SELECT TO authenticated USING (true)`) — readable by any signed-in user, `anon` blocked, writes service-role-only. (Not "no RLS", which would also expose them to `anon` and allow API writes.) `tech_stack_cache` is the exception — it gets the brand-scoped join policy in D.1.

### D.4 `feature_health_logs.status` — add `not_applicable_mvp`
The original CHECK is `('passed','partial','failed')`. Extended to include **`not_applicable_mvp`** so Phase-2/excluded features can be logged and excluded from the brand health %, per `docs/skills/feature-health-registry.md`. Applied in migration `03`.

---

## E. Trigger amendments

Add `updated_at` trigger to tables that have the column but were missing the trigger, plus all new §C tables with `updated_at`:

```sql
-- originally missing
CREATE TRIGGER set_updated_at BEFORE UPDATE ON organisation_members FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON competitor_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON action_outcomes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON brand_competitors FOR EACH ROW EXECUTE FUNCTION update_updated_at(); -- (already in original; keep idempotent)

-- new tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON agent_skills FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON model_router_config FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON rbac_config FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON dead_letter_queue FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON geo_query_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### E.1 Auth + seeding triggers (Gap 1 — approved)
Completes what the schema implied but never wrote: auto-create `profiles` on signup, and seed the singleton config rows (`brand_preferences`, `alert_configs`) on brand creation.

```sql
-- 1. Create a profiles row automatically when an auth user is created.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'brand_admin')
  )
  ON CONFLICT (id) DO NOTHING;          -- idempotent
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. Seed the singleton config rows when a brand is created.
--    brand_preferences and alert_configs are UNIQUE(brand_id) with all-default columns,
--    so inserting just brand_id materialises the defaults the app assumes exist.
CREATE OR REPLACE FUNCTION handle_new_brand()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.brand_preferences (brand_id) VALUES (NEW.id)
    ON CONFLICT (brand_id) DO NOTHING;
  INSERT INTO public.alert_configs (brand_id) VALUES (NEW.id)
    ON CONFLICT (brand_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_brand_created
  AFTER INSERT ON brands
  FOR EACH ROW EXECUTE FUNCTION handle_new_brand();
```

---

## F. Seed data required (load before first scan)

- `geo_query_templates` — the 15-query set from API-map §12 (awareness/intent/comparison/brand-specific/market) with NG context; KE/ZA variants flagged for later.
- `rbac_config` — the matrix from Screen 28 (8 permissions × 5 roles).
- `model_router_config` — task→model rows from API-map §5.1/§6.1.
- `agents` + `agent_skills` — 7 agents (5 active at MVP: supervisor/researcher/drafter/auditor/analytics; reviewer+deployer inactive), Drafter skills per Screen 25.
- `regulatory_documents` — NBGC / BCLB / WCGRB source docs (Sprint 4, Step 36).

---

## G. Competitor cap (Decision 1)
Schema comment on `brands` ("MVP one brand per org") unchanged. **Competitor cap = 10 per brand**, default starting point 5 in onboarding. Enforce at the application layer (onboarding step 4 + `/admin/competitors`), not via DB constraint (Growth plan = 10; Professional = 25 is Phase 2+).

---

*This amendments file is authoritative over the original schema where they differ. Any further schema change must be appended here with sign-off.*
