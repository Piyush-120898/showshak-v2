-- ═══════════════════════════════════════════════════════════════
--  ShowShak — DATA RESET  (fresh start: wipe all user/operational data)
--  Run in the Supabase SQL editor on the CORRECT project. IRREVERSIBLE.
--
--  KEEPS (do NOT wipe — these are seeds/config the app needs):
--    • policy_versions  → wiping it fail-closes the consent gate = nobody can log in
--    • platforms, genres, moods → catalog seeds for upload + filters
--
--  WIPES: every row of user/operational data, schema untouched.
--  This does NOT touch Supabase Auth users, Storage objects, or Mux assets —
--  see the playbook for those three (they are separate stores).
-- ═══════════════════════════════════════════════════════════════

begin;

truncate table
  content_fires,
  content_genres,
  content_moods,
  content_titles,
  stack_items,
  stack_members,
  stacks,
  follows,
  watch_events,
  view_events,
  share_events,
  watch_history,
  analytics_daily,
  attestations,
  complaints,
  moderation_log,
  reports,
  notifications,
  consents,
  user_subscriptions,
  content,
  titles,        -- TMDB cache. Comment this line out if you'd rather keep cached titles.
  user_auth,
  users
restart identity cascade;

commit;

-- Sanity check after running (every count should be 0):
-- select 'content' t, count(*) from content
-- union all select 'users', count(*) from users
-- union all select 'follows', count(*) from follows
-- union all select 'content_fires', count(*) from content_fires;

-- Verify the SEEDS survived (these should be > 0):
-- select 'policy_versions' t, count(*) from policy_versions
-- union all select 'platforms', count(*) from platforms
-- union all select 'genres', count(*) from genres
-- union all select 'moods', count(*) from moods;
