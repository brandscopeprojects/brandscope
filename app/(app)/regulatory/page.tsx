// Regulatory Compliance — Screen 12 (/regulatory). The compliance decision
// surface: where do we (and our competitors) stand against NG/KE/ZA gambling
// regulators, and exactly what's out of line — with verbatim evidence.
//
// Auth + brand are gated by the (app) layout. Data is read from regulatory_cache
// (Claude Sonnet RAG, cron-populated) + regulatory_documents (regulator source
// filings). No cache yet → an honest empty state, never fabricated scores
// (CLAUDE.md: no fake data inside a v1 page).

import { getRegulatoryData, marketLabel } from "@/lib/data/regulatory";
import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { StatStrip, type Stat } from "@/components/intelligence/StatStrip";
import { RegulatoryComplianceMatrix } from "@/components/intelligence/RegulatoryComplianceMatrix";
import { RegulatoryViolationsFeed } from "@/components/intelligence/RegulatoryViolationsFeed";
import { RegulatorySourceDocuments } from "@/components/intelligence/RegulatorySourceDocuments";

export const dynamic = "force-dynamic";

export default async function RegulatoryPage() {
  const data = await getRegulatoryData();

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Regulatory Compliance"
          subtitle="Compliance posture across age verification, licensing, responsible gambling and more — with verbatim evidence."
        />
        <EmptyState
          title="No compliance data yet"
          message="Your first scan will score competitor compliance across six regulatory dimensions per market."
          intent="scanning"
        />
      </div>
    );
  }

  const { scanWeek, markets, rows, violations, documents, totals } = data;

  const stats: Stat[] = [
    { label: "Competitors scored", value: totals.competitorsScored },
    {
      label: "Avg competitor score",
      value: totals.avgCompetitorScore ?? "—",
      unit: totals.avgCompetitorScore != null ? "/100" : undefined,
    },
    { label: "Open violations", value: totals.openViolations },
    { label: "Markets", value: markets.length },
  ];

  const marketSummary =
    markets.length > 0
      ? markets.map((m) => marketLabel(m)).join(" · ")
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Regulatory Compliance"
        subtitle="Compliance posture across age verification, licensing, responsible gambling and more — with verbatim evidence."
        scanWeek={scanWeek}
      />

      <StatStrip stats={stats} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-ink">Compliance matrix</h2>
          {marketSummary && (
            <span className="font-mono text-xs text-ink-faint">{marketSummary}</span>
          )}
        </div>
        <RegulatoryComplianceMatrix rows={rows} />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-ink">Violations &amp; evidence</h2>
        <RegulatoryViolationsFeed groups={violations} />
      </section>

      <RegulatorySourceDocuments documents={documents} />
    </div>
  );
}
