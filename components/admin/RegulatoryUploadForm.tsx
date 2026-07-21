"use client";

// RegulatoryUploadForm — internal-admin upload of a country regulatory PDF into
// the RAG corpus. Posts (file + metadata) to the uploadRegulatoryDocument server
// action, which forwards to the `regulatory-ingest` edge function (R2 → parse →
// chunk → embed). Design tokens only; matches the admin form pattern.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/lib/onboarding/countries";
import { uploadRegulatoryDocument, type UploadResult } from "@/app/brandscope-admin/knowledge-base/actions";

const inputClass =
  "w-full rounded-chip border border-divider bg-card px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-cobalt";

const DOC_TYPES: { value: string; label: string }[] = [
  { value: "regulation", label: "Regulation" },
  { value: "act", label: "Act / Statute" },
  { value: "guideline", label: "Guideline" },
  { value: "licence_condition", label: "Licence condition" },
  { value: "circular", label: "Circular / Notice" },
  { value: "other", label: "Other" },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-ink-faint">{hint}</span> : null}
    </label>
  );
}

export function RegulatoryUploadForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<UploadResult | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setResult(null);
    startTransition(async () => {
      const r = await uploadRegulatoryDocument(fd);
      setResult(r);
      if (r.ok) {
        formRef.current?.reset();
        router.refresh(); // pick up the new 'processing' row + ingestion log
      }
    });
  }

  return (
    <section className="rounded-card bg-card p-6 shadow-sh1">
      <div className="mb-4 space-y-1">
        <h2 className="font-display text-base font-bold text-ink">Upload regulatory document</h2>
        <p className="text-sm text-ink-secondary">
          Add a country&apos;s regulator filing (PDF). It is stored, parsed, chunked and embedded into the
          compliance corpus — usable by the regulatory module within a minute.
        </p>
      </div>

      <form ref={formRef} onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Country">
          <select name="country" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Select a country…
            </option>
            {COUNTRIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.flag} {c.label}
                {c.regulatoryCovered ? " (corpus exists)" : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Regulatory body" hint="e.g. Betting Control and Licensing Board">
          <input name="regulatory_body" required className={inputClass} placeholder="Regulator name" />
        </Field>

        <Field label="Document name">
          <input name="document_name" className={inputClass} placeholder="Defaults to the file name" />
        </Field>

        <Field label="Document type">
          <select name="document_type" defaultValue="regulation" className={inputClass}>
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Version" hint="Optional — e.g. 2024 amendment">
          <input name="version" className={inputClass} placeholder="Optional" />
        </Field>

        <Field label="Effective date" hint="Optional">
          <input name="effective_date" type="date" className={inputClass} />
        </Field>

        <Field label="Source URL" hint="Optional — official page the PDF came from">
          <input name="source_url" type="url" className={inputClass} placeholder="https://…" />
        </Field>

        <Field label="PDF file" hint="Max 25MB. Text-based PDFs only (scanned/image PDFs need OCR).">
          <input name="file" type="file" accept="application/pdf,.pdf" required className={inputClass} />
        </Field>

        <div className="md:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-chip bg-cobalt px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Uploading…" : "Upload & ingest"}
          </button>
          {result?.ok && result.duplicate ? (
            <span className="text-sm text-watch">{result.message ?? "This document has already been uploaded."}</span>
          ) : result?.ok ? (
            <span className="text-sm text-opportunity">
              Uploaded — ingestion started (status will update to “complete”).
            </span>
          ) : result && !result.ok ? (
            <span className="text-sm text-urgent">{result.error}</span>
          ) : null}
        </div>
      </form>
    </section>
  );
}
