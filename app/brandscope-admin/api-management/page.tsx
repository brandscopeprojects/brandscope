// Internal admin — API Management (Screen 26, /brandscope-admin/api-management).
// External provider health, model routing and circuit breakers. Dark shell +
// requireInternalAdmin + padded container come from the internal-admin layout;
// this is content-only. All data is global, Class-2 (service-role-only) and read
// via createAdminClient inside lib/data/internal-api.ts AFTER the layout's gate.
//
// Cost analytics is intentionally OMITTED: there is no api_cost_logs / cost_logs
// table in this schema, so we surface an honest note rather than fabricate spend.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { getInternalApiData } from "@/lib/data/internal-api";
import { ApiMgmtHealthCards } from "@/components/admin/ApiMgmtHealthCards";
import { ApiMgmtRouterTable } from "@/components/admin/ApiMgmtRouterTable";
import { ApiMgmtCircuitBreaker } from "@/components/admin/ApiMgmtCircuitBreaker";

export const dynamic = "force-dynamic";

export default async function ApiManagementPage() {
  const { health, routerRules } = await getInternalApiData();

  const isEmpty = health.length === 0 && routerRules.length === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="API Management"
        subtitle="External provider health, model routing and circuit breakers."
      />

      {isEmpty ? (
        <EmptyState
          intent="scanning"
          title="No API telemetry yet"
          message="Provider health and routing config populate once external calls begin."
        />
      ) : (
        <>
          {health.length > 0 && <ApiMgmtHealthCards health={health} />}

          {routerRules.length > 0 && <ApiMgmtRouterTable rules={routerRules} />}

          {health.length > 0 && <ApiMgmtCircuitBreaker health={health} />}

          <p className="text-xs leading-5 text-ink-faint">
            Cost analytics arrives with the metering pipeline — no per-call spend is
            recorded yet, so none is shown here.
          </p>
        </>
      )}
    </div>
  );
}
