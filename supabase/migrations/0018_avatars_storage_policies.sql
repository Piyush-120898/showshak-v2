-- ═══════════════════════════════════════════════════════════════
-- 0018_avatars_storage_policies.sql
-- SHOWSHAK — PROFILE PHOTO PERSISTENCE  (fix: avatars upload was failing)
-- ───────────────────────────────────────────────────────────────
-- BUG THIS FIXES: a curator/user uploads a profile photo, sees it briefly,
-- then it disappears on navigation and other users never see it.
--
-- ROOT CAUSE: the `avatars` Storage bucket was created (0005 dashboard step)
-- and is PUBLIC (so reads work), but Storage uploads write a row into
-- `storage.objects`, which has Row-Level Security ON with NO policy granting
-- INSERT to the `authenticated` role. So every upload was rejected by RLS and
-- the client skipped the photo — name/bio saved, photo silently did not.
--
-- THE FIX (this file): add owner-scoped policies on storage.objects for the
-- `avatars` bucket — a signed-in user may upload/update/delete objects ONLY
-- inside their OWN folder (the path must start with their auth.uid()), and
-- anyone may READ (the bucket is public, so profile photos display for all).
--
-- This matches how the client uploads: it writes to the path
--   <auth.uid()>/<timestamp>.<ext>
-- so (storage.foldername(name))[1] = the uploader's user id.
--
-- SAFE / ADDITIVE (only adds Storage policies). Idempotent (drop-if-exists).
-- storage.objects already has RLS enabled by Supabase — we only add policies.
-- HOW TO USE: Supabase → SQL Editor → New query → paste → Run.
--
-- PREREQUISITE: the `avatars` bucket must exist and be PUBLIC
--   (Supabase → Storage → New bucket → name "avatars", Public ON,
--    5 MB limit, MIME image/jpeg,png,webp) — see migration 0005's note.
-- ═══════════════════════════════════════════════════════════════

-- READ: anyone may read objects in the public `avatars` bucket so photos show
-- on every profile (owner, public view, follow lists, clip creator chips).
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select
  using ( bucket_id = 'avatars' );

-- INSERT: a signed-in user may upload ONLY into their own folder
-- (path = "<their uid>/..."). They cannot write into another user's folder.
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE: a user may replace/move ONLY their own avatar objects
-- (upsert from the client compiles to an update when the path already exists).
drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: a user may delete ONLY their own avatar objects (e.g. clean up old
-- photos). Optional but keeps the bucket tidy and stays owner-scoped.
drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ═══════════════════════════════════════════════════════════════
-- DONE. Profile photo upload now persists:
--   • client uploads to avatars/<uid>/<ts>.<ext>           (INSERT policy)
--   • getPublicUrl returns a public URL                     (READ policy)
--   • client writes users.avatar_url = that URL             (0003/0015 users RLS)
-- On reload, renderHeader reads users.avatar_url; other users read it via the
-- follows / creator joins. RLS scopes every write to the owner's own folder.
-- ═══════════════════════════════════════════════════════════════
