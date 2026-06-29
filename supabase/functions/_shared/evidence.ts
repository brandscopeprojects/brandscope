// Evidence helpers (data-flow-rules.md §2: always store source_url, scraped_at,
// evidence_hash = SHA-256). Every cache write that carries a claim should attach
// an evidence record so the UI's evidence chain is verifiable.

/** SHA-256 hex of a string (Web Crypto, available in Deno). */
export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type EvidenceRecord = {
  source_url: string;
  scraped_at: string; // ISO
  extracted_text: string;
  change_before?: string | null;
  change_after?: string | null;
  evidence_hash: string;
};

/** Build an evidence record, hashing (url + text + timestamp) for integrity. */
export async function makeEvidence(params: {
  sourceUrl: string;
  extractedText: string;
  scrapedAt?: string;
  changeBefore?: string | null;
  changeAfter?: string | null;
}): Promise<EvidenceRecord> {
  const scraped_at = params.scrapedAt ?? new Date().toISOString();
  const evidence_hash = await sha256(
    `${params.sourceUrl}\n${params.extractedText}\n${scraped_at}`,
  );
  return {
    source_url: params.sourceUrl,
    scraped_at,
    extracted_text: params.extractedText,
    change_before: params.changeBefore ?? null,
    change_after: params.changeAfter ?? null,
    evidence_hash,
  };
}

/** Monday (UTC) of the week containing `date` as YYYY-MM-DD — the scan_week key. */
export function mondayOfWeek(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}
