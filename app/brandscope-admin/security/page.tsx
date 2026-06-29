// Screen 28 — Internal-admin Security Centre, /brandscope-admin/security.
// SUPER-ADMIN ONLY (stricter than the rest of internal admin). The internal
// layout already enforces requireInternalAdmin and provides the dark shell +
// padded container; this page is content-only but ADDITIONALLY gates super_admin
// (and the data function re-checks as defense-in-depth).
//
// Data is GLOBAL and Class-2 (service-role-only): active_sessions, failed_logins,
// audit_logs, rbac_config — read via the admin client in getInternalSecurity.
// Real values only — honest empty state when no telemetry exists yet.

import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { SecurityStatusStrip } from "@/components/admin/SecurityStatusStrip";
import { SecuritySessionTable } from "@/components/admin/SecuritySessionTable";
import { SecurityFailedLogins } from "@/components/admin/SecurityFailedLogins";
import { SecurityRbacMatrix } from "@/components/admin/SecurityRbacMatrix";
import { SecurityAuditLog } from "@/components/admin/SecurityAuditLog";
import { getInternalSecurity } from "@/lib/data/internal-security";

export const dynamic = "force-dynamic";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-base font-bold text-ink">{children}</h2>
  );
}

export default async function SecurityCentrePage() {
  // Super-admin gate (above the internal-admin layout's requireInternalAdmin).
  const profile = await getCurrentProfile();
  if (profile?.role !== "super_admin") {
    notFound();
  }

  const data = await getInternalSecurity();

  const isEmpty =
    !data ||
    (data.sessions.length === 0 &&
      data.failedLogins.length === 0 &&
      data.auditLog.length === 0 &&
      !data.rbac);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Security Centre"
        subtitle="Active sessions, failed logins, the RBAC matrix and the audit trail."
      />

      {isEmpty || !data ? (
        <EmptyState
          intent="scanning"
          title="No security events yet"
          message="Session, login and audit telemetry appears here as the platform is used."
        />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
