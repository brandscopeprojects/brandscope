"use client";

// SOVDonut — Share of Voice ring (ui-constraints §6.3, Screen 3).
// A single glanceable donut. The own-brand slice is ALWAYS cobalt; everyone
// else is a grey shade. The own-brand SOV % sits in the centre as the biggest
// number, in font-display (Syne).
// Presentational only. Tokens only, never hex.

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { SovSlice } from "@/types/view-models";

type SOVDonutProps = {
  slices: SovSlice[];
};

// Mirrors tailwind.config.ts / ui-constraints §2 — the only allowed place to
// name token hexes (Recharts SVG fills cannot read Tailwind classes).
const TOKEN = {
  cobalt: "#2B5CE6",
  ink: "#141416",
  inkSecondary: "#6B6B78",
  card: "#FFFFFF",
} as const;

// Grey shades for competitor slices (derived from ink-secondary/ink-faint
// family). Cobalt is reserved for the own brand only — never decorative.
const GREYS = ["#6B6B78", "#8A8A96", "#9999A8", "#B4B4BE", "#CBCBD2"];

function sliceFill(slice: SovSlice, greyIndex: number): string {
  if (slice.isOwnBrand) return TOKEN.cobalt;
  return GREYS[greyIndex % GREYS.length];
}

function DonutTooltip(props: {
  active?: boolean;
  payload?: Array<{ payload?: SovSlice }>;
}) {
  if (!props.active || !props.payload?.length) return null;
  const d = props.payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-card bg-card px-3 py-2 shadow-sh3">
      <p className="text-sm font-semibold text-ink">{d.label}</p>
      <p className="font-mono text-xs text-ink-secondary">
        {Math.round(d.value)}% share of voice
      </p>
    </div>
  );
}

export function SOVDonut({ slices }: SOVDonutProps) {
  const own = slices.find((s) => s.isOwnBrand);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const ownPct =
    own && total > 0 ? Math.round((own.value / total) * 100) : own ? Math.round(own.value) : 0;

  let greyIndex = -1;

  return (
    <div className="relative h-full w-full">
      <ResponsiveContainer width="100%" height="100%" minHeight={260}>
        <PieChart>
          <Tooltip content={<DonutTooltip />} />
          <Pie
            data={slices}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={1.5}
            stroke={TOKEN.card}
            strokeWidth={2}
            isAnimationActive={false}
          >
            {slices.map((s) => {
              if (!s.isOwnBrand) greyIndex += 1;
              return (
                <Cell
                  key={s.label}
                  fill={sliceFill(s, s.isOwnBrand ? 0 : greyIndex)}
                />
              );
            })}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Centre label — own-brand SOV % as the big number (Syne / font-display). */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-bold leading-none text-cobalt">
          {ownPct}
          <span className="text-2xl">%</span>
        </span>
        <span className="mt-1 text-xs text-ink-secondary">Share of voice</span>
        {own && (
          <span className="mt-0.5 max-w-[8rem] truncate text-[11px] text-ink-faint">
            {own.label}
          </span>
        )}
      </div>
    </div>
  );
}
