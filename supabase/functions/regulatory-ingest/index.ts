// regulatory-ingest — admin document ingestion for the regulatory RAG corpus.
//
// UPLOAD-ONLY (owner decision 2026-07-20): the service never fetches documents
// from external sites — an internal admin supplies the file. Input is
// multipart/form-data with a `file` (PDF) + metadata fields: country,
// regulatory_body, document_name, document_type?, version?, effective_date?,
// source_url? (provenance link only — NOT fetched), supersedes? (a
// regulatory_documents.id to deactivate as an older version).
//
// Flow: store PDF to R2 → insert regulatory_documents(embedding_status='processing')
// → return {document_id} immediately → in the background (EdgeRuntime.waitUntil):
// parse PDF (unpdf) → section-aware chunk (page + char offsets) → embed
// (text-embedding-3-small, 1536) → insert document_chunks → mark 'complete'.
// Every step writes ingestion_logs. Nothing is ever fabricated.
//
// Auth: CRON_SECRET (ops) OR a privileged Supabase key (admin server action).
// verify_jwt=false (custom auth here).

import { extractText } from "https://esm.sh/unpdf@0.12.1";
import { serviceClient, type SupabaseClient } from "../_shared/supabase.ts";
import { json, preflight, isAuthorizedInternal, isServiceBearer } from "../_shared/http.ts";
import { SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { embed } from "../_shared/llm.ts";
import { r2Put } from "../_shared/r2.ts";

const CHUNK_CHARS = 1200;
const CHUNK_OVERLAP = 150;
const MAX_CHUNKS = 400; // bound cost/time per document
const EMBED_BATCH = 64;
const INSERT_BATCH = 200;

type Meta = {
  country: string;
  regulatory_body: string;
  document_name: string;
  document_type?: string;
  version?: string;
  effective_date?: string;
  source_url?: string;
  supersedes?: string;
};

async function logStep(
  sb: SupabaseClient,
  documentId: string | null,
  step: string,
  status: string,
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
    // logging must never break ingestion
  }
}

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function slugify(s: string): string {
  return (s || "unknown").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/** Heuristic section heading from the first lines of a text window. */
function detectHeading(text: string): string | null {
  for (const raw of text.split("\n").slice(0, 6)) {
    const t = raw.trim();
    if (!t) continue;
    if (/^(section|article|part|chapter|clause|regulation|schedule)\s+[\dIVXLC]+/i.test(t)) return t.slice(0, 120);
    if (t.length >= 6 && t.length <= 80 && t === t.toUpperCase() && /[A-Z]/.test(t)) return t.slice(0, 120);
  }
  return null;
}

type Chunk = { content: string; page_number: number; section_title: string | null; char_start: number; char_end: number };

/** Section-aware, page-tracked chunking with char offsets for citation. */
function chunkPages(pages: string[]): Chunk[] {
  const out: Chunk[] = [];
  let globalOffset = 0;
  let currentSection: string | null = null;
  for (let p = 0; p < pages.length && out.length < MAX_CHUNKS; p++) {
    const pageText = (pages[p] ?? "").replace(/[ \t]+\n/g, "\n");
    let i = 0;
    while (i < pageText.length && out.length < MAX_CHUNKS) {
      const slice = pageText.slice(i, i + CHUNK_CHARS);
      if (slice.trim().length >= 40) {
        const heading = detectHeading(slice);
        if (heading) currentSection = heading;
        out.push({
          content: slice,
          page_number: p + 1,
          section_title: currentSection,
          char_start: globalOffset + i,
          char_end: globalOffset + Math.min(i + CHUNK_CHARS, pageText.length),
        });
      }
      i += CHUNK_CHARS - CHUNK_OVERLAP;
    }
    globalOffset += pageText.length;
  }
  return out;
}

async function embedAll(contents: string[]): Promise<(number[] | null)[]> {
  const vectors: (number[] | null)[] = [];
  for (let i = 0; i < contents.length; i += EMBED_BATCH) {
    const batch = contents.slice(i, i + EMBED_BATCH);
    try {
      const vs = await embed(batch);
      for (let j = 0; j < batch.length; j++) vectors.push(vs[j] ?? null);
    } catch {
      for (const _ of batch) vectors.push(null);
    }
  }
  return vectors;
}

/** Background: parse → chunk → embed → persist. Updates status + logs throughout. */
async function processDocument(sb: SupabaseClient, documentId: string, bytes: Uint8Array): Promise<void> {
  try {
    await logStep(sb, documentId, "parse", "started", { bytes: bytes.byteLength });
    const { totalPages, text } = await extractText(bytes, { mergePages: false });
    const pages: string[] = Array.isArray(text) ? text : [String(text ?? "")];
    const nonEmpty = pages.filter((p) => (p ?? "").trim().length > 0).length;
    await logStep(sb, documentId, "parse", "complete", { total_pages: totalPages, pages_with_text: nonEmpty });

    if (nonEmpty === 0) {
      await sb.from("regulatory_documents").update({ embedding_status: "failed", page_count: totalPages, needs_review: true, review_notes: "PDF parsed but no extractable text (likely scanned/image PDF — needs OCR)." }).eq("id", documentId);
      await logStep(sb, documentId, "chunk", "skipped", { reason: "no extractable text (scanned PDF?)" });
      return;
    }

    const chunks = chunkPages(pages);
    await logStep(sb, documentId, "chunk", "complete", { chunks: chunks.length, capped: chunks.length >= MAX_CHUNKS });
    if (chunks.length === 0) {
      await sb.from("regulatory_documents").update({ embedding_status: "failed", page_count: totalPages }).eq("id", documentId);
      return;
    }

    await logStep(sb, documentId, "embed", "started", { chunks: chunks.length });
    const vectors = await embedAll(chunks.map((c) => c.content));
    const rows = chunks
      .map((c, idx) => ({ c, v: vectors[idx] }))
      .filter((x) => x.v && x.v.length > 0)
      .map((x) => ({
        document_id: documentId,
        chunk_index: chunks.indexOf(x.c),
        content: x.c.content,
        section_title: x.c.section_title,
        page_number: x.c.page_number,
        char_start: x.c.char_start,
        char_end: x.c.char_end,
        embedding: `[${(x.v as number[]).join(",")}]`,
      }));

    if (rows.length === 0) {
      await sb.from("regulatory_documents").update({ embedding_status: "failed", page_count: totalPages, needs_review: true, review_notes: "Embedding returned no vectors (check OPENAI_API_KEY / quota)." }).eq("id", documentId);
      await logStep(sb, documentId, "embed", "failed", { reason: "no vectors returned" });
      return;
    }

    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const { error } = await sb.from("document_chunks").insert(rows.slice(i, i + INSERT_BATCH) as never);
      if (error) throw new Error(`document_chunks insert: ${error.message}`);
    }

    await sb.from("regulatory_documents").update({
      embedding_status: "complete",
      chunk_count: rows.length,
      page_count: totalPages,
      last_verified_at: new Date().toISOString(),
    }).eq("id", documentId);
    await logStep(sb, documentId, "embed", "complete", { embedded_chunks: rows.length, total_pages: totalPages });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from("regulatory_documents").update({ embedding_status: "failed", needs_review: true, review_notes: `Ingestion error: ${msg}`.slice(0, 500) }).eq("id", documentId);
    await logStep(sb, documentId, "ingest", "failed", null, msg);
  }
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const authed = isAuthorizedInternal(req) || (bearer.length > 0 && (bearer === SERVICE_ROLE_KEY() || (await isServiceBearer(bearer))));
  if (!authed) return json({ error: "unauthorized" }, 401);

  const sb = serviceClient();

  // 1. Gather bytes + metadata from the multipart upload (upload-only — the
  //    service never fetches documents from external URLs).
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return json({ error: "expected multipart/form-data with a PDF 'file'" }, 400);
  }
  let bytes: Uint8Array;
  let meta: Meta;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "multipart: 'file' is required" }, 400);
    bytes = new Uint8Array(await file.arrayBuffer());
    meta = {
      country: String(form.get("country") ?? ""),
      regulatory_body: String(form.get("regulatory_body") ?? ""),
      document_name: String(form.get("document_name") ?? file.name ?? "document.pdf"),
      document_type: form.get("document_type") ? String(form.get("document_type")) : undefined,
      version: form.get("version") ? String(form.get("version")) : undefined,
      effective_date: form.get("effective_date") ? String(form.get("effective_date")) : undefined,
      source_url: form.get("source_url") ? String(form.get("source_url")) : undefined,
      supersedes: form.get("supersedes") ? String(form.get("supersedes")) : undefined,
    };
  } catch (e) {
    return json({ error: `bad request: ${e instanceof Error ? e.message : String(e)}` }, 400);
  }

  if (bytes.byteLength === 0) return json({ error: "empty file" }, 400);
  if (!meta.country || !meta.regulatory_body) return json({ error: "country and regulatory_body are required" }, 400);

  // 2. Store to R2.
  const hash = await sha256Bytes(bytes);
  const r2Path = `regulatory/${slugify(meta.country)}/${hash}.pdf`;
  try {
    await r2Put(r2Path, bytes, "application/pdf");
  } catch (e) {
    return json({ error: `R2 upload failed: ${e instanceof Error ? e.message : String(e)}` }, 502);
  }

  // 3. Insert the document row (processing) — dedupe on file_hash.
  const { data: doc, error: docErr } = await sb
    .from("regulatory_documents")
    .insert({
      country: meta.country,
      regulatory_body: meta.regulatory_body,
      document_name: meta.document_name || "document.pdf",
      document_type: meta.document_type ?? "regulation",
      version: meta.version ?? null,
      effective_date: meta.effective_date ?? null,
      source_url: meta.source_url ?? null,
      r2_path: r2Path,
      file_hash: hash,
      file_size_bytes: bytes.byteLength,
      embedding_status: "processing",
      is_active: true,
      needs_review: false,
    })
    .select("id")
    .single();
  if (docErr || !doc) return json({ error: `insert regulatory_documents: ${docErr?.message ?? "failed"}` }, 500);

  await logStep(sb, doc.id, "upload", "complete", { r2_path: r2Path, bytes: bytes.byteLength, mode: contentType.includes("multipart") ? "upload" : "fetch" });

  // 3b. If this supersedes an older version, deactivate the old one.
  if (meta.supersedes) {
    try {
      await sb.from("regulatory_documents").update({ is_active: false, superseded_by: doc.id }).eq("id", meta.supersedes);
    } catch { /* non-fatal */ }
  }

  // 4. Heavy work in the background so the caller returns immediately.
  const captured = bytes;
  const bg = processDocument(sb, doc.id, captured);
  try {
    (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil?.(bg);
  } catch {
    // not on the edge runtime (local) — let it run inline
  }

  return json({ ok: true, document_id: doc.id, r2_path: r2Path, embedding_status: "processing" });
});
