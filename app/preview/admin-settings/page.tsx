// Public design preview of the brand-admin Settings screen (Screen 20), populated
// with the RiversBet sample dataset (no auth, no Supabase) so the real
// brand-profile + module-preferences forms are visible against the design brief.
// The form server actions don't run here — that's fine; the populated form is the
// point. NOT linked from the app; for review/demo only.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminSettingsForm } from "@/components/admin/AdminSettingsForm";
import { AdminSettingsPreferences } from "@/components/admin/AdminSettingsPreferences";
import { DEMO_ADMIN_SETTINGS } from "@/lib/data/demo/admin-settings";
import {
  PREFERENCE_MODULES,
  type PreferenceModuleKey,
} from "@/app/(app)/admin/settings/constants";

export const dynamic = "force-dynamic";

// Same mapping as the real page: a missing/null column reads as enabled.
function preferenceToggles(
  preferences: Record<string, unknown> | null,
): Record<PreferenceModuleKey, boolean> {
  const out = {} as Record<PreferenceModuleKey, boolean>;
  for (const mod of PREFERENCE_MODULES) {
    const value = preferences?.[mod.key];
    out[mod.key] = value === null || value === undefined ? true : Boolean(value);
  }
  return out;
}

export default function PreviewAdminSettings() {
  const { brand, preferences } = DEMO_ADMIN_SETTINGS;

  const content = (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Your brand profile, positioning and module preferences."
      />

      <AdminSettingsForm
        initial={{
          name: brand.name,
          domain: brand.domain,
          positioningStatement: brand.positioning_statement ?? "",
          primaryColour: brand.primary_colour ?? "",
          logoUrl: brand.logo_url ?? "",
          scanFrequency: brand.scan_frequency ?? "weekly",
          markets: brand.market ?? [],
        }}
      />

      <AdminSettingsPreferences initial={preferenceToggles(preferences)} />
    </div>
  );

  return (
    <div className="min-h-screen bg-base">
      <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
        <AdminTabs />
        <div className="mt-6">{content}</div>
      </div>
    </div>
  );
}
