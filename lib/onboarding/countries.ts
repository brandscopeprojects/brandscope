// countries.ts — SINGLE SOURCE OF TRUTH for the global market list (owner-approved
// 2026-07: markets are global, not constrained to Africa). Safe for client + server
// (no secrets). Consumed by:
//   - lib/onboarding/constants.ts  (MARKETS / MARKET_REGIONS re-exports)
//   - components/onboarding/MarketCombobox.tsx (picker UI)
//   - scripts/generate-market-maps.mjs → GENERATES the edge-function literals in
//     supabase/functions/_shared/dataforseo.ts (MARKET_LOCATION) and
//     supabase/functions/onboarding-suggest (ALLOWED_MARKETS). Re-run it after any
//     change here and redeploy those functions.
//
// Invariants:
//   - `value` slugs are stored in brands.market — NEVER rename an existing slug.
//     The 40 original African slugs (nigeria … tunisia) are frozen.
//   - locationCode = 2000 + ISO 3166-1 numeric (Google geotarget country criteria
//     IDs, which DataForSEO uses verbatim).
//   - Regulatory corpus coverage is per-market curated knowledge (regulator docs
//     ingestion). Markets outside REGULATORY_COVERED get an honest "limited
//     regulatory coverage" hint at selection time — never fake scores.

export const REGION_ORDER = [
  "West Africa",
  "East Africa",
  "Southern Africa",
  "Central Africa",
  "Indian Ocean",
  "North Africa",
  "Europe",
  "Middle East",
  "North America",
  "Central America & Caribbean",
  "South America",
  "Central & South Asia",
  "East Asia",
  "Southeast Asia",
  "Oceania",
] as const;

export type Region = (typeof REGION_ORDER)[number];

/** Markets with a curated regulator corpus (mvp-module-sources.md §7). */
export const REGULATORY_COVERED: ReadonlySet<string> = new Set([
  "nigeria",
  "kenya",
  "south_africa",
]);

// [iso2, isoNumeric, displayName, region] — slug is derived from displayName
// (lowercase, diacritics stripped, apostrophes dropped, non-alnum → "_").
type Raw = readonly [string, number, string, Region];

const RAW: readonly Raw[] = [
  // ── West Africa (original slugs frozen) ─────────────────────────────────
  ["NG", 566, "Nigeria", "West Africa"],
  ["GH", 288, "Ghana", "West Africa"],
  ["SN", 686, "Senegal", "West Africa"],
  ["CI", 384, "Côte d'Ivoire", "West Africa"],
  ["BJ", 204, "Benin", "West Africa"],
  ["BF", 854, "Burkina Faso", "West Africa"],
  ["ML", 466, "Mali", "West Africa"],
  ["NE", 562, "Niger", "West Africa"],
  ["TG", 768, "Togo", "West Africa"],
  ["SL", 694, "Sierra Leone", "West Africa"],
  ["LR", 430, "Liberia", "West Africa"],
  ["GM", 270, "Gambia", "West Africa"],
  ["GN", 324, "Guinea", "West Africa"],
  ["CV", 132, "Cape Verde", "West Africa"],
  ["GW", 624, "Guinea-Bissau", "West Africa"],
  ["MR", 478, "Mauritania", "West Africa"],
  // ── East Africa ──────────────────────────────────────────────────────────
  ["KE", 404, "Kenya", "East Africa"],
  ["UG", 800, "Uganda", "East Africa"],
  ["TZ", 834, "Tanzania", "East Africa"],
  ["RW", 646, "Rwanda", "East Africa"],
  ["BI", 108, "Burundi", "East Africa"],
  ["ET", 231, "Ethiopia", "East Africa"],
  ["SO", 706, "Somalia", "East Africa"],
  ["SS", 728, "South Sudan", "East Africa"],
  ["DJ", 262, "Djibouti", "East Africa"],
  ["ER", 232, "Eritrea", "East Africa"],
  // ── Southern Africa ──────────────────────────────────────────────────────
  ["ZA", 710, "South Africa", "Southern Africa"],
  ["ZM", 894, "Zambia", "Southern Africa"],
  ["ZW", 716, "Zimbabwe", "Southern Africa"],
  ["MW", 454, "Malawi", "Southern Africa"],
  ["MZ", 508, "Mozambique", "Southern Africa"],
  ["BW", 72, "Botswana", "Southern Africa"],
  ["NA", 516, "Namibia", "Southern Africa"],
  ["LS", 426, "Lesotho", "Southern Africa"],
  ["SZ", 748, "Eswatini", "Southern Africa"],
  ["AO", 24, "Angola", "Southern Africa"],
  // ── Central Africa ───────────────────────────────────────────────────────
  ["CM", 120, "Cameroon", "Central Africa"],
  ["CD", 180, "DR Congo", "Central Africa"],
  ["CG", 178, "Congo Republic", "Central Africa"],
  ["GA", 266, "Gabon", "Central Africa"],
  ["TD", 148, "Chad", "Central Africa"],
  ["CF", 140, "Central African Republic", "Central Africa"],
  ["GQ", 226, "Equatorial Guinea", "Central Africa"],
  ["ST", 678, "São Tomé and Príncipe", "Central Africa"],
  // ── Indian Ocean ─────────────────────────────────────────────────────────
  ["MU", 480, "Mauritius", "Indian Ocean"],
  ["MG", 450, "Madagascar", "Indian Ocean"],
  ["SC", 690, "Seychelles", "Indian Ocean"],
  ["KM", 174, "Comoros", "Indian Ocean"],
  // ── North Africa ─────────────────────────────────────────────────────────
  ["MA", 504, "Morocco", "North Africa"],
  ["TN", 788, "Tunisia", "North Africa"],
  ["EG", 818, "Egypt", "North Africa"],
  ["DZ", 12, "Algeria", "North Africa"],
  ["LY", 434, "Libya", "North Africa"],
  ["SD", 729, "Sudan", "North Africa"],
  // ── Europe ───────────────────────────────────────────────────────────────
  ["GB", 826, "United Kingdom", "Europe"],
  ["IE", 372, "Ireland", "Europe"],
  ["FR", 250, "France", "Europe"],
  ["DE", 276, "Germany", "Europe"],
  ["NL", 528, "Netherlands", "Europe"],
  ["BE", 56, "Belgium", "Europe"],
  ["LU", 442, "Luxembourg", "Europe"],
  ["ES", 724, "Spain", "Europe"],
  ["PT", 620, "Portugal", "Europe"],
  ["IT", 380, "Italy", "Europe"],
  ["MT", 470, "Malta", "Europe"],
  ["CH", 756, "Switzerland", "Europe"],
  ["AT", 40, "Austria", "Europe"],
  ["DK", 208, "Denmark", "Europe"],
  ["SE", 752, "Sweden", "Europe"],
  ["NO", 578, "Norway", "Europe"],
  ["FI", 246, "Finland", "Europe"],
  ["IS", 352, "Iceland", "Europe"],
  ["PL", 616, "Poland", "Europe"],
  ["CZ", 203, "Czechia", "Europe"],
  ["SK", 703, "Slovakia", "Europe"],
  ["HU", 348, "Hungary", "Europe"],
  ["RO", 642, "Romania", "Europe"],
  ["BG", 100, "Bulgaria", "Europe"],
  ["GR", 300, "Greece", "Europe"],
  ["CY", 196, "Cyprus", "Europe"],
  ["HR", 191, "Croatia", "Europe"],
  ["SI", 705, "Slovenia", "Europe"],
  ["RS", 688, "Serbia", "Europe"],
  ["BA", 70, "Bosnia and Herzegovina", "Europe"],
  ["MK", 807, "North Macedonia", "Europe"],
  ["AL", 8, "Albania", "Europe"],
  ["ME", 499, "Montenegro", "Europe"],
  ["EE", 233, "Estonia", "Europe"],
  ["LV", 428, "Latvia", "Europe"],
  ["LT", 440, "Lithuania", "Europe"],
  ["UA", 804, "Ukraine", "Europe"],
  ["MD", 498, "Moldova", "Europe"],
  ["BY", 112, "Belarus", "Europe"],
  ["GE", 268, "Georgia", "Europe"],
  ["AM", 51, "Armenia", "Europe"],
  ["AZ", 31, "Azerbaijan", "Europe"],
  ["RU", 643, "Russia", "Europe"],
  ["MC", 492, "Monaco", "Europe"],
  ["LI", 438, "Liechtenstein", "Europe"],
  ["AD", 20, "Andorra", "Europe"],
  ["SM", 674, "San Marino", "Europe"],
  ["GI", 292, "Gibraltar", "Europe"],
  ["IM", 833, "Isle of Man", "Europe"],
  // ── Middle East ──────────────────────────────────────────────────────────
  ["TR", 792, "Turkey", "Middle East"],
  ["IL", 376, "Israel", "Middle East"],
  ["SA", 682, "Saudi Arabia", "Middle East"],
  ["AE", 784, "United Arab Emirates", "Middle East"],
  ["QA", 634, "Qatar", "Middle East"],
  ["KW", 414, "Kuwait", "Middle East"],
  ["BH", 48, "Bahrain", "Middle East"],
  ["OM", 512, "Oman", "Middle East"],
  ["JO", 400, "Jordan", "Middle East"],
  ["LB", 422, "Lebanon", "Middle East"],
  ["IQ", 368, "Iraq", "Middle East"],
  ["IR", 364, "Iran", "Middle East"],
  ["SY", 760, "Syria", "Middle East"],
  ["YE", 887, "Yemen", "Middle East"],
  ["PS", 275, "Palestine", "Middle East"],
  // ── North America ────────────────────────────────────────────────────────
  ["US", 840, "United States", "North America"],
  ["CA", 124, "Canada", "North America"],
  ["MX", 484, "Mexico", "North America"],
  // ── Central America & Caribbean ──────────────────────────────────────────
  ["GT", 320, "Guatemala", "Central America & Caribbean"],
  ["BZ", 84, "Belize", "Central America & Caribbean"],
  ["HN", 340, "Honduras", "Central America & Caribbean"],
  ["SV", 222, "El Salvador", "Central America & Caribbean"],
  ["NI", 558, "Nicaragua", "Central America & Caribbean"],
  ["CR", 188, "Costa Rica", "Central America & Caribbean"],
  ["PA", 591, "Panama", "Central America & Caribbean"],
  ["CU", 192, "Cuba", "Central America & Caribbean"],
  ["DO", 214, "Dominican Republic", "Central America & Caribbean"],
  ["HT", 332, "Haiti", "Central America & Caribbean"],
  ["JM", 388, "Jamaica", "Central America & Caribbean"],
  ["TT", 780, "Trinidad and Tobago", "Central America & Caribbean"],
  ["BB", 52, "Barbados", "Central America & Caribbean"],
  ["BS", 44, "Bahamas", "Central America & Caribbean"],
  ["LC", 662, "Saint Lucia", "Central America & Caribbean"],
  ["GD", 308, "Grenada", "Central America & Caribbean"],
  ["VC", 670, "Saint Vincent and the Grenadines", "Central America & Caribbean"],
  ["AG", 28, "Antigua and Barbuda", "Central America & Caribbean"],
  ["KN", 659, "Saint Kitts and Nevis", "Central America & Caribbean"],
  ["DM", 212, "Dominica", "Central America & Caribbean"],
  ["CW", 531, "Curaçao", "Central America & Caribbean"],
  // ── South America ────────────────────────────────────────────────────────
  ["BR", 76, "Brazil", "South America"],
  ["CO", 170, "Colombia", "South America"],
  ["AR", 32, "Argentina", "South America"],
  ["CL", 152, "Chile", "South America"],
  ["PE", 604, "Peru", "South America"],
  ["EC", 218, "Ecuador", "South America"],
  ["VE", 862, "Venezuela", "South America"],
  ["BO", 68, "Bolivia", "South America"],
  ["PY", 600, "Paraguay", "South America"],
  ["UY", 858, "Uruguay", "South America"],
  ["GY", 328, "Guyana", "South America"],
  ["SR", 740, "Suriname", "South America"],
  // ── Central & South Asia ─────────────────────────────────────────────────
  ["KZ", 398, "Kazakhstan", "Central & South Asia"],
  ["UZ", 860, "Uzbekistan", "Central & South Asia"],
  ["TM", 795, "Turkmenistan", "Central & South Asia"],
  ["KG", 417, "Kyrgyzstan", "Central & South Asia"],
  ["TJ", 762, "Tajikistan", "Central & South Asia"],
  ["AF", 4, "Afghanistan", "Central & South Asia"],
  ["PK", 586, "Pakistan", "Central & South Asia"],
  ["IN", 356, "India", "Central & South Asia"],
  ["BD", 50, "Bangladesh", "Central & South Asia"],
  ["LK", 144, "Sri Lanka", "Central & South Asia"],
  ["NP", 524, "Nepal", "Central & South Asia"],
  ["BT", 64, "Bhutan", "Central & South Asia"],
  ["MV", 462, "Maldives", "Central & South Asia"],
  // ── East Asia ────────────────────────────────────────────────────────────
  ["CN", 156, "China", "East Asia"],
  ["JP", 392, "Japan", "East Asia"],
  ["KR", 410, "South Korea", "East Asia"],
  ["TW", 158, "Taiwan", "East Asia"],
  ["HK", 344, "Hong Kong", "East Asia"],
  ["MO", 446, "Macau", "East Asia"],
  ["MN", 496, "Mongolia", "East Asia"],
  // ── Southeast Asia ───────────────────────────────────────────────────────
  ["TH", 764, "Thailand", "Southeast Asia"],
  ["VN", 704, "Vietnam", "Southeast Asia"],
  ["PH", 608, "Philippines", "Southeast Asia"],
  ["ID", 360, "Indonesia", "Southeast Asia"],
  ["MY", 458, "Malaysia", "Southeast Asia"],
  ["SG", 702, "Singapore", "Southeast Asia"],
  ["KH", 116, "Cambodia", "Southeast Asia"],
  ["LA", 418, "Laos", "Southeast Asia"],
  ["MM", 104, "Myanmar", "Southeast Asia"],
  ["BN", 96, "Brunei", "Southeast Asia"],
  ["TL", 626, "Timor-Leste", "Southeast Asia"],
  // ── Oceania ──────────────────────────────────────────────────────────────
  ["AU", 36, "Australia", "Oceania"],
  ["NZ", 554, "New Zealand", "Oceania"],
  ["FJ", 242, "Fiji", "Oceania"],
  ["PG", 598, "Papua New Guinea", "Oceania"],
  ["SB", 90, "Solomon Islands", "Oceania"],
  ["VU", 548, "Vanuatu", "Oceania"],
  ["WS", 882, "Samoa", "Oceania"],
  ["TO", 776, "Tonga", "Oceania"],
  ["KI", 296, "Kiribati", "Oceania"],
  ["FM", 583, "Micronesia", "Oceania"],
  ["MH", 584, "Marshall Islands", "Oceania"],
  ["PW", 585, "Palau", "Oceania"],
  ["NR", 520, "Nauru", "Oceania"],
  ["TV", 798, "Tuvalu", "Oceania"],
];

/** displayName → stored slug. Deterministic; frozen once a slug ships. */
export function slugifyMarket(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics (Côte → Cote)
    .replace(/['’]/g, "") // drop apostrophes (d'Ivoire → dIvoire)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** iso2 → flag emoji (regional indicator pair). */
export function flagEmoji(iso2: string): string {
  return String.fromCodePoint(
    ...iso2.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

export type Country = {
  /** Stored in brands.market — frozen once shipped. */
  value: string;
  label: string;
  region: Region;
  iso2: string;
  flag: string;
  /** DataForSEO / Google geotarget country criteria ID (2000 + ISO numeric). */
  locationCode: number;
  /** Regulatory corpus coverage (curated regulator sources exist). */
  regulatoryCovered: boolean;
};

export const COUNTRIES: readonly Country[] = RAW.map(([iso2, num, label, region]) => {
  const value = slugifyMarket(label);
  return {
    value,
    label,
    region,
    iso2,
    flag: flagEmoji(iso2),
    locationCode: 2000 + num,
    regulatoryCovered: REGULATORY_COVERED.has(value),
  };
});

export const COUNTRY_BY_VALUE: ReadonlyMap<string, Country> = new Map(
  COUNTRIES.map((c) => [c.value, c]),
);
