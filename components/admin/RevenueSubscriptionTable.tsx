// RevenueSubscriptionTable — per-organisation subscription revenue (Screen 29,
// internal Revenue Dashboard). Uses the shared DataTable primitive: org/plan in
// Inter, MRR in mono naira, status as a StatusPill, started date in mono.
// Presentational. Tokens only.

import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { StatusPill } from "@/components/intelligence/StatusPill";
import type { SubscriptionRow } from "@/lib/data/internal-revenue";

const COLUMNS: Column<SubscriptionRow>[] = [
  {
    key: "org",
    header: "Organisation",
    cell: (r) => <span className="font-medium text-ink">{r.org}</span>,
  },
  {
    key: "plan",
    header: "Plan",
    cell: (r) => <span className="text-ink-secondary">{r.plan}</span>,
  },
  {
    key: "mrr",
    header: "MRR",
    align: "right",
    mono: true,
    cell: (r) => r.mrrLabel,
  },
  {
    key: "status",
    header: "Status",
    cell: (r) => <StatusPill label={r.statusLabel} tone={r.statusTone} />,
  },
  {
    key: "started",
    header: "Started",
    align: "right",
    mono: true,
    cell: (r) => r.startedLabel,
  },
];

export function RevenueSubscriptionTable({
  subscriptions,
}: {
  subscriptions: SubscriptionRow[];
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-ink">Subscriptions</h2>
        <p className="mt-0.5 text-xs text-ink-secondary">
          Active and lapsed subscriptions by organisation, ranked by MRR.
        </p>
      </div>
      <DataTable
        columns={COLUMNS}
        rows={subscriptions}
        getRowKey={(r) => r.id}
        emptyLabel="No subscriptions yet."
      />
    </section>
  );
}
