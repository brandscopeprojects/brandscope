"use client";

// MultiSelectChips — market multi-select (Screen 1, Step 2).
// Pill chips; selected = solid cobalt fill (own-brand accent), unselected = neutral.
// At least one selection is required (enforced by the wizard, not here).

type Option = { value: string; label: string };

type MultiSelectChipsProps = {
  options: readonly Option[];
  selected: string[];
  onToggle: (value: string) => void;
  /** Values the setup agent detected as the brand's territory — get a ✦ marker + ring. */
  suggested?: string[];
};

export function MultiSelectChips({
  options,
  selected,
  onToggle,
  suggested = [],
}: MultiSelectChipsProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Markets">
      {options.map((opt) => {
        const isSelected = selected.includes(opt.value);
        const isSuggested = suggested.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onToggle(opt.value)}
            className={[
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              isSelected
                ? "bg-cobalt text-white"
                : "bg-base-secondary text-ink-secondary hover:text-ink",
              isSuggested && !isSelected ? "ring-2 ring-cobalt/50" : "",
            ].join(" ")}
          >
            {isSuggested ? "✦ " : ""}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
