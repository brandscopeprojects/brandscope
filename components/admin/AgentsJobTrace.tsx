// AgentsJobTrace — recent LLM-call traces from agent_job_logs (Screen 25, internal
// admin §11.3). DataTable: agent · model (mono) · tokens (mono) · cost (mono, USD)
// · latency (mono) · status (StatusPill) · time (mono). Capped at JOB_TRACE_LIMIT
// with a truncation note when more rows exist. Presentational. Tokens only.

import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { StatusPill } from "@/components/intelligence/StatusPill";
import {
  formatCostUsd,
  formatLatencyMs,
  formatTokens,
  formatTraceTime,
  JOB_TRACE_LIMIT,
  type JobTraceView,
} from "@/lib/data/internal-agents";

export function AgentsJobTrace({
  jobTrace,
  truncated,
}: {
  jobTrace: JobTraceView[];
  truncated: boolean;
}) {
  const columns: Column<JobTraceView>[] = [
    { key: "agent", header: "Agent", cell: (r) => r.agentName },
    {
      key: "model",
      header: "Model",
      mono: true,
      cell: (r) => r.model ?? "—",
    },
    {
      key: "tokens",
      header: "Tokens",
      mono: true,
      align: "right",
      cell: (r) => formatTokens(r.totalTokens),
    },
    {
      key: "cost",
      header: "Cost",
      mono: true,
      align: "right",
      cell: (r) => formatCostUsd(r.costUsd),
    },
    {
      key: "latency",
      header: "Latency",
      mono: true,
      align: "right",
      cell: (r) => formatLatencyMs(r.durationMs),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <StatusPill label={statusLabel(r.status)} tone={r.statusTone} />,
    },
    {
      key: "time",
      header: "Time",
      mono: true,
      align: "right",
      cell: (r) => formatTraceTime(r.createdAt),
    },
  ];

  return (
    <section aria-label="Job traces" className="space-y-3">
      <h2 className="font-display text-lg font-bold text-ink">Recent job traces</h2>
      <DataTable
        columns={columns}
        rows={jobTrace}
        getRowKey={(r) => r.id}
        emptyLabel="No job traces yet — agents log here once the pipeline runs."
      />
      {truncated && (
        <p className="font-mono text-[11px] text-ink-faint">
          Showing the {JOB_TRACE_LIMIT} most recent calls. Older traces are
          retained in agent_job_logs.
        </p>
      )}
    </section>
  );
}

function statusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
