-- Migration: admin_event_analytics — funnel, retention and event breakdowns
--
-- The companion read-side for app_events (005). admin_analytics answers "how
-- many / what device / from where"; this answers "what did people actually do,
-- in what order, and did they come back".
--
-- Three things it computes that the existing dashboard cannot:
--
--   funnel     An ORDERED first-touch funnel over the core journey
--              app_open -> search_submitted -> results_viewed -> carpark_viewed
--              -> navigate_clicked. A client counts at step N only if it also
--              reached every earlier step, and did so no later than step N --
--              so someone who deep-links straight into a carpark detail does
--              not inflate the "searched" step.
--
--   retention  Weekly cohorts by anonymous client_id. Activity is drawn from
--              visits UNION app_events, so retention is meaningful from the
--              day this ships rather than needing weeks of new event history.
--
--   top_events Raw event counts + reach (distinct clients), so a new event
--              added client-side shows up here with no migration.
--
-- Mirrors admin_analytics' p_exclude_emails contract: the admin's own user_id
-- and every client_id ever associated with it drop out of every metric.
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

  -- Admin exclusion (same contract as admin_analytics) ------------------------
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
  -- Project only the event columns: joining `win` would otherwise leak its
  -- `days` column into every downstream `select *`.
  win_e as (
    select e.* from f_events e, win
    where e.created_at > now() - (win.days * interval '1 day')
  ),

  -- Ordered first-touch funnel ------------------------------------------------
  -- One row per client with the first time it hit each step in the window.
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
  -- Walk the steps: each level requires the previous one to exist and to have
  -- happened no later than this one. A null timestamp makes the comparison
  -- null, which the filter drops -- exactly the wanted behaviour.
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

  -- Weekly retention cohorts --------------------------------------------------
  -- visits carries months of history; app_events starts empty. Unioning them
  -- means the cohort grid is populated on day one.
  activity as (
    select client_id, created_at from f_visits where client_id is not null
    union all
    select client_id, created_at from f_events where client_id is not null
  ),
  first_seen as (
    select client_id, min(created_at) as t0 from activity group by client_id
  ),
  -- Eight most recent cohorts.
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
      -- date - date yields an integer number of days, so divide rather than
      -- pulling an epoch out of an interval.
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

  -- Breakdowns ----------------------------------------------------------------
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
  -- Every control the delegated click tracker saw, most-pressed first. The
  -- point of this list is as much what is MISSING from it as what tops it: a
  -- feature that never appears here is a feature nobody is using.
  ui_clicks as (
    select
      props->>'target' as target,
      coalesce(props->>'screen', 'unknown') as screen,
      count(*) as c,
      count(distinct client_id) as clients
    from win_e
    where name = 'ui_click' and nullif(props->>'target', '') is not null
    group by 1, 2
    order by count(*) desc
    limit 60
  ),
  -- Which maps app the navigate hand-off actually goes to.
  providers as (
    select coalesce(props->>'provider', 'unknown') as provider, count(*) as c
    from win_e where name = 'navigate_clicked'
    group by 1 order by count(*) desc limit 10
  )

  select jsonb_build_object(
    'window_days', (select days from win),
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
        'target', target, 'screen', screen, 'count', c, 'clients', clients
      ) order by c desc), '[]') from ui_clicks
    ),
    'navigate_providers', (
      select coalesce(jsonb_agg(jsonb_build_object('provider', provider, 'count', c) order by c desc), '[]')
      from providers
    )
  );
$function$;

grant execute on function public.admin_event_analytics(integer, text[])
  to service_role, postgres;
