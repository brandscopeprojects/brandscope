# CLAUDE.md — Brandscope Build Index

**Load this first, every session.** It points to the rules; the rules live in the referenced files.

## What Brandscope is
An AI competitive-intelligence and marketing operating system for iGaming brands in Nigeria, Kenya, and South Africa. It turns competitor/market/GEO/regulatory signals into a ranked, evidence-backed weekly action plan with pre-written, executable marketing assets — a decision surface, not a dashboard.

---

## Document precedence (when two docs disagree)
**MVP scope > schema (LOCKED + amendments) > UI brief > other docs > my inference.**
`docs/mvp-scope.md` decides *what* to build. `docs/schema-amendments.md` + `brandscopeschema.md` decide *data shape*. `ui-constraints.md` decides *look*. If a lower doc conflicts with a higher one, the higher wins — **stop and flag**, do not silently reconcile.

---

## Skill / reference files — when to check each
| File | Check before… |
|---|---|
| `docs/skills/mvp-constraints.md` | **starting any feature** — the scope gate. Not on the list → stop & flag. |
| `docs/skills/schema-decisions.md` | any migration / table or column reference |
| `docs/schema-amendments.md` | writing SQL / migrations (authoritative deltas to the locked schema) |
| `docs/skills/rls-policies.md` | any DB query or migration (RLS class, service-role vs JWT) |
| `docs/skills/mvp-module-sources.md` | any Researcher Edge Function / external API call (MVP provider only) |
| `docs/skills/agent-orchestration.md` | any agent Edge Function, cron, queue, cache-population, DLQ |
| `docs/skills/data-flow-rules.md` | any data fetch, Edge Function, API route, cron, cache write |
| `docs/env-vars.md` | any server-side external call (exact, case-sensitive var name) |
| `docs/skills/component-library.md` | any frontend component or page |
| `ui-constraints.md` | any frontend component or page (tokens, card anatomy, split-field) |
| `screen-specs.md` | any screen (route, auth, data source, components) |
| `docs/mvp-scope.md` / `docs/data-flow.md` | full reference when a skill file isn't enough |

**By code category:**
- **Edge Function / API route / cron:** `data-flow-rules.md` + `agent-orchestration.md` + `mvp-module-sources.md` + `env-vars.md` + `rls-policies.md`.
- **Frontend component/page:** `component-library.md` + `ui-constraints.md` + `screen-specs.md`.
- **DB query / migration:** `rls-policies.md` + `schema-decisions.md` + `schema-amendments.md`.
- **Any new feature:** `mvp-constraints.md` **first**.

---

## Resolved decisions (locked)
1. **Competitor cap = 10/brand** (onboarding default 5; up to 10). App-layer enforced.
2. **Service-role-only, NO RLS:** `profiles`, `organisations`, `organisation_members`, `subscriptions`, `payment_history`, `usage_metrics` (+ all internal/log/config tables).
3. **Internal admin = full build at MVP** → backing tables added (`agents`, `agent_skills`, `model_router_config`, `revenue_metrics`, `churn_events`, `active_sessions`, `failed_logins`, `rbac_config`, `system_health`, `dead_letter_queue`, `geo_query_templates`, `ingestion_logs`) + new columns (see `schema-amendments.md`).
4. **Orchestration = pgmq + `scan_jobs` state machine** on Edge Functions. No Temporal/LangGraph. DLQ via `dead_letter_queue`, drained by between-cycle monitor.
5. **Extensions:** `vector` (not `pgvector`) + add `pg_cron`, `pg_net`, `pgmq`.

## Hard exclusions at MVP (never build)
Firecrawl · Apify · xAI/Grok · Together/Meta · DeepSeek · Kimi · Resend · Deployer · HITL review UI · LangGraph · Temporal · n8n · WhatsApp/Slack delivery · multi-brand-per-org · white-label · public API · Fintech/FMCG/Telecom. If needed to finish a feature → stop, flag, wait. Never fake with a placeholder that pretends to work.

---

## Anti-drift protocol
1. **Work the 80-step order** (`mvp-constraints.md` §4). Announce the step before starting it ("Step N: …").
2. **Re-read the relevant skill file at every boundary** — start of a new file, and before any fetch / cache write / key reference / token choice. In long sessions, trust the file, not memory.
3. **One commit per step** (or tight sub-step), descriptive message → diff stays auditable, drift is visible.
4. **Never introduce** a provider/table/column/colour/component not already in a skill file. To add one, update the skill file first (with flag/sign-off).
5. **Conflict = stop + flag.** Document wins over my judgement; surface it, propose, wait.
6. **Scope gate every feature** against `mvp-constraints.md` before the first line.

---

## Definition of Done — MVP v1
A Nigerian iGaming brand can sign up, enter a domain + up to 10 competitors; the weekly scan runs Monday automatically; dashboard loads <1s; the action plan has 4–8 evidence-backed recommendations, each with a clickable source URL and a pre-generated asset; GEO shows AI visibility across 4 platforms; regulatory shows compliance scores with verbatim quotes; brand chat answers from real data; between-cycle alerts fire on competitor change; internal admin shows feature health + agent traces/prompt versions; brand admin fully functional (config/competitors/alerts/billing); all screens mobile-responsive; all RLS enforced (no cross-brand access); all external calls server-side only; all assets pass OpenAI moderation; product is demoable to a paying customer. Every shipped v1 feature is production-quality — no fake data, no placeholders inside v1 pages.

---

## Repo reference map
- Root: `CLAUDE.md`, `ui-constraints.md`, `screen-specs.md`
- `docs/`: `mvp-scope.md`, `data-flow.md`, `env-vars.md`, `schema-amendments.md`
- `docs/skills/`: `mvp-constraints.md`, `schema-decisions.md`, `rls-policies.md`, `mvp-module-sources.md`, `agent-orchestration.md`, `data-flow-rules.md`, `component-library.md`
- Source-of-truth uploads (the 10 briefing docs) live outside the repo; their saved copies are in `docs/`.
- Working branch: `claude/supabase-connection-test-6rtio7`.
