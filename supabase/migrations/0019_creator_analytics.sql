-- ═══════════════════════════════════════════════════════════════
-- 0019_creator_analytics.sql
-- SHOWSHAK — CREATOR ANALYTICS  (creator-analytics feature)
-- ───────────────────────────────────────────────────────────────
-- ADDITIVE ONLY. No new tables, no data changes. This migration:
--   1. Grants INSERT (not SELECT) on the three event tables to the
--      anon + authenticated API roles, so the browser can record
--      events but can never read raw event rows.
--   2. Enables RLS on those tables with anti-spoofing WITH CHECK
--      insert policies: a signed-in user_id must equal auth.uid(),
--      a guest user_id must be null, anything else is rejected.
--   3. Adds owner-scoped SECURITY DEFINER reader functions that
--      return ONLY aggregates for the caller's own clips, applying
--      the Self_Activity collapse + per-user fire counting on read.
--
-- Security posture mirrors public.sync_fires_count (0008) and
-- public.find_or_create_title (0016): SECURITY DEFINER + locked
-- search_path + EXECUTE granted to authenticated.
--
-- Idempotent. Run: Supabase SQL Editor → paste → Run.
-- ═══════════════════════════════════════════════════════════════

-- Make sure the API roles can use the schema at all (idempotent).
grant usage on schema public to anon, authenticated;

-- ── 1. INSERT grants (NO select grant — Req 5.1, 6.1) ──
grant insert on table view_events  to anon, authenticated;
grant insert on table watch_events to anon, authenticated;
grant insert on table share_events to anon, authenticated;

-- ── 2. Anti-spoofing INSERT RLS (Req 5.2–5.5) ──
-- `user_id IS NOT DISTINCT FROM auth.uid()` captures the whole rule:
--   • authenticated: auth.uid() is the caller → user_id must equal it
--   • anon (guest):  auth.uid() is null       → user_id must be null
--   • anything else (forging another id, or a guest sending an id) → rejected
-- No SELECT/UPDATE/DELETE policy is added, so with RLS enabled and no
-- select grant, raw rows are unreadable by anon/authenticated (Req 6.3).

alter table view_events  enable row level security;
alter table watch_events enable row level security;
alter table share_events enable row level security;

drop policy if exists view_events_insert_guarded on view_events;
create policy view_events_insert_guarded on view_events
  for insert to anon, authenticated
  with check (user_id is not distinct from auth.uid());

drop policy if exists watch_events_insert_guarded on watch_events;
create policy watch_events_insert_guarded on watch_events
  for insert to anon, authenticated
  with check (user_id is not distinct from auth.uid());

drop policy if exists share_events_insert_guarded on share_events;
create policy share_events_insert_guarded on share_events
  for insert to anon, authenticated
  with check (user_id is not distinct from auth.uid());

-- ── 3. Owner-scoped aggregate readers (Req 7, 12.1) ──
-- SECURITY DEFINER lets these read the raw event tables (which the
-- caller's role cannot), but they only ever RETURN aggregates for the
-- caller's own clips. STABLE: no writes, safe to run in a read txn.

-- 3a. Cockpit totals (Req 7.2, 8.1, 8.2)
create or replace function public.creator_analytics_totals()
returns table (
  fires_received bigint,
  watch_count    bigint,
  reach          bigint,
  share_count    bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with my_clips as (
    select id, creator_id
    from content
    where creator_id = auth.uid()
      and deleted_at is null
  )
  select
    -- Fires: one row per (user, clip) already, so count(*) = at most one
    -- per user per clip, owner's own fire included (Req 4.4, 7.7).
    (select count(*) from content_fires cf
       join my_clips c on c.id = cf.content_id
      where cf.deleted_at is null)::bigint,
    -- Watch Its: every tap, no collapse (Req 2.8, 7.7).
    (select count(*) from watch_events we
       join my_clips c on c.id = we.content_id)::bigint,
    -- Reach: non-owner views counted each + 1 per clip with any self-view
    -- (Req 1.7–1.9, 7.6).
    ( (select count(*) from view_events ve
         join my_clips c on c.id = ve.content_id
        where ve.user_id is distinct from c.creator_id)
      + (select count(distinct c.id) from view_events ve
           join my_clips c on c.id = ve.content_id
          where ve.user_id = c.creator_id) )::bigint,
    -- Shares: same collapse shape as Reach (Req 3.6–3.7, 7.6).
    ( (select count(*) from share_events se
         join my_clips c on c.id = se.content_id
        where se.user_id is distinct from c.creator_id)
      + (select count(distinct c.id) from share_events se
           join my_clips c on c.id = se.content_id
          where se.user_id = c.creator_id) )::bigint;
$$;

-- 3b. Weekly 7-day trend, zero-filled (Req 9)
create or replace function public.creator_analytics_weekly()
returns table (
  day       date,
  views     bigint,
  watch_its bigint,
  shares    bigint,
  fires     bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with my_clips as (
    select id, creator_id
    from content
    where creator_id = auth.uid()
      and deleted_at is null
  ),
  days as (                                   -- last 7 calendar days (Req 9.1, 13.4)
    select (current_date - g)::date as day
    from generate_series(0, 6) as g
  ),
  -- Views: non-owner per (day) + 1 per (clip, day) with any self-view (Req 9.5)
  v_nonself as (
    select ve.created_at::date as day, count(*) as n
    from view_events ve join my_clips c on c.id = ve.content_id
    where ve.user_id is distinct from c.creator_id
      and ve.created_at >= current_date - 6
    group by 1
  ),
  v_self as (
    select ve.created_at::date as day, count(distinct c.id) as n
    from view_events ve join my_clips c on c.id = ve.content_id
    where ve.user_id = c.creator_id
      and ve.created_at >= current_date - 6
    group by 1
  ),
  -- Shares: same collapse shape (Req 9.5)
  s_nonself as (
    select se.created_at::date as day, count(*) as n
    from share_events se join my_clips c on c.id = se.content_id
    where se.user_id is distinct from c.creator_id
      and se.created_at >= current_date - 6
    group by 1
  ),
  s_self as (
    select se.created_at::date as day, count(distinct c.id) as n
    from share_events se join my_clips c on c.id = se.content_id
    where se.user_id = c.creator_id
      and se.created_at >= current_date - 6
    group by 1
  ),
  -- Watch Its: every tap (Req 9.5)
  w_all as (
    select we.created_at::date as day, count(*) as n
    from watch_events we join my_clips c on c.id = we.content_id
    where we.created_at >= current_date - 6
    group by 1
  ),
  -- Fires: at most one per (user, clip); bucket by created_at day
  f_all as (
    select cf.created_at::date as day, count(*) as n
    from content_fires cf join my_clips c on c.id = cf.content_id
    where cf.deleted_at is null
      and cf.created_at >= current_date - 6
    group by 1
  )
  select
    d.day,
    (coalesce(vn.n, 0) + coalesce(vs.n, 0))::bigint as views,
    coalesce(w.n, 0)::bigint                        as watch_its,
    (coalesce(sn.n, 0) + coalesce(ss.n, 0))::bigint as shares,
    coalesce(f.n, 0)::bigint                        as fires
  from days d
  left join v_nonself vn on vn.day = d.day
  left join v_self    vs on vs.day = d.day
  left join s_nonself sn on sn.day = d.day
  left join s_self    ss on ss.day = d.day
  left join w_all     w  on w.day  = d.day
  left join f_all     f  on f.day  = d.day
  order by d.day;
$$;

-- 3c. Per-clip stats (Req 10)
create or replace function public.creator_analytics_per_clip()
returns table (
  content_id uuid,
  fires      bigint,
  views      bigint,
  watch_its  bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with my_clips as (
    select id, creator_id
    from content
    where creator_id = auth.uid()
      and deleted_at is null
  )
  select
    c.id,
    (select count(*) from content_fires cf
      where cf.content_id = c.id and cf.deleted_at is null)::bigint,
    ( (select count(*) from view_events ve
         where ve.content_id = c.id and ve.user_id is distinct from c.creator_id)
      + (case when exists (select 1 from view_events ve
                            where ve.content_id = c.id and ve.user_id = c.creator_id)
              then 1 else 0 end) )::bigint,
    (select count(*) from watch_events we
      where we.content_id = c.id)::bigint
  from my_clips c;
$$;

-- ── EXECUTE grants: authenticated only (Req 7.5). Guests have no cockpit. ──
grant execute on function public.creator_analytics_totals()   to authenticated;
grant execute on function public.creator_analytics_weekly()   to authenticated;
grant execute on function public.creator_analytics_per_clip() to authenticated;

-- Reload PostgREST so the new grants + RPCs are live immediately.
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- DONE. The browser can now record view/watch/share events (guarded),
-- never read raw rows, and read owner-scoped aggregates via
-- rpc('creator_analytics_totals' | 'creator_analytics_weekly' |
-- 'creator_analytics_per_clip').
-- ═══════════════════════════════════════════════════════════════
