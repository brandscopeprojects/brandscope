// Public design preview of the Brand-admin Competitors page (Screen 21,
// /admin/competitors), populated with the RiversBet sample dataset (no auth, no
// Supabase, no admin gate) so the real manager component is visible against the
// design brief. NOT linked from the app; for review/demo only. Mirrors the real
// page's composition (PageHeader + AdminCompetitorsManager) inside the brand-admin
// shell wrapper (bg-base + max-w-[1100px] + AdminTabs on top). The competitors are
// COMPETITORS, so cobalt stays off their names — it marks the primary "Add
// competitor" CTA and the source/domain links only. The add/remove/reorder server
// actions are inert here (no session); the page is for visual review.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminCompetitorsManager } from "@/components/admin/AdminCompetitorsManager";
import { DEMO_ADMIN_COMPETITORS } from "@/lib/data/demo/admin-competitors";

export const dynamic = "force-dynamic";

export default function PreviewAdminCompetitors() {
  const data = DEMO_ADMIN_COMPETITORS;

  return (
    <div className="min-h-screen bg-base">
      <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
        <div className="space-y-6">
          <AdminTabs />
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
        </div>
      </div>
    </div>
  );
}
