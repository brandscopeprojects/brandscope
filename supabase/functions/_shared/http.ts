// HTTP helpers for Edge Functions. Internal functions are invoked by pg_net /
// the orchestrator with a shared CRON_SECRET bearer; public webhooks verify their
// own signatures (see data-flow-rules.md §6).

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return null;
}

/**
 * Validate an internal call carries the shared secret. Orchestrator → function
 * and cron → function calls send `Authorization: Bearer ${CRON_SECRET}`.
 * Returns true when valid; the caller should 401 otherwise.
 */
export function isAuthorizedInternal(req: Request): boolean {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret) return false;
  const auth = req.headers.get("Authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

/**
 * Validate a caller-presented key as a PRIVILEGED (service-level) Supabase key
 * by probing the Auth Admin API with it. Needed because the Next.js server may
 * hold either the legacy `eyJ…` service_role JWT or a newer `sb_secret_…` API
 * key — the latter authenticates PostgREST fine but can never string-match the
 * edge-runtime-injected legacy JWT, which silently 401'd app → function calls
 * (onboarding-suggest, brand-scan first-scan kick) while every DB call worked.
 * Anon/publishable keys fail the probe (401/403). Successes are cached for the
 * instance lifetime; failures are not (could be transient network).
 */
const privilegedKeys = new Set<string>();
export async function isServiceBearer(bearer: string): Promise<boolean> {
  if (!bearer) return false;
  if (privilegedKeys.has(bearer)) return true;
  const base = Deno.env.get("SUPABASE_URL");
  if (!base) return false;
  try {
    const res = await fetch(`${base}/auth/v1/admin/users?page=1&per_page=1`, {
      headers: { apikey: bearer, Authorization: `Bearer ${bearer}` },
      signal: AbortSignal.timeout(4_000),
    });
    void res.body?.cancel()?.catch(() => {});
    if (res.ok) {
      privilegedKeys.add(bearer);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
