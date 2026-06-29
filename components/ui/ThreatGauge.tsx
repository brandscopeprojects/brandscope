"use client";

// ThreatGauge — overall weekly competitive threat (ui-constraints §6.4, Screen 3).
// CUSTOM SVG (not Recharts): a semicircular green→amber→red arc with a needle to
// `score` (0–100). Big score in font-display (Syne). 2–3 `reasons` are listed as
// one-liners BENEATH the gauge — visible, never buried in a tooltip.
// Colour of the score/needle is driven by `level`.
// Presentational only. Tokens only, never hex.

import type { ThreatGaugeData, ThreatLevel } from "@/types/view-models";

type ThreatGaugeProps = {
  data: ThreatGaugeData;
};

// Mirrors tailwind.config.ts / ui-constraints §2 — the only allowed place to
// name token hexes (raw SVG attributes cannot read Tailwind classes).
const TOKEN = {
  opportunity: "#27A96C", // green
  watch: "#E8952A", // amber
  urgent: "#E84545", // red
  ink: "#141416",
  inkSecondary: "#6B6B78",
  inkFaint: "#9999A8",
  divider: "#E8E6E0",
} as const;

const LEVEL_COLOR: Record<ThreatLevel, string> = {
  low: TOKEN.opportunity,
  medium: TOKEN.watch,
  high: TOKEN.urgent,
  critical: TOKEN.urgent,
};

const LEVEL_LABEL: Record<ThreatLevel, string> = {
  low: "Low Threat",
  medium: "Medium Threat",
  high: "High Threat",
  critical: "Critical Threat",
};

// Geometry: a 180° arc sweeping left→right (180°→0°), radius R, centre (CX,CY).
const W = 220;
const H = 130;
const CX = W / 2;
const CY = 116;
const R = 92;
const STROKE = 14;

// Map a 0–100 score to a point on the arc. score 0 = left (180°), 100 = right (0°).
function polar(score: number): { x: number; y: number; angle: number } {
  const t = Math.max(0, Math.min(100, score)) / 100;
  const angle = Math.PI * (1 - t); // 180°→0°
  return {
    x: CX + R * Math.cos(angle),
    y: CY - R * Math.sin(angle),
    angle,
  };
}

// Build an SVG arc path between two scores (for the coloured band segments).
function arcPath(fromScore: number, toScore: number): string {
  const a = polar(fromScore);
  const b = polar(toScore);
  const largeArc = 0;
  // sweep-flag 1 = clockwise (left→right across the top)
  return `M ${a.x} ${a.y} A ${R} ${R} 0 ${largeArc} 1 ${b.x} ${b.y}`;
}

// Three coloured bands: green 0–40, amber 40–60, red 60–100 (threat bands per
// scoring-formulas §3: <40 low · 40–59 medium · 60–79 high · ≥80 critical).
const BANDS: Array<{ from: number; to: number; color: string }> = [
  { from: 0, to: 40, color: TOKEN.opportunity },
  { from: 40, to: 60, color: TOKEN.watch },
  { from: 60, to: 100, color: TOKEN.urgent },
];

export function ThreatGauge({ data }: ThreatGaugeProps) {
  const score = Math.max(0, Math.min(100, Math.round(data.score)));
  const color = LEVEL_COLOR[data.level];
  const needle = polar(score);
  const reasons = data.reasons.slice(0, 3);

  return (
    <div className="flex h-full w-full flex-col items-center">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-[260px]"
        role="img"
        aria-label={`Competitive threat ${score} out of 100, ${LEVEL_LABEL[data.level]}`}
      >
        {/* Track (faint full arc behind the bands). */}
        <path
          d={arcPath(0, 100)}
          fill="none"
          stroke={TOKEN.divider}
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        {/* Coloured bands green→amber→red. */}
        {BANDS.map((band) => (
          <path
            key={band.color}
            d={arcPath(band.from, band.to)}
            fill="none"
            stroke={band.color}
            strokeWidth={STROKE}
            strokeOpacity={0.9}
          />
        ))}
        {/* Needle to the score. */}
        <line
          x1={CX}
          y1={CY}
          x2={needle.x}
          y2={needle.y}
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={CX} cy={CY} r={6} fill={color} />
      </svg>

      {/* Big score (Syne / font-display) + level label, coloured by level. */}
      <div className="-mt-6 flex flex-col items-center">
        <span
          className="font-display text-4xl font-bold leading-none"
          style={{ color }}
        >
          {score}
          <span className="text-xl text-ink-faint">/100</span>
        </span>
        <span
          className="mt-1 text-sm font-semibold"
          style={{ color }}
        >
          {LEVEL_LABEL[data.level]}
        </span>
      </div>

      {/* Reasons — one-liners listed beneath the gauge (never in a tooltip). */}
      {reasons.length > 0 && (
        <ul className="mt-3 w-full space-y-1.5 border-t border-divider pt-3">
          {reasons.map((reason, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-xs text-ink-secondary"
            >
              <span
                className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
