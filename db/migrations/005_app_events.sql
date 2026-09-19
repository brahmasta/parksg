-- Migration: app_events — a generic, self-hosted product-analytics event log
--
-- The existing visits / search_events tables answer "how many people, on what
-- device, from where". They can't answer "of the people who searched, how many
-- opened a carpark, and how many actually navigated there" — because there is
-- no single stream of named, ordered user actions to walk.
--
-- app_events is that stream. One row per meaningful user action, keyed by the
-- anonymous client_id already used for DAU, plus a rolling session_id so a
-- funnel can be scoped to a single sitting. Arbitrary per-event detail lives in
-- `props` (jsonb) so adding a new event never needs a migration.
--
-- Writes go through SECURITY DEFINER RPCs granted to anon (same pattern as
-- record_visit / record_search / submit_carpark_edit): the table is RLS-locked,
-- so the browser can only append through the narrow functions below, and can
-- never read the log back. Reads are admin-only via the service-role key.
--
-- Apply via the Supabase SQL editor, psql, or the MCP apply_migration.

create table if not exists public.app_events (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  name       text not null,                      -- 'search_submitted', 'navigate_clicked', …
  client_id  text,                               -- anonymous browser id (psg.cid)
  user_id    text,                               -- Google sub when signed in, else null
  session_id text,                               -- rolling 30-min session
  device     text,                               -- mobile | tablet | desktop
  props      jsonb not null default '{}'::jsonb  -- free-form, size-capped below
);

alter table public.app_events enable row level security;
-- No anon/authenticated policies: inserts go through the RPCs below, reads use
-- the service-role key (which bypasses RLS).

-- Funnel/retention queries scan by name within a date window, and group by
-- client. These three cover every access path in admin_event_analytics.
create index if not exists app_events_created_idx
  on public.app_events (created_at desc);
create index if not exists app_events_name_created_idx
  on public.app_events (name, created_at desc);
create index if not exists app_events_client_created_idx
  on public.app_events (client_id, created_at)
  where client_id is not null;

-- ── Shared validation ────────────────────────────────────────────────────────
-- Event names are lowercase snake_case, <= 40 chars. Anything else is a bug or
-- an abuse attempt; both should be dropped rather than stored.
create or replace function public.clean_event_name(p_name text)
returns text
language sql
immutable
as $function$
  select case
    when p_name ~ '^[a-z][a-z0-9_]{0,39}$' then p_name
    else null
  end;
$function$;

-- Props are advisory detail, never trusted input. Anything that isn't a JSON
-- object, or that serialises beyond 2KB, collapses to '{}' rather than
-- rejecting the event — losing a label is better than losing the event.
create or replace function public.clean_event_props(p_props jsonb)
returns jsonb
language sql
immutable
as $function$
  select case
    when p_props is null then '{}'::jsonb
    when jsonb_typeof(p_props) <> 'object' then '{}'::jsonb
    when length(p_props::text) > 2000 then '{}'::jsonb
    else p_props
  end;
$function$;

-- ── Single-event append (anon-callable, SECURITY DEFINER) ────────────────────
create or replace function public.record_event(
  p_name       text,
  p_client_id  text default null,
  p_user_id    text default null,
  p_session_id text default null,
  p_device     text default null,
  p_props      jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text := public.clean_event_name(nullif(trim(p_name), ''));
begin
  -- Unknown/malformed name: drop silently. The client is fire-and-forget and
  -- has nothing useful to do with an error here.
  if v_name is null then
    return;
  end if;

  insert into public.app_events (name, client_id, user_id, session_id, device, props)
  values (
    v_name,
    left(nullif(trim(p_client_id), ''), 64),
    left(nullif(trim(p_user_id), ''), 64),
    left(nullif(trim(p_session_id), ''), 64),
    left(nullif(trim(p_device), ''), 16),
    public.clean_event_props(p_props)
  );
end;
$function$;

-- ── Batch append (anon-callable, SECURITY DEFINER) ───────────────────────────
-- The client buffers events and flushes on pagehide/visibilitychange, so the
-- common case is several events in one request. p_events is an array of
-- { name, props?, ts? } objects; client/user/session/device are per-flush and
-- passed once. Malformed entries are skipped, never fatal. Capped at 50 rows
-- to bound a pathological payload.
create or replace function public.record_events(
  p_events     jsonb,
  p_client_id  text default null,
  p_user_id    text default null,
  p_session_id text default null,
  p_device     text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    return;
  end if;

  insert into public.app_events (name, client_id, user_id, session_id, device, props, created_at)
  select
    public.clean_event_name(nullif(trim(e->>'name'), '')),
    left(nullif(trim(p_client_id), ''), 64),
    left(nullif(trim(p_user_id), ''), 64),
    left(nullif(trim(p_session_id), ''), 64),
    left(nullif(trim(p_device), ''), 16),
    public.clean_event_props(e->'props'),
    -- Trust the client's timestamp only when it is sane: within the last hour
    -- and not in the future. Otherwise stamp it at arrival. A buffered event
    -- can legitimately be a few minutes old by the time it flushes.
    coalesce(
      (select t from (select (e->>'ts')::timestamptz as t) s
        where t between now() - interval '1 hour' and now() + interval '1 minute'),
      now()
    )
  from (select e from jsonb_array_elements(p_events) e limit 50) s
  where public.clean_event_name(nullif(trim(e->>'name'), '')) is not null;
exception
  -- A bad ts cast on one row must not lose the whole flush.
  when others then
    return;
end;
$function$;

grant execute on function public.record_event(text, text, text, text, text, jsonb)
  to anon, authenticated, service_role;
grant execute on function public.record_events(jsonb, text, text, text, text)
  to anon, authenticated, service_role;
