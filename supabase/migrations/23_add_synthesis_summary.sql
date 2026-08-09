-- Migration 23: Add lightweight synthesis_summary to cache tables.
-- Each researcher now produces a brief 2-3 sentence summary at the end of its job,
-- stored here so synthesis-draft-audit can work with ~800 tokens instead of raw dumps.

ALTER TABLE seo_cache ADD COLUMN synthesis_summary jsonb;
ALTER TABLE geo_cache ADD COLUMN synthesis_summary jsonb;
ALTER TABLE tech_stack_cache ADD COLUMN synthesis_summary jsonb;
ALTER TABLE promotions_cache ADD COLUMN synthesis_summary jsonb;
ALTER TABLE regulatory_cache ADD COLUMN synthesis_summary jsonb;
ALTER TABLE customer_intel_cache ADD COLUMN synthesis_summary jsonb;
ALTER TABLE hiring_signals_cache ADD COLUMN synthesis_summary jsonb;
ALTER TABLE product_intel_cache ADD COLUMN synthesis_summary jsonb;

-- Add a comment for clarity.
COMMENT ON COLUMN seo_cache.synthesis_summary IS 'Lightweight per-module summary: { status, key_takeaways[], recommended_angle } — used by synthesis-draft-audit instead of raw cache.';
COMMENT ON COLUMN geo_cache.synthesis_summary IS 'Lightweight per-module summary: { status, key_takeaways[], recommended_angle } — used by synthesis-draft-audit instead of raw cache.';
COMMENT ON COLUMN tech_stack_cache.synthesis_summary IS 'Lightweight per-module summary: { status, key_takeaways[], recommended_angle } — used by synthesis-draft-audit instead of raw cache.';
COMMENT ON COLUMN promotions_cache.synthesis_summary IS 'Lightweight per-module summary: { status, key_takeaways[], recommended_angle } — used by synthesis-draft-audit instead of raw cache.';
COMMENT ON COLUMN regulatory_cache.synthesis_summary IS 'Lightweight per-module summary: { status, key_takeaways[], recommended_angle } — used by synthesis-draft-audit instead of raw cache.';
COMMENT ON COLUMN customer_intel_cache.synthesis_summary IS 'Lightweight per-module summary: { status, key_takeaways[], recommended_angle } — used by synthesis-draft-audit instead of raw cache.';
COMMENT ON COLUMN hiring_signals_cache.synthesis_summary IS 'Lightweight per-module summary: { status, key_takeaways[], recommended_angle } — used by synthesis-draft-audit instead of raw cache.';
COMMENT ON COLUMN product_intel_cache.synthesis_summary IS 'Lightweight per-module summary: { status, key_takeaways[], recommended_angle } — used by synthesis-draft-audit instead of raw cache.';
