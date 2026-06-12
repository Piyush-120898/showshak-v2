-- ═══════════════════════════════════════════════════════════════
-- 0014_content_titles.sql
-- SHOWSHAK — MULTIPLE TITLES PER CLIP  (Curator Upload v2, Req 2)
-- ───────────────────────────────────────────────────────────────
-- Today a clip links to ONE title via content.title_id. Curator Upload
-- v2 lets a single clip recommend SEVERAL titles (e.g. "3 films like X").
-- This adds a many-to-many join table `content_titles`, mirroring the
-- existing `content_genres` join + the `stack_items` parent-ownership
-- RLS pattern.
--
-- COEXISTENCE (no breakage): content.title_id is KEPT as the clip's
-- PRIMARY title (the first one the curator picks) so every existing
-- read path (feed, Watch It, profile) keeps working unchanged. The full
-- set of titles for a clip lives in content_titles (primary included,
-- sort_no = 0). New code reads content_titles; old code still reads
-- title_id. Nothing is dropped, renamed, retyped, or constrained.
--
-- SAFE / ADDITIVE per supabase/SCHEMA_CHANGE_PROCESS.md (a new table +
-- grants + RLS) — applied directly after review. Every statement is
-- idempotent and independent so the file cannot half-apply / roll back
-- the way 0006 did (the SQL editor runs a file as ONE transaction).
--
-- Run: SQL Editor → paste → Run.
-- ═══════════════════════════════════════════════════════════════

-- API roles must be able to use the schema at all (idempotent).
grant usage on schema public to anon, authenticated;

-- ───────────────────────────────────────────────────────────────
-- 1. TABLE — content_titles (one row per (clip, title) link)
-- ───────────────────────────────────────────────────────────────
-- sort_no orders the titles within a clip (0 = the primary title, i.e.
-- content.title_id) so the Watch It sheet can list them in the curator's
-- intended order. created_at is handy for audits; both have defaults so
-- inserts only need (content_id, title_id).
create table if not exists content_titles (
  content_id uuid not null references content(id) on delete cascade,
  title_id   uuid not null references titles(id),
  sort_no    int  not null default 0,
  created_at timestamptz not null default now(),
  primary key (content_id, title_id)            -- a title can't be linked twice to the same clip
);

-- Reverse lookup "which clips recommend this title?" (the PK already
-- indexes content_id-first for the forward lookup).
create index if not exists idx_content_titles_title on content_titles (title_id);

-- ───────────────────────────────────────────────────────────────
-- 2. GRANTS — read is public (feed/Watch It for guests); writes are
--    authenticated only. Links are INSERT/DELETE only (never updated),
--    so no UPDATE grant — and no upsert (project lesson #3).
-- ───────────────────────────────────────────────────────────────
grant select               on table content_titles to anon, authenticated;
grant insert, delete       on table content_titles to authenticated;

-- ───────────────────────────────────────────────────────────────
-- 3. RLS — lock the table, then open exactly what's needed.
-- ───────────────────────────────────────────────────────────────
alter table content_titles enable row level security;

-- READ: anyone may read the title links of a LIVE clip (so Watch It works
-- for guests), and a curator may always read links of their OWN clip
-- (drafts / processing included). Mirrors the stack_items parent check.
drop policy if exists content_titles_read on content_titles;
create policy content_titles_read on content_titles
  for select using (
    exists (
      select 1 from content c
      where c.id = content_id
        and ((c.deleted_at is null and c.status = 'live') or c.creator_id = auth.uid())
    )
  );

-- INSERT: a curator may link titles ONLY to a clip they own.
drop policy if exists content_titles_insert_own on content_titles;
create policy content_titles_insert_own on content_titles
  for insert with check (
    exists (select 1 from content c where c.id = content_id and c.creator_id = auth.uid())
  );

-- DELETE: a curator may unlink titles ONLY from a clip they own
-- (used by edit-after-post when changing the recommended titles).
drop policy if exists content_titles_delete_own on content_titles;
create policy content_titles_delete_own on content_titles
  for delete using (
    exists (select 1 from content c where c.id = content_id and c.creator_id = auth.uid())
  );

-- Tell PostgREST to reload so the new table + grants + policies are live.
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- DONE. Clips can now link to multiple titles:
--   • content.title_id  = the PRIMARY title (unchanged, sort_no 0)
--   • content_titles    = the full ordered set (primary + extras)
-- Public can read links for live clips; a curator can add/remove links
-- only on their own clips. Next task: content UPDATE grant + drafts.
-- ═══════════════════════════════════════════════════════════════
