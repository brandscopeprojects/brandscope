"use client";

// AdminAlertsHistory — the recent alert_history table for the brand-admin Alerts
// screen (Screen 22). DataTable of fired alerts: trigger label, summary message,
// fired-at (mono timestamp), severity/status StatusPill. Empty → muted line.
// Presentational; data comes from SSR props. Tokens only.

import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { StatusPill, type StatusTone } from "@/components/intelligence/StatusPill";
import type { AlertHistoryView } from "@/lib/data/admin-alerts";

// Map the raw alert_history.status to a status pill tone + label. The between-cycle
// alert agent (Sprint 3) owns these strings; we map the known ones and fall back to
// a neutral pill so an unknown status still renders honestly.
function statusPill(status: string | null): { label: string; tone: StatusTone } {
  switch ((status ?? "").toLowerCase()) {
    case "resolved":
      return { label: "Resolved", tone: "good" };
    case "fired":
    case "open":
    case "active":
      return { label: "Fired", tone: "bad" };
    case "acknowledged":
    case "seen":
      return { label: "Seen", tone: "warn" };
    default:
      return { label: status ?? "—", tone: "neutral" };
  }
}

function formatFiredAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  // Compact, unambiguous timestamp (mono column).
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export function AdminAlertsHistory({ rows }: { rows: AlertHistoryView[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-divider bg-card px-4 py-8 text-center text-sm text-ink-faint">
        No alerts fired yet.
      </div>
    );
  }

  const columns: Column<AlertHistoryView>[] = [
    {
      key: "trigger",
      header: "Trigger",
      cell: (r) => <span className="font-medium text-ink">{r.alertLabel}</span>,
    },
    {
      key: "summary",
      header: "Summary",
      cell: (r) => <span className="text-ink-secondary">{r.message}</span>,
    },
    {
      key: "firedAt",
      header: "Fired",
      mono: true,
      cell: (r) => formatFiredAt(r.firedAt),
    },
    {
      key: "status",
      header: "Status",
      align: "right",
      cell: (r) => {
        const p = statusPill(r.status);
        return <StatusPill label={p.label} tone={p.tone} />;
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id}
      emptyLabel="No alerts fired yet."
    />
  );
}
