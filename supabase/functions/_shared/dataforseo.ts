// DataForSEO client (Basic auth). Base https://api.dataforseo.com/v3/.
// Most endpoints are POST with a `[ { ...task } ]` array body and return
// { tasks: [ { result: [...] } ] }. Live endpoints return inline; task_post
// endpoints require polling tasks_ready + task_get/{id}.

import { requireEnv } from "./env.ts";

const BASE = "https://api.dataforseo.com/v3/";

function authHeader(): string {
  const login = requireEnv("DATAFORSEO_LOGIN");
  const password = requireEnv("DATAFORSEO_PASSWORD");
  return `Basic ${btoa(`${login}:${password}`)}`;
}

/** POST a DataForSEO endpoint with a task array; returns the parsed body. */
export async function dfsPost<T = unknown>(path: string, tasks: unknown[]): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(tasks),
  });
  if (!res.ok) throw new Error(`DataForSEO ${path} ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

/** GET a DataForSEO endpoint (task_get / tasks_ready). */
export async function dfsGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "GET",
    headers: { Authorization: authHeader() },
  });
  if (!res.ok) throw new Error(`DataForSEO ${path} ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

// ── Market → DataForSEO Google location_code ─────────────────────────────────
// Keys are brands.market values (lib/onboarding/constants.ts MARKETS — keep in
// sync). Codes are Google geotarget country criteria IDs (2000 + ISO 3166-1
// numeric). Default Nigeria (the launch market) when no market is recognised.
export const MARKET_LOCATION: Record<string, number> = {
  // West Africa
  nigeria: 2566,
  ghana: 2288,
  senegal: 2686,
  cote_divoire: 2384,
  benin: 2204,
  burkina_faso: 2854,
  mali: 2466,
  niger: 2562,
  togo: 2768,
  sierra_leone: 2694,
  liberia: 2430,
  gambia: 2270,
  guinea: 2324,
  cape_verde: 2132,
  // East Africa
  kenya: 2404,
  uganda: 2800,
  tanzania: 2834,
  rwanda: 2646,
  burundi: 2108,
  ethiopia: 2231,
  // Southern Africa
  south_africa: 2710,
  zambia: 2894,
  zimbabwe: 2716,
  malawi: 2454,
  mozambique: 2508,
  botswana: 2072,
  namibia: 2516,
  lesotho: 2426,
  eswatini: 2748,
  angola: 2024,
  // Central Africa
  cameroon: 2120,
  dr_congo: 2180,
  congo_republic: 2178,
  gabon: 2266,
  chad: 2148,
  // Indian Ocean
  mauritius: 2480,
  madagascar: 2450,
  seychelles: 2690,
  // North Africa
  morocco: 2504,
  tunisia: 2788,
};
export const DEFAULT_LOCATION = 2566; // Nigeria

/** Resolve the DataForSEO location_code for a brand's market list (first known wins). */
export function locationCode(markets: string[] | null | undefined): number {
  for (const m of markets ?? []) {
    const code = MARKET_LOCATION[(m ?? "").toLowerCase().trim()];
    if (code) return code;
  }
  return DEFAULT_LOCATION;
}

/** First result array from a live endpoint response (tasks[0].result). */
export function firstResult<T = unknown>(body: { tasks?: Array<{ result?: T[] }> }): T[] {
  return body.tasks?.[0]?.result ?? [];
}

/**
 * Post a task and poll task_get until ready (for *_task_post endpoints).
 * `getPath` is the task_get base, e.g. "ai_optimization/chat_gpt/llm_responses/task_get".
 * Bounded by the module's 90s budget — keep maxWaitMs well under that.
 */
export async function dfsTaskPostAndPoll<T = unknown>(
  postPath: string,
  getPathBase: string,
  tasks: unknown[],
  opts: { maxWaitMs?: number; intervalMs?: number } = {},
): Promise<T[]> {
  const posted = await dfsPost<{ tasks?: Array<{ id?: string }> }>(postPath, tasks);
  const ids = (posted.tasks ?? []).map((t) => t.id).filter(Boolean) as string[];
  if (ids.length === 0) return [];

  const maxWait = opts.maxWaitMs ?? 60_000;
  const interval = opts.intervalMs ?? 4_000;
  const deadline = Date.now() + maxWait;
  const results: T[] = [];
  const pending = new Set(ids);

  while (pending.size > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));
    for (const id of [...pending]) {
      try {
        const got = await dfsGet<{ tasks?: Array<{ status_code?: number; result?: T[] }> }>(
          `${getPathBase}/${id}`,
        );
        const task = got.tasks?.[0];
        if (task && task.status_code === 20000 && task.result) {
          results.push(...task.result);
          pending.delete(id);
        }
      } catch (_e) {
        // keep polling remaining ids; a single failure shouldn't abort the batch
      }
    }
  }
  return results;
}
