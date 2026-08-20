import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Internal-admin "Competitive Intelligence" back-office data layer. All tables
// read here are Class-2 service-role-only (market_power_scoring_config,
// market_power_scoring_config_history, market_power_methodology_content,
// operator_market_presence_evidence) or already gated by requireInternalAdmin
// at the layout — read via the service-role admin client, same pattern as
// getKnowledgeBaseData.

export type ScoringConfigRow = {
  id: string;
  version: number;
  configName: string;
  status: "draft" | "active" | "retired";
  activatedAt: string | null;
  retiredAt: string | null;
  createdAt: string;
};

export type ScoringConfigHistoryRow = {
  id: string;
  configId: string;
  configVersion: number;
  changedByEmail: string | null;
  changeType: string;
  changeReason: string | null;
  createdAt: string;
};

export type MethodologyContentRow = {
  id: string;
  contentKey: string;
  title: string;
  body: string;
  drawerSection: string | null;
  updatedAt: string;
};

export type OperatorMarketPresenceRow = {
  id: string;
  competitorName: string;
  competitorDomain: string;
  marketCode: string;
  presenceStatus: "active" | "uncertain" | "exited";
  verificationStatus: "unverified" | "verified";
  lastVerifiedAt: string | null;
};

export type TierOverrideRow = {
  id: string;
  brandName: string;
  competitorName: string;
  marketCode: string;
  previousCalculatedValue: string;
  overrideValue: string;
  reason: string;
  actorEmail: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
};

export async function getScoringConfigs(): Promise<ScoringConfigRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("market_power_scoring_config")
    .select("id, version, config_name, status, activated_at, retired_at, created_at")
    .order("version", { ascending: false });
  if (error) throw new Error(`getScoringConfigs failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    version: r.version,
    configName: r.config_name,
    status: r.status as ScoringConfigRow["status"],
    activatedAt: r.activated_at,
    retiredAt: r.retired_at,
    createdAt: r.created_at,
  }));
}

export async function getScoringConfigHistory(): Promise<ScoringConfigHistoryRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("market_power_scoring_config_history")
    .select(
      "id, config_id, change_type, change_reason, created_at, market_power_scoring_config(version), profiles(email)"
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`getScoringConfigHistory failed: ${error.message}`);
  return (data ?? []).map((r) => {
    const config = Array.isArray(r.market_power_scoring_config)
      ? r.market_power_scoring_config[0]
      : r.market_power_scoring_config;
    const actor = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      configId: r.config_id,
      configVersion: config?.version ?? 0,
      changedByEmail: actor?.email ?? null,
      changeType: r.change_type,
      changeReason: r.change_reason,
      createdAt: r.created_at,
    };
  });
}

export async function getMethodologyContent(): Promise<MethodologyContentRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("market_power_methodology_content")
    .select("id, content_key, title, body, drawer_section, updated_at")
    .order("drawer_section", { ascending: true })
    .order("content_key", { ascending: true });
  if (error) throw new Error(`getMethodologyContent failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    contentKey: r.content_key,
    title: r.title,
    body: r.body,
    drawerSection: r.drawer_section,
    updatedAt: r.updated_at,
  }));
}

export async function getOperatorMarketPresence(): Promise<OperatorMarketPresenceRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("operator_market_presence")
    .select("id, market_code, presence_status, verification_status, last_verified_at, competitors(name, domain)")
    .order("market_code", { ascending: true })
    .limit(200);
  if (error) throw new Error(`getOperatorMarketPresence failed: ${error.message}`);
  return (data ?? []).map((r) => {
    const competitor = Array.isArray(r.competitors) ? r.competitors[0] : r.competitors;
    return {
      id: r.id,
      competitorName: competitor?.name ?? "Unknown",
      competitorDomain: competitor?.domain ?? "",
      marketCode: r.market_code,
      presenceStatus: r.presence_status as OperatorMarketPresenceRow["presenceStatus"],
      verificationStatus: r.verification_status as OperatorMarketPresenceRow["verificationStatus"],
      lastVerifiedAt: r.last_verified_at,
    };
  });
}

export async function getTierOverrides(): Promise<TierOverrideRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("market_power_override_events")
    .select(
      "id, market_code, previous_calculated_value, override_value, reason, is_active, expires_at, created_at, brands(name), competitors(name), profiles(email)"
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`getTierOverrides failed: ${error.message}`);
  return (data ?? []).map((r) => {
    const brand = Array.isArray(r.brands) ? r.brands[0] : r.brands;
    const competitor = Array.isArray(r.competitors) ? r.competitors[0] : r.competitors;
    const actor = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      brandName: brand?.name ?? "Unknown",
      competitorName: competitor?.name ?? "Unknown",
      marketCode: r.market_code,
      previousCalculatedValue: r.previous_calculated_value,
      overrideValue: r.override_value,
      reason: r.reason,
      actorEmail: actor?.email ?? null,
      isActive: r.is_active,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
    };
  });
}
