-- ═══════════════════════════════════════════════════════════════
-- 0016_find_or_create_title.sql
-- SHOWSHAK — TITLE SEARCH + CREATE-IF-MISSING  (Curator Upload v2, Req 1)
-- ───────────────────────────────────────────────────────────────
-- Curators link clips to REAL `titles` rows. Searching titles already
-- works (public SELECT grant from 0002 + read_titles RLS). What's
-- missing is letting a curator ADD a title that isn't in the catalog
-- yet — WITHOUT opening raw INSERT on the shared `titles` table (that
-- would let any client spam or duplicate the catalog).
--
-- Solution: a SECURITY DEFINER function find_or_create_title(name, year)
-- that DEDUPLICATES (case-insensitive name, preferring an exact year
-- match) and inserts a new row ONLY when none exists, returning the
-- title id either way. Because it is SECURITY DEFINER it can write to
-- `titles` even though the caller's role cannot — but it can only ever
-- set name/year/meta, never arbitrary columns. Mirrors the security
-- posture of public.sync_fires_count (SECURITY DEFINER + locked
-- search_path) from 0008.
--
-- New titles are created with tmdb_id = NULL, so the existing local
-- TMDB ingest (data/ingest-tmdb.js, which selects rows WHERE tmdb_id IS
-- NULL) automatically enriches them with genres + region-aware
-- providers on its next run. meta.source='curator' tags the origin.
--
-- SAFE / ADDITIVE (a new function + grant). Idempotent (create or
-- replace + idempotent grant). Run: SQL Editor → paste → Run.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.find_or_create_title(p_name text, p_year int default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_name text := btrim(coalesce(p_name, ''));
begin
  -- A title must have a name.
  if length(v_name) = 0 then
    raise exception 'find_or_create_title: name is required';
  end if;

  -- 1) Prefer an exact (case-insensitive name + same year) match.
  if p_year is not null then
    select id into v_id
    from titles
    where deleted_at is null
      and lower(name) = lower(v_name)
      and year = p_year
    limit 1;
  end if;

  -- 2) Fall back to a name match where the existing row has no year
  --    (or the caller gave no year) — avoids creating a near-duplicate.
  if v_id is null then
    select id into v_id
    from titles
    where deleted_at is null
      and lower(name) = lower(v_name)
      and (p_year is null or year is null)
    order by created_at asc
    limit 1;
  end if;

  if v_id is not null then
    return v_id;                        -- found → reuse it (no duplicate)
  end if;

  -- 3) Not found → create it. tmdb_id stays NULL so the TMDB ingest
  --    script enriches genres + providers later. Only name/year/meta set.
  insert into titles (name, year, meta)
  values (v_name, p_year, jsonb_build_object('source', 'curator'))
  returning id into v_id;

  return v_id;
end;
$$;

-- Only authenticated users (curators) may call it; guests cannot upload
-- and so never need to create titles.
grant execute on function public.find_or_create_title(text, int) to authenticated;

-- Reload PostgREST so the RPC is callable immediately.
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- DONE. The browser can:
--   • SEARCH titles directly (existing public SELECT), and
--   • call rpc('find_or_create_title', { p_name, p_year }) to get back a
--     title id, creating the row (dedup'd) only when it's new.
-- New curator-added titles (tmdb_id NULL) are picked up by the next
-- `node data/ingest-tmdb.js` run for Watch It providers + genres.
-- Next task: auto-genres from linked titles.
-- ═══════════════════════════════════════════════════════════════
