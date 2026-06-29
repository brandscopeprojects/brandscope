// SeoKeywordGapTable — keyword-gap table for Traffic & SEO (Screen 7). Lists the
// highest-volume keywords a competitor ranks for, the brand's own rank (or
// "Not ranking"), the best competitor rank, and difficulty. Built on the shared
// DataTable primitive; mono numerals for the evidence-style values. The page
// caps the row count and flags truncation — no silent dropping. Presentational.

import { DataTable, type Column } from "@/components/intelligence/DataTable";
import type { RankedKeywordGap } from "@/lib/data/traffic-seo";

function rank(value: number | null): string {
  return value == null ? "—" : `#${value}`;
}

const COLUMNS: Column<RankedKeywordGap>[] = [
  {
    key: "keyword",
    header: "Keyword",
    cell: (r) => <span className="font-medium text-ink">{r.keyword}</span>,
  },
  {
    key: "volume",
    header: "Volume",
    align: "right",
    mono: true,
    cell: (r) => (r.volume == null ? "—" : r.volume.toLocaleString()),
  },
  {
    key: "brandRank",
    header: "Your rank",
    align: "right",
    mono: true,
    cell: (r) =>
      r.brandRank == null ? (
        <span className="font-sans text-xs text-ink-faint">Not ranking</span>
      ) : (
        rank(r.brandRank)
      ),
  },
  {
    key: "competitorRank",
    header: "Best competitor",
    align: "right",
    cell: (r) => (
      <span className="inline-flex items-baseline gap-1.5">
        <span className="font-mono text-[13px] text-ink">{rank(r.competitorRank)}</span>
        <span className="text-xs text-ink-faint">{r.competitorName}</span>
      </span>
    ),
  },
  {
    key: "difficulty",
    header: "Difficulty",
    align: "right",
    mono: true,
    cell: (r) => (r.difficulty == null ? "—" : `${r.difficulty}/100`),
  },
];

export function SeoKeywordGapTable({ rows }: { rows: RankedKeywordGap[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      getRowKey={(r) => `${r.competitorId}:${r.keyword}`}
      emptyLabel="No keyword gaps detected in this week's scan."
    />
  );
}
