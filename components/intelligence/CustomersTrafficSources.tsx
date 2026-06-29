"use client";

// CustomersTrafficSources — Screen 11 (Customer Intelligence). Inferred traffic
// channel mix (DataForSEO) for one selected competitor, as a glanceable donut.
// traffic_sources is PER-COMPETITOR, so a small selector switches which
// competitor's mix is shown. A competitor's ring uses the neutral grey ramp; the
// own brand (competitorId === ownBrandId) renders in a cobalt ramp — cobalt is
// the single own-brand marker and is never decorative (ui-constraints §2.2/§12,
// "cobalt = own brand" in charts). Recharts needs colour strings, so the inline
// TOKEN map mirrors tailwind.config.ts (the one allowed place to name hexes —
// same pattern as SOVDonut/SeoTrafficChart). Data from SSR props.

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { CompetitorCustomerIntel } from "@/lib/data/customers";

const TOKEN = {
  ink: "#141416",
  inkSecondary: "#6B6B78",
  card: "#FFFFFF",
  // Neutral grey ramp (mirrors the SOV donut convention) — used for competitor
  // channels, which carry no status meaning.
  greyRamp: ["#6B6B78", "#8A8A96", "#9999A8", "#B4B4BE", "#CBCBD2"],
  // Cobalt ramp — ONLY for the own brand's own channels (own-brand marker).
  cobaltRamp: ["#2B5CE6", "#5277EB", "#7A93F0", "#A2AFF5", "#C9D2FA"],
} as const;

type Slice = { source: string; pct: number };

function DonutTooltip(props: {
  active?: boolean;
  payload?: Array<{ payload?: Slice }>;
}) {
  if (!props.active || !props.payload?.length) return null;
  const d = props.payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-card bg-card px-3 py-2 shadow-sh3">
      <p className="text-sm font-semibold text-ink">{d.source}</p>
      <p className="mt-0.5 font-mono text-xs text-ink-secondary">
        {Math.round(d.pct)}% of traffic
      </p>
    </div>
  );
}

export function CustomersTrafficSources({
  competitors,
  ownBrandId,
}: {
  competitors: CompetitorCustomerIntel[];
  /** The brand's own competitorId — its ring renders cobalt, others grey. */
  ownBrandId?: string;
}) {
  // Only competitors that actually have a traffic-source mix this week.
  const withSources = competitors.filter((c) => c.trafficSources.length > 0);
  const [selectedId, setSelectedId] = useState<string>(
    withSources[0]?.competitorId ?? "",
  );

  if (withSources.length === 0) {
    return (
      <div className="rounded-card bg-card p-4 shadow-sh1">
        <p className="text-sm text-ink-secondary">
          Inferred traffic channels appear once DataForSEO returns a traffic breakdown
          for your competitors.
        </p>
      </div>
    );
  }

  const selected =
    withSources.find((c) => c.competitorId === selectedId) ?? withSources[0];
  const isOwnBrand = selected.competitorId === ownBrandId;
  const ramp = isOwnBrand ? TOKEN.cobaltRamp : TOKEN.greyRamp;
  const slices: Slice[] = selected.trafficSources.map((t) => ({
    source: t.source,
    pct: t.pct,
  }));

  return (
    <div
      className={`rounded-card p-4 shadow-sh1 ${
        isOwnBrand ? "bg-cobalt/5" : "bg-card"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-xs text-ink-secondary">Traffic channel mix</p>
          {isOwnBrand && (
            <span className="rounded-chip bg-cobalt/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cobalt">
              You
            </span>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-secondary">
          <span className="sr-only">Select competitor</span>
          <select
            value={selected.competitorId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded-chip border border-divider bg-base-secondary px-2 py-1 text-xs font-medium text-ink focus:border-cobalt focus:outline-none"
          >
            {withSources.map((c) => (
              <option key={c.competitorId} value={c.competitorId}>
                {c.competitorId === ownBrandId ? `${c.name} (You)` : c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-2 grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<DonutTooltip />} />
              <Pie
                data={slices}
                dataKey="pct"
                nameKey="source"
                cx="50%"
                cy="50%"
                innerRadius="58%"
                outerRadius="90%"
                paddingAngle={1.5}
                stroke={TOKEN.card}
                strokeWidth={2}
                isAnimationActive={false}
              >
                {slices.map((s, i) => (
                  <Cell
                    key={s.source}
                    fill={ramp[Math.min(i, ramp.length - 1)]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend / readout — channel → share, mono values. */}
        <ul className="space-y-1.5">
          {slices.map((s, i) => (
            <li key={s.source} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: ramp[Math.min(i, ramp.length - 1)],
                }}
                aria-hidden
              />
              <span className="flex-1 truncate text-ink">{s.source}</span>
              <span className="font-mono text-xs text-ink-secondary">
                {Math.round(s.pct)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
