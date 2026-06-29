// GeoCompetitorScores — AI visibility comparison: your brand vs competitors
// (Screen 14). Horizontal bars sorted high→low; the own-brand row is cobalt
// (the single brand accent, ui-constraints §2.2), competitors are neutral grey.
// Score (Syne mono-feel) on the right. Presentational. Tokens only.

import type { CompetitorAIScore } from "@/lib/data/geo";

type Row = { name: string; score: number; isOwnBrand: boolean };

export function GeoCompetitorScores({
  brandName,
  brandScore,
  competitors,
}: {
  brandName: string;
  brandScore: number | null;
  competitors: CompetitorAIScore[];
}) {
  const rows: Row[] = [
    ...(brandScore != null
      ? [{ name: brandName, score: brandScore, isOwnBrand: true }]
      : []),
    ...competitors.map((c) => ({
      name: c.competitorName,
      score: c.score,
      isOwnBrand: false,
    })),
  ].sort((a, b) => b.score - a.score);

  if (rows.length === 0) return null;

  const max = Math.max(...rows.map((r) => r.score), 100);

  return (
    <section className="rounded-card bg-card p-5 shadow-sh1">
      <h3 className="mb-4 text-sm font-semibold text-ink">
        AI visibility vs competitors
      </h3>
      <ul className="space-y-3">
        {rows.map((r) => {
          const pct = max > 0 ? Math.max(2, Math.round((r.score / max) * 100)) : 0;
          return (
            <li key={r.name} className="flex items-center gap-3">
              <span
                className={[
                  "w-32 shrink-0 truncate text-sm",
                  r.isOwnBrand ? "font-semibold text-ink" : "text-ink-secondary",
                ].join(" ")}
                title={r.name}
              >
                {r.name}
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-chip bg-base-secondary">
                <div
                  className={[
                    "h-full rounded-chip",
                    r.isOwnBrand ? "bg-cobalt" : "bg-ink-faint",
                  ].join(" ")}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span
                className={[
                  "w-10 shrink-0 text-right font-mono text-sm",
                  r.isOwnBrand ? "text-cobalt" : "text-ink",
                ].join(" ")}
              >
                {Math.round(r.score)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
