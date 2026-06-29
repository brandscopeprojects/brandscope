// Public design preview of the Internal-admin Revenue Dashboard (Screen 29,
// /brandscope-admin/revenue), populated with the DEMO_INTERNAL_REVENUE sample
// dataset so the real components are visible against the dark internal shell.
// No auth / no Supabase — explicitly sample data.
//
// Mirrors the composition of app/brandscope-admin/revenue/page.tsx, but wraps the
// content in <InternalShell> (the brandscope-admin LAYOUT supplies the shell on
// the real route; the preview must supply it itself). The MRR chart is a client
// component and renders here with the demo trend.

import { InternalShell } from "@/components/admin/InternalShell";
import { PageHeader } from "@/components/intelligence/PageHeader";
import { RevenueStats } from "@/components/admin/RevenueStats";
import { RevenueMrrChart } from "@/components/admin/RevenueMrrChart";
import { RevenueSubscriptionTable } from "@/components/admin/RevenueSubscriptionTable";
import { RevenueChurn } from "@/components/admin/RevenueChurn";
import { DEMO_INTERNAL_REVENUE } from "@/lib/data/demo/internal-revenue";

export const dynamic = "force-dynamic";

export default function PreviewInternalRevenue() {
  const { metricsTrend, latest, subscriptions, churn } = DEMO_INTERNAL_REVENUE;

  return (
    <InternalShell operatorEmail="ops@brandscope.io" isSuperAdmin={true}>
      <div className="space-y-8">
        <PageHeader
          title="Revenue"
          subtitle="MRR, subscriptions and churn across the platform."
        />

        {latest && <RevenueStats latest={latest} />}
        {metricsTrend.length > 0 && <RevenueMrrChart trend={metricsTrend} />}
        <RevenueSubscriptionTable subscriptions={subscriptions} />
        <RevenueChurn churn={churn} />
      </div>
    </InternalShell>
  );
}
