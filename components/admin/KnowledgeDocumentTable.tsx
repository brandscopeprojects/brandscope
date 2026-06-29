// KnowledgeDocumentTable — the regulator-document register for the internal-admin
// Knowledge Base (Screen 27). One row per regulatory_documents filing: title +
// regulatory body, neutral type/market chips, version (mono), live chunk count
// (mono), embedding status (StatusPill), last verified (mono), source link
// (cobalt mono). Presentational — data arrives via SSR props. Tokens only.

import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { StatusPill } from "@/components/intelligence/StatusPill";
import { marketLabel } from "@/lib/format";
import { formatTraceTime } from "@/lib/data/internal-agents";
import type { KnowledgeDocument } from "@/lib/data/internal-knowledge";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-chip bg-base-secondary px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
      {children}
    </span>
  );
}

const columns: Column<KnowledgeDocument>[] = [
  {
    key: "document",
    header: "Document",
    cell: (d) => (
      <div className="min-w-[14rem] space-y-1">
        <p className="font-medium text-ink">{d.title}</p>
        <p className="text-xs text-ink-secondary">{d.regulatoryBody}</p>
      </div>
    ),
  },
  {
    key: "classification",
    header: "Type / Market",
    cell: (d) => (
      <div className="flex flex-wrap gap-1.5">
        <Chip>{d.documentType}</Chip>
        <Chip>{marketLabel(d.country)}</Chip>
      </div>
    ),
  },
  {
    key: "version",
    header: "Version",
    mono: true,
    cell: (d) => d.version ?? "—",
  },
  {
    key: "chunks",
    header: "Chunks",
    align: "right",
    mono: true,
    cell: (d) => d.chunkCount.toLocaleString("en-GB"),
  },
  {
    key: "embedding",
    header: "Embedding",
    cell: (d) => <StatusPill label={d.embeddingStatus.label} tone={d.embeddingStatus.tone} />,
  },
  {
    key: "verified",
    header: "Last verified",
    mono: true,
    cell: (d) => formatTraceTime(d.lastVerifiedAt),
  },
  {
    key: "source",
    header: "Source",
    cell: (d) => (
      <a
        href={d.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-[13px] text-cobalt hover:underline"
      >
        View source
      </a>
    ),
  },
];

export function KnowledgeDocumentTable({ documents }: { documents: KnowledgeDocument[] }) {
  return (
    <DataTable
      columns={columns}
      rows={documents}
      getRowKey={(d) => d.id}
      emptyLabel="No regulatory documents."
    />
  );
}
