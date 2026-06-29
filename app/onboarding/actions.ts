"use server";

// Onboarding server actions (Sprint 2, steps 9 & 10).
// All privileged writes use the service-role admin client and are scoped by brand_id
// in code (RLS does not protect service-role). External provider calls (DataForSEO)
// are server-side only — none are wired at MVP Sprint 2 (see competitor-tier seam).

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionBrand } from "@/lib/data/onboarding";
import {
  detectBrandFromDomain,
  normaliseDomain,
  brandNameFromDomain,
  type CompetitorTier,
} from "@/lib/data/competitor-tier";
import {
  COMPETITOR_MAX,
  MARKET_VALUES,
  type DetectedBrandResult,
} from "./action-types";

/**
 * Step 10 — auto-detect a competitor's display name + tier from a domain.
 * Returns the derived name and a tier (default `challenger` until the DataForSEO
 * seam in lib/data/competitor-tier.ts is wired in Sprint 3). Field stays editable.
 */
export async function detectBrand(domain: string): Promise<DetectedBrandResult> {
  await requireUser(); // any signed-in user; no brand needed yet
  const detected = await detectBrandFromDomain(domain);
  return { domain: detected.domain, name: detected.name, tier: detected.tier };
}

export type CompetitorInput = {
  domain: string;
  name: string;
  tier: CompetitorTier;
};

export type CompleteOnboardingInput = {
  brandDomain: string;
  brandName: string;
  markets: string[];
  industry: string;
  competitors: CompetitorInput[];
};

export type CompleteOnboardingResult =
  | { ok: true; brandId: string }
  | { ok: false; error: string };

/** Monday (UTC) of the week containing `date`, as a YYYY-MM-DD string. */
function mondayOfWeek(date: Date): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = d.getUTCDay(); // 0 = Sun … 6 = Sat
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Step 9 — create the brand + competitors and the first scan_jobs trigger row.
 * 1. provision_brand RPC (org + owner membership + brand; seeds prefs/alerts).
 * 2. upsert each competitor (one row per domain, onConflict 'domain') + link via
 *    brand_competitors (priority = entry order). Enforces COMPETITOR_MAX server-side.
 * 3. create a pending scan_jobs row (triggered_by 'cron', scan_week = this Monday).
 * 4. set brands.onboarding_completed_at = now().
 *
 * Step 12 — the scan_jobs row IS the trigger record. The scan pipeline is Sprint 3;
 * we do NOT invoke any pipeline/Edge Function here, so the job stays 'pending'.
 */
export async function completeOnboarding(
  input: CompleteOnboardingInput,
): Promise<CompleteOnboardingResult> {
  const user = await requireUser();

  // --- validate input (server-side) ---
  const brandDomain = normaliseDomain(input.brandDomain);
  if (!brandDomain) return { ok: false, error: "A brand domain is required." };

  const brandName = input.brandName.trim() || brandNameFromDomain(brandDomain);
  if (!brandName) return { ok: false, error: "A brand name is required." };

  const markets = input.markets.filter((m) => MARKET_VALUES.includes(m));
  if (markets.length === 0) {
    return { ok: false, error: "Select at least one market." };
  }

  const industry = input.industry || "igaming";
  if (industry !== "igaming") {
    // Only iGaming ships at MVP; other verticals are "coming soon".
    return { ok: false, error: "Only iGaming is available at this time." };
  }

  // Normalise + dedupe competitors by domain; cap at COMPETITOR_MAX.
  const seen = new Set<string>();
  const competitors: CompetitorInput[] = [];
  for (const c of input.competitors) {
    const domain = normaliseDomain(c.domain);
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    competitors.push({
      domain,
      name: c.name.trim() || brandNameFromDomain(domain),
      tier: c.tier,
    });
    if (competitors.length >= COMPETITOR_MAX) break;
  }

  const admin = createAdminClient();

  // --- 1. provision the brand (org + membership + brand) ---
  let brandId: string;
  try {
    brandId = await provisionBrand({
      userId: user.id,
      orgName: brandName, // org defaults to brand name at MVP (single brand/org)
      brandName,
      domain: brandDomain,
      markets,
      industry,
      tier: "challenger", // own-brand tier; same heuristic as competitors, default at MVP
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create brand.",
    };
  }

  // --- 2. upsert competitors + link to the brand ---
  for (let i = 0; i < competitors.length; i++) {
    const c = competitors[i];
    const { data: competitorRow, error: upsertErr } = await admin
      .from("competitors")
      .upsert(
        {
          domain: c.domain,
          name: c.name,
          tier: c.tier,
          industry,
          primary_market: markets[0],
        },
        { onConflict: "domain" },
      )
      .select("id")
      .single();

    if (upsertErr || !competitorRow) {
      return {
        ok: false,
        error: `Failed to save competitor ${c.domain}: ${
          upsertErr?.message ?? "unknown error"
        }`,
      };
    }

    const { error: linkErr } = await admin.from("brand_competitors").upsert(
      {
        brand_id: brandId,
        competitor_id: competitorRow.id,
        priority: i + 1,
      },
      { onConflict: "brand_id,competitor_id" },
    );
    if (linkErr) {
      return {
        ok: false,
        error: `Failed to link competitor ${c.domain}: ${linkErr.message}`,
      };
    }
  }

  // --- 3. create the first scan_jobs trigger row (Step 12) ---
  // TODO(Sprint 3): the weekly cron / Supervisor picks up this 'pending' row and
  // runs the scan pipeline. We do NOT invoke any Edge Function here.
  const { error: scanErr } = await admin.from("scan_jobs").insert({
    brand_id: brandId,
    status: "pending",
    triggered_by: "cron",
    scan_week: mondayOfWeek(new Date()),
    progress_percentage: 0,
  });
  if (scanErr) {
    return { ok: false, error: `Failed to queue first scan: ${scanErr.message}` };
  }

  // --- 4. mark onboarding complete ---
  const { error: completeErr } = await admin
    .from("brands")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", brandId);
  if (completeErr) {
    return { ok: false, error: `Failed to finalise onboarding: ${completeErr.message}` };
  }

  return { ok: true, brandId };
}
