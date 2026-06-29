// Shapes written by researcher-regulatory. The cache row columns + violations
// jsonb MUST match the frontend read contract (lib/data/regulatory.ts) and the
// DB schema (migrations/04_cache_tables.sql regulatory_cache).
//
// ⚠️ STATUS VOCAB CONFLICT (flagged, not silently reconciled):
//   • DB CHECK (04_cache_tables.sql) allows: 'compliant' | 'partial' | 'non_compliant' | NULL.
//   • Frontend contract (lib/data/regulatory.ts) expects: 'compliant' | 'partial'
//     | 'missing' | 'violation', and maps anything else (incl. 'non_compliant')
//     to the neutral 'unknown'.
//   Document precedence = schema > frontend contract, and the DB CHECK will REJECT
//   any insert of 'missing'/'violation'. So we WRITE the DB-valid vocabulary
//   ('compliant'|'partial'|'non_compliant'|null). Until the CHECK is widened (a
//   schema-amendment job, NOT this function's file scope), the frontend renders
//   'non_compliant' as 'unknown'. Surfaced in the return report — needs sign-off.

/** DB-valid compliance status for a single dimension (matches the CHECK constraint). */
export type DbComplianceStatus = "compliant" | "partial" | "non_compliant";

/** The six regulatory dimensions, keyed to the regulatory_cache *_status columns.
 *  Order/labels mirror lib/data/regulatory.ts REGULATORY_DIMENSIONS. */
export const DIMENSIONS = [
  { key: "age_verification", column: "age_verification_status", label: "Age Verification" },
  { key: "licence_display", column: "licence_display_status", label: "Licence Display" },
  { key: "responsible_gambling", column: "responsible_gambling_status", label: "Responsible Gambling" },
  { key: "bonus_terms", column: "bonus_terms_status", label: "Bonus Terms" },
  { key: "data_privacy", column: "data_privacy_status", label: "Data Privacy" },
  { key: "withdrawal_terms", column: "withdrawal_terms_status", label: "Withdrawal Terms" },
] as const;

export type DimensionKey = (typeof DIMENSIONS)[number]["key"];

/** regulatory_cache.violations[] element — matches lib/data/regulatory.ts Violation. */
export type Violation = {
  dimension: string;
  severity: "high" | "medium" | "low";
  description: string;
  sourceUrl: string | null;
  quote: string | null;
};

/** Sonnet's verbatim assessment for one dimension (parsed from JSON output). */
export type DimensionAssessment = {
  dimension: DimensionKey;
  status: DbComplianceStatus | "unknown";
  /** Verbatim quote from a retrieved chunk / competitor page. null when no evidence. */
  quote: string | null;
  /** Citation: document name + section/page, or competitor page url. */
  sourceUrl: string | null;
  documentRef: string | null;
  severity: "high" | "medium" | "low";
  description: string;
};

/** A document chunk retrieved for RAG, with its computed cosine similarity. */
export type ScoredChunk = {
  documentId: string;
  documentName: string;
  sourceUrl: string;
  sectionTitle: string | null;
  pageNumber: number | null;
  content: string;
  similarity: number;
};
