# Brandscope Simplification Plan

A concrete, phased migration from the current distributed pipeline to a single-function
scan. Sequenced so the app **keeps working after every phase** (strangler pattern: build
the simple path, cut over, then delete the old one). Each phase is one focused change,
one deploy, and reversible until the explicit "point of no return" in Phase 5.

---

## ⚠️ Precedence flag (read first)

This plan **contradicts locked decisions in `CLAUDE.md`**:
- "Orchestration = pgmq + `scan_jobs` state machine … DLQ via `dead_letter_queue`"
- The drafter/auditor synthesis split
- The service-role budget-governance tables

Per the project's own anti-drift rule, *the document wins over my judgement* — so this
is **not** something to execute silently. It is a conscious decision by the owner to
**revise those foundational decisions**. If you approve, Phase 0 includes updating
`CLAUDE.md` + the skill files so the docs and the code agree again. Until that doc update
lands, the code and the docs are in conflict by design.

---

## Guiding cut

| Today | Target |
|---|---|
| `brand-scan` + 8 researcher functions + pgmq queue + `scan_jobs`/reconciler + DLQ | **one `run-scan` function** |
| `synthesis-draft-audit` (supervisor → drafter → auditor, ~6 sequential LLM calls) | **one Claude call** |
| `cache-population` (sole writer, downstream of synthesis) | **write inline**, same function |
| Hard budget floors that halt scans | **spend logging + alerts**, no hard halt |

**Keep untouched:** the four real integrations (Claude, DataForSEO, Firecrawl, tech-stack
API), the competitor/signal/recommendation tables, the dashboard, asset moderation, and
one weekly cron.

---

## Phase 0 — Safety net + decision (½ day)
Nothing user-visible changes.
- [ ] Snapshot the DB (or confirm PITR window) so any phase is restorable.
- [ ] Record current live function versions (today: `synthesis-draft-audit` v23,
      `cache-population` v20, `researcher-promotions` v24) for rollback.
- [ ] **Set up auto-deploy** (GitHub Action → `supabase functions deploy`). Everything
      below assumes it; hand-bundling 14 files per function is itself a tax we remove now.
- [ ] Decide the doc override (above) and stage the `CLAUDE.md` edits to land in Phase 5.

**Reversible:** N/A (no code change).

---

## Phase 1 — Collapse synthesis to one call (½–1 day) ★ highest leverage
This alone kills the active breakage (the 150s timeout) and 5 of 6 LLM calls.
- [ ] In `synthesis-draft-audit`, replace `runSupervisor` + `runDrafter` + `runAuditor`
      with **one** `callClaude`: pass the loaded context, ask for 4–8 recommendations as
      JSON (title, evidence[], source_url, urgency, confidence). Keep `parseJsonFromModel`.
- [ ] Keep the timeout guard already shipped in `_shared/llm.ts`.
- [ ] Leave `cache-population` as the writer for now — unchanged contract, so blast radius
      is one function.
- [ ] Re-run one brand end-to-end; confirm recommendations land and quality holds.

**Removes:** the timeout root cause, the supervisor pre-digest, the auditor rewrite loop.
**Reversible:** yes — redeploy the previous `synthesis-draft-audit` bundle.

---

## Phase 2 — Merge the writer (½ day)
Removes the "only `cache-population` may write" choke point that left your dashboard empty
today even though every researcher succeeded.
- [ ] Fold `cache-population`'s writes (`weekly_cache`, `competitor_profiles`,
      `recommendations`, `action_plans`) into the synthesis function using the existing
      `scoring.ts` / `loader.ts` modules.
- [ ] Synthesis now: load → 1 LLM call → compute scores → write → done. One function owns
      the whole tail.
- [ ] Delete the `cache-population` function + its cross-function invoke.

**Reversible:** yes — restore `cache-population` and the invoke call.

---

## Phase 3 — Single `run-scan` function (2–4 days) ★ the big one
Collapse the front half of the pipeline.
- [ ] New `run-scan(brand_id, scan_week)`: move each researcher's **fetch logic** into an
      in-process module (`researchers/traffic.ts`, `/promotions.ts`, …) and call them with
      `Promise.all`. This is a lift-and-shift of the API-call code, not a rewrite.
- [ ] Append the Phase-2 synthesis tail in the same function.
- [ ] Replace the queue with **one row** in a simple `scans` table: `status`
      (running/done/failed), `started_at`, `error`. No pgmq, no per-module state.
- [ ] Point the weekly cron at `run-scan`. Delete `brand-scan`, the 8 researcher
      functions, pgmq enqueue/dequeue, the reconciler cron, and `dead_letter_queue` drain.
- [ ] Add a simple in-function retry (2 attempts) per provider call — the timeout guard
      makes this safe.

**Watch:** you lose per-module `feature_health_logs` granularity. If you still want a
health chip per signal, have each researcher module return `{ok, error}` and write one
`scan_signals` row — cheap, no queue.
**Reversible:** harder. Keep the old functions deployed-but-unreferenced for one release
so you can re-point the cron back if `run-scan` misbehaves.

---

## Phase 4 — Soften budget gates (½ day)
- [ ] Convert `provider_budget_config` **floors** from hard "halt the scan" gates to
      logging + a threshold alert (email/log row). Keep `provider_spend` inserts for
      visibility.
- [ ] Result: a low DataForSEO balance warns instead of silently killing the product
      (the exact failure that blocked the first scan today).

**Reversible:** yes — flip the gate check back on.

---

## Phase 5 — Delete + reconcile docs (1 day) — point of no return
Only after `run-scan` has run clean for a full cycle.
- [ ] Drop dead tables: `scan_jobs`, pgmq queues, `dead_letter_queue`, and any
      per-module state tables. Drop the reconciler + old cron entries.
- [ ] Remove the old function source from the repo.
- [ ] **Update `CLAUDE.md` + `docs/skills/agent-orchestration.md` + `data-flow-rules.md`**
      to describe the single-function architecture, so docs are authoritative again and
      the anti-drift protocol still means something.

**Reversible:** no — this is the cleanup. Do it last, deliberately.

---

## Net effect
- Failure points: ~30 → ~3.
- LLM calls per scan: ~6 sequential → 1.
- Deploy surface for any fix: 10–14 hand-bundled files across several functions → one
  function, auto-deployed.
- Wall-clock: minutes across a queue → seconds in one function.

## Honest risks
1. **One-call recommendation quality** vs. the drafter/auditor loop. Mitigation: a good
   single prompt + moderation usually matches it; A/B one brand in Phase 1 before
   committing.
2. **Losing at-scale resilience.** True. This target is right for ~1–50 brands. If you
   are genuinely months from hundreds of orgs with SLAs, revisit the queue *then* — grow
   into it, don't pre-pay for it.
3. **The doc override.** Phases 1–4 leave code and `CLAUDE.md` in conflict; Phase 5
   resolves it. Don't skip Phase 5.

## Suggested order to actually start
Phase 0 → Phase 1 only. Phase 1 fixes what's broken *today* and proves the single-call
approach on real data before you commit to the larger Phase 3 cut. Stop and reassess
after Phase 1.
