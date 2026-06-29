// Billing (Screen 23) — brand-admin, route /admin/billing. READ-ONLY at MVP:
// no payment integration. The admin layout supplies the tab sub-nav, space-y-6,
// and requireBrandAdmin; this file is content-only. Billing data is Class-2
// (service-role-only, org-scoped) — getBillingData() reads it via the admin
// client after a defense-in-depth requireBrandAdmin() check.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { AdminBillingPlanCard } from "@/components/admin/AdminBillingPlanCard";
import { AdminBillingUsage } from "@/components/admin/AdminBillingUsage";
import { AdminBillingHistory } from "@/components/admin/AdminBillingHistory";
import { getBillingData } from "@/lib/data/admin-billing";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const data = await getBillingData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        subtitle="Your plan, usage and payment history."
      />

      {!data ? (
        <EmptyState
          intent="scanning"
          title="No billing record yet"
          message="Your subscription details will appear here once your account is set up."
        />
      ) : (
        <>
          <AdminBillingPlanCard plan={data.plan} />
          {data.usage && <AdminBillingUsage usage={data.usage} />}
          <AdminBillingHistory payments={data.payments} />
        </>
      )}
    </div>
  );
}
