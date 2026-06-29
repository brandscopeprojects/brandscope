// Internal-admin layout (/brandscope-admin/*). A separate environment from the
// brand product — NOT nested in the (app) shell, and it never redirects to
// onboarding (internal operators may have no brand). Gate: requireInternalAdmin
// (middleware also gates the path) → internal_admin or super_admin only.
// All data on these pages is global/cross-brand and read via the service-role
// admin client AFTER this role check (Class-2 tables, rls-policies.md).

import { requireInternalAdmin } from "@/lib/auth";
import { InternalShell } from "@/components/admin/InternalShell";

export default async function InternalAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireInternalAdmin();
  return (
    <InternalShell
      operatorEmail={profile.email}
      isSuperAdmin={profile.role === "super_admin"}
    >
      {children}
    </InternalShell>
  );
}
