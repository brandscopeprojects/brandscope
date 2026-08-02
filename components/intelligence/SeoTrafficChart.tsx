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
  // Cobalt is reserved for the own-brand marker (ui-constraints §2.2).
  cobalt: "#2B5CE6",
  // Neutral grey ramp for competitors — no status colour.
  greyRamp: ["#6B6B78", "#8A8A96", "#9999A8", "#B4B4BE", "#CBCBD2"],
} as const;

type Datum = { name: string; value: number; own: boolean };

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
        {d.value}/100 search visibility
      </p>
    </div>
  );
}

export function SeoTrafficChart({ competitors }: { competitors: CompetitorSeo[] }) {
  // domainAuthority carries the live-SERP visibility score (SOSV 0–100).
  const data: Datum[] = competitors
    .filter((c) => c.domainAuthority != null)
    .map((c) => ({ name: c.name, value: c.domainAuthority as number, own: !!c.isOwnBrand }));

  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[180px] items-center justify-center rounded-chip border border-dashed border-divider px-4 text-center text-sm text-ink-secondary">
        Search visibility appears once live Google results come back for these competitors.
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
            domain={[0, 100]}
            tick={{ fill: TOKEN.inkFaint, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: TOKEN.divider }}
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
          <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell
                key={d.name}
                fill={d.own ? TOKEN.cobalt : TOKEN.greyRamp[Math.min(i, TOKEN.greyRamp.length - 1)]}
              />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v: unknown) =>
                typeof v === "number" ? String(v) : String(v ?? "")
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
