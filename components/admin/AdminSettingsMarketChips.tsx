"use client";

// AdminSettingsMarketChips — market multi-select for the brand-admin Settings
// screen (Screen 20). Mirrors the look of the onboarding MultiSelectChips
// (selected = solid cobalt own-brand fill, unselected = neutral base-secondary)
// without importing it, per file-ownership rules. Presentational + onToggle.

type Option = { value: string; label: string };

type AdminSettingsMarketChipsProps = {
  options: readonly Option[];
  selected: string[];
  onToggle: (value: string) => void;
};

export function AdminSettingsMarketChips({
  options,
  selected,
  onToggle,
}: AdminSettingsMarketChipsProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Markets">
      {options.map((opt) => {
        const isSelected = selected.includes(opt.value);
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
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
