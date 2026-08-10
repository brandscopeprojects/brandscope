"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface RealtimeDataBannerProps {
  tableName: string;
  brandId: string;
  scanWeek: string;
  autoRefreshDelay?: number;
}

export function RealtimeDataBanner({
  tableName,
  brandId,
  scanWeek,
  autoRefreshDelay = 0,
}: RealtimeDataBannerProps) {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let autoRefreshTimer: NodeJS.Timeout | null = null;

    // tech_stack_cache has no brand_id column — it is keyed by competitor_id.
    // Subscribing with a brand_id filter there errors out, so we subscribe to
    // the table unfiltered (RLS scopes rows to the signed-in brand) and narrow
    // by scan_week in the handler.
    const hasBrandId = tableName !== "tech_stack_cache";

    const setup = async () => {
      try {
        const changeConfig = hasBrandId
          ? {
              event: "*" as const,
              schema: "public",
              table: tableName,
              filter: `brand_id=eq.${brandId}`,
            }
          : { event: "*" as const, schema: "public", table: tableName };

        channel = supabase
          .channel(`${tableName}:${brandId}:${scanWeek}:banner`)
          .on(
            "postgres_changes",
            changeConfig,
            (payload) => {
              const record = payload.new || payload.old;
              if (record && (record as any).scan_week === scanWeek) {
                setHasUpdate(true);

                if (autoRefreshDelay > 0) {
                  autoRefreshTimer = setTimeout(() => {
                    setIsRefreshing(true);
                    window.location.reload();
                  }, autoRefreshDelay);
                }
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
      if (autoRefreshTimer) {
        clearTimeout(autoRefreshTimer);
      }
    };
  }, [tableName, brandId, scanWeek, autoRefreshDelay]);

  if (!hasUpdate) return null;

  const handleRefresh = () => {
    setIsRefreshing(true);
    window.location.reload();
  };

  return (
    <div className="rounded-chip border border-cobalt/30 bg-cobalt/10 px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <svg className="h-4 w-4 text-cobalt" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-sm font-medium text-cobalt">New data available</p>
      </div>
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="rounded-chip bg-cobalt px-3 py-1.5 text-xs font-medium text-white hover:bg-cobalt/90 disabled:opacity-50"
      >
        {isRefreshing ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
