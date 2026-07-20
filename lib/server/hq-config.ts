import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// Runtime config for the internal HQ Agent, editable from the admin settings
// panel. Model / temperature / max_tokens / rate-limit live on the
// `model_router_config` row for task_type 'internal_hq_chat'; the system prompt
// override lives on the active `prompt_versions` row for agent_name
// 'internal_hq_chat'. Every getter fails safe to the passed code default so a
// config problem never breaks the chat.

const SLOT = "internal_hq_chat";

export type HqRoute = {
  model: string;
  temperature: number;
  maxTokens: number;
  requestsPerMin: number | null; // null → no rate limit
  active: boolean;
};

export async function resolveHqRoute(
  admin: SupabaseClient<Database>,
  defaults: { model: string; temperature: number; maxTokens: number; requestsPerMin: number },
): Promise<HqRoute> {
  try {
    const { data } = await admin
      .from("model_router_config")
      .select("primary_model, temperature, max_tokens, requests_per_min, is_active")
      .eq("task_type", SLOT)
      .maybeSingle();
    if (!data) return { ...defaults, active: true };
    return {
      model: data.primary_model ?? defaults.model,
      temperature: data.temperature ?? defaults.temperature,
      maxTokens: data.max_tokens ?? defaults.maxTokens,
      requestsPerMin: data.requests_per_min ?? null,
      active: data.is_active ?? true,
    };
  } catch {
    return { ...defaults, active: true };
  }
}

/** Active prompt override for a slot, else the code default. Never throws. */
export async function loadActivePrompt(
  admin: SupabaseClient<Database>,
  codeDefault: string,
): Promise<string> {
  try {
    const { data } = await admin
      .from("prompt_versions")
      .select("system_prompt, prompt_text")
      .eq("agent_name", SLOT)
      .eq("status", "active")
      .order("deployed_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const candidate = (data?.system_prompt ?? data?.prompt_text ?? "").trim();
    if (candidate && !candidate.startsWith("Code-defined:")) return candidate;
    return codeDefault;
  } catch {
    return codeDefault;
  }
}

/**
 * Per-user rate limit: how many messages this profile has sent in the last
 * `windowSec` seconds (counted from persisted hq_messages via their
 * conversations). Returns the count; caller compares to the configured limit.
 */
export async function recentUserMessageCount(
  admin: SupabaseClient<Database>,
  profileId: string,
  windowSec = 60,
): Promise<number> {
  try {
    const since = new Date(Date.now() - windowSec * 1000).toISOString();
    const { data: convs } = await admin
      .from("hq_conversations")
      .select("id")
      .eq("profile_id", profileId);
    const ids = (convs ?? []).map((c) => c.id);
    if (ids.length === 0) return 0;
    const { count } = await admin
      .from("hq_messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", ids)
      .eq("role", "user")
      .gte("created_at", since);
    return count ?? 0;
  } catch {
    return 0; // fail-open: never block chat on a rate-check error
  }
}
