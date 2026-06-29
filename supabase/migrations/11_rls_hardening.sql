-- Section 11: Hardening — correct Supabase enforcement of Decision 2.
-- NOTE: In Supabase, a public-schema table with RLS *disabled* is EXPOSED to the REST API
-- (anon/authenticated). The correct way to make a table "service-role-only" is to ENABLE RLS
-- with NO policy: anon/authenticated are blocked, service_role bypasses RLS. This adds NO
-- policies (honours Decision 2 "no RLS policies"); enabling RLS is the lockdown mechanism.

-- Service-role-only: ENABLE RLS, NO policy.
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics        ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_job_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_versions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_health_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_job_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_health_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents               ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_skills         ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_router_config  ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_metrics      ENABLE ROW LEVEL SECURITY;
ALTER TABLE churn_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE failed_logins        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbac_config          ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health        ENABLE ROW LEVEL SECURITY;
ALTER TABLE dead_letter_queue    ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_query_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_logs       ENABLE ROW LEVEL SECURITY;

-- Shared reference: ENABLE RLS + read-only for authenticated (anon blocked; writes service-role-only).
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competitors_read_authenticated" ON competitors
  FOR SELECT TO authenticated USING (true);

ALTER TABLE competitor_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competitor_profiles_read_authenticated" ON competitor_profiles
  FOR SELECT TO authenticated USING (true);

ALTER TABLE competitor_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competitor_changes_read_authenticated" ON competitor_changes
  FOR SELECT TO authenticated USING (true);

ALTER TABLE regulatory_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regulatory_documents_read_authenticated" ON regulatory_documents
  FOR SELECT TO authenticated USING (true);

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "document_chunks_read_authenticated" ON document_chunks
  FOR SELECT TO authenticated USING (true);

-- Fix mutable search_path on the updated_at trigger fn.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- Trigger-only functions must not be RPC-callable: remove direct + PUBLIC execute grants.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_brand() FROM anon, authenticated, public;
