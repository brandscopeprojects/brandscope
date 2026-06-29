// Public design preview of the internal-admin API Management screen (Screen 26,
// /brandscope-admin/api-management), populated with the sample dataset. No
// auth/Supabase — renders the SAME Screen-26 components against
// DEMO_INTERNAL_API, wrapped in the InternalShell frame so the data-dense
// internal-admin visual language (ui-constraints §11.3) is visible. Explicitly
// demo/sample data; NOT linked from the app.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { InternalShell } from "@/components/admin/InternalShell";
import { ApiMgmtHealthCards } from "@/components/admin/ApiMgmtHealthCards";
import { ApiMgmtRouterTable } from "@/components/admin/ApiMgmtRouterTable";
import { ApiMgmtCircuitBreaker } from "@/components/admin/ApiMgmtCircuitBreaker";
import { DEMO_INTERNAL_API } from "@/lib/data/demo/internal-api";

export const dynamic = "force-dynamic";

export default function PreviewInternalApi() {
  const { health, routerRules } = DEMO_INTERNAL_API;

  const content = (
    <div className="space-y-8">
      <PageHeader
        title="API Management"
        subtitle="External provider health, model routing and circuit breakers."
      />

      <ApiMgmtHealthCards health={health} />

      <ApiMgmtRouterTable rules={routerRules} />

      <ApiMgmtCircuitBreaker health={health} />

      <p className="text-xs leading-5 text-ink-faint">
        Cost analytics arrives with the metering pipeline — no per-call spend is
        recorded yet, so none is shown here.
      </p>
    </div>
  );

  return (
    <InternalShell operatorEmail="ops@brandscope.io" isSuperAdmin={true}>
      {content}
    </InternalShell>
  );
}
