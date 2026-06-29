// Public design preview of Brand-admin Billing (#23), populated with the
// RiversBet sample data so the real components are visible. No auth/Supabase.
// Mirrors the composition of app/(app)/admin/billing/page.tsx with the same
// AdminBilling* components + AdminTabs sub-nav, in the bg-base container.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminBillingPlanCard } from "@/components/admin/AdminBillingPlanCard";
import { AdminBillingUsage } from "@/components/admin/AdminBillingUsage";
import { AdminBillingHistory } from "@/components/admin/AdminBillingHistory";
import { DEMO_ADMIN_BILLING } from "@/lib/data/demo/admin-billing";

export const dynamic = "force-dynamic";

export default function PreviewAdminBilling() {
  const data = DEMO_ADMIN_BILLING;

  return (
    <div className="min-h-screen bg-base">
      <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
        <div className="space-y-6">
          <AdminTabs />

          <PageHeader
            title="Billing"
            subtitle="Your plan, usage and payment history."
          />

          <AdminBillingPlanCard plan={data.plan} />
          {data.usage && <AdminBillingUsage usage={data.usage} />}
          <AdminBillingHistory payments={data.payments} />
        </div>
      </div>
    </div>
  );
}
