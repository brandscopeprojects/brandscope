// Demo dataset — Customer Intelligence (#10), RiversBet (Nigeria) sample from the
// design mockup. Used to render the design populated (preview route + demo mode)
// so the real components are visible instead of the empty state. Sample data.
//
// Customer Intelligence is a PARTIAL module (mvp-constraints §2): only inferred
// fields ship (traffic mix, demographics, complaint themes, app sentiment). This
// fixture matches CustomerIntelData EXACTLY — no fields invented beyond the type.
// complaint_themes sentiment is normalised -1..1; complaints are negative by
// nature, so every theme here is scored < 0 (the UI never tints a complaint
// green). RiversBet is the own brand; competitors use the neutral grey ramp.

import type { CustomerIntelData } from "@/lib/data/customers";

// Shared Nigeria audience inference from the mockup (age + gender bands).
const NG_DEMOGRAPHICS = {
  ageBands: [
    { label: "18-24", pct: 25 },
    { label: "25-34", pct: 46 },
    { label: "35-44", pct: 19 },
    { label: "45+", pct: 10 },
  ],
  gender: [
    { label: "Male", pct: 68 },
    { label: "Female", pct: 32 },
  ],
};

export const DEMO_CUSTOMERS: CustomerIntelData = {
  scanWeek: "2025-W20",
  competitors: [
    {
      competitorId: "demo-sportybet",
      name: "SportyBet",
      tier: "dominant",
      appRating: 4.4,
      appReviewCount: 184200,
      sentiment: 0.31,
      complaintThemes: [
        { theme: "Withdrawal Delays", count: 32, sentiment: -0.62 },
        { theme: "Customer Service", count: 28, sentiment: -0.41 },
        { theme: "Bonus Issues", count: 22, sentiment: -0.28 },
        { theme: "App Performance", count: 18, sentiment: -0.19 },
      ],
      demographics: NG_DEMOGRAPHICS,
      geographic: [
        { region: "Lagos", pct: 45 },
        { region: "Abuja", pct: 20 },
        { region: "Port Harcourt", pct: 12 },
        { region: "Other", pct: 23 },
      ],
      trafficSources: [
        { source: "Organic", pct: 63 },
        { source: "Paid Search", pct: 24 },
        { source: "Direct", pct: 6 },
        { source: "Social", pct: 5 },
        { source: "Referral", pct: 2 },
      ],
    },
    {
      competitorId: "demo-1xbet",
      name: "1xBet",
      tier: "dominant",
      appRating: 4.2,
      appReviewCount: 96800,
      sentiment: 0.18,
      complaintThemes: [
        { theme: "Bonus Issues", count: 30, sentiment: -0.36 },
        { theme: "Customer Service", count: 26, sentiment: -0.44 },
        { theme: "Withdrawal Delays", count: 24, sentiment: -0.58 },
        { theme: "App Performance", count: 20, sentiment: -0.22 },
      ],
      demographics: NG_DEMOGRAPHICS,
      geographic: [
        { region: "Lagos", pct: 41 },
        { region: "Abuja", pct: 22 },
        { region: "Port Harcourt", pct: 14 },
        { region: "Other", pct: 23 },
      ],
      trafficSources: [
        { source: "Paid Search", pct: 45 },
        { source: "Organic", pct: 37 },
        { source: "Social", pct: 10 },
        { source: "Direct", pct: 8 },
      ],
    },
    {
      competitorId: "demo-riversbet",
      name: "RiversBet",
      tier: "self",
      appRating: 4.1,
      appReviewCount: 12400,
      sentiment: 0.4,
      complaintThemes: [
        { theme: "App Performance", count: 27, sentiment: -0.24 },
        { theme: "Withdrawal Delays", count: 24, sentiment: -0.55 },
        { theme: "Bonus Issues", count: 21, sentiment: -0.3 },
        { theme: "Customer Service", count: 19, sentiment: -0.37 },
      ],
      demographics: NG_DEMOGRAPHICS,
      geographic: [
        { region: "Port Harcourt", pct: 38 },
        { region: "Lagos", pct: 30 },
        { region: "Abuja", pct: 14 },
        { region: "Other", pct: 18 },
      ],
      trafficSources: [
        { source: "Organic", pct: 52 },
        { source: "Direct", pct: 21 },
        { source: "Paid Search", pct: 16 },
        { source: "Social", pct: 8 },
        { source: "Referral", pct: 3 },
      ],
    },
    {
      competitorId: "demo-betking",
      name: "BetKing",
      tier: "tier_1",
      appRating: 4.0,
      appReviewCount: 71500,
      sentiment: 0.12,
      complaintThemes: [
        { theme: "Customer Service", count: 30, sentiment: -0.47 },
        { theme: "Withdrawal Delays", count: 28, sentiment: -0.6 },
        { theme: "Bonus Issues", count: 25, sentiment: -0.31 },
        { theme: "App Performance", count: 17, sentiment: -0.2 },
      ],
      demographics: NG_DEMOGRAPHICS,
      geographic: [
        { region: "Lagos", pct: 43 },
        { region: "Abuja", pct: 19 },
        { region: "Port Harcourt", pct: 16 },
        { region: "Other", pct: 22 },
      ],
      trafficSources: [
        { source: "Organic", pct: 58 },
        { source: "Paid Search", pct: 30 },
        { source: "Direct", pct: 7 },
        { source: "Social", pct: 5 },
      ],
    },
    {
      competitorId: "demo-nairabet",
      name: "NairaBet",
      tier: "tier_2",
      appRating: 3.8,
      appReviewCount: 38900,
      sentiment: -0.05,
      complaintThemes: [
        { theme: "Withdrawal Delays", count: 38, sentiment: -0.66 },
        { theme: "Customer Service", count: 24, sentiment: -0.43 },
        { theme: "Bonus Issues", count: 20, sentiment: -0.29 },
        { theme: "App Performance", count: 18, sentiment: -0.21 },
      ],
      demographics: NG_DEMOGRAPHICS,
      geographic: [
        { region: "Lagos", pct: 47 },
        { region: "Abuja", pct: 18 },
        { region: "Port Harcourt", pct: 11 },
        { region: "Other", pct: 24 },
      ],
      trafficSources: [
        { source: "Organic", pct: 55 },
        { source: "Paid Search", pct: 19 },
        { source: "Social", pct: 15 },
        { source: "Direct", pct: 8 },
        { source: "Referral", pct: 3 },
      ],
    },
  ],
};
