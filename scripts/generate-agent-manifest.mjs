// generate-agent-manifest.mjs — extracts each agent's DECLARED configuration
// straight from the Edge Function sources into lib/data/agent-manifest.json
// (Agent Control Centre "Declared vs Observed", backlog P2c Phase A item 1).
// Code stays the single source of truth; the committed manifest is a projection
// of it, so the UI can never drift from what actually runs. Re-run after any
// change to supabase/functions and commit the result:
//
//   node scripts/generate-agent-manifest.mjs
//
// Fails loudly if expected patterns disappear (same doctrine as
// generate-market-maps.mjs invariants).

import { readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FN_ROOT = "supabase/functions";
const SKIP = new Set(["_shared", "smoke-test-apis", "smoke-detectzestack", "ops-kick-scan"]);

// Function → agent mapping (mirrors agents.config seeded in migration 14).
const AGENT_FUNCTIONS = {
  supervisor: ["weekly-scan-trigger", "brand-scan", "synthesis-draft-audit"],
  researcher: [
    "researcher-traffic-seo",
    "researcher-geo-aeo",
    "researcher-tech-stack",
    "researcher-app-store",
    "researcher-customer",
    "researcher-regulatory",
    "researcher-promotions",
    "researcher-hiring",
    "onboarding-suggest",
  ],
  drafter: ["synthesis-draft-audit"],
  auditor: ["synthesis-draft-audit"],
  analytics: ["cache-population", "between-cycle-monitor"],
};

// Cron schedules are declared in migration 13 (pg_cron) — static by design.
const AGENT_SCHEDULES = {
  supervisor: "Mondays 01:00 UTC (weekly-scan-trigger)",
  analytics: "Every 6 hours (between-cycle-monitor)",
};

function readDirSources(fn) {
  const dir = join(FN_ROOT, fn);
  let out = "";
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isFile() && f.endsWith(".ts")) out += `\n// FILE:${f}\n` + readFileSync(p, "utf8");
  }
  return out;
}

const contracts = readFileSync(join(FN_ROOT, "_shared/contracts.ts"), "utf8");
const prefCols = {};
for (const m of contracts.matchAll(/^\s*(\w+): "(\w+)",\s*(?:\/\/.*)?$/gm)) {
  // only take rows inside MODULE_PREF_COLUMN block
  void m;
}
{
  const block = contracts.match(/MODULE_PREF_COLUMN[\s\S]*?\{([\s\S]*?)\};/);
  if (!block) throw new Error("MODULE_PREF_COLUMN not found in contracts.ts");
  for (const m of block[1].matchAll(/(\w+): ("(\w+)"|null)/g)) {
    prefCols[m[1]] = m[3] ?? null;
  }
}

const functions = {};
const fnDirs = readdirSync(FN_ROOT).filter(
  (d) => !SKIP.has(d) && statSync(join(FN_ROOT, d)).isDirectory(),
);
for (const fn of fnDirs) {
  const src = readDirSources(fn);

  const promptVersions = [...new Set([...src.matchAll(/PROMPT_VERSION\s*=\s*"([^"]+)"/g)].map((m) => m[1]))];
  const temps = [...new Set([...src.matchAll(/temperature:\s*([\d.]+)/g)].map((m) => Number(m[1])))];
  const maxTokens = [...new Set([...src.matchAll(/max[Tt]okens:\s*([\d_]+)/g)].map((m) => Number(m[1].replace(/_/g, ""))))];
  const endpoints = [...new Set([...src.matchAll(/dfsPost(?:<[^>]*>)?\(\s*\n?\s*"([^"]+)"/g)].map((m) => m[1]))];
  const budget = src.match(/MODULE_BUDGET_MS\s*=\s*([\d_]+)/);
  const retries = src.match(/delays\s*=\s*\[([\d_]+),\s*([\d_]+)\]/);
  const routerTasks = [...src.matchAll(/resolveModel\(\s*sb,\s*"([a-z_]+)",\s*MODELS\.(\w+)\s*\)/g)].map((m) => ({
    task: m[1],
    codeDefault: m[2],
  }));
  const usesDetectZeStack = /detectzestack/i.test(src) && fn !== "_shared";
  const usesOpenAI = /callOpenAIChat|\/v1\/moderations|\/v1\/embeddings|embed\(/.test(src);

  functions[fn] = {
    promptVersions,
    temperatures: temps.sort((a, b) => a - b),
    maxTokens: maxTokens.sort((a, b) => a - b),
    dataforseoEndpoints: endpoints,
    providers: [
      ...(endpoints.length ? ["DataForSEO"] : []),
      ...(usesDetectZeStack ? ["DetectZeStack"] : []),
      ...(routerTasks.length || promptVersions.length ? ["Anthropic"] : []),
      ...(usesOpenAI ? ["OpenAI"] : []),
    ],
    moduleBudgetMs: budget ? Number(budget[1].replace(/_/g, "")) : null,
    retryDelaysMs: retries ? [Number(retries[1]), Number(retries[2])] : null,
    routerTasks,
    gatingColumn:
      fn.startsWith("researcher-")
        ? (prefCols[fn.replace("researcher-", "").replace(/-/g, "_")] ?? null)
        : null,
  };
}

// ── invariants: fail loudly on extraction drift ───────────────────────────────
const allPrompts = Object.values(functions).flatMap((f) => f.promptVersions);
if (allPrompts.length < 6) throw new Error(`only ${allPrompts.length} PROMPT_VERSIONs found — extraction drift?`);
if (!functions["researcher-traffic-seo"]?.dataforseoEndpoints.length) {
  throw new Error("no DataForSEO endpoints extracted for traffic-seo — extraction drift?");
}

const agents = {};
for (const [agent, fns] of Object.entries(AGENT_FUNCTIONS)) {
  const present = fns.filter((f) => functions[f]);
  agents[agent] = {
    functions: present,
    schedule: AGENT_SCHEDULES[agent] ?? null,
    routerTasks: [...new Set(present.flatMap((f) => functions[f].routerTasks.map((t) => t.task)))],
    promptVersions: [...new Set(present.flatMap((f) => functions[f].promptVersions))],
  };
}

const manifest = {
  _note:
    "GENERATED by scripts/generate-agent-manifest.mjs from supabase/functions source — do not edit. Declared config for the Agent Control Centre.",
  generatedAt: new Date().toISOString(),
  functions,
  agents,
};

writeFileSync("lib/data/agent-manifest.json", JSON.stringify(manifest, null, 2) + "\n");
console.log(
  `ok: ${Object.keys(functions).length} functions, ${Object.keys(agents).length} agents, ${allPrompts.length} prompt versions → lib/data/agent-manifest.json`,
);
