// ReportsTable — the generated-reports list for Screen 18 (/reports).
// Wraps the shared DataTable. Columns: Title, Type (neutral chip), Scan week
// (mono), Pages (mono), Created (mono), and a Download action.
//
// HONESTY NOTE (CLAUDE.md / brief): R2 download wiring is a later sprint, so we
// NEVER fabricate a working link. When a file exists (r2_path) we surface a
// muted "PDF" StatusPill labelled as not-yet-available; otherwise an em dash.
// Presentational. Tokens only.

import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { StatusPill } from "@/components/intelligence/StatusPill";
import { formatScanWeek } from "@/lib/format";
import type { ReportRow } from "@/lib/data/reports";

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

function formatCreated(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const columns: Column<ReportRow>[] = [
  {
    key: "title",
    header: "Title",
    cell: (r) => <span className="font-medium text-ink">{r.title}</span>,
  },
  {
    key: "type",
    header: "Type",
    cell: (r) => (
      <span className="inline-flex items-center rounded-chip bg-base-secondary px-2 py-0.5 text-xs font-medium text-ink-secondary">
        {typeLabel(r.reportType)}
      </span>
    ),
  },
  {
    key: "scanWeek",
    header: "Scan week",
    mono: true,
    cell: (r) => (r.scanWeek ? formatScanWeek(r.scanWeek) : "—"),
  },
  {
    key: "pages",
    header: "Pages",
    align: "right",
    mono: true,
    cell: (r) => (r.pageCount != null ? r.pageCount : "—"),
  },
  {
    key: "created",
    header: "Created",
    mono: true,
    cell: (r) => formatCreated(r.createdAt),
  },
  {
    key: "download",
    header: "Download",
    align: "right",
    cell: (r) =>
      r.r2Path ? (
        // A file exists in R2, but the download pipe ships a later sprint.
        // Show an honest "not yet downloadable" pill — never a fake URL.
        <StatusPill label="PDF · soon" tone="neutral" />
      ) : (
        <span className="text-ink-faint">—</span>
      ),
  },
];

export function ReportsTable({ reports }: { reports: ReportRow[] }) {
  return (
    <DataTable
      columns={columns}
      rows={reports}
      getRowKey={(r, i) => `${r.reportType}-${r.scanWeek ?? "na"}-${r.createdAt ?? i}`}
      emptyLabel="No reports generated yet."
    />
  );
}
