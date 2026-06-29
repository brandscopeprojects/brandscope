// ProgressChecklist — sequential scan-step checklist (Screen 2, scanning state).
// Dark-screen component. Items reveal one-by-one (~800ms) and tick to "done".
// Cobalt = active/done marker. This is presentational: the parent drives which
// items are revealed/done via the `items` prop.

export type ChecklistItem = {
  label: string;
  state: "pending" | "active" | "done";
};

type ProgressChecklistProps = {
  items: ChecklistItem[];
};

export function ProgressChecklist({ items }: ProgressChecklistProps) {
  return (
    <ul className="flex flex-col gap-2.5" aria-label="Scan progress">
      {items.map((item) => {
        if (item.state === "pending") {
          // Not yet revealed — keep layout calm, render nothing.
          return null;
        }
        const isDone = item.state === "done";
        return (
          <li
            key={item.label}
            className="flex items-center gap-3 text-sm transition-opacity"
          >
            <span
              className={[
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]",
                isDone
                  ? "bg-cobalt text-white"
                  : "border border-cobalt/60 text-cobalt",
              ].join(" ")}
              aria-hidden
            >
              {isDone ? "✓" : "•"}
            </span>
            <span className={isDone ? "text-white/80" : "text-white"}>
              {item.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
