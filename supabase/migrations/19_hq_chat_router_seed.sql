-- 19: seed the HQ Agent's runtime config row (editable from the admin chat
-- settings panel). Model / temperature / max_tokens / rate-limit for the internal
-- HQ chat live on this model_router_config row (task_type 'internal_hq_chat'); the
-- system-prompt override lives on prompt_versions (agent_name 'internal_hq_chat').
INSERT INTO model_router_config (task_type, primary_model, max_tokens, temperature, requests_per_min, is_active)
SELECT 'internal_hq_chat', 'claude-sonnet-4-6', 1500, 0.2, 20, true
WHERE NOT EXISTS (SELECT 1 FROM model_router_config WHERE task_type = 'internal_hq_chat');
