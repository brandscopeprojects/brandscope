// Runtime model router — resolves the model for a task from model_router_config
// (seeded in migration 14) so model swaps are a DB update, not a redeploy.
// Fails safe: any error, missing row, or disabled row → the code default.
// Config is cached per function instance for 5 minutes.

import type { SupabaseClient } from "./supabase.ts";

type RouteRow = {
  task_type: string;
  primary_model: string;
  fallback_model: string | null;
  temperature: number | null;
  max_tokens: number | null;
};

let cache: Map<string, RouteRow> | null = null;
let fetchedAt = 0;
const TTL_MS = 5 * 60_000;

async function loadRoutes(sb: SupabaseClient): Promise<Map<string, RouteRow>> {
  const now = Date.now();
  if (cache && now - fetchedAt < TTL_MS) return cache;
  const { data, error } = await sb
    .from("model_router_config")
    .select("task_type, primary_model, fallback_model, temperature, max_tokens")
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  cache = new Map((data ?? []).map((r) => [r.task_type, r as RouteRow]));
  fetchedAt = now;
  return cache;
}

/**
 * The model to use for `taskType`. `codeDefault` is the hardcoded MODELS.* value
 * and is always returned when the router table is unreachable or has no row —
 * a config problem must never break a scan.
 */
export async function resolveModel(
  sb: SupabaseClient,
  taskType: string,
  codeDefault: string,
): Promise<string> {
  try {
    const routes = await loadRoutes(sb);
    return routes.get(taskType)?.primary_model ?? codeDefault;
  } catch {
    return codeDefault;
  }
}

export type ResolvedRoute = { model: string; temperature: number; maxTokens: number };

/**
 * Full route for `taskType`: model + temperature + maxTokens. Router columns
 * override the code defaults ONLY when non-null; any error → all code defaults.
 * This is what makes the Agent Control temperature slider real (P2c).
 */
export async function resolveRoute(
  sb: SupabaseClient,
  taskType: string,
  codeDefaults: ResolvedRoute,
): Promise<ResolvedRoute> {
  try {
    const routes = await loadRoutes(sb);
    const r = routes.get(taskType);
    if (!r) return codeDefaults;
    return {
      model: r.primary_model ?? codeDefaults.model,
      temperature: r.temperature ?? codeDefaults.temperature,
      maxTokens: r.max_tokens ?? codeDefaults.maxTokens,
    };
  } catch {
    return codeDefaults;
  }
}
