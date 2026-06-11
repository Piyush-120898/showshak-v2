-- ═══════════════════════════════════════════════════════════════
-- 0013_feed_index.sql — FEED QUERY PERFORMANCE  (ADDITIVE / SAFE)
-- ───────────────────────────────────────────────────────────────
-- WHY: the public feed (and the windowed pager) read exactly:
--
--     select ... from content
--     where status = 'live' and deleted_at is null
--     order by created_at desc
--     limit <window> offset <n>;
--
-- The schema only had indexes on (creator_id, created_at) and (title_id),
-- so this query fell back to a filtered sort over the whole table. With a
-- handful of demo rows that's instant, but as curators post (target: 20–50
-- curators, ~2000 users) it degrades into a sequential scan + sort on every
-- feed open and every page — the #1 way this feed would "overload the DB".
--
-- FIX: a PARTIAL index that matches the feed predicate AND its ordering.
-- Because it is partial (only live, non-deleted rows), it stays small and
-- the planner can satisfy both the filter and the ORDER BY straight from the
-- index — turning each feed page into a cheap index range scan.
--
-- SAFE / ADDITIVE: creating an index changes no data and adds no constraint,
-- so per SCHEMA_CHANGE_PROCESS.md it is applied directly (no staging needed).
-- Run once in the Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════

create index if not exists idx_content_feed_live
  on content (created_at desc)
  where status = 'live' and deleted_at is null;

-- The owner "My Clips" query (creator_id = me, status in ('processing','live'),
-- newest first) is already well served by the existing
-- idx_content_creator (creator_id, created_at desc) from 0001 — no new index
-- needed there.

-- Make PostgREST aware immediately (harmless if already current).
notify pgrst, 'reload schema';
