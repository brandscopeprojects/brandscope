// Best-effort regulator-document ingestion for researcher-regulatory.
//
// Pipeline (mvp-module-sources.md §7): discover a new regulator-doc URL via News
// → fetch → chunk → OpenAI text-embedding-3-small (1536) → insert document_chunks
// + a regulatory_documents row + ingestion_logs rows.
//
// ⚠️ R2: there is no R2 client in _shared yet. regulatory_documents.r2_path is
// NOT NULL, so we CANNOT leave it null and we MUST NOT fabricate a real R2 key.
// We store the canonical source_url and a sentinel r2_path ("pending-r2://<hash>")
// that is obviously-not-a-real-path, set embedding_status accordingly, and log a
// TODO in ingestion_logs. The R2 upload + real path is a follow-up (Sprint 4,
// Step 36 corpus loader) — out of this function's file scope.
//
// This is bounded and entirely optional: any failure is swallowed + logged; it
// never affects compliance scoring or module completion.

import { embed } from "../_shared/llm.ts";
import { sha256 } from "../_shared/evidence.ts";
import type { SupabaseClient } from "../_shared/supabase.ts";
import { looksLikeRegulatorDoc, type NewsItem } from "./change-detection.ts";

const R2_SENTINEL_PREFIX = "pending-r2://"; // TODO(Sprint4/Step36): real R2 upload + path
const MAX_FETCH_BYTES = 5_000_000; // cap download (5MB) to protect the budget
const CHUNK_CHARS = 1200; // ~ chunk size for embedding
const CHUNK_OVERLAP = 150;
const MAX_CHUNKS = 60; // bound embeddings per ingestion run

const REGULATORY_BODY_BY_MARKET: Record<string, { body: string; country: string }> = {
  nigeria: { body: "National Lottery Regulatory Commission", country: "Nigeria" },
  kenya: { body: "Betting Control and Licensing Board", country: "Kenya" },
  south_africa: { body: "Western Cape Gambling and Racing Board", country: "South Africa" },
};

async function logStep(
  sb: SupabaseClient,
  step: string,
  status: string,
  documentId: string | null,
  detail: Record<string, unknown> | null,
  errorMessage?: string,
): Promise<void> {
  try {
    await sb.from("ingestion_logs").insert({
      document_id: documentId,
      step,
      status,
      detail: (detail ?? null) as never,
      error_message: errorMessage ?? null,
      step_timestamp: new Date().toISOString(),
    });
  } catch {
    // swallow — ingestion logging must not break the run
  }
}

/** Naive char-based chunker (PDF text extraction is not wired; we ingest the
 *  fetched text body as-is when it is text/* — binary PDFs are skipped + logged). */
function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length && chunks.length < MAX_CHUNKS) {
    chunks.push(text.slice(i, i + CHUNK_CHARS));
    i += CHUNK_CHARS - CHUNK_OVERLAP;
  }
  return chunks;
}

/**
 * Try to ingest ONE newly-discovered regulator doc for a market. No-op (returns
 * false) when nothing new is found, the URL is already ingested, the content
 * isn't text, or time runs short. Never throws.
 */
export async function maybeIngestDocument(
  sb: SupabaseClient,
  params: { market: string; news: NewsItem[]; deadline: number },
): Promise<boolean> {
  const { market, news, deadline } = params;
  const meta = REGULATORY_BODY_BY_MARKET[market.toLowerCase()];
  if (!meta) return false;

  // 1. Pick a candidate regulator-doc URL not already in regulatory_documents.
  const candidates = news.map((n) => n.url).filter(looksLikeRegulatorDoc);
  if (candidates.length === 0) return false;

  let target: string | null = null;
  for (const url of candidates) {
    const { data: existing } = await sb
      .from("regulatory_documents")
      .select("id")
      .eq("source_url", url)
      .maybeSingle();
    if (!existing) {
      target = url;
      break;
    }
  }
  if (!target) return false;
  if (Date.now() > deadline - 15_000) return false; // not enough budget to ingest

  await logStep(sb, "discover", "started", null, { market, url: target });

  try {
    // 2. Fetch the document.
    const res = await fetch(target, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      await logStep(sb, "fetch", "failed", null, { url: target }, `HTTP ${res.status}`);
      return false;
    }
    const contentType = res.headers.get("content-type") ?? "";
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_FETCH_BYTES) {
      await logStep(sb, "fetch", "skipped", null, { url: target, bytes: buf.byteLength }, "too large");
      return false;
    }

    // PDF text extraction is NOT wired in _shared. We only ingest text/* bodies
    // here; a binary PDF is recorded (so it's discoverable) but left for the
    // Step-36 corpus loader to extract+embed. We never fabricate chunks.
    const isText = contentType.includes("text") || contentType.includes("json");
    const fileHash = await sha256(`${target}:${buf.byteLength}`);
    const r2Path = `${R2_SENTINEL_PREFIX}${fileHash}`; // sentinel, NOT a real R2 key

    // 3. Insert the regulatory_documents row (source_url canonical; r2_path sentinel).
    const { data: doc, error: docErr } = await sb
      .from("regulatory_documents")
      .insert({
        country: meta.country,
        regulatory_body: meta.body,
        document_name: target.split("/").pop() || "regulator-document",
        document_type: "regulation",
        source_url: target,
        r2_path: r2Path,
        file_hash: fileHash,
        file_size_bytes: buf.byteLength,
        embedding_status: isText ? "processing" : "pending",
        is_active: true,
        needs_review: true,
        review_notes:
          "Auto-discovered via News change-detection. r2_path is a SENTINEL (R2 upload not wired) — re-run Step-36 corpus loader for the real R2 object + PDF text extraction.",
      })
      .select("id")
      .single();
    if (docErr || !doc) {
      await logStep(sb, "persist_document", "failed", null, { url: target }, docErr?.message);
      return false;
    }

    await logStep(sb, "persist_document", "complete", doc.id, {
      r2_path: r2Path,
      r2_todo: "R2 upload not wired in _shared; sentinel path stored.",
      content_type: contentType,
    });

    if (!isText) {
      // Binary (likely PDF): recorded for the corpus loader, not embedded here.
      await logStep(sb, "embed", "skipped", doc.id, { reason: "binary content; PDF extraction not wired" });
      return true;
    }

    // 4. Chunk + embed (bounded).
    const text = new TextDecoder().decode(buf);
    const chunks = chunkText(text).filter((c) => c.trim().length > 50);
    if (chunks.length === 0) {
      await logStep(sb, "chunk", "skipped", doc.id, { reason: "no usable text" });
      return true;
    }

    const vectors = await embed(chunks); // text-embedding-3-small, 1536-dim
    const rows = chunks.map((content, idx) => ({
      document_id: doc.id,
      chunk_index: idx,
      content,
      // pgvector accepts the array serialised as a JSON-style string.
      embedding: vectors[idx] ? `[${vectors[idx].join(",")}]` : null,
      char_start: idx * (CHUNK_CHARS - CHUNK_OVERLAP),
      char_end: idx * (CHUNK_CHARS - CHUNK_OVERLAP) + content.length,
    }));

    const { error: chunkErr } = await sb.from("document_chunks").insert(rows as never);
    if (chunkErr) {
      await logStep(sb, "embed", "failed", doc.id, { chunks: rows.length }, chunkErr.message);
      return false;
    }

    await sb
      .from("regulatory_documents")
      .update({ embedding_status: "complete", chunk_count: rows.length })
      .eq("id", doc.id);

    await logStep(sb, "embed", "complete", doc.id, { chunks: rows.length });
    return true;
  } catch (e) {
    await logStep(
      sb,
      "ingest",
      "failed",
      null,
      { url: target },
      e instanceof Error ? e.message : String(e),
    );
    return false;
  }
}
