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
