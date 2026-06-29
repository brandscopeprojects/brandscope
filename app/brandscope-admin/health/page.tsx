// Screen 24 — Internal-admin System Health, /brandscope-admin/health.
// The internal-admin layout renders the dark shell, enforces
// requireInternalAdmin, and provides the max-w-[1500px] padded container — so
// this is content-only (no shell, no auth, no width wrapper). It is the internal
// landing page (/brandscope-admin redirects here).
//
// Data is GLOBAL and Class-2 (service-role-only); getInternalHealth reads it via
// the admin client. Real values only — empty state when nothing has run yet.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { HealthStatusStrip } from "@/components/admin/HealthStatusStrip";
import { HealthFeatureTable } from "@/components/admin/HealthFeatureTable";
import { HealthCronTable } from "@/components/admin/HealthCronTable";
import { HealthApiTable } from "@/components/admin/HealthApiTable";
import { getInternalHealth } from "@/lib/data/internal-health";

export const dynamic = "force-dynamic";

export default async function SystemHealthPage() {
  const { systemStatus, features, cronJobs, apis } = await getInternalHealth();

  const isEmpty =
    !systemStatus && features.length === 0 && cronJobs.length === 0 && apis.length === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="System Health"
        subtitle="Live status across features, cron jobs and external APIs."
      />

      {isEmpty ? (
        <EmptyState
          intent="scanning"
          title="No health data yet"
          message="System health metrics populate once the agent pipeline and cron jobs begin running."
        />
      ) : (
        <>
          {systemStatus && <HealthStatusStrip status={systemStatus} />}
          <HealthFeatureTable features={features} />
          <HealthCronTable cronJobs={cronJobs} />
          <HealthApiTable apis={apis} />
        </>
      )}
    </div>
  );
}
