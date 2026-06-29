// Public design preview of Regulatory Compliance (#9), populated with the
// RiversBet sample data. No auth/Supabase — renders the SAME Screen-12
// components against DEMO_REGULATORY. Explicitly demo/sample data.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { StatStrip, type Stat } from "@/components/intelligence/StatStrip";
import { RegulatoryComplianceMatrix } from "@/components/intelligence/RegulatoryComplianceMatrix";
import { RegulatoryViolationsFeed } from "@/components/intelligence/RegulatoryViolationsFeed";
import { RegulatorySourceDocuments } from "@/components/intelligence/RegulatorySourceDocuments";
import { DEMO_REGULATORY } from "@/lib/data/demo/regulatory";
import { marketLabel } from "@/lib/data/regulatory";

export const dynamic = "force-dynamic";

export default function PreviewRegulatory() {
  const { scanWeek, markets, rows, violations, documents, totals } = DEMO_REGULATORY;

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
    markets.length > 0 ? markets.map((m) => marketLabel(m)).join(" · ") : null;

  return (
    <div className="min-h-screen bg-base">
      <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-6">
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
      </div>
    </div>
  );
}
