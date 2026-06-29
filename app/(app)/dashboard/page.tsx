// Dashboard — the split-field decision surface (Sprint 5, step 37).
// Layout (ui-constraints §5): LEFT ~55% = positioning visuals (Scatter / Radar /
// SOV / Threat); RIGHT ~45% = the action feed. The left answers "where do I
// stand?"; the right answers "what do I do about it?".
//
// Auth: signed-in users only (middleware also gates). No brand yet → /onboarding.
// No scan cache yet (first scan still pending) → an honest "scan running" state,
// NOT fabricated numbers (CLAUDE.md: no fake data inside a v1 page).

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCurrentBrand, getDashboardData } from "@/lib/data/dashboard";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { EmptyState } from "@/components/intelligence/EmptyState";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireUser();

  const brand = await getCurrentBrand();
  if (!brand) redirect("/onboarding");

  const data = await getDashboardData(brand);

  // --- Pre-first-scan empty state (scan_jobs row is pending) ---
  if (!data) {
    return (
      <div className="space-y-8">
        <DashboardHeader
          brandName={brand.name}
          markets={brand.market}
          scanWeek={null}
          aiVisibility={{ score: null, trend: null }}
        />
        <EmptyState
          title="Your first scan is running"
          message={`We're analysing ${brand.name} against your competitors across promotions, traffic, SEO, regulatory and AI visibility. Your evidence-backed action plan will appear here as soon as the weekly scan completes.`}
        />
      </div>
    );
  }

  return <DashboardView brandName={brand.name} markets={brand.market} data={data} />;
}
