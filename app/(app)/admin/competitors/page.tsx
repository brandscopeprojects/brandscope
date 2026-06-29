// Screen 21 — Brand-admin Competitors (/admin/competitors). Content-only: the
// admin layout already renders the tab sub-nav, space-y-6 wrapper and enforces
// requireBrandAdmin. Lists the competitors tracked in the weekly scan (up to 10)
// and lets the admin add/remove/reorder them.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { AdminCompetitorsManager } from "@/components/admin/AdminCompetitorsManager";
import { getCurrentBrand } from "@/lib/data/brand";
import { getAdminCompetitors } from "@/lib/data/admin-competitors";

export const dynamic = "force-dynamic";

export default async function AdminCompetitorsPage() {
  const brand = await getCurrentBrand();

  if (!brand) {
    return (
      <>
        <PageHeader
          title="Competitors"
          subtitle="The competitors tracked in your weekly scan (up to 10)."
        />
        <p className="text-sm text-ink-secondary">
          No brand is set up for this account yet.
        </p>
      </>
    );
  }

  const data = await getAdminCompetitors(brand.id);

  return (
    <>
      <PageHeader
        title="Competitors"
        subtitle="The competitors tracked in your weekly scan (up to 10)."
      />
      <AdminCompetitorsManager
        competitors={data.competitors}
        count={data.count}
        max={data.max}
        atCap={data.atCap}
      />
    </>
  );
}
