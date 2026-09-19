-- Migration: prune_app_events — bounded retention for the event log
--
-- app_events grows with every button press (the delegated click tracker in
-- src/lib/api/events.ts records all of them), so unlike visits/search_events it
-- has no natural ceiling. At current traffic that is a few tens of thousands of
-- rows a month — trivial for Postgres, but unbounded growth on a free-tier
-- database is a slow leak rather than a non-issue.
--
-- Twelve months is the retention window: long enough to compare a month against
-- the same month last year, short enough that the table stays small. Called
-- daily by api/cron/prune-app-events.ts.
--
-- Deletes in batches rather than one statement. A single unbounded DELETE would
-- take a long-lived lock and could exceed the cron function's time budget once
-- there is a real backlog; 5k-row batches keep each transaction short and let
-- the loop make steady progress instead.
--
-- NOT granted to anon. Every other RPC in this schema is anon-callable by
-- design; this one destroys data, so it is service-role only and reachable
-- exclusively through the cron endpoint's CRON_SECRET gate.
--
-- Apply via the Supabase SQL editor, psql, or the MCP apply_migration.

create or replace function public.prune_app_events(p_months integer default 12)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_cutoff  timestamptz;
  v_deleted integer := 0;
  v_batch   integer;
begin
  -- Floor at 1 month so a bad argument (0, negative, null) can never be read
  -- as "delete everything".
  v_cutoff := now() - (greatest(coalesce(p_months, 12), 1) * interval '1 month');

  loop
    delete from public.app_events
    where id in (
      select id from public.app_events
      where created_at < v_cutoff
      order by id
      limit 5000
    );
    get diagnostics v_batch = row_count;
    v_deleted := v_deleted + v_batch;
    exit when v_batch = 0;
  end loop;

  return v_deleted;
end;
$function$;

revoke all on function public.prune_app_events(integer) from public, anon, authenticated;
grant execute on function public.prune_app_events(integer) to service_role, postgres;
