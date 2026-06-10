-- ═══════════════════════════════════════════════════════════════
-- 0012_content_insert_and_mux.sql
-- SHOWSHAK — CONTENT INSERT ACCESS + MUX UPLOAD CONVENTIONS
-- ───────────────────────────────────────────────────────────────
-- Step 3 (Mux video clips) lets an authenticated CURATOR publish a
-- real clip: the browser uploads bytes straight to Mux, then INSERTs a
-- `content` row in status='processing' (the Mux webhook later flips it
-- to 'live'). This file opens that single new write path — safely.
--
-- The `content` table already carries EVERY column this feature needs
-- (mux_asset_id, mux_playback_id, thumbnail_url, url, duration_sec,
--  status default 'processing'), added back in migration 0001. So the
-- DB work here is small and purely ADDITIVE:
--   • a table GRANT (insert) for the `authenticated` role
--   • RLS on `content` + one insert policy keyed to auth.uid()
--   • documentation of two jsonb conventions (no new column)
--
-- These are SAFE / additive changes (a GRANT + an RLS policy) per
-- supabase/SCHEMA_CHANGE_PROCESS.md — applied directly after review.
-- No table/column is dropped, renamed, retyped, or constrained, so
-- nothing risky needs staging.
--
-- Every statement is idempotent and independent (no risky dependency),
-- so this file cannot half-apply and roll back the way 0006 did. The
-- Supabase SQL editor runs a file as ONE transaction — keeping each
-- statement self-standing is what makes it re-runnable and safe.
--
-- Run: SQL Editor → paste → Run.
-- ═══════════════════════════════════════════════════════════════

-- Make sure the API role can use the schema at all (idempotent).
grant usage on schema public to authenticated;

-- ───────────────────────────────────────────────────────────────
-- 1. CONTENT INSERT  — a curator publishes their own clip
-- ───────────────────────────────────────────────────────────────
-- Table-level privilege: without this the insert fails with
-- "permission denied for table content" (42501), regardless of RLS.
grant insert on table public.content to authenticated;

-- Lock the table so only the policies below decide who may write.
-- (SELECT for the feed is already granted/role-shaped elsewhere; this
--  enable is idempotent and does not revoke existing read access.)
alter table public.content enable row level security;

-- A curator may INSERT a clip ONLY as themselves: the new row's
-- creator_id must equal their authenticated user id (Req 2.5 / 11.3).
-- This is the database lock — the UI cannot forge another user's clip,
-- and a guest (no auth.uid()) fails the check and inserts nothing.
drop policy if exists content_insert_own on public.content;
create policy content_insert_own on public.content
  for insert with check (creator_id = auth.uid());

-- ───────────────────────────────────────────────────────────────
-- 2. CONVENTIONS  (documented here; no new column needed)
-- ───────────────────────────────────────────────────────────────
-- (a) MUX UPLOAD ID — content.meta->>'mux_upload_id'
--     At publish time the client stores the Mux *direct-upload* id on
--     the row inside the existing `meta` jsonb, e.g.
--         meta = { "mux_upload_id": "<id from mux-upload-url>" , ... }
--     The mux-webhook Edge Function matches the right row on a
--     video.asset.ready event via  meta->>'mux_upload_id'  (falling
--     back to mux_asset_id), then fills mux_asset_id / mux_playback_id
--     / thumbnail_url / duration_sec and flips status to 'live'.
--     Stored in meta (not a new column) to keep this change additive.
--
-- (b) DEMO / SEED TAGGING — content.meta->>'seed' = 'true'
--     Demo/seed rows continue to carry  meta.seed = true  so
--     supabase/RESET_demo_data.sql keeps wiping them
--     (it deletes  where meta->>'seed' = 'true'). Real curator uploads
--     OMIT this flag, so a pre-launch demo wipe never touches them.
--
-- (c) STATUS LIFECYCLE — draft | processing | live | removed
--     Enforced by the app + Edge Functions (client inserts
--     'processing'; the webhook sets 'live'; removal sets 'removed').
--     A DB CHECK constraint on status is intentionally DEFERRED: adding
--     a constraint to a table that already holds rows is a RISKY change
--     under SCHEMA_CHANGE_PROCESS.md and must be staged first. It is
--     therefore left out of this additive-direct migration.

-- Tell PostgREST to reload so the new grant + policy take effect now.
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- DONE. An authenticated curator can now INSERT their own `content`
-- row (status='processing'); guests and impersonation are blocked by
-- the RLS check. The feed read path is unchanged. Next: wire the
-- loader's Mux fields and the VideoSurface primitive.
-- ═══════════════════════════════════════════════════════════════
