// GeoAIVisibilityScore — hero card for the GEO page (Screen 14, ui-constraints
// §6/§12). The AI Visibility Score IS the own-brand metric, so cobalt is correct
// here (the single brand accent). Big Syne 800 N/100 + week-over-week trend.
// Presentational. Tokens only.

import { WoWIndicator } from "@/components/intelligence/WoWIndicator";

export function GeoAIVisibilityScore({
  score,
  trend,
}: {
  score: number | null;
  trend: number | null;
}) {
  return (
    <section className="rounded-card bg-card p-6 shadow-sh1">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
        AI visibility score
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
        <p className="font-display text-5xl font-extrabold leading-none text-cobalt">
          {score != null ? Math.round(score) : "—"}
          <span className="text-2xl text-ink-faint">/100</span>
        </p>
        {trend != null && trend !== 0 && (
          <div className="pb-1">
            <WoWIndicator delta={Math.round(trend)} />
          </div>
        )}
      </div>
      <p className="mt-3 max-w-md text-sm leading-6 text-ink-secondary">
        How often AI assistants mention your brand when answering buyer questions,
        across ChatGPT, Claude, Gemini and Perplexity.
      </p>
    </section>
  );
}
