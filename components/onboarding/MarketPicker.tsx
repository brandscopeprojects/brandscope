"use client";

// MarketPicker — the full African market list (lib/onboarding/constants.ts
// MARKETS) grouped by region, with the setup agent's detected territory
// highlighted (✦). Used on the onboarding Market step and in brand settings.

import { MARKETS, MARKET_REGIONS } from "@/lib/onboarding/constants";
import { MultiSelectChips } from "./MultiSelectChips";

type MarketPickerProps = {
  selected: string[];
  onToggle: (value: string) => void;
  /** Markets the setup agent detected for this brand (highlighted, pre-selected by caller). */
  suggested?: string[];
};

export function MarketPicker({ selected, onToggle, suggested = [] }: MarketPickerProps) {
  return (
    <div className="flex flex-col gap-4">
      {MARKET_REGIONS.map((region) => {
        const options = MARKETS.filter((m) => m.region === region);
        if (options.length === 0) return null;
        return (
          <div key={region}>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
              {region}
            </p>
            <MultiSelectChips
              options={options}
              selected={selected}
              onToggle={onToggle}
              suggested={suggested}
            />
          </div>
        );
      })}
    </div>
  );
}
