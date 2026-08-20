# Brandscope — Complete Architecture Blueprint

**Version:** 2.0 (Post-AI Agent Refactor)  
**Last Updated:** 2026-08-20  
**Status:** Active Deployment

---

## Executive Summary

Brandscope is an **AI-powered competitive intelligence and marketing operations system** for iGaming brands across Nigeria, Kenya, and South Africa.

**Core Value:** Weekly automated intelligence scan + actionable plan + pre-generated assets, eliminating manual competitor research.

**Key Insight:** Data fetching (pure APIs) is separate from intelligence generation (AI analysis). Both run on independent pipelines for resilience.

---

## 1. System Overview

### 1.1 What Brandscope Does

```
User onboards brand
        ↓
System auto-discovers geography & competitors
        ↓
Weekly (Monday) or manual scan triggers
        ↓
[DATA LAYER] Fetch raw competitor data from 7 external APIs
        ↓
[CACHE LAYER] Store in Postgres cache tables
        ↓
[DISPLAY LAYER] Dashboard shows real-time metrics during scan
        ↓
[AI LAYER] Generate insights, recommendations, assets
        ↓
[ACTION LAYER] User reviews plan, executes recommendations
```

### 1.2 Architecture Layers

| Layer | Purpose | Technology | Trigger |
|---|---|---|---|
| **Data Layer** | Fetch raw API data | DataForSEO, Firecrawl, Apify, DetectZeStack | Scan orchestrator |
| **Cache Layer** | Store raw data | Supabase Postgres + realtime | Data fetchers write |
| **Display Layer** | Show metrics during scan | Next.js + Supabase Realtime | Cache writes publish |
| **AI Layer** | Generate insights & assets | Anthropic + OpenAI | After data exists |
| **Action Layer** | Execute on recommendations | Next.js UI + backend actions | User triggers |

---

## 2. Frontend (Next.js)

### 2.1 Main Routes

```
/login                 → Demo sign-in (demoSignIn action)
/onboarding           → Brand + competitor setup (4 steps)
/dashboard            → Main intelligence hub
  ├─ Portfolio        → Brand overview + competitor matrix
  ├─ Intelligence     → 8 module sections (real-time during scan)
  │  ├─ Market Intel
  │  ├─ Traffic & SEO
  │  ├─ Tech Stack
  │  ├─ Promotions
  │  ├─ Customers
  │  ├─ Regulatory
  │  ├─ Hiring & Signals
  │  └─ Social & Ads
  ├─ Action Plan       → Weekly recommendations ranked by impact
  ├─ Assets            → Pre-generated creative (copy, images, specs)
  ├─ Reports           → Historical trends and exports
  └─ Brand Chat        → Q&A over brand's own data (RAG)
/admin                 → Admin controls
  ├─ Brand Settings    → Preferences, API keys
  ├─ Competitors       → Add/remove/reorder
  ├─ Alerts            → Threshold notifications
  └─ Billing           → Usage and payments
```

### 2.2 Real-Time Architecture

**During Scan (Status = "running"):**
1. `ModuleStreamingView` renders 8 sections in a grid
2. Each section calls `useRealtimeCacheSubscription(tableName, brandId, scanWeek)`
3. Hook makes **initial REST query** (GET rows from cache table)
4. Hook **subscribes to postgres_changes** (Realtime on that table)
5. As fetchers write → Realtime delivers updates → sections re-render live

**After Scan (Status = "completed"):**
1. `DashboardView` loads final cache data + AI-generated plan
2. Realtime subscriptions close (data is final)

**Key Components:**
- `ModuleStreamingView.tsx` — 8-section grid during scan
- `ModuleSections.tsx` — SeoSection, GeoSection, etc. (each uses realtime hook)
- `useRealtimeCacheSubscription.ts` — Realtime subscription + RLS enforcement
- Realtime publication: 9 cache tables + REPLICA IDENTITY FULL

### 2.3 Authentication & Authorization

- **Auth provider:** Supabase Auth (email + password or demo login)
- **Multi-tenant isolation:** RLS policies on every table
  - Brands scoped by `brand_id`
  - Users scoped to their `get_user_brand_ids()` (org membership)
  - Competitors scoped by `brand_id` (except self-competitor, keyed by domain)
- **Demo mode:** `demoSignIn()` creates pre-confirmed accounts (gated to demo env only)

---

## 3. Backend Architecture

### 3.1 Data Model (Core Tables)

```sql
-- Multi-tenant structure
organisations
  ├─ organisation_members (users + roles)
  ├─ brands (name, domain, market, tier, industry)
  │  ├─ brand_preferences (module toggles, LLM model prefs)
  │  ├─ brand_competitors (competitor_id + priority)
  │  └─ scan_jobs (orchestration state machine)
  │     ├─ id, status, scan_week, expected_modules, completed_steps
  │     ├─ progress_percentage, synthesis_enqueued
  │     └─ error_message, completed_at
  └─ competitors (domain-keyed, shared across brands)

-- 9 Cache Tables (1 row per competitor per week per module)
seo_cache                    (brand_id, competitor_id, scan_week, +40 columns)
geo_cache                    (brand_id, competitor_id, scan_week, +30 columns)
tech_stack_cache             (competitor_id, scan_week, no brand_id, +25 columns)
product_intel_cache          (brand_id, competitor_id, scan_week, +20 columns)
customer_intel_cache         (brand_id, competitor_id, scan_week, +20 columns)
regulatory_cache             (brand_id, competitor_id, scan_week, +25 columns)
promotions_cache             (brand_id, competitor_id, scan_week, +20 columns)
hiring_signals_cache         (brand_id, competitor_id, scan_week, +15 columns)
weekly_cache                 (brand_id, scan_week, weekly rollup)

-- Intelligence Output
recommendations               (scan_job_id, rank, title, impact_score, evidence_url)
action_plans                 (scan_job_id, status, created_at, user_feedback)
creative_assets              (recommendation_id, type, title, spec, image_url)

-- Admin + Observability
agents                       (name, status, config.disabled_modules)
agent_job_logs               (scan_job_id, agent, task, tokens, cost)
provider_spend               (brand_id, provider, date, amount_usd, operation_count)
dead_letter_queue            (task_type, payload, failure_reason, last_error)
feature_health               (scan_job_id, feature_category, status, root_cause)
```

### 3.2 Scan Orchestration State Machine

**Trigger:** Manual "Scan now" button or weekly cron (Monday)

```
1. scanBrand() [server action]
   └─ POST to brand-scan edge function

2. brand-scan [orchestrator]
   ├─ Load scan_job (validate status)
   ├─ Load brand + preferences + competitors
   ├─ Check weekly dedup (skip if already scanned this week)
   ├─ Check kill switches (agents.status)
   ├─ Compute enabled modules (from brand_preferences)
   ├─ Check fresh cache (SKIP-IF-FRESH: cost control)
   ├─ toRun = modules - freshModules
   ├─ Check spend cap (DataForSEO balance floor + daily budget)
   ├─ Check LLM spend cap (Anthropic + OpenAI daily limits)
   ├─ Set scan_jobs.status = "running", expected_modules = toRun, progress = 0
   ├─ For each task in toRun:
   │  ├─ enqueueModule(msg) → pgmq queue [durable recovery]
   │  └─ invokeFunction(researcher) → HTTP POST [direct invoke]
   └─ Return immediately (researchers drive completion)

3. Each researcher [parallel, max 90s budget]
   ├─ Receive POST from brand-scan (direct invoke)
   ├─ Fall back to pgmq queue on direct invoke failure [6-hourly monitor]
   ├─ Fetch raw data from APIs (DataForSEO, Firecrawl, Apify, etc.)
   ├─ Write to cache table (UPSERT by brand_id, competitor_id, scan_week)
   ├─ Call completeModule(scan_job_id, task_name, outcome)
   └─ Return response

4. app_scan_complete_module RPC [atomic, migration 24]
   ├─ UPDATE scan_jobs: append task to completed_steps
   ├─ UPDATE scan_jobs: progress = (terminal_modules / expected_modules) * 100
   ├─ If all expected modules in terminal state (completed OR failed OR partial):
   │  └─ Set synthesis_enqueued = true
   │     └─ Invoke synthesis-draft-audit edge function
   └─ RETURN true if synthesis triggered, false otherwise

5. synthesis-draft-audit [called when ALL modules terminal]
   ├─ Read all 9 cache tables (partial read OK if some modules failed)
   ├─ Call LLM to generate:
   │  ├─ 4–8 ranked recommendations
   │  ├─ Evidence URLs per recommendation
   │  └─ Pre-generated creative assets
   ├─ UPSERT recommendations + action_plans + creative_assets
   └─ Set scan_jobs.status = "completed"

6. Dashboard [real-time]
   ├─ During step 2–4: shows ModuleStreamingView
   │  └─ Realtime subscriptions deliver cache rows as they're written
   └─ After step 5: shows DashboardView (final plan + assets)
```

---

## 4. Data Fetching Layer (API Integrations)

### 4.1 Data Sources by Section

| Section | API | Endpoint | Data Fetched | Storage |
|---|---|---|---|---|
| **Traffic & SEO** | DataForSEO | `/serp/google/organic/live` + `/domain_analytics/historical/rank` | Rankings, traffic volume, WoW change | `seo_cache` |
| **Tech Stack** | DetectZeStack | Webhook (async callback) | Tech tools, frameworks, hosting | `tech_stack_cache` |
| **Promotions** | Firecrawl | `/v2/scrape` | Homepage + promo pages markdown | `promotions_cache` (raw_data) |
| **Promotions (signals)** | DataForSEO | `/news/search/live` + `/domain_analytics/getting_started/live` | Bonus mentions, promo keywords | `promotions_cache` (synthesis) |
| **Hiring & Signals** | DataForSEO | `/jobs/search/live` | Open job postings by title/location | `hiring_signals_cache` |
| **Customers** | Apify | Actors for review scraping | Customer reviews, sentiment signals | `customer_intel_cache` |
| **Customers (backlinks)** | DataForSEO | `/backlinks/domain_getting_started/live` | Brand mentions, referring domains | `customer_intel_cache` (raw_data) |
| **Regulatory** | Cloudflare RAG | Retrieve uploaded country legality docs | Compliance rules per market | `regulatory_cache` (+ RAG retrieval) |
| **Social & Ads** | Apify | Ad library + social media actors | Ad creatives, spend trends | (Future: `social_ads_cache`) |
| **Market Intel / GEO/AEO** | OpenAI + Anthropic | LLM queries (ChatGPT, Claude) | AI answer engine visibility | `geo_cache` (synthesis only) |

### 4.2 API Call Pattern (Data Fetchers)

```typescript
// Example: traffic_seo data fetcher (simplified)
async function fetchTrafficSeoData(competitors, scanWeek, brandId) {
  for (const competitor of competitors) {
    try {
      // 1. Call DataForSEO
      const traffic = await dataforeseoApi.serp.googleOrganic({
        domain: competitor.domain,
        location_code: getLocationCode(brand.markets),
      });
      
      // 2. Process raw data
      const cached = {
        brand_id: brandId,
        competitor_id: competitor.id,
        scan_week: scanWeek,
        estimated_traffic: traffic.estimated_traffic,
        domain_authority: traffic.authority_score,
        raw_data: traffic, // store everything
      };
      
      // 3. Write to cache (UPSERT)
      await supabase
        .from("seo_cache")
        .upsert(cached, { onConflict: "brand_id,competitor_id,scan_week" });
      
      // 4. ALWAYS call completeModule (regardless of result)
      await completeModule(scanJobId, "traffic_seo", "ok");
      
    } catch (err) {
      // Log to DLQ, but still call completeModule with "failed"
      await toDeadLetter({ task: "traffic_seo", error: err.message });
      await completeModule(scanJobId, "traffic_seo", "failed");
    }
  }
}
```

**Key Principle:** 
- Fetcher writes raw data to cache (even if incomplete)
- Fetcher ALWAYS calls `completeModule()` (success, partial, or failed)
- AI layer reads cached data and generates insights (separate, async)

---

## 5. Cache & Real-Time Architecture

### 5.1 Cache Table Design

Each cache table stores:
- **Key columns:** `brand_id`, `competitor_id`, `scan_week`
- **Data columns:** Raw API response flattened (40–50 per table)
- **Metadata columns:** `scraped_at`, `raw_data` (JSON blob), `synthesis_summary`
- **REPLICA IDENTITY FULL:** Required for Supabase Realtime WAL decoding

**Example: seo_cache**
```sql
CREATE TABLE seo_cache (
  id uuid PRIMARY KEY,
  brand_id uuid NOT NULL REFERENCES brands(id),
  competitor_id uuid NOT NULL REFERENCES competitors(id),
  scan_week date NOT NULL,
  
  -- Data columns
  estimated_traffic bigint,
  domain_authority smallint,
  rank_top_10_count int,
  rank_top_100_count int,
  wow_traffic_change_pct decimal,
  
  -- Metadata
  raw_data jsonb, -- entire DataForSEO response
  synthesis_summary text, -- AI-generated insight
  scraped_at timestamptz,
  
  UNIQUE(brand_id, competitor_id, scan_week),
  CHECK (scan_week = date_trunc('week', scan_week)::date) -- Monday only
);

ALTER TABLE seo_cache REPLICA IDENTITY FULL;
```

### 5.2 Real-Time Subscription Flow

**Frontend (React hook):**
```typescript
function useRealtimeCacheSubscription({
  tableName,        // "seo_cache", "geo_cache", etc.
  brandId,          // User's brand
  scanWeek,         // Current week
  competitorId,     // Filter to 1 competitor (optional)
}) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Step 1: Initial REST query (fetch existing cache)
    const { data: rows } = await supabase
      .from(tableName)
      .select("*")
      .eq("brand_id", brandId)
      .eq("scan_week", scanWeek);
    
    // Take first relevant row
    const seed = rows?.find(r => !competitorId || r.competitor_id === competitorId);
    setData(seed || null);
    setIsLoading(false);

    // Step 2: Subscribe to realtime (single valid predicate)
    const channel = supabase
      .channel(`${tableName}:${brandId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: tableName,
          filter: `brand_id=eq.${brandId}`, // Single predicate only
        },
        (payload) => {
          // Step 3: Client-side filtering (scan_week, competitor_id)
          const row = payload.new;
          if (row.scan_week === scanWeek && 
              (!competitorId || row.competitor_id === competitorId)) {
            setData(row); // Update UI live
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [tableName, brandId, scanWeek, competitorId]);

  return { data, isLoading, error };
}
```

**Realtime Publication:**
```sql
-- Enable realtime on all 9 cache tables (migration 25)
ALTER PUBLICATION supabase_realtime ADD TABLE
  seo_cache,
  geo_cache,
  tech_stack_cache,
  product_intel_cache,
  customer_intel_cache,
  regulatory_cache,
  promotions_cache,
  hiring_signals_cache,
  weekly_cache;
```

---

## 6. AI Analysis Layer (Synthesis)

### 6.1 Intelligence Generation

**Trigger:** When `app_scan_complete_module` detects all modules terminal (lines 44-49)

**Flow:**
```
synthesis-draft-audit edge function
  ├─ Read seo_cache (traffic, rankings, WoW)
  ├─ Read geo_cache (AI visibility score)
  ├─ Read promotions_cache (competitor promo campaigns)
  ├─ Read hiring_signals_cache (job postings, growth signals)
  ├─ Read regulatory_cache (compliance risk)
  ├─ Read tech_stack_cache (platform/tech changes)
  ├─ Read customer_intel_cache (brand mentions, sentiment)
  ├─ [ALL READS CONCURRENT] Promise.allSettled
  ├─ Anthropic LLM call:
  │  └─ Prompt: "Generate 4–8 ranked recommendations based on this data"
  │     - Evidence: "Traffic up 15% WoW, tech stack changed, 3 new job posts"
  │     - Action: "Launch a paid search campaign targeting X keywords"
  │     - Priority: High (Based on WoW + threat analysis)
  ├─ UPSERT recommendations + action_plans
  └─ Return response (dashboard loads final UI)
```

### 6.2 Asset Generation

For each recommendation, Anthropic generates:
- **Copy:** Ad headline, body, CTA
- **Creative specs:** Dimensions, brand colors, legal disclaimers
- **Images:** Brief for designer (stored as `image_url` + specs)
- **Evidence:** Direct link to source URL (e.g., competitor's domain)

**Storage:** `creative_assets` table, linked to recommendations

---

## 7. Backoffice & Admin

### 7.1 Admin Routes (`/admin`)

| Route | Purpose | Who | What They Control |
|---|---|---|---|
| **Brand Settings** | Config | Brand owner | Module toggles, preferred LLM, alert thresholds |
| **Competitors** | Manage | Brand owner | Add/remove/reorder competitors (max 10) |
| **Alerts** | Threshold rules | Brand owner | "Notify if traffic < X% or WoW > Y%" |
| **Billing** | Usage + payment | Org owner | View spend, set daily caps, payment method |
| **Internal Admin** (hidden) | System health | Brandscope team | Agent kill switches, feature toggles, DLQ |

### 7.2 Feature Health & Kill Switches

**Kill Switch Mechanism (agents table):**
```sql
INSERT INTO agents (name, status, config) VALUES
  ('supervisor', 'active', null),        -- Master pause (blocks all scans)
  ('researcher', 'active', '{
    "disabled_modules": []                -- Pause individual modules
  }'),
  ('model_router', 'active', '{
    "llm_for_synthesis": "anthropic"
  }');
```

**In brand-scan (lines 219-243):**
```typescript
if (supervisor.status === 'inactive') {
  // Kill switch: ALL scans fail-fast
  setScanStatus(scanJobId, 'failed', 'paused by supervisor');
  return;
}

if (researcher.config.disabled_modules?.includes('geo_aeo')) {
  // Module kill switch: skip geo_aeo
  modules = modules.filter(m => m !== 'geo_aeo');
}
```

### 7.3 Cost Governance

**Budget enforcement (spend.ts):**
```typescript
async function checkBudget(sb, { organisationId, liveBalance }) {
  // 1. Fetch provider_budget_config (daily cap + balance floor)
  const config = await sb
    .from('provider_budget_config')
    .select('*')
    .eq('organisation_id', organisationId)
    .single();
  
  // 2. Fetch provider_spend for today
  const { data: spent } = await sb
    .from('provider_spend')
    .select('amount_usd')
    .eq('organisation_id', organisationId)
    .eq('date', today())
    .single();
  
  // 3. Check both gates
  if (liveBalance < config.balance_floor_usd) {
    return { allowed: false, reason: `Balance $${liveBalance} < floor $${config.balance_floor_usd}` };
  }
  if (spent.amount_usd + SCAN_COST_ESTIMATE > config.daily_cap_usd) {
    return { allowed: false, reason: `Daily cap reached` };
  }
  
  return { allowed: true };
}
```

**Triggers scan failure at brand-scan line 305-330 if budget violated.**

### 7.4 Observability

**feature_health table (every module, every scan):**
```sql
INSERT INTO feature_health (
  scan_job_id, brand_id, scan_week,
  feature_category,     -- 'traffic_seo', 'promotions', etc.
  status,               -- 'healthy', 'degraded', 'down'
  root_cause,           -- null or error message
  resolution_suggested
) VALUES (...)
```

**Agent traces (agent_job_logs):**
```sql
-- Every LLM call for every recommendation
INSERT INTO agent_job_logs (
  scan_job_id, agent, task,
  input_tokens, output_tokens, total_cost_usd
) VALUES (...)
```

---

## 8. External API Integrations

### 8.1 DataForSEO

**Auth:** Basic Auth (login:password in DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD)

**Endpoints used:**
- `/v3/serp/google/organic/live` — Rankings
- `/v3/domain_analytics/rank_tracker/live` — WoW tracking
- `/v3/backlinks/domain_getting_started/live` — Backlinks, brand mentions
- `/v3/jobs/search/live` — Job postings
- `/v3/news/search/live` — News articles, press
- `/v3/domain_analytics/getting_started/live` — Domain authority, traffic

**Cost model:**
- ~$0.10–$0.20 per API call
- Rate limits: 100 req/min per account
- Balance floor enforced at $4 (prevents depleting trial credit)

**Fallback:** If balance < floor, scan marked `failed` (not retried)

### 8.2 Firecrawl

**Auth:** Bearer token (FIRECRAWL_API_KEY in Vault)

**Endpoint:** `POST https://api.firecrawl.dev/v2/scrape`

**Used for:** Promotions researcher
- Scrapes competitor homepage
- Extracts promo links and deep-scrapes promo page
- Returns markdown of main content

**Cost:** ~$0.001 per scrape (credit-based)

**Fallback:** If key missing or API fails, researcher degrades to DataForSEO signals only (no hard failure)

### 8.3 Apify

**Auth:** Token in APIFY_TOKEN (Vault)

**Actors used:**
- Review scraping (customer sentiment)
- Social media monitoring (Social & Ads section)
- Ad library monitoring (competitive ad spend)

**Cost:** Per-actor; typically $2–$5 per run

**Status:** Integrated for customer intel + social ads (phases 1–2)

### 8.4 DetectZeStack

**Auth:** API key (DETECTZESTACK_API_KEY in Vault)

**Integration:** Webhook-based (asynchronous)
- Brand scan requests domain analysis
- DetectZeStack webhook calls back with results
- Results stored in `tech_stack_cache`

**Cost:** ~$0.50 per domain scan

**Fallback:** If webhook doesn't fire, researcher waits/times out (falls back to pgmq retry)

### 8.5 LLM APIs

**Anthropic (Claude):**
- Models: Claude Sonnet 4.6 (synthesis), Claude Haiku (classification)
- Endpoints: Messages API (streaming)
- Cost: ~$0.10–$0.50 per synthesis (8 modules, 1000 tokens)
- Used for: Recommendation generation, asset creation, prompt caching

**OpenAI (GPT):**
- Models: GPT-4.1 (synthesis), GPT-4.1 Mini (classification)
- Endpoints: Chat Completions (streaming)
- Cost: ~$0.15–$0.60 per synthesis
- Used for: GEO/AEO (ChatGPT answer engine visibility queries)

**Cost gates:**
- Daily cap per provider per org (configured in `provider_budget_config`)
- Spend tracked in `provider_spend` table
- Scan fails if cap exceeded (checked before researchers invoked)

### 8.6 Cloudflare

**R2 (Object Storage):**
- Stores generated creative assets (images, PDFs)
- Signed URLs for frontend display
- Cost: ~$0.015 per GB stored

**Workers KV / Durable Objects:**
- Optionally: Cache market queries (for cost reduction)
- Not MVP critical

**RAG (Regulatory Data):**
- Uploaded country-by-country legality documents (licensing, responsible gambling, etc.)
- Retrieval-augmented generation: regulatory researcher queries RAG for relevant rules
- Storage: Cloudflare's built-in vector DB or external Pinecone

---

## 9. Data Flow Diagrams

### 9.1 Scan Initiation Flow

```
┌─ User taps "Scan now" (Dashboard)
│
├─ scanBrand() server action
│  └─ POST /api/brand-scan { scan_job_id, brand_id }
│
├─ brand-scan edge function (Supabase)
│  ├─ Validate scan_job (status pending)
│  ├─ Load brand + preferences + competitors
│  ├─ Check weekly dedup (skip if already scanned)
│  ├─ Compute toRun = enabledModules - freshModules
│  ├─ Verify spend cap (DataForSEO + LLM)
│  ├─ Set scan_jobs.status = "running", expected_modules = toRun
│  └─ For each module in toRun:
│     ├─ enqueueModule(msg) → pgmq [recovery path]
│     └─ invokeFunction(researcher) → HTTP POST [direct invoke]
│
└─ Return immediately (researchers run async)
```

### 9.2 Real-Time Data Display Flow

```
┌─ Dashboard loads (status = "running")
│
├─ Renders ModuleStreamingView (8 grid items)
│
├─ Each section initializes useRealtimeCacheSubscription
│  ├─ Step 1: SELECT from cache_table (REST query)
│  │  └─ Sets initial data + isLoading=false
│  └─ Step 2: Subscribe to postgres_changes (Realtime)
│     └─ Listen for INSERT/UPDATE on that cache table
│
├─ Fetchers write to cache tables
│  └─ Triggers postgres_changes event
│
├─ Realtime sends event to subscribers
│  └─ Hook receives payload.new
│
├─ UI re-renders with new data (no loading spinner)
│
└─ User sees data populate live as fetchers complete
```

### 9.3 Synthesis Trigger Flow

```
┌─ Researcher calls completeModule(scan_job_id, task, outcome)
│
├─ RPC app_scan_complete_module (atomic)
│  ├─ UPDATE scan_jobs: completed_steps += task
│  ├─ UPDATE scan_jobs: progress = (completed / expected) * 100
│  └─ IF all expected modules in terminal state:
│     └─ SET synthesis_enqueued = true
│        └─ RETURN true
│
├─ If returned true (only first to complete all):
│  ├─ Researcher enqueues synthesis-draft-audit
│  └─ Researcher invokes synthesis-draft-audit HTTP
│
├─ synthesis-draft-audit edge function
│  ├─ Read all 9 cache tables
│  ├─ Call Anthropic LLM
│  ├─ Generate 4–8 recommendations + assets
│  ├─ UPSERT recommendations, action_plans, creative_assets
│  └─ SET scan_jobs.status = "completed"
│
└─ Dashboard detects status change → Shows final plan
```

---

## 10. Error Handling & Recovery

### 10.1 Researcher Failures

**Level 1: Direct invoke fails (network)**
- invokeFunction() swallows error (fire-and-forget pattern)
- Message already in pgmq queue (enqueued at brand-scan)
- 6-hourly monitor drains pgmq, re-invokes researchers

**Level 2: Researcher times out (>90s)**
- Researcher killed at 90s budget
- Never reaches completeModule call
- Scan stuck at "running" (needs manual intervention or monitor recovery)

**Level 3: Researcher errors before cache write**
- Researcher catches error in try/catch
- Calls completeModule with outcome="failed"
- Synthesis still triggers (other modules may have succeeded)
- Dashboard shows partial data (graceful degradation)

**Level 4: Synthesis fails**
- plan never generated
- Scan marked "completed" but with error_message
- Dashboard shows raw cache data (no recommendations)

### 10.2 Dead Letter Queue (DLQ)

```sql
INSERT INTO dead_letter_queue (
  task_type,         -- 'researcher-geo_aeo', 'synthesis', etc.
  payload,           -- Original message
  brand_id,
  scan_job_id,
  failure_reason,    -- "API timeout", "OOM", etc.
  last_error
) VALUES (...)
```

**6-hourly monitor:**
1. Query DLQ for tasks created in last 6 hours
2. Retry researcher or synthesis
3. Log outcome back to feature_health

---

## 11. Security Model

### 11.1 Row-Level Security (RLS)

**Every sensitive table has RLS enabled:**

```sql
-- seo_cache example
ALTER TABLE seo_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_sees_own_brand_cache
  ON seo_cache FOR SELECT
  USING (brand_id IN (SELECT get_user_brand_ids()));

CREATE POLICY service_write_cache
  ON seo_cache FOR INSERT/UPDATE/DELETE
  USING (true);  -- Service role only (enforced via GRANT)
```

**Policy: Users can only query their org's brands**

```typescript
function get_user_brand_ids() returns uuid[] {
  -- Returns array of brand_ids for signed-in user's organisation
  SELECT array_agg(brand_id)
  FROM brands
  WHERE organisation_id = (auth.uid()).organisation_id;
}
```

### 11.2 API Key Security

- All API keys stored in **Supabase Vault** (encrypted at rest)
- Edge Functions read via `requireEnv()` (not exposed to client)
- Never logged or sent to third parties
- Rotated monthly

### 11.3 Demo Mode Gating

```typescript
// app/login/actions.ts
async function demoSignIn(email: string, password: string) {
  if (process.env.DEMO_ACCESS_ENABLED !== "true") {
    return { error: "Demo sign-in disabled" };
  }
  
  // Only allow hardcoded demo password
  if (password !== process.env.DEMO_ACCESS_PASSWORD) {
    return { error: "Invalid credentials" };
  }
  
  // Create account with service role (no email confirmation needed)
  // ... sign in
}
```

**Production:** DEMO_ACCESS_ENABLED=false (demo path disabled)

---

## 12. Deployment Architecture

### 12.1 Frontend (Vercel)

- **Repository:** GitHub (brandscopeprojects/brandscope)
- **Auto-deploy:** main branch → vercel.app
- **Environment variables:**
  - NEXT_PUBLIC_SUPABASE_URL (public)
  - NEXT_PUBLIC_SUPABASE_ANON_KEY (public, RLS enforced)
  - SUPABASE_SERVICE_ROLE_KEY (server-only, API routes)
  - OPENAI_API_KEY, ANTHROPIC_API_KEY (for HQ agent)
- **Build:** `npm run build` (TypeScript strict mode)

### 12.2 Backend (Supabase)

- **Postgres:** Hosted, 25+ tables, 9 cache tables with Realtime
- **Realtime:** Subscription via WebSocket (clients poll for changes)
- **Edge Functions:**
  - brand-scan (orchestrator)
  - researcher-* (8 modules)
  - synthesis-draft-audit (recommendations)
  - webhooks (DetectZeStack callback, brand webhooks)
- **Auth:** Email + password (demo login in dev)
- **Database:** Automated backups, RLS enforced on all tables

### 12.3 Data Processing (pgmq Queue)

- **Queue:** PostgreSQL-backed, transactional
- **Workers:** Edge Functions poll queue (on invoke)
- **DLQ:** Automatic retry after max failures
- **Monitor:** 6-hourly cron to retry stuck messages

---

## 13. Performance & Monitoring

### 13.1 Scan Duration Targets

| Stage | Target | Actual |
|---|---|---|
| brand-scan orchestrator | <1s | ~200ms |
| 8 researchers parallel | <90s | 60–80s (with cold starts) |
| synthesis-draft-audit | <30s | 15–25s (LLM time) |
| **Total** | **<150s** | **75–130s** |

### 13.2 RealTime Update Latency

- Cache write → Postgres WAL → Realtime decode → WebSocket push: **<500ms**
- UI re-render after receipt: **<100ms**
- **Total:** <1s from write to display

### 13.3 Cost Per Scan

| Provider | Calls | Cost | Notes |
|---|---|---|---|
| DataForSEO | 60–80 | $6–$12 | 5 competitors, multi-endpoint |
| Firecrawl | 5–10 | $0.01 | Homepage + promo pages per competitor |
| LLM (Anthropic) | 1 | $0.20–$0.50 | Synthesis call, cached prompts |
| Apify | 5 | $2.50 | Customer + social (if enabled) |
| **Total** | | **$9–$15** | Per scan, per brand |

**Monthly:** 1 scan/week × 4 weeks × 10 brands = ~$360–$600

---

## 14. Operational Runbook

### 14.1 Scan Stuck at "running"

1. Check `scan_jobs.completed_steps` — if empty, no researchers completed
2. Check `feature_health` — see which modules are "down"
3. Options:
   - **Manual recovery:** Manually set `completed_steps = all 8`, trigger synthesis
   - **Kill switch:** Set `agents.researcher.status = "inactive"` to mark bad state
   - **Retry:** Invoke brand-scan again with force_refresh=true

### 14.2 Synthesis Never Triggers

1. Verify `app_scan_complete_module` RPC was called (check `completed_steps`)
2. If `completed_steps` empty: researchers not reaching completeModule
3. If `completed_steps` partial: not all modules called RPC
4. Manual: Call RPC directly with all 8 modules to trigger synthesis

### 14.3 Realtime Not Updating

1. Verify `supabase_realtime` publication exists: `SELECT * FROM pg_publication_tables WHERE pubname='supabase_realtime'`
2. Verify cache table has REPLICA IDENTITY FULL: `SELECT relreplident FROM pg_class WHERE relname='seo_cache'`
3. Check browser console for WebSocket errors
4. Verify RLS policy allows authenticated users: `SELECT * FROM auth.users WHERE id = auth.uid()`

### 14.4 High Scan Costs

1. Check `provider_spend` table for unusual activity
2. Check `agent_job_logs` for expensive LLM calls
3. Reduce daily_cap_usd or balance_floor_usd in `provider_budget_config`
4. Disable expensive modules (geo_aeo, social_ads) via kill switch

---

## 15. Future Enhancements (Post-MVP)

- **Weekly digest emails** (Resend)
- **Slack integration** (alerts + action plan delivery)
- **Video asset generation** (Ideogram)
- **Multi-brand org views** (reporting dashboard)
- **Custom KPI dashboards** (brand-specific metrics)
- **Competitor price tracking** (custom integrations)
- **Automated action execution** (e.g., auto-launch campaigns)

---

## Appendix: Key Files Map

```
/app                          — Next.js frontend
  /login                      — Authentication
  /onboarding                 — Brand + competitor setup
  /(app)                      — Authenticated routes
    /dashboard                — Main dashboard
    /intelligence/[section]   — Per-module pages
    /admin                    — Admin controls
/lib
  /auth.ts                    — User context + RLS
  /data/                      — Server-side API queries
  /hooks/
    /useRealtimeCacheSubscription.ts  — Real-time updates
  /supabase/
    /client.ts, /server.ts    — Supabase clients
/components                   — Reusable UI
  /dashboard/
    /ModuleStreamingView.tsx  — 8-section grid during scan
    /ModuleSections.tsx       — SeoSection, GeoSection, etc.
/supabase
  /functions                  — Edge Functions (TypeScript)
    /brand-scan/              — Orchestrator
    /researcher-*/            — 8 modules (fetch + synthesize)
    /synthesis-draft-audit/   — Generate recommendations
    /_shared/                 — Common utilities
  /migrations/                — DB schema + RPCs
    /24_rpc_partial_failure_handling.sql    — completeModule RPC
    /25_realtime_publication.sql            — Enable Realtime
/docs
  /env-vars.md                — API key reference
  /mvp-scope.md               — Feature scope
  /mvp-module-sources.md      — Data sources per module
  /agent-orchestration.md     — State machine details
```

---

**Document End**

*For questions or clarifications, refer to CLAUDE.md (project rules) or the skill files in /docs/skills/*
