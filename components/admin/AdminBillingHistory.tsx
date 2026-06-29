// AdminBillingHistory — payment history table for the brand-admin Billing page
// (Screen 23). Reuses the shared DataTable primitive: date (mono), description,
// amount in naira (mono, right-aligned), and a status pill. Read-only at MVP.
// Empty → muted note inside the table. Presentational. Tokens only.

import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { StatusPill } from "@/components/intelligence/StatusPill";
import type { PaymentRowView } from "@/lib/data/admin-billing";

const COLUMNS: Column<PaymentRowView>[] = [
  {
    key: "date",
    header: "Date",
    mono: true,
    cell: (r) => r.dateLabel ?? "—",
  },
  {
    key: "description",
    header: "Description",
    cell: (r) => r.description,
  },
  {
    key: "amount",
    header: "Amount",
    align: "right",
    mono: true,
    cell: (r) => r.amountLabel ?? "—",
  },
  {
    key: "status",
    header: "Status",
    align: "right",
    cell: (r) => <StatusPill label={r.status.label} tone={r.status.tone} />,
  },
];

export function AdminBillingHistory({
  payments,
}: {
  payments: PaymentRowView[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-bold text-ink">Payment history</h2>
      <DataTable
        columns={COLUMNS}
        rows={payments}
        getRowKey={(r) => r.id}
        emptyLabel="No payments recorded yet."
      />
    </section>
  );
}
