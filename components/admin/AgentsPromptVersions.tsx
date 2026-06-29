// AgentsPromptVersions — the active prompt version per agent (Screen 25, internal
// admin §11.3). DataTable: agent · current version (mono) · status · updated
// (mono). One row per agent, sourced from prompt_versions (latest deployed).
// Presentational. Tokens only.

import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { StatusPill, type StatusTone } from "@/components/intelligence/StatusPill";
import {
  formatTraceTime,
  type PromptVersionView,
} from "@/lib/data/internal-agents";

const STATUS_TONE: Record<string, StatusTone> = {
  active: "good",
  deployed: "good",
  draft: "neutral",
  archived: "neutral",
  rolled_back: "warn",
};

export function AgentsPromptVersions({
  promptVersions,
}: {
  promptVersions: PromptVersionView[];
}) {
  const columns: Column<PromptVersionView>[] = [
    {
      key: "agent",
      header: "Agent",
      cell: (r) => r.agentName,
    },
    {
      key: "version",
      header: "Current version",
      mono: true,
      cell: (r) => r.version,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) =>
        r.status ? (
          <StatusPill label={statusLabel(r.status)} tone={toneFor(r.status)} />
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: "updated",
      header: "Updated",
      mono: true,
      align: "right",
      cell: (r) => formatTraceTime(r.updatedAt),
    },
  ];

  return (
    <section aria-label="Prompt versions" className="space-y-3">
      <h2 className="font-display text-lg font-bold text-ink">Prompt versions</h2>
      <DataTable
        columns={columns}
        rows={promptVersions}
        getRowKey={(r) => r.id}
        emptyLabel="No prompt versions recorded yet."
      />
    </section>
  );
}

function toneFor(status: string): StatusTone {
  return STATUS_TONE[status.toLowerCase()] ?? "neutral";
}

function statusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
