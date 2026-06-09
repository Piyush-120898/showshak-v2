-- ═══════════════════════════════════════════════════════════════
-- SHOWSHAK — RESET DEMO DATA  (clean slate for launch)
-- ───────────────────────────────────────────────────────────────
-- Removes EVERYTHING we created for testing/demo, so you can go live
-- with a fresh database — WITHOUT dropping any tables or schema.
--
-- It removes:
--   • all seed content (clips, titles) tagged meta.seed = true
--   • all seed curators (auth users with @seed.showshak emails) — their
--     profiles + any linked rows cascade away automatically (migration 0004)
--   • OPTIONALLY: your own real test accounts (see the clearly-marked
--     section at the bottom — commented out by default for safety)
--
-- WHAT IT DOES NOT TOUCH: the schema, the reference data (platforms,
-- moods, genres), or any real user you want to keep.
--
-- ⚠️ DESTRUCTIVE — per SCHEMA_CHANGE_PROCESS.md, run on STAGING first
--    if you have one. For a pre-launch wipe of demo data this is the
--    intended tool. Run: SQL Editor → paste → Run.
-- ═══════════════════════════════════════════════════════════════

-- 1. Remove seed CONTENT and its dependent rows.
--    (fires/saves/stack_items/genre/mood links reference content; delete
--     children first, then the content + titles.)
delete from content_fires   where content_id in (select id from content where meta->>'seed' = 'true');
delete from content_genres  where content_id in (select id from content where meta->>'seed' = 'true');
delete from content_moods   where content_id in (select id from content where meta->>'seed' = 'true');
delete from stack_items     where content_id in (select id from content where meta->>'seed' = 'true');
delete from watch_events    where content_id in (select id from content where meta->>'seed' = 'true');
delete from view_events     where content_id in (select id from content where meta->>'seed' = 'true');
delete from share_events    where content_id in (select id from content where meta->>'seed' = 'true');
delete from watch_history   where content_id in (select id from content where meta->>'seed' = 'true');
delete from content where meta->>'seed' = 'true';
delete from titles  where meta->>'seed' = 'true';

-- 2. Remove seed CURATORS. Deleting the auth login cascades to the
--    public.users profile and anything it owns (follows, stacks, etc.)
--    via the ON DELETE CASCADE link added in migration 0004.
delete from auth.users where email like '%@seed.showshak';

-- ───────────────────────────────────────────────────────────────
-- 3. OPTIONAL — wipe YOUR OWN real test accounts too (full clean slate).
--    Commented out for safety. To use it, either:
--      (a) delete them from the dashboard: Authentication → Users, OR
--      (b) uncomment the line below to remove EVERY login (nukes ALL
--          users — only do this when you truly want zero accounts).
-- ───────────────────────────────────────────────────────────────
-- delete from auth.users;   -- ⚠️ removes ALL accounts (profiles cascade)

-- ═══════════════════════════════════════════════════════════════
-- AFTER RUNNING: platforms/moods/genres remain (your reference data),
-- the schema is intact, and all demo content + seed curators are gone.
-- Verify with:  select count(*) from content;  select count(*) from users;
-- ═══════════════════════════════════════════════════════════════
