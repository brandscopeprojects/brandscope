"use client";

// ScatterMap — Market Position Map (ui-constraints §6.1, Screen 3).
// The single most important visual: a 3-second read of competitive position.
// X = market reach (Low→High), Y = competitive aggression (Low→High), both 0–100.
// Competitors = grey labelled dots; own brand = a larger, gently pulsing cobalt
// circle (impossible to miss). Faint quadrant labels in the background.
// Presentational only — takes props, no fetching. Tokens only, never hex.

import {
  CartesianGrid,
  Customized,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { ScatterPoint } from "@/types/view-models";

type ScatterMapProps = {
  brand: ScatterPoint;
  competitors: ScatterPoint[];
  onCompetitorClick?: (id: string) => void;
};

// Token hexes are referenced here only because Recharts SVG fills need a colour
// string (it cannot read Tailwind classes). These mirror tailwind.config.ts /
// ui-constraints §2 exactly — the single allowed place to name them.
const TOKEN = {
  cobalt: "#2B5CE6",
  ink: "#141416",
  inkSecondary: "#6B6B78",
  inkFaint: "#9999A8",
  divider: "#E8E6E0",
  card: "#FFFFFF",
  grey: "#9999A8",
} as const;

const QUADRANTS = [
  { label: "Challengers", x: "8%", y: "10%", anchor: "start" as const },
  { label: "Dominants", x: "92%", y: "10%", anchor: "end" as const },
  { label: "Niche", x: "8%", y: "92%", anchor: "start" as const },
  { label: "Established", x: "92%", y: "92%", anchor: "end" as const },
];

// Faint background quadrant labels + a cross-hair through the centre (50,50).
// Drawn via <Customized> so they sit behind the dots, inside the plot area.
function QuadrantLayer(props: {
  offset?: { left: number; top: number; width: number; height: number };
}) {
  const offset = props.offset;
  if (!offset) return null;
  const { left, top, width, height } = offset;
  const cx = left + width / 2;
  const cy = top + height / 2;
  return (
    <g pointerEvents="none">
      <line
        x1={cx}
        y1={top}
        x2={cx}
        y2={top + height}
        stroke={TOKEN.divider}
        strokeDasharray="4 4"
      />
      <line
        x1={left}
        y1={cy}
        x2={left + width}
        y2={cy}
        stroke={TOKEN.divider}
        strokeDasharray="4 4"
      />
      {QUADRANTS.map((q) => {
        const px =
          left + (parseFloat(q.x) / 100) * width;
        const py = top + (parseFloat(q.y) / 100) * height;
        return (
          <text
            key={q.label}
            x={px}
            y={py}
            textAnchor={q.anchor}
            fontSize={12}
            fontWeight={600}
            letterSpacing="0.04em"
            fill={TOKEN.inkFaint}
            opacity={0.5}
          >
            {q.label.toUpperCase()}
          </text>
        );
      })}
    </g>
  );
}

type Datum = ScatterPoint;

// Competitor dot: grey filled circle with a label to the right.
function CompetitorDot(props: {
  cx?: number;
  cy?: number;
  payload?: Datum;
  onCompetitorClick?: (id: string) => void;
}) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  const clickable = Boolean(props.onCompetitorClick);
  return (
    <g
      style={{ cursor: clickable ? "pointer" : "default" }}
      onClick={
        clickable ? () => props.onCompetitorClick?.(payload.id) : undefined
      }
    >
      <circle cx={cx} cy={cy} r={6} fill={TOKEN.grey} fillOpacity={0.85} />
      <text
        x={cx + 10}
        y={cy + 4}
        fontSize={11}
        fill={TOKEN.inkSecondary}
        fontWeight={500}
      >
        {payload.label}
      </text>
    </g>
  );
}

// Own-brand dot: larger cobalt circle with a pulsing halo (animate-brand-pulse).
function BrandDot(props: { cx?: number; cy?: number; payload?: Datum }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  return (
    <g>
      <circle
        className="animate-brand-pulse"
        cx={cx}
        cy={cy}
        r={6}
        fill={TOKEN.cobalt}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
      <circle
        cx={cx}
        cy={cy}
        r={9}
        fill={TOKEN.cobalt}
        stroke={TOKEN.card}
        strokeWidth={2}
      />
      <text
        x={cx + 14}
        y={cy + 4}
        fontSize={12}
        fontWeight={700}
        fill={TOKEN.ink}
      >
        {payload.label}
      </text>
    </g>
  );
}

function fmt(n: number | null | undefined, suffix = ""): string {
  if (n == null) return "—";
  return `${n}${suffix}`;
}

function ScatterTooltip(props: {
  active?: boolean;
  payload?: Array<{ payload?: Datum }>;
}) {
  if (!props.active || !props.payload?.length) return null;
  const d = props.payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-card bg-card px-3 py-2 shadow-sh3">
      <p className="text-sm font-semibold text-ink">{d.label}</p>
      <dl className="mt-1 space-y-0.5">
        <div className="flex items-center justify-between gap-4 text-xs">
          <dt className="text-ink-secondary">Traffic</dt>
          <dd className="font-mono text-ink">
            {d.traffic == null ? "—" : d.traffic.toLocaleString()}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 text-xs">
          <dt className="text-ink-secondary">Share of Voice</dt>
          <dd className="font-mono text-ink">{fmt(d.sovPct, "%")}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 text-xs">
          <dt className="text-ink-secondary">Threat</dt>
          <dd className="font-mono text-ink">{fmt(d.threatScore, "/100")}</dd>
        </div>
      </dl>
    </div>
  );
}

export function ScatterMap({
  brand,
  competitors,
  onCompetitorClick,
}: ScatterMapProps) {
  // A player with no reach signal (DataForSEO has no traffic estimate for the
  // domain yet) cannot be meaningfully positioned on the X axis. Plotting them
  // anyway stacks every dot on one pixel at the origin with garbled labels —
  // reads as broken. Honest rendering: plot only positioned players, list the
  // rest, and say so plainly when nobody can be positioned yet.
  const hasPosition = (p: ScatterPoint) => (p.reach ?? 0) > 0;
  const positioned = competitors.filter(hasPosition);
  const unpositioned = competitors.filter((c) => !hasPosition(c));
  const brandPositioned = hasPosition(brand);

  if (!brandPositioned && positioned.length === 0) {
    return (
      <div className="flex h-full min-h-[320px] w-full flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm font-medium text-ink">Not enough data to map positions yet</p>
        <p className="max-w-md text-xs leading-relaxed text-ink-secondary">
          Positioning needs traffic reach, and DataForSEO has no estimates for these
          domains yet — common for smaller country-specific sites. All{" "}
          {competitors.length + 1} players were scanned this week; dots appear here
          as coverage builds. Promotions, GEO and regulatory intelligence are
          unaffected.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <ResponsiveContainer width="100%" height="100%" minHeight={300}>
        <ScatterChart margin={{ top: 16, right: 24, bottom: 28, left: 12 }}>
          <CartesianGrid stroke={TOKEN.divider} strokeOpacity={0.6} />
          <XAxis
            type="number"
            dataKey="reach"
            name="Reach"
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            tickFormatter={(v: number) =>
              v === 0 ? "Low" : v === 100 ? "High" : ""
            }
            tick={{ fill: TOKEN.inkFaint, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: TOKEN.divider }}
            label={{
              value: "Market reach",
              position: "insideBottom",
              offset: -16,
              fill: TOKEN.inkSecondary,
              fontSize: 12,
            }}
          />
          <YAxis
            type="number"
            dataKey="aggression"
            name="Aggression"
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            tickFormatter={(v: number) =>
              v === 0 ? "Low" : v === 100 ? "High" : ""
            }
            tick={{ fill: TOKEN.inkFaint, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: TOKEN.divider }}
            label={{
              value: "Competitive aggression",
              angle: -90,
              position: "insideLeft",
              offset: 8,
              style: { textAnchor: "middle" },
              fill: TOKEN.inkSecondary,
              fontSize: 12,
            }}
          />
          <ZAxis range={[60, 60]} />
          <Customized component={QuadrantLayer} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: TOKEN.inkFaint }}
            content={<ScatterTooltip />}
          />
          <Scatter
            data={positioned}
            isAnimationActive={false}
            shape={(p: object) => (
              <CompetitorDot
                {...(p as { cx?: number; cy?: number; payload?: Datum })}
                onCompetitorClick={onCompetitorClick}
              />
            )}
          />
          {brandPositioned && (
            <Scatter
              data={[brand]}
              isAnimationActive={false}
              shape={(p: object) => (
                <BrandDot
                  {...(p as { cx?: number; cy?: number; payload?: Datum })}
                />
              )}
            />
          )}
        </ScatterChart>
      </ResponsiveContainer>
      {(unpositioned.length > 0 || !brandPositioned) && (
        <p className="px-2 pb-1 pt-2 text-xs leading-relaxed text-ink-faint">
          Awaiting traffic data to position:{" "}
          {[!brandPositioned ? brand.label : null, ...unpositioned.map((c) => c.label)]
            .filter(Boolean)
            .join(", ")}
        </p>
      )}
    </div>
  );
}
