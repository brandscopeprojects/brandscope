// ops-geo-probe — TEMP diagnostic. v2: the async engines were rejected at
// task_post with 40501 "Invalid Field: 'model_name'". This version (a) lists the
// available model_name values per engine and (b) re-posts WITH a model_name and
// polls task_get, to confirm the fix. Self-contained; CRON_SECRET-gated.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

async function dfs(method: "GET" | "POST", path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`https://api.dataforseo.com/v3/${path}`, {
    method,
    headers: { Authorization: dfsAuth(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  try { data = await res.json(); } catch { data = await res.text(); }
  return { ok: res.ok, status: res.status, data };
}

const ENGINES = [
  { key: "chatgpt", segment: "chat_gpt", fallback: "gpt-4o" },
  { key: "claude", segment: "claude", fallback: "claude-3-5-sonnet" },
  { key: "gemini", segment: "gemini", fallback: "gemini-1.5-pro" },
];
const PROMPT = "What are the best online sports betting sites in Zambia?";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!bearer || bearer !== Deno.env.get("CRON_SECRET")) return json({ error: "unauthorized" }, 401);

  const startTs = Date.now();
  const out: Record<string, any> = {};

  for (const e of ENGINES) {
    const rec: any = { segment: e.segment };

    // (a) List available models for this engine.
    const models = await dfs("GET", `ai_optimization/${e.segment}/llm_responses/models`);
    const modelItems = models.data?.tasks?.[0]?.result ?? models.data?.tasks?.[0]?.result?.[0]?.items ?? null;
    rec.models_http = models.status;
    rec.models_raw = models.data?.tasks?.[0]?.result ?? models.data?.tasks?.[0]?.status_message ?? null;

    // Try to pull a concrete model_name string out of whatever shape it returns.
    let modelName: string | null = null;
    const flat = JSON.stringify(models.data ?? {});
    const m = flat.match(/"model_name"\s*:\s*"([^"]+)"/) || flat.match(/"model"\s*:\s*"([^"]+)"/);
    if (m) modelName = m[1];
    if (Array.isArray(modelItems) && modelItems.length && typeof modelItems[0] === "string") modelName = modelItems[0];
    if (!modelName) modelName = e.fallback; // models endpoint path may differ; attempt a known model
    rec.model_name_used = modelName;

    // (b) Re-post WITH model_name (if we found one) + poll.
    if (modelName) {
      const post = await dfs("POST", `ai_optimization/${e.segment}/llm_responses/task_post`, [
        { user_prompt: PROMPT, model_name: modelName },
      ]);
      const t = post.data?.tasks?.[0] ?? {};
      rec.post_status_code = t.status_code;
      rec.post_status_message = t.status_message;
      rec.post_cost = post.data?.cost;
      rec.task_id = t.id ?? null;

      if (t.id && (t.status_code === 20100 || t.status_code === 20000)) {
        for (let i = 0; i < 12 && Date.now() - startTs < 80_000; i++) {
          await sleep(6_000);
          const g = await dfs("GET", `ai_optimization/${e.segment}/llm_responses/task_get/advanced/${t.id}`);
          const gt = g.data?.tasks?.[0] ?? {};
          const hasResult = Array.isArray(gt.result) && gt.result.length > 0;
          rec.get_status_code = gt.status_code;
          rec.get_status_message = gt.status_message;
          rec.has_result = hasResult;
          rec.elapsed_s = Math.round((Date.now() - startTs) / 1000);
          if (gt.status_code === 20000 || hasResult) {
            rec.answer_sample = JSON.stringify(gt.result?.[0] ?? gt).slice(0, 400);
            break;
          }
        }
      }
    }
    out[e.key] = rec;
  }

  return json({ note: "GEO probe v2 — discover model_name + confirm fix", prompt: PROMPT, engines: out, total_elapsed_s: Math.round((Date.now() - startTs) / 1000) });
});
