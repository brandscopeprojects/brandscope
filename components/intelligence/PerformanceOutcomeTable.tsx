// PerformanceOutcomeTable — logged action outcomes (Screen 17, verbal register).
// Wraps the shared DataTable: what you did, the metric you measured, the value
// (mono), the result as a StatusPill (positive→good, neutral→neutral,
// negative→bad — green is reserved for genuinely positive states, §15), and the
// date (mono). Presentational; data from SSR props.

import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { StatusPill, type StatusTone } from "@/components/intelligence/StatusPill";
import type { ActionOutcome } from "@/lib/data/performance";

const RESULT: Record<
  NonNullable<ActionOutcome["result"]>,
  { label: string; tone: StatusTone }
> = {
  positive: { label: "Positive", tone: "good" },
  neutral: { label: "Neutral", tone: "neutral" },
  negative: { label: "Negative", tone: "bad" },
};

function formatDate(iso: string | null): string {
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

function formatValue(o: ActionOutcome): string {
  if (o.outcomeValue == null) return "—";
  const v = o.outcomeValue.toLocaleString();
  return o.outcomeUnit ? `${v} ${o.outcomeUnit}` : v;
}

const COLUMNS: Column<ActionOutcome>[] = [
  {
    key: "action",
    header: "Action taken",
    cell: (o) => (
      <div className="space-y-0.5">
        <span className="font-medium text-ink">{o.actionTaken}</span>
        {o.notes && <p className="text-xs text-ink-secondary">{o.notes}</p>}
      </div>
    ),
  },
  {
    key: "metric",
    header: "Metric",
    cell: (o) => o.outcomeMetric ?? "—",
  },
  {
    key: "value",
    header: "Value",
    align: "right",
    mono: true,
    cell: formatValue,
  },
  {
    key: "result",
    header: "Result",
    align: "center",
    cell: (o) =>
      o.result ? (
        <StatusPill label={RESULT[o.result].label} tone={RESULT[o.result].tone} />
      ) : (
        <span className="text-ink-faint">—</span>
      ),
  },
  {
    key: "date",
    header: "Date",
    align: "right",
    mono: true,
    cell: (o) => formatDate(o.actionTakenAt),
  },
];

export function PerformanceOutcomeTable({ outcomes }: { outcomes: ActionOutcome[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={outcomes}
      getRowKey={(o) => o.id}
      emptyLabel="No outcomes logged yet — log results on your action plan to track them here."
    />
  );
}
