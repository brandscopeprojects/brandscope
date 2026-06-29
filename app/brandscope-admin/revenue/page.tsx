// Screen 29 — Internal-admin Revenue Dashboard, /brandscope-admin/revenue.
// The internal-admin layout renders the dark shell, enforces
// requireInternalAdmin, and provides the padded container — so this is
// content-only (no shell, no auth, no width wrapper).
//
// Data is GLOBAL and Class-2 (service-role-only): `revenue_metrics`,
// `subscriptions`, `churn_events` are read via the admin client by
// getInternalRevenue. Real values only — an honest empty state when nothing has
// been recorded yet. There is no cost_logs table and the cost/margin visual is
// out of scope for this page, so no cost chart is rendered.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { RevenueStats } from "@/components/admin/RevenueStats";
import { RevenueMrrChart } from "@/components/admin/RevenueMrrChart";
import { RevenueSubscriptionTable } from "@/components/admin/RevenueSubscriptionTable";
import { RevenueChurn } from "@/components/admin/RevenueChurn";
import { getInternalRevenue } from "@/lib/data/internal-revenue";

export const dynamic = "force-dynamic";

export default async function RevenueDashboardPage() {
  const { metricsTrend, latest, subscriptions, churn } = await getInternalRevenue();

  const isEmpty =
    !latest &&
    metricsTrend.length === 0 &&
    subscriptions.length === 0 &&
    churn.length === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Revenue"
        subtitle="MRR, subscriptions and churn across the platform."
      />

      {isEmpty ? (
        <EmptyState
          intent="scanning"
          title="No revenue data yet"
          message="Revenue metrics populate as brands subscribe."
        />
      ) : (
        <>
          {latest && <RevenueStats latest={latest} />}
          {metricsTrend.length > 0 && <RevenueMrrChart trend={metricsTrend} />}
          <RevenueSubscriptionTable subscriptions={subscriptions} />
          <RevenueChurn churn={churn} />
        </>
      )}
    </div>
  );
}
