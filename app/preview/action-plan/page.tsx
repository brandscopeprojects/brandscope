// Public design preview of the Action Plan (#4), populated with the RiversBet
// sample data so the real components are visible. No auth/Supabase.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { ActionPlanFeed } from "@/components/intelligence/ActionPlanFeed";
import { DEMO_ACTION_PLAN } from "@/lib/data/demo";

export const dynamic = "force-dynamic";

export default function PreviewActionPlan() {
  return (
    <div className="min-h-screen bg-base">
      <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
        <div className="space-y-6">
          <PageHeader
            title="Action Plan"
            subtitle="Every recommendation this week, with evidence and outcomes."
            scanWeek={DEMO_ACTION_PLAN.scanWeek}
          />
          <ActionPlanFeed
            recommendations={DEMO_ACTION_PLAN.recommendations}
            outcomesByRecId={DEMO_ACTION_PLAN.outcomesByRecId}
          />
        </div>
      </div>
    </div>
  );
}
