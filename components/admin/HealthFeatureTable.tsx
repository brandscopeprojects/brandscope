// HealthFeatureTable — per-feature health (Screen 24), built on the shared
// DataTable. Columns: feature, category, tier, status (StatusPill), last checked
// (mono), notes. healthy→good, degraded→warn, down/failed→bad,
// not_applicable_mvp→neutral "N/A" (mapping done in the data layer). Tokens only.

import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { StatusPill } from "@/components/intelligence/StatusPill";
import type { FeatureHealthVM } from "@/lib/data/internal-health";

const COLUMNS: Column<FeatureHealthVM>[] = [
  { key: "feature", header: "Feature", cell: (r) => <span className="font-medium">{r.feature}</span> },
  {
    key: "category",
    header: "Category",
    cell: (r) => <span className="text-ink-secondary">{r.category}</span>,
  },
  {
    key: "tier",
    header: "Tier",
    cell: (r) => <span className="text-ink-secondary">{r.tier}</span>,
  },
  {
    key: "status",
    header: "Status",
    cell: (r) => <StatusPill label={r.statusLabel} tone={r.tone} />,
  },
  { key: "lastChecked", header: "Last checked", cell: (r) => r.lastChecked, mono: true },
  {
    key: "notes",
    header: "Notes",
    cell: (r) => <span className="text-ink-secondary">{r.notes}</span>,
    // Root-cause / resolution prose — allow wrap so it reads, per DataTable §12.
    wrap: true,
  },
];

export function HealthFeatureTable({ features }: { features: FeatureHealthVM[] }) {
  return (
    <section aria-label="Feature health" className="space-y-3">
      <h2 className="font-display text-base font-bold text-ink">Feature health</h2>
      <DataTable
        columns={COLUMNS}
        rows={features}
        getRowKey={(r) => r.id}
        emptyLabel="No feature health logs yet."
      />
    </section>
  );
}
