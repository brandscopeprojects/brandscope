// HealthApiTable — recent external-API health per provider (Screen 24), built on
// the shared DataTable. Columns: provider, status (StatusPill), latency (mono),
// error rate (mono), last checked (mono). Tokens only.

import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { StatusPill } from "@/components/intelligence/StatusPill";
import type { ApiHealthVM } from "@/lib/data/internal-health";

const COLUMNS: Column<ApiHealthVM>[] = [
  { key: "provider", header: "Provider", cell: (r) => <span className="font-medium">{r.provider}</span> },
  {
    key: "status",
    header: "Status",
    cell: (r) => <StatusPill label={r.statusLabel} tone={r.tone} />,
  },
  { key: "latency", header: "Latency", cell: (r) => r.latency, mono: true, align: "right" },
  { key: "errorRate", header: "Error rate (24h)", cell: (r) => r.errorRate, mono: true, align: "right" },
  { key: "lastChecked", header: "Last checked", cell: (r) => r.lastChecked, mono: true },
];

export function HealthApiTable({ apis }: { apis: ApiHealthVM[] }) {
  return (
    <section aria-label="External APIs" className="space-y-3">
      <h2 className="font-display text-base font-bold text-ink">External APIs</h2>
      <DataTable
        columns={COLUMNS}
        rows={apis}
        getRowKey={(r) => r.id}
        emptyLabel="No API health logs yet."
      />
    </section>
  );
}
