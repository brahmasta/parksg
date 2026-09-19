-- Migration: admin_event_analytics — tracking age + richer per-feature detail
--
-- WHY
--
-- The feature-usage panel rendered "UNTOUCHED — 45 OF 46" one hour after
-- click tracking shipped. Every one of those 45 was simply unobserved, but the
-- panel's own caption read "Nobody pressed these — either the feature is not
-- wanted, or it cannot be found", which invites a product decision that the
-- data cannot yet support. Absence of evidence was being rendered as evidence
-- of absence.
--
-- The dashboard cannot tell the difference without knowing how long it has been
-- watching, so this exposes it:
--
--   tracking.first_event_at   when the very first app_event landed
--   tracking.first_click_at   when the first ui_click landed (clicks are what
--                             the feature roster is judged against, and they
--                             can start later than app_open)
--   tracking.ui_clicks        total clicks in the window, the sample size
--
-- ui_clicks rows also gain `last_seen`, so a feature that was used once in
-- week one and abandoned reads differently from one used steadily.
--
-- Signature unchanged, so `create or replace` replaces rather than overloads.
--
-- Apply via the Supabase SQL editor, psql, or the MCP apply_migration.

create or replace function public.admin_event_analytics(
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
  excl_users as (
    select id from public.profiles
    where array_length(p_exclude_emails, 1) is not null
      and lower(email) = any (select lower(e) from unnest(p_exclude_emails) e)
  ),
  excl_clients as (
    select distinct client_id from (
      select client_id from public.visits        where user_id in (select id from excl_users)
      union
      select client_id from public.search_events where user_id in (select id from excl_users)
      union
      select client_id from public.app_events    where user_id in (select id from excl_users)
    ) c where client_id is not null
  ),
  f_events as (
    select * from public.app_events e
    where (e.user_id   is null or e.user_id   not in (select id from excl_users))
      and (e.client_id is null or e.client_id not in (select client_id from excl_clients))
  ),
  f_visits as (
    select * from public.visits v
    where (v.user_id   is null or v.user_id   not in (select id from excl_users))
      and (v.client_id is null or v.client_id not in (select client_id from excl_clients))
  ),
  win_e as (
    select e.* from f_events e, win
    where e.created_at > now() - (win.days * interval '1 day')
  ),
  steps as (
    select
      client_id,
      min(created_at) filter (where name = 'app_open')         as s1,
      min(created_at) filter (where name = 'search_submitted') as s2,
      min(created_at) filter (where name = 'results_viewed')   as s3,
      min(created_at) filter (where name = 'carpark_viewed')   as s4,
      min(created_at) filter (where name = 'navigate_clicked') as s5
    from win_e
    where client_id is not null
    group by client_id
  ),
  reach as (
    select
      count(*) filter (where s1 is not null)                           as r1,
      count(*) filter (where s1 is not null and s2 >= s1)              as r2,
      count(*) filter (where s1 is not null and s2 >= s1
                         and s3 >= s2)                                 as r3,
      count(*) filter (where s1 is not null and s2 >= s1
                         and s3 >= s2 and s4 >= s3)                    as r4,
      count(*) filter (where s1 is not null and s2 >= s1
                         and s3 >= s2 and s4 >= s3 and s5 >= s4)       as r5
    from steps
  ),
  funnel as (
    select * from (
      values
        (1, 'app_open',         'Opened the app'),
        (2, 'search_submitted', 'Searched a destination'),
        (3, 'results_viewed',   'Saw results'),
        (4, 'carpark_viewed',   'Opened a carpark'),
        (5, 'navigate_clicked', 'Navigated there')
    ) as t(step, name, label)
  ),
  funnel_rows as (
    select
      f.step, f.name, f.label,
      case f.step when 1 then r.r1 when 2 then r.r2 when 3 then r.r3
                  when 4 then r.r4 else r.r5 end as clients,
      r.r1 as top
    from funnel f cross join reach r
  ),
  activity as (
    select client_id, created_at from f_visits where client_id is not null
    union all
    select client_id, created_at from f_events where client_id is not null
  ),
  first_seen as (
    select client_id, min(created_at) as t0 from activity group by client_id
  ),
  cohorts as (
    select client_id, date_trunc('week', t0)::date as cohort
    from first_seen
    where t0 >= date_trunc('week', now()) - interval '7 weeks'
  ),
  act_weeks as (
    select distinct client_id, date_trunc('week', created_at)::date as w from activity
  ),
  cohort_size as (
    select cohort, count(*) as size from cohorts group by cohort
  ),
  cohort_cells as (
    select
      c.cohort,
      ((a.w - c.cohort) / 7)::int as week_offset,
      count(distinct c.client_id) as users
    from cohorts c
    join act_weeks a on a.client_id = c.client_id and a.w >= c.cohort
    group by c.cohort, ((a.w - c.cohort) / 7)::int
  ),
  retention as (
    select
      cs.cohort,
      cs.size,
      coalesce(jsonb_agg(
        jsonb_build_object(
          'week_offset', cc.week_offset,
          'users', cc.users,
          'pct', round((cc.users::numeric / nullif(cs.size, 0)) * 100, 1)
        ) order by cc.week_offset
      ) filter (where cc.week_offset is not null), '[]'::jsonb) as weeks
    from cohort_size cs
    left join cohort_cells cc on cc.cohort = cs.cohort
    group by cs.cohort, cs.size
  ),
  top_events as (
    select name, count(*) as c, count(distinct client_id) as clients
    from win_e group by name order by count(*) desc limit 30
  ),
  by_day as (
    select d.day, count(e.id) as count
    from (
      select generate_series(
        (current_date - ((select days from win) - 1) * interval '1 day')::date,
        current_date, interval '1 day')::date as day
    ) d
    left join win_e e on e.created_at::date = d.day
    group by d.day order by d.day
  ),
  ui_clicks as (
    select
      props->>'target' as target,
      coalesce(props->>'screen', 'unknown') as screen,
      count(*) as c,
      count(distinct client_id) as clients,
      max(created_at) as last_seen
    from win_e
    where name = 'ui_click' and nullif(props->>'target', '') is not null
    group by 1, 2
    order by count(*) desc
    limit 200
  ),
  providers as (
    select coalesce(props->>'provider', 'unknown') as provider, count(*) as c
    from win_e where name = 'navigate_clicked'
    group by 1 order by count(*) desc limit 10
  )
  select jsonb_build_object(
    'window_days', (select days from win),
    -- How long the dashboard has actually been watching. Without this, an
    -- unused feature and an unobserved one look identical.
    'tracking', jsonb_build_object(
      'first_event_at', (select min(created_at) from f_events),
      'first_click_at', (select min(created_at) from f_events where name = 'ui_click'),
      'ui_clicks',      (select count(*) from win_e where name = 'ui_click'),
      -- Age is computed here rather than in the browser: the server owns the
      -- clock, and Date.now() in a React render is impure (unstable across
      -- re-renders, and the compiler rejects it).
      'hours_tracked',  (select round(extract(epoch from (now() - min(created_at))) / 3600.0, 1)
                           from f_events where name = 'ui_click')
    ),
    'totals', jsonb_build_object(
      'events',   (select count(*) from win_e),
      'clients',  (select count(distinct client_id) from win_e where client_id is not null),
      'sessions', (select count(distinct session_id) from win_e where session_id is not null)
    ),
    'funnel', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'step', step, 'name', name, 'label', label, 'clients', clients,
        'pct_of_top', case when top > 0
                           then round((clients::numeric / top) * 100, 1)
                           else 0 end
      ) order by step), '[]') from funnel_rows
    ),
    'retention', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'cohort', cohort, 'size', size, 'weeks', weeks
      ) order by cohort desc), '[]') from retention
    ),
    'top_events', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', name, 'count', c, 'clients', clients
      ) order by c desc), '[]') from top_events
    ),
    'events_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'count', count) order by day), '[]')
      from by_day
    ),
    'ui_clicks', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'target', target, 'screen', screen, 'count', c,
        'clients', clients, 'last_seen', last_seen
      ) order by c desc), '[]') from ui_clicks
    ),
    'navigate_providers', (
      select coalesce(jsonb_agg(jsonb_build_object('provider', provider, 'count', c) order by c desc), '[]')
      from providers
    )
  );
$function$;

revoke all on function public.admin_event_analytics(integer, text[])
  from public, anon, authenticated;
grant execute on function public.admin_event_analytics(integer, text[])
  to service_role, postgres;
