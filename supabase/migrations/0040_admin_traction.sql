-- ═══════════════════════════════════════════════════════════════
-- 0040_admin_traction.sql
-- SHOWSHAK — ADMIN TRACTION DASHBOARD  (founder analytics)
-- ───────────────────────────────────────────────────────────────
-- ADDITIVE ONLY. Two admin-gated SECURITY DEFINER RPCs that return
-- AGGREGATES ONLY (never raw event rows, never per-user data):
--
--   1. admin_traction_summary()      → one JSON blob of headline numbers
--   2. admin_traction_daily(days)    → per-day rows for the trend table
--
-- Security posture mirrors every privileged helper in this schema
-- (0008/0016/0019/0025/0029/0034): SECURITY DEFINER + locked
-- search_path, gated on ss_is_admin() (which 0034 refined to accept
-- the per-user users.is_admin flag). A non-admin caller gets an
-- exception; RLS remains the boundary for the underlying tables.
--
-- HONEST-METRICS NOTES (encoded in the queries):
--   • "Active" = had a view_event or watch_event that day. Guests
--     (user_id null) can't be counted as DISTINCT people — we report
--     guest EVENT volume separately, never fabricate a guest count.
--   • time_spent = clip watch time (view_events.watch_ms), not full
--     session time — we don't run session tracking. Label it as such.
--   • D1/D7 retention = of users who signed up in the window, the %
--     with any activity ≥1 (resp. ≥7) days after their signup DAY.
--     Only cohorts old enough to have had the chance are counted.
--
-- Idempotent. Run: Supabase SQL Editor → paste → Run.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Headline summary ──
create or replace function public.admin_traction_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  result jsonb;
begin
  if not ss_is_admin() then
    raise exception 'admin only';
  end if;

  select jsonb_build_object(
    'generated_at', now(),

    -- ── people ──
    'total_users',      (select count(*) from users where deleted_at is null and coalesce(is_guest,false) = false),
    'total_guests',     (select count(*) from users where deleted_at is null and is_guest = true),
    'total_curators',   (select count(*) from users where deleted_at is null and role = 'curator'),
    'verified_curators',(select count(*) from users where deleted_at is null and role = 'curator' and verified = true),
    'pending_apps',     (select count(*) from curator_application where status = 'pending'),

    -- ── growth ──
    'new_users_today',  (select count(*) from users where deleted_at is null and coalesce(is_guest,false) = false
                           and created_at >= date_trunc('day', now())),
    'new_users_7d',     (select count(*) from users where deleted_at is null and coalesce(is_guest,false) = false
                           and created_at >= now() - interval '7 days'),
    'new_users_30d',    (select count(*) from users where deleted_at is null and coalesce(is_guest,false) = false
                           and created_at >= now() - interval '30 days'),

    -- ── activity (last 7 days) ──
    'active_users_today', (select count(distinct user_id) from (
                             select user_id from view_events  where user_id is not null and created_at >= date_trunc('day', now())
                             union all
                             select user_id from watch_events where user_id is not null and created_at >= date_trunc('day', now())
                           ) t),
    'active_users_7d',    (select count(distinct user_id) from (
                             select user_id from view_events  where user_id is not null and created_at >= now() - interval '7 days'
                             union all
                             select user_id from watch_events where user_id is not null and created_at >= now() - interval '7 days'
                           ) t),
    -- users active on ≥2 distinct days in the last 7 → genuinely coming back
    'returning_users_7d', (select count(*) from (
                             select user_id
                             from (select user_id, date_trunc('day', created_at) as d
                                     from view_events where user_id is not null and created_at >= now() - interval '7 days'
                                   union
                                   select user_id, date_trunc('day', created_at)
                                     from watch_events where user_id is not null and created_at >= now() - interval '7 days') e
                             group by user_id
                             having count(distinct d) >= 2
                           ) t),

    -- ── engagement (last 7 days) ──
    'views_7d',        (select count(*) from view_events  where created_at >= now() - interval '7 days'),
    'watch_its_7d',    (select count(*) from watch_events where created_at >= now() - interval '7 days'),
    'fires_7d',        (select count(*) from content_fires where created_at >= now() - interval '7 days' and deleted_at is null),
    'guest_views_7d',  (select count(*) from view_events  where user_id is null and created_at >= now() - interval '7 days'),
    'watch_minutes_7d',(select coalesce(round(sum(watch_ms) / 60000.0), 0) from view_events
                           where created_at >= now() - interval '7 days'),
    -- avg clip-watch minutes per active signed-in user, last 7 days
    'avg_min_per_active_7d', (select case when count(distinct user_id) = 0 then 0
                                     else round((sum(watch_ms) / 60000.0) / count(distinct user_id), 1) end
                                from view_events
                                where user_id is not null and created_at >= now() - interval '7 days'),

    -- ── retention (cohorts old enough to qualify) ──
    -- D1: signed up 2–30 days ago; any activity ≥1 day after signup day.
    'd1_retention_pct', (
      with cohort as (
        select id, date_trunc('day', created_at) as d0 from users
        where deleted_at is null and coalesce(is_guest,false) = false
          and created_at between now() - interval '30 days' and now() - interval '2 days'
      ),
      came_back as (
        select distinct c.id from cohort c
        where exists (select 1 from view_events  v where v.user_id = c.id and v.created_at >= c.d0 + interval '1 day')
           or exists (select 1 from watch_events w where w.user_id = c.id and w.created_at >= c.d0 + interval '1 day')
      )
      select case when (select count(*) from cohort) = 0 then null
             else round(100.0 * (select count(*) from came_back) / (select count(*) from cohort)) end
    ),
    -- D7: signed up 8–60 days ago; any activity ≥7 days after signup day.
    'd7_retention_pct', (
      with cohort as (
        select id, date_trunc('day', created_at) as d0 from users
        where deleted_at is null and coalesce(is_guest,false) = false
          and created_at between now() - interval '60 days' and now() - interval '8 days'
      ),
      came_back as (
        select distinct c.id from cohort c
        where exists (select 1 from view_events  v where v.user_id = c.id and v.created_at >= c.d0 + interval '7 days')
           or exists (select 1 from watch_events w where w.user_id = c.id and w.created_at >= c.d0 + interval '7 days')
      )
      select case when (select count(*) from cohort) = 0 then null
             else round(100.0 * (select count(*) from came_back) / (select count(*) from cohort)) end
    ),

    -- ── content ──
    'live_clips',      (select count(*) from content where status = 'live' and deleted_at is null)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_traction_summary() from public;
grant execute on function public.admin_traction_summary() to authenticated;

-- ── 2. Daily trend (last N days, capped 1–90) ──
create or replace function public.admin_traction_daily(days int default 14)
returns table (
  day           date,
  new_users     int,
  active_users  int,
  views         int,
  guest_views   int,
  watch_its     int,
  fires         int,
  watch_minutes int
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  n int := greatest(1, least(coalesce(days, 14), 90));
begin
  if not ss_is_admin() then
    raise exception 'admin only';
  end if;

  return query
  with span as (
    select generate_series(
      date_trunc('day', now())::date - (n - 1),
      date_trunc('day', now())::date,
      interval '1 day'
    )::date as d
  )
  select
    s.d,
    (select count(*)::int from users u
       where u.deleted_at is null and coalesce(u.is_guest,false) = false
         and u.created_at >= s.d and u.created_at < s.d + 1),
    (select count(distinct t.user_id)::int from (
       select v.user_id from view_events v
         where v.user_id is not null and v.created_at >= s.d and v.created_at < s.d + 1
       union all
       select w.user_id from watch_events w
         where w.user_id is not null and w.created_at >= s.d and w.created_at < s.d + 1
     ) t),
    (select count(*)::int from view_events v where v.created_at >= s.d and v.created_at < s.d + 1),
    (select count(*)::int from view_events v
       where v.user_id is null and v.created_at >= s.d and v.created_at < s.d + 1),
    (select count(*)::int from watch_events w where w.created_at >= s.d and w.created_at < s.d + 1),
    (select count(*)::int from content_fires f
       where f.deleted_at is null and f.created_at >= s.d and f.created_at < s.d + 1),
    (select coalesce(round(sum(v.watch_ms) / 60000.0), 0)::int from view_events v
       where v.created_at >= s.d and v.created_at < s.d + 1)
  from span s
  order by s.d desc;
end;
$$;

revoke all on function public.admin_traction_daily(int) from public;
grant execute on function public.admin_traction_daily(int) to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- DONE. Both functions raise 'admin only' for non-admins; aggregates
-- only, no raw rows, no per-user output. HIDE THE SCOREBOARD is about
-- users never seeing counts — the founder seeing traction is the job.
-- ═══════════════════════════════════════════════════════════════
