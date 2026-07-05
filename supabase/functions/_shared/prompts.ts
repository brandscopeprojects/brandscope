// Runtime prompt loader (Agent Control "editable console", backlog P2c).
// System prompts live as exported TEMPLATE constants in each function (the code
// default) and can be OVERRIDDEN at runtime by the newest ACTIVE row in
// prompt_versions for the slot (agent_name column holds the slot key —
// schema-amendments D.7). Fail-safe: any error, no row, or a legacy pointer row
// ("Code-defined: …") → the code template. Cached 5 minutes per instance, same
// doctrine as the model router: a config problem must never break a scan.
//
// Placeholders use {{name}} and are interpolated by renderPrompt AFTER loading,
// so DB-edited prompts keep working as long as they keep the placeholders.

import type { SupabaseClient } from "./supabase.ts";

type CacheEntry = { text: string | null; fetchedAt: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60_000;

/**
 * The system prompt TEMPLATE for `slotKey` — the active prompt_versions row's
 * text when one exists, else `codeDefaultTemplate`. Never throws.
 */
export async function loadPrompt(
  sb: SupabaseClient,
  slotKey: string,
  codeDefaultTemplate: string,
): Promise<string> {
  const now = Date.now();
  const hit = cache.get(slotKey);
  if (hit && now - hit.fetchedAt < TTL_MS) return hit.text ?? codeDefaultTemplate;

  let text: string | null = null;
  try {
    const { data } = await sb
      .from("prompt_versions")
      .select("system_prompt, prompt_text, deployed_at")
      .eq("agent_name", slotKey)
      .eq("status", "active")
      .order("deployed_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const candidate = (data?.system_prompt ?? data?.prompt_text ?? "").trim();
    // Legacy seed rows point at code ("Code-defined: …") — treat as absent.
    if (candidate && !candidate.startsWith("Code-defined:")) text = candidate;
  } catch (_e) {
    text = null; // fail safe to the code template
  }
  cache.set(slotKey, { text, fetchedAt: now });
  return text ?? codeDefaultTemplate;
}

/** Interpolate {{placeholders}}; unknown placeholders are left intact. */
export function renderPrompt(template: string, vars: Record<string, string> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : whole,
  );
}
