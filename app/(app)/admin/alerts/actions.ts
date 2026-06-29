"use server";

// Brand-admin Alerts server actions (Screen 22).
// alert_configs is Class-1 brand-scoped (RLS alert_configs_own_brands): writes go
// through the USER-SESSION client and RLS scopes them to the caller's brand — no
// service-role bypass. We additionally gate on requireBrandAdmin (role) and scope
// every statement by the brand id from getCurrentBrand for defence in depth.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireBrandAdmin } from "@/lib/auth";
import { getCurrentBrand } from "@/lib/data/brand";
import type { Database } from "@/types/database.types";
import {
  ALERT_TRIGGERS,
  SEED_DEFAULTS,
  THRESHOLD_MIN,
  THRESHOLD_MAX,
  type AlertEnabledColumn,
  type AlertThresholdColumn,
} from "./constants";

type AlertConfigUpdate = Database["public"]["Tables"]["alert_configs"]["Update"];

export type AlertActionResult = { ok: true } | { ok: false; error: string };

const ENABLED_COLUMNS = new Set<AlertEnabledColumn>(
  ALERT_TRIGGERS.map((t) => t.enabledColumn),
);
const THRESHOLD_COLUMNS = new Set<AlertThresholdColumn>(
  ALERT_TRIGGERS.flatMap((t) => (t.thresholdColumn ? [t.thresholdColumn] : [])),
);

export type UpdateAlertConfigInput = {
  /** Enabled column to set, with its new boolean value. */
  enabledColumn?: AlertEnabledColumn;
  isActive?: boolean;
  /** Threshold column to set, with its new numeric value. */
  thresholdColumn?: AlertThresholdColumn;
  threshold?: number;
};

function clampThreshold(value: number): number {
  if (!Number.isFinite(value)) return THRESHOLD_MIN;
  return Math.min(THRESHOLD_MAX, Math.max(THRESHOLD_MIN, Math.round(value)));
}

/**
 * Patch the brand's single alert_configs row by id. Validates that any column
 * referenced is a real, schema-valid enabled/threshold column from the catalogue
 * before building the Update payload — never writes an arbitrary key.
 */
export async function updateAlertConfig(
  id: string,
  input: UpdateAlertConfigInput,
): Promise<AlertActionResult> {
  await requireBrandAdmin();
  const brand = await getCurrentBrand();
  if (!brand) return { ok: false, error: "No brand in session." };

  const patch: AlertConfigUpdate = {};

  if (input.enabledColumn !== undefined && input.isActive !== undefined) {
    if (!ENABLED_COLUMNS.has(input.enabledColumn)) {
      return { ok: false, error: "Unknown alert trigger." };
    }
    patch[input.enabledColumn] = input.isActive;
  }

  if (input.thresholdColumn !== undefined && input.threshold !== undefined) {
    if (!THRESHOLD_COLUMNS.has(input.thresholdColumn)) {
      return { ok: false, error: "Unknown threshold field." };
    }
    patch[input.thresholdColumn] = clampThreshold(input.threshold);
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  patch.updated_at = new Date().toISOString();

  const supabase = createClient();
  const { error } = await supabase
    .from("alert_configs")
    .update(patch)
    .eq("id", id)
    .eq("brand_id", brand.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/alerts");
  return { ok: true };
}

/** Convenience wrapper: toggle a single trigger's active flag. */
export async function toggleAlertActive(
  id: string,
  enabledColumn: AlertEnabledColumn,
  isActive: boolean,
): Promise<AlertActionResult> {
  return updateAlertConfig(id, { enabledColumn, isActive });
}

/**
 * Create the brand's alert_configs row with the standard MVP trigger defaults.
 * Only runs when the brand has no config row yet; inserts a single real,
 * schema-valid row (brand_id is required and unique). RLS scopes the insert to
 * the caller's brand.
 */
export async function seedDefaultAlertConfigs(): Promise<AlertActionResult> {
  await requireBrandAdmin();
  const brand = await getCurrentBrand();
  if (!brand) return { ok: false, error: "No brand in session." };

  const supabase = createClient();

  // Guard against a double-seed (brand_id is unique → a second insert would 409).
  const { data: existing } = await supabase
    .from("alert_configs")
    .select("id")
    .eq("brand_id", brand.id)
    .maybeSingle();
  if (existing) {
    revalidatePath("/admin/alerts");
    return { ok: true };
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("alert_configs").insert({
    brand_id: brand.id,
    ...SEED_DEFAULTS,
    created_at: now,
    updated_at: now,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/alerts");
  return { ok: true };
}

/** Toggle the brand's email delivery channel on the single config row. */
export async function setEmailDelivery(
  id: string,
  enabled: boolean,
): Promise<AlertActionResult> {
  await requireBrandAdmin();
  const brand = await getCurrentBrand();
  if (!brand) return { ok: false, error: "No brand in session." };

  const supabase = createClient();
  const { error } = await supabase
    .from("alert_configs")
    .update({ email_enabled: enabled, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("brand_id", brand.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/alerts");
  return { ok: true };
}
