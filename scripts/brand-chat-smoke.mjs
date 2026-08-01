#!/usr/bin/env node
/**
 * Standalone live smoke test for the brand-chat engine.
 *
 * Mirrors lib/brand-agent/engine.ts (OpenAI Responses API + server-side tool loop)
 * and lib/brand-agent/tools.ts (brand-scoped tools), but embeds a REAL Betvita
 * (Uganda) scan snapshot pulled from weekly_cache — so it runs with ONLY an OpenAI
 * key. No Supabase, no Vercel deploy needed to see the model answer from real data.
 *
 *   OPENAI_API_KEY=sk-... node scripts/brand-chat-smoke.mjs \
 *     "which competitor gained the most market share this week?"
 *
 * If it prints betPawa (~87.7% share of voice) with the get_competitor_standings
 * tool called, the rebuilt engine works end to end.
 */

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) {
  console.error("Set OPENAI_API_KEY. Usage: OPENAI_API_KEY=sk-... node scripts/brand-chat-smoke.mjs \"<question>\"");
  process.exit(1);
}
const MODEL = process.env.BRAND_CHAT_MODEL || "gpt-4.1-mini";
const question =
  process.argv.slice(2).join(" ").trim() || "which competitor gained the most market share this week?";

// ── Real Betvita (Uganda) scan data — weekly_cache, week 2026-07-27 ───────────
const SCAN_WEEK = "2026-07-27";
const SNAPSHOT = {
  scan_week: SCAN_WEEK,
  ai_visibility_score: 60,
  share_of_voice_pct: 0.01,
  reach_score: 31.15,
  threat_level: "low",
  threat_score: 4.56,
  aggression_score: 2.5,
  competitors_tracked: 5,
};
const STANDINGS = [
  { name: "betPawa", sovPct: 87.69, reachScore: 60.94, reachBasis: "brand_demand" },
  { name: "Fortebet", sovPct: 7.92, reachScore: 37.33, reachBasis: "brand_demand" },
  { name: "Betika", sovPct: 4.35, reachScore: 50.87, reachBasis: "brand_demand" },
  { name: "KamaBet Uganda", sovPct: 0.02, reachScore: 34.63, reachBasis: "brand_demand" },
  { name: "Msport", sovPct: 0.01, reachScore: 33.81, reachBasis: "brand_demand" },
];
const RECOMMENDATIONS = [
  { rank: 1, urgency: "watch", headline: "AI models describe Betvita as 'casual, local' — reframe brand messaging this week." },
  { rank: 2, urgency: "watch", headline: "Fortebet reportedly secures Rwanda licence — monitor Uganda SERP for spillover." },
  { rank: 3, urgency: "opportunity", headline: "Betvita holds early AI visibility in Uganda — publish structured brand content to cement the lead." },
];

// ── Brand-scoped tools (same names/shape as lib/brand-agent/tools.ts) ─────────
const TOOL_IMPL = {
  get_brand_snapshot: () => ({ ...SNAPSHOT }),
  get_competitor_standings: () => ({ scan_week: SCAN_WEEK, competitors: STANDINGS }),
  get_recommendations: (args) => ({
    scan_week: SCAN_WEEK,
    recommendations: args?.urgency ? RECOMMENDATIONS.filter((r) => r.urgency === args.urgency) : RECOMMENDATIONS,
  }),
  get_module_intel: (args) => ({ available: false, module: args?.module, note: "embedded smoke test omits raw module slices" }),
};

const TOOL_DEFS = [
  { type: "function", name: "get_brand_snapshot", description: "Latest scan headline metrics (AI visibility, share of voice, reach, threat, aggression, competitors tracked, scan week).", parameters: { type: "object", properties: {}, additionalProperties: false } },
  { type: "function", name: "get_competitor_standings", description: "Per-competitor standings for the latest scan: reach score, share of voice %, aggression. Use to compare competitors or find who leads/gained on any metric.", parameters: { type: "object", properties: {}, additionalProperties: false } },
  { type: "function", name: "get_recommendations", description: "Open action-plan recommendations for the latest scan.", parameters: { type: "object", properties: { urgency: { type: "string", enum: ["urgent", "watch", "opportunity"] } }, additionalProperties: false } },
  { type: "function", name: "get_module_intel", description: "Detailed intelligence for one module (traffic_seo, geo, promotions, customers, hiring, regulatory, tech_stack).", parameters: { type: "object", properties: { module: { type: "string" } }, required: ["module"], additionalProperties: false } },
];

const INSTRUCTIONS =
  "You are Brandscope's brand-intelligence assistant for Betvita, an iGaming brand competing in Uganda. " +
  "Answer questions about this brand's competitive position using the provided tools to read its latest scan data. " +
  "Never invent metrics, competitors, or a scan week. Cite the scan week when you give figures. Be concise; lead with the answer.";

async function createResponse(body) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  return res.json();
}

(async () => {
  console.log(`\n• model: ${MODEL}`);
  console.log(`• question: ${question}\n`);
  let input = [{ role: "user", content: question }];
  let previousResponseId;
  const toolsUsed = [];

  for (let round = 0; round <= 5; round++) {
    const body = { model: MODEL, instructions: INSTRUCTIONS, input, tools: TOOL_DEFS, max_output_tokens: 1024, store: true };
    if (previousResponseId) body.previous_response_id = previousResponseId;

    const resp = await createResponse(body);
    previousResponseId = resp.id;
    const output = Array.isArray(resp.output) ? resp.output : [];
    const calls = output.filter((i) => i.type === "function_call");

    if (calls.length === 0) {
      console.log("─".repeat(60));
      console.log(resp.output_text?.trim() || "(no answer)");
      console.log("─".repeat(60));
      console.log(`\ntools called: ${toolsUsed.join(", ") || "none"}\n`);
      return;
    }

    const outputs = [];
    for (const call of calls) {
      const args = (() => { try { return JSON.parse(call.arguments || "{}"); } catch { return {}; } })();
      console.log(`  → tool: ${call.name}(${JSON.stringify(args)})`);
      toolsUsed.push(call.name);
      const impl = TOOL_IMPL[call.name];
      const data = impl ? impl(args) : { error: `unknown tool ${call.name}` };
      outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(data).slice(0, 8000) });
    }
    input = outputs;
  }
  console.log("Stopped after max rounds without a final answer.");
})().catch((e) => {
  console.error(`\nFAILED: ${e.message}\n`);
  process.exit(1);
});
