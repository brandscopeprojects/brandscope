// HealthCronTable — recent cron-job runs (Screen 24), built on the shared
// DataTable. Columns: job, schedule (mono), status (StatusPill), last run (mono),
// duration (mono), notes (error message when failed). Tokens only.

import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { StatusPill } from "@/components/intelligence/StatusPill";
import type { CronJobVM } from "@/lib/data/internal-health";

const COLUMNS: Column<CronJobVM>[] = [
  { key: "jobName", header: "Cron job", cell: (r) => <span className="font-medium">{r.jobName}</span> },
  { key: "schedule", header: "Schedule", cell: (r) => r.schedule, mono: true },
  {
    key: "status",
    header: "Status",
    cell: (r) => <StatusPill label={r.statusLabel} tone={r.tone} />,
  },
  { key: "lastRun", header: "Last run", cell: (r) => r.lastRun, mono: true },
  { key: "duration", header: "Duration", cell: (r) => r.duration, mono: true, align: "right" },
  {
    key: "notes",
    header: "Notes",
    cell: (r) => <span className="text-ink-secondary">{r.notes}</span>,
  },
];

export function HealthCronTable({ cronJobs }: { cronJobs: CronJobVM[] }) {
  return (
    <section aria-label="Cron jobs" className="space-y-3">
      <h2 className="font-display text-base font-bold text-ink">Cron jobs</h2>
      <DataTable
        columns={COLUMNS}
        rows={cronJobs}
        getRowKey={(r) => r.id}
        emptyLabel="No cron runs recorded yet."
      />
    </section>
  );
}
