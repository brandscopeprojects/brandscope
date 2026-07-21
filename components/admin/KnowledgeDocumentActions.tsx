"use client";

// Per-row actions for a regulatory document: for a FAILED / needs-review doc,
// show the stored failure reason (safe message only — no secrets/stack traces)
// and a Reprocess button that re-runs parse/chunk/embed against the stored R2 PDF
// (no re-upload, no new record). Presentational for healthy docs.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, AlertTriangle, ChevronDown, Loader2 } from "lucide-react";
import { reprocessRegulatoryDocument } from "@/app/brandscope-admin/knowledge-base/actions";

function formatAttempt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function KnowledgeDocumentActions({
  documentId,
  statusRaw,
  reviewNotes,
  needsReview,
  updatedAt,
}: {
  documentId: string;
  statusRaw?: string;
  reviewNotes?: string | null;
  needsReview?: boolean;
  updatedAt?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const failed = statusRaw === "failed" || needsReview === true;
  if (!failed) return <span className="text-ink-faint">—</span>;

  function reprocess() {
    setError(null);
    startTransition(async () => {
      const res = await reprocessRegulatoryDocument(documentId);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="min-w-[12rem] space-y-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 rounded-chip bg-urgent/10 px-2 py-1 text-[11px] font-medium text-urgent hover:bg-urgent/20"
        >
          <AlertTriangle className="h-3 w-3" aria-hidden />
          Why?
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
        <button
          type="button"
          onClick={reprocess}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-chip bg-cobalt px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <RefreshCw className="h-3 w-3" aria-hidden />}
          {pending ? "Reprocessing…" : "Reprocess"}
        </button>
      </div>
      {open && (
        <div className="rounded-card border border-divider bg-base-secondary/60 p-2 text-[11px] leading-4 text-ink-secondary">
          <p className="text-ink">{reviewNotes || "Processing failed. Reprocess to retry."}</p>
          <p className="mt-1 text-ink-faint">Last attempt: {formatAttempt(updatedAt)}</p>
        </div>
      )}
      {error && <p className="text-[11px] text-urgent">{error}</p>}
    </div>
  );
}
