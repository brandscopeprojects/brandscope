# Agent Orchestration — pgmq + scan_jobs State Machine

**Check before:** writing any agent Edge Function, the cron triggers, the cache-population step, or the DLQ/between-cycle handlers.
**Decision 4:** pgmq + `scan_jobs` state machine. No Temporal, no LangGraph at MVP. Edge Functions are short-lived → the pipeline is **many short invocations driven by durable state**, never one long-running function.

---

## Why this pattern
A weekly scan spans ~4 hours (02:00→06:00 WAT). Supabase Edge Functions can't run that long. So:
- **Durable state** lives in `scan_jobs` (per brand) + `pgmq` queues (per module task).
- Each invocation does one bounded unit (≤90s) and enqueues/advances the next.
- Failures are durable in `dead_letter_queue` and retried by the 6-hourly monitor.

---

## `scan_jobs` status transitions
```
pending ──(brand-scan picks up)──▶ running
running ──(all modules ok)──────▶ completed
running ──(some modules failed)─▶ partial
running ──(fatal/zero modules)──▶ failed ──(auto-retry 06:00 WAT, once)──▶ running ──▶ …
```
- `pending`: created by `weekly-scan-trigger` (or manual/alert).
- `running`: Supervisor decomposed; modules in flight. Update `progress_percentage`, `completed_steps`.
- `partial`: ≥1 module in `failed_modules`/`partial_modules`, others succeeded → still populate cache (failed modules fall back to previous week).
- `completed`: all enabled modules succeeded.
- `failed`: nothing usable → one auto-retry at 06:00; if still failing → alert internal team, brand sees previous-week cache.

---

## Queues (pgmq)
- `scan_modules` — one message per `{scan_job_id, brand_id, scan_week, task_type, competitor_ids}`. Researcher workers consume.
- `scan_synthesis` — enqueued when all module messages for a job are done → triggers Supervisor synthesis → Drafter → Auditor → cache-population.
- Visibility timeout per message ≥ module timeout (90s). Archive on success; on terminal failure → `dead_letter_queue`.

> Completion detection: a job's module fan-out count is recorded on `scan_jobs` (expected vs done). When done == expected (success+failed), enqueue `scan_synthesis`. Use `Promise.allSettled` semantics — a failed module never blocks others.

---

## End-to-end sequence (functions)
1. `weekly-scan-trigger` (pg_cron `0 1 * * 1`): insert `scan_jobs(pending)` per active brand; enqueue a `brand-scan` kickoff; log `cron_job_logs`.
2. `brand-scan`: load context; Supervisor decomposes; set `running`; enqueue N `scan_modules` messages; record expected count.
3. `researcher-{module}` (queue consumers, parallel): call MVP APIs (see `mvp-module-sources.md`) → Haiku structure → UPSERT module cache table → `agent_job_logs` (incl. `data_quality_score`) → ack. On failure after 2 retries → `dead_letter_queue`, mark module in `scan_jobs.failed_modules`.
4. On fan-out complete → enqueue `scan_synthesis`.
5. `synthesis-draft-audit`: Supervisor synthesises → Drafter (Five-Question filter, ≤2 retries) → Auditor (rubric, ≤1 rewrite, URGENT gating). (HITL **skipped at MVP**.)
6. `cache-population`: compute market position/threat/SOV/radar; UPSERT `weekly_cache` (`expires_at = now()+8d`); INSERT `action_plans`/`recommendations`/`generated_assets`; feature-health → `feature_health_logs`; set `scan_jobs` final status; send scan-complete email (Supabase Auth).
7. `between-cycle-monitor` (every 6h): process unprocessed `competitor_changes` (`processed=false`), DataForSEO News, social-crisis (skipped at MVP - no Apify), fire alerts; **drain `dead_letter_queue`**.

---

## Dead letter queue pattern
- After 2 in-call retries (backoff 1s, 3s) a task → `dead_letter_queue` (`status='pending'`, `retry_count`, `next_retry_at`, `payload`).
- Between-cycle monitor: select `pending`/`retrying` where `next_retry_at <= now()`, re-invoke; on success `status='resolved'`; increment `retry_count`; at `retry_count >= max_retries (3)` → `permanently_failed` + alert internal team if module is critical.

---

## Per-agent I/O contracts (MVP)
| Agent | Reads | Writes | Model |
|---|---|---|---|
| Supervisor | `brands`,`brand_preferences`,`brand_competitors`,`competitors`,`performance_memory`,`weekly_cache`(prev) | `scan_jobs`(status), `agent_job_logs` | Sonnet 4.6 |
| Researcher (per module) | `competitors` + external APIs | its module cache table, `agent_job_logs` (+`dead_letter_queue` on fail) | Haiku 4.5 |
| Drafter | caches, `performance_memory`, `previous_recommendations` | (produces recs+assets → persisted in cache-population) `agent_job_logs` | Sonnet 4.6 |
| Auditor | recommendation + brand context | `recommendations` (scores+level), `agent_job_logs` | Sonnet 4.6 |
| Analytics | `action_outcomes`, history | `performance_memory`,`action_outcomes`,`brand_benchmarks` | Haiku 4.5 |
| Reviewer | — | — | **Phase 2 — not built** |
| Deployer | — | — | **Phase 2 — not built** |

Boundary rule: no agent writes another agent's tables; cache-population (orchestrator step, service role) is what persists Drafter output.

---

## `agent_job_logs` — fields written on EVERY LLM call (Rule 4)
```
scan_job_id, brand_id, agent_name, task_type, model_used, prompt_version,
input_tokens, output_tokens, total_tokens, cost_usd, duration_ms,
status ('passed'|'failed'|'retried'), retry_count, error_message,
input_snapshot (truncated), output_snapshot (truncated),
data_quality_score (Researcher only), langfuse_trace_id
```
No LLM call may proceed without a corresponding log row. Langfuse trace sent in parallel (reactive debugging only).

---

## Isolation reminder
Agents run with the **service role → RLS is bypassed**. Isolation is enforced in code: every query is scoped to the single `brand_id` on the queue message. Never batch across brands in one agent invocation.

## Brand-self convention (own-brand scanning)
Per-competitor module caches (`seo_cache`, `promotions_cache`, `tech_stack_cache`, `customer_intel_cache`, `product_intel_cache`, `hiring_signals_cache`, `regulatory_cache`) are keyed by `competitor_id`. To also scan the brand's OWN domain (so the dashboard's own-brand reach/SOV/threat/radar populate), `brand-scan` upserts a **self-competitor** row in `competitors` keyed by the brand's domain and **prepends it to the scan's `competitors[]`** — but it is **NOT linked in `brand_competitors`**, so it never appears in the brand's competitor list (`getBrandCompetitors`) or as a grey rival dot. `cache-population` resolves the self row by a **direct domain match** against `competitors` (not via the tracked list), reads the brand's own module rows from it, and excludes it from `competitor_states`/rivals. `geo_cache` is the exception — own AI visibility is brand-keyed directly. Absent self data → own-brand scores stay null (no fabrication).
