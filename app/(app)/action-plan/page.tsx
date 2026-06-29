// Action Plan — Screen 15 (`/action-plan`). The full, persistent view of EVERY
// recommendation this week (all statuses), with evidence and the ability to log a
// real-world outcome per action. The dashboard right-rail shows only open items;
// this page is the complete, working record.
//
// Auth + brand gating + the shell live in app/(app)/layout.tsx. Before the first
// scan produces an action plan, we render the honest "scanning" empty state —
// never fabricated recommendations (CLAUDE.md: no fake data inside a v1 page).

import { getCurrentBrand } from "@/lib/data/brand";
import { getActionPlanData } from "@/lib/data/action-plan";
import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { ActionPlanFeed } from "@/components/intelligence/ActionPlanFeed";

export const dynamic = "force-dynamic";

const SUBTITLE =
  "Every recommendation this week, with evidence and outcomes.";

export default async function ActionPlanPage() {
  const brand = await getCurrentBrand();
  // Layout already redirects when there's no brand; this guards a direct render.
  if (!brand) return null;

  const data = await getActionPlanData(brand);

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Action Plan" subtitle={SUBTITLE} />
        <EmptyState
          intent="scanning"
          title="No action plan yet"
          message="Your weekly scan produces a ranked, evidence-backed action plan. It will appear here after the first scan."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Action Plan" subtitle={SUBTITLE} scanWeek={data.scanWeek} />
      <ActionPlanFeed
        recommendations={data.recommendations}
        outcomesByRecId={data.outcomesByRecId}
      />
    </div>
  );
}
