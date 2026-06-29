"use server";

// Brand-admin Competitors actions (Screen 21, /admin/competitors).
//
// RLS classes (rls-policies.md):
//   - brand_competitors  → Class-1 (own_brands user-session RLS). Reads + the
//     DELETE on remove use the USER-SESSION client; RLS scopes them to the brand.
//   - competitors        → Class-3 SHARED reference: reads OK via user-session,
//     but WRITES (upsert) are service-role-only → the ADMIN client.
//
// addCompetitor mirrors app/onboarding/actions.ts: upsert competitors (onConflict
// 'domain') via the admin client, then link via brand_competitors (priority =
// next). The cap (COMPETITOR_MAX) is enforced server-side. We NEVER delete the
// shared competitors row on remove — only the brand's link.

import { revalidatePath } from "next/cache";
import { requireBrandAdmin } from "@/lib/auth";
import { getCurrentBrand } from "@/lib/data/brand";
import { getBrandCompetitors } from "@/lib/data/competitors";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normaliseDomain,
  brandNameFromDomain,
  type CompetitorTier,
} from "@/lib/data/competitor-tier";
import { COMPETITOR_MAX } from "@/lib/onboarding/constants";

const TIERS: ReadonlySet<CompetitorTier> = new Set<CompetitorTier>([
  "dominant",
  "challenger",
  "mid_market",
  "niche",
]);

export type CompetitorActionResult = { ok: true } | { ok: false; error: string };

export type AddCompetitorInput = {
  domain: string;
  name: string;
  tier: CompetitorTier;
};

/**
 * Add a competitor to the brand's tracked set.
 * 1. Enforce the cap (current count < COMPETITOR_MAX).
 * 2. Upsert the shared competitors row (onConflict 'domain') via the admin client.
 * 3. Link via brand_competitors (priority = max existing + 1) via the admin client
 *    (brand_competitors is service-role-safe here; scoped by brand_id in code).
 */
export async function addCompetitor(
  input: AddCompetitorInput,
): Promise<CompetitorActionResult> {
  await requireBrandAdmin();
  const brand = await getCurrentBrand();
  if (!brand) return { ok: false, error: "No brand found for this account." };

  const domain = normaliseDomain(input.domain);
  if (!domain) return { ok: false, error: "A competitor domain is required." };

  const name = input.name.trim() || brandNameFromDomain(domain);
  if (!name) return { ok: false, error: "A competitor name is required." };

  const tier: CompetitorTier = TIERS.has(input.tier) ? input.tier : "challenger";

  // --- 1. cap + duplicate check (against the brand's current set) ---
  const existing = await getBrandCompetitors(brand.id);
  if (existing.length >= COMPETITOR_MAX) {
    return {
      ok: false,
      error: `You can track up to ${COMPETITOR_MAX} competitors. Remove one to add another.`,
    };
  }
  if (existing.some((c) => c.domain === domain)) {
    return { ok: false, error: `${domain} is already being tracked.` };
  }

  const admin = createAdminClient();
  const primaryMarket = brand.market[0] ?? null;

  // --- 2. upsert the shared competitors row (service-role-only write) ---
  const { data: competitorRow, error: upsertErr } = await admin
    .from("competitors")
    .upsert(
      {
        domain,
        name,
        tier,
        industry: "igaming",
        primary_market: primaryMarket,
      },
      { onConflict: "domain" },
    )
    .select("id")
    .single();

  if (upsertErr || !competitorRow) {
    return {
      ok: false,
      error: `Failed to save competitor: ${upsertErr?.message ?? "unknown error"}`,
    };
  }

  // --- 3. link to the brand (priority = next) ---
  const nextPriority =
    existing.reduce((max, c) => (c.priority > max ? c.priority : max), 0) + 1;

  const { error: linkErr } = await admin.from("brand_competitors").upsert(
    {
      brand_id: brand.id,
      competitor_id: competitorRow.id,
      priority: nextPriority,
    },
    { onConflict: "brand_id,competitor_id" },
  );
  if (linkErr) {
    return { ok: false, error: `Failed to track competitor: ${linkErr.message}` };
  }

  revalidatePath("/admin/competitors");
  return { ok: true };
}

/**
 * Stop tracking a competitor: delete the brand_competitors link only.
 * Uses the USER-SESSION client — brand_competitors_own_brands RLS scopes the
 * delete to the caller's brand. The shared competitors row is NOT touched.
 */
export async function removeCompetitor(
  competitorId: string,
): Promise<CompetitorActionResult> {
  await requireBrandAdmin();
  const brand = await getCurrentBrand();
  if (!brand) return { ok: false, error: "No brand found for this account." };

  const supabase = createClient();
  const { error } = await supabase
    .from("brand_competitors")
    .delete()
    .eq("brand_id", brand.id)
    .eq("competitor_id", competitorId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/competitors");
  return { ok: true };
}

/**
 * Move a competitor up/down by swapping its priority with the adjacent neighbour.
 * Uses the USER-SESSION client (brand_competitors_own_brands RLS). No-op if the
 * competitor is already at the edge in the requested direction.
 */
export async function reorderCompetitor(
  competitorId: string,
  direction: "up" | "down",
): Promise<CompetitorActionResult> {
  await requireBrandAdmin();
  const brand = await getCurrentBrand();
  if (!brand) return { ok: false, error: "No brand found for this account." };

  const ordered = await getBrandCompetitors(brand.id);
  const index = ordered.findIndex((c) => c.id === competitorId);
  if (index === -1) return { ok: false, error: "Competitor not found." };

  const neighbourIndex = direction === "up" ? index - 1 : index + 1;
  if (neighbourIndex < 0 || neighbourIndex >= ordered.length) {
    return { ok: true }; // already at the edge — nothing to do
  }

  const current = ordered[index];
  const neighbour = ordered[neighbourIndex];
  const supabase = createClient();

  // Swap the two priorities.
  const { error: e1 } = await supabase
    .from("brand_competitors")
    .update({ priority: neighbour.priority })
    .eq("brand_id", brand.id)
    .eq("competitor_id", current.id);
  if (e1) return { ok: false, error: e1.message };

  const { error: e2 } = await supabase
    .from("brand_competitors")
    .update({ priority: current.priority })
    .eq("brand_id", brand.id)
    .eq("competitor_id", neighbour.id);
  if (e2) return { ok: false, error: e2.message };

  revalidatePath("/admin/competitors");
  return { ok: true };
}
