// Shared constants for the brand-admin Settings screen (Screen 20).
// Client-safe (no server-only deps) so both the server action (validation) and
// the client form can import the same closed sets — no drift.

export const SCAN_FREQUENCIES = [
  { value: "weekly", label: "Weekly (Mondays)" },
  { value: "daily", label: "Daily" },
] as const;

export type ScanFrequency = (typeof SCAN_FREQUENCIES)[number]["value"];
export const SCAN_FREQUENCY_VALUES = SCAN_FREQUENCIES.map(
  (f) => f.value,
) as readonly string[];

// The brand_preferences module toggles, in display order. The `key` is the exact
// boolean column on `brand_preferences`; a missing/null column reads as enabled.
export const PREFERENCE_MODULES = [
  { key: "promotions_enabled", label: "Promotion Signals", route: "/promotions" },
  { key: "traffic_seo_enabled", label: "Traffic & SEO", route: "/traffic-seo" },
  { key: "social_ads_enabled", label: "Social & Ads", route: "/social-ads" },
  { key: "geo_aeo_enabled", label: "GEO / AEO / SEO", route: "/geo-aeo-seo" },
  { key: "regulatory_enabled", label: "Regulatory Compliance", route: "/regulatory" },
  {
    key: "customer_intel_enabled",
    label: "Customer Intelligence",
    route: "/customers",
  },
  { key: "product_intel_enabled", label: "Product Intelligence", route: "/products" },
  {
    key: "hiring_signals_enabled",
    label: "Hiring & Signals",
    route: "/hiring-signals",
  },
] as const;

export type PreferenceModuleKey = (typeof PREFERENCE_MODULES)[number]["key"];
export const PREFERENCE_MODULE_KEYS = PREFERENCE_MODULES.map(
  (m) => m.key,
) as readonly PreferenceModuleKey[];
