# ShowShak — Database Schema (Reconciled)

> The single, agreed database design. This reconciles the UML diagram
> (`uml dia.jpeg`) with `backend-architecture.md`. It keeps the UML's
> good conventions — **soft deletes (`deleted_at`), `meta jsonb`,
> timestamps everywhere, one USER table with a role, split USER_AUTH,
> likes-as-rows** — and folds in the fixes flagged in review.
>
> Stack: **Supabase (Postgres) — Mumbai region**, **Mux** video,
> **TMDB** titles. Conventions: `snake_case`, `uuid` PKs, `created_at`
> /`updated_at`/`deleted_at` on every table, `meta jsonb` for future
> fields without migrations.
>
> GOLDEN RULES
> 1. Counts (fires/followers/views/watch-its) are DERIVED from event
>    rows. Any `*_count` column is a CACHE, never the source of truth.
> 2. Media (video/images) lives in Mux/Storage. The DB stores only
>    IDs/URLs — never bytes.
> 3. Privacy is enforced by Row-Level Security (RLS), not the UI.
> 4. Every table is soft-deleted (`deleted_at`), never hard-deleted.

---

## What changed vs the UML (the 4 fixes + cleanups)

| # | Issue in UML | Fix |
|---|---|---|
| 1 | No `TITLES` entity (CONTENT had free-text title) | Added `titles` (TMDB-backed); `content.title_id → titles` |
| 2 | No follow graph (`Refer_id` ambiguous) | Added `follows` (follower→creator) |
| 3 | Watch-It tap not captured (only "times watched") | Added `watch_events` (the money metric) |
| 4 | `SUBSCRIPTIONS` mixed "catalog" + "what a user has" | Split into `platforms` (catalog) + `user_subscriptions` |
| 5 | `Genre_id`/`Mood_id` singular on CONTENT | Join tables `content_genres`, `content_moods` (1–3 vibes) |
| 6 | `STACK.content[]` array | `stack_items` join table |
| 7 | `content_reactions` had total_count AND user_id | Split: `content_fires` (rows) + cached count on `content` |
| 8 | No video lifecycle state | `content.status` (processing/live/...) for Mux |
| 9 | `Highlights` overlapped public stacks | Defined as a curated view of public stacks (see notes) |
| 10 | Analytics counts as truth | `analytics_daily` rollup, clearly a cache |
| 11 | No moderation home | `reports` table (DMCA obligation) |
| 12 | No region on user | `users.region` (Watch It availability) |

---

## Entity map (the shape)

```
                       ┌─────────────┐
                       │   users     │ role: user | curator
                       └──────┬──────┘
        ┌───────────────┬─────┼───────────────┬──────────────┐
        │               │     │               │              │
   user_auth       follows   stacks      user_subscriptions  watch_history
                   (graph)     │                │
                               │           platforms (catalog)
                          stack_items            │
                               │            ┌────┴─────┐
                       ┌───────┴───────┐    │          │
                       │    content    │────┤      titles (TMDB)
                       │  (the clip)   │ title_id   (one per show)
                       └───────┬───────┘
        ┌──────────────┬───────┼───────────┬───────────────┐
   content_fires  content_genres  content_moods  watch_events  view_events
   (the 🔥 like)                                 (Watch It tap)
        │
   analytics_daily (rollup cache)        reports (moderation)   notifications
```

---

## Tables (DDL)

> Every table also has: `created_at timestamptz default now()`,
> `updated_at timestamptz`, `deleted_at timestamptz null`,
> `meta jsonb default '{}'`. Shown once here, implied everywhere.

### users  (one table; a curator is a user with role='curator')
```sql
create table users (
  id            uuid primary key default gen_random_uuid(),
  username      text unique not null,          -- @handle
  name          text,
  gender        text,
  age           int,                            -- for DPDP child-data gating
  avatar_url    text,                           -- Storage URL (square, cropped)
  role          text not null default 'user',   -- 'user' | 'curator'
  bio           text,                           -- curator public bio
  verified      boolean default false,          -- "Trusted Curator"
  region        text default 'IN',              -- drives Watch It availability
  genres        text[] default '{}',            -- taste from onboarding
  is_guest      boolean default false,          -- guest-first auth
  curator_since timestamptz,
  description   text,
  created_at timestamptz default now(), updated_at timestamptz,
  deleted_at timestamptz, meta jsonb default '{}'
);
-- NOTE: no follower_count / fires_count here — DERIVED (see analytics_daily).
```

### user_auth  (kept separate, as in the UML)
```sql
create table user_auth (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id),
  -- email/phone live here; passwords are managed by Supabase Auth,
  -- so store provider refs, not raw hashes, unless self-rolling.
  email      text unique,
  provider   text,                  -- 'google' | 'apple' | 'email'
  token      text,                  -- session/refresh ref (managed by Supabase)
  created_at timestamptz default now(), updated_at timestamptz,
  deleted_at timestamptz, meta jsonb default '{}'
);
```

### titles  (NEW — the missing 4th entity; one row per show/movie)
```sql
create table titles (
  id          uuid primary key default gen_random_uuid(),
  tmdb_id     int unique,           -- canonical link to TMDB
  name        text not null,
  year        int,
  poster_url  text,
  synopsis    text,
  providers   jsonb default '{}',   -- where-to-watch per region (TMDB/JustWatch)
  cached_at   timestamptz,          -- refresh from TMDB periodically
  created_at timestamptz default now(), updated_at timestamptz,
  deleted_at timestamptz, meta jsonb default '{}'
);
```

### platforms  (NEW catalog — Netflix, Prime, Disney+ …)
```sql
create table platforms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,        -- 'Netflix'
  color       text,                 -- brand color for the rail
  abbr        text,                 -- 'N'
  region      text,                 -- availability scope if needed
  active      boolean default true,
  created_at timestamptz default now(), updated_at timestamptz,
  deleted_at timestamptz, meta jsonb default '{}'
);
```

### user_subscriptions  (what a USER is subscribed to → Watch It routing)
```sql
create table user_subscriptions (
  user_id     uuid not null references users(id),
  platform_id uuid not null references platforms(id),
  created_at timestamptz default now(), updated_at timestamptz,
  deleted_at timestamptz, meta jsonb default '{}',
  primary key (user_id, platform_id)
);
-- This is "My Platforms" in Settings. Functional only, never a profile badge.
```

### content  (the CLIP — a curator's recommendation video)
```sql
create table content (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references users(id),
  title_id        uuid references titles(id),     -- which show it's about (FIX #1)
  platform_id     uuid references platforms(id),  -- resolved platform (FIX #4)
  description     text not null,        -- the 70–90 word caption/pitch
  mux_asset_id    text,
  mux_playback_id text,
  thumbnail_url   text,
  url             text,                 -- playback url (from Mux)
  duration_sec    int,
  status          text default 'processing', -- processing|live|removed|draft (FIX #8)
  restricted      boolean default false,
  -- CACHED counts (rollup of the event tables; NOT source of truth):
  fires_count     int default 0,
  saves_count     int default 0,
  views_count     int default 0,
  watch_it_count  int default 0,
  shares_count    int default 0,
  created_at timestamptz default now(), updated_at timestamptz,
  deleted_at timestamptz, meta jsonb default '{}'
);
```

### genres  /  content_genres  (many-to-many — FIX #5)
```sql
create table genres (
  id uuid primary key default gen_random_uuid(),
  name text not null, description text,
  created_at timestamptz default now(), updated_at timestamptz,
  deleted_at timestamptz, meta jsonb default '{}'
);
create table content_genres (
  content_id uuid references content(id),
  genre_id   uuid references genres(id),
  primary key (content_id, genre_id)
);
-- Genres are usually DERIVED from the title (TMDB), copied here for query speed.
```

### moods  /  content_moods  (the 8 vibes; 1–3 per clip — FIX #5)
```sql
create table moods (
  id uuid primary key default gen_random_uuid(),
  name text not null,        -- 'Edge of My Seat', 'Feel Good', ...
  tag  text,                 -- mood css class / slug
  created_at timestamptz default now(), updated_at timestamptz,
  deleted_at timestamptz, meta jsonb default '{}'
);
create table content_moods (
  content_id uuid references content(id),
  mood_id    uuid references moods(id),
  primary key (content_id, mood_id)
);
```

### follows  (NEW — the entire following graph — FIX #2)
```sql
create table follows (
  follower_id uuid not null references users(id),
  creator_id  uuid not null references users(id),
  created_at timestamptz default now(),
  deleted_at timestamptz, meta jsonb default '{}',
  primary key (follower_id, creator_id),
  check (follower_id <> creator_id)
);
-- follower_count = count(*) where creator_id = ? and deleted_at is null.
-- maps to the app's ss_following_v1.
```

### content_fires  (the 🔥 FIRE = the like; ROWS not a number — FIX #7)
```sql
create table content_fires (
  user_id    uuid not null references users(id),
  content_id uuid not null references content(id),
  created_at timestamptz default now(),
  deleted_at timestamptz,
  primary key (user_id, content_id)      -- can't double-fire
);
-- Fire IS the like in ShowShak. There is NO separate "likes" table.
-- fires_count on content is a cache of count(*) here.
```

### stacks  /  stack_items  (saved collections — FIX #6)
```sql
create table stacks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id),
  name        text not null,
  description text,
  visibility  text default 'private',   -- 'public' | 'friends' | 'private'
  thumbnail_id uuid references content(id),
  sort_no     int,
  created_at timestamptz default now(), updated_at timestamptz,
  deleted_at timestamptz, meta jsonb default '{}'
);
create table stack_items (
  stack_id   uuid references stacks(id),
  content_id uuid references content(id),
  added_at   timestamptz default now(),
  primary key (stack_id, content_id)
);
-- A "shared stack" / Highlight = a stack with visibility='public'.
-- (See Highlights note below — it is NOT a separate concept.)
```

### EVENT STREAMS (append-only, timestamped — the analytics fuel)

```sql
-- Watch It tap → leaves to streaming platform. THE money metric. (FIX #3)
create table watch_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users(id),     -- nullable for guests
  content_id uuid references content(id),
  title_id   uuid references titles(id),
  platform_id uuid references platforms(id),
  region     text,
  created_at timestamptz default now(),
  meta jsonb default '{}'
);

-- A clip view (powers views_count + reach + ranking watch-time).
create table view_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,                          -- nullable for guests
  content_id uuid references content(id),
  watch_ms   int,                           -- how long watched (ranking signal)
  created_at timestamptz default now()
);

-- A share action.
create table share_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid, content_id uuid references content(id),
  created_at timestamptz default now()
);
```

### watch_history  (user utility — "recently watched", from the UML)
```sql
create table watch_history (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id),
  content_id   uuid references content(id),
  times_watched int default 1,
  last_watched timestamptz default now(),
  deleted_at timestamptz, meta jsonb default '{}'
);
-- Powers the Profile "History" tab (7-day re-find). Distinct from view_events
-- (raw analytics): this is the user-facing, clearable list.
```

### analytics_daily  (ROLLUP CACHE — clearly derived, never truth — FIX #10)
```sql
create table analytics_daily (
  id          uuid primary key default gen_random_uuid(),
  content_id  uuid references content(id),
  creator_id  uuid references users(id),
  day         date not null,
  views       int default 0,
  fires       int default 0,
  shares      int default 0,
  watch_its   int default 0,
  reach       int default 0,
  watch_ms    bigint default 0,
  unique (content_id, day)
);
-- Populated nightly by a Supabase scheduled Edge Function that COUNTS the
-- event tables. The creator cockpit reads THIS, not raw events (fast).
```

### reports  (moderation / DMCA — legal obligation — FIX #11)
```sql
create table reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references users(id),
  content_id  uuid references content(id),
  reason      text,
  status      text default 'open',     -- 'open'|'actioned'|'rejected'
  created_at timestamptz default now(), updated_at timestamptz,
  meta jsonb default '{}'
);
```

### notifications  (DIGEST model — never per-fire)
```sql
create table notifications (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid references users(id),
  type      text,                      -- 'new_clip'|'new_stack'|'fire_digest'|...
  payload   jsonb default '{}',
  read      boolean default false,
  created_at timestamptz default now()
);
```

---

## Row-Level Security (the philosophy as a DB guarantee)

```sql
-- A curator can read ONLY their own analytics. Nobody else, ever.
alter table analytics_daily enable row level security;
create policy own_analytics on analytics_daily
  for select using (creator_id = auth.uid());

-- Watch history is private to the acting user.
alter table watch_history enable row level security;
create policy own_history on watch_history
  for select using (user_id = auth.uid());

-- Fires are writable by the owner; counts are public via the cache only.
alter table content_fires enable row level security;
create policy own_fires on content_fires
  for all using (user_id = auth.uid());

-- Stacks: public ones readable by all; private only by owner.
alter table stacks enable row level security;
create policy read_stacks on stacks for select
  using (visibility = 'public' or user_id = auth.uid());
```

This makes "hide the scoreboard" structural:
- A user's **fires given** count is never exposed (no public view of it).
- **Public curator profile** exposes only followers + clip count.
- **fires-received / watch-its / reach** live in `analytics_daily`,
  readable only by the owning creator.

---

## The metrics rule, concretely

| Shown | Source |
|---|---|
| clip fires count | `count(content_fires)` → cached in `content.fires_count` |
| follower count | `count(follows)` → optional cache |
| "fires this week" chart | `sum(analytics_daily.fires)` last 7 days, owner-only |
| user's own "fires given" | **never shown** (counted server-side only) |
| views / reach | `view_events` → `analytics_daily` |
| Watch-It conversion | `watch_events` → `analytics_daily`, owner-only |

---

## Highlights — resolved (FIX #9)

The UML had a `Highlights` table separate from stacks. In ShowShak a
"shared stack / highlight" **is just a stack with `visibility='public'`**.
Do NOT keep two concepts. If you want a *curated/ordered* subset to show
on the profile, add `stacks.is_highlight boolean` + `sort_no` instead of
a whole table. Recommendation: drop the separate Highlights table; use
`stacks` with visibility + an optional `is_highlight` flag.

---

## Prototype → DB mapping (migration is mechanical)

| Prototype (sessionStorage) | Table |
|---|---|
| `ss_stacks_v1` | `stacks` + `stack_items` |
| `ss_following_v1` | `follows` |
| `ss_my_clips_v1` (upload) | `content` (status flow) |
| `ss_user_profile_v1` (onboarding) | `users` (genres, region) |
| `ss_is_creator_v1` | `users.role` |
| `ss_view_curator_v1` | a query by `username` |
| in-memory fire state | `content_fires` |

Because the front end already centralises reads/writes in `shared.js`
(`ssToggleSave`, `ssToggleFollow`, `ssOpenClip`, etc.), swapping
sessionStorage for Supabase happens in ONE layer.

---

## Build order

1. `users`, `user_auth`, guest-first auth; onboarding writes `users`.
2. `titles` + `platforms` (TMDB import) → real Watch It.
3. `content` + Mux pipeline (status flow); feed reads real clips.
4. `follows`, `content_fires`, `stacks`/`stack_items` replace sessionStorage.
5. Event tables (`watch_events`, `view_events`, `share_events`) +
   `analytics_daily` rollup + creator cockpit (RLS-gated).
6. `reports`, `notifications` (digest), search.
7. Harden (RLS audit, indexes) → then PWA layer.

## Indexes to add early
```sql
create index on content (creator_id, created_at desc);
create index on content_fires (content_id);
create index on follows (creator_id);
create index on watch_events (content_id, created_at);
create index on view_events (content_id, created_at);
create index on analytics_daily (creator_id, day);
```

## 6 non-negotiables (hand to your sister)
1. One `users` table + `role` — not two databases. ✅ (UML already did this)
2. `titles` is the 4th entity — show data lives there once.
3. Counts come from event rows; `*_count` columns are caches only.
4. Media → Mux/Storage; DB stores IDs/URLs, never bytes.
5. RLS enforces the privacy/metrics philosophy in the DB.
6. `created_at` + soft `deleted_at` on everything — no timestamps = no analytics. ✅ (UML already did this)
