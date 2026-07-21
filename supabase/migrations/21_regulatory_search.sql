-- 21_regulatory_search.sql — connect the Knowledge Base to the HQ Agent.
--
-- (1) Duplicate-document guard: the ingest pipeline computes a SHA-256 file hash
--     but never enforced uniqueness, so re-uploading the same PDF created a
--     second regulatory_documents row (+ duplicate embedding cost). A pre-check
--     of duplicates found NONE, so this unique index is safe to add now.
--
-- (2) match_regulatory_chunks: a NARROW, read-only pgvector similarity search for
--     the HQ Agent's search_regulatory_knowledge tool. Design guards:
--       • typed params only (no dynamic SQL), bounded result LIMIT,
--       • active + fully-embedded documents only,
--       • a server-controlled similarity floor,
--       • an explicit, fixed search_path,
--       • returns citation metadata only — never the embedding vectors.
--     SECURITY INVOKER (the default): the tool calls this via the service-role
--     client, which already bypasses RLS, so SECURITY DEFINER is NOT required —
--     the safer choice. EXECUTE is granted to service_role only.

-- (1) Uniqueness on the content hash (dedupe).
CREATE UNIQUE INDEX IF NOT EXISTS regulatory_documents_file_hash_key
  ON regulatory_documents (file_hash);

-- (2) Similarity search over embedded regulatory chunks.
CREATE OR REPLACE FUNCTION match_regulatory_chunks(
  query_embedding extensions.vector(1536),
  match_count int DEFAULT 6,
  min_similarity double precision DEFAULT 0.3,
  filter_country text DEFAULT NULL
)
RETURNS TABLE (
  document_id uuid,
  document_name text,
  regulatory_body text,
  country text,
  section_title text,
  page_number int,
  source_url text,
  similarity double precision,
  content text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT
    dc.document_id,
    rd.document_name,
    rd.regulatory_body,
    rd.country,
    dc.section_title,
    dc.page_number,
    rd.source_url,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    dc.content
  FROM document_chunks dc
  JOIN regulatory_documents rd ON rd.id = dc.document_id
  WHERE rd.is_active = true
    AND rd.embedding_status = 'complete'
    AND dc.embedding IS NOT NULL
    AND (filter_country IS NULL OR lower(rd.country) = lower(filter_country))
    AND (1 - (dc.embedding <=> query_embedding)) >= greatest(min_similarity, 0.0)
  ORDER BY dc.embedding <=> query_embedding ASC
  LIMIT least(greatest(match_count, 1), 20);
$$;

REVOKE ALL ON FUNCTION match_regulatory_chunks(extensions.vector, int, double precision, text) FROM public;
GRANT EXECUTE ON FUNCTION match_regulatory_chunks(extensions.vector, int, double precision, text) TO service_role;
