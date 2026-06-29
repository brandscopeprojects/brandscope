# Brandscope — MVP Scope Definition

**Document:** 10 of 10  
**Status:** LOCKED — Claude Code builds only what is listed under MVP v1  
**Purpose:** Defines exactly what ships in v1, what ships in Phase 2, and what ships in Phase 3. Claude Code must not build anything outside MVP v1 scope without explicit instruction. When in doubt — check this document first.

---

## The Governing Rule

**Build depth, not breadth.**  
A feature that works perfectly is worth ten features that half-work.  
Every MVP v1 feature must be production-quality — evidence-backed, agent-processed, RLS-enforced, and mobile-responsive.  
No placeholders in v1 features. No fake data. No "coming soon" inside v1 feature pages.

---

## API Stack at MVP

```
IN STACK — BUILD WITH THESE:
✓ Supabase (database, Edge Functions, cron, pgvector, auth)
✓ DataForSEO (SEO, traffic, SERP, AEO, GEO, app reviews, content analysis, OnPage)
✓ Claude API (Sonnet 4.6 + Haiku 4.5)
✓ OpenAI API (GPT-4.1 Mini, embeddings, moderation)
✓ DetectZeStack (tech stack + ad network detection)
✓ Ideogram API (ad creative image generation)
✓ Cloudflare R2 (PDF storage, evidence files)

NOT IN STACK YET — DO NOT BUILD FOR:
✗ Firecrawl (web crawling)
✗ Apify (social media scraping)
✗ xAI API (Grok)
✗ Together AI (Meta AI / Llama)
✗ DeepSeek (bulk extraction)
✗ Kimi (African language)
✗ Resend (transactional email)
```

---

## Intelligence Modules — MVP Status

### Module 1: GEO Intelligence ✓ FULL BUILD

**Why:** Most differentiated feature in the product. DataForSEO covers all 4 major platforms through one API. No competitor does this for African iGaming.

**What ships:**
- AI Visibility Score (0-100, weekly trend)
- Platform breakdown: ChatGPT, Claude, Gemini, Perplexity
- Competitor AI visibility scorecard
- Top AI mentions (queries that surface brands)
- Brand narrative drift tracking
- Unknown competitor surfacing from AI answers
- Multi-market GEO comparison (NG/KE/ZA)
- Auto-generated prompt discovery
- GEO content gap analysis with Generate Content Brief button
- Weekly delta vs previous week

**Data sources:** DataForSEO AI Optimization API (LLM Responses — ChatGPT, Claude, Gemini, Perplexity), DataForSEO LLM Mentions API

**What does NOT ship (Phase 2):**
- Grok GEO monitoring (xAI API needed)
- Meta AI GEO monitoring (Together AI needed)
- Microsoft Copilot monitoring
- Daily GEO refresh (weekly only at MVP)

---

### Module 2: AEO Intelligence ✓ FULL BUILD

**Why:** DataForSEO SERP API captures all AEO signals. Zero additional cost.

**What ships:**
- Featured snippet ownership per keyword
- People Also Ask monitoring
- Schema markup analysis per competitor (via DataForSEO OnPage)
- Knowledge panel monitoring
- Voice search query signals
- AEO vs competitor comparison

**Data sources:** DataForSEO SERP API (Google Organic advanced), DataForSEO OnPage API (microdata endpoint)

---

### Module 3: SEO Intelligence ✓ FULL BUILD

**Why:** Core DataForSEO capability. Complete coverage.

**What ships:**
- Competitor traffic estimation
- Organic vs paid traffic split
- Traffic trend analysis (12 weeks)
- Domain authority comparison
- Keyword gap analysis (top 100 gaps)
- SERP position monitoring (50 tracked keywords)
- Google Ads intelligence per competitor
- Content gap identification
- SEO opportunity prioritisation
- Organic traffic value estimation
- Historical rank data

**Data sources:** DataForSEO Labs Google API (bulk traffic estimation, domain intersection, keywords for site, ranked keywords, competitors domain), DataForSEO Keywords Data API (Google Ads search volume)

---

### Module 4: Tech Stack & Ad Network Intelligence ✓ FULL BUILD

**Why:** DetectZeStack is in the stack and covers this completely. Strong differentiation for iGaming brands who want to know which ad networks and CRM tools competitors use.

**What ships:**
- Full technology stack detection per competitor
- Ad network detection (Google Ads, Meta, TikTok Ads, programmatic)
- CRM and engagement tool detection (CleverTap, MoEngage, OneSignal etc.)
- Analytics stack detection
- Payment gateway detection
- CDN and infrastructure detection
- Week-on-week stack change detection
- Between-cycle webhook alerts (stack changes trigger immediate alert)
- New ad network alert
- Affiliate programme detection signals
- Retargeting platform detection
- Tech stack upgrade signal detection
- Spend Intensity Scoring (inferred from ad count + paid traffic + page changes)

**Data sources:** DetectZeStack API (detect endpoint + webhook)

---

### Module 5: App Store Intelligence ✓ FULL BUILD

**Why:** DataForSEO App Data API covers Google Play and App Store completely. Directly relevant for Nigerian iGaming — all major operators have apps.

**What ships:**
- Google Play app data per competitor (rating, review count, version, last updated)
- App Store app data per competitor
- Google Play review mining (200 reviews per competitor)
- App Store review mining
- Complaint theme extraction from reviews
- App rating trend (12 weeks)
- App competitor discovery
- New app feature detection from update notes
- Product sentiment scoring per vertical
- App keyword rankings (DataForSEO Labs Google Play)

**Data sources:** DataForSEO App Data API (Google + Apple — app info, app reviews, app searches), DataForSEO Labs Google Play API (bulk app metrics, keywords for app, app competitors)

---

### Module 6: Customer Intelligence ✓ PARTIAL BUILD

**Why:** DataForSEO covers traffic sources, content analysis, and app reviews — strong enough for MVP without Apify.

**What ships:**
- Traffic source breakdown per competitor (organic/paid/social/direct/referral — estimated)
- Audience demographic signals (inferred from keyword data)
- Geographic distribution (Nigeria — Lagos/Abuja/Port Harcourt/Other inferred from SERP location data)
- Customer intent mapping from keyword classification
- Complaint theme intelligence (from app reviews + content analysis)
- App rating trend per competitor
- Sentiment trend (12 weeks, from content analysis)
- Audience overlap detection (from keyword intersection data)

**What does NOT ship (Phase 2):**
- Exact demographic data (needs additional data source)
- Social sentiment (needs Apify)
- Influencer acquisition signals (needs Apify)
- WhatsApp community intelligence

**Honest labelling in UI:** Customer Intelligence page ships with available data. Fields without data sources show "Requires social intelligence — available in Phase 2" rather than fake numbers.

---

### Module 7: Regulatory Intelligence ✓ FULL BUILD

**Why:** Claude + Supabase pgvector is all that's needed. This is a genuine moat — no competitor offers this for African iGaming.

**What ships:**
- Regulatory document storage (Cloudflare R2)
- Document chunking and embedding pipeline (pgvector)
- Verbatim RAG retrieval with citation (document/section/page)
- Country-specific compliance checking: Nigeria (NBGC), Kenya (BCLB), South Africa (WCGRB)
- Competitor compliance scorecard (6 dimensions)
- Brand own compliance self-audit
- Regulatory violation alerts with verbatim evidence
- Regulatory intelligence feed (new documents detected via DataForSEO News)
- "View source PDF" proof mechanism
- Regulatory change detection (DataForSEO Google News)

**Data sources:** Claude Sonnet 4.6 (RAG + compliance checking), Supabase pgvector, Cloudflare R2, DataForSEO SERP Google News API, OpenAI text-embedding-3-small

---

### Module 8: Promotions Intelligence ⚠ PARTIAL BUILD

**Why:** Without Firecrawl we cannot scrape promo pages directly. DataForSEO OnPage Content Parsing + Content Analysis API provides proxy signals that are still commercially valuable.

**What ships:**
- Promotion signal detection via DataForSEO Content Analysis (brand citation monitoring across Nigerian betting content)
- Promotion announcement detection via DataForSEO Google News
- App review promotion mentions (extracted from app store reviews)
- Bonus mention tracking (what the web says about competitor bonuses)
- Promotion type signals (what types of promos are being talked about)
- Week-on-week promotion activity trend
- Promotion-related keyword movement (competitors bidding on bonus keywords)
- Action cards generated from promotion signals

**Honest labelling:** Page is titled "Promotion Signals" not "Promotion Tracker" in MVP. A tooltip explains: "Exact bonus amounts available when web scraping is enabled." No fake numbers. Signal-based intelligence only.

**What upgrades in Phase 2 (Firecrawl added):**
- Exact bonus amounts (₦250,000)
- Exact wagering requirements (25x)
- Live promo page screenshots
- Week-on-week exact comparison table
- Page retitled "Promotions Intelligence"

---

### Module 9: Hiring & Signals ⚠ PARTIAL BUILD

**Why:** DataForSEO Google Jobs SERP API covers major operators on Google Jobs. Covers approximately 70% of hiring intelligence without Firecrawl.

**What ships:**
- Hiring signal detection via DataForSEO Google Jobs SERP
  (query: "[competitor] Lagos Nigeria" → extracts job titles, locations, dates)
- Signal classification (Claude Haiku interprets role → signal type)
- Geographic expansion detection from job location data
- Signal Intelligence panel (Claude-interpreted strategic meaning)
- New roles this week count
- Most active hirer this week
- West Africa expansion map (from job location data)

**What does NOT ship (Phase 2):**
- Direct career page crawl (needs Firecrawl)
- Full job description text
- Some smaller operators not indexed on Google Jobs

---

### Module 10: Social & Ads Intelligence ✗ PLACEHOLDER ONLY

**Why:** No Apify in MVP stack. Cannot build this to production quality. Do not build fake data.

**What ships:**
- Social & Ads Intelligence page exists in navigation
- Page shows: "Social intelligence coming soon. We're integrating Instagram, Facebook, TikTok, X, and YouTube data. Expected: [Phase 2 date]."
- Ad Network Detection section IS built (DetectZeStack covers this)
  → Which ad networks each competitor uses
  → Tech stack of ad tools
  → This is renamed "Ad Network Intelligence" within the page
- Spend Intensity Scoring shown (inferred from available signals)

**What ships in Phase 2 (Apify added):**
- Instagram, Facebook, TikTok, X, YouTube monitoring
- Social engagement benchmarking
- Content theme detection
- Facebook Ad Library (commercial ads)
- Ad creative intelligence
- Social sentiment monitoring
- Crisis detection

---

## Frontend Pages — MVP Status

### Pages That Ship at Full Quality

| Page | Route | Status |
|---|---|---|
| Onboarding flow | `/onboarding` | ✓ Full build |
| Scanning animation | `/onboarding/scanning` | ✓ Full build |
| Dashboard | `/dashboard` | ✓ Full build |
| GEO / AEO / SEO Visibility | `/geo-aeo-seo` | ✓ Full build |
| Tech Stack Intelligence | `/tech-stack` | ✓ Full build |
| App Store Intelligence | (within product page) | ✓ Full build |
| Regulatory Compliance | `/regulatory` | ✓ Full build |
| Action Plan | `/action-plan` | ✓ Full build |
| Assets Library | `/assets` | ✓ Full build |
| Performance & Outcomes | `/performance` | ✓ Full build |
| Reports | `/reports` | ✓ Full build |
| Brand Chat | `/chat` | ✓ Full build |
| Mobile Dashboard | `/dashboard` (responsive) | ✓ Full build |
| Mobile Action Plan | `/action-plan` (responsive) | ✓ Full build |
| Brand Admin: Configuration | `/admin/settings` | ✓ Full build |
| Brand Admin: Competitors | `/admin/competitors` | ✓ Full build |
| Brand Admin: Alerts | `/admin/alerts` | ✓ Full build |
| Brand Admin: Billing | `/admin/billing` | ✓ Full build |
| Internal Admin: Health | `/brandscope-admin/health` | ✓ Full build |
| Internal Admin: Agents | `/brandscope-admin/agents` | ✓ Full build |
| Internal Admin: API Mgmt | `/brandscope-admin/api-management` | ✓ Full build |
| Internal Admin: Knowledge Base | `/brandscope-admin/knowledge-base` | ✓ Full build |
| Internal Admin: Security | `/brandscope-admin/security` | ✓ Full build |
| Internal Admin: Revenue | `/brandscope-admin/revenue` | ✓ Full build |

### Pages That Ship Partially

| Page | Route | What Ships | What Waits |
|---|---|---|---|
| Promotions Signals | `/promotions` | Signal-based intelligence | Exact promo data (Firecrawl) |
| Hiring & Signals | `/hiring-signals` | Google Jobs data | Career page crawl (Firecrawl) |
| Customer Intelligence | `/customers` | App reviews + traffic signals | Social data (Apify) |
| Market Intelligence | `/market-intel` | SEO + GEO market view | Social market signals (Apify) |
| Competitor Profile | `/competitors/[id]` | SEO + tech + GEO + app data | Social tab (Apify) |

### Pages That Ship as Placeholders Only

| Page | Route | What Ships |
|---|---|---|
| Social & Ads Intelligence | `/social-ads` | Ad Network section (DetectZeStack) + "Coming soon" for social |

### Pages That Do NOT Ship at MVP

| Page | Reason |
|---|---|
| Product Intelligence | Overlaps with App Store data — merge into competitor profile at MVP |

---

## Agent Pipeline — MVP Scope

### What Ships
- Supervisor Agent ✓
- Researcher Agent — all modules listed above ✓
- Drafter Agent ✓
- Auditor Agent ✓
- Analytics Agent ✓
- Weekly cron job (Monday 02:00 WAT) ✓
- Between-cycle monitoring (every 6 hours) ✓
- Performance memory ✓
- Evidence layer (source URL, timestamp, hash) ✓
- Feature health monitoring (all implemented features) ✓

### What Does NOT Ship (Phase 2)
- Human-in-the-Loop Reviewer (workflow UI not built at MVP)
- Deployer Agent (no write access to external systems)
- LangGraph orchestration (Supabase Edge Functions cover MVP)
- Temporal durable execution

---

## Asset Generation — MVP Scope

### What Ships
All asset types via Claude Sonnet 4.6:
- Campaign Brief ✓
- Ad Copy (Facebook, Instagram, Google) ✓
- Event Campaign Brief (AFCON, EPL, Champions League) ✓
- Reactivation Email ✓
- Push Notification Copy ✓
- SMS Copy ✓
- WhatsApp Campaign Copy ✓
- Spend Increase Memo ✓
- SEO Content Brief ✓
- Team Intelligence Brief ✓
- Visual Ad Creative (Ideogram) ✓

Pre-generation at 05:30 WAT (before brand logs in) ✓  
On-demand regeneration ✓  
OpenAI moderation on all assets ✓

---

## Notifications — MVP Scope

### What Ships
- In-app notifications (Supabase Realtime) ✓
- Basic email via Supabase Auth emails (scan complete notification) ✓
- Between-cycle alert logging in database ✓
- Alert history in brand admin ✓

### What Does NOT Ship (Phase 2 — needs Resend)
- Rich HTML email alerts
- WhatsApp delivery
- Slack webhook delivery
- Branded email templates
- Scheduled report email delivery

**Workaround at MVP:** Brands check dashboard for alerts. Between-cycle alerts shown as in-app notification badge. Basic Supabase Auth email for scan completion only.

---

## Build Priority Order

Claude Code builds in this exact sequence. Do not jump ahead.

```
SPRINT 1 — Foundation
━━━━━━━━━━━━━━━━━━━━━
1. Supabase schema implementation
   (all tables, RLS policies, triggers, pgvector)
2. Authentication (Supabase Auth + profiles)
3. Organisation and brand setup
4. Environment variables wired
5. Next.js project scaffold with Tailwind
6. Supabase client setup (server + client)
7. Basic routing structure

SPRINT 2 — Onboarding
━━━━━━━━━━━━━━━━━━━━━
8. Onboarding flow (5 steps)
9. Brand and competitor creation
10. Auto-detect competitor brand and tier
11. Scanning animation state
12. First scan trigger

SPRINT 3 — Agent Pipeline
━━━━━━━━━━━━━━━━━━━━━━━━━
13. Weekly cron job setup
14. Supervisor Agent Edge Function
15. Researcher Agent — SEO module (DataForSEO Labs)
16. Researcher Agent — GEO module (DataForSEO AI API)
17. Researcher Agent — AEO module (DataForSEO SERP)
18. Researcher Agent — Tech Stack module (DetectZeStack)
19. Researcher Agent — App Store module (DataForSEO App)
20. Researcher Agent — Customer module (DataForSEO Content Analysis)
21. Researcher Agent — Regulatory module (Claude RAG)
22. Researcher Agent — Promotions module (DataForSEO OnPage + Content Analysis)
23. Researcher Agent — Hiring module (DataForSEO Jobs SERP)
24. Drafter Agent Edge Function
25. Auditor Agent Edge Function
26. Cache population Edge Function
27. Analytics Agent Edge Function
28. Between-cycle monitoring cron
29. DetectZeStack webhook handler

SPRINT 4 — Regulatory RAG Pipeline
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
30. Document ingestion pipeline
31. PDF upload to Cloudflare R2
32. Document chunking (Claude Haiku)
33. Embedding generation (OpenAI)
34. pgvector similarity search
35. Verbatim RAG retrieval with citation
36. Initial regulatory documents loaded
    (NBGC Nigeria, BCLB Kenya, WCGRB South Africa)

SPRINT 5 — Dashboard & Core UI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
37. Dashboard layout (split-field)
38. Market Position Map (scatter plot)
39. Competitive Radar chart
40. SOV Donut chart
41. Threat Gauge
42. Action Feed (ranked cards)
43. Evidence drawer (expand/collapse)
44. Generate Asset button + inline result
45. Accept/Snooze/Dismiss controls

SPRINT 6 — Intelligence Pages
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
46. GEO / AEO / SEO Visibility page (3 tabs)
47. Regulatory Compliance page
48. Tech Stack Intelligence (within Ads & Spend page)
49. App Store Intelligence (within Customer/Product)
50. Promotions Signals page
51. Hiring & Signals page
52. Customer Intelligence page
53. Action Plan page (full history)
54. Assets Library page
55. Performance & Outcomes page
56. Reports page
57. Brand Chat interface
58. Market Intelligence mode (no-brand)
59. Competitor Profile page

SPRINT 7 — Admin
━━━━━━━━━━━━━━━━━
60. Brand Admin: Configuration
61. Brand Admin: Competitors
62. Brand Admin: Alerts
63. Brand Admin: Billing
64. Internal Admin: System Health
65. Internal Admin: Feature Health Monitor
66. Internal Admin: Agent Control Centre
67. Internal Admin: API Management
68. Internal Admin: Knowledge Base
69. Internal Admin: Security Centre
70. Internal Admin: Revenue Dashboard

SPRINT 8 — Mobile & Polish
━━━━━━━━━━━━━━━━━━━━━━━━━━
71. Mobile Dashboard (responsive)
72. Mobile Action Plan (responsive)
73. Mobile navigation
74. Asset generation (Ideogram integration)
75. In-app notifications
76. Basic email (Supabase Auth)
77. PDF report generation
78. One-link shareable reports
79. End-to-end testing
80. Performance optimisation
```

---

## What Claude Code Must NEVER Build at MVP

```
✗ Firecrawl integration of any kind
✗ Apify integration of any kind
✗ Social media data fetching or display
✗ Facebook Ad Library scraping
✗ Grok API calls
✗ Together AI calls
✗ DeepSeek API calls
✗ Kimi API calls
✗ Resend email integration
✗ Deployer Agent (Phase 2)
✗ LangGraph orchestration (Phase 2)
✗ Temporal (Phase 2)
✗ n8n (Phase 2)
✗ Human-in-the-Loop review UI (Phase 2)
✗ WhatsApp delivery channel (Phase 2)
✗ Slack delivery channel (Phase 2)
✗ Multi-brand per organisation (Phase 2)
✗ White-label functionality (Phase 3)
✗ Public API (Phase 3)
✗ Fintech or FMCG verticals (Phase 3)
```

If any of the above is needed to complete a feature — stop, flag it, and wait for instruction. Do not work around it by building a placeholder that pretends the feature works.

---

## Phase 2 — What Gets Added Next

```
TRIGGER: First 10 paying brands
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

APIs to add:
→ Firecrawl ($16/month)
→ Apify ($29/month)
→ Resend (email, free tier)
→ xAI API (Grok GEO)
→ Together AI (Meta AI GEO)

Features that unlock:
→ Exact promotions data (bonus amounts, wagering)
→ Full social media intelligence
→ Facebook Ad Library commercial ads
→ Ad creative intelligence
→ Social sentiment monitoring
→ Crisis detection
→ Rich HTML email alerts
→ WhatsApp alert delivery
→ Slack alert delivery
→ Grok GEO monitoring (6th platform)
→ Meta AI GEO monitoring (7th platform)
→ Career page crawl (hiring)
→ General competitor web crawl
→ Human-in-the-Loop reviewer UI
→ Deployer Agent
→ LangGraph + Temporal
→ DeepSeek (cost optimisation at scale)
→ Kimi (African language analysis)
→ Daily GEO refresh option
→ n8n workflow automation
```

---

## Phase 3 — Expansion

```
TRIGGER: 50+ paying brands, proven unit economics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

→ Additional African markets (Ghana, Tanzania, Uganda)
→ Fintech vertical
→ FMCG vertical
→ Telecom vertical
→ Multi-brand per organisation
→ Public API for agency access
→ White-label option
→ Microsoft Copilot GEO monitoring
→ Google AI Mode dedicated tracking
```

---

## Definition of Done — MVP v1

Brandscope MVP v1 is complete when:

```
✓ A Nigerian iGaming brand can sign up
✓ Enter their domain and up to 5 competitors
✓ The weekly scan runs automatically on Monday
✓ The dashboard loads in under 1 second on Monday morning
✓ The action plan has 4-8 evidence-backed recommendations
✓ Every recommendation has a clickable source URL
✓ Every recommendation has a pre-generated asset
✓ The GEO page shows AI visibility across 4 platforms
✓ The regulatory page shows compliance scores with verbatim quotes
✓ The brand chat answers questions using real brand data
✓ Between-cycle alerts fire when a competitor changes
✓ The internal admin shows feature health across all brands
✓ The agent control centre shows job traces and prompt versions
✓ Brand admin is fully functional (config, competitors, alerts, billing)
✓ All screens are mobile-responsive
✓ All RLS policies are enforced — no cross-brand data access
✓ All external API calls are server-side only
✓ All generated assets pass OpenAI moderation
✓ The product can be demonstrated to a paying customer
```

---

*This document is LOCKED. Claude Code builds only what is listed under MVP v1. Any request to build Phase 2 or Phase 3 features must reference this document and confirm the scope expansion is intentional. When in doubt — build less, build it properly.*
