// Public design preview of the internal-admin Knowledge Base (Screen 27,
// /brandscope-admin/knowledge-base), populated with the DEMO_INTERNAL_KNOWLEDGE
// sample corpus. No auth / no Supabase — renders the SAME Screen-27 components
// inside the real InternalShell so the data-dense internal surface is fully
// visible. Explicitly demo/sample data.

import { InternalShell } from "@/components/admin/InternalShell";
import { PageHeader } from "@/components/intelligence/PageHeader";
import { KnowledgeStats } from "@/components/admin/KnowledgeStats";
import { KnowledgeDocumentTable } from "@/components/admin/KnowledgeDocumentTable";
import { KnowledgeIngestionPipeline } from "@/components/admin/KnowledgeIngestionPipeline";
import { DEMO_INTERNAL_KNOWLEDGE } from "@/lib/data/demo/internal-knowledge";

export const dynamic = "force-dynamic";

export default function PreviewInternalKnowledge() {
  const { documents, ingestion, totals } = DEMO_INTERNAL_KNOWLEDGE;

  return (
    <InternalShell operatorEmail="ops@brandscope.io" isSuperAdmin={true}>
      <div className="space-y-8">
        <PageHeader
          title="Knowledge Base"
          subtitle="Regulatory documents, their embeddings and the ingestion pipeline."
        />

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
      </div>
    </InternalShell>
  );
}
