// ops-geo-probe — TEMP diagnostic. v5: dump the RAW perplexity /live result shape
// (its extracted text came back empty while chat_gpt/claude/gemini worked, so its
// result structure must differ). Self-contained; CRON_SECRET-gated.

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

  // (a) as current code does: user_prompt only.
  const bare = await dfs("ai_optimization/perplexity/llm_responses/live", [{ user_prompt: PROMPT }]);
  // (b) with a model_name + web_search, in case perplexity now needs them.
  const withModel = await dfs("ai_optimization/perplexity/llm_responses/live", [
    { user_prompt: PROMPT, model_name: "sonar", web_search: true },
  ]);

  const r1 = bare.data?.tasks?.[0]?.result?.[0] ?? null;
  const r2 = withModel.data?.tasks?.[0]?.result?.[0] ?? null;

  return json({
    note: "GEO probe v5 — perplexity /live raw shape",
    bare: {
      task_status: bare.data?.tasks?.[0]?.status_message,
      cost: bare.data?.cost,
      result_keys: r1 ? Object.keys(r1) : null,
      item0_keys: Array.isArray(r1?.items) && r1.items[0] ? Object.keys(r1.items[0]) : null,
      raw: JSON.stringify(r1 ?? bare.data).slice(0, 2500),
    },
    with_model: {
      task_status: withModel.data?.tasks?.[0]?.status_message,
      cost: withModel.data?.cost,
      result_keys: r2 ? Object.keys(r2) : null,
      raw: JSON.stringify(r2 ?? withModel.data).slice(0, 1500),
    },
  });
});
