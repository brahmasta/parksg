-- Migration: top searches — merge spelling variants, drop auto-fired searches,
--            report unique searchers and how much of the total the list covers
--
-- An audit of the dashboard's Top searches (7 days, 2026-09-26) found the
-- counts faithful to search_events — 526 rows against 525 results_viewed
-- events, nothing dropped — but the list itself misleading in three ways:
--
-- 1. SPELLING SPLITS. Rows grouped on lower(label) only, so "313 @ somerset"
--    (18) and "313@somerset" (7) were two rows instead of one of 25.
--    Fix: group on search_key(), which also collapses whitespace around
--    @ & / + and trailing punctuation. Deliberately conservative — merging
--    "changi airport & jewel" with "jewel changi airport" needs a place id,
--    not string rules, and a wrong merge is worse than a visible split.
--    The row is labelled with its most common original spelling.
--
-- 2. AUTO-FIRED SEARCHES. /parking-near/:area resolves a destination on page
--    load and calls recordSearch() with no gesture — the same auto traffic
--    009 strips from the funnel. 67 of the 526 were these, and they were the
--    whole of some rows: Little India 12/12, Paya Lebar 9/10, Buona Vista 6/7.
--    Fix: search_events gets an `auto` flag, written by record_search from the
--    client (the same searchStartedByUser signal that tags results_viewed).
--    Historical rows are backfilled by pairing each search with the auto
--    results_viewed its client fired in the same effect. Rows older than
--    app_events itself cannot be classified and stay auto = false.
--
-- 3. NO SENSE OF SCALE. The top 20 held 201 of 526 searches; 196 places were
--    searched exactly once. The panel gave no hint of that tail, and one
--    visitor could carry a row alone (orchard gateway: 7 searches, 1 client).
--    Fix: each row carries `clients`, and top_searches_meta reports the
--    total, the auto-excluded count, distinct places and the share shown.
--
-- ORDER OF DEPLOY: apply this BEFORE shipping the client that sends p_auto.
-- PostgREST resolves RPC overloads by argument name, so a client sending
-- p_auto against the old 6-arg function gets a 404 and the search is lost.
-- The reverse is safe: the old client's 6 named args match the new function
-- (p_auto defaults to false).
--
-- Apply via the Supabase SQL editor, psql, or the MCP apply_migration.

begin;

-- ── 1. The flag ──────────────────────────────────────────────────────────────

alter table public.search_events
  add column if not exists auto boolean not null default false;

update public.search_events s
set auto = true
where not s.auto
  and s.client_id is not null
  and exists (
    select 1 from public.app_events e
    where e.client_id = s.client_id
      and e.name = 'results_viewed'
      and (e.props->>'auto')::boolean is true
      and e.created_at between s.created_at - interval '10 seconds'
                           and s.created_at + interval '10 seconds'
  );

-- ── 2. Ingest: accept p_auto ─────────────────────────────────────────────────
-- Replaces the 6-arg overload rather than adding a 7th alongside it: with both
-- present, a 6-key call would match either and PostgREST would refuse it as
-- ambiguous. The legacy 4-arg overload is untouched — it lacks p_client_id, so
-- it never competes.

drop function if exists public.record_search(text, double precision, double precision, text, text, text);

create or replace function public.record_search(
  p_query     text,
  p_lat       double precision default null,
  p_lng       double precision default null,
  p_user_id   text default null,
  p_client_id text default null,
  p_device    text default null,
  p_auto      boolean default false
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_query text := nullif(trim(p_query), '');
begin
  if v_query is null then return; end if;
  v_query := left(v_query, 200);
  insert into public.search_events (query, query_norm, lat, lng, user_id, client_id, device, auto)
  values (
    v_query, lower(v_query), p_lat, p_lng,
    nullif(trim(p_user_id), ''),
    left(nullif(trim(p_client_id), ''), 64),
    left(nullif(trim(p_device), ''), 16),
    coalesce(p_auto, false)
  );
end;
$function$;

-- Ingest RPCs are anon-callable by design (see 010).
grant execute on function public.record_search(text, double precision, double precision, text, text, text, boolean)
  to anon, authenticated, service_role, postgres;

-- ── 3. Grouping key ──────────────────────────────────────────────────────────

create or replace function public.search_key(p text)
returns text
language sql
immutable
parallel safe
as $function$
  select nullif(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(trim(p)), '\s*([@&/+])\s*', '\1', 'g'),
        '\s+', ' ', 'g'),
      '[\s.,;:!]+$', ''),
    '')
$function$;

-- ── 4. Read side ─────────────────────────────────────────────────────────────
-- Identical to 001 except top_searches and the new top_searches_meta.

create or replace function public.admin_analytics(
  p_days integer default 30,
  p_exclude_emails text[] default '{}'::text[]
)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with
  excl_users as (
    select id from public.profiles
    where array_length(p_exclude_emails, 1) is not null
      and lower(email) = any (select lower(e) from unnest(p_exclude_emails) e)
  ),
  excl_clients as (
    select distinct client_id from (
      select client_id from public.visits where user_id in (select id from excl_users)
      union
      select client_id from public.search_events where user_id in (select id from excl_users)
    ) c where client_id is not null
  ),
  f_visits as (
    select * from public.visits v
    where (v.user_id is null or v.user_id not in (select id from excl_users))
      and (v.client_id is null or v.client_id not in (select client_id from excl_clients))
  ),
  f_search as (
    select * from public.search_events s
    where (s.user_id is null or s.user_id not in (select id from excl_users))
      and (s.client_id is null or s.client_id not in (select client_id from excl_clients))
  ),
  days as (
    select generate_series(
      (current_date - (greatest(p_days,1) - 1) * interval '1 day')::date,
      current_date, interval '1 day')::date as day
  ),
  dau as (
    select d.day, count(distinct v.client_id) as users
    from days d
    left join f_visits v on v.created_at::date = d.day and v.client_id is not null
    group by d.day order by d.day
  ),
  spd as (
    select d.day, count(s.id) as count
    from days d
    left join f_search s on s.created_at::date = d.day
    group by d.day order by d.day
  ),
  win_v as (select * from f_visits where created_at > now() - (greatest(p_days,1) * interval '1 day')),
  win_s as (select * from f_search where created_at > now() - (greatest(p_days,1) * interval '1 day')),
  typed as (
    select search_key(query) as k, query, client_id
    from win_s where not auto
  ),
  grouped as (
    select k,
           mode() within group (order by query) as label,
           count(*) as c,
           count(distinct client_id) as clients
    from typed where k is not null
    group by k
  ),
  top as (
    select * from grouped order by c desc, clients desc, label limit 20
  )
  select jsonb_build_object(
    'window_days', greatest(p_days,1),
    'totals', jsonb_build_object(
      'registered_users', (select count(*) from public.profiles where id not in (select id from excl_users)),
      'visits', (select count(*) from win_v),
      'active_users', (select count(distinct client_id) from win_v where client_id is not null),
      'searches', (select count(*) from win_s),
      'searches_all_time', (select count(*) from f_search),
      'reports_open', (select count(*) from public.inaccuracy_reports where status = 'new'),
      'checkins', (select count(*) from public.checkins where created_at > now() - (greatest(p_days,1) * interval '1 day'))
    ),
    'dau', (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'users', users) order by day), '[]') from dau),
    'searches_by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'count', count) order by day), '[]') from spd),
    'device', (select coalesce(jsonb_agg(jsonb_build_object('device', coalesce(device,'unknown'), 'count', c) order by c desc), '[]')
               from (select device, count(*) c from win_v group by device) t),
    'referrers', (select coalesce(jsonb_agg(jsonb_build_object('referrer', coalesce(nullif(referrer,''),'direct'), 'count', c) order by c desc), '[]')
                  from (select referrer, count(*) c from win_v group by referrer order by count(*) desc limit 12) t),
    'top_searches', (select coalesce(jsonb_agg(jsonb_build_object('query', label, 'count', c, 'clients', clients)
                                               order by c desc, clients desc, label), '[]')
                     from top),
    'top_searches_meta', jsonb_build_object(
      'searches',      (select count(*) from typed),
      'auto_excluded', (select count(*) from win_s where auto),
      'distinct',      (select count(*) from grouped),
      'shown',         (select coalesce(sum(c), 0) from top)
    )
  );
$function$;

revoke all on function public.admin_analytics(integer, text[]) from public, anon, authenticated;
grant execute on function public.admin_analytics(integer, text[]) to service_role, postgres;

commit;

notify pgrst, 'reload schema';
