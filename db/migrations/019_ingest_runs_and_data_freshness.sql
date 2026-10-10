-- Migration: ingest_runs + admin_data_freshness — make data health visible
--
-- The 2026-10-05 PM brief could not tell whether ingest was healthy:
--
--   * carparks.last_synced is a METADATA timestamp, written only by the manual
--     sync scripts (migrate-to-supabase.ts, migrate-curated-malls.ts, …) and the
--     admin editor. The daily URA rate cron never touches it, so it looked
--     "frozen" at 29 Sep / 26 May even though URA rates were rewritten that day.
--   * The cron's only failure signal was a 500 in Vercel's logs — nothing in the
--     database recorded that a run happened, succeeded, or failed.
--
-- This adds:
--
-- 1. ingest_runs — one row per automated ingest attempt (success OR failure),
--    written by the cron handlers. Service-role only; never anon-readable.
--
-- 2. admin_data_freshness() — a read-only per-source report: carparks, carparks
--    with CAR rate rows, the newest rate_rows write, the newest effective_from,
--    the newest last_synced, and the latest ingest run. The daily
--    /api/cron/data-health check and the admin dashboard both read it. It only
--    reports on existing data; it never writes or fills anything in.
--
-- last_synced keeps its meaning (when the carpark's metadata row was last
-- synced). Rate freshness is read from rate_rows.created_at, which every rate
-- writer already stamps.
--
-- ORDER OF DEPLOY: either order is safe. The cron handlers log runs
-- best-effort, so a missing table only loses the log line, never the ingest.
--
-- Apply via the Supabase SQL editor, psql, or the MCP apply_migration.

begin;

-- ── 1. Run log ───────────────────────────────────────────────────────────────

create table if not exists public.ingest_runs (
  id          bigint generated always as identity primary key,
  job         text        not null,                 -- e.g. 'ura-rates-ingest'
  source      text,                                 -- rate_source label it feeds, e.g. 'URA'
  started_at  timestamptz not null,
  finished_at timestamptz not null default now(),
  ok          boolean     not null,
  rows        integer,                              -- rows written on success
  error       text                                  -- truncated message on failure
);

create index if not exists ingest_runs_job_finished_idx
  on public.ingest_runs (job, finished_at desc);

alter table public.ingest_runs enable row level security;
-- No policies: only the service role (which bypasses RLS) reads or writes.
revoke all on table public.ingest_runs from anon, authenticated;

-- ── 2. Freshness report ──────────────────────────────────────────────────────

create or replace function public.admin_data_freshness()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with cp as (
    select c.source::text as source,
           count(*)                                  as carparks,
           max(c.last_synced)                        as last_synced,
           count(*) filter (where not exists (
             select 1 from public.rate_rows r
             where r.carpark_id = c.id and r.veh_cat = 'CAR'
           ))                                        as carparks_without_rates
    from public.carparks c
    group by 1
  ),
  rr as (
    select r.source::text as source,
           count(*)                     as rate_rows,
           count(distinct r.carpark_id) as rated_carparks,
           max(r.created_at)            as rates_written_at,
           max(r.effective_from)        as rates_effective_from
    from public.rate_rows r
    group by 1
  ),
  runs as (
    select distinct on (job) job, source, started_at, finished_at, ok, rows, error
    from public.ingest_runs
    order by job, finished_at desc
  ),
  last_ok as (
    select job, max(finished_at) as last_ok_at
    from public.ingest_runs where ok
    group by job
  )
  select jsonb_build_object(
    'generated_at', now(),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source',                 s.source,
        'carparks',               coalesce(cp.carparks, 0),
        'carparks_without_rates', coalesce(cp.carparks_without_rates, 0),
        'last_synced',            cp.last_synced,
        'rate_rows',              coalesce(rr.rate_rows, 0),
        'rated_carparks',         coalesce(rr.rated_carparks, 0),
        'rates_written_at',       rr.rates_written_at,
        'rates_effective_from',   rr.rates_effective_from
      ) order by s.source)
      from (select source from cp union select source from rr) s
      left join cp using (source)
      left join rr using (source)
    ), '[]'::jsonb),
    'runs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'job',         runs.job,
        'source',      runs.source,
        'started_at',  runs.started_at,
        'finished_at', runs.finished_at,
        'ok',          runs.ok,
        'rows',        runs.rows,
        'error',       runs.error,
        'last_ok_at',  last_ok.last_ok_at
      ) order by runs.job)
      from runs left join last_ok using (job)
    ), '[]'::jsonb)
  );
$function$;

-- Admin/cron only — reached through the service role, like prune_app_events.
revoke all on function public.admin_data_freshness() from public, anon, authenticated;
grant execute on function public.admin_data_freshness() to service_role, postgres;

commit;
