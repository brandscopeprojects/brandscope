// Brand-admin Alerts Config (Screen 22, /admin/alerts). Content-only — the admin
// layout supplies tabs, space-y-6 and the requireBrandAdmin gate. Reads the brand's
// single alert_configs row (projected to a trigger list) + recent alert_history via
// the RLS-scoped user-session client, and renders the editable config + history.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { AdminAlertsConfig } from "@/components/admin/AdminAlertsConfig";
import { AdminAlertsHistory } from "@/components/admin/AdminAlertsHistory";
import { getAlertConfigs, getAlertHistory } from "@/lib/data/admin-alerts";

export const dynamic = "force-dynamic";

export default async function AdminAlertsPage() {
  const [config, history] = await Promise.all([
    getAlertConfigs(),
    getAlertHistory(),
  ]);

  return (
    <>
      <PageHeader
        title="Alerts"
        subtitle="Get notified when competitors make significant moves between weekly scans."
      />

      <AdminAlertsConfig config={config} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">Recent alerts</h2>
        <AdminAlertsHistory rows={history} />
      </section>
    </>
  );
}
