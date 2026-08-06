# Focused Investigation — go to the object, not the repo

**Check before:** investigating ANY specific issue, bug, or task. This is the scope gate for *how* to look, before writing or changing anything.

**The rule:** identify the **single object** the task is about, go straight to **its** source of truth, and stop there. **Never scan the whole repo** (no broad greps across `supabase/functions/**`, no "read everything to understand it"). If the targeted look is genuinely insufficient, widen one step at a time — and say so out loud.

---

## 1. Name the object first
Before any tool call, answer: *what one thing is this about?* — a DB function, one Edge function, one table, one cache row, one skill doc, one API key. The whole investigation targets that object.

## 2. Prefer the LIVE system over repo files
The deployed reality is the source of truth; repo files can be stale.
- **DB function behaviour** → `select pg_get_functiondef('fn_name'::regproc)` — not a grep for the file.
- **What's scheduled** → `select * from cron.job` — not a search for cron config.
- **What a table holds / a bug's symptom** → query the table (`information_schema.columns` for shape, then the rows) — not inference from code.
- **Is an API key present / working** → deploy/​fire a tiny gated smoke function and read its result — not "the key must be missing."

## 3. Source-of-truth routing (pick the ONE that fits)
| Task is about… | Look ONLY at… |
|---|---|
| A provider / API key working | a gated smoke Edge function (fire via `net.http_post`, read `net._http_response`) + `agent_job_logs` |
| Which provider/model a module uses | `docs/skills/mvp-module-sources.md` (one file) |
| One scan module's bug | that module's single Edge function (`researcher-<module>/`) + its `*_cache` table |
| Shared client parsing (tech-stack, dfs, llm) | the one `_shared/<x>.ts` client + a sample `raw_response` row |
| A cron / DB function / state machine | `pg_get_functiondef`, `cron.job`, `scan_jobs` — the DB, not the repo |
| Cost / spend | `provider_spend`, `agent_job_logs`, `provider_budget_config` |
| A migration / column / RLS | `rls-policies.md` + `schema-amendments.md` + the live catalog |
| A screen / component | `component-library.md` + `ui-constraints.md` + that one component file |

## 4. Widen only on evidence, and announce it
If the one object doesn't explain it, add the **next single object** (its direct dependency), not the repo. Say "the X function didn't explain it; checking its one dependency Y." Silent repo-wide scanning is the failure mode this rule exists to prevent.

## 5. Verify before asserting
State findings only after reading the actual object's output. If a value hasn't been read this turn, say "unverified" — never infer a result and present it as fact.
