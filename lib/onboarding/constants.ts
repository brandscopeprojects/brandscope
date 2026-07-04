// Shared onboarding constants — safe to import from both client and server
// (no secrets, no server-only deps). Tier type re-exported for the wizard UI.

// Markets are GLOBAL (owner-approved 2026-07). The country dataset (flags,
// regions, DataForSEO location codes, regulatory coverage) lives in
// lib/onboarding/countries.ts — the single source of truth. These re-exports
// keep the original MARKETS/MARKET_REGIONS shape for existing consumers.
import { COUNTRIES, REGION_ORDER } from "./countries";

export const MARKETS = COUNTRIES.map(({ value, label, region }) => ({
  value,
  label,
  region,
}));

export type MarketValue = string;
export const MARKET_VALUES = MARKETS.map((m) => m.value) as readonly string[];

/** Region display order for grouped market pickers. */
export const MARKET_REGIONS = REGION_ORDER;

export type IndustryOption = {
  value: string;
  label: string;
  comingSoon: boolean;
};

// iGaming is the only MVP vertical; the rest are shown disabled ("Coming soon").
// Fintech/FMCG/Telecom are Phase-3 exclusions (mvp-constraints §3).
export const INDUSTRIES: IndustryOption[] = [
  { value: "igaming", label: "iGaming", comingSoon: false },
  { value: "fintech", label: "Fintech", comingSoon: true },
  { value: "fmcg", label: "FMCG", comingSoon: true },
  { value: "telecom", label: "Telecom", comingSoon: true },
  { value: "ecommerce", label: "E-commerce", comingSoon: true },
];

export const COMPETITOR_TIERS = [
  { value: "dominant", label: "Dominant" },
  { value: "challenger", label: "Challenger" },
  { value: "mid_market", label: "Mid-market" },
  { value: "niche", label: "Niche" },
] as const;

export type TierValue = (typeof COMPETITOR_TIERS)[number]["value"];

// Competitor cap (CLAUDE.md Decision 1): default starting point 5, max 10.
export const COMPETITOR_DEFAULT_COUNT = 5;
export const COMPETITOR_MAX = 10;

