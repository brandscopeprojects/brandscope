// Traffic & SEO Intelligence — Screen 7 (`/traffic-seo`). Reads the per-competitor
// `seo_cache` (DataForSEO Labs, cron-populated) for the latest scan_week and lays
// out: headline stats, a competitor comparison table (domain authority, traffic
// mix), the top keyword gaps across competitors, and a traffic bar chart.
//
// Auth + brand gating + the shell live in app/(app)/layout.tsx. Before the first
// scan populates seo_cache, we render the honest "scanning" empty state — never
// fabricated numbers (CLAUDE.md: no fake data inside a v1 page).

import { getCurrentBrand } from "@/lib/data/brand";
import { getTrafficSeoData } from "@/lib/data/traffic-seo";
import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { StatStrip, type Stat } from "@/components/intelligence/StatStrip";
import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { TierBadge } from "@/components/intelligence/TierBadge";
import { SeoKeywordGapTable } from "@/components/intelligence/SeoKeywordGapTable";
import { SeoTrafficChart } from "@/components/intelligence/SeoTrafficChart";
import type { CompetitorSeo } from "@/lib/data/traffic-seo";

export const dynamic = "force-dynamic";

const SUBTITLE =
  "Domain authority, traffic mix and keyword gaps across your tracked competitors.";

// Cap the keyword-gap table; surface the count rather than silently truncating.
const KEYWORD_GAP_CAP = 25;

const COMPETITOR_COLUMNS: Column<CompetitorSeo>[] = [
  {
    key: "competitor",
    header: "Competitor",
    cell: (c) => (
      <span className="inline-flex items-center gap-2">
        <span className="font-medium text-ink">{c.name}</span>
        <TierBadge tier={c.tier} />
      </span>
    ),
  },
  {
    key: "domainAuthority",
    header: "Domain Authority",
    align: "right",
    mono: true,
    cell: (c) => (c.domainAuthority == null ? "—" : `${c.domainAuthority}`),
  },
  {
    key: "estimatedTraffic",
    header: "Est. Traffic",
    align: "right",
    mono: true,
    cell: (c) => (c.estimatedTraffic == null ? "—" : c.estimatedTraffic.toLocaleString()),
  },
  {
    key: "organicPct",
    header: "Organic %",
    align: "right",
    mono: true,
    cell: (c) => (c.organicPct == null ? "—" : `${c.organicPct}%`),
  },
  {
    key: "paidPct",
    header: "Paid %",
    align: "right",
    mono: true,
    cell: (c) => (c.paidPct == null ? "—" : `${c.paidPct}%`),
  },
];

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description && <p className="text-xs text-ink-secondary">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function TrafficSeoPage() {
  const brand = await getCurrentBrand();
  // Layout already redirects when there's no brand; this satisfies the type and
  // guards a direct render.
  if (!brand) return null;

  const data = await getTrafficSeoData(brand);

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Traffic & SEO Intelligence" subtitle={SUBTITLE} />
        <EmptyState
          title="No SEO data yet"
          message="Your first weekly scan will populate domain authority, traffic and keyword gaps from DataForSEO."
          intent="scanning"
        />
      </div>
    );
  }

  const { scanWeek, competitors, keywordGaps } = data;

  // Headline stats — real, derivable values only.
  const withTraffic = competitors.filter((c) => c.estimatedTraffic != null);
  const totalTraffic = withTraffic.reduce((sum, c) => sum + (c.estimatedTraffic ?? 0), 0);
  const stats: Stat[] = [
    { label: "Competitors tracked", value: competitors.length },
    { label: "Keyword gaps found", value: keywordGaps.length },
    {
      label: "Combined est. traffic",
      value: withTraffic.length > 0 ? totalTraffic.toLocaleString() : "—",
    },
  ];

  const shownGaps = keywordGaps.slice(0, KEYWORD_GAP_CAP);
  const truncated = keywordGaps.length - shownGaps.length;

  return (
    <div className="space-y-6">
      <PageHeader title="Traffic & SEO Intelligence" subtitle={SUBTITLE} scanWeek={scanWeek} />

      <StatStrip stats={stats} />

      {withTraffic.length === 0 && competitors.length > 0 && (
        // Honest coverage note (ui-constraints §14): rows exist but every metric is
        // null — DataForSEO Labs has no ranked-keyword/traffic data for these
        // domains yet (common for smaller country-specific betting sites). Dashes
        // without an explanation read as "broken".
        <div className="rounded-chip border border-watch/30 bg-watch/10 px-4 py-3 text-xs leading-relaxed text-ink-secondary">
          DataForSEO has no ranked-keyword or traffic estimates for these competitor
          domains yet — coverage for smaller country-specific domains typically
          appears once they rank for enough tracked keywords. The scan checked every
          competitor this week; the dashes are honest &ldquo;no data&rdquo;, not errors.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Competitor comparison"
          description="Domain authority and organic-vs-paid traffic mix this week."
        >
          <DataTable
            columns={COMPETITOR_COLUMNS}
            rows={competitors}
            getRowKey={(c) => c.competitorId}
            emptyLabel="No competitor SEO snapshots in this week's scan."
          />
        </SectionCard>

        <SectionCard
          title="Estimated monthly traffic"
          description="Ranked by estimated organic + paid visits."
        >
          <div className="rounded-card bg-card p-4 shadow-sh1">
            <SeoTrafficChart competitors={competitors} />
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Top keyword gaps"
        description="High-volume keywords your competitors rank for, across all tracked competitors."
      >
        <SeoKeywordGapTable rows={shownGaps} />
        {truncated > 0 && (
          <p className="text-xs text-ink-faint">
            Showing the top {KEYWORD_GAP_CAP} of {keywordGaps.length} keyword gaps by search
            volume.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
