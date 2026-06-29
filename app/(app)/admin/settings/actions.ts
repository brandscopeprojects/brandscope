"use server";

// Brand-admin Settings server actions (Screen 20).
// Both `brands` (RLS brands_own_org) and `brand_preferences`
// (RLS brand_preferences_own_brands) are Class-1 brand-scoped tables, so we use
// the USER-SESSION server client and rely on RLS to scope every write to the
// caller's own brand — no service-role bypass. requireBrandAdmin gates the role.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireBrandAdmin } from "@/lib/auth";
import { getCurrentBrand } from "@/lib/data/brand";
import { MARKET_VALUES } from "@/lib/onboarding/constants";
import {
  PREFERENCE_MODULE_KEYS,
  SCAN_FREQUENCY_VALUES,
  type PreferenceModuleKey,
} from "./constants";

export type SettingsActionResult = { ok: true } | { ok: false; error: string };

export type UpdateBrandProfileInput = {
  name: string;
  domain: string;
  positioningStatement: string;
  primaryColour: string;
  logoUrl: string;
  scanFrequency: string;
  markets: string[];
};

export type UpdateBrandPreferencesInput = Record<PreferenceModuleKey, boolean>;

// "example.com" / "https://www.example.com/path" → "example.com". Lowercased,
// strips scheme/www/path. Empty string if nothing usable remains.
function normaliseDomain(raw: string): string {
  let v = raw.trim().toLowerCase();
  if (!v) return "";
  v = v.replace(/^https?:\/\//, "").replace(/^www\./, "");
  v = v.split("/")[0].split("?")[0].split("#")[0];
  return v.trim();
}

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;
const URL_RE = /^https?:\/\/\S+$/;

/**
 * Update the brand profile (name, domain, positioning, colour, logo, scan
 * frequency, markets) on the `brands` row. RLS scopes the write to the caller's
 * org; we also re-resolve the brand id from the session rather than trusting a
 * client-supplied id.
 */
export async function updateBrandProfile(
  input: UpdateBrandProfileInput,
): Promise<SettingsActionResult> {
  await requireBrandAdmin();

  const brand = await getCurrentBrand();
  if (!brand) return { ok: false, error: "No brand found for this account." };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "A brand name is required." };

  const domain = normaliseDomain(input.domain);
  if (!domain) return { ok: false, error: "A valid brand domain is required." };

  const markets = input.markets.filter((m) => MARKET_VALUES.includes(m));
  if (markets.length === 0) {
    return { ok: false, error: "Select at least one market." };
  }

  if (!SCAN_FREQUENCY_VALUES.includes(input.scanFrequency)) {
    return { ok: false, error: "Choose a valid scan frequency." };
  }

  const primaryColour = input.primaryColour.trim();
  if (primaryColour && !HEX_COLOUR.test(primaryColour)) {
    return { ok: false, error: "Primary colour must be a hex value like #2B5CE6." };
  }

  const logoUrl = input.logoUrl.trim();
  if (logoUrl && !URL_RE.test(logoUrl)) {
    return { ok: false, error: "Logo URL must start with http:// or https://." };
  }

  const positioning = input.positioningStatement.trim();
  if (positioning.length > 500) {
    return { ok: false, error: "Positioning statement is too long (max 500)." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("brands")
    .update({
      name,
      domain,
      positioning_statement: positioning || null,
      primary_colour: primaryColour || null,
      logo_url: logoUrl || null,
      scan_frequency: input.scanFrequency,
      market: markets,
      updated_at: new Date().toISOString(),
    })
    .eq("id", brand.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/settings");
  return { ok: true };
}

/**
 * Upsert the brand's module preferences (`brand_preferences`). Creates the row on
 * first save (one row per brand, keyed by brand_id). RLS scopes the upsert.
 */
export async function updateBrandPreferences(
  input: UpdateBrandPreferencesInput,
): Promise<SettingsActionResult> {
  await requireBrandAdmin();

  const brand = await getCurrentBrand();
  if (!brand) return { ok: false, error: "No brand found for this account." };

  // Only accept the known boolean module columns; coerce everything to boolean.
  const toggles: Record<string, boolean> = {};
  for (const key of PREFERENCE_MODULE_KEYS) {
    toggles[key] = Boolean(input[key]);
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("brand_preferences")
    .upsert(
      {
        brand_id: brand.id,
        ...toggles,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "brand_id" },
    );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/settings");
  return { ok: true };
}
