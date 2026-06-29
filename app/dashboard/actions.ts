"use server";

// Dashboard server actions (Sprint 5, step 37).
// Status changes use the USER-SESSION server client and rely on RLS
// (recommendations_own_brands: brand_id IN get_user_brand_ids()) so a user can
// only mutate their own brand's rows — no service-role bypass needed here.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { RecommendationStatus } from "@/types/view-models";

export type StatusActionResult =
  | { ok: true }
  | { ok: false; error: string };

// Statuses a user can set from the action feed. "open"/"completed" are not
// user-applied from these controls.
const SETTABLE: ReadonlySet<RecommendationStatus> = new Set<RecommendationStatus>([
  "accepted",
  "snoozed",
  "dismissed",
]);

/**
 * Update a recommendation's status (Accept / Snooze / Dismiss).
 * RLS scopes the write to the caller's brand; we also stamp who/when.
 * Snooze parks the card for a week (snoozed_until); other statuses clear it.
 */
export async function updateRecommendationStatus(
  recommendationId: string,
  status: RecommendationStatus,
): Promise<StatusActionResult> {
  const user = await requireUser();
  if (!SETTABLE.has(status)) {
    return { ok: false, error: "Unsupported status change." };
  }

  const supabase = createClient();

  const snoozedUntil =
    status === "snoozed"
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const { error } = await supabase
    .from("recommendations")
    .update({
      status,
      status_changed_at: new Date().toISOString(),
      status_changed_by: user.id,
      snoozed_until: snoozedUntil,
    })
    .eq("id", recommendationId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Generate a marketing asset for a recommendation.
 * The asset pipeline (Drafter → Auditor → Ideogram, /api/assets/generate) lands
 * in Sprint 3. Until then this is an explicit, honest "not yet available" — it
 * does NOT fabricate an asset (CLAUDE.md: never fake with a working-looking
 * placeholder inside a v1 page).
 */
export async function generateAsset(
  recommendationId: string,
): Promise<{ ok: false; error: string }> {
  await requireUser();
  void recommendationId;
  return {
    ok: false,
    error: "Asset generation runs after this week's scan completes.",
  };
}
