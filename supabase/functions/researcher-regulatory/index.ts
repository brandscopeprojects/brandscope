// researcher-regulatory — Regulatory Researcher (mvp-module-sources.md §7;
// agent-orchestration.md Researcher pattern). Consumes a ScanModuleMessage
// (task_type 'regulatory') from the POST body. Per (brand × competitor × market):
//   1. Change detection  — DataForSEO Google News for regulator announcements.
//   2. Compliance scoring — RAG over document_chunks (≥0.80 cosine), Sonnet scores
//      the 6 dimensions VERBATIM (cite document + quote). Corpus empty → degrade
//      honestly (statuses null, feature_health 'degraded', completeModule 'partial').
//   3. compliance_score (0–100) + violations jsonb (real quotes/urls only).
//   4. Ingestion (best-effort, bounded) — discover a new regulator-doc URL via News
//      → embed → insert document_chunks + ingestion_logs row. R2 not wired in
//      _shared yet → r2_path left as a sentinel TODO (NOT a fabricated path).
//   5. UPSERT regulatory_cache onConflict (brand_id,scan_week,competitor_id,market).
//   6. completeModule → enqueue synthesis when the fan-out finishes.
//
// Service-role; every query scoped to msg.brand_id (RLS bypassed → isolate in code).
// 90s budget: this is the heaviest module — we hard-cap competitors × markets and
// skip ingestion under time pressure (logged, never silently).

import { serviceClient } from "../_shared/supabase.ts";
import { json, preflight, isAuthorizedInternal } from "../_shared/http.ts";
import { withMeter, setMeterCtx } from "../_shared/spend.ts";
import { completeModule, enqueueSynthesis, invokeFunction } from "../_shared/scan.ts";
import { recordFeatureHealth, toDeadLetter } from "../_shared/logging.ts";
import { type ScanModuleMessage } from "../_shared/contracts.ts";
import { activeDocumentsForMarket } from "./rag.ts";
import { fetchRegulatoryNews, type NewsItem } from "./change-detection.ts";
import { assessCompetitor, computeScore, buildViolations, statusColumns } from "./scoring.ts";
import { maybeIngestDocument } from "./ingestion.ts";

const TIME_BUDGET_MS = 80_000; // leave headroom under the 90s ceiling for finalisation
const SYNTHESIS_FN = "synthesis-draft-audit";

Deno.serve(withMeter(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (!isAuthorizedInternal(req)) return json({ error: "unauthorized" }, 401);

  let msg: ScanModuleMessage;
  try {
    msg = (await req.json()) as ScanModuleMessage;
  } catch {
    return json({ error: "invalid json body" }, 400);
  }
  if (!msg.scan_job_id || !msg.brand_id || msg.task_type !== "regulatory") {
    return json({ error: "expected ScanModuleMessage task_type 'regulatory'" }, 400);
  }

  const sb = serviceClient();
  setMeterCtx({ sb, organisation_id: msg.organisation_id ?? null, brand_id: msg.brand_id, scan_job_id: msg.scan_job_id, task_type: msg.task_type });
  const deadline = Date.now() + TIME_BUDGET_MS;
  const requestedMarkets = (msg.markets ?? []).map((m) => m.toLowerCase());
  // CORPUS-DRIVEN support (no hardcoded market allowlist): a market is scorable
  // iff we have ingested regulator documents for it (regulatory_documents, seeded
  // via the Knowledge Base upload). We score each market ONLY against its OWN
  // corpus — never a fallback jurisdiction (scoring a Zambia brand against
  // Nigerian law would fabricate a verdict). Markets with no corpus are collected
  // and reported as an actionable gap ("upload the documents"), never scored.
  const marketsWithoutCorpus: string[] = [];

  try {
    let anyCorpus = false;
    let anyDegraded = false;
    let rowsWritten = 0;
    let ingestionAttempted = false;

    for (const market of requestedMarkets) {
      if (Date.now() > deadline) break;

      // ── Active corpus for this market (shared master data) ──
      const docs = await activeDocumentsForMarket(sb, market);

      // ── 1. Change detection (advisory; never blocks scoring) ──
      const news = await fetchRegulatoryNews(market);

      // ── 4. Ingestion (best-effort, once per invocation, only if time allows) ──
      if (!ingestionAttempted && Date.now() < deadline - 20_000) {
        ingestionAttempted = true;
        await maybeIngestDocument(sb, { market, news, deadline });
        // Re-read docs so a freshly ingested doc is available to scoring this run.
        const refreshed = await activeDocumentsForMarket(sb, market);
        if (refreshed.size > docs.size) {
          for (const [k, v] of refreshed) docs.set(k, v);
        }
      }

      // No corpus for this market → record the gap and skip it entirely. We never
      // score against another jurisdiction; uploading docs in Knowledge Base fixes it.
      if (docs.size === 0) {
        marketsWithoutCorpus.push(market);
        anyDegraded = true;
        continue;
      }

      // ── 2 + 3. Per-competitor compliance scoring ──
      const targets = msg.competitors ?? [];
      for (const comp of targets) {
        if (Date.now() > deadline) {
          anyDegraded = true;
          break;
        }

        const { assessments, usedCorpus } = await assessCompetitor(sb, {
          scanJobId: msg.scan_job_id,
          brandId: msg.brand_id,
          competitorName: comp.name,
          competitorDomain: comp.domain,
          market,
          docs,
        });
        if (usedCorpus) anyCorpus = true;
        else anyDegraded = true;

        const score = computeScore(assessments);
        const violations = buildViolations(assessments);
        const cols = statusColumns(assessments);

        // ── 5. UPSERT regulatory_cache (scoped to this brand) ──
        const { error: upsertErr } = await sb.from("regulatory_cache").upsert(
          {
            brand_id: msg.brand_id,
            scan_week: msg.scan_week,
            competitor_id: comp.id,
            market,
            ...cols,
            compliance_score: score,
            violations: violations as unknown as never,
            raw_data: {
              assessed_with_corpus: usedCorpus,
              document_count: docs.size,
              news_headlines: news.slice(0, 10).map((n: NewsItem) => ({
                title: n.title,
                url: n.url,
                date: n.datePublished,
              })),
            } as unknown as never,
          },
          { onConflict: "brand_id,scan_week,competitor_id,market" },
        );
        if (upsertErr) throw new Error(`regulatory_cache upsert: ${upsertErr.message}`);
        rowsWritten += 1;
      }
    }

    // ── Feature health: degraded when corpus empty or time-truncated ──
    if (anyDegraded || !anyCorpus) {
      await recordFeatureHealth(sb, {
        scan_job_id: msg.scan_job_id,
        brand_id: msg.brand_id,
        scan_week: msg.scan_week,
        feature_category: "regulatory",
        feature_name: "Regulatory Compliance",
        status: "degraded",
        root_cause: !anyCorpus
          ? `No regulatory corpus for the brand's market(s): ${marketsWithoutCorpus.join(", ") || "unknown"}. Upload the regulator documents in the internal-admin Knowledge Base to enable compliance scoring.`
          : marketsWithoutCorpus.length > 0
          ? `Scored markets with a corpus; still missing a corpus for: ${marketsWithoutCorpus.join(", ")}.`
          : "Some competitors/markets scored within a reduced time budget",
        resolution_suggested: marketsWithoutCorpus.length > 0
          ? `Upload the regulator corpus for ${marketsWithoutCorpus.join(", ")} in the internal-admin Knowledge Base; each market is scored only against its own jurisdiction's documents.`
          : "Increase the module time budget or reduce competitor count if scoring was truncated.",
      });
    }

    // ── 6. Complete module; partial when we degraded anywhere, ok otherwise ──
    const outcome: "ok" | "partial" =
      anyCorpus && !anyDegraded && rowsWritten > 0 ? "ok" : "partial";
    const finished = await completeModule(sb, msg.scan_job_id, "regulatory", outcome);
    if (finished) {
      const synth = {
        scan_job_id: msg.scan_job_id,
        brand_id: msg.brand_id,
        scan_week: msg.scan_week,
      };
      await enqueueSynthesis(sb, synth);
      await invokeFunction(SYNTHESIS_FN, synth);
    }

    return json({ ok: true, outcome, rows: rowsWritten, degraded: anyDegraded });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Module failure: record health + DLQ (drained by between-cycle-monitor), then
    // still mark the module complete so the fan-out can finish (partial → previous
    // week's cache, per data-flow-rules.md §4).
    await recordFeatureHealth(sb, {
      scan_job_id: msg.scan_job_id,
      brand_id: msg.brand_id,
      scan_week: msg.scan_week,
      feature_category: "regulatory",
      feature_name: "Regulatory Compliance",
      status: "down",
      root_cause: message,
      resolution_suggested: "Retry on next between-cycle drain.",
    });
    await toDeadLetter(sb, {
      task_type: "regulatory",
      payload: msg,
      brand_id: msg.brand_id,
      scan_job_id: msg.scan_job_id,
      failure_reason: "researcher-regulatory error",
      last_error: message,
    });
    try {
      const finished = await completeModule(sb, msg.scan_job_id, "regulatory", "failed");
      if (finished) {
        const synth = {
          scan_job_id: msg.scan_job_id,
          brand_id: msg.brand_id,
          scan_week: msg.scan_week,
        };
        await enqueueSynthesis(sb, synth);
        await invokeFunction(SYNTHESIS_FN, synth);
      }
    } catch (_e) {
      // completeModule itself failed — the monitor will reconcile via DLQ.
    }
    return json({ ok: false, error: message }, 500);
  }
}));
