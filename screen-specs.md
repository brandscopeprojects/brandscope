# Brandscope — Screen Specs (Quick Reference)

**Condensed from:** Screen Descriptions (Engineering Specs, doc 4 of 10). Full detail lives in that doc + the 30 screen images + `ui-constraints.md` (design system).
**Scope:** 32 screens = 30 core + 2 interaction states. Chart library throughout: **Recharts** (custom SVG for the Threat Gauge).
**Use this file** for routes, data wiring, and component names when building/modifying any screen. For *look & behaviour*, consult `ui-constraints.md` first.

**Conventions:** Brand-facing routes are bare (`/dashboard`). Brand admin = `/admin/*` (Admin role). Internal admin = `/brandscope-admin/*` (separate internal auth). Most data reads come from pre-computed `*_cache` tables (cron-populated) per the PRD's cron-first architecture.

---

## Brand-Facing Screens

| # | Screen | Route | Auth | Primary data source(s) | Key components |
|---|---|---|---|---|---|
| 1 | Onboarding: Brand Setup | `/onboarding` | Unauth / new user, no brand | writes `brands`, `competitors` | OnboardingWizard (2 steps: Domain → Confirm & Launch, with an Analyzing interstitial while the setup agent runs), MarketCombobox, CompetitorList, AutoDetectInput, TextInput, PrimaryButton. Industry silently defaults to `igaming` (single-vertical MVP — no industry screen); markets are GLOBAL (all countries selectable; regulatory-coverage hint shown at selection time). |
| 2 | Onboarding: Scanning State | `/onboarding/scanning` | Auth, brand configured | reads `scan_jobs` (poll 5s) | RadarAnimation, ProgressChecklist, ProgressBar, StatusPoller |
| 3 | **Dashboard** | `/dashboard` | Auth, scan complete | `weekly_cache`, `brands`, `scan_jobs` | ScatterMap, RadarChart, SOVDonut, ThreatGauge, FilterChips, ActionCard, EvidenceDrawer, GenerateAssetButton |
| 4 | Market Intelligence (no-brand) | `/market-intel` | Auth (brand or no-brand) | `market_intelligence_cache`, `competitors` | MarketPositionMap, StatStrip, TrendFeed, MarketEntryTable |
| 5 | Competitor Profile | `/competitors/[competitor_id]` | Auth | `competitor_profiles`, `competitor_changes`, `weekly_cache` | CompetitorHeader, TabNav, MetricStrip, ChangeTimeline, ActionCard |
| 6 | Promotions Intelligence | `/promotions` | Auth | `promotions_cache`, `weekly_cache` | StatStrip, ComparisonTable, WoWIndicator, ActionCard |
| 7 | Traffic & SEO Intelligence | `/traffic-seo` | Auth | `seo_cache` (DataForSEO Labs) | TrafficChart, DomainAuthorityChart, KeywordGapTable, SERPTracker, ActionCard |
| 8 | Social & Ads Intelligence | `/social-ads` | Auth | **MVP: PLACEHOLDER** — social "coming soon"; Ad Network Intelligence section from `tech_stack_cache` (DetectZeStack). Full social via `social_cache`/`ads_cache` = Phase 2 (Apify) | SocialComparisonTable, AdCard, SpendTierBadge, SimilarityFlag, ActionBar |
| 9 | Tech Stack & Ad Network Intelligence | `/tech-stack` | Auth | `tech_stack_cache` (DetectZeStack) | SpendScorecard, AdNetworkTable, TechStackTable, ChannelMixChart, ActionCard |
| 10 | Product Intelligence | `/products` | Auth | **MVP: DOES NOT SHIP as standalone** — product/app-store data merged into `/competitors/[id]` (`product_intel_cache`, app data) | VerticalCard, ProductMatrix, AviatorPanel, ActionCard |
| 11 | Customer Intelligence | `/customers` | Auth | `customer_intelligence_cache`, `app_reviews_cache`, `social_sentiment_cache` | TrafficSourceChart, DemographicsPanel, IntentBubbleChart, ComplaintHeatMap, SentimentTrendChart |
| 12 | Regulatory Compliance | `/regulatory` | Auth | `regulatory_cache`, `regulatory_documents`, `compliance_scores` | ComplianceMatrix, RegulatoryFeed, ComplianceAudit, ViolationAlerts |
| 13 | Hiring & Signals | `/hiring-signals` | Auth | `hiring_signals_cache` (Firecrawl), `hiring_intelligence` (Claude) | MetricStrip, HiringTimeline, SignalTag, SignalIntelligencePanel, AfricaMap |
| 14 | GEO / AEO / SEO Visibility | `/geo-aeo-seo` | Auth | `geo_cache` (DataForSEO AI Opt.), `aeo_cache`, `seo_cache` | AIVisibilityScore, PlatformBreakdownTable, AIScorecard, TabNav, KeywordGapTable, SERPTracker, VisibilityTrendChart |
| 15 | Action Plan | `/action-plan` | Auth | `action_plan_cache`, `action_outcomes` | FilterChips, ActionRow, EvidenceDrawer, StatusControls, OutcomeLogger, AssetGenerationResult |
| 16 | Assets Library | `/assets` | Auth | `generated_assets` | AssetCard, AssetTypeIcon, AssetGrid, AssetSearch, AssetPreview |
| 17 | Performance & Outcomes | `/performance` | Auth | `action_outcomes`, `performance_memory`, `brand_benchmarks` | MetricCard, OutcomeTable, MemoryInsightCard, BenchmarkChart |
| 18 | Reports | `/reports` | Auth | `reports`, `report_schedule` | ReportTypeCard, ReportsTable, ReportPreview, ScheduledReports |
| 19 | Brand Chat | `/chat` | Auth | `chat_conversations` (+ GPT-4.1 Mini; brand context injected) | ConversationList, ChatMessage, InlineDataTable, SuggestedPrompts, ChatInput |

### Canonical Routes (MVP reconciliation)
Resolves route drift between the screen doc and `docs/mvp-scope.md` (MVP wins):
- **`/tech-stack`** — Tech Stack & Ad Network Intelligence (full build, DetectZeStack). This replaces the old `/ads-spend`; there is no standalone `/ads-spend` route.
- **`/social-ads`** — placeholder page: social "coming soon" + an Ad Network Intelligence summary sourced from `tech_stack_cache` (links to `/tech-stack`).
- **`/products`** — does **not** ship as a standalone page at MVP. Product vertical + App Store data render inside **`/competitors/[id]`** (and complaint/sentiment within `/customers`).
- **`/promotions`** — titled **"Promotion Signals"** at MVP (signal-based, no exact bonus numbers); route unchanged.
- App Store Intelligence has **no standalone route** — it lives within `/competitors/[id]` and `/customers`.

> Note: several `Primary data source(s)` cells in the tables above still name full-product/Phase-2 tables (`ads_cache`, `aeo_cache`, `compliance_scores`, `app_reviews_cache`, `social_sentiment_cache`, `hiring_intelligence`, `action_plan_cache`, `report_schedule`, `api_health`, `api_cost_logs`, `cost_logs`). The authoritative table names are in `docs/schema-amendments.md` + `brandscopeschema.md`; at build time use those (e.g. ads→`social_cache.ads_data`, aeo→`geo_cache`, compliance→`regulatory_cache`, app reviews→`product_intel_cache`/`customer_intel_cache`).

## Brand Admin Screens (Admin role)

| # | Screen | Route | Auth | Primary data source(s) | Key components |
|---|---|---|---|---|---|
| 20 | Config | `/admin/settings` | Auth, Admin | `brands`, `brand_preferences` | TabNav, FormField, ColourPicker, LogoUpload, MiniPositionMap, ModuleToggle |
| 21 | Competitors | `/admin/competitors` | Auth, Admin | `competitors`, `brand_competitors` | DraggableList, CompetitorRow, ModuleToggleIcons, AutoDetectInput, UpgradeCTA |
| 22 | Alerts Config | `/admin/alerts` | Auth, Admin | `alert_config`, `alert_history` | AlertTriggerTable, ThresholdInput, ActiveToggle, DeliveryChannelConfig, AlertHistory |
| 23 | Billing | `/admin/billing` | Auth, Admin | `subscriptions`, `payment_history`, `usage_metrics` | PlanCard, PlanComparisonTable, UsageProgressBar, PaymentHistory, PaymentMethod |

## Internal Admin Screens (separate internal auth)

| # | Screen | Route | Auth | Primary data source(s) | Key components |
|---|---|---|---|---|---|
| 24 | System Health | `/brandscope-admin/health` | Internal admin | `system_health`, `feature_health_logs`, `cron_job_logs`, `api_health_logs` | SystemStatusStrip, FeatureHealthTable, FeatureBreakdownPanel, CronJobTable, APIHealthTable |
| 25 | Agent Control Centre | `/brandscope-admin/agents` | Internal admin | `agents`, `agent_skills`, `agent_job_logs`, `prompt_versions` | AgentSidebar, AgentHeader, SkillsList, JobTraceTable, PromptVersionControl |
| 26 | API Management | `/brandscope-admin/api-management` | Internal admin | `api_health`, `model_router_config`, `api_cost_logs` | APIHealthCards, ModelRouterTable, CircuitBreakerPanel, CostAnalyticsChart |
| 27 | Knowledge Base | `/brandscope-admin/knowledge-base` | Internal admin | `regulatory_documents`, `document_chunks`, `ingestion_logs` | DocumentTable, EmbeddingStatusBadge, DocumentPreviewPanel, ChunkViewer, IngestionPipeline |
| 28 | Security Centre | `/brandscope-admin/security` | Internal admin (**Super Admin only**) | `active_sessions`, `failed_logins`, `audit_logs`, `rbac_config` | SecurityStatusStrip, SessionTable, FailedLoginsTable, RBACMatrix, AuditLog |
| 29b | HQ Chat (Internal Ops Agent) | `/brandscope-admin/chat` | Internal admin | tool-calling reads (v2 agent, owner-approved 2026-07): `brands`, `subscriptions`, `payment_history`, `revenue_metrics`, `churn_events`, `agent_job_logs`, `scan_jobs`, `dead_letter_queue`, `cron_job_logs`, `feature_health_logs`, `profiles`, `active_sessions`, `failed_logins` | HqChat (persistent: `hq_conversations`/`hq_messages`/`hq_agent_memory`, migration 16 — reactions are the learning signal, memory is owner-curated) |
| 29 | Revenue Dashboard | `/brandscope-admin/revenue` | Internal admin | `subscriptions`, `revenue_metrics`, `churn_events`, `cost_logs` | MetricCard, MRRTrendChart, BrandRevenueTable, ChurnRiskBadge, CohortGrid, CostRevenueChart |

## Mobile Screens & Interaction States

| # | Screen | Route / Trigger | Auth | Primary data source(s) | Key components |
|---|---|---|---|---|---|
| 30 | Mobile Dashboard | `/dashboard` (responsive ≤375px) | Auth | same as Dashboard (`weekly_cache`…) | MobileActionCard, QuickStatsGrid, BottomNav, MobileGauge |
| 31 | Mobile Action Plan | `/action-plan` (responsive ≤375px) | Auth | same as Action Plan (`action_plan_cache`…) | (mobile) FilterChips, ActionCard, BottomNav |
| 32 | Asset Generation Result | *inline, on "Generate Asset" click* (never a modal) | Auth | writes `generated_assets` (Claude Sonnet 4.6) | AssetGenerationResult, AssetTypeIcon, ChannelBadge, AssetFooterActions, LoadingState |

---

## Cross-Screen Notes (load-bearing)

- **`ActionCard` is the most reused component** — appears on screens 3, 5, 6, 7, 9, 10, 12, 14, 15, 30, 31. Build it once, fully, per `ui-constraints.md` §7. `AssetGenerationResult` (screen 32) renders **inline below** the card that triggered it — never a modal.
- **Cache-first reads:** nearly every intelligence screen reads a cron-populated `*_cache` table, not a live API. Live API calls happen in the weekly/6-hourly cron (Researcher agent), not in page loads. Keeps dashboard <1s.
- **`weekly_cache`** is the spine — Dashboard, Competitor Profile, and Promotions all read from it (filtered).
- **Onboarding (screen 2) is the only dark screen** (`#141416`) — explicit, intentional exception to the light theme.
- **Three auth tiers:** brand user (Auth) → brand Admin (`/admin/*`) → internal admin (`/brandscope-admin/*`, with Security Centre gated to Super Admin). RLS enforces brand isolation; internal admin is a separate environment brands never see.
- **Confidence indicator:** desktop = **3 bars** (HIGH/MED/LOW, green/amber/red); mobile (screen 31) = **dots**. (Resolves the bars-vs-dots question in `ui-constraints.md` §15.1 — bars canonical on desktop, dots on mobile.)
- **Data-source ↔ provider map:** `seo_cache`/`geo_cache`/`aeo_cache`/`app_reviews_cache` = DataForSEO · `social_cache`/`ads_cache` = Apify · `tech_stack_cache` = DetectZeStack · `hiring_signals_cache` = Firecrawl · `hiring_intelligence`/asset gen = Claude · chat = GPT-4.1 Mini. Table names here are the contract the DB schema doc (next) must satisfy.
