// Authenticated brand-facing layout (route group `(app)`). Applies to every
// brand intelligence page (Dashboard + modules) but NOT to /login or /onboarding
// (those live outside the group). Gates: signed-in user (middleware also enforces)
// and a provisioned brand — no brand yet → /onboarding. Renders the shared shell;
// getCurrentBrand is React-cache()'d so pages reuse this request's query.

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCurrentBrand } from "@/lib/data/brand";
import { AppShell } from "@/components/shell/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  const brand = await getCurrentBrand();
  if (!brand) redirect("/onboarding");

  return (
    <AppShell brandName={brand.name} markets={brand.market}>
      {children}
    </AppShell>
  );
}
