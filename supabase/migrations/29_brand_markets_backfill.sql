-- 29_brand_markets_backfill.sql
--
-- Backfill brand_markets from brands.market[]. This is Stage 1 of the bounded
-- migration:
--   Stage 1 (this migration): brands.market[] remains source of truth.
--     brand_markets is backfilled + kept in sync by application code (both
--     onboarding and any future market edit path must dual-write until
--     Stage 3).
--   Stage 2 (future gate): brand_markets reads are cross-checked against
--     brands.market[] in the app layer; discrepancies alerted, not silently
--     resolved.
--   Stage 3 (future gate, explicit sign-off required): brand_markets becomes
--     source of truth; dual-write stops; brands.market[] is kept only for
--     backward-compatible reads until all readers migrate.
-- No stage beyond Stage 1 is authorized by this migration.
--
-- Every backfilled market is inserted with detection_status='tracked' since
-- brands.market[] today only ever holds markets the brand actively operates
-- in (onboarding writes primary_market = markets[0] and market = markets[]
-- directly, with no separate detected/confirmed state) — see
-- app/onboarding/actions.ts. first_detected_at/tracked_from are backdated to
-- the brand's own creation time since no earlier signal exists.

INSERT INTO brand_markets (brand_id, market_code, detection_status, first_detected_at, tracked_from)
SELECT
  b.id,
  m.market_code,
  'tracked',
  b.created_at,
  b.created_at
FROM brands b
CROSS JOIN LATERAL unnest(b.market) AS m(market_code)
ON CONFLICT (brand_id, market_code) DO NOTHING;
