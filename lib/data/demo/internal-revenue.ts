// DEMO / SAMPLE DATA — Internal-admin Revenue Dashboard (Screen 29,
// `/brandscope-admin/revenue`). Returned by getInternalRevenue when
// NEXT_PUBLIC_DEMO_MODE=true and rendered by the PUBLIC /preview/internal-revenue
// route inside the dark InternalShell. Explicitly sample data — richly populated
// so the internal revenue console is fully visible against the Screen-29 mockup.
//
// Shape matches InternalRevenueData EXACTLY (the getInternalRevenue return type):
// metricsTrend (MrrTrendPoint[]), latest (RevenueLatest), subscriptions
// (SubscriptionRow[]), churn (ChurnRow[]). Because the VMs carry PRE-FORMATTED
// display strings (the live data layer formats kobo→naira and dates before
// returning), the demo must mirror that exact output:
//   - mrrLabel / arpaLabel  → compact naira  "₦1.2m" / "₦340k"
//   - mrrLabel (table) / valueLost → full naira "₦125,000.00"
//   - startedLabel / dateLabel / periodLabel → "23 Jun 2026"
//   - chart label → "23 Jun"
// All underlying figures are conceptually in kobo (÷100 to naira); the strings
// here already reflect that conversion.
//
// Tone discipline (ui-constraints §2.3 / §15 / StatusPill):
//   good=green  → Active / Trialing subscriptions
//   warn=amber  → Canceled / Paused subscriptions; soft churn (no MRR lost)
//   bad=red     → Past due subscriptions; churn with real revenue lost
//   neutral=grey→ unknown state
// Churn NEVER renders green — it is never a positive signal.
//
// Posture: a healthy early-stage SaaS — MRR growing ~₦310k → ₦690k over 8 weeks,
// ARPA rising as brands move to Scale, low but non-zero churn so both churn tones
// are exercised.

import type { InternalRevenueData } from "@/lib/data/internal-revenue";

export const DEMO_INTERNAL_REVENUE: InternalRevenueData = {
  // ── MRR time series (8 weeks, oldest → newest, kobo conceptually) ──────────
  metricsTrend: [
    { week: "2026-05-11", label: "11 May", mrrNaira: 312_000 },
    { week: "2026-05-18", label: "18 May", mrrNaira: 348_000 },
    { week: "2026-05-25", label: "25 May", mrrNaira: 401_000 },
    { week: "2026-06-01", label: "1 Jun", mrrNaira: 437_500 },
    { week: "2026-06-08", label: "8 Jun", mrrNaira: 512_000 },
    { week: "2026-06-15", label: "15 Jun", mrrNaira: 568_000 },
    { week: "2026-06-22", label: "22 Jun", mrrNaira: 642_500 },
    { week: "2026-06-29", label: "29 Jun", mrrNaira: 690_000 },
  ],

  // ── Latest snapshot (derived from the newest two metric rows) ──────────────
  // mrrDeltaNaira = 690,000 − 642,500 = +47,500 (genuine prior-week delta).
  // churnRatePct = churned / active = 1 / 24 ≈ 4.2%.
  latest: {
    mrrLabel: "₦690k",
    mrrDeltaNaira: 47_500,
    activeSubscriptions: 24,
    churnRatePct: 4.2,
    churnedBrands: 1,
    arpaLabel: "₦28.8k",
    newBrands: 3,
    periodLabel: "29 Jun 2026",
  },

  // ── Subscriptions, ranked by MRR (full-naira strings, mono in table) ───────
  subscriptions: [
    {
      id: "sub-01",
      org: "RiversBet",
      plan: "Scale",
      mrrLabel: "₦125,000.00",
      statusLabel: "Active",
      statusTone: "good",
      startedLabel: "14 Jan 2026",
    },
    {
      id: "sub-02",
      org: "NaijaBet Group",
      plan: "Scale",
      mrrLabel: "₦125,000.00",
      statusLabel: "Active",
      statusTone: "good",
      startedLabel: "3 Feb 2026",
    },
    {
      id: "sub-03",
      org: "Lagos Aces",
      plan: "Growth",
      mrrLabel: "₦65,000.00",
      statusLabel: "Active",
      statusTone: "good",
      startedLabel: "21 Feb 2026",
    },
    {
      id: "sub-04",
      org: "SafariStake KE",
      plan: "Growth",
      mrrLabel: "₦65,000.00",
      statusLabel: "Active",
      statusTone: "good",
      startedLabel: "9 Mar 2026",
    },
    {
      id: "sub-05",
      org: "Pula Play BW",
      plan: "Growth",
      mrrLabel: "₦65,000.00",
      statusLabel: "Past Due",
      statusTone: "bad",
      startedLabel: "1 Apr 2026",
    },
    {
      id: "sub-06",
      org: "Cape Town Wager",
      plan: "Growth",
      mrrLabel: "₦65,000.00",
      statusLabel: "Active",
      statusTone: "good",
      startedLabel: "18 Apr 2026",
    },
    {
      id: "sub-07",
      org: "Accra Odds",
      plan: "Starter",
      mrrLabel: "₦28,000.00",
      statusLabel: "Active",
      statusTone: "good",
      startedLabel: "2 May 2026",
    },
    {
      id: "sub-08",
      org: "Kampala Kicks",
      plan: "Starter",
      mrrLabel: "₦28,000.00",
      statusLabel: "Trialing",
      statusTone: "good",
      startedLabel: "9 Jun 2026",
    },
    {
      id: "sub-09",
      org: "Durban Dice",
      plan: "Starter",
      mrrLabel: "₦28,000.00",
      statusLabel: "Active",
      statusTone: "good",
      startedLabel: "16 Jun 2026",
    },
    {
      id: "sub-10",
      org: "Harare Hold'em",
      plan: "Starter",
      mrrLabel: "₦28,000.00",
      statusLabel: "Trialing",
      statusTone: "good",
      startedLabel: "23 Jun 2026",
    },
    {
      id: "sub-11",
      org: "Mombasa Markets",
      plan: "Starter",
      mrrLabel: "₦0.00",
      statusLabel: "Canceled",
      statusTone: "warn",
      startedLabel: "12 Mar 2026",
    },
    {
      id: "sub-12",
      org: "Jozi Jackpot",
      plan: "Growth",
      mrrLabel: "₦0.00",
      statusLabel: "Paused",
      statusTone: "warn",
      startedLabel: "20 Feb 2026",
    },
  ],

  // ── Recent churn events, newest first ──────────────────────────────────────
  // bad (red) = real MRR lost · warn (amber) = soft churn / pause, no MRR lost.
  // Never green.
  churn: [
    {
      id: "churn-01",
      org: "Mombasa Markets",
      reason: "Downgraded then cancelled — budget freeze",
      valueLostLabel: "₦28,000.00",
      dateLabel: "24 Jun 2026",
      tone: "bad",
    },
    {
      id: "churn-02",
      org: "Jozi Jackpot",
      reason: "Paused subscription — seasonal pause",
      valueLostLabel: "₦65,000.00",
      dateLabel: "11 Jun 2026",
      tone: "bad",
    },
    {
      id: "churn-03",
      org: "Eko Bets",
      reason: "Trial expired without conversion",
      valueLostLabel: "—",
      dateLabel: "2 Jun 2026",
      tone: "warn",
    },
    {
      id: "churn-04",
      org: "Nairobi Numbers",
      reason: "Downgraded Scale → Growth",
      valueLostLabel: "₦60,000.00",
      dateLabel: "27 May 2026",
      tone: "bad",
    },
    {
      id: "churn-05",
      org: "Pretoria Punt",
      reason: "Card declined — payment retry pending",
      valueLostLabel: "—",
      dateLabel: "19 May 2026",
      tone: "warn",
    },
  ],
};
