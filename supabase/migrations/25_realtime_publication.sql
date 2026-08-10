-- 25_realtime_publication.sql
-- Enable Supabase Realtime for the cache tables the app subscribes to.
--
-- Why: the dashboard streaming view (components/dashboard/ModuleSections.tsx via
-- lib/hooks/useRealtimeCacheSubscription.ts) and the intelligence-page
-- RealtimeDataBanner subscribe to postgres_changes on these tables. Without the
-- tables being members of the `supabase_realtime` publication, NO change events
-- are ever delivered, so the "real-time streaming" feature was silently inert.
--
-- Safety: every table below already has a brand-scoped RLS policy (see
-- 09_rls_policies.sql). Realtime honours RLS, so a subscriber only receives rows
-- their JWT is allowed to read. REPLICA IDENTITY FULL is set so UPDATE/DELETE
-- payloads carry the full OLD row, which Realtime needs to run the RLS check and
-- to populate `payload.old` for the client-side relevance filter.

-- seo_cache
ALTER TABLE public.seo_cache REPLICA IDENTITY FULL;
-- geo_cache
ALTER TABLE public.geo_cache REPLICA IDENTITY FULL;
-- tech_stack_cache (keyed by competitor_id — no brand_id)
ALTER TABLE public.tech_stack_cache REPLICA IDENTITY FULL;
-- product_intel_cache
ALTER TABLE public.product_intel_cache REPLICA IDENTITY FULL;
-- customer_intel_cache
ALTER TABLE public.customer_intel_cache REPLICA IDENTITY FULL;
-- regulatory_cache
ALTER TABLE public.regulatory_cache REPLICA IDENTITY FULL;
-- promotions_cache
ALTER TABLE public.promotions_cache REPLICA IDENTITY FULL;
-- hiring_signals_cache
ALTER TABLE public.hiring_signals_cache REPLICA IDENTITY FULL;
-- weekly_cache
ALTER TABLE public.weekly_cache REPLICA IDENTITY FULL;

-- Add the tables to the realtime publication (idempotent guard: skip any table
-- that is already a member so re-running the migration is safe).
DO $$
DECLARE
  t text;
  cache_tables text[] := ARRAY[
    'seo_cache',
    'geo_cache',
    'tech_stack_cache',
    'product_intel_cache',
    'customer_intel_cache',
    'regulatory_cache',
    'promotions_cache',
    'hiring_signals_cache',
    'weekly_cache'
  ];
BEGIN
  FOREACH t IN ARRAY cache_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
