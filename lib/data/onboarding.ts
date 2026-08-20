import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncBrandMarkets } from "@/lib/data/brand-markets";

export type ProvisionBrandInput = {
  userId: string;
  orgName: string;
  brandName: string;
  domain: string;
  markets: string[]; // e.g. ['nigeria','kenya']
  industry?: string; // default 'igaming'
  tier?: string; // default 'challenger'
};

/**
 * Creates an organisation + owner membership + brand in a single transaction
 * (via the provision_brand RPC). The brand insert triggers handle_new_brand(),
 * which seeds brand_preferences and alert_configs. Returns the new brand id.
 *
 * Server-side only — uses the service role (organisations/members are service-role-only).
 * The onboarding flow (Sprint 2) calls this after the user signs up.
 */
export async function provisionBrand(input: ProvisionBrandInput): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("provision_brand", {
    p_user_id: input.userId,
    p_org_name: input.orgName,
    p_brand_name: input.brandName,
    p_domain: input.domain,
    p_markets: input.markets,
    p_industry: input.industry ?? "igaming",
    p_tier: input.tier ?? "challenger",
  });
  if (error) {
    throw new Error(`provision_brand failed: ${error.message}`);
  }
  const brandId = data as string;
  // Bounded dual-write (Gate 1 closure) — brands.market stays authoritative;
  // keep brand_markets in sync so it never goes stale. See lib/data/brand-markets.ts.
  await syncBrandMarkets(brandId, input.markets);
  return brandId;
}

export type AddBrandInput = {
  orgId: string;
  brandName: string;
  domain: string;
  markets: string[];
  industry?: string;
  tier?: string;
};

/**
 * Add an ADDITIONAL brand to an EXISTING organisation (multi-brand: the user's
 * first brand provisions the org via provision_brand; subsequent brands attach
 * here rather than spawning a new org). The brand insert fires handle_new_brand()
 * which seeds brand_preferences + alert_configs, same as provision_brand. Returns
 * the new brand id. Service-role only.
 */
export async function addBrandToOrg(input: AddBrandInput): Promise<string> {
  const admin = createAdminClient();
  const base = input.brandName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "brand";
  const slug = `${base}-${crypto.randomUUID().slice(0, 6)}`;
  const { data, error } = await admin
    .from("brands")
    .insert({
      organisation_id: input.orgId,
      name: input.brandName,
      domain: input.domain,
      slug,
      market: input.markets,
      industry: input.industry ?? "igaming",
      tier: input.tier ?? "challenger",
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`add brand failed: ${error?.message ?? "no row returned"}`);
  }
  const brandId = data.id as string;
  await syncBrandMarkets(brandId, input.markets);
  return brandId;
}
