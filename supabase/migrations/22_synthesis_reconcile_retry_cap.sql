-- Checks & balances: cap synthesis recovery retries so a wedged scan_job can
-- never re-fire synthesis-draft-audit (an Anthropic call) forever. Root cause of
-- the every-minute Anthropic burn observed 2026-08-06: app_reconcile_synthesis
-- re-fired stuck jobs on a 4-minute timer with no attempt ceiling.

alter table public.scan_jobs
  add column if not exists synthesis_attempts integer not null default 0;

create or replace function public.app_reconcile_synthesis()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare j record; n int := 0; cap int := 3;
begin
  -- Re-fire synthesis only for jobs still under the retry cap.
  for j in
    select id, brand_id, scan_week
    from scan_jobs
    where status = 'running'
      and expected_modules is not null
      and array_length(expected_modules, 1) is not null
      and (select count(distinct m) from unnest(expected_modules) m
           where m = any(completed_steps)) >= array_length(expected_modules, 1)
      and updated_at < now() - interval '4 minutes'
      and synthesis_attempts < cap
  loop
    perform app_trigger_function(
      'synthesis-draft-audit',
      jsonb_build_object('scan_job_id', j.id::text,
                         'brand_id', j.brand_id::text,
                         'scan_week', j.scan_week::text)
    );
    update scan_jobs
       set synthesis_attempts = synthesis_attempts + 1,
           updated_at = now()
     where id = j.id;
    n := n + 1;
  end loop;

  -- Park jobs that exhausted the cap so they drop out of the loop and become
  -- visible as failed (instead of silently re-firing forever).
  update scan_jobs
     set status = 'failed',
         error_message = trim(both ' ' from coalesce(error_message,'') || ' [synthesis retries exhausted after ' || cap || ' attempts]'),
         updated_at = now()
   where status = 'running'
     and synthesis_attempts >= cap
     and expected_modules is not null
     and array_length(expected_modules, 1) is not null
     and (select count(distinct m) from unnest(expected_modules) m
          where m = any(completed_steps)) >= array_length(expected_modules, 1);

  return n;
end;
$function$;
