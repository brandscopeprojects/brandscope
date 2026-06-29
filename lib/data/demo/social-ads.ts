// Demo dataset — Social & Ads Intelligence (#8), RiversBet (Nigeria) sample from
// the design mockup. Used to render the design populated (preview route + demo
// mode) so the real components are visible instead of the empty state. Sample data.
//
// SCOPE NOTE: only the Ad Network summary is built data (tech_stack_cache /
// DetectZeStack). Social follower/engagement intelligence is Phase 2 and is shown
// via an honest "coming soon" EmptyState on the page — we do NOT fabricate social
// numbers here, and SocialAdsData has no fields for them. This fixture therefore
// only carries per-competitor detected ad networks, matching the type exactly.

import type { SocialAdsData } from "@/lib/data/social-ads";

export const DEMO_SOCIAL_ADS: SocialAdsData = {
  scanWeek: "2025-W20",
  competitors: [
    {
      competitorId: "demo-riversbet",
      name: "RiversBet",
      tier: null,
      adNetworks: ["Google Ads", "Facebook Ads"],
      isOwnBrand: true,
    },
    {
      competitorId: "demo-sportybet",
      name: "SportyBet",
      tier: "dominant",
      adNetworks: ["Google Ads", "Facebook Ads", "Taboola"],
      isOwnBrand: false,
    },
    {
      competitorId: "demo-betking",
      name: "BetKing",
      tier: "challenger",
      adNetworks: ["Google Ads", "Facebook Ads"],
      isOwnBrand: false,
    },
    {
      competitorId: "demo-1xbet",
      name: "1xBet",
      tier: "challenger",
      adNetworks: ["Google Ads", "Facebook Ads", "Outbrain", "Propeller"],
      isOwnBrand: false,
    },
    {
      competitorId: "demo-nairabet",
      name: "NairaBet",
      tier: "mid_market",
      adNetworks: ["Google Ads"],
      isOwnBrand: false,
    },
  ],
};
