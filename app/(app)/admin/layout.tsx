// Brand-admin layout (/admin/*). Nests inside the (app) shell (sidebar + brand
// header already provided by app/(app)/layout.tsx) and adds the admin tab sub-nav.
// Second gate: requireBrandAdmin (middleware also gates /admin) — brand_admin or
// super_admin only; others are redirected to /unauthorized.

import { requireBrandAdmin } from "@/lib/auth";
import { AdminTabs } from "@/components/admin/AdminTabs";

export default async function BrandAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireBrandAdmin();
  return (
    <div className="space-y-6">
      <AdminTabs />
      {children}
    </div>
  );
}
