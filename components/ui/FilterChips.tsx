"use client";

// FilterChips — filter-chip row above the action feed (ui-constraints §11.1).
// Pill-shaped, status-tinted at low opacity, solid fill when active. Live counts.
// (All · Urgent · Watch · Opportunity [· Completed]).
// Tokens only — status tints via /15 opacity utilities on the status tokens.

import type { FilterChip, FilterStatus } from "@/types/view-models";

// Per-status styling: active = solid fill + white text; inactive = low-opacity tint.
// "all" and "completed" are neutral (no status colour); "completed" stays neutral too.
const ACTIVE_STYLE: Record<FilterStatus, string> = {
  all: "bg-ink text-white",
  urgent: "bg-urgent text-white",
  watch: "bg-watch text-white",
  opportunity: "bg-opportunity text-white",
  completed: "bg-ink-secondary text-white",
};

const INACTIVE_STYLE: Record<FilterStatus, string> = {
  all: "bg-base-secondary text-ink-secondary hover:text-ink",
  urgent: "bg-urgent/10 text-urgent hover:bg-urgent/15",
  watch: "bg-watch/10 text-watch hover:bg-watch/15",
  opportunity: "bg-opportunity/10 text-opportunity hover:bg-opportunity/15",
  completed: "bg-base-secondary text-ink-secondary hover:text-ink",
};

export function FilterChips({
  filters,
  active,
  onChange,
}: {
  filters: FilterChip[];
  active: FilterStatus;
  onChange: (status: FilterStatus) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Filter actions"
    >
      {filters.map((chip) => {
        const isActive = chip.status === active;
        return (
          <button
            key={chip.status}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(chip.status)}
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              isActive ? ACTIVE_STYLE[chip.status] : INACTIVE_STYLE[chip.status],
            ].join(" ")}
          >
            <span>{chip.label}</span>
            <span
              className={[
                "font-mono text-[11px]",
                isActive ? "text-white/80" : "opacity-70",
              ].join(" ")}
            >
              {chip.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
