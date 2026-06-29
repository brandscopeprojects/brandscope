// Public design preview of Internal-admin System Health (Screen 24,
// `/brandscope-admin/health`), populated with the DEMO_INTERNAL_HEALTH sample.
// No auth/Supabase — renders the SAME Screen-24 components against the demo data,
// wrapped in the dark InternalShell so the distinct internal console (ui-constraints
// §11.3) is shown exactly as the real page renders it. Explicitly demo/sample data.

import { InternalShell } from "@/components/admin/InternalShell";
import { PageHeader } from "@/components/intelligence/PageHeader";
import { HealthStatusStrip } from "@/components/admin/HealthStatusStrip";
import { HealthFeatureTable } from "@/components/admin/HealthFeatureTable";
import { HealthCronTable } from "@/components/admin/HealthCronTable";
import { HealthApiTable } from "@/components/admin/HealthApiTable";
import { DEMO_INTERNAL_HEALTH } from "@/lib/data/demo/internal-health";

export const dynamic = "force-dynamic";

export default function PreviewInternalHealth() {
  const { systemStatus, features, cronJobs, apis } = DEMO_INTERNAL_HEALTH;

  return (
    <InternalShell operatorEmail="ops@brandscope.io" isSuperAdmin={true}>
      <div className="space-y-8">
        <PageHeader
          title="System Health"
          subtitle="Live status across features, cron jobs and external APIs."
        />

        {systemStatus && <HealthStatusStrip status={systemStatus} />}
        <HealthFeatureTable features={features} />
        <HealthCronTable cronJobs={cronJobs} />
        <HealthApiTable apis={apis} />
      </div>
    </InternalShell>
  );
}
