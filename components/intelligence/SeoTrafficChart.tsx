"use client";

// SeoTrafficChart — estimated monthly traffic per tracked competitor (Screen 7,
// positioning register). A restrained horizontal bar chart: traffic is the
// headline SEO metric, ranked descending. Competitors are the only series here
// (the brand's own SEO snapshot is not in seo_cache, which is per-competitor) so
// bars use the neutral grey ramp — cobalt is reserved for own-brand markers and
// is never decorative (ui-constraints §2.2). Recharts needs colour strings, so
// the inline TOKEN map mirrors tailwind.config.ts (the one allowed place to name
// hexes — same pattern as ScatterMap). Presentational; data from SSR props.

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CompetitorSeo } from "@/lib/data/traffic-seo";

const TOKEN = {
  ink: "#141416",
  inkSecondary: "#6B6B78",
  inkFaint: "#9999A8",
  divider: "#E8E6E0",
  card: "#FFFFFF",
  // Neutral grey ramp (mirrors the SOV donut convention) — no status colour,
  // no cobalt, since these are competitors, not the own brand.
  greyRamp: ["#6B6B78", "#8A8A96", "#9999A8", "#B4B4BE", "#CBCBD2"],
} as const;

type Datum = { name: string; traffic: number };

function ChartTooltip(props: {
  active?: boolean;
  payload?: Array<{ payload?: Datum }>;
}) {
  if (!props.active || !props.payload?.length) return null;
  const d = props.payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-card bg-card px-3 py-2 shadow-sh3">
      <p className="text-sm font-semibold text-ink">{d.name}</p>
      <p className="mt-0.5 font-mono text-xs text-ink-secondary">
        {d.traffic.toLocaleString()} est. monthly visits
      </p>
    </div>
  );
}

export function SeoTrafficChart({ competitors }: { competitors: CompetitorSeo[] }) {
  const data: Datum[] = competitors
    .filter((c) => c.estimatedTraffic != null)
    .map((c) => ({ name: c.name, traffic: c.estimatedTraffic as number }));

  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[180px] items-center justify-center rounded-chip border border-dashed border-divider px-4 text-center text-sm text-ink-secondary">
        Estimated traffic appears once DataForSEO returns volume for these competitors.
      </div>
    );
  }

  // Tall enough to give each bar room; grows with competitor count.
  const height = Math.max(180, data.length * 44 + 24);

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 56, bottom: 4, left: 8 }}
        >
          <CartesianGrid horizontal={false} stroke={TOKEN.divider} strokeOpacity={0.6} />
          <XAxis
            type="number"
            tick={{ fill: TOKEN.inkFaint, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: TOKEN.divider }}
            tickFormatter={(v: number) => v.toLocaleString()}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={96}
            tick={{ fill: TOKEN.inkSecondary, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: TOKEN.divider }}
          />
          <Tooltip cursor={{ fill: TOKEN.divider, fillOpacity: 0.3 }} content={<ChartTooltip />} />
          <Bar dataKey="traffic" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={d.name} fill={TOKEN.greyRamp[Math.min(i, TOKEN.greyRamp.length - 1)]} />
            ))}
            <LabelList
              dataKey="traffic"
              position="right"
              formatter={(v: unknown) =>
                typeof v === "number" ? v.toLocaleString() : String(v ?? "")
              }
              fill={TOKEN.inkSecondary}
              fontSize={11}
              fontFamily="var(--font-jetbrains-mono)"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
