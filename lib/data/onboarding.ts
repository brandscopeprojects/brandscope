import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

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
  return data as string;
}
