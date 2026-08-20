-- 27_market_power_engine_schema.sql
--
-- Competitive Market Power Engine — Gate 1: schema foundation.
-- Methodology reference: "Brandscope Competitive Market Power Engine —
-- Methodology Freeze v1.0" (V1.5, approved). Two-layer model:
--   Global reference layer  — Operator × Market (shared across all brands)
--   Brand layer             — Brand × Market × Operator (brand-relative)
--
-- All new tables are Class-2 service-role-only by default (docs/skills/
-- rls-policies.md): RLS ENABLED, no policy unless a table needs brand-scoped
-- customer read (brand_competitive_position gets one; see migration 28).
-- Config/global-reference tables stay service-role-only for this migration —
-- customer-facing read policies land when the UI is wired (later gate), not
-- before scores are meant to be customer-visible.
--
-- No data is exposed to customer UI by this migration. No production scoring
-- job depends on these tables yet.

-- ─────────────────────────────────────────────────────────────────────────────
-- GLOBAL REFERENCE LAYER (Operator × Market — shared across all brands)
-- ─────────────────────────────────────────────────────────────────────────────

-- One operator (competitors row) may have many official domains.
CREATE TABLE IF NOT EXISTS competitor_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id uuid NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  domain text NOT NULL,
  is_canonical boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'domain_liveness_confirmed', 'operator_verified')),
  evidence_source text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competitor_id, domain)
);
CREATE INDEX IF NOT EXISTS competitor_domains_competitor_idx ON competitor_domains (competitor_id);
ALTER TABLE competitor_domains ENABLE ROW LEVEL SECURITY;

-- One domain may serve multiple markets (bet365.com serves GB, DE, IT, ...).
CREATE TABLE IF NOT EXISTS competitor_domain_markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES competitor_domains(id) ON DELETE CASCADE,
  market_code text NOT NULL,
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'domain_liveness_confirmed', 'operator_verified')),
  evidence_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain_id, market_code)
);
CREATE INDEX IF NOT EXISTS competitor_domain_markets_domain_idx ON competitor_domain_markets (domain_id);
ALTER TABLE competitor_domain_markets ENABLE ROW LEVEL SECURITY;

-- Canonical verified Operator × Market membership (the calculation universe).
-- Historical customer tracking alone does NOT establish presence — see
-- operator_market_presence_evidence for the evidence backing each row.
CREATE TABLE IF NOT EXISTS operator_market_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id uuid NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  market_code text NOT NULL,
  presence_status text NOT NULL DEFAULT 'uncertain'
    CHECK (presence_status IN ('active', 'uncertain', 'exited')),
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'verified')),
  first_verified_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competitor_id, market_code)
);
CREATE INDEX IF NOT EXISTS operator_market_presence_market_idx ON operator_market_presence (market_code);
ALTER TABLE operator_market_presence ENABLE ROW LEVEL SECURITY;

-- Append-only evidence backing each presence row.
CREATE TABLE IF NOT EXISTS operator_market_presence_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presence_id uuid NOT NULL REFERENCES operator_market_presence(id) ON DELETE CASCADE,
  source_id text NOT NULL,
  evidence_reference text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  verification_strength text NOT NULL DEFAULT 'weak'
    CHECK (verification_strength IN ('weak', 'medium', 'strong')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS operator_market_presence_evidence_presence_idx
  ON operator_market_presence_evidence (presence_id);
ALTER TABLE operator_market_presence_evidence ENABLE ROW LEVEL SECURITY;

-- Immutable, append-only calculation record for Operator × Market Market
-- Standing. Never mutated after insert — no is_active/superseded_by columns.
CREATE TABLE IF NOT EXISTS market_power_operator_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id uuid NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  market_code text NOT NULL,
  engine_version text NOT NULL,
  config_id uuid NOT NULL, -- FK added after market_power_scoring_config below
  calculation_timestamp timestamptz NOT NULL DEFAULT now(),

  market_standing numeric(5,2) NOT NULL CHECK (market_standing BETWEEN 0 AND 100),
  operator_market_standing_confidence numeric(5,2) NOT NULL
    CHECK (operator_market_standing_confidence BETWEEN 0 AND 100),

  -- Per-dimension calculated scores (0-100), not weights.
  dimension_scores jsonb NOT NULL,
  -- Weights actually applied after any missing-dimension reweight.
  effective_dimension_weights jsonb NOT NULL,
  -- Per-metric normalized scores + weights actually used, for audit.
  metric_scores jsonb NOT NULL,
  effective_metric_weights jsonb NOT NULL,

  -- Momentum lives here: it is a change in this shared Market Standing over
  -- time, not a brand-relative measure.
  momentum_trend text NOT NULL DEFAULT 'unavailable'
    CHECK (momentum_trend IN ('strong_upward', 'upward', 'stable', 'downward', 'strong_downward', 'unavailable')),
  momentum_pressure_score numeric(5,2) CHECK (momentum_pressure_score IS NULL OR momentum_pressure_score BETWEEN 0 AND 100),

  operator_market_universe_size integer NOT NULL,
  is_provisional boolean NOT NULL DEFAULT false, -- universe below minimum calibrated size

  -- Diagnostics only — never used as a scoring multiplier.
  diagnostics jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS market_power_operator_snapshot_lookup_idx
  ON market_power_operator_snapshot (competitor_id, market_code, calculation_timestamp DESC);
ALTER TABLE market_power_operator_snapshot ENABLE ROW LEVEL SECURITY;

-- Mutable fast-read pointer to the latest snapshot per Operator × Market.
CREATE TABLE IF NOT EXISTS operator_market_current_position (
  competitor_id uuid NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  market_code text NOT NULL,
  latest_snapshot_id uuid NOT NULL REFERENCES market_power_operator_snapshot(id),
  market_standing numeric(5,2) NOT NULL,
  momentum_trend text NOT NULL,
  momentum_pressure_score numeric(5,2),
  operator_market_standing_confidence numeric(5,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (competitor_id, market_code)
);
ALTER TABLE operator_market_current_position ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- BRAND LAYER (Brand × Market × Operator — brand-relative)
-- ─────────────────────────────────────────────────────────────────────────────

-- Formal Brand × Market relationship, replacing the eventual authority of
-- brands.market text[]. Migration/backfill happens in 29_brand_markets_backfill.sql.
-- brands.market stays the source of truth until that migration's Stage 3 flip
-- (documented there) — do not read brand_markets as authoritative before that.
CREATE TABLE IF NOT EXISTS brand_markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  market_code text NOT NULL,
  detection_status text NOT NULL DEFAULT 'detected'
    CHECK (detection_status IN ('detected', 'confirmed', 'tracked')),
  first_detected_at timestamptz,
  confirmed_at timestamptz,
  tracked_from timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, market_code)
);
CREATE INDEX IF NOT EXISTS brand_markets_brand_idx ON brand_markets (brand_id);
ALTER TABLE brand_markets ENABLE ROW LEVEL SECURITY;

-- Maps a customer brand to its own canonical operator identity in
-- `competitors`, so Relative Strength can look up the brand's own Market
-- Standing. UNIQUE(brand_id) only — multiple brands MAY legitimately map to
-- the same canonical competitor/group entity, so canonical_competitor_id is
-- intentionally NOT unique.
CREATE TABLE IF NOT EXISTS brand_operator_identity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  canonical_competitor_id uuid NOT NULL REFERENCES competitors(id),
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'verified', 'manual_approval')),
  verification_source text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id)
);
CREATE INDEX IF NOT EXISTS brand_operator_identity_competitor_idx
  ON brand_operator_identity (canonical_competitor_id);
ALTER TABLE brand_operator_identity ENABLE ROW LEVEL SECURITY;

-- Mutable current state: Competitive Overlap, Relative Strength, Competitive
-- Threat, Tier, and position confidence for one Brand × Market × Operator.
CREATE TABLE IF NOT EXISTS brand_competitive_position (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  competitor_id uuid NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  market_code text NOT NULL,

  latest_operator_snapshot_id uuid NOT NULL REFERENCES market_power_operator_snapshot(id),
  latest_brand_snapshot_id uuid, -- FK added after brand_competitive_snapshot below

  competitive_overlap numeric(5,2) CHECK (competitive_overlap IS NULL OR competitive_overlap BETWEEN 0 AND 100),
  overlap_component_scores jsonb,
  effective_overlap_weights jsonb,

  relative_strength_ratio numeric(8,4),
  relative_strength_score numeric(5,2) CHECK (relative_strength_score IS NULL OR relative_strength_score BETWEEN 0 AND 100),

  competitive_threat numeric(5,2) CHECK (competitive_threat IS NULL OR competitive_threat BETWEEN 0 AND 100),
  effective_threat_weights jsonb,

  tier text NOT NULL DEFAULT 'watch' CHECK (tier IN ('dominant', 'mid_market', 'challenger', 'watch')),
  competitive_position_confidence numeric(5,2) NOT NULL CHECK (competitive_position_confidence BETWEEN 0 AND 100),

  active_override_id uuid, -- FK added after market_power_override_events below

  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, competitor_id, market_code)
);
CREATE INDEX IF NOT EXISTS brand_competitive_position_brand_idx ON brand_competitive_position (brand_id, market_code);
ALTER TABLE brand_competitive_position ENABLE ROW LEVEL SECURITY;

-- Append-only history mirroring brand_competitive_position at each calculation.
CREATE TABLE IF NOT EXISTS brand_competitive_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  competitor_id uuid NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  market_code text NOT NULL,
  engine_version text NOT NULL,
  config_id uuid NOT NULL, -- FK added after market_power_scoring_config below
  operator_snapshot_id uuid NOT NULL REFERENCES market_power_operator_snapshot(id),
  calculation_timestamp timestamptz NOT NULL DEFAULT now(),

  competitive_overlap numeric(5,2),
  overlap_component_scores jsonb,
  effective_overlap_weights jsonb,
  relative_strength_ratio numeric(8,4),
  relative_strength_score numeric(5,2),
  competitive_threat numeric(5,2),
  effective_threat_weights jsonb,
  tier text NOT NULL CHECK (tier IN ('dominant', 'mid_market', 'challenger', 'watch')),
  competitive_position_confidence numeric(5,2) NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS brand_competitive_snapshot_lookup_idx
  ON brand_competitive_snapshot (brand_id, competitor_id, market_code, calculation_timestamp DESC);
ALTER TABLE brand_competitive_snapshot ENABLE ROW LEVEL SECURITY;

ALTER TABLE brand_competitive_position
  ADD CONSTRAINT brand_competitive_position_latest_brand_snapshot_fkey
  FOREIGN KEY (latest_brand_snapshot_id) REFERENCES brand_competitive_snapshot(id);

-- Append-only audit trail for platform-admin overrides of a FINAL DISPLAYED
-- tier only. Calculated market_standing/overlap/threat scores are never
-- directly editable — see docs/skills for the override policy.
CREATE TABLE IF NOT EXISTS market_power_override_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  competitor_id uuid NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  market_code text NOT NULL,
  override_type text NOT NULL DEFAULT 'tier' CHECK (override_type = 'tier'),
  previous_calculated_value text NOT NULL,
  override_value text NOT NULL CHECK (override_value IN ('dominant', 'mid_market', 'challenger', 'watch')),
  reason text NOT NULL,
  actor_profile_id uuid NOT NULL REFERENCES profiles(id),
  expires_at timestamptz,
  review_date timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS market_power_override_events_lookup_idx
  ON market_power_override_events (brand_id, competitor_id, market_code, is_active);
ALTER TABLE market_power_override_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE brand_competitive_position
  ADD CONSTRAINT brand_competitive_position_active_override_fkey
  FOREIGN KEY (active_override_id) REFERENCES market_power_override_events(id);

-- ─────────────────────────────────────────────────────────────────────────────
-- CONFIG / CONTENT LAYER
-- ─────────────────────────────────────────────────────────────────────────────

-- Versioned scoring configuration. Exactly one row may have status='active'
-- at a time (enforced by a partial unique index in migration 28). Activated
-- rows are immutable at the app layer; edits create a new draft version.
CREATE TABLE IF NOT EXISTS market_power_scoring_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL,
  config_name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),

  -- Market Standing
  weight_customer_activity numeric(5,2) NOT NULL CHECK (weight_customer_activity BETWEEN 0 AND 100),
  weight_acquisition_power numeric(5,2) NOT NULL CHECK (weight_acquisition_power BETWEEN 0 AND 100),
  weight_commercial_presence numeric(5,2) NOT NULL CHECK (weight_commercial_presence BETWEEN 0 AND 100),
  weight_customer_mindshare numeric(5,2) NOT NULL CHECK (weight_customer_mindshare BETWEEN 0 AND 100),
  CONSTRAINT market_power_config_dimension_weights_sum CHECK (
    weight_customer_activity + weight_acquisition_power +
    weight_commercial_presence + weight_customer_mindshare = 100.0
  ),
  metric_weights jsonb NOT NULL DEFAULT '{}'::jsonb, -- per-metric weights within each dimension

  percentile_magnitude_alpha numeric(4,3) NOT NULL CHECK (percentile_magnitude_alpha BETWEEN 0 AND 1),
  magnitude_fallback_spread numeric(10,4) NOT NULL,
  minimum_operators_for_universe integer NOT NULL CHECK (minimum_operators_for_universe >= 2),

  -- Tier policy
  threshold_dominant_market_standing numeric(5,2) NOT NULL,
  threshold_midmarket_market_standing numeric(5,2) NOT NULL,
  threshold_challenger_market_standing numeric(5,2) NOT NULL,
  CONSTRAINT market_power_config_tier_bands_ordered CHECK (
    threshold_challenger_market_standing < threshold_midmarket_market_standing
    AND threshold_midmarket_market_standing < threshold_dominant_market_standing
  ),
  threshold_dominant_overlap numeric(5,2) NOT NULL,
  threshold_midmarket_overlap numeric(5,2) NOT NULL,
  threshold_challenger_overlap numeric(5,2) NOT NULL,
  threshold_challenger_momentum_pressure numeric(5,2) NOT NULL,

  -- Competitive Overlap
  overlap_weight_product numeric(5,2) NOT NULL,
  overlap_weight_keyword numeric(5,2) NOT NULL,
  overlap_weight_channel numeric(5,2) NOT NULL,
  CONSTRAINT market_power_config_overlap_weights_sum CHECK (
    overlap_weight_product + overlap_weight_keyword + overlap_weight_channel = 100.0
  ),

  -- Competitive Threat
  threat_weight_overlap numeric(5,2) NOT NULL,
  threat_weight_relative_strength numeric(5,2) NOT NULL,
  threat_weight_momentum numeric(5,2) NOT NULL,
  CONSTRAINT market_power_config_threat_weights_sum CHECK (
    threat_weight_overlap + threat_weight_relative_strength + threat_weight_momentum = 100.0
  ),

  -- Relative Strength (log2-centred bounded transform — see engine code;
  -- transform mechanics are an ENGINE VERSION invariant, these are calibration only)
  relative_strength_clamp_min numeric(5,2) NOT NULL,
  relative_strength_clamp_max numeric(5,2) NOT NULL,
  relative_strength_center numeric(5,2) NOT NULL,
  relative_strength_scale numeric(5,2) NOT NULL,

  -- Momentum
  momentum_lookback_periods integer NOT NULL,
  momentum_strong_upward_threshold numeric(6,2) NOT NULL,
  momentum_upward_threshold numeric(6,2) NOT NULL,
  momentum_downward_threshold numeric(6,2) NOT NULL,
  momentum_strong_downward_threshold numeric(6,2) NOT NULL,
  momentum_stability_stddev_threshold numeric(6,2) NOT NULL,
  momentum_pressure_strong_upward numeric(5,2) NOT NULL,
  momentum_pressure_upward numeric(5,2) NOT NULL,

  -- Missing-data handling
  missing_dimension_coverage_threshold numeric(5,2) NOT NULL,

  -- Confidence (both formulas)
  standing_confidence_weights jsonb NOT NULL,
  standing_confidence_contradiction_penalty numeric(5,2) NOT NULL,
  position_confidence_weights jsonb NOT NULL,

  activated_at timestamptz,
  retired_at timestamptz,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (version)
);
ALTER TABLE market_power_scoring_config ENABLE ROW LEVEL SECURITY;

ALTER TABLE market_power_operator_snapshot
  ADD CONSTRAINT market_power_operator_snapshot_config_fkey
  FOREIGN KEY (config_id) REFERENCES market_power_scoring_config(id);
ALTER TABLE brand_competitive_snapshot
  ADD CONSTRAINT brand_competitive_snapshot_config_fkey
  FOREIGN KEY (config_id) REFERENCES market_power_scoring_config(id);

-- Config change audit trail (mirrors hq_agent_config's pattern where present).
CREATE TABLE IF NOT EXISTS market_power_scoring_config_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES market_power_scoring_config(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES profiles(id),
  change_type text NOT NULL CHECK (change_type IN ('created', 'edited', 'activated', 'retired')),
  previous_values jsonb,
  new_values jsonb,
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE market_power_scoring_config_history ENABLE ROW LEVEL SECURITY;

-- Back-office-editable, versioned customer-facing methodology/tooltip copy.
-- Separate lifecycle from scoring config — content changes do not require a
-- new engine/scoring config version.
CREATE TABLE IF NOT EXISTS market_power_methodology_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_key text NOT NULL UNIQUE, -- e.g. "market_standing", "tier_dominant", "confidence"
  title text NOT NULL,
  body text NOT NULL,
  drawer_section text, -- which part of the "How Brandscope calculates this" drawer
  updated_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE market_power_methodology_content ENABLE ROW LEVEL SECURITY;
