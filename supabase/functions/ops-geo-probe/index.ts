// ops-geo-probe — TEMP diagnostic. v4: dump the RAW /live result shape for one
// engine so we can map the answer-text field correctly, and compare cost with vs
// without web_search. Self-contained; CRON_SECRET-gated.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
function dfsAuth(): string {
  const key = Deno.env.get("DATAFORSEO_API_KEY");
  if (key) {
    const v = key.trim();
    if (/^Basic\s+/i.test(v)) return v;
    if (v.includes(":")) return `Basic ${btoa(v)}`;
    return `Basic ${v}`;
  }
  return `Basic ${btoa(`${Deno.env.get("DATAFORSEO_LOGIN")}:${Deno.env.get("DATAFORSEO_PASSWORD")}`)}`;
}
async function dfs(path: string, body: unknown): Promise<any> {
  const res = await fetch(`https://api.dataforseo.com/v3/${path}`, {
    method: "POST",
    headers: { Authorization: dfsAuth(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  try { return { http: res.status, data: await res.json() }; } catch { return { http: res.status, data: await res.text() }; }
}
const PROMPT = "What are the best online sports betting sites in Zambia?";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!bearer || bearer !== Deno.env.get("CRON_SECRET")) return json({ error: "unauthorized" }, 401);

  // Gemini (cheapest/fastest) with web_search on — dump the raw result verbatim.
  const withWs = await dfs("ai_optimization/gemini/llm_responses/live", [
    { user_prompt: PROMPT, model_name: "gemini-3.5-flash", web_search: true },
  ]);
  const result = withWs.data?.tasks?.[0]?.result?.[0] ?? null;

  return json({
    note: "GEO probe v4 — raw /live result shape (gemini)",
    http: withWs.http,
    cost: withWs.data?.cost,
    task_status: withWs.data?.tasks?.[0]?.status_message,
    result_top_keys: result ? Object.keys(result) : null,
    items_len: Array.isArray(result?.items) ? result.items.length : null,
    item0_keys: Array.isArray(result?.items) && result.items[0] ? Object.keys(result.items[0]) : null,
    raw_result: JSON.stringify(result ?? withWs.data).slice(0, 3500),
  });
});
