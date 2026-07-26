# Data Sources, Fetch & Extraction — reference

_Answers to the product team's architecture questions, verified against the code. Model ids from `_shared/contracts.ts`: `sonnet = claude-sonnet-4-6`, `haiku = claude-haiku-4-5`, `gpt = gpt-4.1-mini`._

---

## Fetch layer

### 1. What retrieves competitor promo pages
**DataForSEO's indexed APIs — not a crawl of the competitor's site, not `fetch()` of their URLs, not a headless browser.** The promotions module (`researcher-promotions/dataforseo-promotions.ts`) hits three endpoints keyed on the competitor's *name*:
- `content_analysis/search/live` — bonus / "free bet" / promo mentions
- `serp/google/news/live/advanced` — promo announcements
- `keywords_data/google_ads/search_volume/live` — bonus-keyword demand (WoW signal)

There is **no generic HTML crawler anywhere** in `_shared/`. All external retrieval is API-based: DataForSEO (web/SERP) + DetectZeStack (tech stack). Firecrawl/Apify are excluded by design and absent from the code. The only competitor URL that appears is a *constructed* `https://<domain>` for provenance — never fetched.

### 2. JS-rendered pages
**Not handled — and not even raw-fetched.** No headless browser, no Playwright, no DataForSEO `enable_javascript` flag. Because retrieval reads DataForSEO's Google-News + content-analysis indexes (keyed on the brand name), **a bonus that lives only on a competitor's landing page — JS-rendered or static — and isn't reflected in indexed news/content is invisible.** This is the main coverage gap of the no-crawler / no-Apify constraint.

---

## Extraction

### 3. Model per module — split by task, cost-driven, runtime-overridable

| Module | Model | Task |
|---|---|---|
| traffic-seo | **Haiku** | structure DataForSEO → cache |
| promotions | **Haiku** | classify offer signals |
| customer | **Haiku** | infer traffic-source / customer intel |
| hiring | **Haiku** | classify job titles |
| app-store | **Haiku** ×2 | review themes + app facts |
| geo-aeo | **gpt-4.1-mini** (ChatGPT probe) + **Haiku** (Claude probe + mention classifier) | probe engines + score mentions |
| **regulatory** | **Sonnet** | compliance scoring, verbatim quotes |
| **synthesis** | **Sonnet ×3** | supervisor + drafter + auditor |
| tech-stack | **none** | DetectZeStack returns structured data |
| _(onboarding)_ | **Sonnet** | competitor detection |

Pattern: **cheap Haiku for high-volume structuring/classification; Sonnet reserved for reasoning that must be right** (compliance, action-plan draft/audit, competitor detection). Routing is task-keyed via `resolveRoute()` reading `model_router_config` — DB-tunable per task without code changes. Hardcoded exceptions: app-store's two extracts and the GEO web-search probe.

### 4. Offer extraction — fixed JSON schema, not freeform
Claude Haiku returns exactly `{has_promo, promo_title, promo_type, is_new, data_quality}`, with `promo_type` a **closed enum** (`welcome_bonus, deposit_bonus, free_bet, cashback, odds_boost, accumulator_bonus, no_deposit_bonus, referral, loyalty, other`). Deliberately **signals-only**: amounts + wagering requirements are hard-nulled and the prompt forbids extracting them.

### 5. Content-hash caching — essentially none for the weekly scan
The gates that control cost:
1. **Skip-if-fresh** per `(brand, scan_week)` — the main gate; a module with this week's cache row isn't dispatched.
2. **`market_intel_cache`** keyed `(market, week, kind)` — brand-agnostic market facts fetched once, shared across all brands in a market.
3. **Regulatory `file_hash`** SHA-256 dedupe — the one true content-hash gate, but on *admin PDF upload*, not the scan.

`evidence_hash` is provenance/integrity only — it never skips work. No per-content-hash cache on scanned pages beyond skip-if-fresh + the market cache.

---

## GEO module (v2)

### 6. The 4 answer engines, and how accessed
Mixed — **direct APIs + DataForSEO, never scraped:**
- **ChatGPT** → OpenAI Responses API direct + `web_search_preview`
- **Claude** → Anthropic Messages direct + `web_search` tool (Haiku, single search)
- **Gemini + Perplexity** → DataForSEO `ai_optimization/<engine>/llm_responses/live`

ChatGPT/Claude moved off DataForSEO in GEO v2 to cut cost; Gemini is the first dial to disable (`GEO_DISABLED_ENGINES`).

### 7. Prompts — fixed panel, not LLM-generated per brand
From the `geo_query_templates` table (curated 15-query set) with `{brand}`/`{market}` injected. Split into:
- **Market queries** (brand-agnostic, e.g. "best betting sites in {market}") — fetched once per `(market, week, engine)` and **shared across every brand in the market** via `market_intel_cache`.
- **Brand queries** (name the brand) — per-brand reputation checks, direct providers only, uncached.

---

## Data sources — real vs placeholder

### 8. Which modules have a real source wired
| Module | Source | Status |
|---|---|---|
| app-store | DataForSEO App Data | **Live, Google Play only.** Apple typed but unimplemented. Guesses Play package id from domain (best-effort discovery). |
| customer | DataForSEO Labs + Content Analysis (traffic mix, mentions, sentiment, overlap proxy, intent) | **Live.** Demographics / geographic / social are **Phase-2, null** (not fabricated). |
| hiring | DataForSEO Google Jobs SERP | **Live, partial** — titles/locations/dates only; no career-page or JD crawl. |
| tech-stack | DetectZeStack API (no LLM) | **Live**, depends on a valid `DETECTZESTACK_API_KEY`; degrades honestly if absent. |

Nothing fabricates — every module degrades to null / `unknown` / partial + a feature-health record.

### 9. R2 RAG for regulatory — corpus & curation
Corpus = **admin-uploaded regulatory PDFs**, curated by the team through the **Knowledge Base admin UI** (upload-only). Pipeline: PDF → Cloudflare R2 → `unpdf` parse → section/page-aware chunking → `text-embedding-3-small` (1536-dim) → `document_chunks`. Scoring: **Sonnet**, 6 compliance dimensions, verbatim quotes; returns **`unknown` (never fabricated)** when a market's corpus is thin.

Caveats to reconcile:
- The **weekly researcher** does similarity search as **cosine-in-TypeScript over candidate chunks at threshold 0.30** — it does **not** use the `match_regulatory_chunks` pgvector RPC (that RPC powers the HQ Agent's knowledge tool).
- An in-scan **auto-discovery ingester** exists but is **stubbed** (writes a `pending-r2://` sentinel, no PDF extraction). Only the **admin-upload path is production-wired**.
- `docs/skills/mvp-module-sources.md §7` still says 0.80 / `match_regulatory_chunks`; code has drifted to 0.30 / TS-cosine.

---

## Competitors

### 10. What populates `brand_competitors` at onboarding
1. User enters the brand domain → `onboarding-suggest` runs **Claude Sonnet as the primary detector**, grounded by (a) the brand's homepage text and (b) DataForSEO SERP results *only when a market is confirmed*. Suggestions are filtered by self-family exclusion + **live DNS/HTTP liveness probes** (drops hallucinated domains). Returns up to **5** editable suggestions; nothing persisted yet.
2. User edits/adds/removes freely (local state).
3. Final submit → `completeOnboarding` upserts each into `competitors` (by `domain`) + a `brand_competitors` link (`priority` = entry order), **capped at 10 (default 5)**, then creates the `scan_jobs` row and kicks `brand-scan`.
4. Post-onboarding, `/admin/competitors` supports add / remove / reorder.

---

## Standing product gaps (distinct from bugs)
- **No JS / landing-page crawl** — offers visible only on a rendered page are missed (§2).
- **Apple App Store** unimplemented (Google Play only).
- **Customer demographics / geographic / social** are Phase-2 (null by design).
- **Tech-stack** needs a valid DetectZeStack key provisioned.
- **Regulatory** auto-discovery ingester is stubbed; only admin-upload is wired. Doc drift on similarity method/threshold.
