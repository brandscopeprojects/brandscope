// Onboarding (Screen 1) — 5-step brand-setup wizard. Protected: requires auth.
// If the user already has a completed brand, send them on (scanning if a scan is
// still in flight, else the dashboard). Light theme.

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: { domain?: string };
}) {
  // Domain handed over from the homepage hero form ("scan my market").
  const initialDomain = (searchParams?.domain ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .slice(0, 253);
  const user = await requireUser();

  // Look up any brand this user already owns (org membership → brand).
  // profiles/organisation_members are service-role-only, so use the admin client,
  // scoped to this user's id.
  const admin = createAdminClient();
  const { data: memberships } = await admin
    .from("organisation_members")
    .select("organisation_id")
    .eq("profile_id", user.id);

  const orgIds = (memberships ?? []).map((m) => m.organisation_id);
  if (orgIds.length > 0) {
    const { data: brand } = await admin
      .from("brands")
      .select("id, onboarding_completed_at")
      .in("organisation_id", orgIds)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (brand?.onboarding_completed_at) {
      // Already onboarded — go to scanning if a scan is still pending, else dashboard.
      redirect("/onboarding/scanning");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-base px-4 py-10">
      <OnboardingWizard initialDomain={initialDomain} />
    </main>
  );
}
