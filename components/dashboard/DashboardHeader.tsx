// DashboardHeader — title block for the dashboard (ui-constraints §4 page header).
// Presentational: brand name (Syne), market chips, the scan week (mono), and the
// AI-visibility headline stat. Tokens only.

function formatScanWeek(scanWeek: string): string {
  // scanWeek is a YYYY-MM-DD (Monday). Render as "Week of 23 Jun 2026".
  const d = new Date(`${scanWeek}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return scanWeek;
  return `Week of ${d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })}`;
}

const MARKET_LABEL: Record<string, string> = {
  nigeria: "Nigeria",
  kenya: "Kenya",
  south_africa: "South Africa",
};

export function DashboardHeader({
  brandName,
  markets,
  scanWeek,
  aiVisibility,
}: {
  brandName: string;
  markets: string[];
  scanWeek: string | null;
  aiVisibility: { score: number | null; trend: number | null };
}) {
  const { score, trend } = aiVisibility;
  const trendUp = trend != null && trend > 0;
  const trendDown = trend != null && trend < 0;

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {markets.map((m) => (
            <span
              key={m}
              className="rounded-chip bg-base-secondary px-2 py-0.5 text-xs font-medium text-ink-secondary"
            >
              {MARKET_LABEL[m] ?? m}
            </span>
          ))}
          {scanWeek && (
            <span className="font-mono text-xs text-ink-faint">
              {formatScanWeek(scanWeek)}
            </span>
          )}
        </div>
        <h1 className="font-display text-2xl font-bold text-ink">{brandName}</h1>
      </div>

      {score != null && (
        <div className="text-right">
          <p className="text-xs text-ink-secondary">AI visibility</p>
          <p className="font-display text-3xl font-bold leading-none text-cobalt">
            {Math.round(score)}
            <span className="text-lg text-ink-faint">/100</span>
          </p>
          {trend != null && trend !== 0 && (
            <p
              className={[
                "mt-0.5 font-mono text-xs",
                trendUp ? "text-opportunity" : trendDown ? "text-urgent" : "text-ink-faint",
              ].join(" ")}
            >
              {trendUp ? "▲" : "▼"} {Math.abs(Math.round(trend))} vs last week
            </p>
          )}
        </div>
      )}
    </header>
  );
}
