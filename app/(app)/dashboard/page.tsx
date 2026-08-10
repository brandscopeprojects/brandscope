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
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { ScanProgress } from "@/components/dashboard/ScanProgress";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireUser();

  const brand = await getCurrentBrand();
  if (!brand) redirect("/onboarding");

  const data = await getDashboardData(brand);

  // --- Scan running or pending: show progress + real-time module sections ---
  if (!data) {
    const supabase = createClient();
    const { data: latestScan } = await supabase
      .from("scan_jobs")
      .select("id, status, scan_week")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (latestScan && (latestScan.status === "running" || latestScan.status === "pending")) {
      // Dynamic import for client-only component
      const { ModuleStreamingView } = await import("@/components/dashboard/ModuleStreamingView");

      return (
        <div className="space-y-8">
          <DashboardHeader
            brandName={brand.name}
            markets={brand.market}
            scanWeek={null}
            aiVisibility={{ score: null, trend: null }}
          />
          <ScanProgress scanJobId={latestScan.id} brandName={brand.name} />
          <ModuleStreamingView brandId={brand.id} scanWeek={latestScan.scan_week} />
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <DashboardHeader
          brandName={brand.name}
          markets={brand.market}
          scanWeek={null}
          aiVisibility={{ score: null, trend: null }}
        />
      </div>
    );
  }

  return <DashboardView brandName={brand.name} markets={brand.market} data={data} />;
}
