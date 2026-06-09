-- ═══════════════════════════════════════════════════════════════
-- SHOWSHAK — GRANTS: RE-APPLY, VERIFY, RELOAD
-- ───────────────────────────────────────────────────────────────
-- whoami proved the request reaches the DB as `authenticated` with the
-- right uid — so the token is fine. Yet writes still fail with
-- "permission denied for table" (42501) = the table GRANT for the
-- `authenticated` role is not effective.
--
-- This file does three things, all idempotent:
--   1. Re-applies the social grants (each on its own line).
--   2. Creates check_social_grants() so the diagnostic page can SHOW
--      exactly which grants the DB has (proof, not assumption).
--   3. Forces PostgREST to reload its schema cache (a known Supabase
--      gotcha where grant changes don't take effect until reload).
--
-- Run: SQL Editor → paste → Run.  Then tap "Check grants" on the test
-- page, then re-try FIRE/FOLLOW.
-- ═══════════════════════════════════════════════════════════════

-- 1. Re-apply grants (separately, so one failing can't roll back others).
grant usage on schema public to authenticated;
grant select, insert, delete on table public.content_fires to authenticated;
grant select, insert, delete on table public.follows        to authenticated;
grant select, insert, update, delete on table public.stacks       to authenticated;
grant select, insert, update, delete on table public.stack_items  to authenticated;
grant select, insert, update, delete on table public.user_subscriptions to authenticated;

-- 2. A SECURITY DEFINER function that reports the actual grants present.
create or replace function public.check_social_grants()
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce(string_agg(table_name || ':' || privilege_type, ', ' order by table_name, privilege_type), 'NONE FOUND')
  from information_schema.role_table_grants
  where grantee = 'authenticated'
    and table_schema = 'public'
    and table_name in ('content_fires','follows','stacks','stack_items');
$$;
grant execute on function public.check_social_grants() to anon, authenticated;

-- 3. Tell PostgREST (the API layer) to reload, so new grants take effect.
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- After running: the diagnostic's "Check grants" should list
-- content_fires:INSERT, follows:INSERT, etc. Then FIRE/FOLLOW work.
-- ═══════════════════════════════════════════════════════════════
