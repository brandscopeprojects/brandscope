// DEMO / SAMPLE DATA — Market Intelligence (Screen 4, `/market-intel`).
// RiversBet (Nigeria) sample dataset, returned by getMarketIntelData when
// NEXT_PUBLIC_DEMO_MODE=true and rendered by the public /preview/market-intel
// route. Explicitly sample data — richly populated so the page is fully visible
// against the design brief. Shape matches MarketIntelData EXACTLY.
//
// RiversBet is the OWN brand (cobalt dot). Competitors are SportyBet, BetKing,
// 1xBet, Betway and NairaBet (grey dots). The scatter mirrors DEMO_DASHBOARD's
// positioning; the trend feed mirrors the #6 Market Intelligence mockup.

import type { MarketIntelData } from "@/lib/data/market-intel";

export const DEMO_MARKET_INTEL: MarketIntelData = {
  scanWeek: "2025-05-12",
  scatter: {
    brand: {
      id: "demo-brand-riversbet",
      label: "RiversBet",
      reach: 55,
      aggression: 60,
      isOwnBrand: true,
      sovPct: 26,
      threatScore: 72,
      traffic: 847000,
    },
    competitors: [
      {
        id: "c-sporty",
        label: "SportyBet",
        reach: 84,
        aggression: 72,
        isOwnBrand: false,
        sovPct: 15,
        threatScore: 84,
        traffic: 2400000,
      },
      {
        id: "c-betking",
        label: "BetKing",
        reach: 76,
        aggression: 80,
        isOwnBrand: false,
        sovPct: 22,
        threatScore: 78,
        traffic: 1900000,
      },
      {
        id: "c-1xbet",
        label: "1xBet",
        reach: 71,
        aggression: 56,
        isOwnBrand: false,
        sovPct: 18,
        threatScore: 70,
        traffic: 1500000,
      },
      {
        id: "c-betway",
        label: "Betway",
        reach: 58,
        aggression: 34,
        isOwnBrand: false,
        sovPct: 11,
        threatScore: 55,
        traffic: 720000,
      },
      {
        id: "c-naira",
        label: "NairaBet",
        reach: 33,
        aggression: 30,
        isOwnBrand: false,
        sovPct: 8,
        threatScore: 48,
        traffic: 245000,
      },
    ],
  },
  changes: [
    {
      id: "demo-change-1",
      competitorId: "c-sporty",
      competitorName: "SportyBet",
      changeType: "promotion",
      summary:
        "3 operators increased welcome bonuses above ₦200,000 this week, led by SportyBet at ₦250,000 — pushing the top of the market well past RiversBet's current ₦150,000 offer.",
      impactLevel: "high",
      detectedAt: "2025-05-18T09:14:00Z",
      sourceUrl: "https://www.sportybet.com/ng/promotions/welcome-bonus",
      detail: {
        metric: "Welcome bonus",
        before: "₦150,000",
        after: "₦250,000",
      },
      evidenceHash: "a1f7c9d2e4b80315",
    },
    {
      id: "demo-change-2",
      competitorId: "c-1xbet",
      competitorName: "1xBet",
      changeType: "product",
      summary:
        "1xBet launched a new crash game vertical, adding a fast-play instant-game category to its lobby and promoting it heavily on the homepage and in app push notifications.",
      impactLevel: "medium",
      detectedAt: "2025-05-17T15:42:00Z",
      sourceUrl: "https://1xbet.ng/en/crash-games",
      detail: {
        metric: "Game verticals",
        before: "Sports · Casino · Live",
        after: "Sports · Casino · Live · Crash",
      },
      evidenceHash: "b3e8a4f1c7d92064",
    },
    {
      id: "demo-change-3",
      competitorId: "c-betking",
      competitorName: "BetKing",
      changeType: "opportunity",
      summary:
        "Average wagering requirement across tracked operators dropped from 35x to 28x, with BetKing leading the easing — a window for RiversBet to advertise a lower, friendlier requirement and win value-conscious players.",
      impactLevel: "low",
      detectedAt: "2025-05-16T11:05:00Z",
      sourceUrl: "https://www.betking.com/ng/terms/bonus",
      detail: {
        metric: "Avg wagering requirement",
        before: "35x",
        after: "28x",
      },
      evidenceHash: "c5d2b9e7a1f4308a",
    },
  ],
  // Mockup #6: "47 Total Brands Tracked".
  competitorsTracked: 47,
};
