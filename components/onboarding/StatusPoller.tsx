"use client";

// StatusPoller — polls scan_jobs status every 5s for the scanning screen (Screen 2).
// Uses the BROWSER Supabase client (anon key); RLS scopes the read to the user's
// brand, so we query by brand_id and trust RLS to enforce isolation.
//   status 'completed' → redirect /dashboard
//   status 'failed'    → surface Retry (onFailed)
// Drives the visual scanning UI (RadarAnimation, ProgressChecklist, ProgressBar).
//
// NOTE (Sprint 3 dependency): the scan pipeline is NOT built yet, so the job stays
// 'pending' indefinitely at MVP Sprint 2 — the UI shows the in-progress state and
// the friendly "First scan takes 2–3 minutes…" copy. Polling is harmless until the
// Sprint 3 cron flips the status.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RadarAnimation } from "./RadarAnimation";
import { ProgressBar } from "./ProgressBar";
import {
  ProgressChecklist,
  type ChecklistItem,
} from "./ProgressChecklist";
import { PrimaryButton } from "./PrimaryButton";

const POLL_INTERVAL_MS = 5000;
const REVEAL_INTERVAL_MS = 800;

// Presentational checklist (the real per-module trace lands in Sprint 3).
const CHECKLIST_LABELS = [
  "Locking in your brand profile",
  "Mapping your competitor set",
  "Queuing GEO visibility across 4 AI platforms",
  "Scheduling SEO & traffic intelligence",
  "Scheduling regulatory compliance checks",
  "Preparing your first action plan",
];

type ScanStatus = "pending" | "running" | "partial" | "completed" | "failed";

type StatusPollerProps = {
  brandId: string;
  /** initial status from SSR, to avoid a blank first frame */
  initialStatus: ScanStatus;
  initialProgress?: number;
};

export function StatusPoller({
  brandId,
  initialStatus,
  initialProgress = 0,
}: StatusPollerProps) {
  const router = useRouter();
  const [status, setStatus] = useState<ScanStatus>(initialStatus);
  const [progress, setProgress] = useState<number>(initialProgress);
  const [revealCount, setRevealCount] = useState(1);
  const redirected = useRef(false);

  // Poll scan_jobs every 5s (RLS-scoped via the browser client).
  useEffect(() => {
    if (status === "completed" || status === "failed") return;
    const supabase = createClient();
    let cancelled = false;

    async function poll() {
      const { data, error } = await supabase
        .from("scan_jobs")
        .select("status, progress_percentage")
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false })
        .limit(1)
        .returns<{ status: string; progress_percentage: number | null }[]>();
      if (cancelled || error || !data || data.length === 0) return;
      const row = data[0];
      setStatus(row.status as ScanStatus);
      if (typeof row.progress_percentage === "number") {
        setProgress(row.progress_percentage);
      }
    }

    const id = setInterval(poll, POLL_INTERVAL_MS);
    void poll();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [brandId, status]);

  // Sequentially reveal checklist items (~800ms) for the "alive" feel.
  useEffect(() => {
    if (status === "completed" || status === "failed") return;
    if (revealCount >= CHECKLIST_LABELS.length) return;
    const id = setTimeout(
      () => setRevealCount((n) => Math.min(n + 1, CHECKLIST_LABELS.length)),
      REVEAL_INTERVAL_MS,
    );
    return () => clearTimeout(id);
  }, [revealCount, status]);

  // Redirect on completion.
  useEffect(() => {
    if (status === "completed" && !redirected.current) {
      redirected.current = true;
      router.replace("/dashboard");
    }
  }, [status, router]);

  const items: ChecklistItem[] = CHECKLIST_LABELS.map((label, i) => {
    if (i >= revealCount) return { label, state: "pending" };
    // Revealed items below the latest reveal show as done; the latest is active.
    if (i < revealCount - 1) return { label, state: "done" };
    return { label, state: "active" };
  });

  if (status === "failed") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-urgent">
          Your first scan didn’t complete. You can retry it now.
        </p>
        <PrimaryButton onClick={() => router.refresh()}>Retry scan</PrimaryButton>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-8">
      <RadarAnimation />
      <p className="font-mono text-xs uppercase tracking-wider text-white/50">
        Step 5 of 5
      </p>
      <div className="w-full">
        <ProgressBar percent={progress} />
      </div>
      <div className="w-full">
        <ProgressChecklist items={items} />
      </div>
      <p className="text-center text-xs text-white/50">
        First scan takes 2–3 minutes. We’ll email you when ready.
      </p>
    </div>
  );
}
