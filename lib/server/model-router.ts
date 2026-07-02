import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Runtime model router for Next.js route handlers.
 *
 * Looks up the active `primary_model` for a task_type in `model_router_config`
 * (service-role-only table — callers MUST pass the admin client; never expose
 * this table to client code). On ANY failure — no row, inactive, query error,
 * thrown exception — falls back to the code default so an LLM call never
 * breaks because of router config.
 */
export async function resolveModel(
  admin: SupabaseClient<Database>,
  taskType: string,
  codeDefault: string,
): Promise<string> {
  try {
    const { data, error } = await admin
      .from("model_router_config")
      .select("task_type, primary_model")
      .eq("is_active", true)
      .eq("task_type", taskType)
      .maybeSingle();
    if (error) return codeDefault;
    return data?.primary_model ?? codeDefault;
  } catch {
    return codeDefault;
  }
}
