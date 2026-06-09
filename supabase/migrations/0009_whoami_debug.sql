-- ═══════════════════════════════════════════════════════════════
-- SHOWSHAK — WHOAMI DEBUG  (proves how the DB sees your request)
-- ───────────────────────────────────────────────────────────────
-- After 0008 the fire/follow grants should exist, yet writes still
-- fail with "permission denied". There are only two causes left:
--   (A) the grant truly isn't applied, or
--   (B) the request reaches the DB as role `anon` (not `authenticated`)
--       — e.g. the login JWT isn't attached / is expired — and since
--       we only granted to `authenticated`, that reads as denied.
--
-- This function lets the diagnostic page ask the DB directly:
--   "what role + user id do you see for THIS request?"
-- That tells us (A) vs (B) with certainty.
--
-- Run: SQL Editor → paste → Run.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.whoami()
returns json
language sql
stable
as $$
  select json_build_object(
    'role', current_setting('role', true),
    'jwt_role', auth.role(),
    'uid', auth.uid()
  );
$$;

grant execute on function public.whoami() to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- After running: re-open showshak-db-test.html (signed in) and tap
-- "Who am I (DB)". If jwt_role = 'authenticated' and uid matches your
-- session → grants are the issue. If jwt_role = 'anon' → your login
-- token isn't reaching the DB (the real bug), which we then fix.
-- ═══════════════════════════════════════════════════════════════
