// Haiku classification for researcher-hiring (mvp-module-sources.md §9): turn raw
// Google Jobs SERP postings (title/location/date only — PARTIAL coverage) into the
// `hiring_signals_cache` jsonb shapes the frontend reads (lib/data/hiring-signals.ts):
//   roles               HiringRole[]          {title, location?, postedAt?, category?}
//   interpreted_signals InterpretedSignal[]   {signal, rationale, impact?}
//   geographic_expansion GeographicExpansion[] {market, roleCount}
//   signal_types        string[]              coarse tags for chips
//
// The Haiku call classifies each role → signal type, interprets strategic meaning
// (aggressive expansion ⇒ high impact), and is the SINGLE LLM step. Job text is
// UNTRUSTED → wrapped via asUntrustedData before it enters the prompt (guard.ts).
// We NEVER fabricate full job-description bodies — only titles/locations/dates are real.

import { MODELS } from "../_shared/contracts.ts";
import { callClaude, loggedLlm, parseJsonFromModel } from "../_shared/llm.ts";
import { resolveModel } from "../_shared/router.ts";
import { asUntrustedData } from "../_shared/guard.ts";
import type { SupabaseClient } from "../_shared/supabase.ts";
import type { JobPosting } from "./dataforseo-jobs.ts";
import { marketMeta } from "./dataforseo-jobs.ts";

const PROMPT_VERSION = "hiring-classify-v1";

// ── frontend-mirrored output shapes (lib/data/hiring-signals.ts) ─────────────
export type HiringRole = {
  title: string;
  location: string | null;
  postedAt: string | null;
  category: string | null;
};

export type InterpretedSignal = {
  signal: string;
  rationale: string;
  impact: "high" | "medium" | "low";
};

export type GeographicExpansion = { market: string; roleCount: number };

export type HiringClassification = {
  roles: HiringRole[];
  interpretedSignals: InterpretedSignal[];
  geographicExpansion: GeographicExpansion[];
  signalTypes: string[];
  /** 0–1 completeness/confidence used for agent_job_logs.data_quality_score. */
  dataQualityScore: number;
};

function impactOf(v: unknown): "high" | "medium" | "low" {
  return v === "high" || v === "medium" || v === "low" ? v : "medium";
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

/** Geographic-expansion fallback computed in CODE from the discovery market of
 *  each posting — a real role count, never a guess. Used when the model omits it. */
function expansionFromPostings(postings: JobPosting[]): GeographicExpansion[] {
  const counts = new Map<string, number>();
  for (const p of postings) {
    const label = marketMeta(p.market).label;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([market, roleCount]) => ({ market, roleCount }))
    .sort((a, b) => b.roleCount - a.roleCount);
}

/**
 * Classify one competitor's job postings with Haiku. The roles list is grounded
 * in the REAL postings (we map every posting through, attaching the model's
 * category/signal tags); the interpreted signals + signal types come from the
 * model's strategic read. Returns deterministic fallbacks when the model output
 * is unusable, so a malformed LLM response degrades rather than throws.
 */
export async function classifyHiring(
  sb: SupabaseClient,
  ctx: { scanJobId: string; brandId: string; taskType: string; competitorName: string },
  postings: JobPosting[],
): Promise<HiringClassification> {
  // Ground truth: the roles we actually observed (title/location/date are real).
  const baseRoles: HiringRole[] = postings.map((p) => ({
    title: p.title,
    location: p.location,
    postedAt: p.postedAt,
    category: p.category,
  }));

  if (postings.length === 0) {
    return {
      roles: [],
      interpretedSignals: [],
      geographicExpansion: [],
      signalTypes: [],
      dataQualityScore: 0,
    };
  }

  // Compact, UNTRUSTED job text for the model — titles/locations/dates only.
  const jobsText = postings
    .map((p, i) =>
      `${i + 1}. title="${p.title}"` +
      (p.location ? ` location="${p.location}"` : "") +
      (p.market ? ` market="${marketMeta(p.market).label}"` : "") +
      (p.category ? ` category="${p.category}"` : "") +
      (p.postedAt ? ` posted="${p.postedAt}"` : ""),
    )
    .join("\n");

  const system =
    "You are a competitive-intelligence analyst for iGaming brands in Nigeria, " +
    "Kenya and South Africa. You read a competitor's OPEN JOB TITLES (titles, " +
    "locations and dates only — you do NOT have full job descriptions) and infer " +
    "strategic hiring signals. Be precise and never invent roles, descriptions, " +
    "salaries or counts that are not in the data. Aggressive/expansionary hiring " +
    "(many roles, new markets, senior leadership, paid-acquisition or product " +
    "scaling) implies HIGH impact. Output ONLY JSON.";

  const instruction = [
    `Competitor: ${ctx.competitorName}`,
    "From the job titles below, produce JSON with this exact shape:",
    "{",
    '  "roleCategories": [ { "index": <1-based number from the list>, "category": "Engineering|Product|Marketing|Sales|Compliance|Operations|Data|Finance|Leadership|Other", "signalType": "product expansion|market entry|compliance hire|marketing push|tech scaling|leadership build-out|operations scaling" } ],',
    '  "interpretedSignals": [ { "signal": "<short headline>", "rationale": "<why these titles imply it; reference the roles>", "impact": "high|medium|low" } ],',
    '  "signalTypes": [ "<coarse tag>", ... ]',
    "}",
    "Rules: 4 or fewer interpretedSignals. signalTypes are short lowercase tags",
    "(e.g. 'expansion','tech-hiring','compliance','marketing'). Mark aggressive",
    "expansion as impact 'high'. Reference only roles that appear in the data.",
    "",
    asUntrustedData(`google-jobs:${ctx.competitorName}`, jobsText),
  ].join("\n");

  let parsed: {
    roleCategories?: { index?: number; category?: string; signalType?: string }[];
    interpretedSignals?: { signal?: string; rationale?: string; impact?: string }[];
    signalTypes?: string[];
  } = {};

  try {
    const res = await loggedLlm(
      sb,
      {
        scan_job_id: ctx.scanJobId,
        brand_id: ctx.brandId,
        agent_name: "researcher",
        task_type: ctx.taskType,
        prompt_version: PROMPT_VERSION,
        input_snapshot: { competitor: ctx.competitorName, postings: postings.length },
        // data_quality_score is set below once we know how much resolved.
      },
      async () =>
        callClaude({
          model: await resolveModel(sb, "researcher_structuring", MODELS.haiku),
          system,
          messages: [{ role: "user", content: instruction }],
          maxTokens: 1200,
          temperature: 0.2,
        }),
    );
    parsed = parseJsonFromModel(res.text);
  } catch (_e) {
    // Model/parse failure → fall back to grounded roles + code-derived expansion,
    // with no interpreted signals (we never fabricate strategic claims).
    return {
      roles: baseRoles,
      interpretedSignals: [],
      geographicExpansion: expansionFromPostings(postings),
      signalTypes: [],
      dataQualityScore: 0.4,
    };
  }

  // Attach the model's category/signal tag to each REAL role by index.
  const byIndex = new Map<number, { category?: string; signalType?: string }>();
  for (const rc of parsed.roleCategories ?? []) {
    if (typeof rc.index === "number") byIndex.set(rc.index, rc);
  }
  const roles: HiringRole[] = baseRoles.map((r, i) => {
    const tag = byIndex.get(i + 1);
    return { ...r, category: r.category ?? strOrNull(tag?.category) };
  });

  const interpretedSignals: InterpretedSignal[] = (parsed.interpretedSignals ?? [])
    .map((s) => {
      const signal = strOrNull(s.signal);
      const rationale = strOrNull(s.rationale);
      if (!signal || !rationale) return null;
      return { signal, rationale, impact: impactOf(s.impact) };
    })
    .filter((s): s is InterpretedSignal => s !== null)
    .slice(0, 4);

  // signal_types: union of model tags + per-role signalType tags, deduped.
  const tagSet = new Set<string>();
  for (const t of parsed.signalTypes ?? []) {
    const s = strOrNull(t);
    if (s) tagSet.add(s.toLowerCase());
  }
  for (const rc of parsed.roleCategories ?? []) {
    const s = strOrNull(rc.signalType);
    if (s) tagSet.add(s.toLowerCase());
  }
  const signalTypes = Array.from(tagSet);

  // Geographic expansion: code-derived role counts by discovery market (real).
  const geographicExpansion = expansionFromPostings(postings);

  // data_quality: completeness — share of roles that got a category + whether we
  // extracted any interpreted signal. Bounded 0..1.
  const categorised = roles.filter((r) => r.category).length;
  const catShare = roles.length ? categorised / roles.length : 0;
  const dataQualityScore = Number(
    Math.min(1, 0.5 + 0.3 * catShare + (interpretedSignals.length > 0 ? 0.2 : 0)).toFixed(2),
  );

  return { roles, interpretedSignals, geographicExpansion, signalTypes, dataQualityScore };
}
