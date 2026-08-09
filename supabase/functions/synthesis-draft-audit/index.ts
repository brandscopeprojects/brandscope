// synthesis-draft-audit — Edge Function (Deno).
// Pipeline stage 5 (agent-orchestration.md §"End-to-end sequence"):
//   ONE grounded synthesis call → deterministic guardrails (Five-Question evidence
//   filter, dedup, URGENT gating, score→level) → hand off to cache-population.
//   (Phase 1 simplification: replaced the former Supervisor→Drafter→Auditor chain
//   of 3 sequential LLM calls, which stalled on the 150s worker limit.)
//
// CONTRACT: body = ScanSynthesisMessage { scan_job_id, brand_id, scan_week }.
// Internal-auth gated (CRON_SECRET bearer). Service-role; every query scoped to
// the single brand_id (isolation rule). Persists NOTHING to weekly_cache /
// recommendations here — cache-population is the only writer. We RETURN the final
// recommendations + brief AND invoke cache-population with them.
//
// File ownership: only this folder. _shared is read-only.

import { serviceClient, type SupabaseClient } from "../_shared/supabase.ts";
import { json, preflight, isAuthorizedInternal } from "../_shared/http.ts";
import { MODELS, type ScanSynthesisMessage, type RecommendationEvidence } from "../_shared/contracts.ts";
import { callClaude, loggedLlm, parseJsonFromModel } from "../_shared/llm.ts";
import { asUntrustedData } from "../_shared/guard.ts";
import { invokeFunction } from "../_shared/scan.ts";
import { resolveRoute } from "../_shared/router.ts";
import { withMeter, setMeterCtx } from "../_shared/spend.ts";
import { loadPrompt, renderPrompt } from "../_shared/prompts.ts";
import {
  PROMPT_VERSION,
  levelFromScore,
  SYNTHESIS_SYSTEM,
  type SynthesisBrief,
  type SynthesisOutput,
  type SynthesisRecommendation,
  type DraftRecommendation,
} from "./prompts.ts";

// ---- Token / size budgets (one call, well under the 45s LLM timeout) ----
const MAX_ROWS_PER_CACHE = 12; // cap competitor rows fed per module
const CACHE_TEXT_CAP = 1600; // chars per module block before wrapping
// Brief (~300 tok) + up to 8 evidence-backed recs in one JSON object.
const SYNTHESIS_MAX_TOKENS = 4500;

// The final recommendation we hand to cache-population. Shape is intentionally the
// jsonb the frontend reads (lib/data/*.ts): evidence element uses `timestamp`
// (mapped to scrapedAt), confidence_level ∈ high|medium|low|rejected, urgency ∈
// urgent|watch|opportunity|info. cache-population owns the DB INSERT.
export type FinalRecommendation = {
  urgency: "urgent" | "watch" | "opportunity" | "info";
  category: string;
  headline: string;
  trigger_reason: string;
  evidence: RecommendationEvidence[];
  assumption_flags: string[];
  is_direct_evidence: boolean;
  confidence_score: number;
  confidence_level: "high" | "medium" | "low" | "rejected";
};

Deno.serve(withMeter(async (req: Request): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!isAuthorizedInternal(req)) return json({ error: "unauthorized" }, 401);

  let body: ScanSynthesisMessage;
  try {
    body = (await req.json()) as ScanSynthesisMessage;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const { scan_job_id, brand_id, scan_week } = body ?? {};
  if (!scan_job_id || !brand_id || !scan_week) {
    return json({ error: "missing_fields", required: ["scan_job_id", "brand_id", "scan_week"] }, 400);
  }

  const sb = serviceClient();

  // Meter this synthesis run's LLM spend into provider_spend (see spend.ts). The
  // ScanSynthesisMessage carries no org, so resolve it from the brand for accurate
  // per-org daily caps; brand_id/scan_job_id still attribute the scan-level cost.
  const { data: brandOrg } = await sb.from("brands").select("organisation_id").eq("id", brand_id).maybeSingle();
  setMeterCtx({
    sb,
    organisation_id: (brandOrg?.organisation_id as string | null) ?? null,
    brand_id,
    scan_job_id,
    task_type: "synthesis",
  });

  // Kill switch (Agent Control): drafter/auditor paused → no synthesis, job partial.
  // Fail-safe: any read problem → proceed.
  try {
    const { data: gateRows } = await sb
      .from("agents")
      .select("name, status")
      .in("name", ["drafter", "auditor"]);
    const paused = (gateRows ?? []).filter((a) => a.status === "inactive").map((a) => a.name);
    if (paused.length > 0) {
      await sb
        .from("scan_jobs")
        .update({
          status: "partial",
          error_message: `synthesis paused by kill switch (${paused.join(", ")})`,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", scan_job_id);
      return json({ ok: false, error: "synthesis paused by kill switch", paused }, 409);
    }
  } catch (_e) {
    // proceed
  }

  try {
    // 1. Load brand context (defensively — missing caches are fine: partial scan).
    const ctx = await loadContext(sb, brand_id, scan_week);

    const logCtx = {
      scan_job_id,
      brand_id,
      task_type: "synthesis",
      prompt_version: PROMPT_VERSION,
    };

    // 2. ONE synthesis call → brief + self-scored recs; then deterministic guardrails
    //    (real-evidence filter, dedup, URGENT gating, score→level) applied in code.
    const { brief, recommendations: audited } = await runSynthesis(sb, logCtx, ctx);

    // 5. Hand off to cache-population (the ONLY writer of weekly_cache/recommendations).
    //    We pass the brief + recommendations; we persist nothing ourselves.
    invokeFunction("cache-population", {
      scan_job_id,
      brand_id,
      scan_week,
      recommendations: audited,
      brief,
    });

    // 6. Return summary (every LLM call already wrote agent_job_logs via loggedLlm).
    const kept = audited.filter((r) => r.confidence_level !== "rejected").length;
    return json({ ok: true, recommendationCount: kept, totalDrafted: audited.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: message }, 500);
  }
}));

// ---------------------------------------------------------------------------
// 1. Context loading
// ---------------------------------------------------------------------------

type Ctx = {
  brand: Record<string, unknown> | null;
  competitorNames: Map<string, string>;
  memory: Record<string, unknown>[];
  prevHeadlines: string[];
  // raw cache rows per module (already brand-scoped)
  caches: Record<string, Record<string, unknown>[]>;
};

async function loadContext(sb: SupabaseClient, brandId: string, scanWeek: string): Promise<Ctx> {
  // brand row
  const { data: brand } = await sb.from("brands").select("*").eq("id", brandId).maybeSingle();

  // competitor id → name map (for this brand) — used to label evidence/threats.
  const competitorNames = new Map<string, string>();
  const { data: bc } = await sb
    .from("brand_competitors")
    .select("competitor_id, competitors(id, name, domain)")
    .eq("brand_id", brandId);
  const competitorIds: string[] = [];
  for (const row of bc ?? []) {
    const c = (row as Record<string, unknown>).competitors as { id?: string; name?: string } | null;
    const cid = (row as Record<string, unknown>).competitor_id as string;
    competitorIds.push(cid);
    if (c?.id && c?.name) competitorNames.set(c.id, c.name);
  }

  // active performance_memory (learned patterns for this brand).
  const { data: memory } = await sb
    .from("performance_memory")
    .select("memory_type, title, description, confidence_score")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .limit(20);

  // previous week's recommendation headlines (dedupe context).
  const { data: prevRecs } = await sb
    .from("recommendations")
    .select("headline, scan_week")
    .eq("brand_id", brandId)
    .neq("scan_week", scanWeek)
    .order("scan_week", { ascending: false })
    .limit(20);
  const prevHeadlines = (prevRecs ?? []).map((r) => String((r as Record<string, unknown>).headline ?? "")).filter(Boolean);

  // Module caches for (brand_id, scan_week). tech_stack_cache has no brand_id
  // column — it is keyed by competitor_id, so we filter by this brand's competitors.
  const caches: Record<string, Record<string, unknown>[]> = {};
  const brandScoped = [
    "seo_cache",
    "geo_cache",
    "promotions_cache",
    "regulatory_cache",
    "customer_intel_cache",
    "hiring_signals_cache",
    "product_intel_cache",
  ];
  await Promise.all(
    brandScoped.map(async (table) => {
      const { data } = await sb
        .from(table)
        .select("*")
        .eq("brand_id", brandId)
        .eq("scan_week", scanWeek)
        .limit(50);
      caches[table] = (data ?? []) as Record<string, unknown>[];
    }),
  );
  // tech_stack_cache via competitor join (no brand_id column).
  if (competitorIds.length) {
    const { data: tech } = await sb
      .from("tech_stack_cache")
      .select("*")
      .in("competitor_id", competitorIds)
      .eq("scan_week", scanWeek)
      .limit(50);
    caches["tech_stack_cache"] = (tech ?? []) as Record<string, unknown>[];
  } else {
    caches["tech_stack_cache"] = [];
  }

  return { brand, competitorNames, memory: (memory ?? []) as Record<string, unknown>[], prevHeadlines, caches };
}

// ---------------------------------------------------------------------------
// Cache → prompt text. Untrusted scraped fields are wrapped via asUntrustedData.
// We label each row with its competitor name + the real source_url/timestamp so
// the Drafter can cite REAL evidence (never fabricated).
// ---------------------------------------------------------------------------

function nameFor(ctx: Ctx, row: Record<string, unknown>): string {
  const cid = row.competitor_id as string | undefined;
  return (cid && ctx.competitorNames.get(cid)) || "competitor";
}

function compactCacheBlock(ctx: Ctx, label: string, rows: Record<string, unknown>[]): string {
  if (!rows.length) return `### ${label}: (no data this week)`;
  const lines = rows.slice(0, MAX_ROWS_PER_CACHE).map((r) => {
    const who = nameFor(ctx, r);
    // Keep the structured (trusted) keys; drop bulky raw_* blobs from the prompt.
    const slim: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      if (k === "raw_data" || k === "raw_response" || k === "id" || k === "created_at") continue;
      if (v == null) continue;
      slim[k] = v;
    }
    return `- [${who}] ${JSON.stringify(slim).slice(0, 600)}`;
  });
  const joined = lines.join("\n").slice(0, CACHE_TEXT_CAP);
  // Module rows contain third-party scraped text → wrap as untrusted DATA.
  return `### ${label}\n${asUntrustedData(label, joined)}`;
}

function buildModuleDigest(ctx: Ctx): string {
  const map: [string, string][] = [
    ["seo_cache", "SEO / traffic"],
    ["geo_cache", "GEO / AI visibility"],
    ["tech_stack_cache", "Tech stack"],
    ["promotions_cache", "Promotions"],
    ["regulatory_cache", "Regulatory"],
    ["customer_intel_cache", "Customer intelligence"],
    ["hiring_signals_cache", "Hiring signals"],
    ["product_intel_cache", "Product intelligence"],
  ];
  return map.map(([table, label]) => compactCacheBlock(ctx, label, ctx.caches[table] ?? [])).join("\n\n");
}

function brandHeader(ctx: Ctx): string {
  const b = ctx.brand ?? {};
  return [
    `Brand: ${b.name ?? "(unknown)"} (${b.domain ?? "?"})`,
    `Markets: ${Array.isArray(b.market) ? (b.market as string[]).join(", ") : "?"}`,
    `Positioning: ${b.positioning_statement ?? "(none)"}`,
    `Competitors tracked: ${[...ctx.competitorNames.values()].join(", ") || "(none)"}`,
  ].join("\n");
}

function memoryBlock(ctx: Ctx): string {
  if (!ctx.memory.length) return "Learned patterns (performance_memory): (none yet)";
  const lines = ctx.memory
    .slice(0, 12)
    .map((m) => `- [${m.memory_type}] ${m.title}: ${m.description}`)
    .join("\n");
  return `Learned patterns (performance_memory):\n${lines}`;
}

// ---------------------------------------------------------------------------
// 2. Synthesis (one grounded call → brief + self-scored recs)
// ---------------------------------------------------------------------------

type LogCtx = { scan_job_id: string; brand_id: string; task_type: string; prompt_version: string };

async function runSynthesis(
  sb: SupabaseClient,
  logCtx: LogCtx,
  ctx: Ctx,
): Promise<{ brief: SynthesisBrief; recommendations: FinalRecommendation[] }> {
  const prevList = ctx.prevHeadlines.length ? ctx.prevHeadlines.map((h) => `- ${h}`).join("\n") : "- (none)";
  const system = renderPrompt(await loadPrompt(sb, "synthesis", SYNTHESIS_SYSTEM), {
    prev_headlines: prevList,
  });
  const user = [
    brandHeader(ctx),
    "",
    memoryBlock(ctx),
    "",
    "Raw module intelligence (cite REAL source_url + extracted_text + timestamp from these rows):",
    buildModuleDigest(ctx),
    "",
    "OUTPUT FORMAT: respond with ONLY a JSON object { brief, recommendations }. " +
      "Your reply MUST start with '{' and end with '}'. No reasoning, preamble, or " +
      "markdown fences. Drop any recommendation that fails the Five-Question filter.",
  ].join("\n");

  const route = await resolveRoute(sb, "synthesis", {
    model: MODELS.sonnet,
    temperature: 0.3,
    maxTokens: SYNTHESIS_MAX_TOKENS,
  });
  const res = await loggedLlm(sb, { ...logCtx, agent_name: "synthesis", input_snapshot: user }, () =>
    callClaude({
      model: route.model,
      system,
      messages: [{ role: "user", content: user }],
      maxTokens: route.maxTokens,
      temperature: route.temperature,
    }),
  );

  let out: SynthesisOutput | null = null;
  try {
    out = parseJsonFromModel<SynthesisOutput>(res.text);
  } catch {
    out = null;
  }

  const brief: SynthesisBrief = out?.brief ?? {
    summary: "Synthesis unavailable this week.",
    market_position: "",
    top_threats: [],
    top_opportunities: [],
    notable_competitor_moves: [],
    regulatory_flags: [],
    modules_covered: Object.keys(ctx.caches).filter((k) => (ctx.caches[k] ?? []).length),
  };

  const raw = Array.isArray(out?.recommendations) ? out!.recommendations : [];
  // Deterministic guardrails (the model does not get the last word):
  //  - Five-Question filter keeps only real-evidence, non-duplicate recs.
  //  - score→level bucketing + URGENT gating stay in code.
  const recommendations = raw
    .filter((r) => passesFiveQuestion(r, ctx.prevHeadlines))
    .slice(0, 8)
    .map((r) => finalise(r));

  return { brief, recommendations };
}

// Apply confidence bucketing + URGENT gating to one guardrail-passed rec.
function finalise(r: SynthesisRecommendation): FinalRecommendation {
  const score = clamp01(Number(r.confidence_score));
  const level = levelFromScore(score);
  // URGENT gating: only allow 'urgent' when level is 'high' AND direct evidence.
  const urgency =
    r.urgency === "urgent" && !(level === "high" && r.is_direct_evidence === true) ? "watch" : r.urgency;
  return {
    urgency,
    category: r.category,
    headline: r.headline,
    trigger_reason: r.trigger_reason,
    evidence: r.evidence,
    assumption_flags: r.assumption_flags ?? [],
    is_direct_evidence: r.is_direct_evidence === true,
    confidence_score: round2(score),
    confidence_level: level,
  };
}

// Five-Question filter: specific, evidence-backed, actionable, time-bound,
// non-duplicative. Evidence items must carry a real URL + quote (no fabrication).
function passesFiveQuestion(r: DraftRecommendation, prevHeadlines: string[]): boolean {
  if (!r || typeof r !== "object") return false;
  if (!r.headline || !r.trigger_reason || !r.category) return false;
  if (!["urgent", "watch", "opportunity", "info"].includes(r.urgency)) return false;

  // Evidence-backed: ≥1 evidence item with a real (http) url + non-empty quote.
  const ev = Array.isArray(r.evidence) ? r.evidence : [];
  const realEvidence = ev.filter(
    (e) => e && typeof e.source_url === "string" && /^https?:\/\//i.test(e.source_url) && String(e.extracted_text ?? "").trim().length > 0,
  );
  if (realEvidence.length === 0) return false;

  // Specific: headline should reference something concrete (heuristic: length).
  if (r.headline.trim().length < 12) return false;

  // Non-duplicative vs last week (case-insensitive exact-ish match).
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  if (prevHeadlines.some((h) => norm(h) === norm(r.headline))) return false;

  // Normalise evidence to only the real items before it proceeds downstream.
  r.evidence = realEvidence.map((e) => ({
    source_url: e.source_url,
    timestamp: String(e.timestamp ?? new Date().toISOString()),
    extracted_text: String(e.extracted_text),
    change_before: e.change_before ?? null,
    change_after: e.change_after ?? null,
    evidence_hash: e.evidence_hash ?? null,
  }));
  if (!Array.isArray(r.assumption_flags)) r.assumption_flags = [];
  if (typeof r.is_direct_evidence !== "boolean") r.is_direct_evidence = false;
  return true;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
