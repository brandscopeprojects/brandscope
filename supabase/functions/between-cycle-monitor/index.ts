// between-cycle-monitor — pg_cron entrypoint (every 6h, `0 */6 * * *`).
// Invoked with `Authorization: Bearer ${CRON_SECRET}`; body may be empty `{}`.
// Four bounded passes (agent-orchestration.md §sequence step 7 + §"Dead letter
// queue pattern"; data-flow-rules.md §3 rule 5, §4 DLQ drain, §6):
//   1. Drain dead_letter_queue (re-dispatch + exponential backoff).
//   2. Process unprocessed competitor_changes → fire alerts (NO rec regen).
//   3. Reconcile stuck scan_jobs (running > ~2h).
//   4. logCronRun completed with {dlq_processed, changes_processed, alerts_fired}.
//
// Service-role client (RLS bypassed) → every brand-data touch is scoped by
// brand_id. Between-cycle alerts only UPDATE fields + INSERT alert_history; they
// NEVER regenerate recommendations (that needs a full on-demand Drafter+Auditor
// scan).

import { serviceClient, type SupabaseClient } from "../_shared/supabase.ts";
import { json, preflight, isAuthorizedInternal } from "../_shared/http.ts";
import { invokeFunction } from "../_shared/scan.ts";
import { logCronRun } from "../_shared/logging.ts";
import { MVP_MODULES, MODULE_FUNCTION, type ModuleTask } from "../_shared/contracts.ts";
import { functionForTask, isCriticalTask, nextRetryAt } from "./backoff.ts";
import { evaluateChange } from "./alerts.ts";

const JOB_NAME = "between-cycle-monitor";
const SCHEDULE = "0 */6 * * *";

const DLQ_BATCH = 50;
const CHANGES_BATCH = 100;
const MAX_RETRIES = 3; // matches dead_letter_queue.max_retries default
const STUCK_SCAN_MINUTES = 120; // scan_jobs 'running' older than ~2h = stuck

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (!isAuthorizedInternal(req)) return json({ error: "unauthorized" }, 401);

  const sb = serviceClient();
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  await logCronRun(sb, {
    job_name: JOB_NAME,
    schedule: SCHEDULE,
    status: "running",
    started_at: startedAt,
  });

  try {
    const dlq_processed = await drainDeadLetterQueue(sb);
    const { changes_processed, alerts_fired } = await processCompetitorChanges(sb);
    const scans_reconciled = await reconcileStuckScans(sb);

    const completedAt = new Date().toISOString();
    await logCronRun(sb, {
      job_name: JOB_NAME,
      schedule: SCHEDULE,
      status: "completed",
      started_at: startedAt,
      completed_at: completedAt,
      duration_seconds: Math.round((Date.now() - t0) / 1000),
      metadata: { dlq_processed, changes_processed, alerts_fired, scans_reconciled },
    });

    return json({ ok: true, dlq_processed, changes_processed, alerts_fired, scans_reconciled });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logCronRun(sb, {
      job_name: JOB_NAME,
      schedule: SCHEDULE,
      status: "failed",
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      duration_seconds: Math.round((Date.now() - t0) / 1000),
      error_message: message,
    });
    return json({ ok: false, error: message }, 500);
  }
});

// ---------------------------------------------------------------------------
// 1. Drain the dead letter queue.
// ---------------------------------------------------------------------------
// Select due rows (status pending|retrying, next_retry_at <= now). For each:
//  - resolve the Edge Function from task_type (module → MODULE_FUNCTION, or
//    pipeline task → synthesis-draft-audit / cache-population);
//  - re-invoke it (fire-and-forget) with the stored payload;
//  - bump retry_count, move to 'retrying', schedule the next exponential retry;
//  - at retry_count >= max_retries → 'permanently_failed' (+ alert internal team
//    for critical tasks).
// We never mark 'resolved' here: invoke is fire-and-forget, so success is
// confirmed only when the re-run worker advances its own scan_jobs state.
async function drainDeadLetterQueue(sb: SupabaseClient): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data: rows, error } = await sb
    .from("dead_letter_queue")
    .select("*")
    .in("status", ["pending", "retrying"])
    .lte("next_retry_at", nowIso)
    .order("next_retry_at", { ascending: true })
    .limit(DLQ_BATCH);

  if (error) throw new Error(`dlq select: ${error.message}`);

  let processed = 0;

  for (const row of rows ?? []) {
    const attempt = (row.retry_count ?? 0) + 1;
    const maxRetries = row.max_retries ?? MAX_RETRIES;

    // Exhausted → permanently failed.
    if (attempt > maxRetries) {
      await sb.from("dead_letter_queue").update({
        status: "permanently_failed",
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);

      if (isCriticalTask(row.task_type)) {
        // TODO(alerting): notify internal team channel for a permanently-failed
        // critical task. Email delivery (Resend) is excluded at MVP — record as
        // an internal alert when an internal-alert surface exists.
        await sb.from("cron_job_logs").insert({
          job_name: `${JOB_NAME}:critical-dlq`,
          schedule: SCHEDULE,
          status: "failed",
          started_at: new Date().toISOString(),
          error_message:
            `Critical task '${row.task_type}' permanently failed (dlq ${row.id}); ` +
            `last_error: ${row.last_error ?? row.failure_reason ?? "unknown"}`,
        }).then(() => {}, () => {});
      }
      processed++;
      continue;
    }

    const fnName = functionForTask(row.task_type);
    if (!fnName) {
      // Unknown task_type: can't re-dispatch. Mark permanently_failed so it stops
      // being re-selected, leaving the payload for manual inspection.
      await sb.from("dead_letter_queue").update({
        status: "permanently_failed",
        failure_reason: `unmapped task_type '${row.task_type}'`,
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      processed++;
      continue;
    }

    // Re-dispatch with the stored payload (fire-and-forget).
    await invokeFunction(fnName, row.payload);

    // Bump retry_count, mark 'retrying', schedule next exponential retry. We do
    // NOT mark resolved — the re-run worker confirms success via scan_jobs.
    await sb.from("dead_letter_queue").update({
      status: "retrying",
      retry_count: attempt,
      next_retry_at: nextRetryAt(attempt),
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);

    processed++;
  }

  return processed;
}

// ---------------------------------------------------------------------------
// 2. Process unprocessed competitor_changes → fire alerts.
// ---------------------------------------------------------------------------
// competitor_changes has no brand_id; a competitor is shared across brands via
// brand_competitors, so one change can affect several brands. For each change we
// resolve every brand tracking that competitor, evaluate against that brand's
// alert_configs (flags + thresholds), and INSERT an alert_history row when an
// alert should fire. We then mark the change processed. We NEVER regenerate
// recommendations (data-flow-rules.md §3 rule 5).
async function processCompetitorChanges(
  sb: SupabaseClient,
): Promise<{ changes_processed: number; alerts_fired: number }> {
  const { data: changes, error } = await sb
    .from("competitor_changes")
    .select("*")
    .eq("processed", false)
    .order("detected_at", { ascending: true })
    .limit(CHANGES_BATCH);

  if (error) throw new Error(`changes select: ${error.message}`);

  let changes_processed = 0;
  let alerts_fired = 0;

  // Small caches to avoid refetching the same competitor / brand config.
  const competitorName = new Map<string, string>();
  const brandsForCompetitor = new Map<string, string[]>();
  const alertConfig = new Map<string, Awaited<ReturnType<typeof loadAlertConfig>>>();

  for (const change of changes ?? []) {
    // Resolve competitor display name.
    if (!competitorName.has(change.competitor_id)) {
      const { data: comp } = await sb
        .from("competitors")
        .select("name")
        .eq("id", change.competitor_id)
        .maybeSingle();
      competitorName.set(change.competitor_id, comp?.name ?? "A competitor");
    }
    const compName = competitorName.get(change.competitor_id)!;

    // Resolve every brand that tracks this competitor (per-brand scoping).
    if (!brandsForCompetitor.has(change.competitor_id)) {
      const { data: links } = await sb
        .from("brand_competitors")
        .select("brand_id")
        .eq("competitor_id", change.competitor_id);
      brandsForCompetitor.set(
        change.competitor_id,
        (links ?? []).map((l) => l.brand_id),
      );
    }
    const brandIds = brandsForCompetitor.get(change.competitor_id)!;

    for (const brandId of brandIds) {
      if (!alertConfig.has(brandId)) {
        alertConfig.set(brandId, await loadAlertConfig(sb, brandId));
      }
      const cfg = alertConfig.get(brandId)!;

      const decision = evaluateChange(change, cfg, compName);
      if (!decision.fire) continue;

      // Fire the alert: INSERT alert_history ONLY (no rec regeneration).
      // delivered_via records the channels we logged the alert for. Real email
      // send-out (Resend) is EXCLUDED at MVP — the row IS the delivery record.
      // TODO(delivery): when an in-app notification feed / approved email
      // provider exists, push to those channels here; for now the alert_history
      // row is the source of truth the brand's alerts screen reads.
      const { error: histErr } = await sb.from("alert_history").insert({
        brand_id: brandId,
        alert_type: decision.alert_type,
        message: decision.message,
        delivered_via: decision.delivered_via,
        status: "fired",
        payload: {
          competitor_id: change.competitor_id,
          change_id: change.id,
          change_type: change.change_type,
          impact_level: change.impact_level,
          source_url: change.source_url,
          detected_at: change.detected_at,
        } as never,
      });
      if (!histErr) alerts_fired++;
    }

    // Mark the change processed (idempotent: a re-run won't re-fire).
    await sb.from("competitor_changes").update({
      processed: true,
      processed_at: new Date().toISOString(),
    }).eq("id", change.id);

    changes_processed++;
  }

  return { changes_processed, alerts_fired };
}

async function loadAlertConfig(sb: SupabaseClient, brandId: string) {
  const { data } = await sb
    .from("alert_configs")
    .select("*")
    .eq("brand_id", brandId)
    .maybeSingle();
  return data ?? null;
}

// ---------------------------------------------------------------------------
// 3. Reconcile stuck scan_jobs (conservative).
// ---------------------------------------------------------------------------
// scan_jobs still 'running' after ~2h with modules not fully covered by
// completed_steps: re-invoke the missing module researchers. If the job is also
// older than the 06:00 retry window (well past one cycle), mark it 'partial' so
// the brand falls back to previous-week cache for the missing modules
// (data-flow-rules.md §4). Kept conservative: never touch 'completed'/'failed'.
async function reconcileStuckScans(sb: SupabaseClient): Promise<number> {
  const cutoff = new Date(Date.now() - STUCK_SCAN_MINUTES * 60 * 1000).toISOString();
  const { data: jobs, error } = await sb
    .from("scan_jobs")
    .select("id, brand_id, scan_week, status, started_at, completed_steps, failed_modules")
    .eq("status", "running")
    .lt("started_at", cutoff)
    .limit(50);

  if (error) throw new Error(`stuck scans select: ${error.message}`);

  let reconciled = 0;
  const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;

  for (const job of jobs ?? []) {
    const done = new Set<string>(job.completed_steps ?? []);
    const failed = new Set<string>(job.failed_modules ?? []);

    // Expected modules = the MVP set; missing = neither completed nor failed.
    const missing = MVP_MODULES.filter((m) => !done.has(m) && !failed.has(m));

    if (missing.length === 0) {
      // Fan-out is fully accounted for but the job never advanced past 'running'
      // (synthesis/cache-population likely dropped). Leave to DLQ/retry; do not
      // force-complete here.
      continue;
    }

    const startedMs = job.started_at ? Date.parse(job.started_at) : 0;
    const wellPastWindow = startedMs > 0 && startedMs < sixHoursAgo;

    if (wellPastWindow) {
      // Past the retry window → accept a partial result; missing modules fall
      // back to previous-week cache downstream.
      await sb.from("scan_jobs").update({
        status: "partial",
        partial_modules: missing,
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      reconciled++;
      continue;
    }

    // Within window → re-invoke the missing researchers (fire-and-forget). Each
    // worker advances its own scan_jobs state via the completion RPC.
    await Promise.allSettled(
      missing.map((m: ModuleTask) =>
        invokeFunction(MODULE_FUNCTION[m], {
          scan_job_id: job.id,
          brand_id: job.brand_id,
          scan_week: job.scan_week,
          task_type: m,
          retry: true,
        })
      ),
    );
    reconciled++;
  }

  return reconciled;
}
