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
import { KeywordLandscape } from "@/components/intelligence/KeywordLandscape";
import { SeoTrafficChart } from "@/components/intelligence/SeoTrafficChart";
import type { CompetitorSeo } from "@/lib/data/traffic-seo";

export const dynamic = "force-dynamic";

const SUBTITLE =
  "The most-searched betting terms in this market, and where you rank vs your competitors — from live Google results.";

const COMPETITOR_COLUMNS: Column<CompetitorSeo>[] = [
  {
    key: "competitor",
    header: "Competitor",
    cell: (c) => (
      <span className="inline-flex items-center gap-2">
        <span className="font-medium text-ink">{c.name}</span>
        {c.isOwnBrand ? (
          <span className="rounded-chip bg-cobalt/10 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wide text-cobalt">
            You
          </span>
        ) : (
          <TierBadge tier={c.tier} />
        )}
      </span>
    ),
  },
  {
    key: "domainAuthority",
    header: "Search Visibility",
    hint: "0–100, relative to the strongest rival. 100 = most visible on Google here; 0 = didn't appear in any tracked search.",
    align: "right",
    mono: true,
    cell: (c) => (c.domainAuthority == null ? "—" : `${c.domainAuthority}/100`),
  },
  {
    key: "organicPct",
    header: "Organic",
    hint: "Share of that visibility coming from free/earned Google listings (not ads).",
    align: "right",
    mono: true,
    cell: (c) => (c.organicPct == null ? "—" : `${c.organicPct}%`),
  },
  {
    key: "paidPct",
    header: "Paid",
    hint: "Share of that visibility coming from paid Google Ads. 0% = they're not buying ads here.",
    align: "right",
    mono: true,
    cell: (c) => (c.paidPct == null ? "—" : `${c.paidPct}%`),
  },
];

/** Always-visible "how to read this" legend (works on mobile, unlike header
 *  hover-hints). Compact definition list in the muted secondary zone. */
function Legend({ items }: { items: { term: string; def: string }[] }) {
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1.5 rounded-chip border border-divider bg-base-secondary/60 px-4 py-3 text-xs leading-relaxed text-ink-secondary">
      {items.map((it) => (
        <div key={it.term} className="flex gap-1.5">
          <dt className="shrink-0 font-medium text-ink">{it.term}</dt>
          <dd>{it.def}</dd>
        </div>
      ))}
    </dl>
  );
}

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

  const { scanWeek, competitors, keywordGaps, landscape } = data;
  // Rivals only (exclude the synthetic "you" row) for field-level stats.
  const rivals = competitors.filter((c) => !c.isOwnBrand);

  // Headline stats — real, derivable values only.
  const withVisibility = rivals.filter((c) => c.domainAuthority != null);
  const avgVisibility =
    withVisibility.length > 0
      ? Math.round(
          withVisibility.reduce((sum, c) => sum + (c.domainAuthority ?? 0), 0) /
            withVisibility.length,
        )
      : null;
  const stats: Stat[] = [
    { label: "Competitors tracked", value: rivals.length },
    { label: "Keyword gaps found", value: keywordGaps.length },
    {
      label: "Avg. rival visibility",
      value: avgVisibility == null ? "—" : `${avgVisibility}/100`,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Traffic & SEO Intelligence" subtitle={SUBTITLE} scanWeek={scanWeek} />

      <StatStrip stats={stats} />

      {withVisibility.length === 0 && rivals.length > 0 && (
        // Honest coverage note (ui-constraints §14): the live-SERP sweep returned no
        // results for any tracked competitor this week. Rare — a brand-new market or
        // a transient SERP miss. Dashes without an explanation read as "broken".
        <div className="rounded-chip border border-watch/30 bg-watch/10 px-4 py-3 text-xs leading-relaxed text-ink-secondary">
          No live Google results came back for these competitors on this market&rsquo;s
          keyword set this week — this can happen for a brand-new market or a transient
          SERP miss. The scan swept every keyword; the dashes are honest &ldquo;no
          data&rdquo;, not errors.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Competitor comparison"
          description="Search visibility and organic-vs-paid presence across the tracked keyword set."
        >
          <DataTable
            columns={COMPETITOR_COLUMNS}
            rows={competitors}
            getRowKey={(c) => c.competitorId}
            isHighlighted={(c) => !!c.isOwnBrand}
            emptyLabel="No competitor SEO snapshots in this week's scan."
          />
          <Legend
            items={[
              {
                term: "Search Visibility",
                def: "0–100 vs the strongest rival — how much of Google they own here.",
              },
              { term: "Organic / Paid", def: "free listings vs paid Google Ads." },
            ]}
          />
        </SectionCard>

        <SectionCard
          title="Search visibility"
          description="Share of search voice across the tracked keyword set (organic + paid)."
        >
          <div className="rounded-card bg-card p-4 shadow-sh1">
            <SeoTrafficChart competitors={competitors} />
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Keyword rankings"
        description="The most-searched betting terms in this market — where you rank vs your competitors, by real search volume."
      >
        <KeywordLandscape rows={landscape} />
        <Legend
          items={[
            { term: "Volume", def: "monthly Google searches for that term." },
            { term: "You", def: "your rank — green #1–3, amber #4–10, grey = not ranking." },
            { term: "Chips", def: "rivals ranking for it, with their position." },
          ]}
        />
      </SectionCard>
    </div>
  );
}
