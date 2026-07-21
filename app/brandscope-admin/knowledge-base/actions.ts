"use server";

// Internal-admin Knowledge Base server actions.
// Regulatory documents are GLOBAL curated master data, so uploads are gated to
// internal admins (requireInternalAdmin) and handled server-side. The actual
// R2 storage + PDF parse + chunk + embed happens in the `regulatory-ingest`
// edge function (R2 credentials live in Supabase, not Vercel) — this action just
// validates and forwards the file + metadata with the service-role bearer.

import { revalidatePath } from "next/cache";
import { requireInternalAdmin } from "@/lib/auth";
import { MARKET_VALUES } from "@/lib/onboarding/constants";
import { COUNTRY_BY_VALUE } from "@/lib/onboarding/countries";

export type UploadResult =
  | { ok: true; documentId: string; duplicate?: boolean; message?: string }
  | { ok: false; error: string };

export type ReprocessResult = { ok: true } | { ok: false; error: string };

const MAX_BYTES = 25 * 1024 * 1024; // 25MB
const DOC_TYPES = new Set(["regulation", "act", "guideline", "licence_condition", "circular", "other"]);

export async function uploadRegulatoryDocument(formData: FormData): Promise<UploadResult> {
  await requireInternalAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a PDF file to upload." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "File is too large (max 25MB)." };
  }
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
    return { ok: false, error: "Only PDF documents are supported." };
  }

  const marketSlug = String(formData.get("country") ?? "");
  if (!MARKET_VALUES.includes(marketSlug)) {
    return { ok: false, error: "Select a valid country." };
  }
  const countryLabel = COUNTRY_BY_VALUE.get(marketSlug)?.label ?? marketSlug;

  const regulatoryBody = String(formData.get("regulatory_body") ?? "").trim();
  if (!regulatoryBody) {
    return { ok: false, error: "Enter the regulatory body (e.g. Betting Control and Licensing Board)." };
  }

  const documentName = String(formData.get("document_name") ?? "").trim() || file.name;
  const documentType = String(formData.get("document_type") ?? "regulation");
  if (!DOC_TYPES.has(documentType)) {
    return { ok: false, error: "Choose a valid document type." };
  }
  const version = String(formData.get("version") ?? "").trim();
  const effectiveDate = String(formData.get("effective_date") ?? "").trim();
  const sourceUrl = String(formData.get("source_url") ?? "").trim();
  const supersedes = String(formData.get("supersedes") ?? "").trim();

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return { ok: false, error: "Server is not configured for uploads." };

  const fwd = new FormData();
  fwd.set("file", file, file.name);
  fwd.set("country", countryLabel);
  fwd.set("regulatory_body", regulatoryBody);
  fwd.set("document_name", documentName);
  fwd.set("document_type", documentType);
  if (version) fwd.set("version", version);
  if (effectiveDate) fwd.set("effective_date", effectiveDate);
  if (sourceUrl) fwd.set("source_url", sourceUrl);
  if (supersedes) fwd.set("supersedes", supersedes);

  try {
    const res = await fetch(`${base}/functions/v1/regulatory-ingest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` }, // no Content-Type — fetch sets the multipart boundary
      body: fwd,
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; document_id?: string; duplicate?: boolean; message?: string; error?: string };
    if (!res.ok || !data.ok || !data.document_id) {
      return { ok: false, error: data.error ?? `Upload failed (HTTP ${res.status}).` };
    }
    revalidatePath("/brandscope-admin/knowledge-base");
    return {
      ok: true,
      documentId: data.document_id,
      duplicate: data.duplicate === true,
      message: data.duplicate ? (data.message ?? "This document has already been uploaded.") : undefined,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Upload request failed." };
  }
}

/** Re-run parsing/chunking/embedding for a failed document, reusing the stored
 *  R2 PDF (no re-upload, no new record). Idempotent server-side. */
export async function reprocessRegulatoryDocument(documentId: string): Promise<ReprocessResult> {
  await requireInternalAdmin();
  if (!documentId) return { ok: false, error: "Missing document id." };

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return { ok: false, error: "Server is not configured." };

  try {
    const res = await fetch(`${base}/functions/v1/regulatory-ingest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: documentId }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) return { ok: false, error: data.error ?? `Reprocess failed (HTTP ${res.status}).` };
    revalidatePath("/brandscope-admin/knowledge-base");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Reprocess request failed." };
  }
}
