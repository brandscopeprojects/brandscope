import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function useRealtimeCacheSubscription<T>({
  tableName,
  brandId,
  scanWeek,
  competitorId,
}: {
  tableName: string;
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

    const setup = async () => {
      try {
        // Initial query
        let query = supabase.from(tableName).select("*").eq("brand_id", brandId);

        if (scanWeek) query = query.eq("scan_week", scanWeek);
        if (competitorId) query = query.eq("competitor_id", competitorId);

        const { data: existing, error: queryError } = await query.single();

        if (queryError && queryError.code !== "PGRST116") {
          // PGRST116 = no rows, which is expected for first load
          throw queryError;
        }

        if (existing) {
          setData(existing);
        }
        setIsLoading(false);

        // Subscribe to changes
        const channelName = `${tableName}:${brandId}${scanWeek ? `:${scanWeek}` : ""}${competitorId ? `:${competitorId}` : ""}`;
        channel = supabase
          .channel(channelName)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: tableName,
              filter: `brand_id=eq.${brandId}${scanWeek ? ` AND scan_week=eq.${scanWeek}` : ""}${competitorId ? ` AND competitor_id=eq.${competitorId}` : ""}`,
            },
            (payload) => {
              if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
                setData(payload.new as T);
              } else if (payload.eventType === "DELETE") {
                setData(null);
              }
            }
          )
          .subscribe();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
        setIsLoading(false);
      }
    };

    setup();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [tableName, brandId, scanWeek, competitorId, supabase]);

  return { data, isLoading, error };
}
