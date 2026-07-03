import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

// Public design preview of the onboarding wizard (no auth, no writes on render).
// Interactive detection/submit call real server actions and will no-op without
// a session — this route exists to review the layout only.
export default function OnboardingPreview() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-base px-4 py-10">
      <OnboardingWizard />
    </main>
  );
}
