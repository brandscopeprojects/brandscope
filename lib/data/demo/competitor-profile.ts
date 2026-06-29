// Demo dataset — the SportyBet competitor-profile sample (Competitor Profile
// mockup #7). Used to render Screen 5 populated (public preview route + demo
// mode) so the real profile components are visible instead of an empty state.
// Clearly sample data. SportyBet is a COMPETITOR, never the user's own brand —
// cobalt stays off its metrics (cobalt = links/back-nav only).
//
// Shape matches getCompetitorProfile's return type (CompetitorProfileData)
// EXACTLY. Threat score 84 → threatLevel(84) === "critical" (>=80), per
// competitor-profile.ts / scoring-formulas §3.

import type { CompetitorProfileData } from "@/lib/data/competitor-profile";

export const DEMO_COMPETITOR_PROFILE: CompetitorProfileData = {
  competitor: {
    id: "c-sporty",
    name: "SportyBet",
    domain: "sportybet.com",
    tier: "dominant",
  },
  scanWeek: "2025-05-12",
  threat: {
    score: 84,
    level: "critical",
    reasons: [
      "High estimated monthly traffic",
      "Aggressive competitive posture",
      "Running a heavy active-ad campaign",
    ],
  },
  overview: {
    reachScore: 84,
    aggressionScore: 72,
    sovPct: 15,
    threatScore: 84,
  },
  digital: {
    domainAuthority: 71,
    estimatedMonthlyTraffic: 2_400_000,
    organicTrafficPct: 68,
    paidTrafficPct: 32,
    socialFollowersTotal: 847_000,
    activeAdsCount: 23,
    techStackCount: 14,
  },
  product: {
    verticals: [
      { label: "Sports Betting", status: "active" },
      { label: "Casino", status: "active" },
      { label: "Crash Games", status: "growing" },
      { label: "Lottery", status: "absent" },
    ],
    aviatorPromoActive: true,
    aviatorBonus: {
      headline: "100% up to ₦50,000 on Aviator",
      amountKobo: 5_000_000,
      wageringRequirement: 3,
      promoType: "deposit_match",
    },
    oddsCompetitivenessScore: 78,
    newProductsDetected: ["Virtual Sports"],
  },
  changes: [
    {
      id: "demo-cc-1",
      changeType: "promotion",
      summary: "Increased welcome bonus from ₦150k to ₦250k for new sign-ups.",
      impactLevel: "high",
      detectedAt: "2025-05-18T07:32:00Z",
      sourceUrl: "https://sportybet.com/promotions/welcome-bonus",
      detail: { metric: "Welcome bonus", before: "₦150,000", after: "₦250,000" },
    },
    {
      id: "demo-cc-2",
      changeType: "ad_campaign",
      summary: "Launched a Weekend Boost campaign across Facebook & Instagram.",
      impactLevel: "medium",
      detectedAt: "2025-05-16T10:15:00Z",
      sourceUrl: "https://www.facebook.com/ads/library/?q=sportybet",
      detail: null,
    },
    {
      id: "demo-cc-3",
      changeType: "tech_stack",
      summary: "Added a new payment method, Monnify, at checkout.",
      impactLevel: "low",
      detectedAt: "2025-05-15T14:48:00Z",
      sourceUrl: "https://sportybet.com/deposit",
      detail: { metric: "Payment method", after: "Monnify" },
    },
    {
      id: "demo-cc-4",
      changeType: "promotion",
      summary: "Reduced wagering requirement from 35x to 25x on the welcome bonus.",
      impactLevel: "high",
      detectedAt: "2025-05-13T09:05:00Z",
      sourceUrl: "https://sportybet.com/promotions/terms",
      detail: { metric: "Wagering requirement", before: "35x", after: "25x" },
    },
    {
      id: "demo-cc-5",
      changeType: "hiring",
      summary: "Posted a Performance Marketing Manager role.",
      impactLevel: "medium",
      detectedAt: "2025-05-11T08:20:00Z",
      sourceUrl: "https://www.linkedin.com/jobs/sportybet-performance-marketing-manager",
      detail: null,
    },
    {
      id: "demo-cc-6",
      changeType: "tech_stack",
      summary: "Detected a new analytics tool, Mixpanel, on the site.",
      impactLevel: "low",
      detectedAt: "2025-05-08T11:40:00Z",
      sourceUrl: "https://sportybet.com",
      detail: { metric: "Analytics", after: "Mixpanel" },
    },
    {
      id: "demo-cc-7",
      changeType: "ad_creative",
      summary: "Released a new video creative series for Virtual Sports.",
      impactLevel: "medium",
      detectedAt: "2025-05-06T13:10:00Z",
      sourceUrl: "https://www.youtube.com/@sportybet",
      detail: null,
    },
  ],
};
