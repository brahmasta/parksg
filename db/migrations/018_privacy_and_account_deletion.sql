-- Privacy policy and account deletion.
--
-- 1. "Near me" searches no longer keep the device's GPS position. The app
--    stopped sending it; record_search also drops it server-side (older
--    clients, cached PWAs), and coordinates already stored are cleared.
-- 2. profiles records which privacy policy version a person accepted, and
--    when (record_sign_in gains p_privacy_version).
-- 3. delete_user_data() removes everything linked to an account. Only the
--    service role may call it: api/account/delete.ts verifies the person's
--    Google/Apple sign-in first, because the anon RPCs take the user id on
--    trust.

-- ── 1. Near-me GPS ─────────────────────────────────────────────────────────
-- 'My location' is the label App.tsx gives a near-me search.

update public.search_events
   set lat = null, lng = null
 where query = 'My location'
   and (lat is not null or lng is not null);

create or replace function public.record_search(
  p_query text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_user_id text default null,
  p_client_id text default null,
  p_device text default null,
  p_auto boolean default false
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_query text := nullif(trim(p_query), '');
  v_near_me boolean;
begin
  if v_query is null then return; end if;
  v_query := left(v_query, 200);
  v_near_me := v_query = 'My location';
  insert into public.search_events (query, query_norm, lat, lng, user_id, client_id, device, auto)
  values (
    v_query, lower(v_query),
    case when v_near_me then null else p_lat end,
    case when v_near_me then null else p_lng end,
    nullif(trim(p_user_id), ''),
    left(nullif(trim(p_client_id), ''), 64),
    left(nullif(trim(p_device), ''), 16),
    coalesce(p_auto, false)
  );
end;
$$;

-- The original 4-argument version, still reachable by very old clients.
create or replace function public.record_search(
  p_query text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_user_id text default null
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_query text := nullif(trim(p_query), '');
begin
  if v_query is null then return; end if;
  v_query := left(v_query, 200);
  insert into public.search_events (query, query_norm, lat, lng, user_id)
  values (
    v_query, lower(v_query),
    case when v_query = 'My location' then null else p_lat end,
    case when v_query = 'My location' then null else p_lng end,
    nullif(trim(p_user_id), '')
  );
end;
$$;

-- ── 2. Privacy policy acceptance ───────────────────────────────────────────

alter table public.profiles
  add column if not exists privacy_version text,
  add column if not exists privacy_accepted_at timestamptz;

-- Replaces the 3-argument version. Keeping both would make PostgREST's
-- named-argument calls ambiguous; the new parameter defaults to null, so
-- callers that omit it keep working.
drop function if exists public.record_sign_in(text, text, text);

create or replace function public.record_sign_in(
  p_user_id text,
  p_name text default null,
  p_email text default null,
  p_privacy_version text default null
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_version text := left(nullif(trim(p_privacy_version), ''), 32);
begin
  if p_user_id is null or length(trim(p_user_id)) = 0 then
    return;
  end if;
  insert into public.profiles (id, name, email, sign_in_count, first_seen_at, last_seen_at,
                               privacy_version, privacy_accepted_at)
  values (p_user_id, p_name, p_email, 1, now(), now(),
          v_version, case when v_version is null then null else now() end)
  on conflict (id) do update
    set sign_in_count       = public.profiles.sign_in_count + 1,
        last_seen_at        = now(),
        name                = coalesce(excluded.name,  public.profiles.name),
        email               = coalesce(excluded.email, public.profiles.email),
        privacy_version     = coalesce(excluded.privacy_version, public.profiles.privacy_version),
        privacy_accepted_at = case
          when excluded.privacy_version is not null
           and excluded.privacy_version is distinct from public.profiles.privacy_version
            then now()
          else public.profiles.privacy_accepted_at
        end;
end;
$$;

grant execute on function public.record_sign_in(text, text, text, text) to anon, authenticated;

-- ── 3. Account deletion ────────────────────────────────────────────────────
-- Deletes the account's own data. Carpark edit suggestions and new-carpark
-- submissions are community contributions to the carpark data, so they are
-- kept but no longer say who sent them. Reports and feedback sent with the
-- account's email are deleted too.

create or replace function public.delete_user_data(p_user_id text, p_email text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email text := lower(nullif(trim(p_email), ''));
  v_counts jsonb := '{}'::jsonb;
  n int;
begin
  if p_user_id is null or length(trim(p_user_id)) = 0 then
    raise exception 'user id required';
  end if;

  delete from public.saved_carparks where user_id = p_user_id;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('saved_carparks', n);

  delete from public.saved_destinations where user_id = p_user_id;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('saved_destinations', n);

  delete from public.checkins where user_id = p_user_id;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('checkins', n);

  delete from public.search_events where user_id = p_user_id;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('search_events', n);

  delete from public.app_events where user_id = p_user_id;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('app_events', n);

  delete from public.visits where user_id = p_user_id;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('visits', n);

  delete from public.app_feedback
   where user_id = p_user_id or (v_email is not null and lower(email) = v_email);
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('app_feedback', n);

  if v_email is not null then
    delete from public.inaccuracy_reports where lower(email) = v_email;
    get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('inaccuracy_reports', n);
  end if;

  update public.carpark_edit_submissions
     set submitter_user_id = null, submitter_email = null, submitter_name = null
   where submitter_user_id = p_user_id
      or (v_email is not null and lower(submitter_email) = v_email);
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('edit_submissions_anonymised', n);

  delete from public.profiles where id = p_user_id;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('profiles', n);

  return v_counts;
end;
$$;

revoke all on function public.delete_user_data(text, text) from public, anon, authenticated;
grant execute on function public.delete_user_data(text, text) to service_role;
