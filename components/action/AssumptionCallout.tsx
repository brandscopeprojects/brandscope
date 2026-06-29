// AssumptionCallout — amber inline warning chip (ui-constraints §7 step 4).
// Flags what is inferred vs directly evidenced. Renders ONLY when flags are non-empty.
// The parent (ActionCard) gates this to LOW/MED confidence; this component just renders
// what it's handed. Sits ABOVE the evidence toggle. Tokens only (amber = watch).

export function AssumptionCallout({ flags }: { flags: string[] }) {
  if (!flags || flags.length === 0) return null;

  return (
    <div
      role="note"
      className="flex gap-2 rounded-chip bg-watch/10 px-3 py-2 text-xs text-watch"
    >
      <span aria-hidden="true" className="leading-5">
        ⚠
      </span>
      <div className="space-y-0.5">
        {flags.map((flag, i) => (
          <p key={i} className="leading-5">
            {flag}
          </p>
        ))}
      </div>
    </div>
  );
}
