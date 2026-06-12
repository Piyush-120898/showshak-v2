-- ═══════════════════════════════════════════════════════════════
-- 0017_sync_content_genres.sql
-- SHOWSHAK — AUTO-GENRES FROM LINKED TITLES  (Curator Upload v2, Req 3)
-- ───────────────────────────────────────────────────────────────
-- ⚠️ FOUNDER ACTION REQUIRED: apply this migration MANUALLY in the
--    Supabase SQL editor (paste → Run) BEFORE auto-genres can be
--    verified. Kiro cannot run SQL against the live database; the
--    re-runnable check in data/_verify_upload_v2.js only passes once
--    this file has been applied to the project.
-- ───────────────────────────────────────────────────────────────
-- The prototype never wrote content_genres, so uploaded clips were
-- invisible to Discover. v2 DERIVES a clip's genres from the titles it
-- links: content_genres becomes the de-duplicated UNION of the genres
-- of every title in content_titles. Derivation (not curator input) is
-- the source of truth, and re-running it is idempotent — it always
-- reflects the clip's CURRENT links (so edit-after-post re-derives too,
-- Req 10.4).
--
-- HOW THE GENRES REACH THE TITLES: data/ingest-tmdb.js stores the TMDB
-- genre NAMES on titles.meta->'genres' (a jsonb array of strings). This
-- function reads exactly that key. Curator-created titles (tmdb_id NULL)
-- carry no genres until the next ingest run — which is fine: a title
-- with no genres contributes nothing and never blocks publish (Req 3.3).
--
-- SECURITY POSTURE: SECURITY DEFINER + locked search_path + EXECUTE to
-- authenticated, mirroring find_or_create_title (0016) and
-- sync_fires_count (0008). The function may create a missing `genres`
-- row and rewrite the clip's `content_genres`, even though the caller's
-- role cannot write those shared tables directly — but it can only ever
-- touch genres derived from the clip's own linked titles. RLS still
-- governs who may change content_titles (0014), which is what fires the
-- trigger, so a curator can only ever re-derive genres for their OWN
-- clips.
--
-- SAFE / ADDITIVE per supabase/SCHEMA_CHANGE_PROCESS.md (a new function
-- + trigger + execute grant — no table/column dropped, renamed, or
-- retyped). Idempotent: `create or replace function`,
-- `drop trigger if exists`, idempotent grant. The SQL editor runs the
-- file as ONE transaction, so it cannot half-apply.
--
-- Run: SQL Editor → paste → Run.
-- ═══════════════════════════════════════════════════════════════

-- API roles must be able to use the schema at all (idempotent).
grant usage on schema public to authenticated;

-- ───────────────────────────────────────────────────────────────
-- 1. FUNCTION — sync_content_genres(p_content_id)
--    Rebuild content_genres for ONE clip as the de-duplicated union of
--    the genres of all titles linked in content_titles.
-- ───────────────────────────────────────────────────────────────
create or replace function public.sync_content_genres(p_content_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_gid  uuid;
begin
  if p_content_id is null then
    return;                              -- nothing to derive
  end if;

  -- Rebuild this clip's genres from scratch so the result always
  -- reflects the CURRENT links (idempotent; safe to re-run any time).
  delete from content_genres where content_id = p_content_id;

  -- Walk the DISTINCT genre names contributed by every title linked to
  -- this clip. Each linked title carries its genres as a jsonb array of
  -- names at titles.meta->'genres' (written by the TMDB ingest). A title
  -- whose meta.genres is missing, empty, or not an array yields no rows
  -- here, so it contributes nothing and never blocks (Req 3.3). Blank
  -- names are skipped, and `distinct` collapses duplicates across titles
  -- (the union, Req 3.2). No temp table is used, so the trigger may call
  -- this many times within one statement without collision.
  for v_name in
    select distinct btrim(g.value)
    from content_titles ct
    join titles t on t.id = ct.title_id
    cross join lateral jsonb_array_elements_text(
      case
        when jsonb_typeof(t.meta -> 'genres') = 'array' then t.meta -> 'genres'
        else '[]'::jsonb
      end
    ) as g(value)
    where ct.content_id = p_content_id
      and btrim(g.value) <> ''
  loop
    -- Resolve the name to a genres.id case-insensitively, CREATING the
    -- genre row if it does not exist yet (tagged meta.source='auto').
    select id into v_gid
    from genres
    where deleted_at is null
      and lower(name) = lower(v_name)
    order by created_at asc nulls last
    limit 1;

    if v_gid is null then
      insert into genres (name, meta)
      values (v_name, jsonb_build_object('source', 'auto'))
      returning id into v_gid;
    end if;

    -- Link it. The PK (content_id, genre_id) + ON CONFLICT keeps the
    -- union duplicate-free even when two names resolve to one genre id.
    insert into content_genres (content_id, genre_id)
    values (p_content_id, v_gid)
    on conflict (content_id, genre_id) do nothing;
  end loop;
end;
$$;

-- Only authenticated users (curators) drive the upload/edit flow that
-- changes links, so EXECUTE is granted to authenticated (mirrors 0016).
grant execute on function public.sync_content_genres(uuid) to authenticated;

-- ───────────────────────────────────────────────────────────────
-- 2. TRIGGER — keep content_genres following content_titles.
--    FOR EACH STATEMENT, re-derive the genres of every clip touched by
--    the statement (covers multi-row inserts on publish and the
--    delete+insert re-link on edit-after-post, Req 10.4).
--
--    WHY TWO TRIGGERS (one for INSERT, one for DELETE) INSTEAD OF ONE
--    `after insert or delete`: PostgreSQL forbids transition tables
--    (`referencing ... new/old table`) on a trigger that fires for more
--    than one event — it raises
--      "transition tables cannot be specified for triggers with more
--       than one event".
--    A statement-level trigger has no per-row NEW/OLD, so the only way to
--    learn which content_id(s) the statement touched is via a transition
--    table. We therefore split into two single-event statement triggers:
--    the INSERT trigger exposes NEW TABLE (the linked rows), the DELETE
--    trigger exposes OLD TABLE (the unlinked rows). Both call ONE shared
--    trigger function that picks the right transition table by TG_OP and
--    re-derives each affected clip exactly once (DISTINCT). This keeps the
--    per-statement efficiency of the design while staying valid SQL.
-- ───────────────────────────────────────────────────────────────
create or replace function public.tg_sync_content_genres()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cid uuid;
begin
  -- Re-derive each affected clip exactly once. Only the transition table
  -- that belongs to this event's trigger is referenced (guarded by TG_OP),
  -- so PL/pgSQL never plans a query against a non-existent relation.
  if tg_op = 'INSERT' then
    for v_cid in select distinct content_id from new_rows loop
      perform public.sync_content_genres(v_cid);
    end loop;
  elsif tg_op = 'DELETE' then
    for v_cid in select distinct content_id from old_rows loop
      perform public.sync_content_genres(v_cid);
    end loop;
  end if;
  return null;                           -- AFTER STATEMENT trigger
end;
$$;

-- INSERT: re-derive genres for every clip that gained title links
-- (multi-row publish inserts all link rows in one statement → one fire).
drop trigger if exists trg_content_titles_sync_genres_ins on public.content_titles;
create trigger trg_content_titles_sync_genres_ins
  after insert on public.content_titles
  referencing new table as new_rows
  for each statement
  execute function public.tg_sync_content_genres();

-- DELETE: re-derive genres for every clip that lost title links
-- (edit-after-post unlinks the old set, then re-inserts the new set).
drop trigger if exists trg_content_titles_sync_genres_del on public.content_titles;
create trigger trg_content_titles_sync_genres_del
  after delete on public.content_titles
  referencing old table as old_rows
  for each statement
  execute function public.tg_sync_content_genres();

-- Tell PostgREST to reload so the new function + trigger are live.
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- DONE. content_genres now follows content_titles automatically:
--   • INSERT links on publish  → genres derived as the titles' union
--     (one statement-level fire via the NEW TABLE transition relation)
--   • DELETE + re-INSERT on edit → genres re-derived (idempotent), each
--     event handled by its own single-event trigger (PostgreSQL forbids
--     transition tables on a multi-event trigger)
--   • titles with no meta.genres contribute nothing (never blocks)
-- Verify with: node data/_verify_upload_v2.js  (after applying this file)
-- Next task: enhance data/ingest-tmdb.js to store meta.genres on titles.
-- ═══════════════════════════════════════════════════════════════
