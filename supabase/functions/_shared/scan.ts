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

/** Fire-and-forget invoke another Edge Function (orchestrator → worker). */
export async function invokeFunction(name: string, payload: unknown): Promise<void> {
  const base = requireEnv("SUPABASE_URL");
  const secret = requireEnv("CRON_SECRET");
  await fetch(`${base}/functions/v1/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    // fire-and-forget: the worker also drains its queue, so a dropped invoke is
    // recoverable. Failures surface via DLQ / monitor.
  });
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
