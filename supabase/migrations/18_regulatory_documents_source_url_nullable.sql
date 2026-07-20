-- 18: admin-uploaded regulatory documents may have no external source URL
-- (upload-only ingestion, owner decision 2026-07-20). source_url becomes an
-- optional provenance link rather than a required field.
ALTER TABLE regulatory_documents ALTER COLUMN source_url DROP NOT NULL;
