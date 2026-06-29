// Performance & Outcomes — Screen 17 (`/performance`). Reads three brand-scoped
// tables (action_outcomes, performance_memory, brand_benchmarks) and lays out:
// real benchmark/outcome headline stats vs market average, a brand-vs-market
// benchmark trend chart, the logged-outcome table, and learned-insight cards.
//
// Auth + brand gating + the shell live in app/(app)/layout.tsx. Before any data
// exists we render the honest "scanning" empty state — never fabricated numbers,
// and revenue/depositors are surfaced only when actually present (CLAUDE.md: no
// fake data inside a v1 page).

import { getCurrentBrand } from "@/lib/data/brand";
import { getPerformanceData, type Benchmark } from "@/lib/data/performance";
import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { StatStrip, type Stat } from "@/components/intelligence/StatStrip";
import {
  PerformanceBenchmarkChart,
  type BenchmarkMetric,
} from "@/components/intelligence/PerformanceBenchmarkChart";
import { PerformanceOutcomeTable } from "@/components/intelligence/PerformanceOutcomeTable";
import { PerformanceMemoryCards } from "@/components/intelligence/PerformanceMemoryCards";

export const dynamic = "force-dynamic";

const SUBTITLE =
  "What you did, what happened, and what we've learned about your market.";

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

/** Signed vs-market label (e.g. "+0.3 vs market avg") — REAL delta, no WoW abuse.
 *  StatStrip's built-in `wow` prop hardcodes a "WoW" tag, which would mislabel a
 *  brand-vs-market comparison, so we encode the comparison in the stat label. */
function vsMarketLabel(metric: string, brand: number, market: number): string {
  const d = Math.round((brand - market) * 10) / 10;
  const sign = d > 0 ? "+" : "";
  return `${metric} · ${sign}${d} vs market`;
}

/** Build the headline stats from REAL benchmark/outcome values only. Sensitive
 *  metrics (revenue, depositors) are intentionally NOT surfaced here. */
function buildStats(
  benchmark: Benchmark | null,
  outcomesCount: number,
  positiveCount: number,
): Stat[] {
  const stats: Stat[] = [];

  if (benchmark?.appRating != null) {
    stats.push({
      label:
        benchmark.marketAvgAppRating != null
          ? vsMarketLabel("App rating", benchmark.appRating, benchmark.marketAvgAppRating)
          : "App rating",
      value: benchmark.appRating.toFixed(2),
    });
  }

  if (benchmark?.ctrPct != null) {
    stats.push({
      label:
        benchmark.marketAvgCtrPct != null
          ? vsMarketLabel("CTR", benchmark.ctrPct, benchmark.marketAvgCtrPct)
          : "Click-through rate",
      value: benchmark.ctrPct.toFixed(1),
      unit: "%",
    });
  }

  stats.push({ label: "Outcomes logged", value: outcomesCount });

  if (outcomesCount > 0) {
    stats.push({
      label: "Positive results",
      value: `${positiveCount}/${outcomesCount}`,
    });
  }

  return stats;
}

/** Pick the benchmark metric with the most non-null points across the trend so
 *  the chart always plots the richest available series (or null = no chart). */
function pickChartMetric(trend: Benchmark[]): BenchmarkMetric | null {
  const ratingPoints = trend.filter((b) => b.appRating != null).length;
  const ctrPoints = trend.filter((b) => b.ctrPct != null).length;
  if (ratingPoints === 0 && ctrPoints === 0) return null;
  return ratingPoints >= ctrPoints ? "appRating" : "ctrPct";
}

export default async function PerformancePage() {
  const brand = await getCurrentBrand();
  // Layout already redirects when there's no brand; this satisfies the type and
  // guards a direct render.
  if (!brand) return null;

  const { outcomes, memories, benchmark, benchmarkTrend } =
    await getPerformanceData(brand);

  // Nothing recorded anywhere yet → honest empty state, no fabricated numbers.
  if (outcomes.length === 0 && memories.length === 0 && benchmark === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Performance & Outcomes" subtitle={SUBTITLE} />
        <EmptyState
          intent="scanning"
          title="No performance data yet"
          message="Log outcomes on your action plan and run weekly scans — your results and learned insights will build up here."
        />
      </div>
    );
  }

  const positiveCount = outcomes.filter((o) => o.result === "positive").length;
  const stats = buildStats(benchmark, outcomes.length, positiveCount);
  const chartMetric = pickChartMetric(benchmarkTrend);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance & Outcomes"
        subtitle={SUBTITLE}
        scanWeek={benchmark?.scanWeek}
      />

      {stats.length > 0 && <StatStrip stats={stats} />}

      {chartMetric && benchmarkTrend.length > 0 && (
        <SectionCard
          title="Benchmark trend"
          description="Your brand against the market average, week over week. Cobalt is you; the dashed grey line is the market."
        >
          <div className="rounded-card bg-card p-4 shadow-sh1">
            <PerformanceBenchmarkChart trend={benchmarkTrend} metric={chartMetric} />
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Logged outcomes"
        description="Actions you marked done and what the result was."
      >
        <PerformanceOutcomeTable outcomes={outcomes} />
      </SectionCard>

      {memories.length > 0 && (
        <SectionCard
          title="What we've learned"
          description="Persistent insights distilled from your scans and outcomes over time."
        >
          <PerformanceMemoryCards memories={memories} />
        </SectionCard>
      )}
    </div>
  );
}
