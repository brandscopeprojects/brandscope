# RLS Policies — Exact SQL (check before any query or migration)

**Check before:** writing any DB query, any migration, any Supabase client call.
**Golden rule:** brand reads use the **user's session JWT** (RLS applies). Server/agent writes use the **service role** (RLS bypassed → scope by `brand_id` in code). Service-role-only tables are **never** queried with the anon key.

---

## Helper functions (exact)
```sql
CREATE OR REPLACE FUNCTION get_user_organisation_id()
RETURNS uuid AS $$
  SELECT organisation_id
  FROM organisation_members
  WHERE profile_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_brand_ids()
RETURNS SETOF uuid AS $$
  SELECT b.id
  FROM brands b
  JOIN organisation_members om ON om.organisation_id = b.organisation_id
  WHERE om.profile_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;
```
> MVP is one-org-per-user / one-brand-per-org, so `get_user_organisation_id()`'s `LIMIT 1` is safe. Multi-org is Phase 2 (would need to drop LIMIT 1 and make `brands` policy use a set).

---

## Class 1 — RLS enabled + brand-scoped policy
`ENABLE ROW LEVEL SECURITY` + the policy below.

**`brands` (org-scoped):**
```sql
CREATE POLICY "brands_own_org" ON brands
  FOR ALL USING (organisation_id = get_user_organisation_id());
```

**Standard brand-scoped (one policy each, same shape):**
```sql
CREATE POLICY "<table>_own_brands" ON <table>
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));
```
Apply to: `brand_preferences`, `brand_competitors`, `weekly_cache`, `promotions_cache`, `seo_cache`, `geo_cache`, `social_cache`, `hiring_signals_cache`, `product_intel_cache`, `customer_intel_cache`, `regulatory_cache`, `action_plans`, `recommendations`, `action_outcomes`, `generated_assets`, `performance_memory`, `brand_benchmarks`, `alert_configs`, `alert_history`, `chat_conversations`, `reports`, `report_schedules`, `scan_jobs`.

**Join-based (no `brand_id` column):**
```sql
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

> The original schema enabled RLS on `brand_preferences`, `brand_competitors`, `brand_benchmarks`, `report_schedules`, `tech_stack_cache`, `chat_messages` but **defined no policy** → they were default-deny. The policies above fix that. (Tracked in `schema-amendments.md` §D.1.)

---

## Class 2 — NO RLS, service-role-only (Decision 2 + internal)
**Do NOT** `ENABLE ROW LEVEL SECURITY`. **Do NOT** grant to anon/authenticated. Access only via server API routes / Edge Functions with `SUPABASE_SERVICE_ROLE_KEY`.

Identity/billing: `profiles`, `organisations`, `organisation_members`, `subscriptions`, `payment_history`, `usage_metrics`.
Logs/internal: `agent_job_logs`, `prompt_versions`, `api_health_logs`, `cron_job_logs`, `audit_logs`, `feature_health_logs`.
New internal/config: `agents`, `agent_skills`, `model_router_config`, `revenue_metrics`, `churn_events`, `active_sessions`, `failed_logins`, `rbac_config`, `system_health`, `dead_letter_queue`, `geo_query_templates`, `ingestion_logs`.

> If a Server Component must show this data (e.g. Billing screen 23, internal admin), it goes through a **server route using the service role** that first validates the session/role — never a direct anon-key query.

---

## Class 3 — NO RLS, shared reference (cross-brand readable by design)
`competitors`, `competitor_profiles`, `competitor_changes`, `regulatory_documents`, `document_chunks`.
These are shared master data (one row per domain / per document). Readable by any authenticated user. (`tech_stack_cache` is intentionally NOT in this class — it's brand-scoped via the join policy so a brand sees only the tech of competitors it tracks.)

---

## Query-writing checklist
1. Brand-facing read? → SSR with **user JWT**, expect RLS to filter. Never use service role for brand reads.
2. Writing from an agent/cron/webhook? → **service role**, and **scope by `brand_id`** explicitly in the query (RLS won't protect you).
3. Touching a Class-2 table from the frontend? → **never** directly; go through a server route that uses the service role + checks role via `rbac_config`/`profiles.role`.
4. Reference a table/column not in the schema or `schema-amendments.md`? → **stop and flag**.
