// HiringSignalPanel — the interpreted-signals half of Hiring & Signals (Screen
// 13). Each card = a strategic read of a competitor's hiring pattern: signal
// headline + plain-language rationale + an impact StatusPill + the competitor
// name + signal-type chips. Aggressive competitor hiring is a competitive risk,
// so impact maps to watch/urgent tones (high → bad), never "positive green".
// Presentational; data arrives via SSR props. Tokens only.

import { StatusPill, type StatusTone } from "@/components/intelligence/StatusPill";
import type { HiringSignalRow } from "@/lib/data/hiring-signals";

// A competitor hiring aggressively is a threat to watch, not an opportunity:
// high → red (urgent), medium → amber (watch), low → neutral.
const IMPACT_TONE: Record<string, StatusTone> = {
  high: "bad",
  medium: "warn",
  low: "neutral",
};

function impactTone(impact: string | undefined): StatusTone {
  if (!impact) return "neutral";
  return IMPACT_TONE[impact] ?? "neutral";
}

function signalTypeLabel(t: string): string {
  return t.replace(/[_-]+/g, " ").toUpperCase();
}

export function HiringSignalPanel({ signals }: { signals: HiringSignalRow[] }) {
  if (signals.length === 0) {
    return (
      <p className="text-sm text-ink-faint">
        No strategic signals interpreted from this week&rsquo;s competitor job
        postings yet.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {signals.map((s, i) => (
        <li
          key={`${s.competitorId}-${i}`}
          className="rounded-card bg-card p-4 shadow-sh1"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">
              {s.competitorName}
            </span>
            {s.impact && (
              <StatusPill
                label={`${s.impact.toUpperCase()} IMPACT`}
                tone={impactTone(s.impact)}
              />
            )}
          </div>

          <h4 className="mt-2 text-sm font-semibold leading-6 text-ink">
            {s.signal}
          </h4>
          <p className="mt-1 text-sm leading-6 text-ink-secondary">
            {s.rationale}
          </p>

          {s.signalTypes.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {s.signalTypes.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-chip bg-base-secondary px-2 py-0.5 font-mono text-[11px] font-medium tracking-wide text-ink-secondary"
                >
                  {signalTypeLabel(t)}
                </span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
