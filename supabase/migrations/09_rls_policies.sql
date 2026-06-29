-- Section 9: RLS enable + policies (brand-scoped tables only; docs/skills/rls-policies.md)
-- NOT enabled (service-role-only): profiles, organisations, organisation_members, subscriptions,
--   payment_history, usage_metrics, all *_logs, prompt_versions, and all internal §C tables.
-- NOT enabled (shared reference): competitors, competitor_profiles, competitor_changes,
--   regulatory_documents, document_chunks.

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brands_own_org" ON brands
  FOR ALL USING (organisation_id = get_user_organisation_id());

ALTER TABLE brand_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brand_preferences_own_brands" ON brand_preferences
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

ALTER TABLE brand_competitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brand_competitors_own_brands" ON brand_competitors
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

ALTER TABLE scan_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan_jobs_own_brands" ON scan_jobs
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

ALTER TABLE weekly_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weekly_cache_own_brands" ON weekly_cache
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

ALTER TABLE promotions_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promotions_cache_own_brands" ON promotions_cache
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

ALTER TABLE seo_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seo_cache_own_brands" ON seo_cache
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

ALTER TABLE geo_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "geo_cache_own_brands" ON geo_cache
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

ALTER TABLE social_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "social_cache_own_brands" ON social_cache
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

ALTER TABLE hiring_signals_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hiring_signals_cache_own_brands" ON hiring_signals_cache
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

ALTER TABLE product_intel_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_intel_cache_own_brands" ON product_intel_cache
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

ALTER TABLE customer_intel_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer_intel_cache_own_brands" ON customer_intel_cache
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

ALTER TABLE regulatory_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regulatory_cache_own_brands" ON regulatory_cache
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

ALTER TABLE action_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "action_plans_own_brands" ON action_plans
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recommendations_own_brands" ON recommendations
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

ALTER TABLE action_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "action_outcomes_own_brands" ON action_outcomes
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

ALTER TABLE generated_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "generated_assets_own_brands" ON generated_assets
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

ALTER TABLE performance_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "performance_memory_own_brands" ON performance_memory
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

ALTER TABLE brand_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brand_benchmarks_own_brands" ON brand_benchmarks
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

ALTER TABLE alert_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alert_configs_own_brands" ON alert_configs
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alert_history_own_brands" ON alert_history
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_conversations_own_brands" ON chat_conversations
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_own_brands" ON reports
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_schedules_own_brands" ON report_schedules
  FOR ALL USING (brand_id IN (SELECT get_user_brand_ids()));

-- join-based (no brand_id column)
ALTER TABLE tech_stack_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech_stack_cache_own_brands" ON tech_stack_cache
  FOR ALL USING (
    competitor_id IN (
      SELECT bc.competitor_id FROM brand_competitors bc
      WHERE bc.brand_id IN (SELECT get_user_brand_ids())
    )
  );

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_messages_own_brands" ON chat_messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM chat_conversations
      WHERE brand_id IN (SELECT get_user_brand_ids())
    )
  );
