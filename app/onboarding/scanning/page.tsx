// Onboarding scanning state (Screen 2) — the ONLY dark screen (bg #141416).
// Requires auth + a configured brand. Looks up the user's brand and its latest
// scan_jobs row server-side, then hands off to the client StatusPoller (polls 5s).
//
// Sprint 3 dependency: no scan pipeline exists yet, so the job stays 'pending' and
// the screen shows the in-progress state indefinitely. That's expected at Sprint 2.

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatusPoller } from "@/components/onboarding/StatusPoller";
import { ChatFab } from "@/components/shell/ChatFab";

export const dynamic = "force-dynamic";

type ScanStatus = "pending" | "running" | "partial" | "completed" | "failed";

export default async function ScanningPage() {
  const user = await requireUser();

  // Resolve the user's brand (service-role: org membership is service-role-only).
  const admin = createAdminClient();
  const { data: memberships } = await admin
    .from("organisation_members")
    .select("organisation_id")
    .eq("profile_id", user.id);

  const orgIds = (memberships ?? []).map((m) => m.organisation_id);
  if (orgIds.length === 0) redirect("/onboarding");

  const { data: brand } = await admin
    .from("brands")
    .select("id")
    .in("organisation_id", orgIds)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!brand) redirect("/onboarding");

  const { data: scan } = await admin
    .from("scan_jobs")
    .select("status, progress_percentage")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // If the scan already completed before this page loaded, skip the animation.
  if (scan?.status === "completed") redirect("/dashboard");

  const initialStatus = (scan?.status as ScanStatus) ?? "pending";
  const initialProgress = scan?.progress_percentage ?? 0;

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: "#141416" }}
    >
      <StatusPoller
        brandId={brand.id}
        initialStatus={initialStatus}
        initialProgress={initialProgress}
      />
      {/* Brand exists from this point on — chat is reachable everywhere. */}
      <ChatFab showOnMobile />
    </main>
  );
}
