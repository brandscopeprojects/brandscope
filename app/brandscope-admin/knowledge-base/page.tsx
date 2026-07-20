// Screen 27 — Internal-admin Knowledge Base, /brandscope-admin/knowledge-base.
// The internal-admin layout renders the dark shell, enforces
// requireInternalAdmin, and provides the max-w-[1500px] padded container — so
// this is content-only (no shell, no auth, no width wrapper).
//
// Sources (all GLOBAL): regulatory_documents + document_chunks (Class-3 shared
// ref) and ingestion_logs (Class-2 service-role). Per rls-policies.md, because
// this surface is already role-gated and the data is global, all three are read
// via the service-role admin client in getKnowledgeBaseData. Real values only —
// honest empty state before the ingestion pipeline has run.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { KnowledgeStats } from "@/components/admin/KnowledgeStats";
import { KnowledgeDocumentTable } from "@/components/admin/KnowledgeDocumentTable";
import { KnowledgeIngestionPipeline } from "@/components/admin/KnowledgeIngestionPipeline";
import { RegulatoryUploadForm } from "@/components/admin/RegulatoryUploadForm";
import { getKnowledgeBaseData } from "@/lib/data/internal-knowledge";

export const dynamic = "force-dynamic";

export default async function KnowledgeBasePage() {
  const { documents, ingestion, totals } = await getKnowledgeBaseData();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Knowledge Base"
        subtitle="Regulatory documents, their embeddings and the ingestion pipeline."
      />

      <RegulatoryUploadForm />

      {documents.length === 0 ? (
        <EmptyState
          intent="scanning"
          title="No documents ingested yet"
          message="Upload a country's regulator filing above to seed the compliance corpus."
        />
      ) : (
        <>
          <KnowledgeStats
            totalDocuments={totals.totalDocuments}
            totalChunks={totals.totalChunks}
            activeMarkets={totals.activeMarkets}
          />

          <section className="space-y-3">
            <h2 className="font-display text-base font-bold text-ink">
              Regulatory documents
            </h2>
            <KnowledgeDocumentTable documents={documents} />
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-base font-bold text-ink">
              Ingestion pipeline
            </h2>
            <KnowledgeIngestionPipeline runs={ingestion} />
          </section>
        </>
      )}
    </div>
  );
}
