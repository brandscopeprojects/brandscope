"use client";

// PerformanceBenchmarkChart — your brand vs the market average over scan weeks
// for a single benchmark metric (Screen 17, positioning register). A restrained
// two-line chart: cobalt solid = YOUR BRAND (own-brand marker is always cobalt,
// ui-constraints §2.2), grey dashed = market average. Recharts needs colour
// strings, so the inline TOKEN map mirrors tailwind.config.ts (same allowed
// pattern as SeoTrafficChart). Presentational; data from SSR props.

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatScanWeek } from "@/lib/format";
import type { Benchmark } from "@/lib/data/performance";

const TOKEN = {
  ink: "#141416",
  inkSecondary: "#6B6B78",
  inkFaint: "#9999A8",
  divider: "#E8E6E0",
  card: "#FFFFFF",
  cobalt: "#2B5CE6",
  marketGrey: "#9999A8",
} as const;

/** Which benchmark metric this chart plots. */
export type BenchmarkMetric = "appRating" | "ctrPct";

const METRIC_CONFIG: Record<
  BenchmarkMetric,
  {
    label: string;
    brandKey: keyof Pick<Benchmark, "appRating" | "ctrPct">;
    marketKey: keyof Pick<Benchmark, "marketAvgAppRating" | "marketAvgCtrPct">;
    format: (v: number) => string;
  }
> = {
  appRating: {
    label: "App rating",
    brandKey: "appRating",
    marketKey: "marketAvgAppRating",
    format: (v) => v.toFixed(2),
  },
  ctrPct: {
    label: "CTR",
    brandKey: "ctrPct",
    marketKey: "marketAvgCtrPct",
    format: (v) => `${v.toFixed(1)}%`,
  },
};

type Datum = { week: string; brand: number | null; market: number | null };

function ChartTooltip(props: {
  active?: boolean;
  payload?: Array<{ payload?: Datum }>;
  metric: BenchmarkMetric;
}) {
  if (!props.active || !props.payload?.length) return null;
  const d = props.payload[0]?.payload;
  if (!d) return null;
  const fmt = METRIC_CONFIG[props.metric].format;
  return (
    <div className="rounded-card bg-card px-3 py-2 shadow-sh3">
      <p className="font-mono text-xs text-ink-faint">{formatScanWeek(d.week)}</p>
      <p className="mt-1 text-sm text-ink">
        <span className="font-medium text-cobalt">You</span>{" "}
        <span className="font-mono">{d.brand == null ? "—" : fmt(d.brand)}</span>
      </p>
      <p className="text-sm text-ink-secondary">
        Market avg{" "}
        <span className="font-mono">{d.market == null ? "—" : fmt(d.market)}</span>
      </p>
    </div>
  );
}

export function PerformanceBenchmarkChart({
  trend,
  metric,
}: {
  trend: Benchmark[];
  metric: BenchmarkMetric;
}) {
  const cfg = METRIC_CONFIG[metric];
  const data: Datum[] = trend.map((b) => ({
    week: b.scanWeek,
    brand: b[cfg.brandKey],
    market: b[cfg.marketKey],
  }));

  // Nothing to plot — guard (the page already gates on this, but be defensive).
  const hasAny = data.some((d) => d.brand != null || d.market != null);
  if (!hasAny) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-chip border border-dashed border-divider px-4 text-center text-sm text-ink-secondary">
        {cfg.label} appears once weekly scans record it.
      </div>
    );
  }

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} stroke={TOKEN.divider} strokeOpacity={0.6} />
          <XAxis
            dataKey="week"
            tick={{ fill: TOKEN.inkFaint, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: TOKEN.divider }}
            tickFormatter={(v: string) => formatScanWeek(v).replace("Week of ", "")}
          />
          <YAxis
            tick={{ fill: TOKEN.inkFaint, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: TOKEN.divider }}
            tickFormatter={(v: number) => cfg.format(v)}
            width={48}
          />
          <Tooltip
            cursor={{ stroke: TOKEN.divider }}
            content={<ChartTooltip metric={metric} />}
          />
          <Legend
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, color: TOKEN.inkSecondary }}
          />
          <Line
            name="You"
            type="monotone"
            dataKey="brand"
            stroke={TOKEN.cobalt}
            strokeWidth={2.5}
            dot={{ r: 3, fill: TOKEN.cobalt, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            name="Market avg"
            type="monotone"
            dataKey="market"
            stroke={TOKEN.marketGrey}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
