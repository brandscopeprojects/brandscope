"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type ScanJob = Database["public"]["Tables"]["scan_jobs"]["Row"];

const MODULE_LABELS: Record<string, string> = {
  traffic_seo: "Traffic & SEO",
  geo_aeo: "GEO & AI Visibility",
  tech_stack: "Tech Stack",
  promotions: "Promotions",
  regulatory: "Regulatory",
  customer: "Customer Intel",
  hiring: "Hiring Signals",
  app_store: "App Store",
};

export function ScanProgress({ scanJobId, brandName }: { scanJobId: string; brandName: string }) {
  const [job, setJob] = useState<ScanJob | null>(null);
  const [completedModules, setCompletedModules] = useState<Set<string>>(new Set());
  const supabase = createClient();

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const setup = async () => {
      try {
        // Initial query
        const { data: initialJob } = await supabase
          .from("scan_jobs")
          .select("*")
          .eq("id", scanJobId)
          .single();

        if (initialJob) {
          setJob(initialJob);
          setCompletedModules(new Set(initialJob.completed_steps || []));
        }

        // Subscribe to realtime updates
        channel = supabase
          .channel(`scan_jobs:${scanJobId}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "scan_jobs",
              filter: `id=eq.${scanJobId}`,
            },
            (payload) => {
              const updated = payload.new as ScanJob;
              setJob(updated);
              setCompletedModules(new Set(updated.completed_steps || []));
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
  }, [scanJobId, supabase]);

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-divider bg-card/50 px-6 py-12 text-center">
        <span className="mb-4 h-2.5 w-2.5 animate-brand-pulse rounded-full bg-cobalt" aria-hidden />
        <h3 className="font-display text-lg font-bold text-ink">Scan initializing…</h3>
        <p className="mt-1.5 max-w-md text-sm leading-6 text-ink-secondary">Starting analysis…</p>
      </div>
    );
  }

  const totalModules = job.expected_modules?.length || 8;
  const progress = job.progress_percentage || 0;
  const expectedModules = (job.expected_modules as string[]) || [];

  return (
    <div className="space-y-6 rounded-card border border-divider bg-card/50 px-6 py-8">
      {/* Header */}
      <div>
        <h3 className="font-display text-lg font-bold text-ink">Scan in progress</h3>
        <p className="mt-1 text-sm text-ink-secondary">
          Analyzing {brandName} against your competitors
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink-secondary">Overall progress</span>
          <span className="text-sm font-bold text-cobalt">{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-divider">
          <div
            className="h-full bg-gradient-to-r from-cobalt to-cobalt/70 transition-all duration-500"
            style={{ width: `${progress}%` }}
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
          />
        </div>
      </div>

      {/* Module breakdown */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Modules</p>
        <div className="grid gap-2">
          {expectedModules.length > 0 ? (
            expectedModules.map((mod) => {
              const isCompleted = completedModules.has(mod);
              return (
                <div
                  key={mod}
                  className="flex items-center gap-3 rounded-sm px-3 py-2 bg-base-secondary/30"
                >
                  {isCompleted ? (
                    <svg
                      className="h-4 w-4 text-success"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <span className="h-4 w-4 rounded-full border-2 border-cobalt border-r-transparent animate-spin" />
                  )}
                  <span className={`text-sm ${isCompleted ? "text-ink-secondary" : "font-medium text-ink"}`}>
                    {MODULE_LABELS[mod] || mod}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-ink-secondary">
              {progress > 50 ? "Synthesizing recommendations…" : "Gathering intelligence…"}
            </div>
          )}
        </div>
      </div>

      {/* Status message */}
      <p className="text-xs text-ink-secondary">
        {progress > 90
          ? "Finalizing your action plan…"
          : progress > 50
            ? "Analyzing competitor moves and market trends…"
            : "Fetching fresh intelligence from your markets…"}
      </p>
    </div>
  );
}
