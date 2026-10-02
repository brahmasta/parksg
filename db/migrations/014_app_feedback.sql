-- Migration: general app feedback from the home page
--
-- The home page gets a feedback form (idea / problem / praise / other, a
-- message, optional reply-to email). Until now the only channel was a link to
-- X in the footer; carpark-specific problems already go to inaccuracy_reports.
--
-- Same shape as inaccuracy_reports: an RLS-locked table with no policies, so
-- the browser can only write through a narrow SECURITY DEFINER RPC that
-- returns nothing, and only the service role (the /api/admin endpoints) reads.
-- The admin panel shows the unread ('new') count on its Feedback tab — that is
-- the notification; there is no outbound email.
--
-- Apply BEFORE shipping the client that calls record_app_feedback, or the form
-- shows its error state.

begin;

create table if not exists public.app_feedback (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  category    text not null check (category in ('idea', 'problem', 'praise', 'other')),
  message     text not null check (length(message) between 1 and 2000),
  email       text,
  user_id     text,
  client_id   text,
  device      text,
  page        text,
  user_agent  text,
  status      text not null default 'new'
              check (status in ('new', 'reviewing', 'resolved', 'dismissed'))
);

create index if not exists app_feedback_created_at_idx on public.app_feedback (created_at desc);
create index if not exists app_feedback_client_recent_idx on public.app_feedback (client_id, created_at desc);

alter table public.app_feedback enable row level security;
revoke all on public.app_feedback from anon, authenticated;

create or replace function public.record_app_feedback(
  p_category   text,
  p_message    text,
  p_email      text default null,
  p_user_id    text default null,
  p_client_id  text default null,
  p_device     text default null,
  p_page       text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_category text := lower(nullif(trim(p_category), ''));
  v_message  text := nullif(trim(p_message), '');
  v_client   text := left(nullif(trim(p_client_id), ''), 64);
begin
  if v_message is null then
    raise exception 'message is required';
  end if;
  if v_category is null or v_category not in ('idea', 'problem', 'praise', 'other') then
    v_category := 'other';
  end if;

  -- Light abuse guard: at most 5 submissions per browser per hour. Anonymous
  -- callers can rotate client ids, so this only stops accidental floods and
  -- casual spam, not a determined attacker.
  if v_client is not null and (
    select count(*) from public.app_feedback
    where client_id = v_client and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'too many submissions, try again later';
  end if;

  insert into public.app_feedback
    (category, message, email, user_id, client_id, device, page, user_agent)
  values (
    v_category,
    left(v_message, 2000),
    left(nullif(trim(p_email), ''), 200),
    left(nullif(trim(p_user_id), ''), 120),
    v_client,
    left(nullif(trim(p_device), ''), 16),
    left(nullif(trim(p_page), ''), 200),
    left(nullif(trim(p_user_agent), ''), 400)
  );
end;
$function$;

-- Ingest RPCs are anon-callable by design (see 010).
revoke all on function public.record_app_feedback(text, text, text, text, text, text, text, text) from public;
grant execute on function public.record_app_feedback(text, text, text, text, text, text, text, text)
  to anon, authenticated, service_role, postgres;

commit;

notify pgrst, 'reload schema';
