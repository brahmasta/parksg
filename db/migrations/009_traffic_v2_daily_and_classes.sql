-- Migration: admin_traffic_analytics v2 — three-way classification, daily
--            averages, and per-day series split by class
--
-- Replaces the v1 function from 007. Three defects made v1's numbers wrong, and
-- one product requirement was missing.
--
-- DEFECT 1 — the classifier was being dismantled by the app's own telemetry.
--   v1 exempted a client from `likely_automated` if it fired ANY app_event
--   other than app_open. But `carpark_viewed` and `results_viewed` auto-fire on
--   deep-link cold loads (/carpark/:slug and /parking-near/:area), with no user
--   gesture at all. Crawlers demonstrably execute JS here — they are in
--   `visits`, and only client JS writes that table — so every crawler hitting a
--   SEO route would have been promoted to "human" within days.
--   Fix: `actors` now counts only genuinely user-initiated event names, and
--   skips any event the client tagged `auto: true`.
--
-- DEFECT 2 — "searched" was contaminated by those same auto-fired searches.
--   /parking-near/:area resolves a destination on load, which calls
--   recordSearch(). Measured over 30 days: of 349 clients with a search_events
--   row, 227 had ONLY ever hit /parking-near/ deep links and 110 were
--   direct + single-visit + never saw the home screen. Just 68 searchers ever
--   reached the home screen. v1 exempted all 349 from automation on the
--   strength of that search, then counted them in the funnel's "Searched"
--   step.
--   Fix: a search no longer exempts a client on its own. It must be corroborated
--   by a real human signal, or be a user-initiated `search_submitted` event.
--
-- DEFECT 3 — day bucketing was absent, and would have been wrong if added
--   naively. The DB session runs UTC; the audience is Singapore. Bucketing on
--   created_at::date would have split every SGT day at 08:00 local. And v1's
--   window is rolling (`created_at > now() - N days`), so its oldest day is a
--   fragment — averaging over it understates every per-day figure.
--   Fix: buckets are SGT calendar dates, the window is calendar-bounded, and
--   averages divide by COMPLETE days only (today is excluded from the mean but
--   still returned in the series so the chart shows it).
--
-- NEW — three-way classification instead of human-vs-bot.
--   A binary forces a verdict on traffic that genuinely is ambiguous: someone
--   who taps a Google result, lands on /carpark/x, reads the rate and leaves is
--   indistinguishable from a crawler by behaviour alone — and for this app that
--   visit is a SUCCESS, not a bounce. So:
--     person     positive human signal: reached the home screen, came back,
--                signed in, or took a user-initiated action.
--     automated  direct referrer + deep path only + one visit + no human
--                signal. The crawler signature.
--     uncertain  everything else — mostly search-engine deep landings that
--                read a page and left. Reported, never silently merged.
--
-- Signature is unchanged, so `create or replace` genuinely replaces v1 rather
-- than creating an overload. Do NOT add a parameter without dropping first:
-- PostgREST cannot choose between overloads and every call would 502.
--
-- Apply via the Supabase SQL editor, psql, or the MCP apply_migration.

create or replace function public.admin_traffic_analytics(
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
  -- Everything is bucketed on Singapore calendar dates, not UTC.
  sg as (select (now() at time zone 'Asia/Singapore')::date as today),
  bounds as (
    select (select today from sg) - ((select days from win) - 1) as first_day,
           (select today from sg) as last_day
  ),
  cal as (
    select generate_series((select first_day from bounds),
                           (select last_day from bounds),
                           interval '1 day')::date as day
  ),
  -- Today is in-flight: it belongs in the chart but must not drag the mean down.
  cal_full as (select day from cal where day < (select today from sg)),
  n_full as (select greatest(count(*), 1) as n from cal_full),

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

  -- Calendar-bounded source sets, each carrying its SGT day -------------------
  v_all as (
    select v.*, (v.created_at at time zone 'Asia/Singapore')::date as sg_day
    from public.visits v
    where (v.created_at at time zone 'Asia/Singapore')::date
            between (select first_day from bounds) and (select last_day from bounds)
      and v.client_id is not null
      and v.client_id not in (select client_id from excl_clients)
      and (v.user_id is null or v.user_id not in (select id from excl_users))
  ),
  s_all as (
    select s.*, (s.created_at at time zone 'Asia/Singapore')::date as sg_day
    from public.search_events s
    where (s.created_at at time zone 'Asia/Singapore')::date
            between (select first_day from bounds) and (select last_day from bounds)
      and s.client_id is not null
      and s.client_id not in (select client_id from excl_clients)
  ),
  e_all as (
    select e.*, (e.created_at at time zone 'Asia/Singapore')::date as sg_day
    from public.app_events e
    where (e.created_at at time zone 'Asia/Singapore')::date
            between (select first_day from bounds) and (select last_day from bounds)
      and e.client_id is not null
      and e.client_id not in (select client_id from excl_clients)
      and (e.user_id is null or e.user_id not in (select id from excl_users))
  ),

  -- Signals -------------------------------------------------------------------
  searchers as (select distinct client_id from s_all),
  -- Only gestures. app_open / carpark_viewed / results_viewed are excluded
  -- outright because all three can fire without anyone touching anything, and
  -- `auto` drops the tagged ones belt-and-braces.
  actors as (
    select distinct client_id from e_all
    where name in (
      'ui_click', 'navigate_clicked', 'carpark_saved', 'destination_saved',
      'filter_applied', 'view_mode_changed', 'stay_planner_used',
      'checkin_submitted', 'inaccuracy_reported', 'carpark_add_started',
      'carpark_add_submitted', 'edit_suggested', 'sign_in_started',
      'sign_in_completed', 'install_accepted', 'search_submitted'
    )
    and coalesce(props->>'auto', '') <> 'true'
  ),
  client_facts as (
    select
      v.client_id,
      count(*)                                         as visits,
      bool_or(v.path is null or v.path = '/')          as ever_root,
      bool_or(v.user_id is not null)                   as signed_in,
      (array_agg(public.traffic_source_bucket(v.referrer) order by v.created_at))[1] as source,
      (array_agg(coalesce(v.device,'unknown') order by v.created_at))[1]             as device
    from v_all v group by v.client_id
  ),
  classified as (
    select
      cf.*,
      (cf.client_id in (select client_id from searchers)) as searched,
      (cf.client_id in (select client_id from actors))    as acted,
      case
        -- A positive signal that a person is present.
        when cf.ever_root
          or cf.visits > 1
          or cf.signed_in
          or cf.client_id in (select client_id from actors)
          then 'person'
        -- The crawler signature: arrived direct, straight to a deep page, once,
        -- did nothing.
        when cf.source = 'direct' and cf.visits = 1
          then 'automated'
        -- Mostly search-engine deep landings. Could be a person who read the
        -- rate and left happy; could be a bot. Never merged into either.
        else 'uncertain'
      end as class
    from client_facts cf
  ),
  people as (select * from classified where class = 'person'),
  bots   as (select * from classified where class = 'automated'),

  -- Per-day series, split by class -------------------------------------------
  day_people as (
    select c.day,
      count(distinct v.client_id) as dau,
      count(v.id)                 as visits
    from cal c
    left join v_all v on v.sg_day = c.day
                     and v.client_id in (select client_id from people)
    group by c.day
  ),
  day_bots as (
    select c.day,
      count(distinct v.client_id) as dau,
      count(v.id)                 as visits
    from cal c
    left join v_all v on v.sg_day = c.day
                     and v.client_id in (select client_id from bots)
    group by c.day
  ),
  day_searches as (
    select c.day, count(s.id) as searches
    from cal c
    left join s_all s on s.sg_day = c.day
                     and s.client_id in (select client_id from people)
    group by c.day
  ),

  -- Funnel, over the INSTRUMENTED cohort only ---------------------------------
  -- app_events began on a specific date; visits and search_events go back
  -- months. Measuring steps 1-2 against all history and steps 3-5 against
  -- app_events produced a "-341 dropped off" that described missing data, not
  -- abandonment. The denominator is now clients that actually emitted an
  -- app_open, so every step is measured over the same population.
  instr as (
    select client_id from e_all where name = 'app_open'
    group by client_id
  ),
  instr_people as (
    select i.client_id from instr i
    where i.client_id in (select client_id from people)
  ),
  fx as (
    select
      e.client_id,
      min(e.created_at) filter (where e.name = 'app_open')         as s1,
      min(e.created_at) filter (where e.name = 'search_submitted'
                                  and coalesce(e.props->>'auto','') <> 'true') as s2,
      min(e.created_at) filter (where e.name = 'results_viewed'
                                  and coalesce(e.props->>'auto','') <> 'true') as s3,
      min(e.created_at) filter (where e.name = 'carpark_viewed'
                                  and coalesce(e.props->>'auto','') <> 'true') as s4,
      min(e.created_at) filter (where e.name = 'navigate_clicked')             as s5
    from e_all e
    where e.client_id in (select client_id from instr_people)
    group by e.client_id
  ),
  reach as (
    select
      count(*)                                                          as r1,
      count(*) filter (where s2 >= s1)                                  as r2,
      count(*) filter (where s2 >= s1 and s3 >= s2)                     as r3,
      count(*) filter (where s2 >= s1 and s3 >= s2 and s4 >= s3)        as r4,
      count(*) filter (where s2 >= s1 and s3 >= s2 and s4 >= s3
                         and s5 >= s4)                                  as r5,
      -- The SEO journey a strict funnel cannot see: landed on a carpark page
      -- and navigated, without ever searching.
      count(*) filter (where s2 is null and s4 is not null)             as direct_to_carpark,
      count(*) filter (where s2 is null and s5 is not null)             as direct_to_navigate
    from fx
  ),
  steps as (
    select * from (values
      (1, 'Opened the app'),
      (2, 'Searched a destination'),
      (3, 'Saw results'),
      (4, 'Opened a carpark'),
      (5, 'Used navigation')
    ) as t(step, label)
  ),
  funnel_rows as (
    select st.step, st.label,
      case st.step when 1 then r.r1 when 2 then r.r2 when 3 then r.r3
                   when 4 then r.r4 else r.r5 end as clients,
      r.r1 as top
    from steps st cross join reach r
  ),

  -- Sources --------------------------------------------------------------------
  sources as (
    select
      source,
      count(*)                                      as clients,
      sum(visits)                                   as visits,
      count(*) filter (where class = 'person')      as person,
      count(*) filter (where class = 'automated')   as automated,
      count(*) filter (where class = 'uncertain')   as uncertain,
      count(*) filter (where class = 'person' and searched) as searched,
      round(100.0 * count(*) filter (where class = 'person' and searched)
            / nullif(count(*) filter (where class = 'person'), 0), 1) as pct_person_searched
    from classified group by source
  ),

  -- 7-day return rate, people only ---------------------------------------------
  all_activity as (
    select client_id, created_at from public.visits
      where client_id is not null and client_id not in (select client_id from excl_clients)
    union all
    select client_id, created_at from public.app_events
      where client_id is not null and client_id not in (select client_id from excl_clients)
  ),
  first_ever as (
    select client_id, min(created_at) as t0 from all_activity group by client_id
  ),
  eligible as (
    select f.client_id, f.t0 from first_ever f, win
    where f.t0 <= now() - interval '7 days'
      and f.t0 >  now() - (win.days * interval '1 day')
      and f.client_id in (select client_id from people)
  ),
  returned as (
    select distinct e.client_id
    from eligible e
    join all_activity a
      on a.client_id = e.client_id
     and a.created_at >  e.t0 + interval '30 minutes'
     and a.created_at <= e.t0 + interval '7 days'
  )

  select jsonb_build_object(
    'window_days', (select days from win),
    'first_day', (select first_day from bounds),
    'last_day',  (select last_day from bounds),
    'complete_days', (select n from n_full),
    'instrumented_since', (select min(created_at)::date from e_all),

    -- Headline: per-day averages over complete days, people only.
    'people', jsonb_build_object(
      'clients',      (select count(*) from people),
      'engaged',      (select count(*) from people where searched or acted),
      'avg_dau',      (select round(avg(dau)::numeric, 1) from day_people
                        where day in (select day from cal_full)),
      'avg_visits',   (select round(avg(visits)::numeric, 1) from day_people
                        where day in (select day from cal_full)),
      'avg_searches', (select round(avg(searches)::numeric, 1) from day_searches
                        where day in (select day from cal_full)),
      'total_visits', (select coalesce(sum(visits), 0) from people),
      'total_searches', (select count(*) from s_all
                          where client_id in (select client_id from people))
    ),

    'bots', jsonb_build_object(
      'clients',    (select count(*) from bots),
      'avg_dau',    (select round(avg(dau)::numeric, 1) from day_bots
                      where day in (select day from cal_full)),
      'avg_visits', (select round(avg(visits)::numeric, 1) from day_bots
                      where day in (select day from cal_full)),
      'total_visits', (select coalesce(sum(visits), 0) from bots)
    ),

    'uncertain', jsonb_build_object(
      'clients',      (select count(*) from classified where class = 'uncertain'),
      'total_visits', (select coalesce(sum(visits), 0) from classified where class = 'uncertain')
    ),

    -- Raw, unclassified totals — kept so the split always reconciles.
    'totals', jsonb_build_object(
      'clients',    (select count(*) from classified),
      'page_loads', (select count(*) from v_all),
      'searches',   (select count(*) from s_all),
      'events',     (select count(*) from e_all)
    ),

    'series', jsonb_build_object(
      'people_dau',      (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'value', dau)    order by day), '[]') from day_people),
      'people_visits',   (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'value', visits) order by day), '[]') from day_people),
      'people_searches', (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'value', searches) order by day), '[]') from day_searches),
      'bot_visits',      (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'value', visits) order by day), '[]') from day_bots)
    ),

    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'source', source, 'clients', clients, 'visits', visits,
        'person', person, 'automated', automated, 'uncertain', uncertain,
        'searched', searched, 'pct_person_searched', coalesce(pct_person_searched, 0)
      ) order by clients desc), '[]') from sources
    ),

    'funnel', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'step', step, 'label', label, 'clients', clients,
        'pct', case when top > 0 then round((clients::numeric / top) * 100, 1) else 0 end
      ) order by step), '[]') from funnel_rows
    ),
    -- What the funnel is measured over, so the UI can say so instead of
    -- implying that un-instrumented clients abandoned.
    'funnel_basis', jsonb_build_object(
      'cohort', (select count(*) from instr_people),
      'since',  (select min(created_at)::date from e_all),
      'direct_to_carpark',  (select direct_to_carpark from reach),
      'direct_to_navigate', (select direct_to_navigate from reach)
    ),

    'return_7d', jsonb_build_object(
      'eligible', (select count(*) from eligible),
      'returned', (select count(*) from returned),
      'pct', round(100.0 * (select count(*) from returned)
                   / nullif((select count(*) from eligible), 0), 1)
    ),

    'device', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'device', device, 'person', person, 'automated', automated, 'uncertain', uncertain
      ) order by person desc), '[]')
      from (
        select device,
               count(*) filter (where class = 'person')    as person,
               count(*) filter (where class = 'automated') as automated,
               count(*) filter (where class = 'uncertain') as uncertain
        from classified group by device
      ) d
    )
  );
$function$;

grant execute on function public.admin_traffic_analytics(integer, text[])
  to service_role, postgres;
