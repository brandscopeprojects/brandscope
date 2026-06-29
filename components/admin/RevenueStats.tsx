// RevenueStats — headline metric strip for the internal Revenue Dashboard
// (Screen 29). Wraps the shared StatStrip with real platform values: MRR,
// active subscriptions, churn rate, ARPA. The MRR tile carries a genuine
// period-over-period (MoM) delta via the StatStrip `wow` slot; the other
// metrics fold their context into the label rather than faking a delta.
// Presentational. Tokens only.

import { StatStrip, type Stat } from "@/components/intelligence/StatStrip";
import type { RevenueLatest } from "@/lib/data/internal-revenue";

export function RevenueStats({ latest }: { latest: RevenueLatest }) {
  const stats: Stat[] = [
    {
      // period_week is weekly, so the MoM/prior-period delta is a genuine
      // week-over-week change → the WoW chip is honest here. The chip shows the
      // delta in ₦ thousands; the label names the unit so it reads cleanly.
      label: `MRR (₦) · vs prior week (₦k)`,
      value: latest.mrrLabel,
      wow:
        latest.mrrDeltaNaira != null
          ? Math.round(latest.mrrDeltaNaira / 1000)
          : null,
    },
    {
      label:
        latest.newBrands != null
          ? `Active subscriptions · ${latest.newBrands} new`
          : "Active subscriptions",
      value: latest.activeSubscriptions.toLocaleString("en-NG"),
    },
    {
      label:
        latest.churnedBrands != null
          ? `Churn rate · ${latest.churnedBrands} churned`
          : "Churn rate",
      value: latest.churnRatePct != null ? latest.churnRatePct : "—",
      unit: latest.churnRatePct != null ? "%" : undefined,
    },
    {
      label: "ARPA (avg revenue / account)",
      value: latest.arpaLabel,
    },
  ];

  return <StatStrip stats={stats} />;
}
