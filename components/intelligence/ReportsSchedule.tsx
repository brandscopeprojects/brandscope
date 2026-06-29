// ReportsSchedule — the delivery-schedule list for Screen 18 (/reports).
// Display-only this sprint (no mutation): shows each report_schedules row with
// report type, frequency + day/time (mono), format, recipients count, and an
// Active/Paused StatusPill. Built on the shared DataTable. Tokens only.

import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { StatusPill } from "@/components/intelligence/StatusPill";
import type { ReportScheduleRow } from "@/lib/data/reports";

const TYPE_LABEL: Record<string, string> = {
  weekly: "Weekly",
  weekly_scan: "Weekly scan",
  monthly: "Monthly",
  competitor: "Competitor",
  regulatory: "Regulatory",
  geo: "GEO",
  custom: "Custom",
};

function typeLabel(type: string): string {
  return TYPE_LABEL[type] ?? type.replace(/_/g, " ");
}

function titleCase(v: string): string {
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/** "Weekly · Mon 08:00" style cadence string from frequency + day + time. */
function cadence(row: ReportScheduleRow): string {
  const parts = [titleCase(row.frequency)];
  const dayTime = [row.dayOfWeek, row.timeOfDay].filter(Boolean).join(" ");
  if (dayTime) parts.push(dayTime);
  return parts.join(" · ");
}

const columns: Column<ReportScheduleRow>[] = [
  {
    key: "type",
    header: "Report",
    cell: (r) => <span className="font-medium text-ink">{typeLabel(r.reportType)}</span>,
  },
  {
    key: "cadence",
    header: "Cadence",
    mono: true,
    cell: (r) => cadence(r),
  },
  {
    key: "format",
    header: "Format",
    cell: (r) => (r.format ? r.format.toUpperCase() : "—"),
  },
  {
    key: "recipients",
    header: "Recipients",
    align: "right",
    mono: true,
    cell: (r) => r.recipients.length,
  },
  {
    key: "status",
    header: "Status",
    align: "right",
    cell: (r) =>
      r.isActive ? (
        <StatusPill label="Active" tone="good" />
      ) : (
        <StatusPill label="Paused" tone="neutral" />
      ),
  },
];

export function ReportsSchedule({ schedules }: { schedules: ReportScheduleRow[] }) {
  if (schedules.length === 0) {
    return (
      <p className="rounded-card border border-divider bg-card px-4 py-6 text-center text-sm text-ink-faint">
        No scheduled reports.
      </p>
    );
  }

  return (
    <DataTable
      columns={columns}
      rows={schedules}
      getRowKey={(r, i) => `${r.reportType}-${r.frequency}-${i}`}
    />
  );
}
