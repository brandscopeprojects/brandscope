// Demo dataset for the brand-admin Competitors page (Screen 21, /admin/competitors).
// RiversBet's 5 tracked competitors + cap state (5 of 10) for demo mode and the
// public design preview. Mirrors the DEMO_COMPETITORS in lib/data/competitors.ts
// (same ids/tiers) and the AdminCompetitorsData shape returned by getAdminCompetitors.

import type { AdminCompetitorsData } from "@/lib/data/admin-competitors";

export const DEMO_ADMIN_COMPETITORS: AdminCompetitorsData = {
  competitors: [
    { id: "c-sporty", name: "SportyBet", domain: "sportybet.com", tier: "dominant", priority: 1 },
    { id: "c-betking", name: "BetKing", domain: "betking.com", tier: "dominant", priority: 2 },
    { id: "c-1xbet", name: "1xBet", domain: "1xbet.com", tier: "challenger", priority: 3 },
    { id: "c-betway", name: "Betway", domain: "betway.com.ng", tier: "challenger", priority: 4 },
    { id: "c-naira", name: "NairaBet", domain: "nairabet.com", tier: "mid_market", priority: 5 },
  ],
  count: 5,
  max: 10,
  remaining: 5,
  atCap: false,
};
