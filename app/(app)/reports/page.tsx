// Reports (Screen 18, /reports).
// Source: `reports` (generated PDFs) + `report_schedules` (delivery config),
// both brand-scoped. Content-only — the (app) layout provides the shell and
// gates user + brand.
//
// Sections (with data):
//   1. ReportsTable — generated reports. Download is shown HONESTLY: R2 wiring
//      is a later sprint, so existing files render a muted "PDF · soon" pill,
//      never a fake URL (CLAUDE.md: no placeholders that fake working data).
//   2. ReportsSchedule — delivery schedules, display-only (no mutation this
//      sprint); active state shown as an Active/Paused StatusPill.
// No reports AND no schedules → honest EmptyState.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { ReportsTable } from "@/components/intelligence/ReportsTable";
import { ReportsSchedule } from "@/components/intelligence/ReportsSchedule";
import { getReportsData } from "@/lib/data/reports";

export const dynamic = "force-dynamic";

const SUBTITLE = "Generated reports and your delivery schedule.";

export default async function ReportsPage() {
  const { reports, schedules } = await getReportsData();

  if (reports.length === 0 && schedules.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" subtitle={SUBTITLE} scanWeek={null} />
        <EmptyState
          intent="scanning"
          title="No reports yet"
          message="Weekly reports are generated after each scan. Once available they'll be listed here for download."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle={SUBTITLE} scanWeek={null} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">Generated reports</h2>
        <ReportsTable reports={reports} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">Delivery schedule</h2>
        <ReportsSchedule schedules={schedules} />
      </section>
    </div>
  );
}
