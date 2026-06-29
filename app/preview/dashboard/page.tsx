// Public design preview of the dashboard, populated with the RiversBet sample
// dataset (no auth, no Supabase) so the real components are visible against the
// design brief. NOT linked from the app; for review/demo only.

import { DashboardView } from "@/components/dashboard/DashboardView";
import { DEMO_BRAND, DEMO_DASHBOARD } from "@/lib/data/demo";

export const dynamic = "force-dynamic";

export default function PreviewDashboard() {
  return (
    <div className="min-h-screen bg-base">
      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6">
        <DashboardView
          brandName={DEMO_BRAND.name}
          markets={DEMO_BRAND.market}
          data={DEMO_DASHBOARD}
        />
      </div>
    </div>
  );
}
