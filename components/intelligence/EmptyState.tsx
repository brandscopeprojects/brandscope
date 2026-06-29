// EmptyState — the canonical "no data yet" panel for intelligence pages.
// CLAUDE.md hard rule: never fabricate data inside a v1 page. Before the first
// weekly scan populates the *_cache tables, every intelligence module renders
// this honest empty state instead of placeholder numbers.
//
// Two intents:
//   - "scanning"  → first scan still running (pulsing cobalt dot)
//   - "phase2"    → a sub-section deliberately deferred (e.g. social needs Apify)
// Presentational. Tokens only.

export function EmptyState({
  title,
  message,
  intent = "scanning",
}: {
  title: string;
  message: string;
  intent?: "scanning" | "phase2";
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-divider bg-card/50 px-6 py-12 text-center">
      {intent === "scanning" ? (
        <span
          className="mb-4 h-2.5 w-2.5 animate-brand-pulse rounded-full bg-cobalt"
          aria-hidden
        />
      ) : (
        <span className="mb-3 rounded-chip bg-base-secondary px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">
          Phase 2
        </span>
      )}
      <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-6 text-ink-secondary">{message}</p>
    </div>
  );
}
