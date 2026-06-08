-- ═══════════════════════════════════════════════════════════════
-- SHOWSHAK — ONBOARDING ACCESS  (Step 1.5: profile completion)
-- ───────────────────────────────────────────────────────────────
-- The post-login onboarding flow writes:
--   • users               (username, gender, genres, avatar_url, meta)  ← already allowed by 0003
--   • user_subscriptions  (one row per platform the user has)            ← needs access (this file)
--
-- user_subscriptions had no GRANT or RLS policies yet, so inserts would
-- fail with "permission denied" (same situation as the moods table did).
-- This file lets a logged-in user manage ONLY their own subscription
-- rows, and read them back.
--
-- HOW TO USE: Supabase → SQL Editor → New query → paste → Run.
-- ═══════════════════════════════════════════════════════════════

-- Table-level access for logged-in users.
grant select, insert, update, delete on table user_subscriptions to authenticated;

alter table user_subscriptions enable row level security;

-- A user may only see/manage their OWN subscription rows.
drop policy if exists own_subscriptions on user_subscriptions;
create policy own_subscriptions on user_subscriptions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- DONE. Onboarding can now save a user's platform subscriptions.
--
-- ── PROFILE PHOTOS (do this in the dashboard, not SQL) ──
-- The photo step uploads to a Storage bucket named "avatars".
-- Create it once: Supabase → Storage → New bucket →
--   Name: avatars   |   Public bucket: ON (so profile photos display).
-- Photo upload is OPTIONAL in the flow, so onboarding still works
-- before you create the bucket — it just skips the photo gracefully.
-- ═══════════════════════════════════════════════════════════════
