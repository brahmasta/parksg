-- Migration: admin_traffic_analytics — audited visitor definitions, traffic
--            sources, conversion and 7-day return rate
--
-- WHY THIS EXISTS
--
-- The dashboard's "Active users" tile counts distinct client_id in `visits`.
-- That is really "unique browsers that loaded a page", and an audit of 30 days
-- of production data showed it is dominated by automated traffic:
--
--   * 95% of clients (5,715 / 6,024) visit exactly once.
--   * 5,055 of 5,364 "direct" visits land on a DEEP path (/carpark/<slug>,
--     /parking-near/<area>) rather than "/". Humans do not type carpark slugs.
--   * Clients that landed on "/" searched 35.6% of the time; clients that only
--     ever hit a deep path searched 4.8% of the time.
--   * Desktop outnumbers mobile on a phone-first app used in a car.
--
-- Those deep-path, single-page, never-interacting, direct-referrer clients are
-- crawlers indexing the SSR/SEO routes added for search visibility. They are a
-- sign the SEO work is landing — but counting them as "active users" overstates
-- the real audience by roughly 6x.
--
-- So this function reports three distinct populations instead of one number:
--
--   visitors        every client that loaded a page (the old "active users")
--   likely_automated  direct referrer + deep path only + single visit + never
--                     interacted. Conservative: any one human signal exempts.
--   humans          visitors - likely_automated
--   engaged         humans that took a real action (search / any app_event
--                   beyond app_open / check-in). The honest "active users".
--
-- It also answers, keyed on the anonymous client_id (there is no registration,
-- so email is not a usable identity here):
--
--   sources    search engine vs direct vs AI assistant vs social, each with
--              how well that source actually converts
--   funnel     visitor -> searched -> opened a carpark -> navigated
--   return_7d  % of clients that came back within 7 days of first being seen
--
-- NOTE ON THE LAST TWO FUNNEL STEPS: "opened a carpark" and "navigated" read
-- from app_events (migration 005), which starts empty. They report 0 until the
-- client instrumentation ships and traffic flows. Every other metric here is
-- computed from existing visits/search_events history and is live immediately.
--
-- Apply via the Supabase SQL editor, psql, or the MCP apply_migration.

-- Bucket a referrer hostname into a traffic source. Kept as its own immutable
-- function so the dashboard, and any ad-hoc query, classify identically.
create or replace function public.traffic_source_bucket(p_referrer text)
returns text
language sql
immutable
as $function$
  select case
    when p_referrer is null or p_referrer = '' or p_referrer = 'direct' then 'direct'
    when p_referrer = 'internal' then 'internal'
    when p_referrer ~ '(^|\.)(google|bing|yahoo|duckduckgo|ecosia|startpage|brave|qwant|baidu|yandex|naver|seznam|mojeek|lycos|ask)\.' then 'search_engine'
    when p_referrer ~ 'googlequicksearchbox|search\.' then 'search_engine'
    when p_referrer ~ '(chatgpt|openai|perplexity|copilot\.microsoft|claude\.ai|gemini\.google|you\.com|phind)' then 'ai_assistant'
    when p_referrer ~ '(reddit|facebook|instagram|twitter|^t\.co$|^x\.com$|tiktok|linkedin|telegram|whatsapp|pinterest)' then 'social'
    else 'other'
  end;
$function$;

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
  v_all as (
    select v.* from public.visits v, win
    where v.created_at > now() - (win.days * interval '1 day')
      and v.client_id is not null
      and v.client_id not in (select client_id from excl_clients)
      and (v.user_id is null or v.user_id not in (select id from excl_users))
  ),
  s_all as (
    select s.* from public.search_events s, win
    where s.created_at > now() - (win.days * interval '1 day')
      and s.client_id is not null
      and s.client_id not in (select client_id from excl_clients)
  ),
  e_all as (
    select e.* from public.app_events e, win
    where e.created_at > now() - (win.days * interval '1 day')
      and e.client_id is not null
      and e.client_id not in (select client_id from excl_clients)
  ),

  -- One row per client, with every signal needed to classify it --------------
  searchers as (select distinct client_id from s_all),
  -- app_open alone is passive (it fires on load); anything else is a real act.
  actors    as (select distinct client_id from e_all where name <> 'app_open'),
  client_facts as (
    select
      v.client_id,
      count(*)                                                as visits,
      min(v.created_at)                                       as t0,
      bool_or(v.path is null or v.path = '/')                 as ever_root,
      -- First-touch source: the referrer on the earliest visit in the window.
      (array_agg(public.traffic_source_bucket(v.referrer)
                 order by v.created_at))[1]                   as source,
      bool_or(v.user_id is not null)                          as signed_in,
      (array_agg(coalesce(v.device,'unknown')
                 order by v.created_at))[1]                   as device
    from v_all v
    group by v.client_id
  ),
  classified as (
    select
      cf.*,
      (cf.client_id in (select client_id from searchers)) as searched,
      (cf.client_id in (select client_id from actors))    as acted,
      -- Conservative automation heuristic: flag ONLY when every signal points
      -- that way at once. A single visit that reached the home screen, or
      -- searched, or came from a search engine, or signed in, is never flagged.
      (
            cf.source = 'direct'
        and cf.ever_root = false
        and cf.visits = 1
        and cf.signed_in = false
        and cf.client_id not in (select client_id from searchers)
        and cf.client_id not in (select client_id from actors)
      ) as likely_automated
    from client_facts cf
  ),
  humans as (select * from classified where not likely_automated),

  -- Traffic sources ----------------------------------------------------------
  sources as (
    select
      source,
      count(*)                                            as clients,
      sum(visits)                                         as visits,
      count(*) filter (where likely_automated)            as automated,
      count(*) filter (where not likely_automated)        as human,
      count(*) filter (where searched)                    as searched,
      round(100.0 * count(*) filter (where searched)
            / nullif(count(*) filter (where not likely_automated), 0), 1) as pct_human_searched
    from classified group by source
  ),

  -- Conversion funnel over humans only ---------------------------------------
  h_total   as (select count(*) c from humans),
  h_search  as (select count(*) c from humans where searched),
  h_carpark as (
    select count(distinct client_id) c from e_all
    where name = 'carpark_viewed'
      and client_id in (select client_id from humans)
  ),
  h_nav as (
    select count(distinct client_id) c from e_all
    where name = 'navigate_clicked'
      and client_id in (select client_id from humans)
  ),

  -- 7-day return rate --------------------------------------------------------
  -- Keyed on the anonymous client_id, because nobody registers. Only clients
  -- first seen at least 7 days ago are eligible, so the denominator excludes
  -- people who simply have not had time to come back yet.
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
      -- Same automation filter, so the return rate describes humans.
      and f.client_id in (select client_id from humans)
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

    -- Every population side by side, with the definition spelled out so the
    -- dashboard can show what each number actually means.
    'populations', jsonb_build_object(
      'visitors',         (select count(*) from classified),
      'likely_automated', (select count(*) from classified where likely_automated),
      'humans',           (select c from h_total),
      'engaged',          (select count(*) from humans where searched or acted),
      'page_loads',       (select count(*) from v_all),
      'human_page_loads', (select coalesce(sum(visits),0) from humans),
      'searches',         (select count(*) from s_all),
      'distinct_searchers', (select count(*) from searchers)
    ),

    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'source', source, 'clients', clients, 'visits', visits,
        'automated', automated, 'human', human,
        'searched', searched, 'pct_human_searched', coalesce(pct_human_searched, 0)
      ) order by clients desc), '[]') from sources
    ),

    -- visitor -> searched -> opened a carpark -> navigated, humans only.
    'funnel', jsonb_build_array(
      jsonb_build_object('step', 1, 'label', 'Human visitors',
        'clients', (select c from h_total), 'pct', 100.0),
      jsonb_build_object('step', 2, 'label', 'Searched a destination',
        'clients', (select c from h_search),
        'pct', round(100.0 * (select c from h_search) / nullif((select c from h_total),0), 1)),
      jsonb_build_object('step', 3, 'label', 'Opened a carpark',
        'clients', (select c from h_carpark),
        'pct', round(100.0 * (select c from h_carpark) / nullif((select c from h_total),0), 1)),
      jsonb_build_object('step', 4, 'label', 'Used navigation',
        'clients', (select c from h_nav),
        'pct', round(100.0 * (select c from h_nav) / nullif((select c from h_total),0), 1))
    ),

    'return_7d', jsonb_build_object(
      'eligible', (select count(*) from eligible),
      'returned', (select count(*) from returned),
      'pct', round(100.0 * (select count(*) from returned)
                   / nullif((select count(*) from eligible), 0), 1)
    ),

    'device', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'device', device, 'human', human, 'automated', automated
      ) order by human desc), '[]')
      from (
        select device,
               count(*) filter (where not likely_automated) as human,
               count(*) filter (where likely_automated)     as automated
        from classified group by device
      ) d
    )
  );
$function$;

grant execute on function public.admin_traffic_analytics(integer, text[])
  to service_role, postgres;
