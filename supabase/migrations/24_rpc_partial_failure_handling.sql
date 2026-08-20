-- Migration 24: Update app_scan_complete_module RPC to handle partial failures.
-- When 1+ researchers fail (DataForSEO rate limit, network error, etc.), the RPC
-- now triggers synthesis once ALL 8 tasks reach terminal state (completed OR failed).
-- Synthesis gracefully handles missing summaries and synthesizes from available modules.

CREATE OR REPLACE FUNCTION app_scan_complete_module(
  p_scan_job_id uuid, p_task text, p_outcome text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_expected text[];
  v_completed text[];
  v_failed text[];
  v_partial text[];
  v_terminal text[];
  v_should boolean := false;
BEGIN
  -- Record the module outcome (completed, failed, or partial).
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
   RETURNING expected_modules, completed_steps, failed_modules, partial_modules
   INTO v_expected, v_completed, v_failed, v_partial;

  IF v_expected IS NULL THEN RETURN false; END IF;

  -- Update progress: (completed + failed + partial) / expected * 100
  v_terminal := v_completed || coalesce(v_failed, '{}') || coalesce(v_partial, '{}');
  UPDATE scan_jobs
     SET progress_percentage = LEAST(100, (cardinality(v_terminal) * 100) / GREATEST(1, cardinality(v_expected)))
   WHERE id = p_scan_job_id;

  -- PARTIAL FAILURE HANDLING (new logic):
  -- Trigger synthesis once ALL expected modules have reached terminal state
  -- (either completed, failed, or partial). Don't wait for all to succeed.
  IF (SELECT bool_and(e = ANY(v_terminal)) FROM unnest(v_expected) e) THEN
    UPDATE scan_jobs
       SET synthesis_enqueued = true
     WHERE id = p_scan_job_id AND synthesis_enqueued = false
     RETURNING true INTO v_should;
  END IF;

  RETURN coalesce(v_should, false);
END; $$;

-- Update comments explaining the new behavior
COMMENT ON FUNCTION app_scan_complete_module(uuid, text, text) IS
'Record a module outcome (completed/failed/partial) and check if all expected modules
have reached terminal state. If all modules are done (regardless of outcome),
trigger synthesis so it can synthesize from available summaries. Gracefully handles
partial failures where 1+ researchers failed but others succeeded.';
