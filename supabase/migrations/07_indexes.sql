-- Section 7: Indexes (original schema + amendments §C)

CREATE INDEX idx_feature_health_brand_week ON feature_health_logs(brand_id, scan_week);
CREATE INDEX idx_feature_health_status ON feature_health_logs(status);

CREATE INDEX idx_weekly_cache_brand_week ON weekly_cache(brand_id, scan_week DESC);

CREATE INDEX idx_recommendations_brand_week ON recommendations(brand_id, scan_week);
CREATE INDEX idx_recommendations_status ON recommendations(status);
CREATE INDEX idx_recommendations_urgency ON recommendations(urgency);

CREATE INDEX idx_generated_assets_brand ON generated_assets(brand_id);
CREATE INDEX idx_generated_assets_type ON generated_assets(asset_type);

-- pgvector cosine (ivfflat, lists=100; reindex after bulk load for recall)
CREATE INDEX idx_document_chunks_embedding ON document_chunks
  USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_document_chunks_document ON document_chunks(document_id);

CREATE INDEX idx_alert_history_brand ON alert_history(brand_id, created_at DESC);
CREATE INDEX idx_agent_job_logs_scan ON agent_job_logs(scan_job_id);
CREATE INDEX idx_agent_job_logs_brand ON agent_job_logs(brand_id, created_at DESC);
CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id, created_at ASC);
CREATE INDEX idx_audit_logs_profile ON audit_logs(profile_id, created_at DESC);
CREATE INDEX idx_audit_logs_org ON audit_logs(organisation_id, created_at DESC);
CREATE INDEX idx_api_health_name ON api_health_logs(api_name, checked_at DESC);

-- amendments §C internal tables
CREATE INDEX idx_agent_skills_agent ON agent_skills(agent_id);
CREATE INDEX idx_churn_events_org ON churn_events(organisation_id, occurred_at DESC);
CREATE INDEX idx_active_sessions_profile ON active_sessions(profile_id, last_activity_at DESC);
CREATE INDEX idx_failed_logins_time ON failed_logins(attempted_at DESC);
CREATE INDEX idx_system_health_service ON system_health(service_name, checked_at DESC);
CREATE INDEX idx_dlq_status ON dead_letter_queue(status, next_retry_at);
CREATE INDEX idx_ingestion_logs_doc ON ingestion_logs(document_id, step_timestamp);
