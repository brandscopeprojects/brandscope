// Demo dataset — Brand-admin Settings (Screen 20), RiversBet (Nigeria) sample.
// Used to render the design populated (preview route + demo mode) so the real
// brand-profile + module-preferences forms are visible instead of the empty
// state. Clearly sample data — matches getBrandSettings's return type exactly.

import type { BrandSettings } from "@/lib/data/admin-settings";

export const DEMO_ADMIN_SETTINGS: BrandSettings = {
  brand: {
    id: "demo-riversbet",
    organisation_id: "demo-org",
    name: "RiversBet",
    slug: "riversbet",
    domain: "riversbet.com",
    industry: "igaming",
    market: ["nigeria"],
    positioning_statement:
      "The fastest-paying sportsbook in Nigeria — instant withdrawals and the boldest odds on local fixtures.",
    primary_colour: "#2B5CE6",
    logo_url: "https://riversbet.com/logo.png",
    scan_frequency: "weekly",
    tier: "challenger",
    is_active: true,
    onboarding_completed_at: "2025-05-01T09:00:00Z",
    created_at: "2025-05-01T09:00:00Z",
    updated_at: "2025-05-18T08:00:00Z",
    deleted_at: null,
  },
  preferences: {
    id: "demo-brand-prefs",
    brand_id: "demo-riversbet",
    promotions_enabled: true,
    traffic_seo_enabled: true,
    social_ads_enabled: true,
    geo_aeo_enabled: true,
    regulatory_enabled: true,
    customer_intel_enabled: true,
    product_intel_enabled: true,
    hiring_signals_enabled: true,
    created_at: "2025-05-01T09:00:00Z",
    updated_at: "2025-05-18T08:00:00Z",
  },
};
