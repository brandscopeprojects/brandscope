# Data Flow Rules — Build-Time Checklist

**Consult this file BEFORE writing any:** data fetch, Edge Function, API route, cron job, or cache write.
Full reference: `docs/data-flow.md`. Design system: `ui-constraints.md`. Screens: `screen-specs.md`.

---

## 1. Server-side ONLY (never client-side)

These run exclusively in Edge Functions or Next.js server (API routes / Server Components). **Never** from the browser. **API keys never reach the frontend.**

- **All external API calls** — DataForSEO, Firecrawl, Apify, DetectZeStack, Anthropic, OpenAI, DeepSeek, Kimi, xAI, Together AI, Ideogram, Cloudflare R2.
- **All agent work** — Supervisor, Researcher, Drafter, Auditor, Analytics.
- **All LLM calls** (including asset generation, chat completion, embeddings, moderation, RAG).
- **All DB writes** — go through server-side API routes that validate session first. The `service_role` key is server-only, never exposed; it bypasses RLS, so server code must scope every query by `brand_id`.
- **Webhook handling**, R2 uploads/signed URLs, cron triggers.
- Frontend gets the **anon key for reads only**, and RLS filters those reads to the user's brand.

> Rule of thumb: if it needs a secret or hits a 3rd party, it is server-side. The browser only ever talks to Supabase (RLS-scoped reads) and our own `/api/*` routes.

---

## 2. Module → table write map (Researcher writes its OWN table only)

| Module (Edge Function) | APIs called | Writes to |
|---|---|---|
| `promotions_scan` | Firecrawl `/scrape` | `promotions_cache` |
| `traffic_seo_scan` | DataForSEO Labs (bulk_traffic, domain_intersection, keywords_for_site) | `seo_cache` |
| `social_scan` | Apify (IG/FB/TikTok/X/YouTube) | `social_cache` |
| `ads_scan` | Apify FB Ads + Firecrawl FB Ad Library | `social_cache.ads_data` |
| `tech_stack_scan` | DetectZeStack `/v1/detect` | `tech_stack_cache` |
| `geo_aeo_scan` | DataForSEO AI Opt. (ChatGPT/Claude/Gemini/Perplexity) + xAI (Grok) + Together (Llama) | `geo_cache` |
| `regulatory_scan` | Firecrawl + DataForSEO Google News | `regulatory_cache` |
| `product_scan` | DataForSEO App Data + Firecrawl + Apify Play reviews | `product_intel_cache` |
| `customer_scan` | DataForSEO Content Analysis + App Reviews + traffic | `customer_intel_cache` |
| `hiring_scan` | Firecrawl careers + DataForSEO Jobs SERP | `hiring_signals_cache` |
| `cache-population` (orchestrator step) | — (reads all caches) | `weekly_cache`, `action_plans`, `recommendations`, `generated_assets`, `feature_health_logs` |
| Asset generation | Claude Sonnet 4.6 (+ OpenAI moderation) | `generated_assets` |
| Chat | OpenAI GPT-4.1-mini | `chat_messages` |
| Reg doc ingestion | Firecrawl/fetch + Claude Haiku + OpenAI embeddings + R2 | `regulatory_documents`, `document_chunks`, `ingestion_logs` |
| DetectZeStack webhook | — | `competitor_changes`, `tech_stack_cache` |

**Boundary rule:** no agent writes another agent's table. Every LLM call logs to `agent_job_logs` (agent_name, model_used, tokens, cost_usd, duration_ms, status, langfuse_trace_id). Every cache write uses `ON CONFLICT (brand_id, scan_week, competitor_id[, market]) DO UPDATE` (UPSERT). Always store evidence (`source_url`, `scraped_at`, `evidence_hash` = SHA-256).

---

## 3. Cache invalidation rules (all 7)

1. **Weekly cache expires after 8 days** — `weekly_cache.expires_at = cached_at + interval '8 days'` (7-day cycle + 1-day buffer). Never read data >8 days as "current."
2. **Module caches tied to `scan_week`** — never deleted; always query by `scan_week`. "Current week" = most recent `scan_week`.
3. **2-year retention** — no hard deletes on cache tables; >2yr archived to R2 (last 104 weeks in Supabase).
4. **On-demand scan UPSERTs current week** — manual scan (`triggered_by='manual'`) overwrites `weekly_cache` for `(brand_id, current_monday)`; old recommendations NOT deleted, new ones added.
5. **Between-cycle alert updates fields only** — UPDATE `promotions_cache` (set new value, `is_new=true`, `scraped_at=now()`) + INSERT `competitor_changes` + fire alert. **Do NOT regenerate recommendations** (that needs a full Drafter+Auditor cycle, i.e. an on-demand scan).
6. **Competitor removed → cache stays** — DELETE from `brand_competitors` only; cache tables untouched; future scans exclude it; past weeks still show it.
7. **Stale display** — scan failed/no current cache → show previous week + banner "Intelligence from [date] … [Retry scan]". Cache >8 days → amber warning banner, don't block, alert internal team.

---

## 4. Error handling & fallback patterns

- **Per API call:** 2 retries, exponential backoff (1s, 3s). Timeout per module 90s.
- **Single competitor fails:** continue others, log partial.
- **Module fails:** add to `scan_jobs.failed_modules`, continue other modules, `status='partial'`, **fall back to previous week's cache for that module** (weekly_cache merges new-where-available + prev-where-failed), flag in `feature_health_logs`, surface "X unavailable this week" note, retry in 6h.
- **Full scan fails:** `status='failed'`, one auto-retry at 06:00 WAT; if still failing → alert internal team, show previous-week cache + banner, manual retry in brand admin.
- **Dead letter queue:** after 2 retries → record in `agent_job_logs` + insert `dead_letter_queue` (task_type, payload, failure_reason, retry_count, next_retry_at). Between-cycle monitor drains it every 6h. Max 3 attempts → `permanently_failed`, alert if critical module.
- **Per-API fallback chains (from API map):** Claude→Haiku→GPT-4.1-mini; OpenAI→Claude Haiku; DataForSEO/Firecrawl/Apify/DetectZeStack → retry then use cached/skip-partial; xAI/Together → skip, note `geo_cache` as unchecked.
- **Circuit breaker:** error rate >15% for any API over 1h → open breaker, stop requests, alert internal admin, use cached data.
- Use `Promise.allSettled()` for parallel modules — one failure never blocks others.

---

## 5. Frontend read patterns (SSR only, no live API on page load)

- **Read in Server Components (SSR)** directly from Supabase cache tables, scoped by `brand_id` + `scan_week`; rely on the **user's session JWT** so **RLS** filters to the brand (do NOT use service_role for brand reads).
- **Zero external API calls on page load.** Everything hydrates from cache. Target <1s.
- **No-server-call client interactions:** filter chips, evidence drawer expand/collapse, tag hover tooltips.
- **Server-call client interactions (via `/api/*` only):** Accept/Snooze/Dismiss → `PATCH /api/recommendations/{id}/status`; Generate Asset → `POST /api/assets/generate` (checks `is_pre_generated` first, else Claude Sonnet + stream SSE, then moderation); chat → `POST /api/chat` (loads context server-side, GPT-4.1-mini, SSE); view previous week → re-query `weekly_cache` by different `scan_week`.
- All writes validate session server-side before writing.

---

## 6. Webhook verification requirements

- **DetectZeStack** → `POST /api/webhooks/detectzestack`:
  1. **Verify HMAC-SHA256**(rawBody, `DETECTZESTACK_WEBHOOK_SECRET`) vs `X-Signature` header. Mismatch → **401**, log to `audit_logs`, drop.
  2. **Replay prevention** — check payload timestamp freshness.
  3. Parse → find competitor by domain → INSERT `competitor_changes` (change_type `tech_stack`) → UPSERT `tech_stack_cache` → flag for next 6h between-cycle processing (do NOT fire alert inline) → return **200**.
- General: webhooks are HTTPS only; verify signature before doing any work; never trust unverified payloads.

---

## 7. Data retention per table

| Table(s) | Retention | Rule |
|---|---|---|
| All `*_cache`, `competitor_profiles`, `competitor_changes` | **2 years** | archive to R2 after, no hard delete |
| `recommendations`, `action_outcomes`, `generated_assets`, `performance_memory`, `regulatory_documents`, `document_chunks` | **Permanent** | never delete |
| `audit_logs`, `payment_history` | **7 years** | compliance — never early-delete |
| `chat_messages`, `alert_history` | **1 year** | delete after |
| `feature_health_logs` | **6 months** | delete after |
| `agent_job_logs`, `cron_job_logs` | **90 days** | delete after |
| `api_health_logs` | **30 days** | delete after |

(Retention deletes/archives require scheduled cleanup jobs — not yet specced as cron.)

---

## Security invariants (always)
HTTPS only · keys in Supabase Vault/env, rotated quarterly · service_role never client-side · R2 private bucket, 15-min signed URLs · response data sanitised before DB write · every webhook signature-verified.
