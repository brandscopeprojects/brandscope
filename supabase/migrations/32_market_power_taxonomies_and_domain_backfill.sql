-- 32_market_power_taxonomies_and_domain_backfill.sql
--
-- Gate 1 closure item: (1) backfill competitor_domains from the existing
-- canonical competitors.domain (competitors.domain is UNCHANGED and stays
-- authoritative — this only adds a mirrored row), and (2) canonical
-- product/acquisition-channel/keyword-cluster taxonomies required by the
-- frozen Competitive Overlap methodology (V1.5 §6/§10). Confirmed via
-- information_schema that no existing category/channel/taxonomy table exists
-- to reuse — these are net-new, minimal reference tables, not a duplicate
-- framework.

-- ── competitor_domains backfill ─────────────────────────────────────────────
-- Every existing competitors.domain becomes its own canonical row.
-- verification_status='unverified' (not 'operator_verified') because a
-- migration copy is not independent verification evidence — see V1.5
-- §competitor_domain_backfill. evidence_source records provenance honestly.
INSERT INTO competitor_domains (competitor_id, domain, is_canonical, verification_status, evidence_source, first_seen_at)
SELECT id, domain, true, 'unverified', 'migration_32_backfill_from_competitors_domain', first_seen_at
FROM competitors
ON CONFLICT (competitor_id, domain) DO NOTHING;

-- ── Canonical taxonomies (reference DATA, not scattered TypeScript literals) ─

CREATE TABLE IF NOT EXISTS market_power_product_categories (
  key text PRIMARY KEY, -- e.g. 'sports_betting', 'casino', 'virtual_sports'
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE market_power_product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY market_power_product_categories_read_authenticated ON public.market_power_product_categories
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS market_power_acquisition_channels (
  key text PRIMARY KEY, -- e.g. 'google_ads', 'affiliates', 'app_store', 'organic_search'
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE market_power_acquisition_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY market_power_acquisition_channels_read_authenticated ON public.market_power_acquisition_channels
  FOR SELECT TO authenticated USING (true);

-- Versioned, deterministically-maintained keyword clusters. An LLM must never
-- generate production clusters during a scoring run (V1.5 rule) — rows here
-- are curated by internal admins (or a documented offline batch process),
-- never written by the scoring pipeline itself. branded_terms is stored for
-- audit/transparency; the branded-keyword exclusion itself is a CODE
-- invariant enforced by the evidence adapter, not by this table.
CREATE TABLE IF NOT EXISTS market_power_keyword_clusters (
  key text PRIMARY KEY, -- e.g. 'online_betting_generic', 'live_odds_generic'
  label text NOT NULL,
  market_code text, -- nullable: some clusters are market-specific, some global
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS market_power_keyword_clusters_market_idx ON market_power_keyword_clusters (market_code);
ALTER TABLE market_power_keyword_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY market_power_keyword_clusters_read_authenticated ON public.market_power_keyword_clusters
  FOR SELECT TO authenticated USING (true);

-- Seed a minimal starter set — internal admin owns expanding these via the
-- back-office (migration 33). Not exhaustive; scoring against an incomplete
-- taxonomy simply yields fewer overlap signals (reweighted per overlap.ts),
-- never a fabricated one.
INSERT INTO market_power_product_categories (key, label) VALUES
  ('sports_betting', 'Sports Betting'),
  ('live_betting', 'Live/In-Play Betting'),
  ('casino', 'Casino'),
  ('virtual_sports', 'Virtual Sports'),
  ('esports_betting', 'Esports Betting'),
  ('lottery', 'Lottery')
ON CONFLICT (key) DO NOTHING;

INSERT INTO market_power_acquisition_channels (key, label) VALUES
  ('google_ads', 'Google Ads'),
  ('organic_search', 'Organic Search'),
  ('affiliates', 'Affiliates'),
  ('app_store', 'App Store / Play Store'),
  ('social_ads', 'Social Ads'),
  ('sponsorships', 'Sponsorships'),
  ('sms_push', 'SMS / Push Notifications')
ON CONFLICT (key) DO NOTHING;
