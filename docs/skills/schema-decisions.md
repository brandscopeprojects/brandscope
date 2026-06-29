# Schema Decisions — Authoritative Reference

**Check before:** any migration, any table/column reference, any RLS work.
**Authority chain:** `docs/schema-amendments.md` (SQL deltas) > original `brandscopeschema.md` (LOCKED). This file is the human-readable summary of *decisions*; the SQL lives in the amendments file.

---

## The 5 resolved decisions

1. **Competitor cap = 10 per brand** (onboarding shows 5 as default starting point; brands may add up to 10). Enforced in app layer (onboarding + `/admin/competitors`), not a DB constraint.
2. **Service-role-only tables (NO RLS):** `profiles`, `organisations`, `organisation_members`, `subscriptions`, `payment_history`, `usage_metrics`. Accessed exclusively via server-side API routes / Edge Functions with the service-role key. The anon/authenticated role never touches them directly.
3. **Internal-admin backing tables added** (full build at MVP): `agents`, `agent_skills`, `model_router_config`, `revenue_metrics`, `churn_events`, `active_sessions`, `failed_logins`, `rbac_config`, `system_health`, `dead_letter_queue`, `geo_query_templates`, `ingestion_logs`. Plus columns: `competitor_changes.processed`(+`processed_at`), `recommendations` auditor sub-scores (`evidence_traceability_score`,`brand_alignment_score`,`logic_quality_score`,`compliance_score`) + `is_on_demand`, `generated_assets.moderation_flagged`(+`moderation_checked_at`,`moderation_result`), `agent_job_logs.data_quality_score`.
4. **Orchestration = pgmq + `scan_jobs` state machine.** No Temporal, no LangGraph. Edge Functions only. DLQ via `dead_letter_queue`, drained by the between-cycle monitor. (Detail: `docs/skills/agent-orchestration.md`.)
5. **Extension fix:** `vector` (not `pgvector`); add `pg_cron`, `pg_net`, `pgmq`.

---

## Extension list (final)
`uuid-ossp` · `vector` · `pg_trgm` · `pg_cron` · `pg_net` · `pgmq`

---

## RLS classification (every table)

**RLS enabled + brand-scoped policy** (`brand_id IN (SELECT get_user_brand_ids())` unless noted):
`brands` (org-scoped via `get_user_organisation_id()`), `brand_preferences`, `brand_competitors`, `weekly_cache`, `promotions_cache`, `seo_cache`, `geo_cache`, `social_cache`, `tech_stack_cache` *(join via `brand_competitors`)*, `hiring_signals_cache`, `product_intel_cache`, `customer_intel_cache`, `regulatory_cache`, `action_plans`, `recommendations`, `action_outcomes`, `generated_assets`, `performance_memory`, `brand_benchmarks`, `alert_configs`, `alert_history`, `chat_conversations`, `chat_messages` *(join via `chat_conversations`)*, `reports`, `report_schedules`, `scan_jobs`.

**NO RLS — service-role-only:**
`profiles`, `organisations`, `organisation_members`, `subscriptions`, `payment_history`, `usage_metrics`, `agent_job_logs`, `prompt_versions`, `api_health_logs`, `cron_job_logs`, `audit_logs`, `feature_health_logs`, and all new internal tables (`agents`, `agent_skills`, `model_router_config`, `revenue_metrics`, `churn_events`, `active_sessions`, `failed_logins`, `rbac_config`, `system_health`, `dead_letter_queue`, `geo_query_templates`, `ingestion_logs`).

**NO RLS — shared reference (readable cross-brand by design):**
`competitors`, `competitor_profiles`, `competitor_changes`, `regulatory_documents`, `document_chunks`.

> Full policy SQL: `docs/skills/rls-policies.md`.

---

## `scan_jobs` state machine (summary)
`pending` → `running` → (`completed` | `partial` | `failed`). `partial` = ≥1 module failed but others succeeded. `failed` = full failure → one auto-retry at 06:00 WAT. State lives in `scan_jobs`; module-level fan-out via `pgmq`; failures land in `dead_letter_queue`. Detail in `agent-orchestration.md`.

---

## Conventions (unchanged from original schema)
uuid PKs `gen_random_uuid()` · `created_at`/`updated_at timestamptz DEFAULT now()` · money in **kobo** `bigint` (÷100 for Naira) — except API/LLM costs in **USD** `numeric` · percentages `numeric(5,2)` · confidence `numeric(3,2)` · soft delete via `deleted_at` (brand-facing) · `updated_at` trigger on all tables with the column.

---

## Hard rules
- Never modify the original locked schema doc — append deltas here / in `schema-amendments.md` with sign-off.
- Never enable RLS on a service-role-only table; never grant those to anon/authenticated.
- Always reference a column/table here before using it in a query — if it isn't in the original schema or these amendments, **stop and flag**.
