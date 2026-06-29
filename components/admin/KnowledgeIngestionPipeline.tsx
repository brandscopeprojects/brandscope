// KnowledgeIngestionPipeline — recent runs of the ingestion pipeline for the
// internal-admin Knowledge Base (Screen 27). One row per ingestion_logs step:
// document, pipeline step, status (StatusPill), chunks created (mono), error
// message, and time (mono). Presentational — data via SSR props. Tokens only.

import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { StatusPill } from "@/components/intelligence/StatusPill";
import { formatTraceTime } from "@/lib/data/internal-agents";
import type { KnowledgeIngestionRun } from "@/lib/data/internal-knowledge";

const columns: Column<KnowledgeIngestionRun>[] = [
  {
    key: "document",
    header: "Document",
    cell: (r) => (
      <div className="min-w-[12rem] space-y-1">
        <p className="font-medium text-ink">{r.documentTitle}</p>
        <p className="text-xs text-ink-secondary">{r.step}</p>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (r) => <StatusPill label={r.status.label} tone={r.status.tone} />,
  },
  {
    key: "chunks",
    header: "Chunks",
    align: "right",
    mono: true,
    cell: (r) => (r.chunksCreated == null ? "—" : r.chunksCreated.toLocaleString("en-GB")),
  },
  {
    key: "errors",
    header: "Errors",
    cell: (r) =>
      r.errorMessage ? (
        <span className="text-xs text-urgent">{r.errorMessage}</span>
      ) : (
        <span className="text-xs text-ink-faint">—</span>
      ),
  },
  {
    key: "time",
    header: "Time",
    mono: true,
    cell: (r) => formatTraceTime(r.at),
  },
];

export function KnowledgeIngestionPipeline({ runs }: { runs: KnowledgeIngestionRun[] }) {
  return (
    <DataTable
      columns={columns}
      rows={runs}
      getRowKey={(r) => r.id}
      emptyLabel="No ingestion runs recorded yet."
    />
  );
}
