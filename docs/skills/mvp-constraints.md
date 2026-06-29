# MVP Constraints — Scope Gate (check BEFORE any new feature/integration/scope decision)

**This is the top authority on what to build.** Full doc: `docs/mvp-scope.md`.
**Governing rule:** Build depth, not breadth. Production-quality only — no placeholders, no fake data, no "coming soon" *inside* a v1 feature.
**If something you're about to build is NOT on this list → STOP and flag it before proceeding.** Where this file conflicts with the API map / agent-arch / data-flow / env-vars docs, **MVP wins** (those docs describe the full Phase-2 system; MVP is a strict subset).

---

## 1. Confirmed API stack (build ONLY with these)

```
IN STACK:
✓ Supabase (DB, Edge Functions, cron, pgvector, auth)
✓ DataForSEO (SEO, traffic, SERP, AEO, GEO, app reviews, content analysis, OnPage)
✓ Claude API (Sonnet 4.6 + Haiku 4.5)
✓ OpenAI API (GPT-4.1 Mini, embeddings, moderation)
✓ DetectZeStack (tech stack + ad network)
✓ Ideogram API (ad creative images)
✓ Cloudflare R2 (PDF/evidence storage)

NOT IN STACK — DO NOT BUILD FOR:
✗ Firecrawl  ✗ Apify  ✗ xAI/Grok  ✗ Together AI/Meta  ✗ DeepSeek  ✗ Kimi  ✗ Resend
```

> Implication: every Researcher module sources from **DataForSEO / DetectZeStack / Claude** only. No web crawling, no social scraping, no extra LLM providers, no transactional email service at MVP.

---

## 2. The 10 modules — exact MVP status

| # | Module | Status | MVP data source | Notes |
|---|---|---|---|---|
| 1 | GEO Intelligence | ✓ **FULL** | DataForSEO AI Optimization (LLM Responses + LLM Mentions) | **4 platforms only: ChatGPT, Claude, Gemini, Perplexity.** No Grok/Meta/Copilot. Weekly only. |
| 2 | AEO Intelligence | ✓ **FULL** | DataForSEO SERP (Google Organic adv) + OnPage (microdata) | snippets, PAA, schema, knowledge panel |
| 3 | SEO Intelligence | ✓ **FULL** | DataForSEO Labs + Keywords Data | 100 keyword gaps, 50 tracked keywords, 12-wk trend |
| 4 | Tech Stack & Ad Network | ✓ **FULL** | DetectZeStack (detect + webhook) | incl. spend-intensity scoring, WoW change, webhook alerts |
| 5 | App Store Intelligence | ✓ **FULL** | DataForSEO App Data + Labs Google Play | 200 reviews/competitor, Google + Apple |
| 6 | Customer Intelligence | ✓ **PARTIAL** | DataForSEO (traffic/content analysis/app reviews) | inferred demographics; missing fields labelled "Requires social intelligence — Phase 2". No fake numbers. |
| 7 | Regulatory Intelligence | ✓ **FULL** | Claude Sonnet RAG + pgvector + R2 + DataForSEO News + OpenAI embeddings | verbatim RAG, NG/KE/ZA, view-source PDF |
| 8 | Promotions | ⚠ **PARTIAL** | DataForSEO OnPage Content Parsing + Content Analysis + News | page titled **"Promotion Signals"** (not Tracker). Signals only — **no exact bonus/wagering numbers**. Tooltip explains. |
| 9 | Hiring & Signals | ⚠ **PARTIAL** | DataForSEO Google Jobs SERP | ~70% coverage; no career-page crawl, no full JD text |
| 10 | Social & Ads | ✗ **PLACEHOLDER** | DetectZeStack only | Social = "coming soon" copy. **Ad Network section IS built** (renamed "Ad Network Intelligence") + spend-intensity. No fake social data. |

**Page that does NOT ship:** Product Intelligence (merged into Competitor Profile / App Store data).

---

## 3. NEVER build at MVP (hard list)

```
✗ Firecrawl (any kind)            ✗ Deployer Agent (Phase 2)
✗ Apify (any kind)                ✗ LangGraph orchestration (Phase 2)
✗ Social media fetch/display      ✗ Temporal (Phase 2)
✗ Facebook Ad Library scraping    ✗ n8n (Phase 2)
✗ Grok / xAI calls                ✗ Human-in-the-Loop review UI (Phase 2)
✗ Together AI / Meta calls        ✗ WhatsApp delivery (Phase 2)
✗ DeepSeek calls                  ✗ Slack delivery (Phase 2)
✗ Kimi calls                      ✗ Multi-brand per organisation (Phase 2)
✗ Resend email                    ✗ White-label (Phase 3)
                                  ✗ Public API (Phase 3)
                                  ✗ Fintech / FMCG / Telecom verticals (Phase 3)
```

If any of these is needed to finish a feature: **stop, flag, wait.** Never fake it with a placeholder that pretends to work.

**Agent pipeline at MVP:** Supervisor ✓ Researcher ✓ Drafter ✓ Auditor ✓ Analytics ✓ — **no Reviewer (HITL), no Deployer.** Orchestration = Supabase Edge Functions + cron only (no LangGraph/Temporal).
**Notifications at MVP:** in-app (Supabase Realtime) + Supabase Auth email (scan-complete only) + DB alert logging. No rich email / WhatsApp / Slack.

---

## 4. Build priority order (80 steps — do NOT jump ahead)

```
SPRINT 1 — Foundation
 1 Supabase schema (tables, RLS, triggers, pgvector)   5 Next.js scaffold + Tailwind
 2 Auth (Supabase Auth + profiles)                      6 Supabase client (server + client)
 3 Organisation + brand setup                           7 Basic routing structure
 4 Env vars wired

SPRINT 2 — Onboarding
 8 Onboarding flow (5 steps)        10 Auto-detect competitor brand + tier   12 First scan trigger
 9 Brand + competitor creation      11 Scanning animation state

SPRINT 3 — Agent Pipeline
13 Weekly cron setup                19 Researcher: App Store (DataForSEO App)      25 Auditor Agent
14 Supervisor Agent EF              20 Researcher: Customer (Content Analysis)      26 Cache population EF
15 Researcher: SEO (Labs)           21 Researcher: Regulatory (Claude RAG)         27 Analytics Agent EF
16 Researcher: GEO (AI API)         22 Researcher: Promotions (OnPage+Content)     28 Between-cycle cron
17 Researcher: AEO (SERP)           23 Researcher: Hiring (Jobs SERP)              29 DetectZeStack webhook
18 Researcher: Tech Stack (DZS)     24 Drafter Agent EF

SPRINT 4 — Regulatory RAG
30 Doc ingestion pipeline   32 Chunking (Haiku)        34 pgvector search        36 Initial docs (NBGC/BCLB/WCGRB)
31 PDF → R2                 33 Embeddings (OpenAI)      35 Verbatim RAG + citation

SPRINT 5 — Dashboard & Core UI
37 Split-field layout   39 Radar    41 Threat Gauge      43 Evidence drawer       45 Accept/Snooze/Dismiss
38 Market Position Map  40 SOV Donut 42 Action Feed       44 Generate Asset + inline result

SPRINT 6 — Intelligence Pages
46 GEO/AEO/SEO (3 tabs)  49 App Store (in Customer/Product)  52 Customer        55 Performance   58 Market Intel (no-brand)
47 Regulatory            50 Promotions Signals               53 Action Plan     56 Reports       59 Competitor Profile
48 Tech Stack            51 Hiring & Signals                 54 Assets Library  57 Brand Chat

SPRINT 7 — Admin
60 BA Config   62 BA Alerts    64 IA System Health     66 IA Agent Control   68 IA Knowledge Base   70 IA Revenue
61 BA Competitors 63 BA Billing 65 IA Feature Health    67 IA API Management   69 IA Security

SPRINT 8 — Mobile & Polish
71 Mobile Dashboard  73 Mobile nav             75 In-app notifications  77 PDF reports          79 E2E testing
72 Mobile Action Plan 74 Ideogram asset gen    76 Basic email (Auth)    78 One-link share       80 Perf optimisation
```

---

## 5. Definition of Done — MVP v1 (all 20 must be true)

```
 1 ✓ A Nigerian iGaming brand can sign up
 2 ✓ Enter domain + up to 5 competitors          ← NOTE: DoD says 5 (onboarding/schema/pricing imply 10 — see flags)
 3 ✓ Weekly scan runs automatically on Monday
 4 ✓ Dashboard loads <1s Monday morning
 5 ✓ Action plan: 4–8 evidence-backed recommendations
 6 ✓ Every recommendation has a clickable source URL
 7 ✓ Every recommendation has a pre-generated asset
 8 ✓ GEO page shows AI visibility across 4 platforms
 9 ✓ Regulatory page shows compliance scores with verbatim quotes
10 ✓ Brand chat answers using real brand data
11 ✓ Between-cycle alerts fire when a competitor changes
12 ✓ Internal admin shows feature health across all brands
13 ✓ Agent control centre shows job traces + prompt versions
14 ✓ Brand admin fully functional (config, competitors, alerts, billing)
15 ✓ All screens mobile-responsive
16 ✓ All RLS policies enforced — no cross-brand access
17 ✓ All external API calls server-side only
18 ✓ All generated assets pass OpenAI moderation
19 ✓ Product can be demonstrated to a paying customer
20 ✓ (Governing) Every shipped v1 feature is production-quality — no fake data/placeholders inside v1 pages
```

---

## Conflicts to remember (MVP overrides earlier docs)
- Researcher modules in API-map/agent-arch use **Firecrawl/Apify** for promotions, hiring, social, ads, reviews → at MVP re-source to **DataForSEO** (promotions=OnPage+Content, hiring=Jobs SERP, reviews=App Data) or **defer** (social/ads=placeholder). `docs/skills/data-flow-rules.md` module→table map lists Phase-2 providers — apply this MVP overlay.
- GEO `geo_cache` Grok/Meta columns → **not populated at MVP** (4 platforms only).
- Between-cycle monitor's Firecrawl promo spot-check → **not at MVP** (DetectZeStack webhook + DataForSEO News only).
- HITL `pending_review` status / Reviewer → **not at MVP** (no review UI).
- Resend / WhatsApp / Slack delivery → **not at MVP** (in-app + Supabase Auth email only).
- Competitor cap: DoD says **5**; onboarding/schema/pricing say **10** — unresolved, flag before building onboarding limit.
