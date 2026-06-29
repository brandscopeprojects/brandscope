// Competitor Profile — Screen 5 (`/competitors/[competitor_id]`). The deep,
// tabbed profile of one competitor the brand tracks: Overview · Promotions ·
// Digital · Intelligence (ui-constraints §11.4). Product/app-store data does not
// ship as a standalone /products page at MVP — it renders inside the Promotions
// tab here, sourced from product_intel_cache.
//
// Access: getCompetitorProfile FIRST verifies the competitor is one the current
// brand tracks; otherwise it returns null and we 404 (no cross-brand access).
// CLAUDE.md: no fabricated data — when a section's cache is absent it shows an
// honest empty state, never placeholder numbers. Cobalt stays OFF this
// competitor's own metrics (cobalt = the user's own brand only); it is used only
// for the back link.

import { notFound } from "next/navigation";
import { getCompetitorProfile } from "@/lib/data/competitor-profile";
import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { StatStrip, type Stat } from "@/components/intelligence/StatStrip";
import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { TierBadge } from "@/components/intelligence/TierBadge";
import { ThreatGauge } from "@/components/ui/ThreatGauge";
import {
  CompetitorProfileTabs,
  type CompetitorTabKey,
} from "@/components/intelligence/CompetitorProfileTabs";
import { CompetitorVerticalGrid } from "@/components/intelligence/CompetitorVerticalGrid";
import { CompetitorChangeList } from "@/components/intelligence/CompetitorChangeList";
import type { DigitalProfile } from "@/lib/data/competitor-profile";

export const dynamic = "force-dynamic";

// --- Small formatting helpers (page-local; no shared-file edits). ---

function num(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("en-GB");
}

function pct(value: number | null): string {
  if (value == null) return "—";
  return `${value}%`;
}

function score(value: number | null): string | number {
  return value == null ? "—" : value;
}

// One row per Digital metric for the DataTable.
type DigitalRow = { metric: string; value: string };

function digitalRows(d: DigitalProfile): DigitalRow[] {
  return [
    { metric: "Domain authority", value: num(d.domainAuthority) },
    { metric: "Estimated monthly traffic", value: num(d.estimatedMonthlyTraffic) },
    { metric: "Organic traffic share", value: pct(d.organicTrafficPct) },
    { metric: "Paid traffic share", value: pct(d.paidTrafficPct) },
    { metric: "Social followers", value: num(d.socialFollowersTotal) },
    { metric: "Active ads", value: num(d.activeAdsCount) },
    { metric: "Tech stack size", value: num(d.techStackCount) },
  ];
}

const DIGITAL_COLUMNS: Column<DigitalRow>[] = [
  { key: "metric", header: "Metric", cell: (r) => r.metric },
  { key: "value", header: "Value", cell: (r) => r.value, align: "right", mono: true },
];

export default async function CompetitorProfilePage({
  params,
}: {
  params: { competitor_id: string };
}) {
  const data = await getCompetitorProfile(params.competitor_id);
  if (!data) notFound();

  const { competitor, scanWeek, threat, overview, digital, product, changes } = data;

  const backLink = (
    <a
      href="/market-intel"
      className="inline-flex items-center text-sm font-medium text-cobalt hover:underline"
    >
      ← Competitors
    </a>
  );

  const header = (
    <PageHeader
      title={competitor.name}
      subtitle={competitor.domain}
      scanWeek={scanWeek}
      actions={<TierBadge tier={competitor.tier} />}
    />
  );

  // No profile row yet → header + honest pre-first-scan empty state.
  if (!overview) {
    return (
      <div className="space-y-6">
        {backLink}
        {header}
        <EmptyState
          intent="scanning"
          title="No profile data yet"
          message="This competitor will be profiled after the next weekly scan."
        />
      </div>
    );
  }

  // ---- Overview tab: ThreatGauge + headline scores. ----
  const overviewStats: Stat[] = [
    { label: "Reach score", value: score(overview.reachScore) },
    { label: "Aggression score", value: score(overview.aggressionScore) },
    { label: "Share of voice", value: overview.sovPct == null ? "—" : overview.sovPct, unit: overview.sovPct == null ? undefined : "%" },
    { label: "Threat score", value: score(overview.threatScore) },
  ];

  const overviewSection = (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
      <div className="rounded-card bg-card p-5 shadow-sh1">
        {threat ? (
          <ThreatGauge data={threat} />
        ) : (
          <p className="text-sm text-ink-faint">Threat score not available yet.</p>
        )}
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">Headline scores</h3>
        <StatStrip stats={overviewStats} />
      </div>
    </div>
  );

  // ---- Promotions tab: product_intel verticals (or empty state). ----
  const promotionsSection = product ? (
    <CompetitorVerticalGrid
      verticals={product.verticals}
      aviatorPromoActive={product.aviatorPromoActive}
      aviatorBonus={product.aviatorBonus}
      oddsCompetitivenessScore={product.oddsCompetitivenessScore}
      newProductsDetected={product.newProductsDetected}
    />
  ) : (
    <EmptyState
      intent="scanning"
      title="No product signals yet"
      message="Product verticals, Aviator promos and odds competitiveness appear once the next scan profiles this competitor's product range."
    />
  );

  // ---- Digital tab: domain authority / traffic / tech stack / ads. ----
  const digitalSection = digital ? (
    <DataTable
      columns={DIGITAL_COLUMNS}
      rows={digitalRows(digital)}
      getRowKey={(r) => r.metric}
    />
  ) : (
    <EmptyState
      intent="scanning"
      title="No digital footprint yet"
      message="Traffic, domain authority and tech-stack signals appear after the next weekly scan."
    />
  );

  // ---- Intelligence tab: recent change timeline. ----
  const intelligenceSection = <CompetitorChangeList changes={changes} />;

  const sections: Record<CompetitorTabKey, React.ReactNode> = {
    overview: overviewSection,
    promotions: promotionsSection,
    digital: digitalSection,
    intelligence: intelligenceSection,
  };

  return (
    <div className="space-y-6">
      {backLink}
      {header}
      <CompetitorProfileTabs sections={sections} />
    </div>
  );
}
