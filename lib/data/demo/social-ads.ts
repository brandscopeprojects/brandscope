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
      competitorId: "demo-sportybet",
      name: "SportyBet",
      tier: "tier_1",
      adNetworks: ["Google Ads", "Facebook Ads", "Taboola"],
    },
    {
      competitorId: "demo-betking",
      name: "BetKing",
      tier: "tier_1",
      adNetworks: ["Google Ads", "Facebook Ads"],
    },
    {
      competitorId: "demo-1xbet",
      name: "1xBet",
      tier: "tier_1",
      adNetworks: ["Google Ads", "Facebook Ads", "Outbrain", "Propeller"],
    },
    {
      competitorId: "demo-nairabet",
      name: "NairaBet",
      tier: "tier_2",
      adNetworks: ["Google Ads"],
    },
  ],
};
