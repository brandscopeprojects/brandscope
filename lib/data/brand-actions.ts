"use server";

// Multi-brand server actions: switch the active brand, and manually kick a scan
// for a brand. Both authorise via the RLS-scoped client (the brand must be visible
// to the caller = in their org) before any privileged write.

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACTIVE_BRAND_COOKIE } from "@/lib/data/brand";

const YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Monday (UTC) of the current week as YYYY-MM-DD (matches the scan_week convention). */
function currentScanWeek(): string {
  const d = new Date();
  const day = d.getUTCDay(); // 0 = Sun … 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Switch the active brand. Validated to belong to the user's org (RLS). */
export async function setActiveBrand(brandId: string): Promise<{ ok: boolean }> {
  await requireUser();
  const supabase = createClient();
  const { data } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return { ok: false };

  cookies().set(ACTIVE_BRAND_COOKIE, brandId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: YEAR_SECONDS,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Manually start (or restart) a scan for one brand — the "Scan now" action.
 * Reuses this week's scan_jobs row (resetting it) or creates one, then invokes
 * brand-scan. Best-effort kick; the job row is the durable record.
 */
export async function scanBrand(brandId: string): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  const supabase = createClient();
  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!brand) return { ok: false, error: "Brand not found." };

  const admin = createAdminClient();
  const scanWeek = currentScanWeek();

  const { data: existing } = await admin
    .from("scan_jobs")
    .select("id")
    .eq("brand_id", brandId)
    .eq("scan_week", scanWeek)
    .maybeSingle();

  let scanJobId = existing?.id ?? null;
  if (scanJobId) {
    await admin
      .from("scan_jobs")
      .update({
        status: "pending",
        progress_percentage: 0,
        synthesis_enqueued: false,
        completed_steps: [],
        partial_modules: [],
        failed_modules: [],
        error_message: null,
        started_at: new Date().toISOString(),
      })
      .eq("id", scanJobId);
  } else {
    const { data: job, error } = await admin
      .from("scan_jobs")
      .insert({
        brand_id: brandId,
        status: "pending",
        triggered_by: "manual",
        scan_week: scanWeek,
        progress_percentage: 0,
      })
      .select("id")
      .single();
    if (error || !job) return { ok: false, error: error?.message ?? "Could not queue the scan." };
    scanJobId = job.id;
  }

  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/brand-scan`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scan_job_id: scanJobId, brand_id: brandId, force_refresh: true }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    // best-effort — the pending job persists and can be re-kicked
  }

  revalidatePath("/portfolio");
  revalidatePath("/dashboard");
  return { ok: true };
}
