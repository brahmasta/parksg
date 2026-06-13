-- Migration: community carpark edit submissions + moderation queue
--
-- Lets anyone (signed-in or anonymous) propose structured changes to a
-- carpark's total_lots and rate schedule. Proposals land here as 'pending';
-- an admin approves (applied as MANUAL via api/admin/edits.ts) or rejects.
--
-- Submission goes through a SECURITY DEFINER RPC granted to anon (same pattern
-- as record_inaccuracy_report) — the table itself is RLS-locked, so the
-- browser can only insert through the narrow function, and admin reads/writes
-- use the service-role key.
--
-- Apply via the Supabase SQL editor, psql, or the MCP apply_migration.

create table if not exists public.carpark_edit_submissions (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  carpark_id          text not null,
  carpark_name        text,
  carpark_source      text,
  submitter_user_id   text,            -- null when anonymous
  submitter_email     text,
  submitter_name      text,
  proposed_total_lots integer,         -- null = unknown / not provided
  proposed_rates      jsonb not null default '[]'::jsonb,
  note                text,
  status              text not null default 'pending',  -- pending | approved | rejected
  reviewed_by         text,
  reviewed_at         timestamptz,
  review_note         text
);

alter table public.carpark_edit_submissions enable row level security;
-- No anon/authenticated policies: all inserts go through the RPC below, all
-- reads/updates use the service-role key (which bypasses RLS).

create index if not exists carpark_edit_submissions_status_created_idx
  on public.carpark_edit_submissions (status, created_at desc);

-- ── Submit RPC (anon-callable, SECURITY DEFINER) ──────────────────────────────
create or replace function public.submit_carpark_edit(
  p_carpark_id     text,
  p_carpark_name   text,
  p_carpark_source text   default null,
  p_user_id        text   default null,
  p_email          text   default null,
  p_name           text   default null,
  p_total_lots     integer default null,
  p_rates          jsonb  default '[]'::jsonb,
  p_note           text   default null
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
     submitter_email, submitter_name, proposed_total_lots, proposed_rates, note)
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
    left(nullif(trim(p_note), ''), 2000)
  );
end;
$function$;

grant execute on function public.submit_carpark_edit(
  text, text, text, text, text, text, integer, jsonb, text
) to anon, authenticated, service_role;
