"use server";

// Internal-admin Competitive Intelligence server actions. All scoring config
// and methodology content writes are gated to internal admins
// (requireInternalAdmin) and use the service-role client — these tables are
// Class-2 (RLS enabled, no policy), reachable only from here.
//
// Config values NEVER get activated automatically. Draft -> Activate is an
// explicit, audited, two-step action a platform admin must take; this Gate 1
// closure only builds the controls — it does not activate anything.

import { revalidatePath } from "next/cache";
import { requireInternalAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MarketPowerScoringConfig } from "@/lib/market-power-engine/types";
import type { Database } from "@/types/database.types";

export type ActionResult = { ok: true } | { ok: false; error: string };

type ScoringConfigInsert = Database["public"]["Tables"]["market_power_scoring_config"]["Insert"];
type ScoringConfigUpdate = Database["public"]["Tables"]["market_power_scoring_config"]["Update"];

const SCORING_CONFIG_FIELDS: Array<keyof MarketPowerScoringConfig> = [
  "weightCustomerActivity",
  "weightAcquisitionPower",
  "weightCommercialPresence",
  "weightCustomerMindshare",
  "percentileMagnitudeAlpha",
  "magnitudeFallbackSpread",
  "minimumOperatorsForUniverse",
  "thresholdDominantMarketStanding",
  "thresholdMidmarketMarketStanding",
  "thresholdChallengerMarketStanding",
  "thresholdDominantOverlap",
  "thresholdMidmarketOverlap",
  "thresholdChallengerOverlap",
  "thresholdChallengerMomentumPressure",
  "overlapWeightProduct",
  "overlapWeightKeyword",
  "overlapWeightChannel",
  "threatWeightOverlap",
  "threatWeightRelativeStrength",
  "threatWeightMomentum",
  "relativeStrengthClampMin",
  "relativeStrengthClampMax",
  "relativeStrengthCenter",
  "relativeStrengthScale",
  "momentumLookbackPeriods",
  "momentumStrongUpwardThreshold",
  "momentumUpwardThreshold",
  "momentumDownwardThreshold",
  "momentumStrongDownwardThreshold",
  "momentumStabilityStddevThreshold",
  "momentumPressureStrongUpward",
  "momentumPressureUpward",
  "missingDimensionCoverageThreshold",
  "standingConfidenceContradictionPenalty",
];

const CAMEL_TO_SNAKE: Record<string, string> = Object.fromEntries(
  SCORING_CONFIG_FIELDS.map((f) => [f, f.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)])
);

/**
 * Creates a new DRAFT config by copying every scoring field from an existing
 * config (active or a prior draft) and applying the caller's edits. Never
 * mutates an existing row — this is how "edit" works once a config is active
 * (the DB trigger also enforces this).
 */
export async function createDraftConfig(input: {
  sourceConfigId: string;
  configName: string;
  edits: Partial<Record<string, number>>;
}): Promise<ActionResult> {
  await requireInternalAdmin();
  const admin = createAdminClient();

  const { data: source, error: sourceErr } = await admin
    .from("market_power_scoring_config")
    .select("*")
    .eq("id", input.sourceConfigId)
    .single();
  if (sourceErr || !source) {
    return { ok: false, error: sourceErr?.message ?? "Source config not found." };
  }

  const { data: maxVersionRow } = await admin
    .from("market_power_scoring_config")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .single();
  const nextVersion = (maxVersionRow?.version ?? 0) + 1;

  const { id: _id, status: _status, activated_at: _a, retired_at: _r, created_at: _c, updated_at: _u, ...sourceRest } =
    source;
  const newRow: ScoringConfigInsert = {
    ...sourceRest,
    version: nextVersion,
    config_name: input.configName,
    status: "draft",
  };

  for (const [key, value] of Object.entries(input.edits)) {
    const snakeKey = CAMEL_TO_SNAKE[key];
    if (snakeKey && typeof value === "number" && Number.isFinite(value)) {
      (newRow as Record<string, unknown>)[snakeKey] = value;
    }
  }

  const { data: inserted, error: insertErr } = await admin
    .from("market_power_scoring_config")
    .insert(newRow)
    .select("id")
    .single();
  if (insertErr || !inserted) {
    return { ok: false, error: insertErr?.message ?? "Failed to create draft." };
  }

  await admin.from("market_power_scoring_config_history").insert({
    config_id: inserted.id,
    change_type: "created",
    new_values: input.edits,
    change_reason: `Draft created from version ${source.version}`,
  });

  revalidatePath("/brandscope-admin/competitive-intelligence");
  return { ok: true };
}

/** Edits a DRAFT config in place. The DB trigger rejects this for active/retired rows. */
export async function updateDraftConfig(input: {
  configId: string;
  edits: Partial<Record<string, number>>;
}): Promise<ActionResult> {
  await requireInternalAdmin();
  const admin = createAdminClient();

  const patch: ScoringConfigUpdate = { updated_at: new Date().toISOString() };
  for (const [key, value] of Object.entries(input.edits)) {
    const snakeKey = CAMEL_TO_SNAKE[key];
    if (snakeKey && typeof value === "number" && Number.isFinite(value)) {
      (patch as Record<string, unknown>)[snakeKey] = value;
    }
  }

  const { error } = await admin
    .from("market_power_scoring_config")
    .update(patch)
    .eq("id", input.configId)
    .eq("status", "draft");
  if (error) return { ok: false, error: error.message };

  await admin.from("market_power_scoring_config_history").insert({
    config_id: input.configId,
    change_type: "edited",
    new_values: input.edits,
  });

  revalidatePath("/brandscope-admin/competitive-intelligence");
  return { ok: true };
}

/**
 * Activates a draft config via the transaction-safe DB function
 * (activate_market_power_config), which atomically retires the current
 * active config and activates the target. That function is EXECUTE-revoked
 * from anon/authenticated — the service-role client (used only here, behind
 * requireInternalAdmin) is the only caller.
 */
export async function activateScoringConfig(input: {
  configId: string;
  reason: string;
  actorProfileId: string;
}): Promise<ActionResult> {
  await requireInternalAdmin();
  if (!input.reason.trim()) {
    return { ok: false, error: "A reason is required to activate a scoring config." };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("activate_market_power_config", {
    target_config_id: input.configId,
    actor_id: input.actorProfileId,
    reason: input.reason.trim(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/brandscope-admin/competitive-intelligence");
  return { ok: true };
}

export async function updateMethodologyContent(input: {
  contentId: string;
  title: string;
  body: string;
  actorProfileId: string;
}): Promise<ActionResult> {
  await requireInternalAdmin();
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) return { ok: false, error: "Title and body are required." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("market_power_methodology_content")
    .update({ title, body, updated_by: input.actorProfileId, updated_at: new Date().toISOString() })
    .eq("id", input.contentId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/brandscope-admin/competitive-intelligence");
  return { ok: true };
}
