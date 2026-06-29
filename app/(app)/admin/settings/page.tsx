// Brand-admin Settings (Screen 20, /admin/settings). Content-only: the (app)
// shell + admin layout already supply the sidebar, brand header, admin tab nav,
// max-width wrapper and requireBrandAdmin gate. We render the page header plus the
// two editable sections (brand profile + module preferences).

import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { AdminSettingsForm } from "@/components/admin/AdminSettingsForm";
import { AdminSettingsPreferences } from "@/components/admin/AdminSettingsPreferences";
import { getBrandSettings } from "@/lib/data/admin-settings";
import {
  PREFERENCE_MODULES,
  type PreferenceModuleKey,
} from "./constants";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getBrandSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Your brand profile, positioning and module preferences."
      />

      {!settings ? (
        <EmptyState
          title="No brand configured yet"
          message="Complete onboarding to set up your brand before adjusting its settings."
        />
      ) : (
        <>
          <AdminSettingsForm
            initial={{
              name: settings.brand.name,
              domain: settings.brand.domain,
              positioningStatement: settings.brand.positioning_statement ?? "",
              primaryColour: settings.brand.primary_colour ?? "",
              logoUrl: settings.brand.logo_url ?? "",
              scanFrequency: settings.brand.scan_frequency ?? "weekly",
              markets: settings.brand.market ?? [],
            }}
          />

          <AdminSettingsPreferences
            initial={preferenceToggles(settings.preferences)}
          />
        </>
      )}
    </div>
  );
}

// Map the brand_preferences row into the toggle record. A missing row or a null
// column reads as enabled — the module runs unless explicitly turned off.
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
