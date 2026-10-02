-- Migration: carpark height limits (multi-storey / basement)
--
-- Drivers of vans, roof boxes and MPVs need the clearance before they queue
-- at the gantry. HDB's carpark dataset already carries `gantry_height`, kept
-- in carparks.raw, but nothing surfaced it.
--
-- 1. carparks.height_limit_m — metres, null = unknown / no limit.
-- 2. Backfill HDB from raw.gantry_height (refresh_hdb_height_limits) for
--    every type except plain 'SURFACE CAR PARK'. Covered, basement, multi-storey and mechanised values
--    are consistent (1.7–4.5m, mostly 2.15m). Surface values are mostly 0,
--    4.5 or 9.99 — placeholders, not a clearance — so they're left null.
-- 3. Community edits can propose a height (carpark_edit_submissions gets
--    proposed_height_limit_m; submit_carpark_edit gains p_height_limit_m).
--    The admin carpark editor writes the column directly.
--
-- ORDER OF DEPLOY: apply BEFORE shipping the client. The client selects
-- height_limit_m from carparks, and PostgREST rejects a select naming a
-- missing column — every results query would fail.

begin;

-- ── 1. Column ────────────────────────────────────────────────────────────────

alter table public.carparks
  add column if not exists height_limit_m numeric(3,2)
  check (height_limit_m is null or height_limit_m between 1.2 and 6);

-- ── 2. HDB backfill ──────────────────────────────────────────────────────────
-- A function so the full sync (scripts/migrate-to-supabase.ts) can re-run it
-- after each HDB upsert, filling carparks that are new since. It only fills
-- nulls, so a height set in the admin editor is never overwritten. Kept out
-- of the sync's bulk upsert for the same reason: that would write null over
-- admin-set heights on every non-HDB row.

create or replace function public.refresh_hdb_height_limits()
returns integer
language sql
security definer
set search_path to 'public'
as $function$
  with u as (
    update public.carparks
    set height_limit_m = (raw->>'gantry_height')::numeric
    where agency = 'HDB'
      and height_limit_m is null
      and car_park_type is distinct from 'SURFACE CAR PARK'
      and raw->>'gantry_height' ~ '^[0-9]+(\.[0-9]+)?$'
      and (raw->>'gantry_height')::numeric between 1.2 and 6
    returning 1
  )
  select count(*)::integer from u
$function$;

revoke all on function public.refresh_hdb_height_limits() from public, anon, authenticated;
grant execute on function public.refresh_hdb_height_limits() to service_role, postgres;

select public.refresh_hdb_height_limits();

-- ── 3. Community edits ───────────────────────────────────────────────────────

alter table public.carpark_edit_submissions
  add column if not exists proposed_height_limit_m numeric(3,2);

-- Replace (not overload) the 9-arg function: with both present, a call
-- without p_height_limit_m would match either and PostgREST would refuse it.
drop function if exists public.submit_carpark_edit(text, text, text, text, text, text, integer, jsonb, text);

create or replace function public.submit_carpark_edit(
  p_carpark_id      text,
  p_carpark_name    text,
  p_carpark_source  text    default null,
  p_user_id         text    default null,
  p_email           text    default null,
  p_name            text    default null,
  p_total_lots      integer default null,
  p_rates           jsonb   default '[]'::jsonb,
  p_note            text    default null,
  p_height_limit_m  numeric default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_cp text := nullif(trim(p_carpark_id), '');
begin
  if v_cp is null then
    raise exception 'carpark_id is required';
  end if;
  if p_rates is null or jsonb_typeof(p_rates) <> 'array' then
    raise exception 'rates must be a JSON array';
  end if;

  insert into public.carpark_edit_submissions
    (carpark_id, carpark_name, carpark_source, submitter_user_id,
     submitter_email, submitter_name, proposed_total_lots, proposed_rates, note,
     proposed_height_limit_m)
  values (
    left(v_cp, 120),
    left(nullif(trim(p_carpark_name), ''), 200),
    left(nullif(trim(p_carpark_source), ''), 40),
    left(nullif(trim(p_user_id), ''), 64),
    left(nullif(trim(p_email), ''), 200),
    left(nullif(trim(p_name), ''), 120),
    p_total_lots,
    -- cap proposed rate rows at 50 to bound a pathological payload
    (select coalesce(jsonb_agg(e), '[]'::jsonb)
       from (select e from jsonb_array_elements(p_rates) e limit 50) s),
    left(nullif(trim(p_note), ''), 2000),
    -- out-of-range heights are dropped rather than failing the whole edit
    case when p_height_limit_m between 1.2 and 6 then round(p_height_limit_m, 2) end
  );
end;
$function$;

grant execute on function public.submit_carpark_edit(
  text, text, text, text, text, text, integer, jsonb, text, numeric
) to anon, authenticated, service_role;

commit;

notify pgrst, 'reload schema';
