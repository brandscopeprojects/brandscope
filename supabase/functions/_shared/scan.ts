// Scan-job state machine helpers (agent-orchestration.md). Edge Functions are
// short-lived, so the pipeline advances via durable state in scan_jobs + pgmq.
// Completion detection uses scan_jobs.expected_modules vs completed_steps via an
// atomic RPC (migration 13) so parallel module finishes can't double-enqueue
// synthesis.

import { requireEnv } from "./env.ts";
import type { SupabaseClient } from "./supabase.ts";
import { queueSend } from "./queue.ts";
import {
  QUEUES,
  MVP_MODULES,
  MODULE_PREF_COLUMN,
  type ModuleTask,
  type ScanModuleMessage,
  type ScanSynthesisMessage,
} from "./contracts.ts";

/**
 * Fire-and-forget invoke another Edge Function (orchestrator → worker).
 *
 * CRITICAL: this must NOT await the worker's response. Awaiting it serialised the
 * whole pipeline into a single isolate — brand-scan `await`ed each researcher, the
 * last researcher `await`ed synthesis (~139s), which `await`ed cache-population —
 * so brand-scan stayed open for the entire chain and blew Supabase's ~150s isolate
 * ceiling (504). We dispatch the POST and hand the in-flight promise to the runtime
 * via `EdgeRuntime.waitUntil` so the caller returns immediately while the isolate
 * stays alive long enough to deliver the request. The worker also drains its pgmq
 * queue, so a dropped invoke is still recoverable via DLQ / the monitor.
 */
export function invokeFunction(name: string, payload: unknown): void {
  const base = requireEnv("SUPABASE_URL");
  const secret = requireEnv("CRON_SECRET");
  const inflight = fetch(`${base}/functions/v1/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((r) => {
      // Drain/close the body so the connection can be released; we never read it.
      void r.body?.cancel?.().catch(() => {});
    })
    .catch(() => {
      // fire-and-forget: recoverable via the worker's own queue drain + DLQ.
    });
  // Keep the isolate alive past the handler's return until the POST is delivered.
  // Falls through harmlessly off-runtime (local/test) — the promise still runs.
  try {
    (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
      .EdgeRuntime?.waitUntil?.(inflight);
  } catch {
    // not on the Supabase edge runtime — nothing to hook into.
  }
}

/** The modules enabled for a brand given its brand_preferences row. */
export function enabledModules(prefs: Record<string, unknown> | null): ModuleTask[] {
  if (!prefs) return [...MVP_MODULES];
  return MVP_MODULES.filter((m) => {
    const col = MODULE_PREF_COLUMN[m];
    if (!col) return true;
    return prefs[col] !== false; // default-on unless explicitly disabled
  });
}

export async function setScanStatus(
  sb: SupabaseClient,
  scanJobId: string,
  status: "running" | "completed" | "partial" | "failed",
  patch: Record<string, unknown> = {},
): Promise<void> {
  await sb.from("scan_jobs").update({ status, updated_at: new Date().toISOString(), ...patch })
    .eq("id", scanJobId);
}

export async function enqueueModule(sb: SupabaseClient, msg: ScanModuleMessage): Promise<void> {
  await queueSend(sb, QUEUES.modules, msg);
}

export async function enqueueSynthesis(sb: SupabaseClient, msg: ScanSynthesisMessage): Promise<void> {
  await queueSend(sb, QUEUES.synthesis, msg);
}

export type ModuleOutcome = "ok" | "failed" | "partial";

/**
 * Atomically record a module's result and learn whether THIS call completed the
 * fan-out (all expected modules finished, synthesis not yet enqueued). Returns
 * true exactly once per job so the caller can enqueue scan_synthesis safely.
 */
export async function completeModule(
  sb: SupabaseClient,
  scanJobId: string,
  task: ModuleTask,
  outcome: ModuleOutcome,
): Promise<boolean> {
  const { data, error } = await sb.rpc("app_scan_complete_module", {
    p_scan_job_id: scanJobId,
    p_task: task,
    p_outcome: outcome,
  });
  if (error) throw new Error(`completeModule: ${error.message}`);
  return Boolean(data);
}
