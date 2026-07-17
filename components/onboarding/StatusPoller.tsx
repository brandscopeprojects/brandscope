"use client";

// StatusPoller — REAL scan progress for the scanning screen (Screen 2).
// Polls scan_jobs every 4s via the browser client (RLS scopes to the user's
// brand) and renders the ACTUAL pipeline state: each intelligence module ticks
// as it lands (completed_steps vs expected_modules), then the synthesis stage,
// then redirect. No timed fake checklist — the wait IS the product demo
// (docs/backlog.md P1-1), so every tick shown here really happened.
//
// Terminal states: 'completed' AND 'partial' both redirect — partial means the
// action plan exists with some module gaps (the dashboard explains those
// honestly). Only 'failed' stops with a retry.

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

const POLL_INTERVAL_MS = 4000;

// Canonical module order + human labels (mirror of MVP_MODULES).
const MODULE_LABELS: Array<{ key: string; label: string }> = [
  { key: "traffic_seo", label: "Traffic & SEO intelligence" },
  { key: "geo_aeo", label: "AI visibility — ChatGPT, Claude, Gemini, Perplexity" },
  { key: "tech_stack", label: "Technology & ad-network detection" },
  { key: "app_store", label: "App-store presence" },
  { key: "customer", label: "Customer intelligence" },
  { key: "regulatory", label: "Regulatory compliance" },
  { key: "promotions", label: "Promotion signals" },
  { key: "hiring", label: "Hiring signals" },
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
}: StatusPollerProps) {
  const router = useRouter();
  const [status, setStatus] = useState<ScanStatus>(initialStatus);
  const [expected, setExpected] = useState<string[]>([]);
  const [done, setDone] = useState<string[]>([]);
  const redirected = useRef(false);

  // Poll the real job state every 4s (RLS-scoped via the browser client).
  useEffect(() => {
    if (status === "completed" || status === "partial" || status === "failed") return;
    const supabase = createClient();
    let cancelled = false;

    async function poll() {
      const { data, error } = await supabase
        .from("scan_jobs")
        .select("status, expected_modules, completed_steps")
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false })
        .limit(1)
        .returns<
          { status: string; expected_modules: string[] | null; completed_steps: string[] | null }[]
        >();
      if (cancelled || error || !data || data.length === 0) return;
      const row = data[0];
      setStatus(row.status as ScanStatus);
      setExpected(row.expected_modules ?? []);
      setDone(row.completed_steps ?? []);
    }

    const id = setInterval(poll, POLL_INTERVAL_MS);
    void poll();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [brandId, status]);

  // Redirect on ANY terminal-with-plan state (completed or partial).
  useEffect(() => {
    if ((status === "completed" || status === "partial") && !redirected.current) {
      redirected.current = true;
      router.replace("/dashboard");
    }
  }, [status, router]);

  const isTerminal = status === "completed" || status === "partial";
  const modules = MODULE_LABELS.filter(
    (m) => expected.length === 0 || expected.includes(m.key),
  );
  const doneSet = new Set(done);
  const modulesDone = modules.filter((m) => doneSet.has(m.key)).length;
  const allModulesDone = modules.length > 0 && modulesDone === modules.length;

  // REAL progress: dispatch 8% → modules 8–80% (each tick is a landed module) →
  // synthesis holds at 90% → terminal 100%. Never pretends beyond what happened.
  const percent = isTerminal
    ? 100
    : expected.length === 0
      ? 4 // job created, fan-out not recorded yet
      : Math.round(8 + (modulesDone / modules.length) * 72 + (allModulesDone ? 10 : 0));

  const items: ChecklistItem[] = [
    {
      label: "Dispatching your competitor scan",
      state: expected.length > 0 || isTerminal ? "done" : "active",
    },
    ...modules.map((m, i): ChecklistItem => {
      if (doneSet.has(m.key) || isTerminal) return { label: m.label, state: "done" };
      // First unfinished module shows as active (they run in parallel; this is
      // simply the next thing the user is waiting on).
      const firstUnfinished = modules.findIndex((x) => !doneSet.has(x.key));
      return { label: m.label, state: i === firstUnfinished ? "active" : "pending" };
    }),
    {
      label: "Drafting & auditing your evidence-backed action plan",
      state: isTerminal ? "done" : allModulesDone ? "active" : "pending",
    },
  ];

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
        {allModulesDone && !isTerminal
          ? "Synthesising your action plan"
          : `${modulesDone} of ${modules.length || 8} intelligence modules complete`}
      </p>
      <div className="w-full">
        <ProgressBar percent={percent} />
      </div>
      <div className="w-full">
        <ProgressChecklist items={items} />
      </div>
      <p className="text-center text-xs text-white/50">
        Live progress — each line ticks as real data lands. A full first scan
        typically takes 3–6 minutes.
      </p>
    </div>
  );
}
