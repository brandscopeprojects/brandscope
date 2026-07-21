# MVP Module Sources — API → Endpoint → Table → Haiku Job

**Check before:** writing any Researcher Edge Function or any external API call in a scan module.
**Purpose:** the MVP-only source map. The API map (doc 6) and agent-arch (doc 7) route several modules through **Firecrawl/Apify** — those are **excluded at MVP**. This file is the replacement map. **Never reach for an excluded provider** (Firecrawl, Apify, xAI, Together, DeepSeek, Kimi, Resend). If a module seems to *need* one → stop and flag.

**MVP providers only:** DataForSEO · DetectZeStack · Claude (Sonnet 4.6 / Haiku 4.5) · OpenAI (GPT-4.1 Mini, embeddings, moderation) · Ideogram · Cloudflare R2 · Supabase.
**DataForSEO base:** `https://api.dataforseo.com/v3/` · Basic auth `btoa(LOGIN:PASSWORD)`.

---

## Module → MVP source map

### 1. SEO  ✓ FULL  → writes `seo_cache` (+ `competitor_profiles`)
- **Endpoints:** `dataforseo_labs/google/bulk_traffic_estimation/live`, `…/domain_intersection/live`, `…/keywords_for_site/live`, `…/competitors_domain/live`, `…/ranked_keywords/live`; `keywords_data/google_ads/search_volume/live; keywords_data/google_trends/explore/live (owner-approved 2026-07-17 — relative brand-interest index for the §1 demand-proxy reach fallback; see scoring-formulas §1)`.
- **Haiku:** structure keyword-gap rows, flag significant WoW rank changes. (Mostly already-structured → minimal LLM.)

### 2. GEO  ✓ FULL (4 platforms)  → writes `geo_cache`
- **Provider routing (GEO v2, 2026-07-21 — cost reduction):**
  - **ChatGPT → direct OpenAI** Responses API + `web_search_preview` tool (existing `OPENAI_API_KEY`).
  - **Claude → direct Anthropic** Messages API + `web_search_20250305` server tool (existing `ANTHROPIC_API_KEY`). Runs LIGHT — **Haiku + `max_uses:1` + `max_tokens:800`** — because direct Sonnet web-search (~10k–35k tokens/call) exhausted the shared Anthropic workspace quota mid-scan (2026-07-21).
  - **Gemini + Perplexity → DataForSEO** `ai_optimization/gemini|perplexity/llm_responses/live` (each requires `model_name`; `web_search:true`).
  - Direct providers cost ~$0.01/query vs ~$0.20/query via DataForSEO. **Gemini is the first engine to disable** (env `GEO_DISABLED_ENGINES=gemini`) — its grounding fee dominates.
  - Mentions still via `ai_optimization/llm_mentions/search/live` + `…/aggregated_metrics/live`.
- **Queries:** from `geo_query_templates` (15-query set). Split by kind:
  - **Market queries** (brand-agnostic, e.g. "best betting sites in {market}") — fetched **once per (market, week, engine)** and SHARED across every brand in the market via `market_intel_cache` (kind `geo:<engine>`). Biggest per-brand cost cut.
  - **Brand queries** (name `{brand}`) — per-brand reputation checks, run **direct providers only**, never cached, never on the pay-per-call DataForSEO engines.
- **Haiku:** per AI response → `{mentioned bool, sentiment, position 1–10, exact quote}`. Compute AI Visibility Score (mentions×50 + sentiment×30 + position×20).
- **EXCLUDED at MVP:** Grok (xAI), Meta/Llama (Together), Copilot. Leave `geo_cache.grok_*`/`meta_ai_*` null.

### 3. AEO  ✓ FULL  → writes `geo_cache` (AEO fields: `featured_snippets`,`paa_appearances`) / `seo_cache`
- **Endpoints:** `serp/google/organic/live/advanced` (featured snippet, PAA, knowledge panel), `on_page/instant_pages` or OnPage **microdata** endpoint (schema markup).
- **Haiku:** classify snippet ownership, summarise schema types per competitor.

### 4. Tech Stack & Ad Network  ✓ FULL  → writes `tech_stack_cache` (+ `competitor_changes` on webhook)
- **Endpoint (CONFIRMED):** `GET https://detectzestack.com/analyze?url={domain}`, header **`X-API-Key: {DETECTZESTACK_API_KEY}`**. Webhook `POST /api/webhooks/detectzestack` (HMAC-SHA256).
  - The API-map's `https://api.detectzestack.com/v1/detect` is **wrong** — that host does not resolve (DNS failure, verified). Always use `detectzestack.com/analyze`.
  - **RapidAPI alternative** (if owner uses the RapidAPI route instead of the direct key): host `https://detectzestack.p.rapidapi.com/analyze?url={domain}`, headers `X-RapidAPI-Key: {key}` + `X-RapidAPI-Host: detectzestack.p.rapidapi.com`.
  - ⚠️ **Pending owner:** a valid key for the chosen route. The currently-stored key returns `401 invalid API key` against the direct endpoint (verified). Owner will confirm direct-vs-RapidAPI + supply a valid key before Sprint 3 Step 18. Does **not** block Sprint 1.
- **Haiku:** none — response is already structured. (Spend-intensity scoring computed in code.)

### 5. App Store  ✓ FULL  → writes `product_intel_cache` / `customer_intel_cache`
- **Endpoints:** `app_data/google/app_reviews/task_post`, `app_data/google/app_info/task_post`, `app_data/apple/app_reviews/task_post`, `app_data/apple/app_info/task_post`; `dataforseo_labs/google/app_competitors/live`, `…/app_keywords/live`.
- **Haiku:** extract complaint themes, sentiment per vertical, new-feature mentions from update notes.

### 6. Customer  ⚠ PARTIAL  → writes `customer_intel_cache`
- **Endpoints:** `dataforseo_labs/google/bulk_traffic_estimation/live` (traffic mix), `content_analysis/search/live` + `content_analysis/sentiment_analysis/live`, `dataforseo_labs/google/domain_intersection/live` (audience overlap), `dataforseo_labs/google/search_intent/live` (intent), App reviews (Module 5).
- **Haiku:** infer demographic/geographic signals, complaint themes, 12-wk sentiment.
- **EXCLUDED:** exact demographics, social sentiment, influencer signals → UI shows "Requires social intelligence — Phase 2". No fake numbers.

### 7. Regulatory  ✓ FULL  → writes `regulatory_cache` (+ `regulatory_documents`,`document_chunks`,`ingestion_logs`)
- **Endpoints:** `serp/google/news/live/advanced` (change detection); ingestion: fetch PDF → R2 → OpenAI `text-embedding-3-small` (1536) → pgvector.
- **Claude:** Sonnet 4.6 verbatim RAG (**≥0.30 cosine noise-floor** — amended 2026-07-20: the original 0.80 rejected every chunk since text-embedding-3-small scores relevant text ~0.3–0.5; TOP_K ranking + Sonnet judgement do the precision filtering; cite document/section/page); Haiku for doc classification + chunk-quality scoring + compliance dimension checks.

### 8. Promotions  ⚠ PARTIAL → "Promotion **Signals**"  → writes `promotions_cache`
- **NO Firecrawl.** **Endpoints:** `content_analysis/search/live` (bonus mentions across NG betting content), `serp/google/news/live/advanced` (promo announcements), App reviews (promo mentions), `keywords_data/google_ads/search_volume/live` (bonus-keyword movement), OnPage Content Parsing (proxy signals).
- **Haiku:** classify promo *type* signals, extract bonus *mentions* (not exact amounts). Leave exact `bonus_amount_kobo`/`wagering_requirement` **null** at MVP; UI tooltip explains.

### 9. Hiring  ⚠ PARTIAL  → writes `hiring_signals_cache`
- **NO Firecrawl.** **Endpoint:** DataForSEO Google **Jobs** SERP (`serp/google/jobs/live/advanced`), query `"[competitor] Lagos Nigeria"` → titles/locations/dates.
- **Haiku:** classify role → signal type; interpret strategic meaning; geographic-expansion signal.

### 10. Social & Ads  ✗ PLACEHOLDER  → (Ad Network section reuses `tech_stack_cache`)
- **NO Apify.** Social tab = "coming soon" copy (no data, no fake). **Ad Network Intelligence** section built from DetectZeStack `tech_stack_cache` (ad networks + spend-intensity). Nothing else.

---

## Asset generation (not a scan module)
- **Text assets:** Claude **Sonnet 4.6** → `generated_assets`. Then **OpenAI Moderation** (`omni-moderation-latest`/`text-moderation-latest`) → set `moderation_flagged`; flagged = hold, not delivered.
- **Visual creative:** **Ideogram** `POST /generate` → image → store in R2 → URL in `generated_assets.content`.

## Chat
- **OpenAI GPT-4.1 Mini** → `chat_messages`; brand context injected server-side from `weekly_cache` + recent `recommendations` + brand profile.

---

## Competitor Tier Detection (onboarding step 10 / "Detect Brand")
Auto-fill competitor **name** and **tier** when a domain is entered.
- **Name:** derive from domain (strip TLD/subdomain, title-case); editable.
- **Tier:** from **DataForSEO bulk traffic estimation** (`dataforseo_labs/google/bulk_traffic_estimation/live`) → estimated monthly visits:
  | Est. monthly visits | Tier |
  |---|---|
  | > 1,000,000 | `dominant` |
  | 100,000 – 1,000,000 | `challenger` |
  | 10,000 – 100,000 | `mid_market` |
  | < 10,000 | `niche` |
- **Default:** if DataForSEO returns no data → `challenger`.
- **Editable:** the user can override the auto-detected tier in onboarding (step 4) and `/admin/competitors`.
- Writes: `competitors.tier` (+ `name`); same heuristic used for the brand's own tier at onboarding.

## Onboarding Setup Agent (onboarding-suggest Edge Function) — owner-approved 2026-07
Territory detection + competitor pre-population for the onboarding wizard.
- **Sources:** the brand's own homepage (plain public `fetch`, wrapped as untrusted data) + **Claude via the model router** (task `onboarding_suggest`, default Sonnet 4.6, fallback Haiku). NO DataForSEO here (runs pre-brand; keep fast/cheap).
- **Output (suggestions only, never persisted by the function):** brand `name`; `markets[]` constrained to the supported African market values (`lib/onboarding/constants.ts` MARKETS — the list of African countries where iGaming is legal/regulated); up to **5** competitors `{domain, name, tier}` — real licensed operators only, model told to omit rather than guess.
- **Auth:** internal — `Bearer CRON_SECRET` **or** `Bearer SUPABASE_SERVICE_ROLE_KEY` (the Next server action holds the service-role key, not CRON_SECRET).
- **UI contract:** suggested markets are pre-selected + highlighted (✦) but fully editable; suggested competitors pre-fill only while all rows are blank; user edits always win.
- **Market → DataForSEO location codes** for ALL supported markets live in `supabase/functions/_shared/dataforseo.ts` `MARKET_LOCATION` (keyed by `brands.market` values) — keep in sync with MARKETS.

## Endpoints used at MVP but NOT detailed in the API map (confirm shapes vs DataForSEO docs at build)
- OnPage microdata / Content Parsing (AEO schema, Promotions proxy)
- `serp/google/jobs` (Hiring)
- Apple App Store `app_data/apple/*` (App Store)
These are valid DataForSEO products; request/response field names to be confirmed against live docs when each module is built (Sprint 3, steps 17/19/22/23).
