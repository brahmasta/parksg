-- Migration: revoke public EXECUTE on the admin analytics RPCs
--
-- SECURITY FIX. All three admin_* reporting functions were callable by `anon`:
--
--   curl -X POST "$SUPABASE_URL/rest/v1/rpc/admin_traffic_analytics" \
--        -H "apikey: $VITE_SUPABASE_ANON_KEY" -d '{"p_days":7}'
--   -> HTTP 200, full traffic audit
--
-- The anon key is not a secret — it ships inside the browser bundle — so this
-- exposed visitor counts, traffic sources, the conversion funnel, device and
-- referrer splits and the top-searches list to anyone who opened devtools.
--
-- Cause: Postgres grants EXECUTE on a new function to PUBLIC by default, and
-- `create or replace function` does not reset privileges. Writing
-- `grant execute ... to service_role, postgres` therefore ADDED those roles
-- without ever removing PUBLIC — the grant read like a restriction but was
-- purely additive. 001 established the pattern and 006/009 inherited it.
--
-- These functions are all SECURITY DEFINER, so PUBLIC execute meant PUBLIC
-- access to everything they read. The admin API routes reach them with the
-- service-role key and are unaffected by this revoke.
--
-- Note the argument lists must match exactly — privileges are per-overload.
--
-- Apply via the Supabase SQL editor, psql, or the MCP apply_migration.

revoke all on function public.admin_analytics(integer, text[])
  from public, anon, authenticated;
revoke all on function public.admin_event_analytics(integer, text[])
  from public, anon, authenticated;
revoke all on function public.admin_traffic_analytics(integer, text[])
  from public, anon, authenticated;

grant execute on function public.admin_analytics(integer, text[])        to service_role, postgres;
grant execute on function public.admin_event_analytics(integer, text[])  to service_role, postgres;
grant execute on function public.admin_traffic_analytics(integer, text[]) to service_role, postgres;

-- prune_app_events (008) already revokes from PUBLIC explicitly, and the
-- record_* ingest RPCs are anon-callable BY DESIGN — the browser has to write
-- events. Those are narrow, return nothing, and read nothing back.

-- Verify (expect only postgres + service_role on each):
--   select p.proname,
--          array_agg(distinct g.grantee) as can_execute
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
--   left join information_schema.routine_privileges g
--          on g.routine_name = p.proname and g.privilege_type = 'EXECUTE'
--   where p.proname like 'admin\_%'
--   group by p.proname;
