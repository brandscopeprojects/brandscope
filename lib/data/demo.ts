// Demo dataset — the RiversBet (Nigeria) sample from the dashboard mockup (#2).
// Used to render the design populated (preview route + optional demo mode), so the
// real components are visible instead of an empty state. Clearly sample data.

import type { DashboardData } from "@/lib/data/dashboard";
import type { Recommendation } from "@/types/view-models";

export const DEMO_BRAND = {
  id: "demo-riversbet",
  name: "RiversBet",
  market: ["nigeria"],
  slug: "riversbet",
};

const RECS: Recommendation[] = [
  {
    id: "demo-rec-1",
    urgency: "urgent",
    category: "promotions",
    headline: "SportyBet increased welcome bonus to ₦250,000",
    triggerReason: "Close the gap to remain competitive in new-user acquisition before this weekend's fixtures.",
    confidenceScore: 0.9,
    confidenceLevel: "high",
    evidence: [
      {
        sourceUrl: "https://sportybet.com/promotions/welcome-bonus",
        scrapedAt: "2025-05-18T07:32:00Z",
        extractedText:
          "New users get up to ₦250,000 welcome bonus on first deposit. Min deposit ₦1,000. 25x wagering.",
        changeBefore: "₦150,000",
        changeAfter: "₦250,000",
        evidenceHash: "a1b2c3d4",
      },
    ],
    assumptionFlags: [],
    isDirectEvidence: true,
    status: "open",
    rank: 1,
  },
  {
    id: "demo-rec-2",
    urgency: "watch",
    category: "traffic_seo",
    headline: "BetKing ranking for “best odds Nigeria” moving up",
    triggerReason: "Position improved from #6 to #3 in 6 hours — strengthen on-page SEO and content.",
    confidenceScore: 0.65,
    confidenceLevel: "medium",
    evidence: [
      {
        sourceUrl: "https://google.com/search?q=best+odds+nigeria",
        scrapedAt: "2025-05-18T01:10:00Z",
        extractedText: "betking.com appears at position 3 for “best odds nigeria” (was position 6 last week).",
        changeBefore: "#6",
        changeAfter: "#3",
        evidenceHash: "e5f6a7b8",
      },
    ],
    assumptionFlags: ["Ranking inferred from a single SERP snapshot"],
    isDirectEvidence: false,
    status: "open",
    rank: 2,
  },
  {
    id: "demo-rec-3",
    urgency: "opportunity",
    category: "geo_aeo",
    headline: "You're not mentioned in AI answers for “fastest payout betting sites”",
    triggerReason: "Opportunity to capture visibility across AI platforms — 4 platforms checked.",
    confidenceScore: 0.82,
    confidenceLevel: "high",
    evidence: [
      {
        sourceUrl: "https://chat.openai.com/",
        scrapedAt: "2025-05-18T03:00:00Z",
        extractedText:
          "Asked “fastest payout betting sites in Nigeria” — RiversBet not mentioned; SportyBet, BetKing and 1xBet cited.",
        changeBefore: null,
        changeAfter: null,
        evidenceHash: "c9d0e1f2",
      },
    ],
    assumptionFlags: [],
    isDirectEvidence: true,
    status: "open",
    rank: 3,
  },
];

export const DEMO_DASHBOARD: DashboardData = {
  scanWeek: "2025-05-12",
  scatter: {
    brand: {
      id: DEMO_BRAND.id,
      label: "RiversBet",
      reach: 55,
      aggression: 60,
      isOwnBrand: true,
      sovPct: 26,
      threatScore: 72,
      traffic: 847000,
    },
    competitors: [
      { id: "c-sporty", label: "SportyBet", reach: 84, aggression: 72, isOwnBrand: false, sovPct: 15, threatScore: 84, traffic: 2400000 },
      { id: "c-betking", label: "BetKing", reach: 76, aggression: 80, isOwnBrand: false, sovPct: 22, threatScore: 78, traffic: 1900000 },
      { id: "c-1xbet", label: "1xBet", reach: 71, aggression: 56, isOwnBrand: false, sovPct: 18, threatScore: 70, traffic: 1500000 },
      { id: "c-betway", label: "Betway", reach: 58, aggression: 34, isOwnBrand: false, sovPct: 11, threatScore: 55, traffic: 720000 },
      { id: "c-naira", label: "NairaBet", reach: 33, aggression: 30, isOwnBrand: false, sovPct: 8, threatScore: 48, traffic: 245000 },
    ],
  },
  radar: {
    axes: ["Promotions", "Traffic", "SEO", "Social", "Trust", "Engagement"],
    brand: [58, 64, 60, 45, 78, 52],
    marketAvg: [72, 70, 66, 58, 68, 60],
  },
  sov: [
    { label: "RiversBet", value: 26, isOwnBrand: true },
    { label: "BetKing", value: 22, isOwnBrand: false },
    { label: "1xBet", value: 18, isOwnBrand: false },
    { label: "SportyBet", value: 15, isOwnBrand: false },
    { label: "Betway", value: 11, isOwnBrand: false },
    { label: "Others", value: 8, isOwnBrand: false },
  ],
  threat: {
    score: 72,
    level: "high",
    reasons: [
      "SportyBet raised its welcome bonus 67% to ₦250,000",
      "BetKing climbing for high-intent “best odds” queries",
      "RiversBet absent from AI answers for payout queries",
    ],
  },
  aiVisibility: { score: 68, trend: 12 },
  recommendations: RECS,
};
