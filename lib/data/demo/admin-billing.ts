// Demo dataset — Brand-admin Billing (Screen 23), RiversBet (Nigeria) sample.
// Used to render the design populated (preview route + demo mode) instead of the
// empty state. Matches getBillingData's return type (BillingData view model)
// EXACTLY: getBillingData returns the already-mapped/formatted view model, so the
// labels here are pre-formatted the same way the data-layer helpers produce them
// (kobo→naira ÷100, ₦ formatting, en-GB dates). MRR ~₦120,000 = 12,000,000 kobo.
// Clearly sample data — no payment provider integration at MVP (read-only).

import type { BillingData } from "@/lib/data/admin-billing";

export const DEMO_ADMIN_BILLING: BillingData = {
  plan: {
    name: "Growth",
    status: { label: "Active", tone: "good" },
    // 12,000,000 kobo ÷ 100 = ₦120,000.00 / month
    priceLabel: "₦120,000.00",
    renewsAtLabel: "23 Jul 2026",
    cancelAtPeriodEnd: false,
    trialEndsAtLabel: null,
  },
  usage: {
    periodLabel: "1 Jun 2026 – 30 Jun 2026",
    metrics: [
      { label: "Assets generated", used: 42, limit: 100 },
      // At-limit so the preview demonstrates the red over-limit bar state.
      { label: "Reports downloaded", used: 10, limit: 10 },
      { label: "API calls", used: 1840, limit: 5000 },
    ],
  },
  payments: [
    {
      id: "demo-pay-1",
      dateLabel: "23 Jun 2026",
      description: "Subscription payment",
      amountLabel: "₦120,000.00",
      status: { label: "Paid", tone: "good" },
    },
    {
      id: "demo-pay-2",
      dateLabel: "23 May 2026",
      description: "Subscription payment",
      amountLabel: "₦120,000.00",
      status: { label: "Paid", tone: "good" },
    },
    {
      id: "demo-pay-3",
      dateLabel: "23 Apr 2026",
      description: "Subscription payment",
      amountLabel: "₦120,000.00",
      status: { label: "Paid", tone: "good" },
    },
    {
      id: "demo-pay-4",
      dateLabel: "23 Mar 2026",
      description: "Payment failed — card declined by issuer",
      amountLabel: "₦120,000.00",
      status: { label: "Failed", tone: "bad" },
    },
  ],
};
