-- ═══════════════════════════════════════════════════════════════
-- 0015_content_update_and_drafts.sql
-- SHOWSHAK — CONTENT OWNER READ + UPDATE (edit-after-post & drafts)
--            Curator Upload v2, Reqs 9 (Drafts) & 10 (Edit After Post)
-- ───────────────────────────────────────────────────────────────
-- What this opens (all ADDITIVE, all keyed to creator_id = auth.uid()):
--
--   1. OWNER READ  — a curator can read their OWN clips in ANY status
--      (draft / processing / live / removed). Until now the only SELECT
--      policy on `content` was the PUBLIC one (status='live'), so a
--      curator could not see their own drafts or processing clips
--      through the anon/authenticated API (that only worked with the
--      service-role key, which bypasses RLS). Drafts (Req 9) and the
--      profile "My Clips" list both need this.
--
--   2. OWNER UPDATE — a curator can edit their OWN clip: the pitch
--      (description), cover (thumbnail_url + meta.cover_time), primary
--      title (title_id), vibes mirror (meta), and the draft→processing
--      publish transition (status). Edit-after-post (Req 10) and
--      publishing a saved draft both need this.
--
-- DRAFTS need NO new column: a draft is simply a `content` row with
-- status='draft'. The PUBLIC read policy only exposes status='live', so
-- drafts are already hidden from everyone else; the OWNER READ policy
-- below lets the author see and resume them. Discarding a draft, or
-- removing a published clip, is a soft delete (set deleted_at) — an
-- UPDATE, covered here — so no DELETE grant is opened.
--
-- SECURITY NOTE (accepted for now): owner UPDATE is table-level, so a
-- curator could in theory set their own clip status='live' without a
-- real Mux asset. Impact is cosmetic only — a 'live' row with no
-- mux_playback_id renders as a gradient clip (the loader already
-- handles null playback), and RLS still scopes every write to the
-- owner's own rows. Hardening the status transition (a trigger limiting
-- draft→processing→live, or routing publish through an Edge Function)
-- is DEFERRED. A status CHECK constraint stays deferred too (adding a
-- constraint to a populated table is RISKY per SCHEMA_CHANGE_PROCESS.md).
--
-- SAFE / ADDITIVE (grants + RLS policies) — applied directly after
-- review. Idempotent + independent statements (cannot half-apply).
-- Run: SQL Editor → paste → Run.
-- ═══════════════════════════════════════════════════════════════

-- API role must be able to use the schema at all (idempotent).
grant usage on schema public to authenticated;

-- content already has RLS enabled (0012) + policies read_live_content
-- (public, status='live') and content_insert_own. This is idempotent.
alter table public.content enable row level security;

-- ───────────────────────────────────────────────────────────────
-- 1. OWNER READ — a curator sees ALL of their own clips, any status.
--    (Adds to, never replaces, the public live-read policy. RLS is
--     permissive: a row is visible if ANY select policy passes.)
-- ───────────────────────────────────────────────────────────────
drop policy if exists content_select_own on public.content;
create policy content_select_own on public.content
  for select using (creator_id = auth.uid());

-- ───────────────────────────────────────────────────────────────
-- 2. OWNER UPDATE — a curator edits ONLY their own clip.
-- ───────────────────────────────────────────────────────────────
grant update on table public.content to authenticated;

drop policy if exists content_update_own on public.content;
create policy content_update_own on public.content
  for update
  using      (creator_id = auth.uid())   -- may target only their own rows
  with check (creator_id = auth.uid());  -- and may not reassign ownership

-- Tell PostgREST to reload so the new policies + grant take effect now.
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- DONE. A curator can now:
--   • read their own draft/processing/live/removed clips (My Clips, drafts)
--   • update their own clips (edit pitch/cover/primary title; publish a
--     draft; soft-delete via deleted_at)
-- Guests and other users are unaffected (public still sees only 'live').
-- Next task: title search + create-if-missing.
-- ═══════════════════════════════════════════════════════════════
