// RAG retrieval over document_chunks for researcher-regulatory.
//
// There is no SECURITY-DEFINER `match_document_chunks` RPC at MVP (migration 13
// only ships the pgmq/scan helpers), and adding one is OUT of this function's
// file scope (only supabase/functions/researcher-regulatory/** is editable). So
// we retrieve candidate chunks for the market's ACTIVE regulator documents via
// the supabase-js client, then compute cosine similarity in TS against the query
// embedding and apply the ≥0.80 gate (mvp-module-sources.md §7). This is bounded
// by capping the candidate set so we stay within the 90s module budget.
//
// pgvector serialises `embedding` as a string like "[0.1,0.2,...]"; we parse it
// to a Float array. Rows with no/short embeddings are skipped (never faked).

import { embed } from "../_shared/llm.ts";
import type { SupabaseClient } from "../_shared/supabase.ts";
import type { ScoredChunk } from "./types.ts";

const SIMILARITY_GATE = 0.8; // mvp-module-sources.md §7 — verbatim RAG gate
const MAX_CANDIDATE_CHUNKS = 400; // bound the candidate pull (per market)
const TOP_K = 6; // chunks fed to Sonnet per query

/** Market → regulatory_documents.country aliases (mirrors lib/data/regulatory.ts). */
const MARKET_COUNTRY_ALIASES: Record<string, string[]> = {
  nigeria: ["nigeria", "ng", "nga"],
  kenya: ["kenya", "ke", "ken"],
  south_africa: ["south africa", "south_africa", "za", "zaf", "rsa"],
};

function countryAliases(market: string): string[] {
  return MARKET_COUNTRY_ALIASES[market.toLowerCase()] ?? [market.toLowerCase()];
}

/** Active regulator documents for a market (id → name/url), shared master data. */
export async function activeDocumentsForMarket(
  sb: SupabaseClient,
  market: string,
): Promise<Map<string, { name: string; sourceUrl: string }>> {
  const { data } = await sb
    .from("regulatory_documents")
    .select("id, document_name, source_url, country, is_active, embedding_status")
    .eq("is_active", true);

  const aliases = new Set(countryAliases(market));
  const out = new Map<string, { name: string; sourceUrl: string }>();
  for (const d of data ?? []) {
    const c = (d.country ?? "").toLowerCase().trim();
    if (!aliases.has(c)) continue;
    out.set(d.id, { name: d.document_name, sourceUrl: d.source_url });
  }
  return out;
}

/** Parse a pgvector string ("[a,b,c]") into a number[]. Returns null if unusable. */
function parseEmbedding(raw: string | null): number[] | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const nums = arr.map((x) => (typeof x === "number" ? x : Number(x)));
    return nums.every((n) => Number.isFinite(n)) ? nums : null;
  } catch {
    return null;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Retrieve the top-K most similar chunks (≥0.80 cosine) for a query string,
 * restricted to the given market's active documents. Returns [] when the corpus
 * is empty or nothing clears the gate (caller degrades honestly — never fakes).
 */
export async function retrieveChunks(
  sb: SupabaseClient,
  query: string,
  docs: Map<string, { name: string; sourceUrl: string }>,
): Promise<ScoredChunk[]> {
  if (docs.size === 0) return [];

  const [queryEmbedding] = await embed(query);
  if (!queryEmbedding) return [];

  const { data: chunks } = await sb
    .from("document_chunks")
    .select("document_id, content, section_title, page_number, embedding")
    .in("document_id", [...docs.keys()])
    .limit(MAX_CANDIDATE_CHUNKS);

  const scored: ScoredChunk[] = [];
  for (const ch of chunks ?? []) {
    const emb = parseEmbedding(ch.embedding as string | null);
    if (!emb) continue;
    const similarity = cosineSimilarity(queryEmbedding, emb);
    if (similarity < SIMILARITY_GATE) continue;
    const doc = docs.get(ch.document_id);
    if (!doc) continue;
    scored.push({
      documentId: ch.document_id,
      documentName: doc.name,
      sourceUrl: doc.sourceUrl,
      sectionTitle: ch.section_title,
      pageNumber: ch.page_number,
      content: ch.content,
      similarity,
    });
  }

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, TOP_K);
}
