-- Migration: extend the edit-submission queue to also hold proposed NEW carparks
--
-- Reuses carpark_edit_submissions (and the admin "Edit requests" tab) for two
-- kinds of proposal: 'edit' (existing carpark, the original use) and 'new' (a
-- carpark the customer says is missing). For 'new', carpark_id is null until an
-- admin approves and the carpark is created; the proposed location/identity
-- lives in proposed_carpark.

alter table public.carpark_edit_submissions
  alter column carpark_id drop not null;

alter table public.carpark_edit_submissions
  add column if not exists kind text not null default 'edit',
  add column if not exists proposed_carpark jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'carpark_edit_submissions_kind_chk'
  ) then
    alter table public.carpark_edit_submissions
      add constraint carpark_edit_submissions_kind_chk check (kind in ('edit', 'new'));
  end if;
end$$;

-- ── Submit a proposed NEW carpark (anon-callable, SECURITY DEFINER) ───────────
create or replace function public.submit_new_carpark(
  p_name         text,
  p_lat          double precision,
  p_lng          double precision,
  p_address      text    default null,
  p_total_lots   integer default null,
  p_rates        jsonb   default '[]'::jsonb,
  p_note         text    default null,
  p_user_id      text    default null,
  p_email        text    default null,
  p_contact_name text    default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text := nullif(trim(p_name), '');
begin
  if v_name is null then
    raise exception 'name is required';
  end if;
  if p_lat is null or p_lng is null or p_lat <> p_lat or p_lng <> p_lng then
    raise exception 'lat/lng are required';
  end if;
  if p_rates is null or jsonb_typeof(p_rates) <> 'array' then
    raise exception 'rates must be a JSON array';
  end if;

  insert into public.carpark_edit_submissions
    (kind, carpark_id, carpark_name, submitter_user_id, submitter_email, submitter_name,
     proposed_total_lots, proposed_rates, note, proposed_carpark)
  values (
    'new',
    null,
    left(v_name, 200),
    left(nullif(trim(p_user_id), ''), 64),
    left(nullif(trim(p_email), ''), 200),
    left(nullif(trim(p_contact_name), ''), 120),
    p_total_lots,
    (select coalesce(jsonb_agg(e), '[]'::jsonb)
       from (select e from jsonb_array_elements(p_rates) e limit 50) s),
    left(nullif(trim(p_note), ''), 2000),
    jsonb_build_object(
      'name', left(v_name, 200),
      'lat', p_lat,
      'lng', p_lng,
      'address', left(nullif(trim(p_address), ''), 300)
    )
  );
end;
$function$;

grant execute on function public.submit_new_carpark(
  text, double precision, double precision, text, integer, jsonb, text, text, text, text
) to anon, authenticated, service_role;
