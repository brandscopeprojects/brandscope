// Observability writes (agent-orchestration.md Rule 4). EVERY LLM call must write
// an agent_job_logs row; module failures record feature_health_logs + (after
// retries) dead_letter_queue. All take the service-role client.

import type { SupabaseClient } from "./supabase.ts";

export type JobStatus = "passed" | "failed" | "retried";

export type AgentJobLog = {
  scan_job_id?: string | null;
  brand_id?: string | null;
  agent_name: string;
  task_type?: string | null;
  model_used?: string | null;
  prompt_version?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  cost_usd?: number | null;
  duration_ms?: number | null;
  status: JobStatus;
  retry_count?: number | null;
  error_message?: string | null;
  input_snapshot?: unknown;
  output_snapshot?: unknown;
  data_quality_score?: number | null;
  langfuse_trace_id?: string | null;
};

/** Truncate a snapshot so we never store unbounded payloads. */
function truncate(v: unknown, max = 4000): unknown {
  if (v == null) return null;
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > max ? s.slice(0, max) + "…[truncated]" : s;
}

/** Insert an agent_job_logs row. Never throws (logging must not break the job). */
export async function logAgentJob(sb: SupabaseClient, entry: AgentJobLog): Promise<void> {
  try {
    await sb.from("agent_job_logs").insert({
      ...entry,
      input_snapshot: truncate(entry.input_snapshot),
      output_snapshot: truncate(entry.output_snapshot),
    });
  } catch (_e) {
    // swallow — observability failure must not fail the pipeline
  }
}

/** Record a feature's health for a scan (status: 'healthy'|'degraded'|'down'|'not_applicable_mvp'). */
export async function recordFeatureHealth(
  sb: SupabaseClient,
  params: {
    scan_job_id: string;
    brand_id: string;
    scan_week: string;
    feature_category: string;
    feature_name: string;
    status: string;
    root_cause?: string | null;
    resolution_suggested?: string | null;
  },
): Promise<void> {
  try {
    await sb.from("feature_health_logs").insert(params);
  } catch (_e) {
    // swallow
  }
}

/** Push a failed task to the dead_letter_queue (drained by between-cycle-monitor). */
export async function toDeadLetter(
  sb: SupabaseClient,
  params: {
    task_type: string;
    payload: unknown;
    brand_id?: string | null;
    scan_job_id?: string | null;
    failure_reason?: string;
    last_error?: string;
    retryInSeconds?: number;
  },
): Promise<void> {
  const next = new Date(Date.now() + (params.retryInSeconds ?? 6 * 3600) * 1000).toISOString();
  try {
    await sb.from("dead_letter_queue").insert({
      task_type: params.task_type,
      payload: params.payload as never,
      brand_id: params.brand_id ?? null,
      scan_job_id: params.scan_job_id ?? null,
      failure_reason: params.failure_reason ?? null,
      last_error: params.last_error ?? null,
      status: "pending",
      retry_count: 0,
      max_retries: 3,
      next_retry_at: next,
    });
  } catch (_e) {
    // swallow
  }
}

/** Log a cron run (cron_job_logs). */
export async function logCronRun(
  sb: SupabaseClient,
  params: {
    job_name: string;
    schedule: string;
    status: string;
    started_at?: string;
    completed_at?: string;
    duration_seconds?: number;
    error_message?: string | null;
    metadata?: unknown;
  },
): Promise<void> {
  try {
    await sb.from("cron_job_logs").insert({
      job_name: params.job_name,
      schedule: params.schedule,
      status: params.status,
      started_at: params.started_at ?? null,
      completed_at: params.completed_at ?? null,
      duration_seconds: params.duration_seconds ?? null,
      error_message: params.error_message ?? null,
      metadata: (params.metadata ?? null) as never,
    });
  } catch (_e) {
    // swallow
  }
}
