// KeywordLandscape — the keyword-centric ranking view for Traffic & SEO.
// Mobile-first: one CARD per searched keyword (stacked on phones, 2–3 cols on
// desktop), because a keyword × competitor matrix is unusable on a small screen.
// Each card answers "for this real, high-volume term, where do I rank vs my
// rivals?": search volume, the brand's own rank (colour-coded), and a chip row
// of competitors with their positions. Presentational; tokens only.

import type { KeywordLandscapeRow } from "@/lib/data/traffic-seo";

/** Compact volume: 14800 → "14.8k", 1000 → "1k", 170 → "170", null → "—". */
function fmtVol(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1000) {
    const k = v / 1000;
    return `${k >= 10 || Number.isInteger(k) ? Math.round(k) : k.toFixed(1)}k`;
  }
  return String(v);
}

/** Rank → label + colour: green top-3, amber 4–10, grey deeper / not ranking. */
function rankTone(rank: number | null): { label: string; cls: string } {
  if (rank == null) return { label: "Not ranking", cls: "bg-base-secondary text-ink-faint" };
  if (rank <= 3) return { label: `#${rank}`, cls: "bg-opportunity/12 text-opportunity" };
  if (rank <= 10) return { label: `#${rank}`, cls: "bg-watch/12 text-watch" };
  return { label: `#${rank}`, cls: "bg-base-secondary text-ink-secondary" };
}

export function KeywordLandscape({ rows }: { rows: KeywordLandscapeRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-divider bg-card p-6 text-center text-sm text-ink-secondary">
        No ranked keywords in this week&rsquo;s scan yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => {
        const you = rankTone(r.brandRank);
        return (
          <div
            key={r.keyword}
            className="flex flex-col gap-3 rounded-card border border-divider bg-card p-4 shadow-sh1"
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className="min-w-0 flex-1 truncate text-sm font-medium capitalize text-ink"
                title={r.keyword}
              >
                {r.keyword}
              </span>
              <span
                className="shrink-0 rounded-chip bg-base-secondary px-2 py-0.5 font-mono text-[0.65rem] text-ink-secondary"
                title="Monthly Google searches"
              >
                {fmtVol(r.volume)}
                <span className="text-ink-faint">/mo</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-secondary">You</span>
              <span className={`rounded-chip px-2 py-0.5 font-mono text-xs font-medium ${you.cls}`}>
                {you.label}
              </span>
            </div>

            {r.competitors.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-t border-divider pt-2.5">
                {r.competitors.slice(0, 5).map((c) => {
                  // A rival ranking ABOVE you (or you're absent) → emphasised.
                  const ahead = r.brandRank == null || c.rank < r.brandRank;
                  return (
                    <span
                      key={c.name}
                      className={`inline-flex items-center gap-1 rounded-chip px-1.5 py-0.5 text-[0.7rem] ${
                        ahead ? "bg-urgent/[0.08] text-ink" : "bg-base-secondary text-ink-secondary"
                      }`}
                    >
                      <span className="max-w-[8rem] truncate">{c.name}</span>
                      <span className="font-mono text-ink-faint">#{c.rank}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
