-- 20_hq_agent_tables.sql — HQ Agent (internal executive intelligence).
--
-- Two purposes:
--  (1) Track DDL that previously existed only on the live DB. hq_conversations,
--      hq_messages and hq_agent_memory were created ad-hoc (the "migration 16"
--      code comments were stale — 16 is market_intel_cache). These CREATE ...
--      IF NOT EXISTS statements are idempotent: no-ops where the table already
--      exists, and reproducible on a fresh DB.
--  (2) Add the new surface for the OpenAI text+voice rebuild: shared text/voice
--      modality on messages, per-tool-run telemetry, and an editable agent config.
--
-- All tables are Class-2 service-role-only (docs/skills/rls-policies.md): RLS
-- ENABLED, NO policies — only server routes (service role via getInternalCtx)
-- read/write. The management gate is app-layer (internal_admin/super_admin).

-- ── Conversations ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hq_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation',
  message_count integer NOT NULL DEFAULT 0,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hq_conversations_profile_idx
  ON hq_conversations (profile_id, last_message_at DESC);
ALTER TABLE hq_conversations ENABLE ROW LEVEL SECURITY;

-- ── Messages (text + voice share one conversation) ───────────────────────────
CREATE TABLE IF NOT EXISTS hq_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES hq_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,                         -- 'user' | 'assistant'
  content text NOT NULL,
  model text,
  tools_used jsonb,
  reaction text,                              -- 'up' | 'down' | null
  feedback_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- New columns for the rebuild (added separately so this is a no-op on the live
-- table that predates them).
ALTER TABLE hq_messages ADD COLUMN IF NOT EXISTS modality text NOT NULL DEFAULT 'text'; -- 'text' | 'voice'
ALTER TABLE hq_messages ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'complete'; -- 'streaming' | 'complete' | 'error'
ALTER TABLE hq_messages ADD COLUMN IF NOT EXISTS metadata jsonb;
CREATE INDEX IF NOT EXISTS hq_messages_conversation_idx
  ON hq_messages (conversation_id, created_at);
ALTER TABLE hq_messages ENABLE ROW LEVEL SECURITY;

-- ── Owner-curated memory (agent never self-writes) ───────────────────────────
CREATE TABLE IF NOT EXISTS hq_agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,                         -- 'fact' | 'preference' | 'lesson'
  content text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE hq_agent_memory ENABLE ROW LEVEL SECURITY;

-- ── Per-tool-run telemetry (§7/§8: log name, duration, success — never payloads) ─
CREATE TABLE IF NOT EXISTS hq_tool_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES hq_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES hq_messages(id) ON DELETE SET NULL,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  tool_name text NOT NULL,
  modality text NOT NULL DEFAULT 'text',      -- 'text' | 'voice'
  duration_ms integer,
  success boolean NOT NULL DEFAULT true,
  error_text text,
  data_updated_at timestamptz,                -- freshness of the data the tool returned
  metadata jsonb,                             -- safe, non-sensitive (filters, date range)
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hq_tool_runs_tool_idx ON hq_tool_runs (tool_name, created_at DESC);
CREATE INDEX IF NOT EXISTS hq_tool_runs_conversation_idx ON hq_tool_runs (conversation_id);
ALTER TABLE hq_tool_runs ENABLE ROW LEVEL SECURITY;

-- ── Editable agent config (§13/§14) — single active row, rich JSONB payload ───
-- Low-level model ids stay in model_router_config (slot 'internal_hq_chat'); the
-- system-prompt override stays in prompt_versions (agent 'internal_hq_chat'). This
-- table holds the product-level config (identity, response style, voice options,
-- enabled tool categories, safety, usage limits) as a versioned JSONB document so
-- the config screen can Save draft / Publish / Restore last published.
CREATE TABLE IF NOT EXISTS hq_agent_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'published',   -- 'draft' | 'published'
  config jsonb NOT NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- At most one draft and one published row at a time (the screen edits the draft,
-- Publish promotes it). Partial unique indexes enforce the singletons.
CREATE UNIQUE INDEX IF NOT EXISTS hq_agent_config_draft_idx
  ON hq_agent_config ((status)) WHERE status = 'draft';
CREATE UNIQUE INDEX IF NOT EXISTS hq_agent_config_published_idx
  ON hq_agent_config ((status)) WHERE status = 'published';
ALTER TABLE hq_agent_config ENABLE ROW LEVEL SECURITY;
