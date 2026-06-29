# Brandscope — Screen Specs (Quick Reference)

**Condensed from:** Screen Descriptions (Engineering Specs, doc 4 of 10). Full detail lives in that doc + the 30 screen images + `ui-constraints.md` (design system).
**Scope:** 32 screens = 30 core + 2 interaction states. Chart library throughout: **Recharts** (custom SVG for the Threat Gauge).
**Use this file** for routes, data wiring, and component names when building/modifying any screen. For *look & behaviour*, consult `ui-constraints.md` first.

**Conventions:** Brand-facing routes are bare (`/dashboard`). Brand admin = `/admin/*` (Admin role). Internal admin = `/brandscope-admin/*` (separate internal auth). Most data reads come from pre-computed `*_cache` tables (cron-populated) per the PRD's cron-first architecture.

---

## Brand-Facing Screens

| # | Screen | Route | Auth | Primary data source(s) | Key components |
|---|---|---|---|---|---|
| 1 | Onboarding: Brand Setup | `/onboarding` | Unauth / new user, no brand | writes `brands`, `competitors` | StepIndicator, TextInput, MultiSelectChips, AutoDetectInput, CompetitorList, PrimaryButton |
| 2 | Onboarding: Scanning State | `/onboarding/scanning` | Auth, brand configured | reads `scan_jobs` (poll 5s) | RadarAnimation, ProgressChecklist, ProgressBar, StatusPoller |
| 3 | **Dashboard** | `/dashboard` | Auth, scan complete | `weekly_cache`, `brands`, `scan_jobs` | ScatterMap, RadarChart, SOVDonut, ThreatGauge, FilterChips, ActionCard, EvidenceDrawer, GenerateAssetButton |
| 4 | Market Intelligence (no-brand) | `/market-intel` | Auth (brand or no-brand) | `market_intelligence_cache`, `competitors` | MarketPositionMap, StatStrip, TrendFeed, MarketEntryTable |
| 5 | Competitor Profile | `/competitors/[competitor_id]` | Auth | `competitor_profiles`, `competitor_changes`, `weekly_cache` | CompetitorHeader, TabNav, MetricStrip, ChangeTimeline, ActionCard |
| 6 | Promotions Intelligence | `/promotions` | Auth | `promotions_cache`, `weekly_cache` | StatStrip, ComparisonTable, WoWIndicator, ActionCard |
| 7 | Traffic & SEO Intelligence | `/traffic-seo` | Auth | `seo_cache` (DataForSEO Labs) | TrafficChart, DomainAuthorityChart, KeywordGapTable, SERPTracker, ActionCard |
| 8 | Social & Ads Intelligence | `/social-ads` | Auth | `social_cache` (Apify), `ads_cache` (FB Ad Library) | SocialComparisonTable, AdCard, SpendTierBadge, SimilarityFlag, ActionBar |
| 9 | Ads & Spend Intelligence | `/ads-spend` | Auth | `tech_stack_cache` (DetectZeStack), `ads_cache` | SpendScorecard, AdNetworkTable, TechStackTable, ChannelMixChart, ActionCard |
| 10 | Product Intelligence | `/products` | Auth | `product_intelligence_cache`, `app_reviews_cache` | VerticalCard, ProductMatrix, AviatorPanel, ActionCard |
| 11 | Customer Intelligence | `/customers` | Auth | `customer_intelligence_cache`, `app_reviews_cache`, `social_sentiment_cache` | TrafficSourceChart, DemographicsPanel, IntentBubbleChart, ComplaintHeatMap, SentimentTrendChart |
| 12 | Regulatory Compliance | `/regulatory` | Auth | `regulatory_cache`, `regulatory_documents`, `compliance_scores` | ComplianceMatrix, RegulatoryFeed, ComplianceAudit, ViolationAlerts |
| 13 | Hiring & Signals | `/hiring-signals` | Auth | `hiring_signals_cache` (Firecrawl), `hiring_intelligence` (Claude) | MetricStrip, HiringTimeline, SignalTag, SignalIntelligencePanel, AfricaMap |
| 14 | GEO / AEO / SEO Visibility | `/geo-aeo-seo` | Auth | `geo_cache` (DataForSEO AI Opt.), `aeo_cache`, `seo_cache` | AIVisibilityScore, PlatformBreakdownTable, AIScorecard, TabNav, KeywordGapTable, SERPTracker, VisibilityTrendChart |
| 15 | Action Plan | `/action-plan` | Auth | `action_plan_cache`, `action_outcomes` | FilterChips, ActionRow, EvidenceDrawer, StatusControls, OutcomeLogger, AssetGenerationResult |
| 16 | Assets Library | `/assets` | Auth | `generated_assets` | AssetCard, AssetTypeIcon, AssetGrid, AssetSearch, AssetPreview |
| 17 | Performance & Outcomes | `/performance` | Auth | `action_outcomes`, `performance_memory`, `brand_benchmarks` | MetricCard, OutcomeTable, MemoryInsightCard, BenchmarkChart |
| 18 | Reports | `/reports` | Auth | `reports`, `report_schedule` | ReportTypeCard, ReportsTable, ReportPreview, ScheduledReports |
| 19 | Brand Chat | `/chat` | Auth | `chat_conversations` (+ GPT-4.1 Mini; brand context injected) | ConversationList, ChatMessage, InlineDataTable, SuggestedPrompts, ChatInput |

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
