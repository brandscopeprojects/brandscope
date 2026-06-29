// Demo dataset — Promotion Signals (#3), RiversBet (Nigeria) sample from the
// design mockup. Used to render the design populated (preview route + demo mode)
// so the real components are visible instead of the empty state. Sample data.
//
// SIGNALS-ONLY POLICY (mvp-constraints.md module 8): we surface only that a promo
// exists, its type, whether it is new, and the DIRECTION of a WoW change — never
// an exact bonus amount. The PromotionsData type already withholds those figures,
// so this fixture matches it exactly (no invented fields).

import type { PromotionsData } from "@/lib/data/promotions";

export const DEMO_PROMOTIONS: PromotionsData = {
  scanWeek: "2025-W20",
  signals: [
    {
      competitorId: "demo-sportybet",
      name: "SportyBet",
      tier: "dominant",
      promoTitle: "Welcome Bonus",
      promoType: "welcome",
      isNew: true,
      promoUrl: "https://www.sportybet.com/ng/promotions/welcome-bonus",
      sourceUrl: "https://www.sportybet.com/ng/promotions",
      scrapedAt: "2025-05-19T06:14:00Z",
      evidenceHash: "9f1c4a7b2e8d3056",
      wowBonusChangePct: null,
    },
    {
      competitorId: "demo-1xbet",
      name: "1xBet",
      tier: "dominant",
      promoTitle: "Welcome Bonus",
      promoType: "welcome",
      isNew: false,
      promoUrl: "https://1xbet.ng/en/promo/welcome",
      sourceUrl: "https://1xbet.ng/en/promotions",
      scrapedAt: "2025-05-19T05:48:00Z",
      evidenceHash: "3a6e9d1f7c2b4480",
      wowBonusChangePct: 50,
    },
    {
      competitorId: "demo-betking",
      name: "BetKing",
      tier: "challenger",
      promoTitle: "Welcome Bonus",
      promoType: "welcome",
      isNew: false,
      promoUrl: "https://www.betking.com/promotions/welcome-bonus",
      sourceUrl: "https://www.betking.com/promotions",
      scrapedAt: "2025-05-18T22:31:00Z",
      evidenceHash: "c84b07e5a93f1d62",
      wowBonusChangePct: 25,
    },
    {
      competitorId: "demo-nairabet",
      name: "NairaBet",
      tier: "mid_market",
      promoTitle: "Welcome Bonus",
      promoType: "welcome",
      isNew: false,
      promoUrl: "https://www.nairabet.com/promotions/welcome",
      sourceUrl: "https://www.nairabet.com/promotions",
      scrapedAt: "2025-05-18T19:05:00Z",
      evidenceHash: "5d2f8a0c6b91e734",
      wowBonusChangePct: -25,
    },
    {
      competitorId: "demo-betway",
      name: "Betway",
      tier: "niche",
      promoTitle: "Welcome Bonus",
      promoType: "welcome",
      isNew: false,
      promoUrl: "https://www.betway.com.ng/promotions/welcome-offer",
      sourceUrl: "https://www.betway.com.ng/promotions",
      scrapedAt: "2025-05-18T16:42:00Z",
      evidenceHash: "7e1a3c9b4f6280d5",
      wowBonusChangePct: null,
    },
  ],
  // Real signal counts derived from the rows above — no fabricated amounts.
  activeCount: 5,
  newCount: 1,
  competitorsWithPromos: 5,
};
