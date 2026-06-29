"use server";

// Action-plan server actions (Screen 15, `/action-plan`).
// Status changes (Accept/Snooze/Dismiss) are reused from the dashboard actions
// (imported directly in the client component), so they are NOT redefined here.
// This file adds logging a real-world OUTCOME for a recommendation.
//
// action_outcomes carries a FOR ALL RLS policy scoped to the user's brand, so we
// write through the USER-SESSION client and rely on RLS — no service-role bypass.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export type LogOutcomeInput = {
  actionTaken: string;
  outcomeMetric?: string;
  outcomeValue?: number;
  outcomeUnit?: string;
  result?: "positive" | "neutral" | "negative";
  notes?: string;
};

export type LogOutcomeResult = { ok: true } | { ok: false; error: string };

function clean(value: string | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

/**
 * Log a real-world outcome for a recommendation. The recommendation's brand_id is
 * resolved server-side (RLS scopes the read to the caller's brand) and reused as
 * the outcome's brand_id, so the insert lands under the same brand scope.
 */
export async function logOutcome(
  recommendationId: string,
  input: LogOutcomeInput,
): Promise<LogOutcomeResult> {
  const user = await requireUser();

  const actionTaken = input.actionTaken?.trim();
  if (!actionTaken) {
    return { ok: false, error: "Describe the action you took." };
  }

  const supabase = createClient();

  // Resolve the recommendation's brand (RLS-scoped read) to scope the outcome.
  const { data: rec, error: recError } = await supabase
    .from("recommendations")
    .select("brand_id")
    .eq("id", recommendationId)
    .maybeSingle();

  if (recError) return { ok: false, error: recError.message };
  if (!rec) return { ok: false, error: "Recommendation not found." };

  const { error } = await supabase.from("action_outcomes").insert({
    recommendation_id: recommendationId,
    brand_id: rec.brand_id,
    action_taken: actionTaken,
    outcome_metric: clean(input.outcomeMetric),
    outcome_value:
      typeof input.outcomeValue === "number" && !Number.isNaN(input.outcomeValue)
        ? input.outcomeValue
        : null,
    outcome_unit: clean(input.outcomeUnit),
    result: input.result ?? null,
    notes: clean(input.notes),
    logged_by: user.id,
    action_taken_at: new Date().toISOString(),
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/action-plan");
  return { ok: true };
}
