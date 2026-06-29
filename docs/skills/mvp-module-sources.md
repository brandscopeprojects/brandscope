# MVP Module Sources — API → Endpoint → Table → Haiku Job

**Check before:** writing any Researcher Edge Function or any external API call in a scan module.
**Purpose:** the MVP-only source map. The API map (doc 6) and agent-arch (doc 7) route several modules through **Firecrawl/Apify** — those are **excluded at MVP**. This file is the replacement map. **Never reach for an excluded provider** (Firecrawl, Apify, xAI, Together, DeepSeek, Kimi, Resend). If a module seems to *need* one → stop and flag.

**MVP providers only:** DataForSEO · DetectZeStack · Claude (Sonnet 4.6 / Haiku 4.5) · OpenAI (GPT-4.1 Mini, embeddings, moderation) · Ideogram · Cloudflare R2 · Supabase.
**DataForSEO base:** `https://api.dataforseo.com/v3/` · Basic auth `btoa(LOGIN:PASSWORD)`.

---

## Module → MVP source map

### 1. SEO  ✓ FULL  → writes `seo_cache` (+ `competitor_profiles`)
- **Endpoints:** `dataforseo_labs/google/bulk_traffic_estimation/live`, `…/domain_intersection/live`, `…/keywords_for_site/live`, `…/competitors_domain/live`, `…/ranked_keywords/live`; `keywords_data/google_ads/search_volume/live`.
- **Haiku:** structure keyword-gap rows, flag significant WoW rank changes. (Mostly already-structured → minimal LLM.)

### 2. GEO  ✓ FULL (4 platforms)  → writes `geo_cache`
- **Endpoints:** `ai_optimization/chat_gpt/llm_responses/task_post` (Standard Queue), `…/claude/llm_responses/task_post`, `…/gemini/llm_responses/task_post`, `…/perplexity/llm_responses/live` (Live only); `ai_optimization/llm_mentions/search/live` + `…/aggregated_metrics/live`. Poll `…/tasks_ready` + `…/task_get/{id}`.
- **Queries:** from `geo_query_templates` (15-query set, brand/market injected).
- **Haiku:** per AI response → `{mentioned bool, sentiment, position 1–10, exact quote}`. Compute AI Visibility Score (mentions×50 + sentiment×30 + position×20).
- **EXCLUDED at MVP:** Grok (xAI), Meta/Llama (Together), Copilot. Leave `geo_cache.grok_*`/`meta_ai_*` null.

### 3. AEO  ✓ FULL  → writes `geo_cache` (AEO fields: `featured_snippets`,`paa_appearances`) / `seo_cache`
- **Endpoints:** `serp/google/organic/live/advanced` (featured snippet, PAA, knowledge panel), `on_page/instant_pages` or OnPage **microdata** endpoint (schema markup).
- **Haiku:** classify snippet ownership, summarise schema types per competitor.

### 4. Tech Stack & Ad Network  ✓ FULL  → writes `tech_stack_cache` (+ `competitor_changes` on webhook)
- **Endpoint:** DetectZeStack `GET https://api.detectzestack.com/v1/detect?url={domain}`, header **`X-API-Key`**. Webhook `POST /api/webhooks/detectzestack` (HMAC-SHA256).
- **Haiku:** none — response is already structured. (Spend-intensity scoring computed in code.)
- ⚠️ Re-verify the key against `/v1/detect` (earlier 401 was against `/analyze`).

### 5. App Store  ✓ FULL  → writes `product_intel_cache` / `customer_intel_cache`
- **Endpoints:** `app_data/google/app_reviews/task_post`, `app_data/google/app_info/task_post`, `app_data/apple/app_reviews/task_post`, `app_data/apple/app_info/task_post`; `dataforseo_labs/google/app_competitors/live`, `…/app_keywords/live`.
- **Haiku:** extract complaint themes, sentiment per vertical, new-feature mentions from update notes.

### 6. Customer  ⚠ PARTIAL  → writes `customer_intel_cache`
- **Endpoints:** `dataforseo_labs/google/bulk_traffic_estimation/live` (traffic mix), `content_analysis/search/live` + `content_analysis/sentiment_analysis/live`, `dataforseo_labs/google/domain_intersection/live` (audience overlap), `dataforseo_labs/google/search_intent/live` (intent), App reviews (Module 5).
- **Haiku:** infer demographic/geographic signals, complaint themes, 12-wk sentiment.
- **EXCLUDED:** exact demographics, social sentiment, influencer signals → UI shows "Requires social intelligence — Phase 2". No fake numbers.

### 7. Regulatory  ✓ FULL  → writes `regulatory_cache` (+ `regulatory_documents`,`document_chunks`,`ingestion_logs`)
- **Endpoints:** `serp/google/news/live/advanced` (change detection); ingestion: fetch PDF → R2 → OpenAI `text-embedding-3-small` (1536) → pgvector.
- **Claude:** Sonnet 4.6 verbatim RAG (≥0.80 similarity gate, cite document/section/page); Haiku for doc classification + chunk-quality scoring + compliance dimension checks.

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

## Endpoints used at MVP but NOT detailed in the API map (confirm shapes vs DataForSEO docs at build)
- OnPage microdata / Content Parsing (AEO schema, Promotions proxy)
- `serp/google/jobs` (Hiring)
- Apple App Store `app_data/apple/*` (App Store)
These are valid DataForSEO products; request/response field names to be confirmed against live docs when each module is built (Sprint 3, steps 17/19/22/23).
