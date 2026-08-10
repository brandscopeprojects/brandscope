import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type CacheTableName =
  | "seo_cache"
  | "geo_cache"
  | "tech_stack_cache"
  | "product_intel_cache"
  | "customer_intel_cache"
  | "regulatory_cache"
  | "promotions_cache"
  | "hiring_signals_cache"
  | "weekly_cache";

// tech_stack_cache is keyed by competitor_id only — it has NO brand_id column
// (see lib/data/tech-stack.ts). Every other cache table carries brand_id.
const TABLES_WITHOUT_BRAND_ID: ReadonlySet<CacheTableName> = new Set<CacheTableName>([
  "tech_stack_cache",
]);

export function useRealtimeCacheSubscription<T>({
  tableName,
  brandId,
  scanWeek,
  competitorId,
}: {
  tableName: CacheTableName;
  brandId: string;
  scanWeek?: string;
  competitorId?: string;
}) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    const hasBrandId = !TABLES_WITHOUT_BRAND_ID.has(tableName);

    // A row is relevant to this subscription when it matches the (optional)
    // scan_week and competitor_id narrowing. brand scoping is enforced by RLS
    // (the anon client can only read the signed-in brand's rows) and, where the
    // column exists, by the brand_id filter below.
    const isRelevant = (row: Record<string, unknown> | null | undefined): boolean => {
      if (!row) return false;
      if (scanWeek && row.scan_week !== scanWeek) return false;
      if (competitorId && row.competitor_id !== competitorId) return false;
      return true;
    };

    const setup = async () => {
      try {
        // Initial fetch. Cache tables hold one row per competitor per week, so
        // this is a row SET — never .single() (which throws on >1 row). We take
        // the most recent relevant row as the seed value.
        let query = (supabase.from(tableName) as any).select("*");
        if (hasBrandId) query = query.eq("brand_id", brandId);
        if (scanWeek) query = query.eq("scan_week", scanWeek);
        if (competitorId) query = query.eq("competitor_id", competitorId);

        const { data: rows, error: queryError } = await query;
        if (queryError) throw queryError;

        if (!cancelled) {
          const seed = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
          if (seed) setData(seed as T);
          setIsLoading(false);
        }

        // Realtime postgres_changes accepts a SINGLE simple predicate only — no
        // AND / compound conditions. Filter on the one server-side column we can
        // (brand_id where it exists), then narrow scan_week/competitor_id in the
        // handler. For tech_stack_cache there is no brand_id, so we subscribe to
        // the table unfiltered and rely on RLS + client-side narrowing.
        const filter = hasBrandId ? `brand_id=eq.${brandId}` : undefined;

        const channelName = [tableName, brandId, scanWeek, competitorId]
          .filter(Boolean)
          .join(":");

        channel = supabase
          .channel(channelName)
          .on(
            "postgres_changes",
            filter
              ? { event: "*", schema: "public", table: tableName, filter }
              : { event: "*", schema: "public", table: tableName },
            (payload) => {
              if (payload.eventType === "DELETE") {
                if (isRelevant(payload.old as Record<string, unknown>)) setData(null);
                return;
              }
              const row = payload.new as Record<string, unknown>;
              if (isRelevant(row)) setData(row as T);
            },
          )
          .subscribe();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data");
          setIsLoading(false);
        }
      }
    };

    setup();

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableName, brandId, scanWeek, competitorId]);

  return { data, isLoading, error };
}
