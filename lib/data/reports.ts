import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBrand } from "@/lib/data/brand";

// Reports data layer (Screen 18, /reports).
// Source: `reports` (generated PDFs, R2-backed) + `report_schedules` (delivery
// config). Both are brand-scoped and RLS-protected. R2 download wiring lands in
// a later sprint, so the page exposes no download URL — it only lists what was
// generated. This layer reads honestly: empty arrays when nothing exists yet.

/** One generated report row for the brand (newest first). */
export type ReportRow = {
  reportType: string;
  title: string;
  pageCount: number | null;
  /** R2 object path. Present = a file exists, but NOT a fetchable URL (later sprint). */
  r2Path: string | null;
  scanWeek: string | null;
  shareToken: string | null;
  shareExpiresAt: string | null;
  createdAt: string | null;
  generatedBy: string | null;
};

/** One delivery schedule row for the brand. */
export type ReportScheduleRow = {
  reportType: string;
  frequency: string;
  dayOfWeek: string | null;
  timeOfDay: string | null;
  format: string | null;
  recipients: string[];
  isActive: boolean;
  lastSentAt: string | null;
};

export type ReportsData = {
  reports: ReportRow[];
  schedules: ReportScheduleRow[];
};

const EMPTY: ReportsData = { reports: [], schedules: [] };

/** Generated reports + delivery schedules for the signed-in user's brand.
 *  Always returns the shape (empty arrays when there is no brand / no rows). */
export async function getReportsData(): Promise<ReportsData> {
  const brand = await getCurrentBrand();
  if (!brand) return EMPTY;

  const supabase = createClient();

  const [{ data: reportRows }, { data: scheduleRows }] = await Promise.all([
    supabase
      .from("reports")
      .select(
        "report_type, title, page_count, r2_path, scan_week, share_token, share_expires_at, created_at, generated_by",
      )
      .eq("brand_id", brand.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("report_schedules")
      .select(
        "report_type, frequency, day_of_week, time_of_day, format, recipients, is_active, last_sent_at",
      )
      .eq("brand_id", brand.id),
  ]);

  const reports: ReportRow[] = (reportRows ?? []).map((r) => ({
    reportType: r.report_type,
    title: r.title,
    pageCount: r.page_count,
    r2Path: r.r2_path,
    scanWeek: r.scan_week,
    shareToken: r.share_token,
    shareExpiresAt: r.share_expires_at,
    createdAt: r.created_at,
    generatedBy: r.generated_by,
  }));

  const schedules: ReportScheduleRow[] = (scheduleRows ?? []).map((s) => ({
    reportType: s.report_type,
    frequency: s.frequency,
    dayOfWeek: s.day_of_week,
    timeOfDay: s.time_of_day,
    format: s.format,
    recipients: s.recipients ?? [],
    isActive: s.is_active ?? false,
    lastSentAt: s.last_sent_at,
  }));

  return { reports, schedules };
}
