// Typed environment access for Edge Functions (Deno). Values live in Supabase
// Vault / Edge Function secrets (docs/env-vars.md) — NEVER hardcoded, NEVER logged.
// MVP providers only: Supabase, DataForSEO, DetectZeStack, Anthropic, OpenAI,
// Ideogram, Cloudflare R2, Langfuse. Excluded keys (Firecrawl/Apify/xAI/Together/
// DeepSeek/Kimi/Resend) are intentionally NOT read anywhere.

/** Required secret — throws if missing so a misconfigured function fails loud. */
export function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

/** Optional secret — returns undefined if absent (caller decides fallback). */
export function optionalEnv(name: string): string | undefined {
  return Deno.env.get(name) || undefined;
}

// Supabase injects these into every Edge Function automatically.
export const SUPABASE_URL = () => requireEnv("SUPABASE_URL");
export const SERVICE_ROLE_KEY = () => requireEnv("SUPABASE_SERVICE_ROLE_KEY");
