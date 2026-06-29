// Public design preview of the Competitor Profile (Screen 5), populated with the
// SportyBet sample dataset (no auth, no Supabase, no ownership gate) so the real
// profile components are visible against the design brief. NOT linked from the
// app; for review/demo only. SportyBet is a COMPETITOR — cobalt stays off its
// metrics (cobalt = the back link / source links only). This mirrors the real
// /competitors/[competitor_id] page's composition with the gate removed.

import { PageHeader } from "@/components/intelligence/PageHeader";
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
import { DEMO_COMPETITOR_PROFILE } from "@/lib/data/demo/competitor-profile";

export const dynamic = "force-dynamic";

// --- Formatting helpers (mirrors the real page; local to this preview). ---

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

export default function PreviewCompetitorProfile() {
  const { competitor, scanWeek, threat, overview, digital, product, changes } =
    DEMO_COMPETITOR_PROFILE;

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

  // ---- Overview tab: ThreatGauge + headline scores. ----
  const overviewStats: Stat[] = [
    { label: "Reach score", value: score(overview?.reachScore ?? null) },
    { label: "Aggression score", value: score(overview?.aggressionScore ?? null) },
    {
      label: "Share of voice",
      value: overview?.sovPct == null ? "—" : overview.sovPct,
      unit: overview?.sovPct == null ? undefined : "%",
    },
    { label: "Threat score", value: score(overview?.threatScore ?? null) },
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

  // ---- Promotions tab: product_intel verticals. ----
  const promotionsSection = product ? (
    <CompetitorVerticalGrid
      verticals={product.verticals}
      aviatorPromoActive={product.aviatorPromoActive}
      aviatorBonus={product.aviatorBonus}
      oddsCompetitivenessScore={product.oddsCompetitivenessScore}
      newProductsDetected={product.newProductsDetected}
    />
  ) : null;

  // ---- Digital tab: domain authority / traffic / tech stack / ads. ----
  const digitalSection = digital ? (
    <DataTable
      columns={DIGITAL_COLUMNS}
      rows={digitalRows(digital)}
      getRowKey={(r) => r.metric}
    />
  ) : null;

  // ---- Intelligence tab: recent change timeline. ----
  const intelligenceSection = <CompetitorChangeList changes={changes} />;

  const sections: Record<CompetitorTabKey, React.ReactNode> = {
    overview: overviewSection,
    promotions: promotionsSection,
    digital: digitalSection,
    intelligence: intelligenceSection,
  };

  return (
    <div className="min-h-screen bg-base">
      <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
        <div className="space-y-6">
          {backLink}
          {header}
          <CompetitorProfileTabs sections={sections} />
        </div>
      </div>
    </div>
  );
}
