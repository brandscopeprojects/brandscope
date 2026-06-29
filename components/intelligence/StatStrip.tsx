// StatStrip — a row of headline metric tiles (ui-constraints §12 "metric stat
// card"): big Syne number + Inter label + optional WoW delta. Used across most
// intelligence pages (Promotions, Traffic, Tech Stack, Hiring, Performance…).
// Presentational. Tokens only.

import { WoWIndicator } from "@/components/intelligence/WoWIndicator";

export type Stat = {
  label: string;
  value: string | number;
  unit?: string;
  /** Week-over-week change; positive renders green ▲, negative red ▼. Omit to hide. */
  wow?: number | null;
  /** Some metrics improve when they go DOWN (e.g. complaints). Flip the colour. */
  wowInverse?: boolean;
};

export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-card bg-card p-4 shadow-sh1">
          <p className="text-xs text-ink-secondary">{s.label}</p>
          <p className="mt-1 font-display text-3xl font-bold leading-none text-ink">
            {s.value}
            {s.unit && <span className="ml-0.5 text-lg text-ink-faint">{s.unit}</span>}
          </p>
          {s.wow != null && s.wow !== 0 && (
            <div className="mt-1.5">
              <WoWIndicator delta={s.wow} inverse={s.wowInverse} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
