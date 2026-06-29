// ApiMgmtRouterTable — model_router_config as a DataTable: task / use-case →
// primary model (mono) → fallback model (mono) → limits → enabled (StatusPill).
// Internal admin data-dense surface (ui-constraints §11.3). Presentational. Tokens only.

import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { StatusPill } from "@/components/intelligence/StatusPill";
import type { RouterRuleView } from "@/lib/data/internal-api";

const COLUMNS: Column<RouterRuleView>[] = [
  {
    key: "task",
    header: "Task / use-case",
    cell: (r) => <span className="font-medium text-ink">{r.taskType}</span>,
  },
  {
    key: "primary",
    header: "Primary model",
    mono: true,
    cell: (r) => r.primaryModel,
  },
  {
    key: "fallback",
    header: "Fallback model",
    mono: true,
    cell: (r) =>
      r.fallbackModel ? (
        r.fallbackModel
      ) : (
        <span className="text-ink-faint">none</span>
      ),
  },
  {
    key: "rpm",
    header: "Req/min",
    align: "right",
    mono: true,
    cell: (r) => (r.requestsPerMin != null ? r.requestsPerMin : "—"),
  },
  {
    key: "maxTokens",
    header: "Max tokens",
    align: "right",
    mono: true,
    cell: (r) =>
      r.maxTokens != null ? r.maxTokens.toLocaleString("en-GB") : "—",
  },
  {
    key: "enabled",
    header: "Enabled",
    align: "center",
    cell: (r) =>
      r.isActive ? (
        <StatusPill label="Active" tone="good" />
      ) : (
        <StatusPill label="Disabled" tone="neutral" />
      ),
  },
];

export function ApiMgmtRouterTable({ rules }: { rules: RouterRuleView[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-ink">Model routing</h2>
      <DataTable
        columns={COLUMNS}
        rows={rules}
        getRowKey={(r) => r.id}
        emptyLabel="No routing rules configured."
      />
    </section>
  );
}
