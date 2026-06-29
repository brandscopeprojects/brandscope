# Feature Health Registry — 337 features

**Check before:** the cache-population feature-health step (Sprint 3) and the Feature Health Monitor (Screen 24 / feature #305, Sprint 7).

The weekly feature-health check writes one `feature_health_logs` row per feature per brand, with `status` ∈ `passed | partial | failed` and `feature_tier` ∈ `critical | important | supplementary`. Presence check = the Supabase `table.field` whose non-null value for that brand+scan_week confirms the feature ran.

## Brand health score calculation (authoritative)
- **P2 features** (Phase-2 / excluded — Apify, Firecrawl, Grok, Together, exact-promo, Market-mode, Deployer, HITL, infra, evals) log `status = 'not_applicable_mvp'` and are **excluded** from the brand health percentage.
- Formula:
  ```
  brand_health_pct = (passed + partial) / (total_features − P2_features) × 100
  ```
- Tiers gate alerts (per PRD): **Critical** target 100% (immediate alert + auto-retry), **Important** 95%+ (dashboard alert + retry next cycle), **Supplementary** 85%+ (log only unless failing 3+ weeks).

## Tiering principle
DoD-critical & core-pipeline = **C**; full/partial MVP module features = **I**; secondary analyses = **S**; Apify/Firecrawl/Grok/Together/exact-promo/Market-mode/Deployer/HITL/infra/eval features = **P2** (not checked at MVP).

---

## Core Intelligence
1 Brand vs Market Comparison — C — weekly_cache.reach_score
2 Competitive Threat Scoring & Gauge — C — weekly_cache.threat_score
3 Share of Voice Analysis — I — weekly_cache.sov_pct
4 Weekly Intelligence Brief — C — action_plans.id
5 Brand Health Scorecard — I — weekly_cache.radar_data
6 Competitive Position Dashboard — C — weekly_cache.id
7 Market Position Map — C — weekly_cache.reach_score & aggression_score
8 Competitive Radar — I — weekly_cache.radar_data

## Competition Monitoring
9 Competitor Detection & Tracking — C — brand_competitors.id
10 Competitor Website Crawling — P2 — (Firecrawl)
11 Pricing & Positioning Change Detection — S — competitor_changes(change_type='pricing')
12 Competitor Content Monitoring — P2 — (Firecrawl)
13 Week-on-Week Competitor Snapshot — I — competitor_profiles.scan_week
14 Automatic Brand Discovery — S — competitors.first_seen_at
15 Competitor Master Database — I — competitors.id

## Promotions & Bonus Intelligence (MVP = signals only)
16 Live Promotion Tracker (Signals) — C — promotions_cache.id
17 Bonus Value Change Detection — S — promotions_cache.wow_bonus_change_pct (exact amount = Phase 2)
18 Wagering Requirement Monitoring — P2 — (exact = Firecrawl)
19 Promotion Type Breakdown — I — promotions_cache.promo_type
20 Event-Specific Campaign Detection — S — promotions_cache.raw_data
21 Reactivation Campaign Detection — S — promotions_cache.raw_data
22 Week-on-Week Promo Comparison — S — promotions_cache.wow_bonus_change_pct
23 Promotion History Archive — I — promotions_cache (scan_week history)
24 Evidence & Source per Promo — C — promotions_cache.evidence_hash
25 Seasonal Promotion Pattern — S — promotions_cache.raw_data
26 Promotion ROI Inference — S — promotions_cache.raw_data

## Traffic & SEO Intelligence
27 Competitor Traffic Estimation — C — seo_cache.estimated_traffic
28 Organic vs Paid Split — I — seo_cache.organic_traffic & paid_traffic
29 Traffic Trend Analysis — I — seo_cache (scan_week history)
30 Domain Authority Comparison — I — seo_cache.domain_authority
31 Keyword Gap Analysis — C — seo_cache.keyword_gaps
32 SERP Position Monitoring — C — seo_cache.serp_positions
33 Google Ads Intelligence — I — seo_cache.google_ads_data
34 Competitor Keyword Rankings — I — seo_cache.raw_data
35 Content Gap Identification — I — seo_cache.content_gaps
36 SEO Opportunity Prioritisation — S — seo_cache.raw_data
37 Backlink Profile Summary — S — seo_cache.raw_data
38 Organic Traffic Value Estimation — S — seo_cache.raw_data
39 Content-to-Traffic Correlation — S — seo_cache.raw_data
40 Keyword Ownership Trend — S — seo_cache.raw_data

## AEO Intelligence
41 Featured Snippet Ownership — I — geo_cache.featured_snippets
42 People Also Ask Monitoring — I — geo_cache.paa_appearances
43 Schema Markup Analysis — S — seo_cache.raw_data (OnPage microdata)
44 Voice Search Query Signals — S — seo_cache.raw_data
45 Knowledge Panel Monitoring — S — geo_cache.raw_data

## GEO Intelligence
46 ChatGPT Visibility — C — geo_cache.chatgpt_mentioned
47 Perplexity Visibility — C — geo_cache.perplexity_mentioned
48 Gemini Visibility — C — geo_cache.gemini_mentioned
49 Grok Visibility — P2 — (xAI)
50 Meta AI / WhatsApp Visibility — P2 — (Together)
51 Google AI Overview — P2 —
52 Google AI Mode — P2 —
53 Copilot Visibility — P2 —
54 Composite AI Visibility Score — C — geo_cache.ai_visibility_score
55 AI Recommendation Sentiment — I — geo_cache.chatgpt_sentiment (any platform)
56 Competitor AI Scorecard — I — geo_cache.competitor_ai_scores
57 AI Citation Source Detection — S — geo_cache.raw_data
58 AI Accuracy Monitoring — S — geo_cache.raw_data
59 AI Visibility Trend — I — geo_cache.score_change_wow
60 GEO Content Gap Analysis — I — geo_cache.raw_data
61 GEO Action Recommendations — I — recommendations(category='geo_aeo')
62 Auto-Generated Prompt Discovery — S — geo_query_templates.id
63 Multi-Market GEO Comparison — S — geo_cache (market rows)
64 Brand Narrative Drift — S — geo_cache.raw_data
65 Unknown Competitor Surfacing — S — geo_cache.top_ai_mentions
66 AI Referral Traffic — P2 —
67 Technical AI-Readiness Audit — S — seo_cache.raw_data
68 AI-Optimised Content Delivery (CDN) — P2 —
69 Adversarial Recommendation Stress-Test — P2 —

## Social & Ad Intelligence (Apify — Phase 2)
70 Competitor Social Profile Monitoring — P2 —
71 Social Engagement Benchmarking — P2 —
72 Content Theme Detection — P2 —
73 Post Frequency & Cadence — P2 —
74 Facebook Ad Library Tracking — P2 —
75 Ad Volume & Frequency — P2 —
76 Ad Creative Theme — P2 —
77 Ad Creative Fatigue — P2 —
78 Influencer & Partnership Signal — P2 —
79 Social Sentiment Monitoring — P2 —
80 Crisis & Viral Moment Detection — P2 —
81 TikTok Campaign Monitoring — P2 —
82 YouTube Campaign Intelligence — P2 —
83 Community Intelligence — P2 —

## Ad Network & Spend Intelligence (DetectZeStack — MVP)
84 Ad Network Detection — I — tech_stack_cache.ad_networks
85 Technology Stack Fingerprinting — C — tech_stack_cache.technologies
86 New Ad Network Alert — S — competitor_changes(change_type='tech_stack')
87 Affiliate Programme Detection — S — tech_stack_cache.raw_response
88 Retargeting Platform Detection — S — tech_stack_cache.technologies
89 Spend Intensity Scoring — I — competitor_profiles.aggression_score
90 Ad Spend Change Detection — S — competitor_changes
91 Channel Mix Analysis — S — tech_stack_cache.raw_response
92 Paid vs Organic Efficiency — S — seo_cache.raw_data
93 CDN & Infrastructure Detection — I — tech_stack_cache.cdn_providers
94 CRM/Engagement Stack Detection — I — tech_stack_cache.crm_tools
95 A/B Testing Tool Detection — S — tech_stack_cache.technologies
96 Tech Stack Upgrade Signal — S — tech_stack_cache.changes_detected

## Hiring & Product Signals
97 Competitor Hiring Intelligence — I — hiring_signals_cache.roles
98 Product Direction from Job Posts — S — hiring_signals_cache.interpreted_signals
99 Geographic Expansion Detection — I — hiring_signals_cache.geographic_expansion
100 Engineering Velocity Scoring — S — hiring_signals_cache.raw_data
101 Multi-Market Expansion Detection — S — hiring_signals_cache.raw_data

## Brand Baseline
102 Brand Onboarding & Positioning — C — brands.positioning_statement
103 Own Ad Network & Tech Scan — I — tech_stack_cache (own)
104 Own Promotion Baseline — I — promotions_cache (own)
105 Own Traffic & SEO Baseline — I — seo_cache (own)
106 Own Social Baseline — P2 —
107 Brand Tier & Stage Classification — C — brands.tier

## Product Intelligence (iGaming)
108 Product Vertical Mapping — I — product_intel_cache.sports_betting_status
109 Promotion-to-Product Classification — S — product_intel_cache.raw_data
110 Ad Spend by Product Vertical — P2 —
111 Customer Engagement by Product — S — product_intel_cache.raw_data
112 Product-Specific Sentiment — I — customer_intel_cache.sentiment_score
113 Product Gap Analysis — S — product_intel_cache.raw_data
114 Product Lifecycle Stage — S — product_intel_cache.raw_data
115 Product-Specific Ad Creative — P2 —
116 Product Promotion Timing — S — product_intel_cache.raw_data
117 New Product Launch Detection — I — product_intel_cache.new_products_detected
118 Odds Competitiveness Analysis — S — product_intel_cache.odds_competitiveness_score
119 Sports & Markets Coverage — S — product_intel_cache.raw_data
120 Crash Game Intelligence (Aviator) — I — product_intel_cache.aviator_promo_active
121 Casino Product Intelligence — S — product_intel_cache.casino_status
122 Lottery Product Intelligence — S — product_intel_cache.lottery_status
123 Product Promo Frequency — S — product_intel_cache.raw_data

## Customer Intelligence (partial)
124 Traffic Source Breakdown — I — customer_intel_cache.traffic_sources
125 Audience Demographic Estimation — S — customer_intel_cache.demographics
126 Geographic Customer Distribution — S — customer_intel_cache.geographic_distribution
127 Customer Intent Mapping — I — customer_intel_cache.raw_data
128 Customer Loyalty Signal Scoring — S — customer_intel_cache.raw_data
129 Relative Acquisition Efficiency — S — customer_intel_cache.raw_data
130 Customer Language/Style Analysis — P2 —
131 Customer Journey Funnel — S — customer_intel_cache.raw_data
132 Complaint Theme Intelligence — I — customer_intel_cache.complaint_themes
133 Customer Retention Investment Signals — S — customer_intel_cache.raw_data
134 Influencer & Community Acquisition — P2 —
135 Mobile vs Desktop Split — S — customer_intel_cache.raw_data
136 Payment Method Preference — S — customer_intel_cache.raw_data
137 CLV Proxy Indicators — S — customer_intel_cache.raw_data
138 Audience Overlap Between Competitors — S — customer_intel_cache.raw_data
139 Acquisition Channel Mix Comparison — S — customer_intel_cache.traffic_sources
140 Customer Churn Signal Detection — S — customer_intel_cache.raw_data

## Regulatory Intelligence
141 Regulatory Rules Database — C — regulatory_documents.id
142 Licence Display Compliance — C — regulatory_cache.licence_display_status
143 Responsible Gambling Audit — C — regulatory_cache.responsible_gambling_status
144 Bonus & Promotion Terms — I — regulatory_cache.bonus_terms_status
145 Age Verification Signal — I — regulatory_cache.age_verification_status
146 Advertising Compliance — I — regulatory_cache.raw_data
147 Withdrawal Compliance — I — regulatory_cache.withdrawal_terms_status
148 Data & Privacy Compliance — I — regulatory_cache.data_privacy_status
149 Competitor Compliance Scorecard — C — regulatory_cache.compliance_score
150 Brand Own Compliance Self-Audit — C — regulatory_cache (own)
151 Regulatory Risk Scoring — S — regulatory_cache.raw_data
152 Compliance Change Detection — I — competitor_changes(change_type='regulatory')
153 Regulatory Violation Alert — C — regulatory_cache.violations
154 Market Regulatory Health Overview — S — regulatory_cache (market)
155 Compliance Evidence & Source Trail — C — regulatory_cache.violations[].evidence_verbatim

## Market Intelligence Mode (partial — SEO+GEO only)
156 Industry+Country Landscape — S — weekly_cache (market view)
157 Market Map — S — competitor_profiles (market)
158 Market Health Index — S — weekly_cache.raw
159 Industry Promotion Landscape — S — promotions_cache (market)
160 Market Ad Intelligence — P2 —
161 Market SEO Landscape — S — seo_cache (market)
162 Market Trend Intelligence — S — weekly_cache.raw
163 Market Entry Analysis — S — weekly_cache.raw
164 Category Share Shift — S — weekly_cache.raw

## Actionable Intelligence Layer
165 Ranked Weekly Action Plan — C — action_plans.total_recommendations
166 Confidence-Scored Recommendations — C — recommendations.confidence_level
167 Evidence-Backed Decision Cards — C — recommendations.evidence
168 Assumption Transparency Flags — I — recommendations.assumption_flags
169 Direct vs Inferred Labelling — I — recommendations.is_direct_evidence
170 Recommendation Relevance Filter — I — recommendations.full_analysis
171 Brand Context Filter — I — recommendations.full_analysis
172 Market Positioning Filter — S — recommendations.full_analysis
173 Action Urgency Classification — C — recommendations.urgency
174 Five-Question Filter — C — recommendations.full_analysis
175 Competitor Aggression Score — I — competitor_profiles.aggression_score
176 Competitor Strategic Intent — S — recommendations.full_analysis
177 Market Cycle Detection — S — weekly_cache.raw
178 Competitor Vulnerability Window — S — recommendations.full_analysis
179 Optimal Launch Window — S — recommendations.full_analysis
180 Competitor Copycat Pattern — S — recommendations.full_analysis

## Asset Generation
181 Campaign Brief — C — generated_assets(asset_type='campaign_brief')
182 Ad Copy — C — generated_assets(asset_type='ad_copy')
183 Event Campaign Brief — I — generated_assets.content (event)
184 Reactivation Email — I — generated_assets(asset_type='email')
185 Push Notification Copy — S — generated_assets(asset_type='push_notification')
186 SMS Copy — S — generated_assets(asset_type='sms')
187 Spend Increase Memo — S — generated_assets(asset_type='spend_memo')
188 Team Intelligence Brief — S — generated_assets(asset_type='team_brief')
189 Content Brief — I — generated_assets(asset_type='seo_brief')
190 SEO Article Brief — S — generated_assets(asset_type='seo_brief')
191 WhatsApp Campaign Copy — S — generated_assets(asset_type='whatsapp')
192 One-Click Default Pre-Generation — C — generated_assets.is_pre_generated
193 Live Regeneration on Demand — I — recommendations.is_on_demand

## Agents
194 Supervisor Agent — C — agent_job_logs(agent_name='supervisor')
195 Researcher Agent — C — agent_job_logs(agent_name='researcher')
196 Drafter Agent — C — agent_job_logs(agent_name='drafter')
197 Auditor Agent — C — agent_job_logs(agent_name='auditor')
198 HITL Reviewer — P2 —
199 Deployer Agent — P2 —
200 Analytics Agent — I — agent_job_logs(agent_name='analytics')

## Memory & Learning
201 Performance Memory System — I — performance_memory.id
202 Outcome Tracking per Action — I — action_outcomes.id
203 Recommendation Acceptance Logging — I — recommendations.status
204 Brand-Specific Learning — S — performance_memory(scan_weeks_observed>1)
205 Cross-Brand Vertical Benchmarking — S — brand_benchmarks.market_avg_ctr_pct
206 Weekly iGaming Benchmark Index — S — brand_benchmarks.id
207 Outcome-Labelled Dataset — S — action_outcomes.result
208 Pattern Memory — S — performance_memory(memory_type='pattern')
209 Quality Memory — S — performance_memory.description
210 Error Memory — S — agent_job_logs(status='failed')

## Reporting & Workflow
211 Weekly Automated Scan Job — C — scan_jobs.status
212 Monday Morning Delivery — C — scan_jobs.completed_at
213 Email Digest — S — scan_jobs.completed_at (Supabase Auth email)
214 WhatsApp Delivery — P2 —
215 Slack Delivery — P2 —
216 Export to PDF — I — reports.r2_path
217 One-Link Shareable Reports — I — reports.share_token
218 Team Sharing & Collaboration — S — organisation_members.id
219 Alert & Notification System — C — alert_history.id
220 Weekly Monitor Setup — I — scan_jobs.id
221 Critical Alert — Between-Cycle — C — alert_history (6h triggers)

## Frontend — Brand-Facing (page render = backing cache present)
222 Onboarding/Setup Flow — C — brands.onboarding_completed_at
223 Dashboard (split-field) — C — weekly_cache.id
224 Market Intelligence Pages — S — weekly_cache (market)
225 Per-Competitor Profile — I — competitor_profiles.id
226 Promotions Intelligence Page — C — promotions_cache.id
227 Ads & Spend Page — I — tech_stack_cache.id
228 Customer Intelligence Page — I — customer_intel_cache.id
229 SEO & Content Page — I — seo_cache.id
230 Social Intelligence Page — P2 — (placeholder)
231 Product Intelligence Page — S — product_intel_cache.id (within competitor profile)
232 Regulatory Intelligence Page — C — regulatory_cache.id
233 Hiring & Signals Page — I — hiring_signals_cache.id
234 Action Plan Page — C — recommendations.id
235 Performance Memory Page — I — performance_memory.id
236 Reports Page — I — reports.id
237 Brand GPT Chat — C — chat_messages.id
238 Brand Search — S — pg_trgm index on generated_assets/recommendations

## Brand Admin
239 Brand Configuration — C — brands.id
240 Competitor List Management — C — brand_competitors.id
241 Team Management — S — organisation_members.id
242 Alert Configuration — I — alert_configs.id
243 Scan Configuration — I — brands.scan_frequency
244 Action Plan History & Export — I — recommendations (history)
245 Generated Assets Library — I — generated_assets.id
246 Billing & Plan Management — I — subscriptions.id

## Internal Admin — Agent Control Centre
247 Live Agent Status — I — agents.status
248 Skills Library — I — agent_skills.id
249 Tools Registry — S — model_router_config.id
250 Skill-to-Tool Assignment — S — agent_skills.config
251 Per-Agent Configuration — I — agents.config
252 Job Decomposition Rules — S — agents.config
253 Agent Job Logs — C — agent_job_logs.id
254 Human Review Queue — P2 —
255 Agent Performance Analytics — I — agent_job_logs (aggregate)
256 System Prompt Version Control — I — prompt_versions.id
257 Multi-Brand Agent Performance — S — agent_job_logs (cross-brand)
258 Agent Learning Record — S — performance_memory.id
259 Evidence Records Archive — I — recommendations.evidence (+ evidence_hash)
260 Agent Self-Healing Rules & Log — S — dead_letter_queue.id
261 Prompt Injection Protection — C — agent_job_logs.status
262 Constitutional Rules Engine — S — agents.config
263 Boundary Violation Log — S — audit_logs(action like 'boundary%')

## API Management
264 API Health Dashboard — C — api_health_logs.id
265 Per-API Rate Limit Config — I — model_router_config.requests_per_min
266 Fallback Chain Config — I — model_router_config.fallback_model
267 Model Router — I — model_router_config.primary_model
268 Cost Control & Spend Caps — I — model_router_config.daily_spend_cap_usd
269 Cost Analytics & Breakdown — I — agent_job_logs.cost_usd
270 Circuit Breaker Config — I — model_router_config.circuit_breaker_threshold_pct
271 Credit Balance Monitoring — S — api_health_logs.credit_balance
272 Brand-Level Model Overrides — S — model_router_config.config

## Security
273 Authentication Config — C — profiles.id (Supabase Auth)
274 Role-Based Access Control — C — rbac_config.id
275 Row-Level Security — C — pg_policies present
276 Data Encryption — C — system_health (infra check)
277 Audit Logging — C — audit_logs.id
278 Threat Detection & Anomaly — S — failed_logins.id
279 DDoS Protection — P2 — (infra)
280 Dependency / CVE Scanning — P2 —
281 Compliance Config (NDPR/POPIA) — S — rbac_config / audit_logs
282 Vulnerability Disclosure — P2 —

## Evals & Guardrails
283 Automated Eval Suite — P2 —
284 Human Eval Sampling — P2 —
285 Regression Testing — P2 —
286 Golden Dataset Management — P2 —
287 Eval Drift Detection — P2 —
288 Input Guardrails — C — agent_job_logs.status (sanitised)
289 Output Guardrails — C — generated_assets.moderation_flagged
290 Behavioural Guardrails — I — agent_job_logs.retry_count
291 Compliance Guardrails — C — recommendations.compliance_score
292 Guardrail Test Sandbox — P2 —

## Monitoring Centre
293 System Health Overview — C — system_health.id
294 Cron Job Monitor — C — cron_job_logs.id
295 Scan Job Monitor — C — scan_jobs.id
296 Cache Status Monitor — I — weekly_cache.cached_at
297 API & Data Source Monitor — C — api_health_logs.id
298 Agent Performance Monitor — I — agent_job_logs (aggregate)
299 Alert & Trigger Monitor — I — alert_history.id
300 Data Quality Monitor — I — agent_job_logs.data_quality_score
301 Brand Activity & Engagement — S — profiles.last_login_at
302 Cost Monitor (real-time) — I — agent_job_logs.cost_usd
303 Infrastructure Monitor — S — system_health.id
304 Error & Incident Log — I — cron_job_logs(status='failed')
305 Feature Health Monitor — C — feature_health_logs.id
306 Cross-Brand Feature Aggregation — I — feature_health_logs (aggregate)
307 Feature Health Thresholds — C — feature_health_logs.feature_tier
308 Root Cause Analysis Engine — S — feature_health_logs.root_cause

## Knowledge Base & Document Management
309 Regulatory Document Storage — C — regulatory_documents.r2_path
310 Automated Document Classification — I — regulatory_documents.document_type
311 Automated Structure Detection — S — document_chunks.section_title
312 Automated Intelligent Chunking — C — document_chunks.id
313 Chunk Quality Review Queue — S — regulatory_documents.needs_review
314 Embedding Generation Pipeline — C — document_chunks.embedding
315 New Territory Doc Discovery — P2 —
316 African Gaming Authority Directory — S — regulatory_documents (distinct body)
317 Document Freshness Monitoring — S — regulatory_documents.last_verified_at
318 Source URL Change Detection — S — regulatory_documents.file_hash
319 Modular RAG Architecture — C — document_chunks.id
320 Agentic RAG Verification — C — regulatory_cache.id (confidence gate)
321 Verbatim-Only Enforcement — C — regulatory_cache.violations[].evidence_verbatim
322 Proof-of-Source Display — C — regulatory_documents.r2_path + page

## Caching & Performance
323 Backend Pre-Processing (cron) — C — scan_jobs.completed_at
324 Weekly Cache Population — C — weekly_cache.cached_at
325 Cache Invalidation & Versioning — I — weekly_cache.expires_at
326 Default Asset Pre-Generation — C — generated_assets.is_pre_generated
327 Lightweight Between-Cycle Monitor — C — alert_history (6h)
328 Sub-1-Second Frontend Load — C — weekly_cache.id (cached read only)

## Chat & Search Infrastructure
329 Internal Admin GPT Chat — S — chat_messages (internal)
330 Internal Admin Search — S — pg_trgm index
331 OpenAI Moderation Pipeline — C — generated_assets.moderation_checked_at
332 Vision Model Integration — P2 —

## Observability
333 Langfuse Integration — I — agent_job_logs.langfuse_trace_id
334 Full LLM Call Tracing — C — agent_job_logs.id
335 Prompt A/B Testing — P2 —
336 Cost-Per-Call Tracking — I — agent_job_logs.cost_usd
337 LLM-as-Judge Scoring — S — agent_job_logs.output_snapshot (Auditor)

---

## Approximate tier counts (MVP)
Critical ≈ 70 · Important ≈ 95 · Supplementary ≈ 120 · Phase-2 (`not_applicable_mvp`) ≈ 52.
Exact counts are computed at runtime from this registry; P2 rows are always excluded from `brand_health_pct`.
