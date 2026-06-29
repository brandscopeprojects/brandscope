// Public design preview of the Brand-admin Alerts Config (Screen 22), populated
// with the RiversBet sample dataset (no auth, no Supabase, no admin gate) so the
// real AdminAlertsConfig trigger list + AdminAlertsHistory table are visible
// against the design brief. NOT linked from the app shell; for review/demo only.
// Mirrors the real /admin/alerts composition (AdminTabs + PageHeader + the two
// admin-alerts components) with the requireBrandAdmin gate removed and demo data
// passed directly as props. Interactive controls (toggles/threshold inputs) call
// server actions on use; here they simply render the populated state.

import { AdminTabs } from "@/components/admin/AdminTabs";
import { PageHeader } from "@/components/intelligence/PageHeader";
import { AdminAlertsConfig } from "@/components/admin/AdminAlertsConfig";
import { AdminAlertsHistory } from "@/components/admin/AdminAlertsHistory";
import { DEMO_ADMIN_ALERTS } from "@/lib/data/demo/admin-alerts";

export const dynamic = "force-dynamic";

export default function PreviewAdminAlerts() {
  const { config, history } = DEMO_ADMIN_ALERTS;

  return (
    <div className="min-h-screen bg-base">
      <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
        <div className="space-y-6">
          <AdminTabs />

          <PageHeader
            title="Alerts"
            subtitle="Get notified when competitors make significant moves between weekly scans."
          />

          <AdminAlertsConfig config={config} />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-ink">Recent alerts</h2>
            <AdminAlertsHistory rows={history} />
          </section>
        </div>
      </div>
    </div>
  );
}
