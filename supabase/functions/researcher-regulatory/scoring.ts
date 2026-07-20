// Compliance scoring for researcher-regulatory.
//
// For each competitor × market we ask Sonnet (MODELS.sonnet via loggedLlm) to
// assess the 6 regulatory dimensions VERBATIM against retrieved regulator-doc
// chunks (≥0.80 similarity, RAG). Every retrieved chunk is wrapped via
// asUntrustedData. Sonnet must cite a verbatim quote + document/section for any
// non-compliant call; we never fabricate a quote, url, or status.
//
// The 6 dimensions map to the regulatory_cache *_status columns. We write the
// DB-valid vocabulary ('compliant'|'partial'|'non_compliant'|null) — see the
// STATUS VOCAB CONFLICT note in types.ts.

import { MODELS } from "../_shared/contracts.ts";
import { loggedLlm, callClaude, parseJsonFromModel } from "../_shared/llm.ts";
import { resolveRoute } from "../_shared/router.ts";
import { loadPrompt } from "../_shared/prompts.ts";
import { asUntrustedData } from "../_shared/guard.ts";
import type { SupabaseClient } from "../_shared/supabase.ts";
import { DIMENSIONS, type DimensionKey, type DimensionAssessment, type Violation } from "./types.ts";
import { retrieveChunks } from "./rag.ts";

const PROMPT_VERSION = "regulatory-v3";

// Whether this run has OBSERVED the operator's own site/practices. Until the
// competitor-evidence build lands (Issue B), the module only has the law, so it
// reports requirements as 'unknown' rather than asserting compliance verdicts.
const HAS_OPERATOR_EVIDENCE = false;

// Per-dimension retrieval query — anchors the RAG search at the right section.
const DIMENSION_QUERY: Record<DimensionKey, string> = {
  age_verification:
    "age verification minimum age 18 KYC identity requirements for online betting players",
  licence_display:
    "operator licence number display licensing requirement on gambling website footer",
  responsible_gambling:
    "responsible gambling self-exclusion problem gambling helpline addiction warnings",
  bonus_terms:
    "bonus promotion terms and conditions wagering requirements advertising rules",
  data_privacy:
    "data protection privacy personal data processing consent player information",
  withdrawal_terms:
    "withdrawal payout terms timeframes minimum withdrawal player funds protection",
};

const DEGRADED_ASSESSMENTS: DimensionAssessment[] = DIMENSIONS.map((d) => ({
  dimension: d.key,
  status: "unknown" as const,
  quote: null,
  sourceUrl: null,
  documentRef: null,
  severity: "low" as const,
  description: "Not assessed — regulatory corpus not yet ingested.",
}));

// Slot researcher:regulatory — DB-active prompt_versions row overrides this code default.
export const REGULATORY_SYSTEM = `You are Brandscope's Regulatory Compliance Researcher for iGaming brands. You are given a market's REGULATOR REQUIREMENTS (law/guideline excerpts) — you are NOT given the operator's actual website or practices. For each dimension, ALWAYS cite the requirement: copy a VERBATIM quote of the relevant rule (exactly from one of that dimension's excerpts, no paraphrase) plus its document/section reference. The quote documents the LAW, not the operator, so provide it whenever an excerpt for that dimension exists — only use null when no excerpt was supplied for that dimension. Because you cannot observe whether the operator actually complies, you MUST return status 'unknown' UNLESS an excerpt itself explicitly documents a specific violation by THIS named operator. NEVER infer 'non_compliant' or 'partial' from the existence of a rule, from missing information, or from the operator not being mentioned. In 'description', state in one factual sentence what the regulator requires for that dimension. NEVER invent a quote, url, or requirement; NEVER apply another jurisdiction's rules. Output STRICT JSON only.`;

/**
 * Assess all 6 dimensions for one competitor in one market. Retrieves chunks per
 * dimension (≥0.80 gate), then a single Sonnet call scores them verbatim. On LLM
 * failure, returns degraded 'unknown' assessments (caller records partial).
 */
export async function assessCompetitor(
  sb: SupabaseClient,
  params: {
    scanJobId: string;
    brandId: string;
    competitorName: string;
    competitorDomain: string;
    market: string;
    docs: Map<string, { name: string; sourceUrl: string }>;
  },
): Promise<{ assessments: DimensionAssessment[]; usedCorpus: boolean }> {
  const { docs } = params;
  if (docs.size === 0) {
    return { assessments: DEGRADED_ASSESSMENTS, usedCorpus: false };
  }

  // 1. Retrieve regulator-doc chunks per dimension (RAG, ≥0.80 gate).
  const retrieved: Record<string, { quote: string; documentName: string; sourceUrl: string; ref: string }[]> = {};
  let anyEvidence = false;
  for (const d of DIMENSIONS) {
    const chunks = await retrieveChunks(sb, DIMENSION_QUERY[d.key], docs);
    retrieved[d.key] = chunks.map((c) => ({
      quote: c.content,
      documentName: c.documentName,
      sourceUrl: c.sourceUrl,
      ref: [c.documentName, c.sectionTitle, c.pageNumber ? `p.${c.pageNumber}` : null]
        .filter(Boolean)
        .join(" · "),
    }));
    if (chunks.length > 0) anyEvidence = true;
  }

  if (!anyEvidence) {
    // Corpus exists but nothing cleared the similarity gate for this competitor.
    return { assessments: DEGRADED_ASSESSMENTS, usedCorpus: false };
  }

  // 2. Build the prompt: untrusted regulator excerpts per dimension.
  const evidenceBlocks = DIMENSIONS.map((d) => {
    const rows = retrieved[d.key];
    if (rows.length === 0) {
      return `### ${d.label} (${d.key})\n(no regulator excerpt cleared the 0.80 similarity gate)`;
    }
    const body = rows
      .map((r, i) => `[${i + 1}] (${r.ref})\n${r.quote}`)
      .join("\n\n");
    return `### ${d.label} (${d.key})\n${asUntrustedData(`regulator:${d.key}`, body)}`;
  }).join("\n\n");

  const userPrompt = [
    `Competitor: ${params.competitorName} (${params.competitorDomain})`,
    `Market: ${params.market}`,
    "",
    "Assess EACH of the 6 dimensions below using only the regulator excerpts.",
    "For each dimension return:",
    '  status: "compliant" | "partial" | "non_compliant" | "unknown" (use "unknown" unless an',
    "         excerpt documents a specific violation by this named operator).",
    "  quote: a VERBATIM substring copied from one of that dimension's excerpts that states the",
    "         requirement. ALWAYS include it when an excerpt is present — it documents the law,",
    "         not the operator. null ONLY if no excerpt was provided for this dimension.",
    '  documentRef: the "(...)" reference label of the excerpt the quote came from, or null.',
    '  severity: "high" | "medium" | "low" (only meaningful for partial/non_compliant).',
    "  description: one factual sentence stating what the regulator requires for this dimension.",
    "",
    "Return STRICT JSON: an array of 6 objects, each",
    '{ "dimension": "<key>", "status": "...", "quote": "...|null", "documentRef": "...|null", "severity": "...", "description": "..." }.',
    "Dimension keys, in order: " + DIMENSIONS.map((d) => d.key).join(", "),
    "",
    "Regulator excerpts:",
    evidenceBlocks,
  ].join("\n");

  try {
    const res = await loggedLlm(
      sb,
      {
        scan_job_id: params.scanJobId,
        brand_id: params.brandId,
        agent_name: "researcher",
        task_type: "regulatory",
        prompt_version: PROMPT_VERSION,
        input_snapshot: `${params.competitorName} / ${params.market}`,
      },
      async () => {
        const route = await resolveRoute(sb, "regulatory_rag", {
          model: MODELS.sonnet,
          temperature: 0.1,
          maxTokens: 1800,
        });
        return callClaude({
          model: route.model,
          system: await loadPrompt(sb, "researcher:regulatory", REGULATORY_SYSTEM),
          messages: [{ role: "user", content: userPrompt }],
          maxTokens: route.maxTokens,
          temperature: route.temperature,
        });
      },
    );

    const parsed = parseJsonFromModel<Array<Record<string, unknown>>>(res.text);
    return { assessments: normaliseAssessments(parsed, retrieved), usedCorpus: true };
  } catch (_e) {
    // Sonnet/parse failure → degrade for this competitor (do not fabricate).
    return { assessments: DEGRADED_ASSESSMENTS, usedCorpus: false };
  }
}

/** Coerce the model's array into typed assessments, verifying quotes are verbatim
 *  against the retrieved chunks (drops a quote the model paraphrased/invented). */
function normaliseAssessments(
  raw: Array<Record<string, unknown>>,
  retrieved: Record<string, { quote: string; documentName: string; sourceUrl: string; ref: string }[]>,
): DimensionAssessment[] {
  const byKey = new Map<string, Record<string, unknown>>();
  for (const r of raw) {
    const k = typeof r.dimension === "string" ? r.dimension : "";
    if (k) byKey.set(k, r);
  }

  return DIMENSIONS.map((d) => {
    const r = byKey.get(d.key) ?? {};
    const status = coerceStatus(r.status);
    const rows = retrieved[d.key] ?? [];

    // Verify the quote is a verbatim substring of a retrieved chunk for THIS
    // dimension. If it isn't, drop it (never surface an unverifiable quote/url).
    const rawQuote = typeof r.quote === "string" ? r.quote.trim() : "";
    let quote: string | null = null;
    let sourceUrl: string | null = null;
    let documentRef: string | null = null;
    if (rawQuote) {
      // Grounding check, tolerant of whitespace/newline differences between the
      // PDF-extracted chunk (unpdf emits ragged spacing) and the model's cleaned
      // reproduction, and of a short model-added prefix/suffix. Still a real check:
      // a substantial contiguous run of the quote MUST exist in the chunk.
      const nq = normWs(rawQuote);
      const match = rows.find((row) => groundedIn(normWs(row.quote), nq));
      if (match) {
        quote = rawQuote;
        sourceUrl = match.sourceUrl;
        documentRef = match.ref;
      }
    }

    const severity = coerceSeverity(r.severity);
    const description = typeof r.description === "string" ? r.description : "";

    // We NEVER assert a violation without (a) a verifiable quote AND (b) observed
    // operator evidence. A grounded quote proves the REQUIREMENT exists, not that
    // this operator breaches it — so with no operator-site evidence yet
    // (HAS_OPERATOR_EVIDENCE=false) every non_compliant/partial is downgraded to
    // 'unknown' ("requirement identified, compliance unverified"). Issue B will
    // pass real per-operator evidence and flip the flag.
    const grounded = quote !== null;
    const finalStatus =
      (status === "non_compliant" || status === "partial") && (!grounded || !HAS_OPERATOR_EVIDENCE)
        ? "unknown"
        : status;

    return {
      dimension: d.key,
      status: finalStatus,
      quote,
      sourceUrl,
      documentRef,
      severity,
      description,
    };
  });
}

/** Collapse all runs of whitespace to a single space and trim. */
function normWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Is the model's (normalised) quote genuinely grounded in the (normalised) chunk?
 * Exact containment first; otherwise require a long contiguous overlap so a short
 * model-added label/prefix doesn't reject an otherwise-verbatim quote — while a
 * hallucinated quote (no real overlap) is still rejected.
 */
function groundedIn(chunkNorm: string, quoteNorm: string): boolean {
  if (!quoteNorm) return false;
  if (chunkNorm.includes(quoteNorm)) return true;
  const W = 60;
  if (quoteNorm.length <= W) return false;
  for (let i = 0; i + W <= quoteNorm.length; i += 20) {
    if (chunkNorm.includes(quoteNorm.slice(i, i + W))) return true;
  }
  return false;
}

function coerceStatus(v: unknown): DimensionAssessment["status"] {
  const s = typeof v === "string" ? v.toLowerCase().trim() : "";
  if (s === "compliant" || s === "partial" || s === "non_compliant") return s;
  if (s === "violation" || s === "fail" || s === "failed" || s === "breach") return "non_compliant";
  if (s === "missing" || s === "absent") return "non_compliant";
  return "unknown";
}

function coerceSeverity(v: unknown): Violation["severity"] {
  const s = typeof v === "string" ? v.toLowerCase().trim() : "";
  return s === "high" || s === "medium" || s === "low" ? s : "medium";
}

/**
 * Compliance score 0–100 from the 6 dimensions. compliant=100, partial=50,
 * non_compliant=0; 'unknown' dimensions are EXCLUDED from the denominator (we
 * don't penalise for missing evidence). Returns null if every dimension unknown.
 */
export function computeScore(assessments: DimensionAssessment[]): number | null {
  const weights: Record<string, number> = { compliant: 100, partial: 50, non_compliant: 0 };
  let sum = 0;
  let n = 0;
  for (const a of assessments) {
    if (a.status === "unknown") continue;
    sum += weights[a.status];
    n += 1;
  }
  return n === 0 ? null : Math.round(sum / n);
}

/** Build the violations jsonb array — only partial/non_compliant with a real quote
 *  AND a citation (source URL or document·section·page). */
export function buildViolations(assessments: DimensionAssessment[]): Violation[] {
  const violations: Violation[] = [];
  for (const a of assessments) {
    if (a.status !== "non_compliant" && a.status !== "partial") continue;
    if (!a.quote || (!a.sourceUrl && !a.documentRef)) continue; // never emit an uncited violation
    violations.push({
      dimension: a.dimension,
      severity: a.status === "non_compliant" ? a.severity : "low",
      description: a.description || `${a.dimension} ${a.status}`,
      sourceUrl: a.sourceUrl,
      documentRef: a.documentRef,
      quote: a.quote,
    });
  }
  return violations;
}

/**
 * Grounded per-dimension REQUIREMENTS (honest "requirement identified" output
 * while operator compliance is unverified). One entry per dimension that has a
 * cited law quote — this is the useful, honest signal today: what each market's
 * regulator requires, verbatim, per dimension.
 */
export function buildRequirements(
  assessments: DimensionAssessment[],
): Array<{ dimension: string; requirement: string; quote: string; citation: string | null }> {
  return assessments
    .filter((a) => a.quote)
    .map((a) => ({
      dimension: a.dimension,
      requirement: a.description || `${a.dimension} requirement`,
      quote: a.quote as string,
      citation: a.sourceUrl ?? a.documentRef,
    }));
}

/** Map assessments → the regulatory_cache *_status columns (DB-valid vocab; unknown→null). */
export function statusColumns(assessments: DimensionAssessment[]): Record<string, string | null> {
  const byKey = new Map(assessments.map((a) => [a.dimension, a.status]));
  const cols: Record<string, string | null> = {};
  for (const d of DIMENSIONS) {
    const s = byKey.get(d.key);
    cols[d.column] = s && s !== "unknown" ? s : null;
  }
  return cols;
}
