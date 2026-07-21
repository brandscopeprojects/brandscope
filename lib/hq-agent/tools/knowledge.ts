import "server-only";

import type { HqTool } from "../types";
import { embedModel } from "../config";
import { openai } from "../openai";
import { nowIso } from "./shared";

// search_regulatory_knowledge — the HQ Agent's read-only bridge to the regulatory
// Knowledge Base. It embeds the query with the SAME model the corpus was ingested
// with (text-embedding-3-small), then runs the narrow `match_regulatory_chunks`
// pgvector RPC (active + fully-embedded docs only, bounded, similarity-floored).
// It returns cited chunks (document · section · page · url · score) for the model
// to quote verbatim — and an explicit "could not confirm" signal when nothing
// clears the threshold. Read-only; no SQL is generated; embeddings never leave
// the server.

const MIN_SIMILARITY = 0.3; // matches the ingestion/scan retrieval gate
const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 12;
const NO_MATCH = "I could not confirm that from the available Brandscope regulatory documents.";

type MatchRow = {
  document_id: string;
  document_name: string;
  regulatory_body: string | null;
  country: string | null;
  section_title: string | null;
  page_number: number | null;
  source_url: string | null;
  similarity: number;
  content: string;
};

const searchRegulatoryKnowledge: HqTool = {
  name: "search_regulatory_knowledge",
  category: "knowledge",
  description:
    "Search the uploaded regulatory Knowledge Base (gambling laws, licensing, taxation, advertising rules, AML, player protection, company setup, foreign ownership) for a market. Returns verbatim law excerpts with document, section, page, source URL and a similarity score. USE THIS for any regulatory/legal/licence/tax/AML question about a country's gambling regime. Do NOT use it for Brandscope business data (revenue, brands, subscriptions, LLM cost, scans) — those have their own tools.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "The regulatory question or topic to search for." },
      country: { type: "string", description: "Optional country/market name to restrict the search (e.g. 'Ghana', 'Uganda')." },
      limit: { type: "number", description: `Max chunks to return (1-${MAX_LIMIT}, default ${DEFAULT_LIMIT}).` },
    },
    required: ["query"],
    additionalProperties: false,
  },
  validate: (raw) => {
    const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const query = typeof o.query === "string" ? o.query.trim() : "";
    if (!query) throw new Error("'query' is required");
    const country = typeof o.country === "string" && o.country.trim() ? o.country.trim() : null;
    let limit = DEFAULT_LIMIT;
    if (o.limit !== undefined) {
      const n = Number(o.limit);
      if (!Number.isFinite(n)) throw new Error("'limit' must be a number");
      limit = Math.min(MAX_LIMIT, Math.max(1, Math.round(n)));
    }
    return { query, country, limit };
  },
  run: async ({ admin }, args) => {
    const query = String(args.query);
    const country = (args.country as string | null) ?? null;
    const limit = (args.limit as number) ?? DEFAULT_LIMIT;

    // 1. Embed the query (same model as the stored chunks).
    const emb = await openai().embeddings.create({ model: embedModel(), input: query });
    const vector = emb.data[0]?.embedding;
    if (!vector || vector.length === 0) throw new Error("failed to embed the query");

    // 2. Narrow, server-side pgvector search (RPC — no raw SQL, no vectors to client).
    const { data, error } = await admin.rpc("match_regulatory_chunks", {
      query_embedding: `[${vector.join(",")}]` as unknown as string,
      match_count: limit,
      min_similarity: MIN_SIMILARITY,
      filter_country: country ?? undefined,
    });
    if (error) throw new Error(`match_regulatory_chunks: ${error.message}`);

    const rows = (data ?? []) as MatchRow[];
    if (rows.length === 0) {
      return {
        data: {
          available: true,
          results: [],
          message: NO_MATCH,
          query,
          country: country ?? "all markets",
        },
        dataUpdatedAt: nowIso(),
        sources: [],
      };
    }

    const results = rows.map((r) => ({
      documentId: r.document_id,
      documentName: r.document_name,
      regulatoryBody: r.regulatory_body,
      country: r.country,
      sectionTitle: r.section_title,
      pageNumber: r.page_number,
      sourceUrl: r.source_url,
      similarity: Number(r.similarity.toFixed(3)),
      excerpt: r.content,
    }));

    return {
      data: {
        available: true,
        count: results.length,
        instruction:
          "Answer ONLY from these excerpts. Cite the document name, section and page for each fact. Never invent a document, section, page or figure. If the excerpts do not support the question, say: '" + NO_MATCH + "'",
        results,
      },
      dataUpdatedAt: nowIso(),
      sources: results.map((r) => ({
        service: [r.documentName, r.sectionTitle, r.pageNumber ? `p.${r.pageNumber}` : null].filter(Boolean).join(" · "),
        dateRange: r.country ?? undefined,
        updatedAt: null,
        filters: `similarity ${r.similarity}`,
      })),
    };
  },
};

export const knowledgeTools: HqTool[] = [searchRegulatoryKnowledge];
