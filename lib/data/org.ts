import "server-only";
import { cache } from "react";
import { getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Org-context helper for brand-admin Billing. subscriptions / payment_history /
// usage_metrics are Class-2 (service-role-only, organisation-scoped) — they must
// be read via the admin client after a role check, scoped by organisation_id in
// code. This resolves the signed-in user's organisation_id. React cache()'d.

export const getCurrentOrganisationId = cache(async function getCurrentOrganisationId(): Promise<
  string | null
> {
  const user = await getSessionUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("organisation_members")
    .select("organisation_id")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  return data?.organisation_id ?? null;
});
