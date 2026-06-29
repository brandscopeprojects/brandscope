# Brandscope — Data Flow Diagram

**Document:** 8 of 10
**Purpose:** Defines how data moves through the entire Brandscope system — from external APIs through agents into Supabase cache and finally to the frontend. Includes the weekly cron sequence, between-cycle monitoring triggers, cache invalidation rules, and data retention policies. Claude Code references this when building Edge Functions, cron jobs, and frontend data fetching.

---

## System Data Flow Overview

```
EXTERNAL WORLD                    BRANDSCOPE BACKEND                    FRONTEND
─────────────────────────────────────────────────────────────────────────────────

DataForSEO ──────────────────┐
Firecrawl ────────────────── │
Apify ───────────────────── │──→ RESEARCHER AGENT ──→ CACHE TABLES ──→ NEXT.JS
DetectZeStack ────────────── │    (Edge Functions)      (Supabase)      (Vercel)
xAI / Together AI ────────── │
                             │
                             ↓
                    SUPERVISOR AGENT
                             │
                             ↓
                     DRAFTER AGENT
                             │
                             ↓
                     AUDITOR AGENT
                             │
                             ↓
                    SUPABASE TABLES
                    ─────────────────
                    weekly_cache
                    recommendations
                    action_plans
                    generated_assets
                    geo_cache
                    promotions_cache
                    seo_cache
                    social_cache
                    tech_stack_cache
                    regulatory_cache
                    product_intel_cache
                    customer_intel_cache
                    hiring_signals_cache
                    feature_health_logs
                             │
                             ↓
                    FRONTEND (READ ONLY)
                    Sub-1-second loads
                    No live API calls
                    on page load
```

---

## 1. Weekly Data Flow — Full Sequence

### 1.1 Trigger Layer

```
MONDAY 01:00 UTC (02:00 WAT)
         │
         ▼
┌─────────────────────────────────────────┐
│ pg_cron job fires                        │
│ Calls: /functions/v1/weekly-scan-trigger │
│                                          │
│ Edge Function does:                      │
│ 1. SELECT * FROM brands                  │
│    WHERE is_active = true               │
│    AND scan_frequency = 'weekly'         │
│    AND deleted_at IS NULL               │
│                                          │
│ 2. For each brand:                       │
│    INSERT INTO scan_jobs (               │
│      brand_id, scan_week, status)        │
│    VALUES (id, current_monday, 'pending')│
│                                          │
│ 3. Queue each brand scan independently  │
│    (Supabase Queue or parallel invokes) │
│                                          │
│ 4. INSERT INTO cron_job_logs (...)       │
└─────────────────────────────────────────┘
```

---

### 1.2 Per-Brand Scan Flow

```
BRAND SCAN INITIATED
         │
         ▼
┌─────────────────────────────────────────────────┐
│ /functions/v1/brand-scan                         │
│                                                   │
│ Input: { brand_id, scan_job_id, scan_week }      │
│                                                   │
│ Step 1: Load brand context                        │
│ ─────────────────────────────                    │
│ SELECT FROM brands, brand_preferences,           │
│   brand_competitors, competitors,                 │
│   performance_memory, weekly_cache (prev week)   │
│                                                   │
│ Step 2: Update scan_jobs.status = 'running'      │
│                                                   │
│ Step 3: Invoke Supervisor Agent                  │
│ → Returns: decomposed sub-task list              │
│                                                   │
│ Step 4: Invoke Researcher Agents (parallel)      │
│ → Each module runs as separate Edge Function     │
│ → Promise.allSettled() — failures don't          │
│   block other modules                            │
│                                                   │
│ Step 5: Await all Researcher completions         │
│                                                   │
│ Step 6: Supervisor synthesises results           │
│                                                   │
│ Step 7: Drafter generates recommendations        │
│                                                   │
│ Step 8: Auditor scores all recommendations       │
│                                                   │
│ Step 9: Cache population                         │
│                                                   │
│ Step 10: Feature health check                    │
│                                                   │
│ Step 11: Update scan_jobs.status =               │
│   'completed' | 'partial' | 'failed'             │
│                                                   │
│ Step 12: Send brand notification email           │
└─────────────────────────────────────────────────┘
```

---

### 1.3 Module Data Flow — Promotions (Example)

```
RESEARCHER: promotions_scan
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ /functions/v1/researcher-promotions                       │
│                                                            │
│ FOR EACH competitor in brand_competitors:                 │
│                                                            │
│ 1. BUILD URL                                              │
│    url = `https://${competitor.domain}/promotions`        │
│                                                            │
│ 2. CALL FIRECRAWL                                         │
│    POST https://api.firecrawl.dev/v1/scrape               │
│    Body: { url, formats: ['markdown', 'extract'],         │
│            extract: { schema: promo_schema } }            │
│    ──────────────────────────────────────────             │
│    Response: { markdown: '...', extract: {...} }          │
│                                                            │
│ 3. PARSE WITH CLAUDE HAIKU                               │
│    Model: claude-haiku-4-5                               │
│    Input: raw markdown from Firecrawl                    │
│    Prompt: "Extract bonus_amount, wagering_requirement,   │
│    promo_type, promo_title. Return JSON only."           │
│    Output: structured JSON                               │
│                                                            │
│ 4. CALCULATE WEEK-ON-WEEK CHANGE                         │
│    SELECT bonus_amount_kobo FROM promotions_cache         │
│    WHERE competitor_id = ? AND scan_week = prev_monday   │
│    Compare new vs old → calculate wow_bonus_change_pct   │
│                                                            │
│ 5. GENERATE EVIDENCE HASH                                │
│    SHA-256 of (competitor_id + url + extracted_text)     │
│                                                            │
│ 6. WRITE TO SUPABASE                                     │
│    INSERT INTO promotions_cache (                        │
│      brand_id, scan_week, competitor_id,                 │
│      bonus_amount_kobo, wagering_requirement,            │
│      promo_type, wow_bonus_change_pct,                   │
│      source_url, scraped_at, evidence_hash               │
│    ) ON CONFLICT (brand_id, scan_week, competitor_id)    │
│    DO UPDATE SET ...                                     │
│                                                            │
│ 7. LOG TO agent_job_logs                                 │
│    agent_name, tokens_used, cost_usd, duration_ms,       │
│    status, langfuse_trace_id                             │
│                                                            │
│ RETURN: { status, records_written, data_quality_score }  │
└──────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ promotions_cache TABLE                                    │
│ ┌────────────────────────────────────────────────────┐  │
│ │ brand_id | scan_week | competitor_id | bonus_amount │  │
│ │ riversbet | 2025-05-19 | sportybet_id | 25000000   │  │
│ │ riversbet | 2025-05-19 | betking_id   | 20000000   │  │
│ └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

### 1.4 GEO Module Data Flow

```
RESEARCHER: geo_aeo_scan
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ /functions/v1/researcher-geo                              │
│                                                            │
│ STEP 1: Build query set (15 queries per brand)           │
│ Queries loaded from geo_query_templates                  │
│ Brand name and market injected per query                 │
│                                                            │
│ STEP 2: Dispatch to 6 AI platforms (parallel)            │
│                                                            │
│ ┌──────────────────┬─────────────────────────────────┐  │
│ │ Platform          │ API Call                        │  │
│ ├──────────────────┼─────────────────────────────────┤  │
│ │ ChatGPT           │ DataForSEO /chat_gpt/           │  │
│ │                   │ llm_responses/task_post         │  │
│ │                   │ method: Standard Queue          │  │
│ ├──────────────────┼─────────────────────────────────┤  │
│ │ Claude            │ DataForSEO /claude/             │  │
│ │                   │ llm_responses/task_post         │  │
│ │                   │ method: Standard Queue          │  │
│ ├──────────────────┼─────────────────────────────────┤  │
│ │ Gemini            │ DataForSEO /gemini/             │  │
│ │                   │ llm_responses/task_post         │  │
│ │                   │ method: Standard Queue          │  │
│ ├──────────────────┼─────────────────────────────────┤  │
│ │ Perplexity        │ DataForSEO /perplexity/         │  │
│ │                   │ llm_responses/live              │  │
│ │                   │ method: Live only               │  │
│ ├──────────────────┼─────────────────────────────────┤  │
│ │ Grok              │ xAI API /chat/completions       │  │
│ │                   │ model: grok-3-mini              │  │
│ ├──────────────────┼─────────────────────────────────┤  │
│ │ Meta AI / Llama   │ Together AI /chat/completions   │  │
│ │                   │ model: Llama-3.1-70B-Instruct   │  │
│ └──────────────────┴─────────────────────────────────┘  │
│                                                            │
│ STEP 3: Poll DataForSEO for Standard Queue results       │
│ GET /chat_gpt/llm_responses/tasks_ready                  │
│ GET /chat_gpt/llm_responses/task_get/{id}                │
│ Retry every 30s, max 70 hours                            │
│                                                            │
│ STEP 4: Extract brand mentions via Claude Haiku          │
│ Per AI response:                                         │
│ - Is brand mentioned? (boolean)                          │
│ - Sentiment (positive/neutral/negative)                  │
│ - Position in response (1-10)                            │
│ - Exact quote containing brand name                      │
│                                                            │
│ STEP 5: Calculate AI Visibility Score                    │
│ score = (                                                │
│   mentions_across_platforms / total_queries * 50 +      │
│   avg_sentiment_score * 30 +                            │
│   avg_position_score * 20                               │
│ )                                                        │
│                                                            │
│ STEP 6: Write to geo_cache                              │
│                                                            │
│ STEP 7: Log to agent_job_logs                           │
└──────────────────────────────────────────────────────────┘
```

---

### 1.5 Cache Population Flow

```
ALL RESEARCHER MODULES COMPLETE
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ /functions/v1/cache-population                            │
│                                                            │
│ 1. CALCULATE MARKET POSITION                             │
│    For each competitor:                                  │
│    - reach_score = f(traffic, sov, keyword_count)       │
│    - aggression_score = f(ad_spend, promo_frequency,    │
│        bonus_aggressiveness, social_activity)           │
│                                                            │
│    For brand:                                            │
│    - Calculate same scores                               │
│    - Position relative to competitors                    │
│                                                            │
│ 2. CALCULATE THREAT SCORE                                │
│    threat_score = (                                      │
│      competitive_aggression_delta * 0.40 +              │
│      promo_gap_score * 0.30 +                           │
│      traffic_gap_score * 0.20 +                         │
│      ai_visibility_gap * 0.10                           │
│    )                                                     │
│                                                            │
│ 3. CALCULATE SOV                                         │
│    sov_pct = brand_traffic /                            │
│      SUM(all_competitor_traffic) * 100                  │
│                                                            │
│ 4. BUILD RADAR DATA                                      │
│    radar_data = {                                        │
│      promotions: score_0_to_100,                        │
│      traffic: score_0_to_100,                           │
│      seo: score_0_to_100,                               │
│      social: score_0_to_100,                           │
│      trust: score_0_to_100,                             │
│      engagement: score_0_to_100                         │
│    }                                                     │
│                                                            │
│ 5. SNAPSHOT COMPETITOR STATES                            │
│    competitor_states = SELECT FROM competitor_profiles   │
│    WHERE scan_week = current_week                        │
│                                                            │
│ 6. WRITE TO weekly_cache                                 │
│    UPSERT weekly_cache SET (                            │
│      all calculated fields,                             │
│      all module data jsonb fields,                      │
│      competitor_states,                                 │
│      radar_data,                                        │
│      cached_at = now(),                                 │
│      expires_at = now() + interval '8 days'             │
│    )                                                     │
│                                                            │
│ 7. WRITE ACTION PLAN                                     │
│    INSERT INTO action_plans                             │
│    INSERT INTO recommendations (all scored recs)        │
│    INSERT INTO generated_assets (all pre-gen assets)   │
│                                                            │
│ 8. FEATURE HEALTH CHECK                                 │
│    For each of 337 features:                            │
│    Check if data is present and valid in cache          │
│    INSERT INTO feature_health_logs (status per feature) │
└──────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ SUPABASE CACHE STATE (06:00 WAT)                         │
│                                                            │
│ weekly_cache ────────────── ready ✓                      │
│ promotions_cache ─────────── ready ✓                     │
│ seo_cache ────────────────── ready ✓                     │
│ geo_cache ────────────────── ready ✓                     │
│ social_cache ─────────────── ready ✓ (or partial)       │
│ tech_stack_cache ─────────── ready ✓                     │
│ regulatory_cache ─────────── ready ✓                     │
│ product_intel_cache ──────── ready ✓                     │
│ customer_intel_cache ─────── ready ✓                     │
│ hiring_signals_cache ─────── ready ✓                     │
│ recommendations ──────────── ready ✓                     │
│ action_plans ─────────────── ready ✓                     │
│ generated_assets ─────────── ready ✓                     │
│ feature_health_logs ──────── ready ✓                     │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Data Flow

### 2.1 Dashboard Load

```
BRAND OPENS DASHBOARD (08:00 WAT)
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ Next.js Page: /dashboard                                  │
│                                                            │
│ Server Component (SSR):                                   │
│                                                            │
│ const data = await supabase                              │
│   .from('weekly_cache')                                  │
│   .select('*')                                           │
│   .eq('brand_id', session.brand_id)                     │
│   .eq('scan_week', current_monday)                      │
│   .single()                                              │
│                                                            │
│ const recommendations = await supabase                   │
│   .from('recommendations')                               │
│   .select('*')                                           │
│   .eq('brand_id', session.brand_id)                     │
│   .eq('scan_week', current_monday)                      │
│   .eq('status', 'open')                                 │
│   .order('rank', { ascending: true })                   │
│   .limit(10)                                             │
│                                                            │
│ → RLS automatically filters to brand's data only        │
│ → No cross-brand data leakage possible                  │
│ → Sub-1-second response from Supabase cache             │
└──────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ CLIENT SIDE: Zero additional API calls on page load      │
│                                                            │
│ All data hydrated from server:                           │
│ - Market position coordinates (scatter plot)            │
│ - Radar chart data                                       │
│ - SOV percentage (donut chart)                          │
│ - Threat score (gauge)                                  │
│ - Action feed (ranked recommendations)                  │
│                                                            │
│ Client-side interactions (no server call):              │
│ - Filter chips (filter local state)                     │
│ - Evidence drawer expand/collapse                       │
│ - Urgency tag hover tooltips                            │
│                                                            │
│ Client-side interactions (server call):                 │
│ - Accept/Snooze/Dismiss recommendation                  │
│   → PATCH /api/recommendations/{id}/status              │
│ - Generate Asset button                                 │
│   → POST /api/assets/generate                          │
│ - View previous week                                    │
│   → GET weekly_cache (different scan_week)              │
└──────────────────────────────────────────────────────────┘
```

---

### 2.2 Asset Generation Flow (On-Demand)

```
BRAND CLICKS "GENERATE ASSET"
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ POST /api/assets/generate                                 │
│                                                            │
│ Body: {                                                   │
│   recommendation_id: "uuid",                             │
│   asset_type: "campaign_brief"                           │
│ }                                                         │
│                                                            │
│ 1. CHECK if pre-generated asset exists                   │
│    SELECT FROM generated_assets                          │
│    WHERE recommendation_id = ? AND asset_type = ?       │
│    AND is_pre_generated = true                          │
│                                                            │
│    IF EXISTS → return immediately (instant)              │
│    IF NOT EXISTS → generate now                         │
│                                                            │
│ 2. IF GENERATING NOW:                                    │
│    Load: recommendation + evidence                      │
│    Load: brand_context                                   │
│    Load: performance_memory                             │
│    Call: Claude Sonnet 4.6                              │
│    Stream response to client (SSE)                      │
│                                                            │
│ 3. Save generated asset:                                │
│    INSERT INTO generated_assets (...)                   │
│                                                            │
│ 4. Run moderation check:                                │
│    POST OpenAI /moderations                             │
│    IF flagged → hold for review                         │
│                                                            │
│ 5. Return asset content to frontend                     │
│    Render inline below action card                      │
└──────────────────────────────────────────────────────────┘
```

---

### 2.3 Chat Interface Flow

```
BRAND SENDS CHAT MESSAGE
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ POST /api/chat                                            │
│                                                            │
│ Body: {                                                   │
│   conversation_id: "uuid",                               │
│   message: "Why did our new depositors drop last week?" │
│ }                                                         │
│                                                            │
│ 1. LOAD CONTEXT (server-side only):                      │
│    - weekly_cache for current week (summary)            │
│    - Last 3 recommendations (open, high/medium)         │
│    - Brand profile                                       │
│    - Previous messages in conversation                  │
│                                                            │
│ 2. BUILD SYSTEM PROMPT:                                  │
│    "You are Brandscope AI for {brand_name}.             │
│    Week of {scan_week}.                                 │
│    Market: {market}. Tier: {tier}.                      │
│    Key metrics this week: {metrics_summary}             │
│    Competitor changes: {changes_summary}                │
│    Answer using only provided data. Cite sources."      │
│                                                            │
│ 3. CALL OpenAI GPT-4.1-mini                             │
│    POST /chat/completions                               │
│    stream: true                                         │
│                                                            │
│ 4. STREAM RESPONSE to client (SSE)                      │
│                                                            │
│ 5. SAVE message to chat_messages                        │
│    INSERT INTO chat_messages (                          │
│      conversation_id, role: 'user', content)            │
│    INSERT INTO chat_messages (                          │
│      conversation_id, role: 'assistant', content,       │
│      tokens_used, cost_usd, model_used)                 │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Between-Cycle Monitoring Data Flow

```
EVERY 6 HOURS (02:00, 08:00, 14:00, 20:00 WAT)
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ /functions/v1/between-cycle-monitor                       │
│                                                            │
│ FOR EACH active brand:                                   │
│                                                            │
│ CHECK 1: DetectZeStack Webhook Queue                     │
│ ─────────────────────────────────────                    │
│ SELECT FROM competitor_changes                           │
│ WHERE change_type = 'tech_stack'                        │
│ AND detected_at > last_check_at                         │
│ AND processed = false                                   │
│                                                            │
│ If unprocessed webhook payloads exist:                  │
│ → Mark as processed                                     │
│ → Evaluate significance (new ad network = HIGH)        │
│ → If significant: fire alert                           │
│                                                            │
│ CHECK 2: Competitor Promo Spot-Check                    │
│ ─────────────────────────────────────                    │
│ Only if brand has bonus_change alert configured          │
│ SELECT top 2 competitors by priority                    │
│ Firecrawl scrape promo page (1 page per competitor)    │
│ Compare bonus_amount vs promotions_cache last week     │
│                                                            │
│ If change detected AND change > threshold_pct:         │
│ → INSERT INTO competitor_changes                       │
│ → Evaluate against alert_configs                       │
│ → Fire alert if configured                             │
│                                                            │
│ CHECK 3: Google News Regulatory Scan                    │
│ ─────────────────────────────────────                    │
│ DataForSEO SERP Google News:                           │
│ query: "NBGC OR BCLB OR gambling regulation Nigeria"   │
│ date_from: last 6 hours                                │
│                                                            │
│ If new regulatory article detected:                    │
│ → INSERT INTO competitor_changes (change_type =        │
│   'regulatory')                                        │
│ → Fire alert to all brands in that market             │
│                                                            │
│ CHECK 4: Social Media Crisis Detection                  │
│ ─────────────────────────────────────                    │
│ Only if social module enabled AND brand has alert      │
│ DataForSEO Content Analysis:                           │
│ keyword = brand_name, last 6 hours                     │
│ Check sentiment_score vs baseline                      │
│                                                            │
│ If negative spike > 30% vs baseline:                  │
│ → INSERT INTO alert_history                            │
│ → Fire URGENT alert                                    │
│                                                            │
│ ALERT FIRING:                                           │
│ ─────────────                                           │
│ SELECT FROM alert_configs WHERE brand_id = ?           │
│ Check which triggers are enabled                       │
│ For each enabled + triggered:                          │
│   INSERT INTO alert_history                            │
│   IF email_enabled: send via Resend/Sendgrid           │
│   IF whatsapp_enabled: send via Meta Business API      │
│   IF slack_enabled: POST to webhook_url                │
│   IF webhook_enabled: POST to brand webhook            │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Webhook Ingestion Flow (DetectZeStack)

```
DETECTZESTACK DETECTS STACK CHANGE
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ POST /api/webhooks/detectzestack                          │
│                                                            │
│ 1. VERIFY SIGNATURE                                      │
│    hmac_sha256(payload, DETECTZESTACK_WEBHOOK_SECRET)    │
│    Compare with X-Signature header                      │
│    IF mismatch → 401, log to audit_logs, drop           │
│                                                            │
│ 2. PARSE PAYLOAD                                         │
│    { domain, detected_at, changes: {added, removed} }   │
│                                                            │
│ 3. FIND COMPETITOR                                       │
│    SELECT id FROM competitors WHERE domain = ?          │
│                                                            │
│ 4. WRITE TO competitor_changes                           │
│    INSERT INTO competitor_changes (                      │
│      competitor_id,                                     │
│      detected_at,                                       │
│      change_type: 'tech_stack',                         │
│      summary: 'Added CleverTap, removed Intercom',      │
│      detail: { added: [...], removed: [...] },          │
│      impact_level: calculated_from_significance         │
│    )                                                     │
│                                                            │
│ 5. UPDATE tech_stack_cache                               │
│    UPSERT with new technology list                      │
│                                                            │
│ 6. FLAG FOR BETWEEN-CYCLE PROCESSING                    │
│    Will be picked up in next 6-hour check              │
│    (rather than firing alert immediately)               │
│                                                            │
│ 7. Return 200 OK                                         │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Regulatory Document Ingestion Flow

```
NEW REGULATORY DOCUMENT DETECTED
(automated discovery or manual upload)
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ /functions/v1/regulatory-doc-ingestion                    │
│                                                            │
│ Step 1: DOWNLOAD PDF                                     │
│ fetch(source_url) → ArrayBuffer                          │
│                                                            │
│ Step 2: GENERATE HASH                                    │
│ SHA-256(pdf_bytes) → file_hash                          │
│                                                            │
│ Step 3: CHECK IF ALREADY EXISTS                          │
│ SELECT FROM regulatory_documents                         │
│ WHERE file_hash = ?                                      │
│ IF exists → skip (idempotent)                           │
│                                                            │
│ Step 4: UPLOAD TO CLOUDFLARE R2                          │
│ PUT r2://brandscope-docs/{country}/{filename}            │
│                                                            │
│ Step 5: CREATE DOCUMENT RECORD                           │
│ INSERT INTO regulatory_documents (                       │
│   country, regulatory_body, document_name,              │
│   source_url, r2_path, file_hash, file_size_bytes,      │
│   embedding_status: 'pending'                           │
│ )                                                        │
│                                                            │
│ Step 6: CLASSIFY DOCUMENT (Claude Haiku)                │
│ "What type of regulatory document is this?              │
│ Return: { document_type, effective_date, sections[] }"  │
│                                                            │
│ Step 7: CHUNK DOCUMENT                                   │
│ Split at natural section/clause boundaries              │
│ Never split mid-sentence or mid-clause                 │
│ Target: 500-800 tokens per chunk                       │
│ Each chunk tagged: { section, page, country, body }    │
│                                                            │
│ Step 8: FLAG AMBIGUOUS CHUNKS (~5%)                     │
│ Claude Haiku scores chunk quality                       │
│ Low-quality chunks → needs_review = true               │
│                                                            │
│ Step 9: GENERATE EMBEDDINGS                             │
│ For each chunk:                                        │
│ OpenAI text-embedding-3-small                          │
│ → 1536-dimension vector                                │
│                                                            │
│ Step 10: WRITE CHUNKS TO SUPABASE                       │
│ INSERT INTO document_chunks (                          │
│   document_id, chunk_index, content,                   │
│   section_title, page_number,                          │
│   embedding, metadata                                  │
│ )                                                       │
│                                                            │
│ Step 11: UPDATE DOCUMENT STATUS                         │
│ UPDATE regulatory_documents SET                        │
│   embedding_status = 'complete',                       │
│   chunk_count = N,                                     │
│   last_verified_at = now()                             │
│                                                            │
│ Step 12: LOG TO ingestion_logs                          │
└──────────────────────────────────────────────────────────┘
```

---

## 6. RAG Retrieval Flow

```
BRAND ASKS REGULATORY QUESTION
(via chat or compliance check)
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ /functions/v1/regulatory-rag                              │
│                                                            │
│ Input: { question, country, brand_id }                   │
│                                                            │
│ Step 1: GENERATE QUERY EMBEDDING                        │
│ OpenAI text-embedding-3-small                          │
│ Input: user question                                   │
│ Output: 1536-dimension vector                          │
│                                                            │
│ Step 2: VECTOR SIMILARITY SEARCH                        │
│ SELECT content, metadata, document_id, page_number,    │
│   1 - (embedding <=> query_vector) AS similarity       │
│ FROM document_chunks                                   │
│ JOIN regulatory_documents ON document_id               │
│ WHERE regulatory_documents.country = country           │
│   AND regulatory_documents.is_active = true           │
│ ORDER BY similarity DESC                               │
│ LIMIT 5                                                │
│                                                            │
│ Step 3: CHECK RETRIEVAL CONFIDENCE                      │
│ IF max_similarity < 0.80:                              │
│   Return: "Cannot answer with sufficient confidence.   │
│   Please consult the source document directly."        │
│   Log: low_confidence retrieval                        │
│                                                            │
│ Step 4: BUILD CONTEXT                                   │
│ Combine top 5 chunks                                   │
│ Include: document_name, section, page_number           │
│ per chunk                                              │
│                                                            │
│ Step 5: CALL CLAUDE SONNET                             │
│ System: Regulatory RAG agent rules (verbatim only)     │
│ User: question + retrieved chunks + citation format    │
│                                                            │
│ Step 6: VALIDATE RESPONSE                               │
│ Confirm response contains citation                     │
│ Confirm no paraphrasing of regulatory text            │
│ Confirm source document referenced                    │
│                                                            │
│ Step 7: RETURN WITH PROOF                              │
│ {                                                      │
│   answer: "verbatim quote from document",              │
│   citation: {                                          │
│     document_name: "NBGC Licensing Guidelines 2025",  │
│     section: "Section 4.2",                           │
│     page: 12,                                         │
│     source_url: "r2://brandscope-docs/ng/nbgc..."     │
│   },                                                   │
│   similarity_score: 0.94                              │
│ }                                                      │
└──────────────────────────────────────────────────────────┘
```

---

## 7. Cache Invalidation Rules

### 7.1 Scheduled Invalidation

```
RULE 1 — Weekly cache expires after 8 days
┌────────────────────────────────────────────────┐
│ weekly_cache.expires_at = cached_at + 8 days  │
│                                                │
│ Rationale: New scan runs every 7 days.        │
│ 8-day expiry gives 1-day buffer if scan       │
│ is delayed. Never read stale data >8 days.   │
└────────────────────────────────────────────────┘

RULE 2 — All module caches tied to scan_week
┌────────────────────────────────────────────────┐
│ promotions_cache, seo_cache, geo_cache etc.   │
│ Never deleted — kept for historical access.  │
│ Frontend always queries by scan_week.         │
│ "Current week" = most recent scan_week.      │
└────────────────────────────────────────────────┘

RULE 3 — Previous scan data retained for 2 years
┌────────────────────────────────────────────────┐
│ No hard deletes on cache tables.              │
│ Data older than 2 years archived to           │
│ Cloudflare R2 (cold storage).                │
│ Supabase retains last 104 weeks (2 years).   │
└────────────────────────────────────────────────┘
```

### 7.2 On-Demand Invalidation

```
RULE 4 — On-demand scan invalidates current week cache
┌────────────────────────────────────────────────────────────┐
│ IF brand triggers manual on-demand scan:                   │
│                                                            │
│ 1. New scan_job created (triggered_by = 'manual')         │
│ 2. Full scan pipeline runs                                │
│ 3. On completion:                                         │
│    UPDATE weekly_cache SET ... WHERE brand_id = ?         │
│    AND scan_week = current_monday                         │
│    (UPSERT — overwrites existing cache)                   │
│ 4. Old recommendations NOT deleted                        │
│    New recommendations added, marked as on_demand        │
└────────────────────────────────────────────────────────────┘

RULE 5 — Between-cycle alert updates specific cache fields
┌────────────────────────────────────────────────────────────┐
│ IF between-cycle monitor detects promo change:            │
│                                                            │
│ 1. UPDATE promotions_cache WHERE competitor_id = ?        │
│    AND scan_week = current_monday                         │
│    SET bonus_amount_kobo = new_value,                    │
│        is_new = true,                                     │
│        scraped_at = now()                                 │
│                                                            │
│ 2. DO NOT regenerate recommendations                      │
│    (that would require full Drafter + Auditor cycle)     │
│                                                            │
│ 3. INSERT INTO competitor_changes (new change record)    │
│                                                            │
│ 4. Alert fires to brand                                  │
│    Brand sees alert — if they want a new action card,   │
│    they can trigger on-demand scan                       │
└────────────────────────────────────────────────────────────┘

RULE 6 — Brand deletes competitor: cache stays
┌────────────────────────────────────────────────────────────┐
│ IF brand removes a competitor from tracking:              │
│                                                            │
│ 1. DELETE FROM brand_competitors WHERE ...               │
│ 2. DO NOT delete cache tables                            │
│    (historical data retained)                            │
│ 3. Future scans exclude this competitor                  │
│ 4. Past weeks still show this competitor's data          │
│    (for historical comparison)                           │
└────────────────────────────────────────────────────────────┘
```

### 7.3 Cache Staleness Handling

```
RULE 7 — Stale cache display rules
┌────────────────────────────────────────────────────────────┐
│ IF scan failed and no current week cache exists:          │
│                                                            │
│ Frontend behaviour:                                       │
│ 1. Show previous week's cache                            │
│ 2. Display banner: "Intelligence from [date].            │
│    Your scan encountered an issue.                       │
│    [Retry scan] button"                                  │
│                                                            │
│ IF cache is >8 days old:                                 │
│ 1. Show data with amber warning banner                   │
│ 2. "This intelligence is from [N] days ago."            │
│ 3. Do not block access                                   │
│ 4. Alert Brandscope internal team                        │
└────────────────────────────────────────────────────────────┘
```

---

## 8. Data Retention Policy

```
TABLE                    RETENTION        ARCHIVE RULE
──────────────────────────────────────────────────────────────
weekly_cache             2 years          Archive to R2 after
promotions_cache         2 years          Archive to R2 after
seo_cache                2 years          Archive to R2 after
geo_cache                2 years          Archive to R2 after
social_cache             2 years          Archive to R2 after
tech_stack_cache         2 years          Archive to R2 after
regulatory_cache         2 years          Archive to R2 after
product_intel_cache      2 years          Archive to R2 after
customer_intel_cache     2 years          Archive to R2 after
hiring_signals_cache     2 years          Archive to R2 after
competitor_profiles      2 years          Archive to R2 after
competitor_changes       2 years          Archive to R2 after
recommendations          Permanent        Never delete
action_outcomes          Permanent        Never delete
generated_assets         Permanent        Never delete
performance_memory       Permanent        Never delete
regulatory_documents     Permanent        Never delete
document_chunks          Permanent        Never delete
agent_job_logs           90 days          Delete after 90 days
api_health_logs          30 days          Delete after 30 days
cron_job_logs            90 days          Delete after 90 days
audit_logs               7 years          Compliance requirement
chat_messages            1 year           Delete after 1 year
alert_history            1 year           Delete after 1 year
feature_health_logs      6 months         Delete after 6 months
payment_history          7 years          Compliance requirement
```

---

## 9. Error States and Recovery

### 9.1 Partial Scan Recovery

```
IF MODULE FAILS during weekly scan:
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ 1. Log failure to scan_jobs.failed_modules               │
│ 2. Continue remaining modules                            │
│ 3. On completion: status = 'partial'                    │
│ 4. Use PREVIOUS WEEK's cache for failed module          │
│    weekly_cache merges: new data where available,       │
│    previous week data where module failed               │
│ 5. Flag in feature_health_logs                         │
│ 6. Brand sees: "Social intelligence unavailable        │
│    this week" note in social tab                       │
│ 7. Dead letter queue: retry failed module in 6 hours   │
└──────────────────────────────────────────────────────────┘
```

### 9.2 Full Scan Failure Recovery

```
IF ENTIRE SCAN FAILS:
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ 1. scan_jobs.status = 'failed'                          │
│ 2. Auto-retry at 06:00 WAT (one automatic retry)       │
│ 3. If retry fails:                                      │
│    - Alert internal Brandscope team                    │
│    - Brand sees previous week cache with banner        │
│    - Manual retry available in brand admin             │
│ 4. If brand triggers manual retry:                     │
│    - Full scan pipeline re-runs                        │
│    - New scan_job created (triggered_by = 'manual')    │
└──────────────────────────────────────────────────────────┘
```

### 9.3 Dead Letter Queue

```
FAILED INDIVIDUAL API CALLS:
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ After 2 retries with exponential backoff:               │
│                                                          │
│ 1. Record failure in agent_job_logs                     │
│ 2. Insert into dead_letter_queue table:                 │
│    { task_type, payload, failure_reason,               │
│      retry_count, next_retry_at }                      │
│                                                          │
│ 3. Between-cycle monitor processes dead letter queue   │
│    every 6 hours                                        │
│                                                          │
│ 4. Max 3 total attempts (initial + 2 retries)          │
│ 5. After 3 failures: mark as permanently_failed,       │
│    alert internal team if critical module              │
└──────────────────────────────────────────────────────────┘
```

---

## 10. Data Security in Transit

```
ALL DATA IN TRANSIT:
─────────────────────────────────────────────────

External API calls:
→ HTTPS only
→ API keys in environment variables (never in code)
→ API keys stored in Supabase Vault
→ Keys rotated quarterly

Frontend to Supabase:
→ HTTPS + Supabase JWT (anon key for reads)
→ Service role key NEVER exposed to frontend
→ All writes go through server-side API routes
→ Next.js API routes validate session before write

Edge Functions to external APIs:
→ Server-side only
→ Keys injected from environment at runtime
→ Response data sanitised before writing to DB

Webhook endpoints:
→ HMAC-SHA256 signature verification
→ Replay attack prevention (timestamp check)
→ Invalid signatures → 401, logged to audit_logs

Cloudflare R2:
→ Private bucket (no public access)
→ Signed URLs for time-limited document access
→ Expiry: 15 minutes for PDF downloads
```

---

## 11. Monitoring Data Flow

```
LANGFUSE (Observability Layer)
─────────────────────────────────────────────────

Every LLM call sends trace to Langfuse:
POST https://[railway-langfuse]/api/public/ingestion

Trace includes:
- agent_name
- model_used
- input (truncated if >10K tokens)
- output (truncated)
- latency
- token counts
- cost
- custom tags: { brand_id, scan_week, module }

Langfuse is REACTIVE:
→ Engineers open Langfuse to debug specific failures
→ Not used for routine Monday morning checks
→ Routine checks use Brandscope internal admin

Brandscope Internal Admin PROACTIVE:
→ Reads from feature_health_logs
→ Reads from agent_job_logs (aggregated)
→ Reads from api_health_logs
→ Reads from cron_job_logs
→ Shows aggregated view to ops team
→ No Langfuse trace detail shown here
```

---

*This data flow document defines all data movement in Brandscope. Claude Code implements Edge Functions and API routes following these exact flows. Frontend components read only from Supabase cache — never call external APIs directly. All external API calls are server-side only.*
