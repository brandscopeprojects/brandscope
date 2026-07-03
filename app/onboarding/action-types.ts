// Plain (non-"use server") module: types + re-exports the onboarding server action
// file needs. A "use server" file may only export async functions, so shared
// constants/types live here.

import type { CompetitorTier } from "@/lib/data/competitor-tier";

export { COMPETITOR_MAX, MARKET_VALUES } from "@/lib/onboarding/constants";

export type DetectedBrandResult = {
  domain: string;
  name: string;
  tier: CompetitorTier;
};

/** Setup-agent output (onboarding-suggest Edge Function). Best-effort — empty on failure. */
export type OnboardingSuggestion = {
  name: string | null;
  markets: string[];
  competitors: Array<{ domain: string; name: string; tier: CompetitorTier }>;
};
