-- ═══════════════════════════════════════════════════════════════
-- SHOWSHAK — INITIAL DATABASE SCHEMA  (Step 0)
-- ───────────────────────────────────────────────────────────────
-- This is the ENTIRE database, built from backend-schema.md.
-- HOW TO USE: open your Supabase project → SQL Editor → New query →
-- paste this whole file → Run. That's it. Your database now exists.
--
-- You do NOT need to understand every line. Think of it as the
-- architectural blueprint: each `create table` is one "notebook"
-- the app writes to. Comments explain what each one is for.
--
-- Conventions (same on every table):
--   id          → unique key for each row
--   created_at  → when the row was made   (needed for analytics)
--   updated_at  → when it last changed
--   deleted_at  → "soft delete" — we hide rows, never truly erase
--   meta        → a flexible bucket for future fields (no migrations)
-- ═══════════════════════════════════════════════════════════════

-- Supabase has this enabled already; here for safety on fresh projects.
create extension if not exists pgcrypto;

-- ───────────────────────────────────────────────────────────────
-- 1. USERS  (one table; a curator is just a user with role='curator')
-- ───────────────────────────────────────────────────────────────
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  username      text unique not null,            -- @handle
  name          text,
  gender        text,
  age           int,                             -- for child-data gating (DPDP)
  avatar_url    text,
  role          text not null default 'user',    -- 'user' | 'curator'
  bio           text,
  verified      boolean default false,           -- "Trusted Curator"
  region        text default 'IN',               -- drives Watch It availability
  genres        text[] default '{}',             -- taste from onboarding
  is_guest      boolean default false,           -- guest-first auth
  curator_since timestamptz,
  description   text,
  created_at    timestamptz default now(),
  updated_at    timestamptz,
  deleted_at    timestamptz,
  meta          jsonb default '{}'
);
-- NOTE: no follower_count / fires_count here — those are DERIVED (counted).

-- ───────────────────────────────────────────────────────────────
-- 2. USER_AUTH  (identity/credentials kept separate from profile)
-- ───────────────────────────────────────────────────────────────
create table if not exists user_auth (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id),
  email      text unique,
  provider   text,                               -- 'google' | 'apple' | 'email'
  token      text,                               -- session ref (Supabase-managed)
  created_at timestamptz default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  meta       jsonb default '{}'
);

-- ───────────────────────────────────────────────────────────────
-- 3. TITLES  (the show/movie itself — one row per title, from TMDB)
--    This is the entity the old UML was missing.
-- ───────────────────────────────────────────────────────────────
create table if not exists titles (
  id         uuid primary key default gen_random_uuid(),
  tmdb_id    int unique,                          -- canonical link to TMDB
  name       text not null,
  year       int,
  poster_url text,
  synopsis   text,
  providers  jsonb default '{}',                  -- where-to-watch per region
  cached_at  timestamptz,                         -- refresh from TMDB periodically
  created_at timestamptz default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  meta       jsonb default '{}'
);

-- ───────────────────────────────────────────────────────────────
-- 4. PLATFORMS  (catalog of streaming services: Netflix, Prime…)
-- ───────────────────────────────────────────────────────────────
create table if not exists platforms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,                       -- 'Netflix'
  color      text,                                -- brand color for the rail
  abbr       text,                                -- 'N'
  region     text,
  active     boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  meta       jsonb default '{}'
);

-- ───────────────────────────────────────────────────────────────
-- 5. USER_SUBSCRIPTIONS  (what a user is subscribed to → Watch It)
-- ───────────────────────────────────────────────────────────────
create table if not exists user_subscriptions (
  user_id     uuid not null references users(id),
  platform_id uuid not null references platforms(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz,
  deleted_at  timestamptz,
  meta        jsonb default '{}',
  primary key (user_id, platform_id)
);

-- ───────────────────────────────────────────────────────────────
-- 6. CONTENT  (the CLIP — a curator's recommendation video)
-- ───────────────────────────────────────────────────────────────
create table if not exists content (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references users(id),
  title_id        uuid references titles(id),     -- which show it's about
  platform_id     uuid references platforms(id),  -- resolved platform
  description     text not null,                  -- the 70–90 word pitch
  mux_asset_id    text,
  mux_playback_id text,
  thumbnail_url   text,
  url             text,
  duration_sec    int,
  status          text default 'processing',      -- processing|live|removed|draft
  restricted      boolean default false,
  -- CACHED counts (a fast copy of the event tables; NOT the source of truth):
  fires_count     int default 0,
  saves_count     int default 0,
  views_count     int default 0,
  watch_it_count  int default 0,
  shares_count    int default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz,
  deleted_at      timestamptz,
  meta            jsonb default '{}'
);

-- ───────────────────────────────────────────────────────────────
-- 7. GENRES + CONTENT_GENRES  (a clip can have several genres)
-- ───────────────────────────────────────────────────────────────
create table if not exists genres (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_at  timestamptz default now(),
  updated_at  timestamptz,
  deleted_at  timestamptz,
  meta        jsonb default '{}'
);
create table if not exists content_genres (
  content_id uuid references content(id),
  genre_id   uuid references genres(id),
  primary key (content_id, genre_id)
);

-- ───────────────────────────────────────────────────────────────
-- 8. MOODS + CONTENT_MOODS  (the 8 fixed vibes; 1–3 per clip)
-- ───────────────────────────────────────────────────────────────
create table if not exists moods (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,                       -- 'Edge of My Seat'
  tag        text,                                -- css slug, e.g. 'mood-edge'
  created_at timestamptz default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  meta       jsonb default '{}'
);
create table if not exists content_moods (
  content_id uuid references content(id),
  mood_id    uuid references moods(id),
  primary key (content_id, mood_id)
);

-- ───────────────────────────────────────────────────────────────
-- 9. FOLLOWS  (the entire following graph: follower → creator)
-- ───────────────────────────────────────────────────────────────
create table if not exists follows (
  follower_id uuid not null references users(id),
  creator_id  uuid not null references users(id),
  created_at  timestamptz default now(),
  deleted_at  timestamptz,
  meta        jsonb default '{}',
  primary key (follower_id, creator_id),
  check (follower_id <> creator_id)              -- can't follow yourself
);

-- ───────────────────────────────────────────────────────────────
-- 10. CONTENT_FIRES  (the 🔥 = the "like"; stored as ROWS, not a number)
-- ───────────────────────────────────────────────────────────────
create table if not exists content_fires (
  user_id    uuid not null references users(id),
  content_id uuid not null references content(id),
  created_at timestamptz default now(),
  deleted_at timestamptz,
  primary key (user_id, content_id)              -- can't double-fire
);

-- ───────────────────────────────────────────────────────────────
-- 11. STACKS + STACK_ITEMS  (saved collections = the Watchlist)
-- ───────────────────────────────────────────────────────────────
create table if not exists stacks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id),
  name         text not null,
  description  text,
  visibility   text default 'private',            -- 'public' | 'friends' | 'private'
  thumbnail_id uuid references content(id),
  is_highlight boolean default false,             -- public profile shelf
  sort_no      int,
  created_at   timestamptz default now(),
  updated_at   timestamptz,
  deleted_at   timestamptz,
  meta         jsonb default '{}'
);
create table if not exists stack_items (
  stack_id   uuid references stacks(id),
  content_id uuid references content(id),
  added_at   timestamptz default now(),
  primary key (stack_id, content_id)
);

-- ───────────────────────────────────────────────────────────────
-- 12. EVENT STREAMS  (append-only logs — the fuel for real analytics)
-- ───────────────────────────────────────────────────────────────
-- The Watch It tap → THE money metric.
create table if not exists watch_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id),          -- nullable for guests
  content_id  uuid references content(id),
  title_id    uuid references titles(id),
  platform_id uuid references platforms(id),
  region      text,
  created_at  timestamptz default now(),
  meta        jsonb default '{}'
);
-- A clip view (powers views_count + reach + watch-time ranking).
create table if not exists view_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,                                -- nullable for guests
  content_id uuid references content(id),
  watch_ms   int,
  created_at timestamptz default now()
);
-- A share action.
create table if not exists share_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,
  content_id uuid references content(id),
  created_at timestamptz default now()
);

-- ───────────────────────────────────────────────────────────────
-- 13. WATCH_HISTORY  (user-facing "recently watched", clearable list)
-- ───────────────────────────────────────────────────────────────
create table if not exists watch_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id),
  content_id    uuid references content(id),
  times_watched int default 1,
  last_watched  timestamptz default now(),
  deleted_at    timestamptz,
  meta          jsonb default '{}'
);

-- ───────────────────────────────────────────────────────────────
-- 14. ANALYTICS_DAILY  (a nightly rollup CACHE — never the truth)
-- ───────────────────────────────────────────────────────────────
create table if not exists analytics_daily (
  id         uuid primary key default gen_random_uuid(),
  content_id uuid references content(id),
  creator_id uuid references users(id),
  day        date not null,
  views      int default 0,
  fires      int default 0,
  shares     int default 0,
  watch_its  int default 0,
  reach      int default 0,
  watch_ms   bigint default 0,
  unique (content_id, day)
);

-- ───────────────────────────────────────────────────────────────
-- 15. REPORTS  (moderation / DMCA — a legal must before scaling)
-- ───────────────────────────────────────────────────────────────
create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references users(id),
  content_id  uuid references content(id),
  reason      text,
  status      text default 'open',                -- 'open'|'actioned'|'rejected'
  created_at  timestamptz default now(),
  updated_at  timestamptz,
  meta        jsonb default '{}'
);

-- ───────────────────────────────────────────────────────────────
-- 16. NOTIFICATIONS  (digest model — never one-per-fire)
-- ───────────────────────────────────────────────────────────────
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users(id),
  type       text,                                -- 'new_clip'|'fire_digest'|...
  payload    jsonb default '{}',
  read       boolean default false,
  created_at timestamptz default now()
);

-- ───────────────────────────────────────────────────────────────
-- INDEXES  (make the common lookups fast from day one)
-- ───────────────────────────────────────────────────────────────
create index if not exists idx_content_creator   on content (creator_id, created_at desc);
create index if not exists idx_content_title      on content (title_id);
create index if not exists idx_fires_content      on content_fires (content_id);
create index if not exists idx_follows_creator    on follows (creator_id);
create index if not exists idx_watch_content      on watch_events (content_id, created_at);
create index if not exists idx_view_content       on view_events (content_id, created_at);
create index if not exists idx_analytics_creator  on analytics_daily (creator_id, day);

-- ───────────────────────────────────────────────────────────────
-- ROW-LEVEL SECURITY  (the "hide the scoreboard" rule, enforced by the DB)
-- We turn RLS on now. Real per-user policies get finalized in Step 1
-- (Auth), once users.id is linked to the logged-in account.
-- ───────────────────────────────────────────────────────────────

-- Public, read-only reference data (everyone can read the catalog).
alter table titles    enable row level security;
alter table platforms enable row level security;
alter table genres    enable row level security;
alter table moods     enable row level security;
create policy read_titles    on titles    for select using (deleted_at is null);
create policy read_platforms on platforms for select using (deleted_at is null);
create policy read_genres    on genres    for select using (deleted_at is null);
create policy read_moods     on moods     for select using (deleted_at is null);

-- Live clips are publicly readable; everything else gets owner rules in Step 1.
alter table content enable row level security;
create policy read_live_content on content
  for select using (deleted_at is null and status = 'live');

-- Private-by-owner tables (policies activate fully once auth is wired).
alter table content_fires enable row level security;
create policy own_fires on content_fires for all using (user_id = auth.uid());

alter table stacks enable row level security;
create policy read_stacks on stacks for select
  using (visibility = 'public' or user_id = auth.uid());

alter table watch_history enable row level security;
create policy own_history on watch_history for select using (user_id = auth.uid());

alter table analytics_daily enable row level security;
create policy own_analytics on analytics_daily for select using (creator_id = auth.uid());

-- ───────────────────────────────────────────────────────────────
-- SEED DATA  (the fixed reference rows we already use in the prototype)
-- These mirror data/showshak-data.js so the real DB starts consistent.
-- ───────────────────────────────────────────────────────────────

-- The 8 fixed vibes (must stay a controlled list — no spam tags).
insert into moods (name, tag) values
  ('Edge of My Seat', 'mood-edge'),
  ('Feel Good',       'mood-feelgood'),
  ('Want to Cry',     'mood-cry'),
  ('Date Night',      'mood-date'),
  ('Mind-Bending',    'mood-mind'),
  ('Family Night',    'mood-family'),
  ('Late Night',      'mood-night'),
  ('Laugh Out Loud',  'mood-laugh')
on conflict do nothing;

-- The streaming platforms (same colors/abbr as the prototype rail).
insert into platforms (name, color, abbr) values
  ('Netflix',     '#E50914', 'N'),
  ('Prime Video', '#00A8E0', 'P'),
  ('Disney+',     '#0E3BD4', 'D+'),
  ('JioHotstar',  '#FF6A00', 'JH'),
  ('Apple TV+',   '#111111', '▶'),
  ('SonyLIV',     '#002868', 'S'),
  ('HBO Max',     '#5C2D91', 'HBO'),
  ('Zee5',        '#6B1DF5', 'Z5'),
  ('Hulu',        '#1CE783', 'H')
on conflict do nothing;

-- A starter genre list (genres are normally pulled from TMDB per title).
insert into genres (name) values
  ('Crime'), ('Thriller'), ('Drama'), ('Comedy'), ('Action'),
  ('Sci-Fi'), ('Horror'), ('Romance')
on conflict do nothing;

-- ═══════════════════════════════════════════════════════════════
-- DONE. 16 entities + indexes + security + seed rows.
-- Next (Step 1): connect login so users.id = the logged-in account,
-- and finalize the owner policies above.
-- ═══════════════════════════════════════════════════════════════
