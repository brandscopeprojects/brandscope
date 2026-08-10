import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface CacheUpdateConfig {
  tableName: string;
  brandId: string;
  scanWeek: string;
  onUpdate?: () => void;
}

export function useIntelligenceCacheUpdate({
  tableName,
  brandId,
  scanWeek,
  onUpdate,
}: CacheUpdateConfig) {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const setup = async () => {
      try {
        channel = supabase
          .channel(`${tableName}:${brandId}:${scanWeek}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: tableName,
              filter: `brand_id=eq.${brandId}`,
            },
            (payload) => {
              // Only trigger on updates from this week's scan
              const record = payload.new || payload.old;
              if (record && (record as any).scan_week === scanWeek) {
                setHasUpdate(true);
                onUpdate?.();
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.error("Setup error:", err);
      }
    };

    setup();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [tableName, brandId, scanWeek, onUpdate]);

  const reloadPage = async () => {
    setIsReloading(true);
    // Use window.location.reload() to trigger a full page refresh which will
    // re-run the server component and fetch fresh data
    window.location.reload();
  };

  return {
    hasUpdate,
    isReloading,
    reloadPage,
  };
}
