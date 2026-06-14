-- ═══════════════════════════════════════════════════════════════
-- 0021_sync_views_count.sql
-- SHOWSHAK — KEEP content.views_count IN SYNC (clip "views" trust signal)
-- ───────────────────────────────────────────────────────────────
-- The clip cards now show a public VIEWS count (eye icon) next to the
-- fire count, as a trust/social-proof signal — distinct from the private
-- Watch-It analytics, which stay owner-only (RLS, migration 0019).
--
-- view_events already records a (dwell-gated, per-session-deduped) view
-- row for each clip (see Event_Recorder in showshak-shared.js). But the
-- browser CANNOT read view_events (0019 grants INSERT, not SELECT), so the
-- public count must come from the cached content.views_count column, which
-- is publicly readable on live clips (read_live_content, 0001).
--
-- This migration adds an AFTER INSERT trigger on view_events that bumps
-- content.views_count, exactly mirroring sync_fires_count (0006/0008):
-- SECURITY DEFINER + locked search_path so it can update content even
-- though the inserting role cannot. view_events is append-only (no
-- delete / no deleted_at), so only the INSERT path is needed.
--
-- GOLDEN RULE preserved: the cache is DERIVED from event rows; the rows
-- remain the source of truth. A one-time backfill below reconciles the
-- cache with any view_events already recorded before this trigger existed.
--
-- SAFE / additive (a function + trigger + idempotent backfill). Re-runnable
-- (create or replace + drop trigger if exists). Run: SQL Editor → paste → Run.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.sync_views_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update content
       set views_count = coalesce(views_count, 0) + 1
     where id = new.content_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_views_count on view_events;
create trigger trg_sync_views_count
  after insert on view_events
  for each row execute function public.sync_views_count();

-- ── ONE-TIME BACKFILL (idempotent re-sync of the cache from the rows) ──
-- Recomputes content.views_count from the actual view_events rows so the
-- cache reflects views recorded before this trigger was installed. Safe to
-- re-run: it SETS the count to the exact row count each time. Clips with no
-- view_events are reset to 0 (still the truth).
update content c
   set views_count = sub.n
  from (
    select content_id, count(*)::int as n
    from view_events
    where content_id is not null
    group by content_id
  ) sub
 where sub.content_id = c.id;

-- Clips that have zero recorded views should read 0 (not a stale cache).
update content c
   set views_count = 0
 where not exists (select 1 from view_events ve where ve.content_id = c.id)
   and coalesce(c.views_count, 0) <> 0;

-- Reload PostgREST so nothing is stale after apply (idempotent, harmless).
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- DONE. content.views_count now stays accurate as views are recorded,
-- and the public clip cards read it as the "views" trust signal. The
-- private Watch-It / reach analytics are untouched (still owner-only).
-- ═══════════════════════════════════════════════════════════════
