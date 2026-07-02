-- Migration 14 — seed the agent-config layer so it mirrors the code reality
-- (agents, agent_skills, model_router_config, geo_query_templates).
-- agents/agent_skills/model_router_config power the internal-admin Agent Control
-- + API Management screens and the runtime model router (_shared/router.ts).
-- Only the 5 MVP agents are seeded; reviewer/deployer are Phase 2 (not built).

-- ── agents ───────────────────────────────────────────────────────────────────
INSERT INTO agents (name, display_name, status, model, current_version, description, config) VALUES
  ('supervisor', 'Supervisor', 'active', 'claude-sonnet-4-6', 'synthesis-draft-audit@v1',
   'Orchestrates the weekly scan: fans modules out via pgmq (brand-scan) and synthesises the 8 module caches into the weekly brief (synthesis-draft-audit).',
   '{"functions": ["brand-scan", "synthesis-draft-audit"], "router_task": "synthesis"}'),
  ('researcher', 'Researcher', 'active', 'claude-haiku-4-5', 'per-module (see config)',
   'One researcher per intelligence module. Calls the MVP data providers and structures results into the module cache tables with evidence.',
   '{"modules": {"promotions": "promotions-v1", "traffic_seo": "traffic_seo.v1", "geo_aeo": "geo_aeo_haiku_v1", "regulatory": "regulatory-v1 (claude-sonnet-4-6)", "customer": "researcher-customer@v1", "hiring": "hiring-classify-v1", "tech_stack": "no-LLM (DetectZeStack structured)", "app_store": "no-LLM (DataForSEO structured)"}, "router_tasks": ["researcher_structuring", "geo_probe", "regulatory_rag"]}'),
  ('drafter', 'Drafter', 'active', 'claude-sonnet-4-6', 'synthesis-draft-audit@v1',
   'Writes 4-8 ranked recommendations plus a pre-written marketing asset each, from the Supervisor brief and evidence (Five-Question filter).',
   '{"functions": ["synthesis-draft-audit"], "router_task": "drafting"}'),
  ('auditor', 'Auditor', 'active', 'claude-sonnet-4-6', 'synthesis-draft-audit@v1',
   'Rubric-scores each drafted recommendation, sets confidence, gates URGENT, and runs OpenAI moderation on generated assets.',
   '{"functions": ["synthesis-draft-audit"], "router_task": "audit"}'),
  ('analytics', 'Analytics', 'active', 'none (deterministic)', 'cache-population@v1',
   'Computes market position, threat scores, share of voice and radar metrics, persists weekly_cache and the action plan. No LLM calls.',
   '{"functions": ["cache-population", "between-cycle-monitor"]}')
ON CONFLICT (name) DO NOTHING;

-- ── agent_skills ─────────────────────────────────────────────────────────────
INSERT INTO agent_skills (agent_id, name, description, config)
SELECT a.id, s.name, s.description, s.config::jsonb FROM agents a
JOIN (VALUES
  ('supervisor', 'scan_orchestration', 'Decompose a scan into module tasks and fan out via pgmq (scan_modules queue).', '{}'),
  ('supervisor', 'synthesis',          'Merge the 8 module caches into a coherent weekly market brief.', '{"prompt_version": "synthesis-draft-audit@v1"}'),
  ('researcher', 'promotions_signals', 'Classify competitor promotion signals from search/news content.', '{"prompt_version": "promotions-v1", "provider": "dataforseo"}'),
  ('researcher', 'traffic_seo',        'Rankings, keyword gaps and content-topic clustering.', '{"prompt_version": "traffic_seo.v1", "provider": "dataforseo"}'),
  ('researcher', 'geo_aeo_probe',      'Ask customer-style questions across AI platforms and score brand visibility.', '{"prompt_version": "geo_aeo_haiku_v1", "provider": "dataforseo_ai"}'),
  ('researcher', 'regulatory_rag',     'Verbatim compliance scoring over the regulator-document corpus (>=0.80 similarity gate).', '{"prompt_version": "regulatory-v1", "model_exception": "claude-sonnet-4-6"}'),
  ('researcher', 'customer_intel',     'Structure demand and brand-perception signals into the customer cache.', '{"prompt_version": "researcher-customer@v1", "provider": "dataforseo"}'),
  ('researcher', 'hiring_signals',     'Infer expansion signals from competitor job postings.', '{"prompt_version": "hiring-classify-v1", "provider": "dataforseo"}'),
  ('researcher', 'tech_stack_detect',  'Detect competitor technologies and ad networks (structured, no LLM).', '{"provider": "detectzestack"}'),
  ('researcher', 'app_store_extract',  'Competitor app presence and ratings (structured, no LLM).', '{"provider": "dataforseo"}'),
  ('drafter',    'recommendation_drafting', 'Draft ranked, evidence-cited recommendations (Five-Question filter).', '{"prompt_version": "synthesis-draft-audit@v1"}'),
  ('drafter',    'asset_generation',   'Write the marketing asset attached to each recommendation.', '{}'),
  ('auditor',    'confidence_scoring', 'Score confidence per recommendation from evidence strength.', '{}'),
  ('auditor',    'urgency_gating',     'Gate URGENT tags; downgrade unsupported urgency.', '{}'),
  ('auditor',    'moderation_gate',    'OpenAI moderation on every generated asset before delivery.', '{"model": "omni-moderation-latest"}'),
  ('analytics',  'market_position_scoring', 'Reach/aggression coordinates per competitor for the position map.', '{}'),
  ('analytics',  'threat_scoring',     'Weekly composite threat score with reasons.', '{}'),
  ('analytics',  'sov_computation',    'Share-of-voice percentages across the tracked set.', '{}'),
  ('analytics',  'radar_metrics',      'Competitive radar axes vs market average.', '{}')
) AS s(agent_name, name, description, config) ON s.agent_name = a.name
WHERE NOT EXISTS (
  SELECT 1 FROM agent_skills sk WHERE sk.agent_id = a.id AND sk.name = s.name
);

-- ── model_router_config ──────────────────────────────────────────────────────
-- Mirrors the hardcoded MODELS.* call sites; fallbacks follow data-flow §4
-- (Claude -> Haiku -> GPT-4.1-mini). Read at runtime by _shared/router.ts.
INSERT INTO model_router_config (task_type, primary_model, fallback_model, max_tokens, temperature) VALUES
  ('synthesis',             'claude-sonnet-4-6', 'claude-haiku-4-5', NULL, NULL),
  ('drafting',              'claude-sonnet-4-6', 'claude-haiku-4-5', NULL, NULL),
  ('audit',                 'claude-sonnet-4-6', 'claude-haiku-4-5', NULL, NULL),
  ('researcher_structuring','claude-haiku-4-5',  'gpt-4.1-mini',     NULL, NULL),
  ('geo_probe',             'claude-haiku-4-5',  'gpt-4.1-mini',     2000, 0.00),
  ('regulatory_rag',        'claude-sonnet-4-6', 'claude-haiku-4-5', 1800, 0.10),
  ('chat',                  'gpt-4.1-mini',      'claude-haiku-4-5', NULL, NULL),
  ('asset_generation',      'claude-sonnet-4-6', 'claude-haiku-4-5', NULL, NULL),
  ('embeddings',            'text-embedding-3-small', NULL,          NULL, NULL),
  ('moderation',            'omni-moderation-latest', NULL,          NULL, NULL)
ON CONFLICT (task_type) DO NOTHING;

-- ── geo_query_templates ──────────────────────────────────────────────────────
-- Global bank (market IS NULL applies to every market); {brand} and {market}
-- placeholders are injected per scan (researcher-geo-aeo).
INSERT INTO geo_query_templates (query_text, query_category, market, is_brand_specific) VALUES
  ('best betting sites in {market}',                          'awareness',      NULL, false),
  ('which betting apps are most popular in {market}',         'awareness',      NULL, false),
  ('safe and licensed online betting sites in {market}',      'awareness',      NULL, false),
  ('fastest payout betting site in {market}',                 'intent',         NULL, false),
  ('betting site with the best odds in {market}',             'intent',         NULL, false),
  ('best welcome bonus betting site in {market}',             'intent',         NULL, false),
  ('betting apps with instant deposits in {market}',          'intent',         NULL, false),
  ('compare the top betting sites in {market}',               'comparison',     NULL, false),
  ('{brand} vs other betting sites in {market}',              'comparison',     NULL, true),
  ('is {brand} better than its competitors',                  'comparison',     NULL, true),
  ('is {brand} legit and safe to use',                        'brand_specific', NULL, true),
  ('{brand} review — payouts, odds and app quality',          'brand_specific', NULL, true),
  ('how fast does {brand} pay out winnings',                  'brand_specific', NULL, true),
  ('how big is the sports betting market in {market}',        'market',         NULL, false),
  ('newest licensed betting operators in {market}',           'market',         NULL, false)
ON CONFLICT DO NOTHING;

-- ── prompt_versions ──────────────────────────────────────────────────────────
-- v1 prompts are code-defined; these rows mirror them so Agent Control's prompt
-- panel shows real state. prompt_text points at the source of truth.
INSERT INTO prompt_versions (agent_name, version, prompt_text, status, deployed_at, notes)
SELECT v.agent_name, v.version, v.prompt_text, 'active', now(), v.notes
FROM (VALUES
  ('supervisor', 'synthesis-draft-audit@v1', 'Code-defined: supabase/functions/synthesis-draft-audit/prompts.ts (SUPERVISOR_SYSTEM)', 'Weekly brief synthesis'),
  ('drafter',    'synthesis-draft-audit@v1', 'Code-defined: supabase/functions/synthesis-draft-audit/prompts.ts (DRAFTER_SYSTEM)', 'Recommendations + assets, Five-Question filter'),
  ('auditor',    'synthesis-draft-audit@v1', 'Code-defined: supabase/functions/synthesis-draft-audit/prompts.ts (AUDITOR_SYSTEM)', 'Rubric scoring, urgency gating'),
  ('researcher', 'promotions-v1',            'Code-defined: supabase/functions/researcher-promotions/classify.ts', 'Promotion-signal classification'),
  ('researcher', 'traffic_seo.v1',           'Code-defined: supabase/functions/researcher-traffic-seo/index.ts', 'Keyword/topic structuring'),
  ('researcher', 'geo_aeo_haiku_v1',         'Code-defined: supabase/functions/researcher-geo-aeo/geo.ts', 'AI-visibility probe scoring'),
  ('researcher', 'regulatory-v1',            'Code-defined: supabase/functions/researcher-regulatory/scoring.ts (SYSTEM_PROMPT)', 'Verbatim compliance RAG (Sonnet)'),
  ('researcher', 'researcher-customer@v1',   'Code-defined: supabase/functions/researcher-customer/infer.ts', 'Customer-signal structuring'),
  ('researcher', 'hiring-classify-v1',       'Code-defined: supabase/functions/researcher-hiring/classify.ts', 'Hiring-signal classification')
) AS v(agent_name, version, prompt_text, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM prompt_versions p WHERE p.agent_name = v.agent_name AND p.version = v.version
);
