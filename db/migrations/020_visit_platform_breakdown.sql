-- Migration: record which shell a visit came from (web / ios / android) and
--            report the split on the admin Overview
--
-- The Capacitor apps run the same bundle as the website, so until now a visit
-- from the App Store build was indistinguishable from a mobile-web one. The
-- client now sends `p_platform` from Capacitor.getPlatform().
--
-- Rows written before this migration, and visits from app builds that predate
-- the client change, carry no platform. They are reported as 'web'. That
-- slightly overstates web (older installed app builds bundle the old client),
-- and corrects itself as people update.
--
-- record_visit gains a parameter, so the old signature is dropped first —
-- PostgREST cannot choose between overloads and every call would 502. The new
-- parameter defaults to null, so a browser still running the old bundle keeps
-- working.
--
-- admin_platform_breakdown counts PEOPLE with the same positive-signal rule as
-- admin_traffic_analytics (reached the home screen, came back, signed in, or
-- took a user-initiated action), so crawlers on the SEO routes do not inflate
-- the web number. Buckets are Singapore calendar dates; the mean divides by
-- complete days only.
--
-- Apply via the Supabase SQL editor, psql, or the MCP apply_migration.

alter table public.visits add column if not exists platform text;

drop function if exists public.record_visit(text, text, text, text, text);

create or replace function public.record_visit(
  p_client_id text,
  p_device text default null,
  p_referrer text default null,
  p_user_id text default null,
  p_path text default null,
  p_platform text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.visits (client_id, device, referrer, user_id, path, platform)
  values (
    left(nullif(trim(p_client_id), ''), 64),
    left(nullif(trim(p_device), ''), 16),
    left(nullif(trim(p_referrer), ''), 120),
    left(nullif(trim(p_user_id), ''), 64),
    left(nullif(trim(p_path), ''), 200),
    case when lower(trim(p_platform)) in ('web', 'ios', 'android')
         then lower(trim(p_platform)) end
  );
end;
$function$;

grant execute on function public.record_visit(text, text, text, text, text, text)
  to anon, authenticated, service_role;

create or replace function public.admin_platform_breakdown(
  p_days integer default 30,
  p_exclude_emails text[] default '{}'::text[]
)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with
  win as (select greatest(coalesce(p_days, 30), 1) as days),
  sg as (select (now() at time zone 'Asia/Singapore')::date as today),
  bounds as (
    select (select today from sg) - ((select days from win) - 1) as first_day,
           (select today from sg) as last_day
  ),
  n_full as (select greatest((select days from win) - 1, 1) as n),

  excl_users as (
    select id from public.profiles
    where array_length(p_exclude_emails, 1) is not null
      and lower(email) = any (select lower(e) from unnest(p_exclude_emails) e)
  ),
  excl_clients as (
    select distinct client_id from (
      select client_id from public.visits     where user_id in (select id from excl_users)
      union
      select client_id from public.app_events where user_id in (select id from excl_users)
    ) c where client_id is not null
  ),

  v_all as (
    select v.*, (v.created_at at time zone 'Asia/Singapore')::date as sg_day
    from public.visits v
    where (v.created_at at time zone 'Asia/Singapore')::date
            between (select first_day from bounds) and (select last_day from bounds)
      and v.client_id is not null
      and v.client_id not in (select client_id from excl_clients)
      and (v.user_id is null or v.user_id not in (select id from excl_users))
  ),
  actors as (
    select distinct e.client_id from public.app_events e
    where (e.created_at at time zone 'Asia/Singapore')::date
            between (select first_day from bounds) and (select last_day from bounds)
      and e.client_id is not null
      and e.name in (
        'ui_click', 'navigate_clicked', 'carpark_saved', 'destination_saved',
        'filter_applied', 'view_mode_changed', 'stay_planner_used',
        'checkin_submitted', 'inaccuracy_reported', 'carpark_add_started',
        'carpark_add_submitted', 'edit_suggested', 'sign_in_started',
        'sign_in_completed', 'install_accepted', 'search_submitted'
      )
      and coalesce(e.props->>'auto', '') <> 'true'
  ),
  people as (
    select v.client_id,
           coalesce(max(v.platform), 'web') as platform
    from v_all v
    group by v.client_id
    having bool_or(v.path is null or v.path = '/')
        or count(*) > 1
        or bool_or(v.user_id is not null)
        or v.client_id in (select client_id from actors)
  ),
  per_platform as (
    select p.platform,
           count(*) as people
    from people p group by p.platform
  ),
  daily as (
    select pe.platform, v.sg_day,
           count(distinct v.client_id) as dau,
           count(*)                    as visits
    from v_all v join people pe using (client_id)
    group by pe.platform, v.sg_day
  ),
  agg as (
    select platform,
           coalesce(sum(dau) filter (where sg_day < (select today from sg)), 0)::numeric
             / (select n from n_full) as avg_dau,
           sum(visits) as visits
    from daily group by platform
  )
  select jsonb_build_object(
    'platforms', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'platform', s.platform,
        'people',   coalesce(pp.people, 0),
        'avg_dau',  round(coalesce(a.avg_dau, 0), 1),
        'visits',   coalesce(a.visits, 0)
      ) order by coalesce(pp.people, 0) desc), '[]'::jsonb)
      from (values ('web'), ('ios'), ('android')) s(platform)
      left join per_platform pp on pp.platform = s.platform
      left join agg a on a.platform = s.platform
    )
  );
$function$;

revoke all on function public.admin_platform_breakdown(integer, text[])
  from public, anon, authenticated;
grant execute on function public.admin_platform_breakdown(integer, text[])
  to service_role, postgres;
