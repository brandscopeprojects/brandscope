-- 15: model-router row for the onboarding setup agent (onboarding-suggest
-- Edge Function). Territory + competitor suggestion needs operator knowledge →
-- Sonnet primary, Haiku fallback. Swappable at runtime via model_router_config.

INSERT INTO model_router_config (task_type, primary_model, fallback_model, max_tokens, temperature)
VALUES ('onboarding_suggest', 'claude-sonnet-4-6', 'claude-haiku-4-5', 1200, 0.20)
ON CONFLICT (task_type) DO NOTHING;
