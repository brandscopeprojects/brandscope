// Public design preview of the internal-admin Security Centre (Screen 28),
// populated with the DEMO_INTERNAL_SECURITY sample dataset. No auth/Supabase and
// NO super-admin gate — the preview renders the SAME Screen-28 components
// directly, wrapped in the internal-admin shell so the distinct, data-dense
// internal visual language (§11.3) is visible. Explicitly demo/sample data.

import { InternalShell } from "@/components/admin/InternalShell";
import { PageHeader } from "@/components/intelligence/PageHeader";
import { SecurityStatusStrip } from "@/components/admin/SecurityStatusStrip";
import { SecuritySessionTable } from "@/components/admin/SecuritySessionTable";
import { SecurityFailedLogins } from "@/components/admin/SecurityFailedLogins";
import { SecurityRbacMatrix } from "@/components/admin/SecurityRbacMatrix";
import { SecurityAuditLog } from "@/components/admin/SecurityAuditLog";
import { DEMO_INTERNAL_SECURITY } from "@/lib/data/demo/internal-security";

export const dynamic = "force-dynamic";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-base font-bold text-ink">{children}</h2>
  );
}

export default function PreviewInternalSecurity() {
  const data = DEMO_INTERNAL_SECURITY;

  return (
    <InternalShell operatorEmail="ops@brandscope.io" isSuperAdmin>
      <div className="space-y-8">
        <PageHeader
          title="Security Centre"
          subtitle="Active sessions, failed logins, the RBAC matrix and the audit trail."
        />

        <SecurityStatusStrip stats={data.stats} />

        <section className="space-y-3">
          <SectionTitle>Active sessions</SectionTitle>
          <SecuritySessionTable sessions={data.sessions} />
        </section>

        <section className="space-y-3">
          <SectionTitle>Failed logins</SectionTitle>
          <SecurityFailedLogins rows={data.failedLogins} />
        </section>

        {data.rbac && (
          <section className="space-y-3">
            <SectionTitle>RBAC matrix</SectionTitle>
            <SecurityRbacMatrix matrix={data.rbac} />
          </section>
        )}

        <section className="space-y-3">
          <SectionTitle>Audit trail</SectionTitle>
          <SecurityAuditLog rows={data.auditLog} />
        </section>
      </div>
    </InternalShell>
  );
}
