-- ═══════════════════════════════════════════════════════════════
-- SHOWSHAK — LINK PROFILES TO LOGINS + REMOVE THE CONFUSING TABLE
-- ───────────────────────────────────────────────────────────────
-- TWO fixes that came out of testing:
--
-- 1. CASCADE DELETE: right now public.users.id is just a plain id.
--    We make it a FOREIGN KEY to auth.users(id) with ON DELETE
--    CASCADE. Result: when you delete a login in the Authentication
--    tab, its profile row in public.users is removed automatically.
--    (Before this, deleting a login left an orphan profile behind —
--    which is part of why the users table looked messy.)
--
-- 2. DROP public.user_auth: this table was a leftover from the
--    original UML. Supabase manages credentials in auth.users, so
--    user_auth was always empty and only caused confusion. Remove it.
--
-- HOW TO USE: Supabase → SQL Editor → New query → paste → Run.
-- (Safe to run even with existing rows — see the cleanup note below.)
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Make public.users.id reference auth.users(id), cascade on delete ──
-- Drop any existing FK with this name first (so re-running is safe).
alter table public.users
  drop constraint if exists users_id_fkey;

alter table public.users
  add constraint users_id_fkey
  foreign key (id) references auth.users(id)
  on delete cascade;

-- ── 2. Remove the vestigial user_auth table (Supabase handles auth) ──
drop table if exists public.user_auth cascade;

-- ───────────────────────────────────────────────────────────────
-- OPTIONAL CLEANUP (run manually if you want a clean slate):
-- The cleanest way to wipe test accounts is the Authentication → Users
-- screen (delete the logins there — profiles now cascade away too).
-- If any ORPHAN profiles remain from before this FK existed, this
-- removes profiles that no longer have a matching login:
--
--   delete from public.users u
--   where not exists (select 1 from auth.users a where a.id = u.id);
-- ───────────────────────────────────────────────────────────────
