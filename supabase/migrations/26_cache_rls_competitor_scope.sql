-- 26_cache_rls_competitor_scope.sql
--
-- Switch RLS on the per-competitor cache tables from BRAND-scoped to
-- COMPETITOR-scoped so a brand can read a tracked competitor's data even when the
-- row was written under ANOTHER brand's scan (competitors are shared across
-- brands). This mirrors the existing `tech_stack_cache_own_brands` policy and is
-- what makes the app-layer competitor-id keying actually surface data (e.g. a
-- brand whose own weekly scan failed/was partial still sees its rivals' signals).
--
-- Rows in these tables are competitor FACTS (promo titles, app ratings, product
-- status, hiring signals) — no scanning-brand-private data — so cross-brand read
-- of a shared competitor is safe.
--
-- EXCLUDED: `seo_cache`. Its `raw_data.brand_self` holds the SCANNING brand's own
-- SEO metrics; broadening its RLS would leak that cross-brand. It stays
-- brand-scoped and is read via the service-role client in lib/data/traffic-seo.ts
-- (which exposes brand_self only from the caller brand's own rows).
--
-- The new policies are FOR SELECT only (least privilege): the app never writes
-- these tables from a user session — the scan pipeline writes them via the
-- service role, which bypasses RLS.

-- promotions_cache
DROP POLICY IF EXISTS promotions_cache_own_brands ON public.promotions_cache;
CREATE POLICY promotions_cache_own_competitors ON public.promotions_cache
  FOR SELECT USING (
    competitor_id IN (
      SELECT bc.competitor_id FROM brand_competitors bc
      WHERE bc.brand_id IN (SELECT get_user_brand_ids())
    )
  );

-- customer_intel_cache
DROP POLICY IF EXISTS customer_intel_cache_own_brands ON public.customer_intel_cache;
CREATE POLICY customer_intel_cache_own_competitors ON public.customer_intel_cache
  FOR SELECT USING (
    competitor_id IN (
      SELECT bc.competitor_id FROM brand_competitors bc
      WHERE bc.brand_id IN (SELECT get_user_brand_ids())
    )
  );

-- product_intel_cache
DROP POLICY IF EXISTS product_intel_cache_own_brands ON public.product_intel_cache;
CREATE POLICY product_intel_cache_own_competitors ON public.product_intel_cache
  FOR SELECT USING (
    competitor_id IN (
      SELECT bc.competitor_id FROM brand_competitors bc
      WHERE bc.brand_id IN (SELECT get_user_brand_ids())
    )
  );

-- hiring_signals_cache
DROP POLICY IF EXISTS hiring_signals_cache_own_brands ON public.hiring_signals_cache;
CREATE POLICY hiring_signals_cache_own_competitors ON public.hiring_signals_cache
  FOR SELECT USING (
    competitor_id IN (
      SELECT bc.competitor_id FROM brand_competitors bc
      WHERE bc.brand_id IN (SELECT get_user_brand_ids())
    )
  );
