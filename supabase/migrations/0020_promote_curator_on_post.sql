-- ═══════════════════════════════════════════════════════════════
-- 0020_promote_curator_on_post.sql
-- SHOWSHAK — "YOU POST, YOU'RE A CREATOR" (publish-time role promotion)
-- ───────────────────────────────────────────────────────────────
-- When a content row is inserted, promote its author to 'curator' if
-- they are not one already. Mirrors the 0003 handle_new_user pattern:
-- security definer + set search_path = public + create-or-replace fn +
-- drop-trigger-if-exists / create-trigger. Additive and re-runnable.
--
-- WHY A TRIGGER (not client code): it fires for EVERY content insert
-- uniformly and cannot be skipped or raced by the browser. It writes
-- public.users (NOT public.content), so there is no recursion. It never
-- demotes and never aborts the insert.
--
-- Run: Supabase → SQL Editor → paste → Run.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.promote_curator_on_post()
returns trigger
language plpgsql
security definer                 -- runs with owner rights, so it can write users
set search_path = public
as $$
begin
  -- Promote only the AUTHOR of the inserted row, and only when their
  -- role is not already 'curator'. `is distinct from` makes this a no-op
  -- for existing curators and tolerates NULL role. Never sets 'user'.
  update public.users
     set role = 'curator'
   where id = new.creator_id
     and role is distinct from 'curator';

  -- Always return NEW so the content insert persists regardless of
  -- whether any users row matched (e.g. no matching author row).
  return new;
end;
$$;

drop trigger if exists on_content_promote_curator on public.content;
create trigger on_content_promote_curator
  after insert on public.content
  for each row execute function public.promote_curator_on_post();

-- Reload PostgREST so nothing is stale after apply (idempotent, harmless).
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- DONE. Any content insert now promotes its author to 'curator' unless
-- they already are one. Existing curators are untouched; guests (no
-- creator_id match) are never promoted; the insert always succeeds.
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- ONE-TIME BACKFILL + DOCUMENTED REVERSAL (FOUNDER-RUN)
-- ───────────────────────────────────────────────────────────────
-- The block below is NOT part of the trigger above. It is a run-once,
-- founder-approved data fix plus a documented undo. Run the BACKFILL
-- exactly once in the Supabase SQL editor; run the REVERSAL only if you
-- need to undo it. (See FOUNDER-RUN task 8 in the spec.)
-- ═══════════════════════════════════════════════════════════════

-- ── ONE-TIME BACKFILL (run once; founder-approved) ──
-- Promote every account that already published a qualifying live clip
-- (its own, status='live', not deleted). Notes on safety:
--   • Idempotent: the role = 'user' guard means re-running changes
--     nothing — already-promoted accounts no longer match the guard.
--   • Never touches curators without qualifying clips beyond this
--     explicit selection; the exists(...) selection is the only filter.
--   • Only ever SETS 'curator' here — it never demotes anyone.
update public.users u
   set role = 'curator'
 where u.role = 'user'
   and exists (
     select 1 from public.content c
      where c.creator_id = u.id
        and c.status = 'live'
        and c.deleted_at is null
   );

-- ── REVERSAL (documented; run ONLY to undo the backfill) ──
-- Sets role back to 'user' for accounts matching the IDENTICAL selection
-- (at least one own live, non-deleted clip). It alters no other row.
-- NOTE: this reversal will ALSO affect accounts later promoted by the
-- publish trigger above — by definition they match the same "has posted"
-- criterion (own live, non-deleted clip), so they are indistinguishable
-- from backfilled accounts by this selection. Run only if you truly mean
-- to undo "you post, you're a creator" for everyone who has posted.
update public.users u
   set role = 'user'
 where u.role = 'curator'
   and exists (
     select 1 from public.content c
      where c.creator_id = u.id
        and c.status = 'live'
        and c.deleted_at is null
   );
