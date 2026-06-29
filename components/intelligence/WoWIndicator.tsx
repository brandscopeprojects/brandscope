// WoWIndicator — week-over-week delta chip (ui-constraints §12). ▲ green for
// improvement, ▼ red for decline. `inverse` flips the colour logic for metrics
// where down is good (complaints, threat, cost). Mono numerals. Tokens only.

export function WoWIndicator({
  delta,
  inverse = false,
  suffix = "",
}: {
  delta: number;
  inverse?: boolean;
  suffix?: string;
}) {
  const up = delta > 0;
  // "Good" = up unless inverse, in which case good = down.
  const good = inverse ? delta < 0 : delta > 0;
  const colour = good ? "text-opportunity" : "text-urgent";
  return (
    <span className={`font-mono text-xs font-medium ${colour}`}>
      {up ? "▲" : "▼"} {Math.abs(delta)}
      {suffix} <span className="text-ink-faint">WoW</span>
    </span>
  );
}
