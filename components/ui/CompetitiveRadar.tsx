"use client";

// CompetitiveRadar — 6-axis radar (ui-constraints §6.2, Screen 3).
// Brand polygon = cobalt fill (~30% opacity). Market average = faint-red dashed
// outline. Where cobalt falls short of the red outline = a competitive gap.
//
// NULL-AXIS RULE (scoring-formulas §7): a null axis value means the signal is
// not available at MVP (Social / Engagement need Apify). It must render MUTED
// and labelled "Phase 2" — NEVER plotted as 0, which would collapse the polygon
// inward and distort the brand-vs-market shape.
//
// Presentational only. Tokens only, never hex.

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import type { RadarData } from "@/types/view-models";

type CompetitiveRadarProps = {
  data: RadarData;
};

// Mirrors tailwind.config.ts / ui-constraints §2 — the only allowed place to
// name token hexes (Recharts SVG fills cannot read Tailwind classes).
const TOKEN = {
  cobalt: "#2B5CE6",
  urgent: "#E84545",
  ink: "#141416",
  inkSecondary: "#6B6B78",
  inkFaint: "#9999A8",
  divider: "#E8E6E0",
} as const;

type AxisRow = {
  axis: string;
  brand: number;
  marketAvg: number;
  available: boolean;
};

// A null on EITHER series means the axis is unavailable at MVP. We keep the
// polygon connected by substituting a neutral mid value (50) purely so the shape
// stays readable, but flag the axis as unavailable so its label renders muted
// and "Phase 2" — the substituted value is never presented as real data.
const PHASE2_PLACEHOLDER = 50;

function buildRows(data: RadarData): AxisRow[] {
  return data.axes.map((axis, i) => {
    const b = data.brand[i] ?? null;
    const m = data.marketAvg[i] ?? null;
    const available = b != null && m != null;
    return {
      axis,
      brand: available ? (b as number) : PHASE2_PLACEHOLDER,
      marketAvg: available ? (m as number) : PHASE2_PLACEHOLDER,
      available,
    };
  });
}

export function CompetitiveRadar({ data }: CompetitiveRadarProps) {
  const rows = buildRows(data);

  // Custom angle-axis tick so unavailable axes render muted + "Phase 2".
  const renderAxisTick = (props: {
    x?: string | number;
    y?: string | number;
    textAnchor?: string;
    payload?: { value?: string | number };
  }) => {
    const { textAnchor, payload } = props;
    const x = props.x == null ? null : Number(props.x);
    const y = props.y == null ? null : Number(props.y);
    if (x == null || y == null) return <g />;
    const label = payload?.value == null ? "" : String(payload.value);
    const row = rows.find((r) => r.axis === label);
    const available = row?.available ?? true;
    return (
      <g>
        <text
          x={x}
          y={y}
          textAnchor={textAnchor as "start" | "middle" | "end" | undefined}
          fontSize={12}
          fontWeight={available ? 500 : 400}
          fill={available ? TOKEN.ink : TOKEN.inkFaint}
          opacity={available ? 1 : 0.7}
        >
          {label}
        </text>
        {!available && (
          <text
            x={x}
            y={y + 13}
            textAnchor={textAnchor as "start" | "middle" | "end" | undefined}
            fontSize={9}
            fontWeight={500}
            letterSpacing="0.05em"
            fill={TOKEN.inkFaint}
          >
            PHASE 2
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%" minHeight={320}>
        <RadarChart data={rows} margin={{ top: 24, right: 24, bottom: 24, left: 24 }}>
          <PolarGrid stroke={TOKEN.divider} />
          <PolarAngleAxis
            dataKey="axis"
            tick={renderAxisTick}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tick={false}
            axisLine={false}
            tickCount={5}
          />
          {/* Market average — faint red dashed outline, no fill. */}
          <Radar
            name="Market average"
            dataKey="marketAvg"
            stroke={TOKEN.urgent}
            strokeOpacity={0.55}
            strokeDasharray="5 4"
            strokeWidth={1.5}
            fill="none"
            isAnimationActive={false}
          />
          {/* Brand — cobalt, ~30% fill. */}
          <Radar
            name="Your brand"
            dataKey="brand"
            stroke={TOKEN.cobalt}
            strokeWidth={2}
            fill={TOKEN.cobalt}
            fillOpacity={0.3}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center justify-center gap-5 text-xs">
        <span className="flex items-center gap-1.5 text-ink-secondary">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-cobalt" />
          Your brand
        </span>
        <span className="flex items-center gap-1.5 text-ink-secondary">
          <span
            className="inline-block h-0 w-4 border-t-2 border-dashed"
            style={{ borderColor: TOKEN.urgent, opacity: 0.55 }}
          />
          Market average
        </span>
      </div>
    </div>
  );
}
