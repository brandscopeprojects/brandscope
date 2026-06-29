// HiringExpansion — a compact "where they're expanding" summary for Hiring &
// Signals (Screen 13). Aggregated market → open-role count, derived from the
// geographic_expansion jsonb across the brand's tracked competitors. Read it as
// a directional signal (Google Jobs, partial coverage), not a headcount census.
// Presentational; data arrives via SSR props. Tokens only.

import type { HiringExpansionRow } from "@/lib/data/hiring-signals";

export function HiringExpansion({ rows }: { rows: HiringExpansionRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {rows.map((r) => (
        <div key={r.market} className="rounded-card bg-card p-4 shadow-sh1">
          <p className="text-xs text-ink-secondary">{r.market}</p>
          <p className="mt-1 font-display text-2xl font-bold leading-none text-ink">
            {r.roleCount}
            <span className="ml-1.5 text-xs font-normal text-ink-faint">
              role{r.roleCount === 1 ? "" : "s"}
            </span>
          </p>
        </div>
      ))}
    </div>
  );
}
