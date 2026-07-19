// ops-geo-probe — TEMP diagnostic (DataForSEO support ticket). Posts real
// ai_optimization LLM-response tasks for the async engines (ChatGPT/Claude/Gemini)
// and returns their task IDs + the task_get status over a short poll window, so we
// can (a) hand DataForSEO support concrete task IDs and (b) learn whether the tasks
// are stuck in-queue vs. our task_get path being wrong. Self-contained (no _shared
// imports) so it deploys as a single file. verify_jwt=false; CRON_SECRET-gated.

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

async function dfs(method: "GET" | "POST", path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`https://api.dataforseo.com/v3/${path}`, {
    method,
    headers: { Authorization: dfsAuth(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: unknown = null;
  try { data = await res.json(); } catch { data = await res.text(); }
  return { ok: res.ok, status: res.status, data };
}

const ENGINES = [
  { key: "chatgpt", segment: "chat_gpt" },
  { key: "claude", segment: "claude" },
  { key: "gemini", segment: "gemini" },
];
const PROMPT = "What are the best online sports betting sites in Zambia?";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!bearer || bearer !== Deno.env.get("CRON_SECRET")) return json({ error: "unauthorized" }, 401);

  const startTs = Date.now();

  // 1. POST one llm_responses task per async engine; capture the task id + post status.
  const posted: Record<string, { segment: string; task_id: string | null; post_status_code?: number; post_status_message?: string; cost?: number; http?: number; error?: string }> = {};
  for (const e of ENGINES) {
    const r = await dfs("POST", `ai_optimization/${e.segment}/llm_responses/task_post`, [{ user_prompt: PROMPT }]);
    const d = r.data as { cost?: number; tasks?: Array<{ id?: string; status_code?: number; status_message?: string }> };
    const t = d?.tasks?.[0] ?? {};
    posted[e.key] = {
      segment: e.segment,
      task_id: t.id ?? null,
      post_status_code: t.status_code,
      post_status_message: t.status_message,
      cost: d?.cost,
      http: r.status,
    };
  }

  // 2. Poll task_get for ~75s. Try BOTH path variants ("/task_get/{id}" and
  //    "/task_get/advanced/{id}") to detect a path mismatch vs. genuine in-queue.
  const poll: Record<string, { get_status_code?: number; get_status_message?: string; has_result?: boolean; ready?: boolean; path_used?: string; elapsed_s?: number; error?: string }> = {};
  const pending = new Map(Object.entries(posted).filter(([, p]) => p.task_id).map(([k, p]) => [k, p]));
  const deadline = Date.now() + 75_000;
  while (pending.size > 0 && Date.now() < deadline) {
    await sleep(6_000);
    for (const [k, p] of [...pending]) {
      for (const variant of [`task_get/advanced/${p.task_id}`, `task_get/${p.task_id}`]) {
        const r = await dfs("GET", `ai_optimization/${p.segment}/llm_responses/${variant}`);
        if (!r.ok) { poll[k] = { ...poll[k], get_status_code: r.status, get_status_message: `HTTP ${r.status} on ${variant}`, path_used: variant, elapsed_s: Math.round((Date.now() - startTs) / 1000) }; continue; }
        const d = r.data as { tasks?: Array<{ status_code?: number; status_message?: string; result?: unknown[] }> };
        const t = d?.tasks?.[0] ?? {};
        const hasResult = Array.isArray(t.result) && t.result.length > 0;
        poll[k] = {
          get_status_code: t.status_code,
          get_status_message: t.status_message,
          has_result: hasResult,
          ready: t.status_code === 20000 || hasResult,
          path_used: variant,
          elapsed_s: Math.round((Date.now() - startTs) / 1000),
        };
        if (t.status_code === 20000 || hasResult) { pending.delete(k); break; }
      }
    }
  }
  for (const [k] of pending) if (!poll[k]?.ready) poll[k] = { ...poll[k], ready: false };

  return json({
    note: "DataForSEO ai_optimization llm_responses async-engine probe",
    prompt: PROMPT,
    posted,
    poll,
    total_elapsed_s: Math.round((Date.now() - startTs) / 1000),
  });
});
