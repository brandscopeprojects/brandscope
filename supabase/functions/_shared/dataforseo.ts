// DataForSEO client (Basic auth). Base https://api.dataforseo.com/v3/.
// Most endpoints are POST with a `[ { ...task } ]` array body and return
// { tasks: [ { result: [...] } ] }. Live endpoints return inline; task_post
// endpoints require polling tasks_ready + task_get/{id}.

import { requireEnv, optionalEnv } from "./env.ts";

const BASE = "https://api.dataforseo.com/v3/";

/**
 * DataForSEO Basic auth from a SINGLE `DATAFORSEO_API_KEY` secret (owner
 * decision 2026-07). The value may be provided in any of these forms and is
 * normalised to a valid `Authorization` header here:
 *   - "login:password"            → base64-encoded into a Basic token
 *   - a base64 "login:password"   → used as the Basic token as-is
 *   - a full "Basic <token>"      → used verbatim
 * Falls back to legacy DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD if the single key
 * is not set, so existing deployments keep working.
 */
function authHeader(): string {
  const key = optionalEnv("DATAFORSEO_API_KEY");
  if (key) {
    const v = key.trim();
    if (/^Basic\s+/i.test(v)) return v;
    if (v.includes(":")) return `Basic ${btoa(v)}`;
    return `Basic ${v}`;
  }
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

// ── Market → DataForSEO Google location_code ──────────────────────────────────
// GENERATED from lib/onboarding/countries.ts by scripts/generate-market-maps.mjs
// — do not edit by hand. Keys are brands.market slugs; codes are Google geotarget
// country criteria IDs (2000 + ISO 3166-1 numeric). Default Nigeria (launch market).
export const MARKET_LOCATION: Record<string, number> = {
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
  guinea_bissau: 2624,
  mauritania: 2478,
  kenya: 2404,
  uganda: 2800,
  tanzania: 2834,
  rwanda: 2646,
  burundi: 2108,
  ethiopia: 2231,
  somalia: 2706,
  south_sudan: 2728,
  djibouti: 2262,
  eritrea: 2232,
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
  cameroon: 2120,
  dr_congo: 2180,
  congo_republic: 2178,
  gabon: 2266,
  chad: 2148,
  central_african_republic: 2140,
  equatorial_guinea: 2226,
  sao_tome_and_principe: 2678,
  mauritius: 2480,
  madagascar: 2450,
  seychelles: 2690,
  comoros: 2174,
  morocco: 2504,
  tunisia: 2788,
  egypt: 2818,
  algeria: 2012,
  libya: 2434,
  sudan: 2729,
  united_kingdom: 2826,
  ireland: 2372,
  france: 2250,
  germany: 2276,
  netherlands: 2528,
  belgium: 2056,
  luxembourg: 2442,
  spain: 2724,
  portugal: 2620,
  italy: 2380,
  malta: 2470,
  switzerland: 2756,
  austria: 2040,
  denmark: 2208,
  sweden: 2752,
  norway: 2578,
  finland: 2246,
  iceland: 2352,
  poland: 2616,
  czechia: 2203,
  slovakia: 2703,
  hungary: 2348,
  romania: 2642,
  bulgaria: 2100,
  greece: 2300,
  cyprus: 2196,
  croatia: 2191,
  slovenia: 2705,
  serbia: 2688,
  bosnia_and_herzegovina: 2070,
  north_macedonia: 2807,
  albania: 2008,
  montenegro: 2499,
  estonia: 2233,
  latvia: 2428,
  lithuania: 2440,
  ukraine: 2804,
  moldova: 2498,
  belarus: 2112,
  georgia: 2268,
  armenia: 2051,
  azerbaijan: 2031,
  russia: 2643,
  monaco: 2492,
  liechtenstein: 2438,
  andorra: 2020,
  san_marino: 2674,
  gibraltar: 2292,
  isle_of_man: 2833,
  turkey: 2792,
  israel: 2376,
  saudi_arabia: 2682,
  united_arab_emirates: 2784,
  qatar: 2634,
  kuwait: 2414,
  bahrain: 2048,
  oman: 2512,
  jordan: 2400,
  lebanon: 2422,
  iraq: 2368,
  iran: 2364,
  syria: 2760,
  yemen: 2887,
  palestine: 2275,
  united_states: 2840,
  canada: 2124,
  mexico: 2484,
  guatemala: 2320,
  belize: 2084,
  honduras: 2340,
  el_salvador: 2222,
  nicaragua: 2558,
  costa_rica: 2188,
  panama: 2591,
  cuba: 2192,
  dominican_republic: 2214,
  haiti: 2332,
  jamaica: 2388,
  trinidad_and_tobago: 2780,
  barbados: 2052,
  bahamas: 2044,
  saint_lucia: 2662,
  grenada: 2308,
  saint_vincent_and_the_grenadines: 2670,
  antigua_and_barbuda: 2028,
  saint_kitts_and_nevis: 2659,
  dominica: 2212,
  curacao: 2531,
  brazil: 2076,
  colombia: 2170,
  argentina: 2032,
  chile: 2152,
  peru: 2604,
  ecuador: 2218,
  venezuela: 2862,
  bolivia: 2068,
  paraguay: 2600,
  uruguay: 2858,
  guyana: 2328,
  suriname: 2740,
  kazakhstan: 2398,
  uzbekistan: 2860,
  turkmenistan: 2795,
  kyrgyzstan: 2417,
  tajikistan: 2762,
  afghanistan: 2004,
  pakistan: 2586,
  india: 2356,
  bangladesh: 2050,
  sri_lanka: 2144,
  nepal: 2524,
  bhutan: 2064,
  maldives: 2462,
  china: 2156,
  japan: 2392,
  south_korea: 2410,
  taiwan: 2158,
  hong_kong: 2344,
  macau: 2446,
  mongolia: 2496,
  thailand: 2764,
  vietnam: 2704,
  philippines: 2608,
  indonesia: 2360,
  malaysia: 2458,
  singapore: 2702,
  cambodia: 2116,
  laos: 2418,
  myanmar: 2104,
  brunei: 2096,
  timor_leste: 2626,
  australia: 2036,
  new_zealand: 2554,
  fiji: 2242,
  papua_new_guinea: 2598,
  solomon_islands: 2090,
  vanuatu: 2548,
  samoa: 2882,
  tonga: 2776,
  kiribati: 2296,
  micronesia: 2583,
  marshall_islands: 2584,
  palau: 2585,
  nauru: 2520,
  tuvalu: 2798,
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
