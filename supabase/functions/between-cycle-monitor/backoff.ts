// DLQ retry scheduling for the between-cycle monitor (agent-orchestration.md
// §"Dead letter queue pattern"). Re-dispatch is fire-and-forget, so each drained
// row is moved to 'retrying' with an exponential next_retry_at; we do NOT mark
// 'resolved' here (the re-invoked module marks its own scan_jobs progress).

import { MODULE_FUNCTION, type ModuleTask } from "../_shared/contracts.ts";

/** Non-module DLQ task types that map straight to an Edge Function name. */
const PIPELINE_FUNCTIONS: Record<string, string> = {
  "synthesis-draft-audit": "synthesis-draft-audit",
  "scan_synthesis": "synthesis-draft-audit",
  "cache-population": "cache-population",
  "cache_population": "cache-population",
};

/**
 * Resolve which Edge Function should re-run a DLQ row from its task_type.
 * Module tasks (traffic_seo, geo_aeo, …) map via MODULE_FUNCTION; pipeline tasks
 * map via PIPELINE_FUNCTIONS. Unknown → null (left in DLQ, not re-dispatched).
 */
export function functionForTask(taskType: string): string | null {
  if (taskType in MODULE_FUNCTION) return MODULE_FUNCTION[taskType as ModuleTask];
  if (taskType in PIPELINE_FUNCTIONS) return PIPELINE_FUNCTIONS[taskType];
  return null;
}

/** Critical modules: a permanent failure here should alert the internal team. */
const CRITICAL_TASKS = new Set<string>([
  "traffic_seo",
  "geo_aeo",
  "regulatory",
  "synthesis-draft-audit",
  "scan_synthesis",
  "cache-population",
  "cache_population",
]);

export function isCriticalTask(taskType: string): boolean {
  return CRITICAL_TASKS.has(taskType);
}

/**
 * Exponential backoff for the NEXT DLQ retry, keyed off the attempt count.
 * attempt 1 → 30m, 2 → 2h, 3 → 6h (capped). The monitor only runs every 6h, so
 * these are floors: a row never retries before its next_retry_at.
 */
export function nextRetryAt(attempt: number, now = Date.now()): string {
  const minutes = [30, 120, 360];
  const idx = Math.min(Math.max(attempt - 1, 0), minutes.length - 1);
  return new Date(now + minutes[idx] * 60 * 1000).toISOString();
}
