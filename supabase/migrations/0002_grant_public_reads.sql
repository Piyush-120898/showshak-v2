-- ═══════════════════════════════════════════════════════════════
-- SHOWSHAK — GRANT PUBLIC READ ACCESS  (fix for "permission denied")
-- ───────────────────────────────────────────────────────────────
-- WHY THIS EXISTS:
-- During setup we chose "Automatically expose new tables = OFF" (the
-- safe choice). That means the API roles (anon = logged-out visitors,
-- authenticated = logged-in users) get NO table access by default —
-- not even read. So reads failed with: permission denied (code 42501).
--
-- There are TWO independent gates on every table:
--   1. GRANT  -> "is this table reachable by the API role at all?"  (this file)
--   2. RLS    -> "which ROWS within it may that role see?"          (schema file)
-- We already wrote the RLS policies. This file opens gate #1 for the
-- PUBLIC, read-only reference tables + live clips.
--
-- HOW TO USE: Supabase -> SQL Editor -> New query -> paste -> Run.
-- ═══════════════════════════════════════════════════════════════

-- Let the API roles use the schema at all.
grant usage on schema public to anon, authenticated;

-- PUBLIC, READ-ONLY reference data: anyone (even logged-out) may READ.
-- (RLS still restricts to rows where deleted_at is null, per the policies.)
grant select on table moods      to anon, authenticated;
grant select on table platforms  to anon, authenticated;
grant select on table genres     to anon, authenticated;
grant select on table titles     to anon, authenticated;

-- Live clips are publicly readable too (RLS limits it to status='live').
grant select on table content    to anon, authenticated;

-- NOTE: We deliberately do NOT grant access to users, content_fires,
-- stacks, analytics_daily, etc. here. Those are private/owner-scoped and
-- get their grants + tightened RLS in Step 1 once login is wired, so a
-- logged-out visitor can never read someone's private data.
