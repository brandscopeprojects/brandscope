-- Migration 13 — Sprint 3 orchestration: pgmq queues, scan-state machine RPCs,
-- and pg_cron schedules. (CLAUDE.md Decision 4/5: pgmq + scan_jobs state machine;
-- extensions vector + pg_cron + pg_net + pgmq.)
--
-- NOTE (schema amendment, flagged in docs/schema-amendments.md §D.5): adds
-- scan_jobs.expected_modules + scan_jobs.synthesis_enqueued so fan-out completion
-- ("expected vs done", agent-orchestration.md) is race-free without a new table.

-- ── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Queues ───────────────────────────────────────────────────────────────────
SELECT pgmq.create('scan_modules');
SELECT pgmq.create('scan_synthesis');

-- ── scan_jobs fan-out columns ────────────────────────────────────────────────
ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS expected_modules text[];
ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS synthesis_enqueued boolean NOT NULL DEFAULT false;

-- ── pgmq wrapper RPCs (service_role only) ────────────────────────────────────
CREATE OR REPLACE FUNCTION app_pgmq_send(p_queue text, p_message jsonb)
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = public, pgmq AS $$
  SELECT pgmq.send(p_queue, p_message);
$$;

CREATE OR REPLACE FUNCTION app_pgmq_read(p_queue text, p_vt integer, p_qty integer)
RETURNS TABLE(msg_id bigint, message jsonb)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pgmq AS $$
  SELECT msg_id, message FROM pgmq.read(p_queue, p_vt, p_qty);
$$;

CREATE OR REPLACE FUNCTION app_pgmq_archive(p_queue text, p_msg_id bigint)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public, pgmq AS $$
  SELECT pgmq.archive(p_queue, p_msg_id);
$$;

-- ── Atomic module-completion / fan-out detection ─────────────────────────────
-- Appends the module result; if all expected modules are now done AND synthesis
-- hasn't been claimed, claims it (once) and returns true so exactly one caller
-- enqueues scan_synthesis.
CREATE OR REPLACE FUNCTION app_scan_complete_module(
  p_scan_job_id uuid, p_task text, p_outcome text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_expected text[];
  v_completed text[];
  v_should boolean := false;
BEGIN
  UPDATE scan_jobs
     SET completed_steps = array_append(coalesce(completed_steps, '{}'), p_task),
         failed_modules  = CASE WHEN p_outcome = 'failed'
                                THEN array_append(coalesce(failed_modules, '{}'), p_task)
                                ELSE failed_modules END,
         partial_modules = CASE WHEN p_outcome = 'partial'
                                THEN array_append(coalesce(partial_modules, '{}'), p_task)
                                ELSE partial_modules END,
         updated_at = now()
   WHERE id = p_scan_job_id
   RETURNING expected_modules, completed_steps INTO v_expected, v_completed;

  IF v_expected IS NULL THEN RETURN false; END IF;

  UPDATE scan_jobs
     SET progress_percentage = LEAST(100, (cardinality(v_completed) * 100) / GREATEST(1, cardinality(v_expected)))
   WHERE id = p_scan_job_id;

  IF (SELECT bool_and(e = ANY(v_completed)) FROM unnest(v_expected) e) THEN
    UPDATE scan_jobs SET synthesis_enqueued = true
     WHERE id = p_scan_job_id AND synthesis_enqueued = false
     RETURNING true INTO v_should;
  END IF;

  RETURN coalesce(v_should, false);
END; $$;

-- Lock down execution to service_role (Edge Functions). anon/authenticated cannot call.
REVOKE ALL ON FUNCTION app_pgmq_send(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_pgmq_read(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_pgmq_archive(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_scan_complete_module(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_pgmq_send(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION app_pgmq_read(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION app_pgmq_archive(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION app_scan_complete_module(uuid, text, text) TO service_role;

-- ── Cron → Edge Function trigger helper ──────────────────────────────────────
-- Reads the project URL + CRON_SECRET from Vault (set by the owner at deploy:
--   select vault.create_secret('https://<ref>.supabase.co','project_url');
--   select vault.create_secret('<cron-secret>','cron_secret');
-- ), then POSTs to the function with the shared bearer pg_net is async.
CREATE OR REPLACE FUNCTION app_trigger_function(p_name text, p_body jsonb DEFAULT '{}'::jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, net AS $$
DECLARE
  v_url text;
  v_secret text;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'project_url';
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret';
  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE NOTICE 'app_trigger_function: project_url/cron_secret not set in Vault';
    RETURN NULL;
  END IF;
  SELECT net.http_post(
    url := v_url || '/functions/v1/' || p_name,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := p_body
  ) INTO v_request_id;
  RETURN v_request_id;
END; $$;

REVOKE ALL ON FUNCTION app_trigger_function(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_trigger_function(text, jsonb) TO service_role;

-- ── Schedules ────────────────────────────────────────────────────────────────
-- Weekly scan: Monday 01:00 UTC (02:00 WAT). Between-cycle monitor: every 6h.
SELECT cron.schedule('weekly-scan-trigger', '0 1 * * 1',
  $$ SELECT app_trigger_function('weekly-scan-trigger', '{}'::jsonb); $$);
SELECT cron.schedule('between-cycle-monitor', '0 */6 * * *',
  $$ SELECT app_trigger_function('between-cycle-monitor', '{}'::jsonb); $$);
