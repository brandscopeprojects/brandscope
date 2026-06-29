// RevenueChurn — recent churn events (Screen 29, internal Revenue Dashboard).
// Uses the shared DataTable: churned organisation + reason in Inter, value lost
// in mono naira, date in mono, and an urgent/watch tone pill — never green,
// since churn is never a positive signal (ui-constraints §2.3 / §15).
// Presentational. Tokens only.

import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { StatusPill } from "@/components/intelligence/StatusPill";
import type { ChurnRow } from "@/lib/data/internal-revenue";

const COLUMNS: Column<ChurnRow>[] = [
  {
    key: "org",
    header: "Organisation",
    cell: (r) => <span className="font-medium text-ink">{r.org}</span>,
  },
  {
    key: "reason",
    header: "Reason",
    cell: (r) => <span className="text-ink-secondary">{r.reason}</span>,
  },
  {
    key: "valueLost",
    header: "Value lost",
    align: "right",
    mono: true,
    cell: (r) => r.valueLostLabel,
  },
  {
    key: "tone",
    header: "Impact",
    cell: (r) => (
      <StatusPill
        label={r.tone === "bad" ? "Revenue lost" : "Churn"}
        tone={r.tone}
      />
    ),
  },
  {
    key: "date",
    header: "Date",
    align: "right",
    mono: true,
    cell: (r) => r.dateLabel,
  },
];

export function RevenueChurn({ churn }: { churn: ChurnRow[] }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-ink">Churn</h2>
        <p className="mt-0.5 text-xs text-ink-secondary">
          Recent downgrades and cancellations, with revenue lost.
        </p>
      </div>
      <DataTable
        columns={COLUMNS}
        rows={churn}
        getRowKey={(r) => r.id}
        emptyLabel="No churn recorded."
      />
    </section>
  );
}
