// Onboarding (Screen 1) — brand-setup wizard. Protected: requires auth.
// Multi-brand: this is BOTH the first-brand signup flow and the "Add brand" flow,
// so we no longer redirect already-onboarded users away — they arrive here to add
// another brand. On success the wizard sets the new brand active and lands the
// user on Portfolio Home. Light theme.

import { requireUser } from "@/lib/auth";
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
  await requireUser();

  return (
    <main className="flex min-h-screen items-center justify-center bg-base px-4 py-10">
      <OnboardingWizard initialDomain={initialDomain} />
    </main>
  );
}
