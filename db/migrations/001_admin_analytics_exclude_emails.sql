-- Migration: admin_analytics — optional admin-exclusion list
--
-- Adds a p_exclude_emails text[] parameter to public.admin_analytics. When a
-- non-empty list is passed, every metric (DAU, visits, searches, top searches,
-- device/referrer splits, registered users) drops activity belonging to those
-- accounts — matched by the admin's profile user_id AND any client_id ever
-- seen for that user_id, so anonymous page loads from the admin's own device
-- are excluded too.
--
-- Backward compatible: called as admin_analytics(p_days) with no second arg,
-- p_exclude_emails defaults to '{}' and the result is identical to the prior
-- version. Wired up by api/admin/analytics.ts (the dashboard's "Exclude admin"
-- toggle passes ?exclude_admin=1, which forwards ADMIN_EMAILS).
--
-- Apply with the Supabase MCP apply_migration, the SQL editor, or psql.

drop function if exists public.admin_analytics(integer);

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
  win_s as (select * from f_search where created_at > now() - (greatest(p_days,1) * interval '1 day'))
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
    'top_searches', (select coalesce(jsonb_agg(jsonb_build_object('query', query_norm, 'count', c) order by c desc), '[]')
                     from (select query_norm, count(*) c from win_s where query_norm is not null group by query_norm order by count(*) desc limit 20) t)
  );
$function$;

grant execute on function public.admin_analytics(integer, text[]) to service_role, postgres;
