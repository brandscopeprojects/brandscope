// KnowledgeStats — StatStrip for the internal-admin Knowledge Base (Screen 27).
// Headline counts of the regulatory knowledge corpus: total documents, total
// embedded chunks, active markets. Real counts only — no fabricated metrics.
// Presentational. Tokens via StatStrip.

import { StatStrip } from "@/components/intelligence/StatStrip";

export function KnowledgeStats({
  totalDocuments,
  totalChunks,
  activeMarkets,
}: {
  totalDocuments: number;
  totalChunks: number;
  activeMarkets: number;
}) {
  return (
    <StatStrip
      stats={[
        { label: "Documents", value: totalDocuments.toLocaleString("en-GB") },
        { label: "Embedded chunks", value: totalChunks.toLocaleString("en-GB") },
        { label: "Active markets", value: activeMarkets.toLocaleString("en-GB") },
      ]}
    />
  );
}
