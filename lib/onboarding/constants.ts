// Shared onboarding constants — safe to import from both client and server
// (no secrets, no server-only deps). Tier type re-exported for the wizard UI.

// African markets where iGaming / sports betting is legal and regulated (incl.
// state-licensed monopolies, e.g. Morocco/Tunisia). Gambling is banned in
// Somalia, Libya, Mauritania, Sudan and South Sudan — those are deliberately
// absent. Values are stored in brands.market; the DataForSEO location map in
// supabase/functions/_shared/dataforseo.ts MUST stay in sync with these values.
export const MARKETS = [
  // West Africa
  { value: "nigeria", label: "Nigeria", region: "West Africa" },
  { value: "ghana", label: "Ghana", region: "West Africa" },
  { value: "senegal", label: "Senegal", region: "West Africa" },
  { value: "cote_divoire", label: "Côte d'Ivoire", region: "West Africa" },
  { value: "benin", label: "Benin", region: "West Africa" },
  { value: "burkina_faso", label: "Burkina Faso", region: "West Africa" },
  { value: "mali", label: "Mali", region: "West Africa" },
  { value: "niger", label: "Niger", region: "West Africa" },
  { value: "togo", label: "Togo", region: "West Africa" },
  { value: "sierra_leone", label: "Sierra Leone", region: "West Africa" },
  { value: "liberia", label: "Liberia", region: "West Africa" },
  { value: "gambia", label: "Gambia", region: "West Africa" },
  { value: "guinea", label: "Guinea", region: "West Africa" },
  { value: "cape_verde", label: "Cape Verde", region: "West Africa" },
  // East Africa
  { value: "kenya", label: "Kenya", region: "East Africa" },
  { value: "uganda", label: "Uganda", region: "East Africa" },
  { value: "tanzania", label: "Tanzania", region: "East Africa" },
  { value: "rwanda", label: "Rwanda", region: "East Africa" },
  { value: "burundi", label: "Burundi", region: "East Africa" },
  { value: "ethiopia", label: "Ethiopia", region: "East Africa" },
  // Southern Africa
  { value: "south_africa", label: "South Africa", region: "Southern Africa" },
  { value: "zambia", label: "Zambia", region: "Southern Africa" },
  { value: "zimbabwe", label: "Zimbabwe", region: "Southern Africa" },
  { value: "malawi", label: "Malawi", region: "Southern Africa" },
  { value: "mozambique", label: "Mozambique", region: "Southern Africa" },
  { value: "botswana", label: "Botswana", region: "Southern Africa" },
  { value: "namibia", label: "Namibia", region: "Southern Africa" },
  { value: "lesotho", label: "Lesotho", region: "Southern Africa" },
  { value: "eswatini", label: "Eswatini", region: "Southern Africa" },
  { value: "angola", label: "Angola", region: "Southern Africa" },
  // Central Africa
  { value: "cameroon", label: "Cameroon", region: "Central Africa" },
  { value: "dr_congo", label: "DR Congo", region: "Central Africa" },
  { value: "congo_republic", label: "Congo Republic", region: "Central Africa" },
  { value: "gabon", label: "Gabon", region: "Central Africa" },
  { value: "chad", label: "Chad", region: "Central Africa" },
  // Indian Ocean
  { value: "mauritius", label: "Mauritius", region: "Indian Ocean" },
  { value: "madagascar", label: "Madagascar", region: "Indian Ocean" },
  { value: "seychelles", label: "Seychelles", region: "Indian Ocean" },
  // North Africa (state-licensed betting)
  { value: "morocco", label: "Morocco", region: "North Africa" },
  { value: "tunisia", label: "Tunisia", region: "North Africa" },
] as const;

export type MarketValue = (typeof MARKETS)[number]["value"];
export const MARKET_VALUES = MARKETS.map((m) => m.value) as readonly string[];

/** Region display order for grouped market pickers. */
export const MARKET_REGIONS = [
  "West Africa",
  "East Africa",
  "Southern Africa",
  "Central Africa",
  "Indian Ocean",
  "North Africa",
] as const;

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

export const ONBOARDING_STEPS = [
  "Brand",
  "Markets",
  "Industry",
  "Competitors",
  "Confirm",
] as const;
