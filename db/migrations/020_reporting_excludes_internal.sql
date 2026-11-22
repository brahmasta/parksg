-- Migration: a `reporting` schema whose views leave out the owner's own activity
--
-- The weekly product brief reads search_events / app_events / visits with its
-- own SQL. The owner's testing lands in those tables like anyone's traffic and
-- skews small numbers: in the week of 2026-11-02 one device ran the same two
-- queries 22 times, 6% of all searches, and topped the destination list.
--
-- The admin_* RPCs already take p_exclude_emails (001), but that only helps
-- callers of those RPCs. This gives ad-hoc SQL the same filter as plain views:
-- read reporting.search_events instead of public.search_events and the
-- internal rows are gone.
--
-- Who counts as internal lives in two small tables, filled by hand and NOT by
-- this migration, so no email address or device id is committed to the repo:
--
--   insert into reporting.internal_accounts (email, note)
--   values ('owner@example.com', 'owner');
--
--   -- optional: a test device that never signed in
--   insert into reporting.internal_devices (client_id, note)
--   values ('<client_id>', 'test phone');
--
-- Same reach as 001: an internal account's user_id, plus every client_id that
-- account was ever seen on (so its signed-out browsing on the same device is
-- left out too).
--
-- Access: `reporting` is not in the PostgREST exposed schemas and anon /
-- authenticated get no USAGE on it, so none of this is reachable with the
-- public anon key. It is read with the service role or as postgres (the SQL
-- editor, the Supabase MCP). The public tables and the app are untouched.
--
-- Apply via the Supabase SQL editor, psql, or the MCP apply_migration.

create schema if not exists reporting;

revoke all on schema reporting from public, anon, authenticated;
grant usage on schema reporting to service_role;

create table if not exists reporting.internal_accounts (
  email    text primary key check (email = lower(email)),
  note     text,
  added_at timestamptz not null default now()
);

create table if not exists reporting.internal_devices (
  client_id text primary key,
  note      text,
  added_at  timestamptz not null default now()
);

create or replace view reporting.internal_users as
  select p.id as user_id
  from public.profiles p
  join reporting.internal_accounts a on lower(p.email) = a.email;

create or replace view reporting.internal_clients as
  select client_id from reporting.internal_devices
  union
  select client_id from public.visits
   where client_id is not null and user_id in (select user_id from reporting.internal_users)
  union
  select client_id from public.search_events
   where client_id is not null and user_id in (select user_id from reporting.internal_users)
  union
  select client_id from public.app_events
   where client_id is not null and user_id in (select user_id from reporting.internal_users);

create or replace view reporting.search_events as
  select s.* from public.search_events s
  where (s.user_id   is null or s.user_id   not in (select user_id   from reporting.internal_users))
    and (s.client_id is null or s.client_id not in (select client_id from reporting.internal_clients));

create or replace view reporting.app_events as
  select e.* from public.app_events e
  where (e.user_id   is null or e.user_id   not in (select user_id   from reporting.internal_users))
    and (e.client_id is null or e.client_id not in (select client_id from reporting.internal_clients));

create or replace view reporting.visits as
  select v.* from public.visits v
  where (v.user_id   is null or v.user_id   not in (select user_id   from reporting.internal_users))
    and (v.client_id is null or v.client_id not in (select client_id from reporting.internal_clients));

create or replace view reporting.saved_carparks as
  select s.* from public.saved_carparks s
  where s.user_id not in (select user_id from reporting.internal_users);

revoke all on all tables in schema reporting from public, anon, authenticated;
grant select on all tables in schema reporting to service_role;

-- Verify (expect no rows: anon and authenticated hold nothing here):
--   select grantee, table_name, privilege_type
--   from information_schema.table_privileges
--   where table_schema = 'reporting' and grantee in ('anon', 'authenticated', 'PUBLIC');
--
-- How much is being left out, last 28 days:
--   select (select count(*) from public.search_events    where created_at > now() - interval '28 days') as all_searches,
--          (select count(*) from reporting.search_events where created_at > now() - interval '28 days') as reported_searches;
