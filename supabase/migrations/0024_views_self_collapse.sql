-- ═══════════════════════════════════════════════════════════════
-- 0024_views_self_collapse.sql
-- SHOWSHAK — VIEWS COUNT: collapse the curator's own re-watches to ONE
-- ───────────────────────────────────────────────────────────────
-- THE RULE (one canonical "views" number shown EVERYWHERE — feed, discover,
-- clip cards, public + owner profile):
--   • A NON-OWNER (any other user, or a guest) viewing a clip counts EVERY
--     time (the recorder de-dupes per session, so it's effectively per visit).
--   • The CLIP'S OWN CREATOR re-watching their clip counts only ONCE, no
--     matter how many times they replay it.
--
-- WHY THIS MIGRATION: the public count lives in the cached column
-- `content.views_count`, maintained by the 0021 AFTER-INSERT trigger
-- `sync_views_count`, which currently does a blind `+1` on EVERY view_event —
-- so a curator replaying their own clip inflates the public number. The
-- owner-only analytics (0019 `creator_analytics_per_clip` / `_totals` /
-- `_weekly`) ALREADY apply the collapse rule
-- (`count(non-owner views) + (1 if any self-view)`), which is why the card's
-- eye overlay (from views_count) and the analytics row disagreed.
--
-- This migration rewrites `sync_views_count` to apply the SAME collapse rule
-- the analytics use, and re-backfills `content.views_count` to match. After
-- this, views_count == the analytics reach for every clip, so the number is
-- identical on every surface.
--
-- GOLDEN RULE preserved: the cache is DERIVED from the event rows; the rows
-- stay the source of truth (view_events is append-only — nothing is deleted).
--
-- SAFE / additive (replaces a function + re-backfills). Idempotent
-- (create or replace + the backfill SETS the exact value). Run: SQL Editor.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.sync_views_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator     uuid;
  v_owner_views int;
begin
  if (tg_op <> 'INSERT') then
    return null;
  end if;

  -- Who owns the clip this view is for?
  select creator_id into v_creator from content where id = new.content_id;

  if new.user_id is distinct from v_creator then
    -- Non-owner (a different user) or a guest (user_id null): counts every time.
    update content
       set views_count = coalesce(views_count, 0) + 1
     where id = new.content_id;
  else
    -- The creator re-watching their OWN clip: count only the FIRST self-view.
    -- The trigger fires AFTER INSERT, so exactly one self-view row existing now
    -- means this insert is the first — bump once; any later replay is a no-op.
    select count(*) into v_owner_views
      from view_events
     where content_id = new.content_id
       and user_id = v_creator;
    if v_owner_views = 1 then
      update content
         set views_count = coalesce(views_count, 0) + 1
       where id = new.content_id;
    end if;
  end if;

  return null;
end;
$$;

-- (The trigger itself is unchanged from 0021; recreate idempotently in case
--  this migration is applied on a DB where 0021 was never run.)
drop trigger if exists trg_sync_views_count on view_events;
create trigger trg_sync_views_count
  after insert on view_events
  for each row execute function public.sync_views_count();

-- ── RE-BACKFILL content.views_count with the collapse rule ──
-- views_count = (# non-owner view rows) + (1 if the owner has ANY self-view).
-- This SETS the exact value, so it is safe to re-run and reconciles any clips
-- inflated by the old blind-+1 trigger. Matches creator_analytics_per_clip.
update content c
   set views_count = (
     (select count(*) from view_events ve
        where ve.content_id = c.id
          and ve.user_id is distinct from c.creator_id)
     + (case when exists (
            select 1 from view_events ve
             where ve.content_id = c.id
               and ve.user_id = c.creator_id)
          then 1 else 0 end)
   );

-- Reload PostgREST so nothing is stale after apply (idempotent, harmless).
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- DONE. content.views_count now follows the same self-collapse rule as the
-- owner analytics, so the clip "views" number is identical on every surface
-- (feed, discover, cards, public profile, owner profile + analytics). A
-- curator replaying their own clip no longer inflates it; other users' and
-- guests' views still accumulate per visit.
-- ═══════════════════════════════════════════════════════════════
