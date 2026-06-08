-- ═══════════════════════════════════════════════════════════════
-- SHOWSHAK — LINK PROFILES TO LOGINS + REMOVE THE CONFUSING TABLE
-- ───────────────────────────────────────────────────────────────
-- TWO fixes that came out of testing:
--
-- 1. CASCADE DELETE: make public.users.id a FOREIGN KEY to
--    auth.users(id) with ON DELETE CASCADE. Result: when you delete a
--    login in the Authentication tab, its profile row in public.users
--    is removed automatically (no more orphan profiles).
--
-- 2. DROP public.user_auth: leftover from the original UML. Supabase
--    manages credentials in auth.users, so user_auth was always empty
--    and only caused confusion. Remove it.
--
-- ORDER MATTERS: we must DELETE any existing orphan profiles BEFORE
-- adding the foreign key — otherwise Postgres refuses to add the
-- constraint because those old rows already violate it (error 23503).
--
-- HOW TO USE: Supabase → SQL Editor → New query → paste → Run.
-- (Safe to run multiple times.)
-- ═══════════════════════════════════════════════════════════════

-- ── 0. CLEAN UP ORPHANS FIRST ──
-- Remove any profile whose login no longer exists in auth.users
-- (these are leftovers from deleting test logins before the FK existed).
delete from public.users u
where not exists (select 1 from auth.users a where a.id = u.id);

-- ── 1. Now it's safe to add the cascade link ──
alter table public.users
  drop constraint if exists users_id_fkey;

alter table public.users
  add constraint users_id_fkey
  foreign key (id) references auth.users(id)
  on delete cascade;

-- ── 2. Remove the vestigial user_auth table (Supabase handles auth) ──
drop table if exists public.user_auth cascade;

-- ═══════════════════════════════════════════════════════════════
-- DONE. public.users now matches auth.users 1-to-1, deleting a login
-- cascades to its profile, and the confusing user_auth table is gone.
-- ═══════════════════════════════════════════════════════════════
