# Scan Pipeline — entrypoint to every-competitor scan

_How one entrypoint call turns into a full brand + every-competitor scan. Grounded in code; file:line references included._

## 1. Trigger → `scan_jobs` row → entrypoint
Two things start a scan, both the same way:
- the **Monday cron** (`weekly-scan-trigger`), or
- the **first-scan server action** after onboarding (`app/onboarding/actions.ts` → `completeOnboarding`).

Each creates a `scan_jobs` row (`status: pending`) and calls the entrypoint **`brand-scan`** with `{ scan_job_id, brand_id }` + auth (`CRON_SECRET` for cron, service-role key for the app). `brand-scan` is the Supervisor "decompose" step — it plans and fans out; it does **no** scanning itself.

## 2. `brand-scan` builds the competitor set (`brand-scan/index.ts`)
1. **Auth + load** the job and brand (`:100–120`).
2. **Self-competitor** (`:129–142`): upserts a `competitors` row for the brand's **own** domain, so the brand scans *itself* too (feeds own-brand reach/SOV/threat). Deliberately not linked as a rival, so it never shows as a competitor dot.
3. **Resolve competitors** (`:152–182`): `brand_competitors → competitors`, ordered by priority (cap 10), then **prepends the self-competitor**. Result is one list — `competitors[]` (`CompetitorRef { id, name, domain, tier }`).
4. **Which modules run** (`:188–214`): `brand_preferences` toggles + Agent-Control kill switches gate the **8 MVP modules** (`traffic_seo, geo_aeo, tech_stack, app_store, customer, regulatory, promotions, hiring`).
5. **Skip-if-fresh** (`:222–230`): any module whose cache table already has a row for this `(brand, scan_week)` is skipped — no re-buying data. `toRun` = modules still needing data. `force_refresh` overrides.
6. **Spend-cap gate** (`:260–297`): checks the org's daily DataForSEO cap + account-balance floor before spending; hard-fails the job if breached.
7. Sets job `running`, records `expected_modules = toRun`.

## 3. Fan-out — one message, every module, full competitor list (`:308–312`)
```ts
for (const task of toRun) {
  const msg = { ...base, task_type: task };           // base carries competitors[]
  await enqueueModule(sb, msg);                        // durable pgmq message (retry safety net)
  await invokeFunction(MODULE_FUNCTION[task], msg);    // direct invoke (fast path)
}
return; // does NOT wait
```
Every researcher gets the **same message including the full `competitors[]`**. Each runs independently and in parallel; `brand-scan` returns immediately.

## 4. Each researcher scans every competitor
Example — `researcher-traffic-seo/index.ts`:
- First, market-level signals shared across the market (`brand_demand`, trends, keyword count) via `market_intel_cache`.
- Then the per-competitor loop (`:127`):
  ```ts
  mapWithConcurrency(competitors, MAX_CONCURRENCY, (c) => fetchCompetitorSeo(...c...))
  ```
  bounded-parallel, **one pass per competitor** — traffic estimate, keyword intersection vs the brand, ranked keywords, gaps, a small Haiku clustering — writing **one `seo_cache` row per competitor** (+ `competitor_profiles`).

Per-competitor failures are isolated (`allSettled` → the module goes `partial`, never aborts the others). The other researchers follow the same shape against their own source (promotions, hiring, app-store, etc.).

> **GEO is the exception**: it does not crawl each competitor's domain — it asks the 4 answer engines market questions and measures whether the brand and its rivals get mentioned.

## 5. Fan-in → synthesis → scores
Each researcher ends with `completeModule` (the `app_scan_complete_module` RPC ticks `completed_steps`). The researcher whose completion finally covers `expected_modules` enqueues **`synthesis-draft-audit`**, which reads all the per-competitor cache rows, drafts the ranked action plan + assets (Sonnet), audits, then **`cache-population`** computes each competitor's reach / SOV / threat into `competitor_states` + `weekly_cache` and sets progress to 100. That is what the dashboard renders (map dots, SOV donut, threat ranking).

## One-line summary
`brand-scan` builds a single `competitors[]` list (self + up to 10 rivals), hands the **same** list to all 8 module researchers, each loops it with bounded concurrency to write one cache row per competitor, and `cache-population` scores every competitor into the dashboard tables.

## Design properties
- **Cache-first**: skip-if-fresh per `(brand, scan_week)` + `market_intel_cache` shared across brands in a market (weekly freshness).
- **Fault-isolated**: one competitor or one module failing → `partial`, never a whole-scan abort.
- **Cost-gated**: per-org daily cap + balance floor checked before any DataForSEO spend.
- **Server-side only**: all external provider calls happen in Edge Functions, never the browser.
