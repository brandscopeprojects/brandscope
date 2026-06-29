"use client";

// RevenueMrrChart — platform MRR over time (Screen 29, internal Revenue
// Dashboard). The MRR series is the Brandscope platform's own headline metric,
// so it is the ONE place cobalt is correct here (own-platform = brand accent,
// ui-constraints §2.2) — rendered as a cobalt line over a faint cobalt area.
// Recharts needs colour strings, so the inline TOKEN map mirrors
// tailwind.config.ts (the one allowed place to name hexes — same pattern as
// SeoTrafficChart / ScatterMap). Presentational; data from SSR props.

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MrrTrendPoint } from "@/lib/data/internal-revenue";

const TOKEN = {
  cobalt: "#2B5CE6",
  ink: "#141416",
  inkSecondary: "#6B6B78",
  inkFaint: "#9999A8",
  divider: "#E8E6E0",
  card: "#FFFFFF",
} as const;

type Datum = { week: string; label: string; mrr: number };

/** Compact naira for the Y axis → "₦1.2m" / "₦340k" / "₦0". */
function axisNaira(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `₦${Math.round(v / 1_000)}k`;
  return `₦${Math.round(v)}`;
}

function fullNaira(v: number): string {
  return `₦${v.toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function ChartTooltip(props: {
  active?: boolean;
  payload?: Array<{ payload?: Datum }>;
}) {
  if (!props.active || !props.payload?.length) return null;
  const d = props.payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-card bg-card px-3 py-2 shadow-sh3">
      <p className="text-sm font-semibold text-ink">{d.label}</p>
      <p className="mt-0.5 font-mono text-xs text-ink-secondary">
        {fullNaira(d.mrr)} MRR
      </p>
    </div>
  );
}

export function RevenueMrrChart({ trend }: { trend: MrrTrendPoint[] }) {
  const data: Datum[] = trend
    .filter((p) => p.mrrNaira != null)
    .map((p) => ({ week: p.week, label: p.label, mrr: p.mrrNaira as number }));

  return (
    <section className="rounded-card bg-card p-5 shadow-sh1">
      <h2 className="text-sm font-semibold text-ink">MRR over time</h2>
      <p className="mt-0.5 text-xs text-ink-secondary">
        Monthly recurring revenue across the platform, by scan week.
      </p>

      {data.length === 0 ? (
        <div className="mt-4 flex h-[220px] items-center justify-center rounded-chip border border-dashed border-divider px-4 text-center text-sm text-ink-secondary">
          MRR appears once revenue metrics record a value for a period.
        </div>
      ) : (
        <div className="mt-4 h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
            >
              <defs>
                <linearGradient id="revenueMrrFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TOKEN.cobalt} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={TOKEN.cobalt} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={TOKEN.divider} strokeOpacity={0.7} />
              <XAxis
                dataKey="label"
                tick={{ fill: TOKEN.inkFaint, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: TOKEN.divider }}
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: TOKEN.inkFaint, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={axisNaira}
              />
              <Tooltip
                cursor={{ stroke: TOKEN.divider, strokeWidth: 1 }}
                content={<ChartTooltip />}
              />
              <Area
                type="monotone"
                dataKey="mrr"
                stroke={TOKEN.cobalt}
                strokeWidth={2}
                fill="url(#revenueMrrFill)"
                dot={false}
                activeDot={{ r: 4, fill: TOKEN.cobalt, stroke: TOKEN.card, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
