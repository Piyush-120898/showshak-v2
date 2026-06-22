-- ═══════════════════════════════════════════════════════════════
-- 0028 — Curator-declared platforms per (clip, title)
-- ───────────────────────────────────────────────────────────────
-- WHY: TMDB is a HINT, the curator is the AUTHORITY. The Watch It sheet used
-- to treat TMDB's cached region providers (titles.providers) as the source of
-- truth, so stale/incomplete TMDB data showed a false "Not available to stream
-- in your region" at the product's climax. To let a curator add/correct where a
-- title streams — WITHOUT clobbering the shared TMDB cache or changing
-- availability for other curators' clips — we store the curator's declared
-- platforms PER (clip, title) link, separate from titles.providers.
--
-- This migration adds a single additive array column to the content_titles join
-- table holding Platform_Catalog ids (platforms.id) the curator declares the
-- title streams on for that specific clip. The resolver later MERGES (union +
-- de-dup) these with titles.providers; an empty array (the default) means
-- "no declarations" → today's TMDB-only behaviour (empty ∪ TMDB = TMDB).
--
--   • ADDITIVE + IDEMPOTENT: `add column if not exists`, safe to re-run.
--   • NO BACKFILL: `not null default '{}'` makes every existing row valid with
--     an empty declaration set — no data rewrite, no behaviour change.
--   • SEPARATE from titles.providers: a TMDB refresh writes titles.providers and
--     never touches content_titles; two clips on the same title stay independent.
--   • STORED BY ID: declarations persist platforms by Platform_Catalog id (uuid),
--     not by name. (Array columns can't carry an element-level FK; ids are only
--     written from the active catalog and the resolver drops unmatched ids.)
--
-- NO NEW RLS POLICY: the new column rides content_titles' EXISTING owner-scoped
-- policies from migration 0014 — content_titles_read (public read for links of a
-- live clip, owner read always), content_titles_insert_own and
-- content_titles_delete_own (writes scoped to the clip owner). The column is
-- returned by the same select and written by the same owner-session inserts, so
-- no read/write policy change is required.
--
-- FOUNDER-RUN: apply in the Supabase SQL editor. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- Add the per-(clip, title) curator-declared platform ids (Platform_Catalog ids).
alter table content_titles
  add column if not exists curator_platform_ids uuid[] not null default '{}';

-- Reload PostgREST so the new column is live immediately.
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- VERIFY (manual):
--   • column content_titles.curator_platform_ids exists, type uuid[],
--     default '{}', not null.
--       select column_name, data_type, column_default, is_nullable
--         from information_schema.columns
--        where table_name = 'content_titles'
--          and column_name = 'curator_platform_ids';
--   • existing rows read back an empty array:
--       select content_id, title_id, curator_platform_ids from content_titles limit 5;
--   • the existing content_titles RLS policies (read/insert/delete from 0014)
--     still cover the column — no new policy was added.
-- ═══════════════════════════════════════════════════════════════
