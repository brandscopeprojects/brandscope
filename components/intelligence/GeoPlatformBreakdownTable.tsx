// GeoPlatformBreakdownTable — per-platform AI visibility breakdown (Screen 14,
// component-library "PlatformBreakdownTable"). 4 MVP answer engines only
// (ChatGPT/Claude/Gemini/Perplexity; Grok/Meta = Phase 2, hidden). Columns:
// Platform · Mentioned · Sentiment · Position · Last Checked. Built on the shared
// DataTable + StatusPill primitives. Presentational. Tokens only.

import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { StatusPill, type StatusTone } from "@/components/intelligence/StatusPill";
import type { GeoPlatform } from "@/lib/data/geo";

function sentimentTone(sentiment: string | null): StatusTone {
  switch (sentiment?.toLowerCase()) {
    case "positive":
      return "good";
    case "negative":
      return "bad";
    case "neutral":
      return "neutral";
    default:
      return "neutral";
  }
}

function formatCheckedAt(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const columns: Column<GeoPlatform>[] = [
  {
    key: "name",
    header: "Platform",
    cell: (p) => <span className="font-medium text-ink">{p.name}</span>,
  },
  {
    key: "mentioned",
    header: "Mentioned",
    cell: (p) =>
      p.mentioned ? (
        <StatusPill label="Yes" tone="good" />
      ) : (
        <StatusPill label="No" tone="neutral" />
      ),
  },
  {
    key: "sentiment",
    header: "Sentiment",
    cell: (p) =>
      p.sentiment ? (
        <StatusPill
          label={p.sentiment.charAt(0).toUpperCase() + p.sentiment.slice(1)}
          tone={sentimentTone(p.sentiment)}
        />
      ) : (
        <span className="text-ink-faint">—</span>
      ),
  },
  {
    key: "position",
    header: "Position",
    align: "right",
    mono: true,
    cell: (p) => (p.position != null ? `#${p.position}` : "—"),
  },
  {
    key: "checkedAt",
    header: "Last Checked",
    align: "right",
    mono: true,
    cell: (p) => formatCheckedAt(p.checkedAt),
  },
];

export function GeoPlatformBreakdownTable({ rows }: { rows: GeoPlatform[] }) {
  return <DataTable columns={columns} rows={rows} getRowKey={(p) => p.name} />;
}
