// Pure presentational formatters — safe to import from client OR server components
// (no server-only deps). Keep data-fetching helpers in lib/data/* instead.

const MARKET_LABEL: Record<string, string> = {
  nigeria: "Nigeria",
  kenya: "Kenya",
  south_africa: "South Africa",
};

export function marketLabel(market: string): string {
  return MARKET_LABEL[market] ?? market;
}

/** Monday (UTC) of `scanWeek` (YYYY-MM-DD) rendered as "Week of 23 Jun 2026". */
export function formatScanWeek(scanWeek: string): string {
  const d = new Date(`${scanWeek}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return scanWeek;
  return `Week of ${d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })}`;
}
