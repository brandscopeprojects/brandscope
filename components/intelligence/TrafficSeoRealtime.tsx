"use client";

import { useEffect, useState } from "react";
import { useRealtimeCacheSubscription } from "@/lib/hooks/useRealtimeCacheSubscription";
import { StatStrip, type Stat } from "@/components/intelligence/StatStrip";
import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { TierBadge } from "@/components/intelligence/TierBadge";
import { KeywordLandscape } from "@/components/intelligence/KeywordLandscape";
import { SeoTrafficChart } from "@/components/intelligence/SeoTrafficChart";
import type { CompetitorSeo } from "@/lib/data/traffic-seo";

interface TrafficSeoRealtimeProps {
  brandId: string;
  scanWeek: string;
  initialCompetitors?: CompetitorSeo[];
  initialKeywordGaps?: any[];
  initialLandscape?: any[];
}

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

export function TrafficSeoRealtime({
  brandId,
  scanWeek,
  initialCompetitors,
  initialKeywordGaps,
  initialLandscape,
}: TrafficSeoRealtimeProps) {
  const [competitors, setCompetitors] = useState<CompetitorSeo[]>(initialCompetitors || []);
  const [keywordGaps, setKeywordGaps] = useState(initialKeywordGaps || []);
  const [landscape, setLandscape] = useState(initialLandscape || []);

  const { data: seoData } = useRealtimeCacheSubscription({
    tableName: "seo_cache",
    brandId,
    scanWeek,
  });

  useEffect(() => {
    if (seoData) {
      setCompetitors((seoData as any).competitors || initialCompetitors || []);
      setKeywordGaps((seoData as any).keywordGaps || initialKeywordGaps || []);
      setLandscape((seoData as any).landscape || initialLandscape || []);
    }
  }, [seoData, initialCompetitors, initialKeywordGaps, initialLandscape]);

  const rivals = competitors.filter((c) => !c.isOwnBrand);
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
    <>
      <StatStrip stats={stats} />

      {withVisibility.length === 0 && rivals.length > 0 && (
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
    </>
  );
}
