import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StatusTone } from "@/components/intelligence/StatusPill";

// Internal-admin Knowledge Base data layer (Screen 27, /brandscope-admin/
// knowledge-base). All three sources are global reference / pipeline tables:
//   - regulatory_documents (Class-3 shared ref) — the regulator filings.
//   - document_chunks       (Class-3 shared ref) — embedded chunks per document.
//   - ingestion_logs        (Class-2 service-role) — pipeline run steps.
// Per rls-policies.md, because this surface is already role-gated by the
// internal-admin layout (requireInternalAdmin) and the data is global, we read
// ALL THREE via the service-role admin client for consistency.
//
// IMPORTANT: document_chunks may be very large and its `embedding` column is a
// vector. We NEVER select embeddings/vectors here — chunk counts are derived
// from a HEAD count query per document (no rows loaded).

/** Normalise an embedding-status string from regulatory_documents to a tone +
 *  label. Unknown / missing values render neutral (never faked as embedded). */
function embeddingStatusTone(raw: string | null | undefined): {
  label: string;
  tone: StatusTone;
} {
  switch ((raw ?? "").toLowerCase().trim()) {
    case "embedded":
    case "complete":
    case "completed":
    case "done":
    case "ready":
      return { label: "Embedded", tone: "good" };
    case "pending":
    case "queued":
    case "processing":
    case "in_progress":
      return { label: "Pending", tone: "warn" };
    case "failed":
    case "error":
      return { label: "Failed", tone: "bad" };
    case "":
      return { label: "Not started", tone: "neutral" };
    default:
      return { label: raw as string, tone: "neutral" };
  }
}

/** Normalise an ingestion_logs.status string to a StatusPill tone + label. */
function ingestionStatusTone(raw: string | null | undefined): {
  label: string;
  tone: StatusTone;
} {
  switch ((raw ?? "").toLowerCase().trim()) {
    case "success":
    case "completed":
    case "complete":
    case "done":
    case "ok":
      return { label: "Success", tone: "good" };
    case "running":
    case "started":
    case "pending":
    case "in_progress":
      return { label: "Running", tone: "warn" };
    case "failed":
    case "error":
      return { label: "Failed", tone: "bad" };
    case "skipped":
      return { label: "Skipped", tone: "neutral" };
    default:
      return { label: raw ?? "Unknown", tone: "neutral" };
  }
}

/** One regulator source document, with its live chunk count + embedding status. */
export type KnowledgeDocument = {
  id: string;
  title: string;
  documentType: string;
  country: string;
  regulatoryBody: string;
  version: string | null;
  sourceUrl: string;
  isActive: boolean;
  /** Live count of embedded chunks belonging to this document. */
  chunkCount: number;
  embeddingStatus: { label: string; tone: StatusTone };
  lastVerifiedAt: string | null;
  effectiveDate: string | null;
};

/** One recent ingestion-pipeline step. */
export type KnowledgeIngestionRun = {
  id: string;
  /** Resolved document title, or "—" when the step is not document-scoped. */
  documentTitle: string;
  step: string;
  status: { label: string; tone: StatusTone };
  /** Chunks created in this step, when reported in `detail`. */
  chunksCreated: number | null;
  errorMessage: string | null;
  at: string | null;
};

export type KnowledgeBaseData = {
  documents: KnowledgeDocument[];
  ingestion: KnowledgeIngestionRun[];
  totals: {
    totalDocuments: number;
    totalChunks: number;
    activeMarkets: number;
  };
};

/** Pull a numeric "chunks created" hint from an ingestion_logs.detail JSONB
 *  blob without assuming a fixed shape. Returns null when not present. */
function chunksFromDetail(detail: unknown): number | null {
  if (typeof detail !== "object" || detail === null) return null;
  const o = detail as Record<string, unknown>;
  for (const key of ["chunks_created", "chunks", "chunk_count", "chunksCreated"]) {
    const v = o[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

/**
 * Fetch the knowledge base: regulator documents (latest first) with per-document
 * live chunk counts + embedding status, and recent ingestion-pipeline runs.
 * Returns empty arrays (never throws on absence) so the page can render its
 * honest empty state when nothing has been ingested yet.
 */
export async function getKnowledgeBaseData(): Promise<KnowledgeBaseData> {
  const admin = createAdminClient();

  // Documents — latest first. Never select chunk embeddings here.
  const { data: docRows } = await admin
    .from("regulatory_documents")
    .select(
      "id, document_name, document_type, country, regulatory_body, version, source_url, is_active, embedding_status, last_verified_at, effective_date, created_at",
    )
    .order("created_at", { ascending: false });

  const docs = docRows ?? [];

  // Per-document chunk counts via HEAD count queries (no rows / no vectors
  // loaded). Run in parallel; fall back to 0 on any error.
  const chunkCounts = await Promise.all(
    docs.map(async (d) => {
      const { count } = await admin
        .from("document_chunks")
        .select("id", { count: "exact", head: true })
        .eq("document_id", d.id);
      return count ?? 0;
    }),
  );

  const documents: KnowledgeDocument[] = docs.map((d, i) => ({
    id: d.id,
    title: d.document_name,
    documentType: d.document_type,
    country: d.country,
    regulatoryBody: d.regulatory_body,
    version: d.version,
    sourceUrl: d.source_url,
    isActive: d.is_active ?? false,
    chunkCount: chunkCounts[i],
    embeddingStatus: embeddingStatusTone(d.embedding_status),
    lastVerifiedAt: d.last_verified_at,
    effectiveDate: d.effective_date,
  }));

  // Recent ingestion-pipeline runs (latest first), with document titles resolved.
  const titleById = new Map(documents.map((d) => [d.id, d.title]));
  const { data: logRows } = await admin
    .from("ingestion_logs")
    .select("id, document_id, step, status, error_message, detail, step_timestamp, created_at")
    .order("step_timestamp", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(50);

  const ingestion: KnowledgeIngestionRun[] = (logRows ?? []).map((l) => ({
    id: l.id,
    documentTitle: l.document_id ? (titleById.get(l.document_id) ?? "Unknown document") : "—",
    step: l.step,
    status: ingestionStatusTone(l.status),
    chunksCreated: chunksFromDetail(l.detail),
    errorMessage: l.error_message,
    at: l.step_timestamp ?? l.created_at,
  }));

  const totalChunks = chunkCounts.reduce((sum, c) => sum + c, 0);
  const activeMarkets = new Set(
    documents.filter((d) => d.isActive).map((d) => d.country.toLowerCase().trim()),
  ).size;

  return {
    documents,
    ingestion,
    totals: {
      totalDocuments: documents.length,
      totalChunks,
      activeMarkets,
    },
  };
}
