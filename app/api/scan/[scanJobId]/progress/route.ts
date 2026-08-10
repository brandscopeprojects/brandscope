import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/scan/:scanJobId/progress
 * Returns real-time scan progress: job status, % complete, and completed modules.
 * Called by ScanProgress component every 2 seconds during active scans.
 */
export async function GET(
  _req: Request,
  { params }: { params: { scanJobId: string } }
) {
  try {
    await requireUser();
    const supabase = createClient();

    // Fetch scan job with current status
    const { data: job, error } = await supabase
      .from("scan_jobs")
      .select("id, status, progress_percentage, expected_modules, completed_steps, created_at")
      .eq("id", params.scanJobId)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    // Parse completed_steps JSON to extract which modules finished
    let completedModules: string[] = [];
    if (job.completed_steps) {
      try {
        const steps = JSON.parse(job.completed_steps as unknown as string);
        completedModules = (Object.entries(steps) as Array<[string, unknown]>)
          .filter(([_, v]) => v === "ok" || v === "partial")
          .map(([k]) => k);
      } catch {
        // If JSON parse fails, no modules marked complete yet
      }
    }

    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        progress_percentage: job.progress_percentage,
        expected_modules: job.expected_modules,
        created_at: job.created_at,
      },
      completedModules,
    });
  } catch (e) {
    console.error("Progress API error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
