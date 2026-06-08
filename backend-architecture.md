# ShowShak — Backend Architecture & Data Model

> NOTE: The authoritative table-by-table schema (DDL + RLS) lives in
> **`backend-schema.md`** — that file reconciles this architecture with
> the UML diagram (`uml dia.jpeg`) and is the single source of truth for
> tables/columns. THIS file covers the higher-level architecture (stack,
> media pipeline, feed, scaling principles). Read both.

> Source of truth for ShowShak's backend. Written for a small team
> (you + your sister). Built on the agreed stack: **Supabase
> (Postgres + Auth + Storage + Realtime + Edge Functions) in the
> Mumbai region**, **Mux** for video, **TMDB** for titles.
>
> Two guiding principles throughout:
> 1. **Build for today's scale, design so tomorrow's scale is possible.**
>    Do NOT build TikTok's infra on day one — but don't make choices
>    that block it either. Every "at scale" note below is a *later*
>    upgrade path, not a day-1 task.
> 2. **The metrics philosophy is enforced in the DATABASE, not the UI.**
>    Counts are derived from event rows; private analytics are gated by
>    Row-Level Security. The product's soul is unbreakable by design.

---

## 0. What the big players actually do (research distilled)

We researched how Instagram and TikTok are architected so we copy the
*principles*, not the over-engineering.

**Instagram** (sources: scaleyourapp, Medium/krishtech, Substack case studies)
- **PostgreSQL** for core relational data (users, relationships, metadata)
  — sharded as they grew. **Cassandra** (NoSQL) added later only for
  feed/notification fan-out at billion-user scale.
- Media (photos/videos) lives in **object storage + CDN**, never in the
  DB. The DB stores only the *URL/ID* + metadata.
- Read-heavy: people scroll far more than they post → optimise reads,
  cache aggressively.

**TikTok** (sources: systemdesignhandbook, thelinuxcode, algomaster)
- Treats video as a **lifecycle**: `upload → validate → transcode →
  store → index → rank → deliver → measure → learn → repeat`.
- **The feed IS the product. Ranking quality drives retention**, more
  than search. Safety/compliance are core features, not add-ons.
- Engagement events (view, watch-time, like, share) are captured as a
  firehose and fed back into ranking.

**Feed generation** (the universal hard problem)
- **Fan-out on write (push):** when a creator posts, copy the clip ref
  into every follower's precomputed feed. Fast reads, expensive for
  creators with huge followings ("celebrity problem").
- **Fan-out on read (pull):** build the feed on demand by querying who
  you follow. Cheap writes, slower reads.
- **Hybrid (what the big players use):** push for normal creators, pull
  for mega-creators, merge at read time.

**ShowShak takeaway:** We are **Postgres + object storage(Mux) + CDN**,
read-heavy, feed-is-the-product, compliance-core — i.e. the Instagram/
TikTok *shape*, just sized for a startup. We start with the simplest
feed (pull) and add ranking/caching as we grow.

---

## 1. The core decision: ONE users table, not two

Your draft had separate `user` and `creator` databases. **Merge them.**
A creator is a user with extra abilities — same login, same identity.
This matches our 3-face profile (user / curator-owner / curator-public)
and makes "Become a Curator" a one-field flip, not a data migration.

```
users
  id              uuid  PK   (Supabase auth.users.id)
  email           text  unique
  username        text  unique         -- @handle
  name            text
  avatar_url      text                 -- Supabase Storage URL (square, cropped)
  region          text  default 'IN'   -- drives Watch It availability
  genres          text[]               -- taste (onboarding)
  is_creator      bool  default false  -- the flip
  is_guest        bool  default false  -- guest-first auth (see §7)
  -- creator-only (null until they become one):
  bio             text
  verified        bool  default false  -- "Trusted Curator"
  curator_since   timestamptz
  created_at      timestamptz default now()
  -- NOTE: NO follower_count / fire_count here. Those are DERIVED (§4).
```

---

## 2. The 4 core entities (you were missing TITLES)

Your brief's model is **Creator → Clip → Title**. You had Creator + Clip
but missed **Title** — the most important shared entity.

```
titles                          -- the show/movie itself (from TMDB)
  id              uuid PK
  tmdb_id         int  unique    -- canonical link to TMDB
  name            text
  year            int
  poster_url      text
  synopsis        text
  genres          text[]
  providers       jsonb          -- where-to-watch per region (TMDB watch
                                 --   providers) → powers Watch It links
  cached_at       timestamptz    -- refresh from TMDB periodically

clips                           -- a curator's recommendation video
  id              uuid PK
  creator_id      uuid FK -> users(id)
  title_id        uuid FK -> titles(id)      -- which show it's about
  mux_asset_id    text           -- Mux upload/asset
  mux_playback_id text           -- Mux streaming/playback id
  thumbnail_url   text
  caption         text           -- the 70-90 word pitch (REQUIRED)
  vibes           text[]         -- 1-3 of the 8 fixed moods
  status          text           -- 'processing'|'live'|'removed'|'draft'
  duration_sec    int
  created_at      timestamptz default now()
  -- cached counts (denormalized, NOT source of truth — see §4):
  fire_count      int default 0
  save_count      int default 0
  view_count      int default 0
  watch_it_count  int default 0
```

**Why Title matters:** "all clips about this show", reliable Watch It
links stored once (not copied per clip), and clean analytics
("which titles drive the most Watch-Its"). Genre/year/platform come
FROM the title (via TMDB) — the curator never types them. This matches
the brief's "system derives the rest" principle.

---

## 3. Relationships & events = the heart of analytics

**The #1 fix from your draft:** counts are NOT stored as the truth.
Fire isn't a number — it's a *relationship*: "user X fired clip Y at
time Z." Store the rows; derive the counts. This is the ONLY way
analytics, "fires this week", and anti-abuse work.

```
follows
  follower_id  uuid FK -> users(id)
  creator_id   uuid FK -> users(id)
  created_at   timestamptz default now()
  PRIMARY KEY (follower_id, creator_id)     -- can't double-follow

fires
  user_id      uuid FK -> users(id)
  clip_id      uuid FK -> clips(id)
  created_at   timestamptz default now()
  PRIMARY KEY (user_id, clip_id)            -- can't double-fire

stacks                                       -- saved collections
  id           uuid PK
  user_id      uuid FK -> users(id)
  name         text
  visibility   text  -- 'public'|'friends'|'private'
  created_at   timestamptz default now()

stack_clips                                  -- clips inside a stack
  stack_id     uuid FK -> stacks(id)
  clip_id      uuid FK -> clips(id)
  added_at     timestamptz default now()
  PRIMARY KEY (stack_id, clip_id)

-- EVENT STREAMS (append-only, timestamped — the analytics fuel) --

watch_events            -- a Watch It tap (the money metric + future $$)
  id           uuid PK
  user_id      uuid FK -> users(id)   -- nullable for guests
  clip_id      uuid FK -> clips(id)
  title_id     uuid FK -> titles(id)
  platform     text                   -- Netflix / Prime / ...
  region       text
  created_at   timestamptz default now()

view_events             -- a clip view (powers view_count + reach trend)
  id           uuid PK
  user_id      uuid                   -- nullable for guests
  clip_id      uuid FK -> clips(id)
  watch_ms     int                    -- how long they watched (ranking signal)
  created_at   timestamptz default now()

share_events            -- a share action
  id           uuid PK
  user_id      uuid
  clip_id      uuid FK -> clips(id)
  created_at   timestamptz default now()
```

---

## 4. Counts: derive, then cache (the right pattern)

- **Source of truth** = count the event/relationship rows.
  - `fire_count` = `SELECT count(*) FROM fires WHERE clip_id = ?`
  - `follower_count` = `SELECT count(*) FROM follows WHERE creator_id = ?`
- **Cache for speed** = the `*_count` columns on `clips` (so the feed
  doesn't recount on every load). Update them via:
  - a Postgres **trigger** on insert/delete of the event row, OR
  - a periodic rollup job (simpler, eventually-consistent — fine for us).
- **Never** let the UI write a count directly. The count always traces
  back to rows.

This gives correctness (rows) + speed (cache) + analytics (timestamps).

---

## 5. Analytics — answering your direct question

> "who will we be able to show analytics to, and is that info stored?"

**Yes, stored — as the event streams in §3.** Analytics = aggregating
timestamped events. Pipeline:

```
raw events (fires, watch_events, view_events, follows)
        │  nightly (or hourly) rollup job  (Supabase scheduled Edge Function)
        ▼
clip_stats_daily (clip_id, date, fires, views, watch_its, saves, reach)
creator_stats_daily (creator_id, date, followers_gained, total_fires, ...)
        │
        ▼
Creator cockpit (the Analytics tab we already built) reads the rollups
→ "fires this week" chart, top clips, reach trend, Watch-It conversion.
```

**WHO sees WHAT — enforced by Row-Level Security (RLS), not the UI:**

| Data | User (own) | Curator (owner) | Public viewer |
|------|-----------|-----------------|---------------|
| fires GIVEN count | ❌ never shown | ❌ | ❌ |
| watch history | ✅ own only | ✅ own only | ❌ |
| fires/Watch-Its/reach RECEIVED | — | ✅ own cockpit only | ❌ |
| followers + clip count | — | ✅ | ✅ (public) |
| analytics charts | — | ✅ own only | ❌ |

RLS policy examples (conceptual):
- `creator_stats_daily`: `USING (creator_id = auth.uid())` → a curator
  can read ONLY their own analytics. Nobody else, ever.
- `watch_events` (history): readable only by the acting user.
- This makes the "hide the scoreboard" philosophy a **database guarantee**,
  not a front-end promise.

---

## 6. Media pipeline (the "do NOT build this yourself" part)

Video is the one thing a small team must outsource. Use **Mux** (or
Cloudflare Stream). Flow mirrors TikTok's lifecycle:

```
1. Client asks our Edge Function for a Mux DIRECT UPLOAD url
2. Curator's video uploads straight to Mux (not through our server)
3. Mux transcodes → adaptive HLS + generates thumbnail
4. Mux webhook → our Edge Function → set clip.status='live',
   store mux_playback_id + thumbnail_url
5. Feed plays via Mux's global CDN (HLS). We store only IDs/URLs.
```

- The DB **never** stores video bytes — only `mux_playback_id` etc.
  (exactly how Instagram stores image URLs, not images).
- `status='processing'` until the webhook says ready → the upload UI we
  built already implies this; wire the status.
- Avatars/posters → **Supabase Storage** (small images, India region).
- **Cost watch:** Mux bills per minute streamed. Keep clips short (we
  do), set spend alerts from day one.

---

## 7. Auth — guest-first (our funnel)

This IS the PWA try-before-commit funnel.

```
First visit  → Supabase ANONYMOUS session (is_guest=true)
             → they can scroll, fire, watch — feel the loop
Value moment → after first Watch It / first save, prompt to sign up
Sign up      → upgrade the anonymous user to a real account
             (Supabase supports linking anon → permanent; keep their
              fires/saves so nothing is lost)
```

- Guest events (views, fires) still recorded with the anon user_id, so
  no signal is wasted and the funnel is measurable.
- Children's data: DPDP requires verifiable parental consent for under
  18 — capture age band at signup, gate accordingly (later, pre-launch).

---

## 8. The feed (start simple, scale later)

**Now (launch / low scale): fan-out on READ (pull).** Simplest, correct,
cheap to build:
```
feed = clips from creators you follow
       + clips matching your taste genres/vibes
       + fresh/popular clips (cold-start filler)
   ORDER BY a simple score, LIMIT/paginate
```
Simple ranking score (Instagram-style, tunable):
```
score = (fire_rate * w1) + (recency * w2) + (creator_affinity * w3)
        + (vibe_match * w4)
```
- `creator_affinity` = do you follow them / fired them before.
- Recency = time-decay so fresh clips surface.

**Later (scale): hybrid fan-out + a ranking service + Redis cache.**
Precompute feeds for active users, pull for the rest. Only build this
when read latency actually hurts — not before. Postgres + good indexes
carries you a long way first.

---

## 9. Supporting tables (don't forget these)

```
reports                 -- DMCA / content moderation (LEGAL requirement)
  id, reporter_id, clip_id, reason, status('open'|'actioned'|'rejected'),
  created_at
  → ties to the brief's DMCA safe-harbor: takedown + repeat-infringer

notifications           -- DIGEST model (never per-fire), our design
  id, user_id, type, payload jsonb, read bool, created_at
  → "new clips from curators you follow", weekly fire digest for creators

search                  -- start with Postgres full-text on clips/titles/
                           curators; move to Typesense/Meilisearch later

recent_searches         -- per user (Discover already has this in UI)
```

---

## 10. How current prototype state maps to the backend

The app already uses these sessionStorage keys — each maps to a table,
so migration is mechanical:

| Prototype (sessionStorage) | Backend table |
|---|---|
| `ss_stacks_v1` | `stacks` + `stack_clips` |
| `ss_following_v1` | `follows` |
| `ss_my_clips_v1` (upload) | `clips` (status flow) |
| `ss_user_profile_v1` (onboarding) | `users` (genres, region) |
| `ss_is_creator_v1` | `users.is_creator` |
| `ss_view_curator_v1` (handoff) | just a query by username |
| fire state (in-memory) | `fires` |

The shared JS systems (`ssToggleSave`, `ssToggleFollow`, `ssOpenClip`,
etc.) already centralise reads/writes — so swapping sessionStorage for
Supabase calls happens in ONE layer, not across every page. This is
exactly why we consolidated them earlier.

---

## 11. Build order (phased — matches the roadmap)

1. **Schema + Auth** — create the tables above in Supabase (Mumbai),
   guest-first auth, onboarding writes `users`.
2. **Titles + Watch It** — TMDB integration → `titles`, real providers.
3. **Clips + Mux** — wire upload flow to Mux; feed reads real `clips`.
4. **Social** — `fires`/`follows`/`stacks` replace sessionStorage in the
   shared JS layer; Watchlist + Following become real.
5. **Events + rollups + analytics** — event streams + scheduled rollup
   + creator cockpit reads real numbers (RLS-gated).
6. **Search, notifications (digest), moderation/DMCA.**
7. **Harden + then PWA layer.**

---

## 12. What to tell your sister (the 6 non-negotiables)

1. **One `users` table**, `is_creator` flag — not two databases.
2. **Add `titles`** — the missing 4th entity; show data lives here once.
3. **Counts come from event rows**, never stored as the only truth
   (cache columns are fine, but derived).
4. **Media → Mux/Storage; DB stores only IDs/URLs**, never bytes.
5. **RLS enforces the privacy/metrics philosophy** in the DB.
6. **Everything has `created_at`** — no timestamps = no analytics.
