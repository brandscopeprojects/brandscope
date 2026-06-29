// weekly-scan-trigger — pg_cron entrypoint (Mon 01:00 UTC, `0 1 * * 1`).
// Invoked with `Authorization: Bearer ${CRON_SECRET}`. Creates one pending
// scan_jobs row per active brand for the current scan_week (idempotent: skips a
// brand that already has a job for the week) and fires a fan-out brand-scan
// invocation per new job. Short-lived: it only seeds state + kicks workers; the
// pipeline then advances via durable scan_jobs state + pgmq (agent-orchestration
// .md §"End-to-end sequence" step 1).

import { serviceClient } from "../_shared/supabase.ts";
import { json, preflight, isAuthorizedInternal } from "../_shared/http.ts";
import { invokeFunction } from "../_shared/scan.ts";
import { mondayOfWeek } from "../_shared/evidence.ts";
import { logCronRun } from "../_shared/logging.ts";

const JOB_NAME = "weekly-scan-trigger";
const SCHEDULE = "0 1 * * 1";

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (!isAuthorizedInternal(req)) return json({ error: "unauthorized" }, 401);

  const sb = serviceClient();
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  // 1. Log cron start.
  await logCronRun(sb, {
    job_name: JOB_NAME,
    schedule: SCHEDULE,
    status: "running",
    started_at: startedAt,
  });

  const scanWeek = mondayOfWeek();

  try {
    // 2. Select all active brands.
    const { data: brands, error: brandsError } = await sb
      .from("brands")
      .select("id")
      .is("deleted_at", null)
      .eq("is_active", true);

    if (brandsError) throw new Error(`load brands: ${brandsError.message}`);

    const brandList = brands ?? [];

    if (brandList.length === 0) {
      const completedAt = new Date().toISOString();
      await logCronRun(sb, {
        job_name: JOB_NAME,
        schedule: SCHEDULE,
        status: "completed",
        started_at: startedAt,
        completed_at: completedAt,
        duration_seconds: Math.round((Date.now() - t0) / 1000),
        metadata: { brands: 0, jobs_created: 0 },
      });
      return json({ ok: true, jobsCreated: 0 });
    }

    // 2b. Find brands that already have a job for this scan_week (skip dupes).
    const brandIds = brandList.map((b) => b.id);
    const { data: existing, error: existingError } = await sb
      .from("scan_jobs")
      .select("brand_id")
      .eq("scan_week", scanWeek)
      .in("brand_id", brandIds);

    if (existingError) throw new Error(`load existing jobs: ${existingError.message}`);

    const already = new Set((existing ?? []).map((r) => r.brand_id));

    // 2c. Insert one pending job per new brand, scoped one brand at a time
    // (never batch across brands — isolation rule). Each insert returns its id.
    const createdJobs: { scan_job_id: string; brand_id: string }[] = [];
    for (const brand of brandList) {
      if (already.has(brand.id)) continue;
      const { data: inserted, error: insertError } = await sb
        .from("scan_jobs")
        .insert({
          brand_id: brand.id,
          status: "pending",
          triggered_by: "cron",
          scan_week: scanWeek,
          progress_percentage: 0,
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        // A unique-constraint race (concurrent trigger) is benign — skip it.
        continue;
      }
      createdJobs.push({ scan_job_id: inserted.id, brand_id: brand.id });
    }

    // 3. Fire-and-forget a brand-scan per new pending job.
    await Promise.allSettled(
      createdJobs.map((j) =>
        invokeFunction("brand-scan", { scan_job_id: j.scan_job_id, brand_id: j.brand_id })
      ),
    );

    // 4. Log completion.
    const completedAt = new Date().toISOString();
    await logCronRun(sb, {
      job_name: JOB_NAME,
      schedule: SCHEDULE,
      status: "completed",
      started_at: startedAt,
      completed_at: completedAt,
      duration_seconds: Math.round((Date.now() - t0) / 1000),
      metadata: { brands: brandList.length, jobs_created: createdJobs.length },
    });

    return json({ ok: true, jobsCreated: createdJobs.length });
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
