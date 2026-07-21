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

export const EMPTY_ONBOARDING_SUGGESTION: OnboardingSuggestion = {
  name: null,
  markets: [],
  competitors: [],
};

/** A typed detection outcome so the UI can tell a real failure from an empty
 *  result — the two must NOT collapse into one message. */
export type SuggestionResult =
  | { status: "success"; suggestions: OnboardingSuggestion; requestId?: string }
  | { status: "empty"; suggestions: OnboardingSuggestion; message?: string; requestId?: string }
  | { status: "error"; suggestions: OnboardingSuggestion; message: string; requestId?: string };

const GENERIC_ERROR = "Competitor detection failed. Please retry or add competitors manually.";

/** Classify a (already-validated) suggestion into a typed UI state. Pure — no I/O.
 *  `errored` = the request itself failed (network/backend/timeout); otherwise an
 *  all-empty suggestion is a legitimate "empty", never an error. We never surface a
 *  raw backend error string to the user — only a generic message + the requestId. */
export function classifyOnboardingSuggestion(args: {
  errored?: boolean;
  requestId?: string;
  suggestions?: OnboardingSuggestion;
}): SuggestionResult {
  if (args.errored) {
    return { status: "error", suggestions: EMPTY_ONBOARDING_SUGGESTION, message: GENERIC_ERROR, requestId: args.requestId };
  }
  const s = args.suggestions ?? EMPTY_ONBOARDING_SUGGESTION;
  if (s.markets.length === 0 && s.competitors.length === 0) {
    return { status: "empty", suggestions: s, requestId: args.requestId };
  }
  return { status: "success", suggestions: s, requestId: args.requestId };
}
