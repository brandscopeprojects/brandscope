// TechStackChips — renders a string[] of detected technologies as neutral chips
// (ui-constraints §12 "chips for tags"). Neutral grey only — these are factual
// detections, not status, so no status colour. When the list is empty, renders a
// faint em-dash so table cells stay aligned. Presentational. Tokens only.

export function TechStackChips({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <span className="text-ink-faint">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center rounded-chip bg-base-secondary px-2 py-0.5 font-mono text-[11px] text-ink-secondary"
        >
          {item}
        </span>
      ))}
    </div>
  );
}
