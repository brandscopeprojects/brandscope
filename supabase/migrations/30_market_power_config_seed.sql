-- 30_market_power_config_seed.sql
--
-- Initial market_power_scoring_config as a DRAFT (never active) plus required
-- methodology/tooltip content. Per Gate 1 rules: create as draft only — no
-- automatic activation. A platform admin must explicitly activate a config
-- after the golden benchmark passes (Gate 4), through
-- activate_market_power_config().
--
-- Calibration values below are placeholders pending the golden benchmark —
-- they let the engine code run against fixtures in Gate 2, they are not a
-- claim of correctness.

INSERT INTO market_power_scoring_config (
  version, config_name, status,
  weight_customer_activity, weight_acquisition_power, weight_commercial_presence, weight_customer_mindshare,
  metric_weights,
  percentile_magnitude_alpha, magnitude_fallback_spread, minimum_operators_for_universe,
  threshold_dominant_market_standing, threshold_midmarket_market_standing, threshold_challenger_market_standing,
  threshold_dominant_overlap, threshold_midmarket_overlap, threshold_challenger_overlap,
  threshold_challenger_momentum_pressure,
  overlap_weight_product, overlap_weight_keyword, overlap_weight_channel,
  threat_weight_overlap, threat_weight_relative_strength, threat_weight_momentum,
  relative_strength_clamp_min, relative_strength_clamp_max, relative_strength_center, relative_strength_scale,
  momentum_lookback_periods, momentum_strong_upward_threshold, momentum_upward_threshold,
  momentum_downward_threshold, momentum_strong_downward_threshold, momentum_stability_stddev_threshold,
  momentum_pressure_strong_upward, momentum_pressure_upward,
  missing_dimension_coverage_threshold,
  standing_confidence_weights, standing_confidence_contradiction_penalty,
  position_confidence_weights
) VALUES (
  1, 'Initial draft — pending golden benchmark', 'draft',
  40.0, 25.0, 20.0, 15.0,
  '{}'::jsonb,
  0.600, 1.0, 5,
  70.0, 40.0, 20.0,
  50.0, 40.0, 35.0,
  65.0,
  35.0, 35.0, 30.0,
  40.0, 35.0, 25.0,
  -2.0, 2.0, 50.0, 25.0,
  6, 10.0, 5.0, -5.0, -10.0, 5.0,
  85.0, 65.0,
  50.0,
  '{"completeness": 0.25, "source_reliability": 0.25, "freshness": 0.25, "independence": 0.15, "universe_coverage": 0.10}'::jsonb,
  15.0,
  '{"standing": 0.60, "overlap_completeness": 0.25, "relative_strength_availability": 0.15}'::jsonb
);

INSERT INTO market_power_methodology_content (content_key, title, body, drawer_section) VALUES
  ('market_standing', 'Market Standing',
   'Estimates an operator''s strength within a specific market using customer activity, acquisition power, commercial presence and customer mindshare, compared against other operators in that market.',
   'overview'),
  ('dimension_customer_activity', 'Customer Activity',
   'Estimates real customer and commercial usage. Direct regulatory or company evidence is preferred; clearly labelled proxies are used when direct evidence is unavailable.',
   'dimensions'),
  ('dimension_acquisition_power', 'Acquisition Power',
   'Measures the operator''s ability to attract customers through search, advertising, affiliates, app discovery and related acquisition channels.',
   'dimensions'),
  ('dimension_commercial_presence', 'Commercial Presence',
   'Measures active local commercial presence through promotions, sponsorships, partnerships, payments and operations.',
   'dimensions'),
  ('dimension_customer_mindshare', 'Customer Mindshare',
   'Measures how strongly customers search for, discuss, review and engage with the operator.',
   'dimensions'),
  ('competitive_threat', 'Competitive Threat',
   'Measures how significant this operator is to your brand specifically, combining how directly it competes for the same customers, how strong it is relative to your own market position, and whether its position is strengthening.',
   'overview'),
  ('tier_dominant', 'Dominant', 'A market leader that directly competes with your brand for the same customers.', 'tiers'),
  ('tier_mid_market', 'Mid-Market', 'An established operator with meaningful overlap with your brand.', 'tiers'),
  ('tier_challenger', 'Challenger', 'A smaller operator currently, but gaining ground quickly with meaningful overlap.', 'tiers'),
  ('tier_watch', 'Watch', 'Limited current overlap or insufficient evidence to classify as a direct competitor.', 'tiers'),
  ('confidence', 'Confidence',
   'Indicates the completeness, quality, independence and freshness of the evidence supporting this result.',
   'evidence'),
  ('momentum', 'Momentum',
   'Whether the operator''s market position is strengthening, stable or declining, based on recent history.',
   'evidence'),
  ('evidence_direct_vs_proxy', 'Direct vs. proxy evidence',
   'Direct evidence measures a factor directly (e.g. a regulatory filing). Proxy evidence estimates it from a related, observable signal (e.g. search volume as a proxy for customer interest). Both are used, and each result discloses which kind of evidence it relies on.',
   'evidence'),
  ('methodology_drawer', 'How Brandscope calculates this',
   'Positions are calculated from verified market evidence using a consistent, documented methodology. Exact weights and thresholds are proprietary and are not shown, but the categories, evidence types and confidence behind every score are.',
   'overview');
