# ShowShak — Things Done Till Now (Living Project Report)

> **Purpose of this file:** a complete, plain-language record of what we've
> built, the path we followed, and the working principles we want to keep
> following. Anyone (a teammate, or a fresh AI chat) can read this and
> continue exactly the way we've been working.
>
> **How to use this in a new chat:** paste this file and say *"This is the
> ShowShak project report — continue from where it ends, following the same
> principles."*
>
> Last updated: after Step 2 (Watch It — real availability via TMDB), plus a
> unified clip player, a clean per-user profile, and the TMDB ingest pipeline.
> **See Section 11 at the very bottom for everything done in the latest session.**

---

## 1. What ShowShak is (the one-paragraph version)

ShowShak is a **cross-platform discovery app for movies & TV shows.** Trusted
**curators** post short video clips (with the **title hidden**) that make you
*feel* something, then a **"Watch It"** button routes you to whatever streaming
service has it. It's "your most trusted film-obsessed friend, with a platform."
We're building the **website first** (as the reference) and will wrap it into a
**PWA / mobile app** later. Goal right now = a real, working foundation to
onboard the first ~15 curators and ~100 users (not just a prototype).

Core model: **Curator → Clip → Title** (a clip belongs to a curator and points
to one shared title). The action rail (Fire, Save, Share, Watch It) is a
constant frame; only the data inside changes per clip.

---

## 2. The tech stack we chose (and why)

| Layer | Choice | Why |
|---|---|---|
| Frontend | Plain HTML/CSS/JS (multi-page) | Founder is strong at web; PWA-friendly; no framework overhead |
| Backend | **Supabase** (Postgres + Auth + Storage + auto REST API) | Managed = no server to build/crash; gives us ~80% of "backend" for free |
| Video (later) | **Mux** | Outsource the one hard thing — video transcoding/streaming |
| Titles/Watch-It (later) | **TMDB** | Free show data + "where to watch" — no studio deals needed |
| Hosting | GitHub Pages (`piyush-120898.github.io/showshak-v2/`) | Already CDN-served; Cloudflare in front at PWA stage |
| Region | Supabase **Mumbai** | Closest to our users |

**Why not a custom Go backend / gateway-controller-service stack now?** Supabase
*is* our managed backend + auto-generated API. Our single data layer
(`showshak-supabase.js` + functions in `showshak-shared.js`) is our service
layer. We get clean separation (Model = DB, Controller = Supabase API, View =
pages) **without** building/maintaining a server. If we ever truly outgrow it,
we swap that one data layer to point at a custom backend — the pages never
change. **Scale-readiness through structure, not premature infrastructure.**

---

## 3. THE WORKING PRINCIPLES (follow these every time)

These are the rules we've been operating by. Keep following them.

1. **Test-first to diagnose, then fix precisely.**
   When something breaks (especially in the DB), do **not** guess-and-patch.
   Build a tiny diagnostic that surfaces the *exact* error/state, confirm the
   real cause, *then* fix that precise thing. This is how we cracked the
   fire/follow bug (see §7). It saved hours of blind patching.

2. **Build for today's scale; structure so tomorrow's scale slots in with no rewrite.**
   Don't build TikTok's infra on day one, but don't block it either. Example:
   counts are stored as **event rows** (truth) + a cached `*_count` column, so
   a Redis write-buffer can be added later without touching the pages.

3. **Counts are derived, never the source of truth.** `*_count` columns are a
   cache kept in sync by DB triggers/rollups. The truth is always the rows
   (`content_fires`, `follows`, event tables).

4. **Security is enforced in the database (RLS), not the UI.** Every table is
   locked by default; we open exactly what's needed. "Hide the scoreboard" is a
   database guarantee.

5. **Everything links by foreign key.** A fire points to a real clip; a clip to
   a real curator + title + platform. Integrity is enforced by the DB.

6. **One repo, two environments (not two repos).** Frontend + SQL migrations
   live together. Safety from "main crashing" comes from a staging Supabase
   project for risky changes — see `supabase/SCHEMA_CHANGE_PROCESS.md`.

7. **Additive changes go direct; risky/destructive changes get staged first.**
   (New tables/columns/grants = safe. Drop/rename/type-change/constraints on
   tables with data = test on staging first.)

8. **Commit directly to `main` when confident & verified** (skip PR branches
   unless asked). Always verify syntax + logic before pushing.

9. **Everything we collect should be a real DB column the user can fill/edit.**
   (Onboarding + profile edit both write real data.)

10. **Tag demo/seed data so it can be wiped for a clean launch.** All seed rows
    carry `meta.seed = true` / `@seed.showshak` emails. One reset script wipes
    them (`supabase/RESET_demo_data.sql`).

---

## 4. The build roadmap (where we are)

```
✅ Step 0   Database created (16 tables, Mumbai, RLS on)
✅ Connection proven (frontend reads live DB)
✅ Step 1   Auth — Google + Email login working, guest-first funnel
✅ Step 1.5 Onboarding — name, username, genres, platforms, optional photo/gender
✅ Profile + Settings wired to the real logged-in user (+ real Sign Out)
✅ Constraint audit passed (PKs/FKs/uniques/checks verified, 0 orphans)
✅ Step 4a  Fires  → persist to DB
✅ Step 4b  Follows → persist to DB
✅ Step 4c  Saves / Stacks → persist to DB (mirror + hydrate)
✅ Step 2   Titles + Watch It (TMDB) — real availability data (cache-first ingest) ✅ DONE
⬜ Step 3   Clips + real video (Mux) — CODE-COMPLETE ✅; founder activation pending (Mux acct/deploy/secrets/migration) — see §12
⬜ Step 5   Events + analytics rollups (creator cockpit, RLS-gated)
⬜ Step 6   Moderation/DMCA, notifications (digest), search
⬜ Step 7   Harden (RLS audit, indexes) → PWA layer (+ Cloudflare, custom domain)
```

Apple login: code is ready; needs a paid Apple Developer account ($99/yr) +
Service ID/key setup. **Deferred** until that account exists — flip on later.

---

## 5. What's actually built (file by file)

### Frontend pages (HTML)
- `index.html` — landing + first-touch onboarding (genres/platforms → localStorage). Self-contained; intentionally left as-is.
- `showshak-feed.html` — the core vertical clip feed. **Loads real clips from the DB** (`loadRealClips()`), falls back to mock when logged-out/offline.
- `showshak-discover.html` — search, moods, platforms, curators.
- `showshak-watchlist.html` — Stacks (saved collections). Still sessionStorage.
- `showshak-profile.html` — 3-face profile (user / curator-owner / public). **Hydrates from the real logged-in user**; Following list reads the real `follows` table; Edit Profile saves name/bio/photo/genres to the DB.
- `showshak-settings.html` — real email shown, **real Sign Out**, **My Platforms is a real DB editor** (saves to `user_subscriptions`).
- `showshak-upload.html` — curator upload flow (mock; becomes real in Step 3).

### Shared frontend logic
- `showshak-shared.js` — the **single shared layer**: nav/chrome injection, toast, Save/Stacks system, **Following system (DB-backed)**, universal clip viewer, **guest gate** (browse free → prompt signup on Fire/Save/Follow or after 6 views), **post-login onboarding flow**, and the **real auth** (`ssIsSignedUp`, `ssCurrentUser`, `ssSignOut`, `_ssDbFire`, `_ssDbFollow`).
- `showshak-supabase.js` — creates the shared Supabase client as `window.ssDB` (uses the **anon public** key — safe in frontend; RLS does the real protection).
- `data/showshak-data.js` — **single source of truth for mock data**; projection functions rebuild each page's exact shape. (Verified byte-exact via `data/_verify.js`.)
- `data/_gen_seed.js` — generates the seed SQL (0007) from `showshak-data.js`.
- `data/_verify.js` — proves the centralized mock data matches originals.

### CSS
- `showshak-tokens.css`, `showshak-components.css`, `showshak-sidebar.css`, `showshak-mobile-nav.css` — the design system.

### Backend (SQL migrations — run in order in Supabase SQL Editor)
- `0001_initial_schema.sql` — all 16 tables + indexes + RLS on + seed reference data (moods, platforms, genres).
- `0002_grant_public_reads.sql` — public read access to reference tables.
- `0003_auth_user_trigger.sql` — auto-creates a `public.users` profile (with unique @handle) for every new auth account; users RLS.
- `0004_link_and_cleanup.sql` — `public.users.id → auth.users(id)` **ON DELETE CASCADE** (deleting a login removes its profile); dropped vestigial `user_auth`.
- `0005_onboarding_access.sql` — `user_subscriptions` access (onboarding platform picks) + documents the `avatars` Storage bucket setup.
- `0006_social_access.sql` — first attempt at social grants/RLS + `fires_count` trigger.
- `0007_seed_demo_content.sql` — **auto-generated**: 7 demo curators (real auth+profile, role=curator) + 8 demo clips (real `content`, linked to creator/title/platform) + genre/mood links. All tagged `meta.seed=true`.
- `0008_fix_social_grants.sql` — re-applied social grants idempotently (0006 had rolled back).
- `0009_whoami_debug.sql` — `whoami()` function to prove how the DB sees a request (authenticated vs anon).
- `0010_grants_check_and_reload.sql` — re-applied grants line-by-line, added `check_social_grants()`, and `NOTIFY pgrst 'reload schema'`.

### Backend docs / tools
- `backend-schema.md` — the authoritative table-by-table schema (source of truth for the DB).
- `backend-architecture.md` — higher-level architecture (stack, media pipeline, feed, scaling).
- `supabase/audit_constraints.sql` — read-only queries to verify PKs/FKs/uniques/checks + orphan spot-check.
- `supabase/SCHEMA_CHANGE_PROCESS.md` — the staging vs production safety process for schema changes.
- `supabase/RESET_demo_data.sql` — one-shot clean-slate wipe of all seed/demo data for launch.

---

## 6. The database (16 tables — the shape)

`users` (one table; curator = role 'curator'), `user_auth` (dropped — Supabase
handles auth), `titles` (TMDB-backed), `platforms` (catalog),
`user_subscriptions` (what a user has → Watch It routing), `content` (the clip),
`genres` + `content_genres`, `moods` + `content_moods`, `follows` (follow graph),
`content_fires` (the 🔥 = the like, as rows), `stacks` + `stack_items` (saved
collections), event streams (`watch_events`, `view_events`, `share_events`),
`watch_history`, `analytics_daily` (rollup cache), `reports` (DMCA/moderation),
`notifications` (digest).

Conventions on every table: `id` (uuid PK), `created_at`/`updated_at`/`deleted_at`
(soft delete), `meta jsonb` (future fields without migrations).

**Auth model:** `auth.users` (logins, Supabase-managed) ↔ `public.users`
(profiles, our app) linked by the same `id`. A trigger creates the profile on
signup. RLS uses `auth.uid()` to scope rows to the owner.

---

## 7. War stories / lessons learned (so we don't repeat them)

These are real bugs we hit and how we solved them — the lessons are gold.

1. **`permission denied for table X` (Postgres code 42501) = a missing
   table-level GRANT.** Happened first with `moods` (tables are locked by
   default since we chose "don't auto-expose new tables"), then again with the
   social tables. Fix = `grant ... to anon/authenticated` for exactly the
   tables/roles needed. Hit this whenever a brand-new table needs reading/writing.

2. **The Supabase SQL Editor runs a whole script as ONE transaction.** If any
   line errors, the *entire file rolls back* — even though it looked like it
   ran. That's why `0006`'s grants silently never applied. Lesson: for critical
   grants, keep statements **idempotent and independent** so one failure can't
   undo the rest (we split them out in `0008`/`0010`).

3. **`.upsert()` requires UPDATE privilege** — because it compiles to
   `INSERT ... ON CONFLICT DO UPDATE`. We had granted INSERT/SELECT/DELETE but
   **not UPDATE**, so fire/follow failed with permission denied even though
   everything else looked right. **Fix:** for toggle rows that are only ever
   inserted or deleted (never updated), use plain `.insert()` and ignore the
   duplicate-key error (code `23505`). Don't reach for upsert by reflex.

4. **The "localhost" auth errors** (email confirm link + Google redirect failing
   with "can't connect to server") = Supabase's default **Site URL / Redirect
   URLs** still pointed at `localhost`. Fix: set them to the real site URL
   (+ a `/**` wildcard redirect). Also: Google's **Authorized redirect URI**
   must be the **Supabase callback URL**, NOT the app's feed URL.

5. **Two user tables is not a duplicate bug.** `auth.users` (login) +
   `public.users` (profile) for the same person is by design. "Orphan profiles"
   came from deleting logins before the cascade FK existed (fixed in `0004`).

6. **`user_subscriptions` having one row per platform is correct** (a join table
   for a many-to-many relationship), not a bug. Don't cram lists into one column.

7. **`NO ACTION` in a foreign-key audit is normal** — it's the Postgres
   delete-rule name meaning "protected" (block deleting a parent with children),
   the opposite of a problem.

8. **Diagnose with a throwaway test page.** When production code swallows errors
   (`catch(e){}`), a tiny standalone HTML page that prints the raw error +
   `whoami()` + grant list told us *exactly* what was wrong. Build one when
   stuck; delete it when fixed. (This is principle #1 in action.)

---

## 8. Auth & funnel behavior (as built)

- **Guest-first:** a new visitor can scroll, open clips, Watch It, and Share for
  free. The first **Fire / Save / Follow** (or after viewing **6 clips**) shows
  a signup sheet. Anyone who came through onboarding or signed in is never gated.
- **Login methods:** Google ✅, Email ✅ (both working). Apple = ready, deferred.
- **On first login:** the onboarding flow runs once (name → @handle with live
  uniqueness check → genres → platforms → optional photo/gender → "Set up later").
  Marked done via `users.meta.onboarded = true` so it never repeats.

---

## 9. How to set up / reset (operational notes)

**Dashboard things only the human can do (code can't):**
- Create the Supabase project (Mumbai, Free plan).
- Run each migration `0001`…`0010` in the SQL Editor (in order).
- Auth → URL Configuration: Site URL + `/**` redirect = the real site URL.
- Auth → Providers: enable Google (Client ID/Secret from Google Cloud; Supabase
  callback URL into Google's Authorized redirect URIs). Email is on by default.
- Storage → create bucket **`avatars`** (public, 5 MB limit, MIME
  image/jpeg,png,webp).

**To wipe for a clean launch:** run `supabase/RESET_demo_data.sql` (removes all
`meta.seed=true` content + `@seed.showshak` curators), and delete real test
accounts in Authentication → Users (profiles cascade away).

---

## 10. Immediate next step

**Step 4 is fully done** — fires, follows, and saves/stacks all persist to
the DB (mirror-to-DB + hydrate-on-login pattern; sessionStorage stays the
instant UI layer). The next milestone is **Step 2 (Titles + Watch It via
TMDB)** for real availability data, and/or **Step 3 (real video via Mux)** —
the emotional core of the product. TMDB needs no deals and works today;
Mux needs an account + the upload pipeline. Recommended: TMDB/Watch It next
(unlocks the real "send them to the right platform" payoff), then Mux.

How saves/stacks work now (for reference): `ssCreateStack` uses a real UUID
so local id == DB id; every stack write mirrors to `stacks`/`stack_items`
via `.insert()`/`.delete()` (never upsert — lesson #3); `ssHydrateStacks()`
reloads them from the DB on login. Guests and mock (non-uuid) clips no-op
safely.

---

*Keep this file updated as we complete each step — it's the project's memory.*


---

## 11. Latest session — clip player, clean profile, Watch It (TMDB)

This section captures everything done after Step 4. Read it together with
`overview` to continue with full context.

### 11.1 Unified clip player (one engine everywhere)
- **Problem fixed:** the Feed had its OWN bespoke player AND the universal
  fullscreen viewer had a second one — Fire/Save/Watch It existed twice, so
  DB wiring was duplicated and drifted.
- **Now:** a single `ClipEngine` in `showshak-shared.js` powers BOTH the inline
  Feed and the fullscreen viewer. Built on a `Media_Surface` abstraction
  (`ssCreateSurface` → `GradientSurface` today; a `VideoSurface` seam is ready
  for Mux video later — the engine never branches on medium type).
- Shared, defined-once: `ssMakeProgressBar` (progress bar everywhere),
  `ssAttachGestures` (single-tap = pause/resume, quick double-tap = fire — with
  a touch/click de-dupe so one tap isn't counted twice), the action rail,
  the sound model, and `ssClipOrdering` (a Recommendation_Seam wrapping
  `_ssvBuildList` so a real recommendation feed can slot in later).
- **Sound model:** `Mute_Preference` persisted in `localStorage`
  (`ss_mute_pref_v1`). Fullscreen opens WITH sound (gesture-initiated); the
  inline Feed's first clip starts muted until first interaction, then unmutes.
- **Feed model (confirmed with founder):** Feed frames keep autoplaying inline,
  but a SINGLE TAP opens the fullscreen Viewer — all actions/gestures live in
  the Viewer. Removed the "you've seen it all" end card and the "tap for sound"
  badge. Feed now uses the SHARED Watch It sheet (dropped its bespoke one).
- Verified manually in-browser (no automated test harness in this project).

### 11.2 Clip-open + gesture bug fixes (post-ship)
- **Discover/Watchlist clips wouldn't open:** real DB clips have UUID ids, and
  the card markup pasted the id into inline `onclick` unquoted → invalid JS.
  Fixed by quoting ids and using `String(c.id)===` comparisons (UUID- and
  int-safe) across Discover (`clipCardHTML`, results, save btns) and Watchlist
  (rec grid). Profile was already safe (passes objects by index).
- Gesture handler rewritten so a genuine QUICK double-tap fires (not two slow
  clicks) and the synthetic touch+click no longer double-counts.

### 11.3 Clean per-user profile (no mock for signed-in users)
- `showshak-profile.html` now has a single gate `isSignedInOwn()`. When a real
  user is signed in and viewing THEIR OWN profile, every surface reads REAL,
  account-linked data: credentials (Following = real follows, Stacks = real
  stacks, Clips = real uploads, Followers = live DB count), My Clips grid,
  Collections (real Stacks), History (empty state), hero wall, and
  cockpit/analytics (0 for a new account). A brand-new user sees zeros/empty
  and it fills in live via `ssOnFollowingChange` / `ssOnStacksChange`.
- Logged-out visitors and the `?curator=` public view KEEP the demo/mock so the
  page is never blank.
- Still-needs-a-backend (currently shows 0 / empty, correct for a new user):
  fires-received, watch-it taps, reach, weekly chart (Step 5 events/rollups),
  and watch history (no watch-log table yet).

### 11.4 Step 2 — Watch It real availability via TMDB (DONE)
**The constraint:** TMDB (api/website/images) is ISP/DNS-blocked in India. So
the architecture is **cache-first**: the browser NEVER calls TMDB; it only reads
cached data from Supabase (Mumbai). A local Node script is the ONLY thing that
touches TMDB.

- **Producer (NEW):** `data/ingest-tmdb.js` — a standalone Node script the
  FOUNDER runs locally on a TMDB-reachable network (VPN / Cloudflare DNS /
  mobile hotspot). It links each `titles` row to TMDB (search by name+year,
  subtitle-tolerant matching), fetches region-aware FLATRATE providers, maps
  them onto our `platforms` catalog, and writes `titles.providers` (JSONB keyed
  by region, e.g. `{ "IN": [ {provider_name, provider_id, logo_path, type,
  platform_id, catalog_name, color, abbr} ] }`) + `titles.tmdb_id` +
  `titles.cached_at`. Uses the Supabase **service-role** key. Idempotent;
  `--force` re-links everything. Polite delay; per-title try/catch + summary.
- **Consumer (frontend, in `showshak-shared.js`):** `ssLoadClips()` now also
  pulls `title.providers`/`cached_at` + `platform_id`. One resolver
  `ssResolveWatchOptions(clip, region, subs)` turns the cache into the Watch It
  sheet options: region providers → branded options, "✓ In your plan" first
  (via `ssGetSubscribedPlatformIds()`), else fallback to the curator's platform,
  else a neutral "Not available to stream in your region" message.
  `ssGetRegion()` = `users.region` (default 'IN'). `ssOpenSheet` is now async.
- **Result of the ingest run:** all 8 seed titles linked with real IN providers
  (Squid Game/Stranger Things/Sacred Games → Netflix; The Last of Us/The Bear →
  JioHotstar; Panchayat/Mirzapur → Prime Video; Scam 1992 → SonyLIV).

#### How to re-run the ingest (founder, when titles change)
1. Be on a TMDB-reachable network (VPN / Cloudflare DNS 1.1.1.1 / hotspot).
2. `data/.env` (gitignored) holds `TMDB_API_KEY`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`. Copy from `data/.env.example` if missing.
3. `cd data && npm install @supabase/supabase-js` (once). Needs Node 18+.
4. `node data/ingest-tmdb.js`  (or `--force` to redo all). Re-run if the
   hotspot drops some calls ("fetch failed") — it's idempotent and resumes.

### 11.5 New war stories / lessons (this session)
- **`service_role` was permission-denied on `platforms`/`titles`.** Our DB was
  set to "lock every table by default," which also withheld grants from
  service_role. Fix = migration **`0011_grant_service_role.sql`** (grant
  service_role full DML on `public` + default privileges — Supabase's standard
  posture, SAFE/additive). Run once in the Supabase SQL editor.
- **Don't interpolate raw ids into inline `onclick`.** UUIDs aren't valid bare
  JS — always quote + compare with `String()`.
- **TMDB title matching** must tolerate subtitles ("Scam 1992" vs "Scam 1992:
  The Harshad Mehta Story") — the matcher accepts when the target's tokens are
  a subset of the candidate's.
- **`data/.env` must never be committed** (gitignored). The service-role + TMDB
  keys live ONLY there; the shipped app uses the anon key + reads the cache.

### 11.6 Deferred (by design) / next up
- **Watch It deep-links + attribution:** the sheet currently toasts; real
  universal-link deep-links into Netflix/Prime + click attribution are later.
- **Posters/synopsis from TMDB images:** skipped — `image.tmdb.org` is also
  India-blocked; would need a proxy (e.g. a Cloudflare Worker) later.
- **Recommended next milestone: Step 3 — real video via Mux** (needs a Mux
  account + upload→transcode→playback pipeline; the `VideoSurface` seam in the
  clip engine is already there to receive it). Then Step 5 (events + analytics
  rollups) to make the profile cockpit numbers real.

### 11.7 Specs created this session (in `.kiro/specs/`)
- `unified-clip-player/` — the one-engine consolidation.
- `watch-it-availability/` — the TMDB cache-first Watch It feature.
(Each has requirements.md / design.md / tasks.md if deeper detail is needed.)

---

## 12. Step 3 — Real video via Mux (CODE-COMPLETE; activation pending)

This section captures the Mux video work. The **code is fully written, wired,
and verified** (no diagnostics; pure-helper property suite green). What remains
is **founder-only activation** (Mux account, function deploy, secrets, migration
apply) and the live end-to-end test — none of which an agent can do.

### 12.1 What it does
Replaces the gradient-only mock clips with **real short-form video via Mux**,
played by the `<mux-player>` web component behind the **existing**
`MediaSurfaceContract`. The clip engine, gestures, mute, progress bar, and the
Fire/Save/Share/Watch It rail are unchanged — `VideoSurface` simply replaces the
gradient medium behind them. Gradient and video clips coexist in one continuous
feed. It's a TikTok/Reels-style player (windowed preload, bounded players) that
works in today's static PWA and carries forward to a native app (the Mux
*playback id*, not the player widget, is the portable contract).

### 12.2 The pipeline (how a clip becomes real video)
```
curator picks file → publish():
  1. mux-upload-url Edge Function mints a Mux direct-upload URL (auth-gated)
  2. browser PUTs the bytes straight to Mux (progress bar; never via Supabase)
  3. INSERT content row, status='processing'  (RLS: creator_id = auth.uid())
Mux encodes → fires video.asset.ready →
  4. mux-webhook Edge Function verifies the signature, then flips the row to
     'live' + stores mux_playback_id / thumbnail_url / duration_sec (idempotent)
feed:
  5. ssLoadClips returns only 'live' clips with their Mux fields
  6. ssCreateSurface(clip.muxPlaybackId) → VideoSurface(<mux-player>) plays it
```

### 12.3 What was built (file by file)
- **`supabase/migrations/0012_content_insert_and_mux.sql`** (NEW, additive):
  grant + RLS insert policy `content_insert_own` (`creator_id = auth.uid()`);
  documents the `mux_upload_id`-in-`meta` and `meta.seed` conventions. The
  `content` table already had every Mux column (from 0001), so this is the only
  DB change — additive, applied directly per `SCHEMA_CHANGE_PROCESS.md`.
- **`showshak-shared.js`**:
  - `ssLoadClips` now selects `mux_playback_id/url/thumbnail_url/duration_sec`,
    maps `muxPlaybackId`/`poster`, and takes an `offset` arg (`.range()` paging).
  - `ssMapContentRowsToClips` — pure, Node-testable row→clip filter+map.
  - `ssClipsForFeed` / `ssClipsForDiscover` carry the Mux fields through.
  - `VideoSurface(clip, opts)` — the one missing primitive: full
    `MediaSurfaceContract` over `<mux-player>` (poster/gradient loading state,
    `error`→advance so a bad load never stalls the feed). `ssCreateSurface`
    now routes to it; the engine still never branches on surface type.
  - Pure surface helpers `ssClipProgress` / `ssSeekToTime` / `ssMuteRoundTrip`.
  - Sliding-window pager: `ssShouldFetchNextWindow` + `ssMountedPlayerSet`
    (pure) + `ClipEngine.appendInline` / `pruneInlineSurfaces` +
    `ssLoadClipWindow` / `loadNextWindow` / `ssStartFeedPager`. Window of ~10,
    fetch next at the +6 leading edge, bounded mounted players
    (`SS_MAX_LIVE_PLAYERS = 4`), `preload="auto"` on the mounted band.
- **`showshak-feed.html`**: loads the first window, mounts via the engine, and
  starts the DB-backed pager (mock/offline stays a no-op).
- **`showshak-{feed,discover,watchlist,profile}.html`**: `<mux-player@3>` CDN
  `<script>` added (the pages that can open the clip viewer).
- **`showshak-upload.html`**: real `publish()` — auth guard, mint via
  `ssDB.functions.invoke('mux-upload-url')`, `ssPutWithProgress` (XHR direct
  upload, live %), insert `content` as `processing`, "CLIP PROCESSING" success
  screen. Mirrors the processing clip into the sessionStorage instant-UI layer.
- **`showshak-profile.html`**: amber `● PROCESSING` badge on My Clips rows whose
  `status === 'processing'` (feed still excludes them).
- **Edge Functions (NEW — the project's first):**
  `supabase/functions/_shared/cors.ts`, `_shared/mux.ts` (Basic-auth + direct
  upload helper), `_shared/verify-signature.ts` (HMAC-SHA256 verify, 5-min
  replay window), `mux-upload-url/index.ts` (auth-gated mint), and
  `mux-webhook/index.ts` (signature-verified, idempotent flip via service role).
- **Tests (NEW):** `tests/pure-helpers.test.js` (Node, no framework — 7
  properties, ≥200 iters each, **all green**) and
  `supabase/functions/_shared/verify-signature.test.ts` (Deno — signature +
  idempotency; runs under `deno test`, not run locally as Deno isn't installed).

### 12.4 War stories / lessons (this session)
- **You can unit-test browser-coupled helpers in Node by stubbing the DOM.**
  `showshak-shared.js` runs DOM setup at load (`document.body.insertAdjacentHTML`,
  inject IIFEs, `MutationObserver`), so the Node test installs a tiny no-op
  `window`/`document`/`MutationObserver`/`IntersectionObserver` stub BEFORE
  `require()`. The pure helpers then test cleanly. (Also: `global.navigator`/
  `location` are getter-only in modern Node — assign defensively.)
- **PBT earned its keep:** the bounded-players property (Property 10) caught a
  real edge-case bug — `ssMountedPlayerSet` could drop the ACTIVE clip when the
  cap was tiny. Fixed so the active index is always inside the band. (The live
  app uses cap=4 so it never hit it, but the helper is now correct for any cap.)
- **Don't interpolate the upload id as a column:** stored in `content.meta`
  (`meta->>'mux_upload_id'`) so no new column — keeps the migration additive.
- **`mux-webhook` deploys with `--no-verify-jwt`** (Mux isn't a Supabase user;
  it authenticates by signing the body, which the function verifies itself).
  `mux-upload-url` keeps JWT verification ON.

### 12.5 STILL TO DO — founder-only activation (an agent can't do these)
These are the only things between "code-complete" and "real video flowing":
1. **Create/confirm a Mux account.** In the Mux dashboard add the webhook URL
   (`<project>.functions.supabase.co/.../mux-webhook` i.e.
   `…/functions/v1/mux-webhook`) and copy its **signing secret**.
2. **Deploy the functions:** `supabase functions deploy mux-upload-url` and
   `supabase functions deploy mux-webhook --no-verify-jwt`.
3. **Set function secrets:** `supabase secrets set MUX_TOKEN_ID=… MUX_TOKEN_SECRET=…
   MUX_WEBHOOK_SECRET=… APP_ORIGIN=https://<app>` (SUPABASE_URL /
   SUPABASE_SERVICE_ROLE_KEY are injected by the runtime).
4. **Apply `0012_content_insert_and_mux.sql`** in the Supabase SQL editor
   (additive/SAFE).
Then run the **end-to-end test** (task 11.1): upload a clip → see it
`processing` (excluded from feed + badged in My Clips) → webhook flips it `live`
→ it plays as real video in the feed.

### 12.6 Deferred (by design) / next up
- **Real `title_id`/`platform_id` on upload:** the upload show-picker is still
  the mock catalog, so `publish()` inserts `title_id: null` for now (the schema
  allows it). It fills in once curators pick TMDB-backed titles.
- **Posters:** Mux's image CDN (`image.mux.com`) is used for thumbnails and is
  NOT India-blocked (unlike TMDB images), so posters work without a proxy.
- **Recommended next milestone after activation: Step 5 — events + analytics
  rollups** (make the profile cockpit numbers real), then Step 6 (moderation/
  notifications/search) and Step 7 (harden + PWA layer).

### 12.7 Spec created this session (in `.kiro/specs/`)
- `mux-video-clips/` — this feature (requirements.md / design.md / tasks.md).
  All implementation + checkpoints + property tests done; manual verification
  (§11 of the spec) and founder setup (§12 of the spec) remain.

---

## 13. Mux activation + auth-funnel fix (live-wiring session)

This session took Step 3 from "code-complete" toward "live," set up the Mux
backend for real, and fixed a root-cause auth bug found while testing. Property
tests for the Mux pure helpers were also added and run green.

### 13.1 Property tests added (and a real bug they caught)
- **`tests/pure-helpers.test.js`** (Node, no framework — run `node tests/pure-helpers.test.js`):
  7 properties, ≥200 iterations each, **all green**. Covers the loader filter/map
  (P1+2), surface factory selection (P3), progress clamp (P4), seek round-trip
  (P5), mute round-trip (P6), window-fetch threshold (P9), bounded players (P10).
  It loads `showshak-shared.js` in Node by installing a tiny no-op DOM/window
  stub first (the file runs DOM setup at load). `ssCreateSurface`/`VideoSurface`/
  `GradientSurface` were added to the CommonJS exports so the factory is testable.
- **`supabase/functions/_shared/verify-signature.test.ts`** (Deno): signature
  auth (P7) + flip idempotency (P8). Runs under `deno test`; not run here (Deno
  not installed locally).
- **Lesson / win:** the bounded-players property caught a real edge-case bug —
  `ssMountedPlayerSet` could drop the ACTIVE clip when the cap was tiny. Fixed so
  the active index is always inside the mounted band. (Live app uses cap=4 so it
  never hit it, but the helper is now correct for any cap.) This is principle #1
  (test-first to find the exact bug) paying off.

### 13.2 Mux activation done (founder, this session)
All the founder-only setup from §12.5 of this report is DONE:
- Supabase CLI installed on Windows via **Scoop** (npm global is no longer a
  supported install path for the CLI; `npm i -g supabase` is dead). Fixed the
  PowerShell "running scripts is disabled" block with
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
- `supabase login` + `supabase link --project-ref koqfxgrlwczlizfopmwa` ✓
- Migration **0012** applied in the SQL editor ✓
- Mux account created; **Production** environment; API token (Video read+write)
  generated → `MUX_TOKEN_ID` / `MUX_TOKEN_SECRET`.
- Both Edge Functions deployed: `supabase functions deploy mux-upload-url` and
  `supabase functions deploy mux-webhook --no-verify-jwt` ✓
- Mux **webhook** created in Production pointing at
  `…/functions/v1/mux-webhook`; signing secret → `MUX_WEBHOOK_SECRET`.
- Secrets set: `supabase secrets set MUX_TOKEN_ID=… MUX_TOKEN_SECRET=…
  MUX_WEBHOOK_SECRET=… APP_ORIGIN=https://piyush-120898.github.io` → "Finished" ✓

Operational notes for next time:
- This shell is **PowerShell** (not cmd) — use `;` to chain, single-quote secret
  values so special chars don't get mangled.
- The Mux **token and the webhook must be in the same Mux environment** (we used
  Production). Consistency matters more than which one.

### 13.3 Auth-funnel ROOT-CAUSE fix (landing page was faking login)
**Symptoms:** (a) the landing-page Google/Email sign-in didn't actually log you
in, and (b) the in-app guest gate (the signup sheet that should pop on the first
Fire/Save/Follow) never appeared.

**Root cause (single bug, two symptoms):** `index.html`'s onboarding
`handleAuth()` was a MOCK — it saved `localStorage['ss_user_profile_v1']` and
walked you into the feed without ever calling Supabase. And
`ssIsSignedUp()` in `showshak-shared.js` treated the presence of that key as
"this person is signed in." So after the landing onboarding the app thought you
were signed in (→ guest gate suppressed) while there was NO real Supabase session
(→ uploads/real actions impossible).

**Fix (reuses the REAL auth already in `showshak-shared.js` — no duplicated login code):**
1. `ssIsSignedUp()` no longer treats `ss_user_profile_v1` as auth — only a real
   live Supabase session (`_ssSession`) or the explicit post-login flag counts.
   This makes the guest gate fire correctly for genuine guests.
2. `index.html` `handleAuth()` now saves the taste picks, then **hands off to the
   real auth**: it redirects to `showshak-feed.html?auth=google|apple|email`.
3. A small **auth deep-link handler** was added inside the guest-gate IIFE: on
   load it reads `?auth=…`, strips the param (so OAuth returns clean / no loop),
   and triggers the real flow — providers → `signInWithOAuth`, email → the inline
   email/password form. So the landing buttons now drive real Supabase login.

**Still required for that real login to fully complete (Supabase dashboard):**
- Auth → **URL Configuration**: Site URL + a `/**` redirect must include the live
  site (`https://piyush-120898.github.io`) so the email confirm link / OAuth
  return don't bounce to localhost (this is War-Story lesson #4).
- Auth → **Providers → Google** must be enabled (Client ID/secret + Supabase
  callback URL in Google Cloud) for Google to work; **Email** works with just the
  URL config above. Apple stays deferred.
- Existing browsers that went through the OLD mock onboarding still carry a stale
  `ss_user_profile_v1`; after this change they're correctly treated as guests
  (a hard refresh clears any confusion).

### 13.4 OPEN ISSUE (being debugged) — "Upload couldn't start"
On the final upload step, `publish()` showed **"Upload couldn't start — please
try again."** That toast fires only when the call to the `mux-upload-url` Edge
Function returns no `{uploadUrl, uploadId}`. Because it's that message (and NOT
"Sign in to post your clip"), the **real session is working** — the failure is in
the function or the Mux call behind it. The Supabase "shutdown / EarlyDrop" log
line is just normal cleanup, not the error.

Diagnosing via the exact error (principle #1): need the **Network status** of the
`mux-upload-url` request (401 = token not seen by function; 502 /
`mux_upload_create_failed` = Mux rejected — usually token permission/environment;
red CORS = `APP_ORIGIN` mismatch) and `supabase secrets list` to confirm all four
secrets are present. Fix pending that readout.

### 13.5 Next
- Resolve §13.4 (likely a Mux credential/permission/env or APP_ORIGIN detail),
  then run the full end-to-end test (spec task 11.1): upload → `processing`
  (excluded from feed, badged in My Clips) → webhook flips to `live` → real video
  plays in the feed.
- Then mark spec tasks 11.x / 12.x done, and Step 3 is fully live.
- After that: Step 5 (events + analytics rollups) to make the cockpit numbers real.

---

## 14. Live debugging — getting the upload pipeline actually working

Worked through the real upload end-to-end on the live site. The code path was
right; activation surfaced three concrete bugs, fixed in order by reading the
EXACT error each time (principle #1) rather than guessing.

### 14.1 Bug A — guest gate / fake landing login (see §13.3) ✅ fixed
Already covered in §13.3: the landing page faked login and `ssIsSignedUp()`
treated the local prefs as a session. Fixed; landing now hands off to real auth,
and a real signed-in user (`USER: <uuid>`) was confirmed in the browser console.

### 14.2 Bug B — Edge Function CORS blocked the browser ✅ fixed
Symptom (browser console): `Access to fetch … blocked by CORS policy: Request
header field x-client-info is not allowed by Access-Control-Allow-Headers`.
Cause: supabase-js sends `apikey` + `x-client-info` (+ a version header) on every
`functions.invoke`, but `_shared/cors.ts` only allowed `authorization,
content-type`, so the preflight failed before the function ran.
Fix: widened `Access-Control-Allow-Headers` to
`authorization, x-client-info, apikey, content-type, x-supabase-api-version`,
then `supabase functions deploy mux-upload-url`.

### 14.3 Bug C — wrong Mux API path (404) ✅ fixed
After CORS, the mint returned **502 `mux_upload_create_failed`**. Temporarily
surfaced Mux's raw response from the function, which showed:
`404 {"error":{"type":"not_found",...}}`. Cause: the Mux Video REST API is
**versioned** — the create-direct-upload endpoint is `/video/v1/uploads`, not
`/video/uploads` (what `_shared/mux.ts` had). Fix: corrected the path to
`/video/v1/uploads` and redeployed. The mint then returned a real
`{ uploadUrl, uploadId }` and a clip uploaded successfully (row inserted
`status='processing'`).

> TEMP DEBUG STILL IN PLACE: `mux-upload-url` currently returns Mux's raw error
> `detail` in the 502 body to aid debugging. Trim this back to a generic message
> once the pipeline is confirmed (minor info-leak; pre-launch only).

### 14.4 Deploy gotchas learned
- `supabase functions deploy` must be run from the PROJECT ROOT
  (`C:\Users\hp\Desktop\ss-test\showshak-v2`). Running it elsewhere gives
  "Entrypoint path does not exist / cannot find supabase\functions\…\index.ts".
- "WARNING: Docker is not running" on deploy is harmless — deploy bundles +
  uploads without Docker.
- The Kiro integrated shell did NOT have `supabase` on PATH (Scoop updated PATH
  in a separate window); run CLI commands in the standalone PowerShell window.
- Browser-console diagnosis pattern that worked great: signed-in, run
  `window.ssDB.functions.invoke('mux-upload-url',{body:{}})` and print
  `r.data` / `r.error.context.status` / `await r.error.context.text()`.

### 14.5 OPEN — clip stuck on "processing" (webhook not flipping to live)
After a successful upload, the clip stayed `processing` for 2+ minutes. Mux
**Activity shows `video.asset.ready` fired**, so Mux finished encoding and
emitted the event — meaning the `mux-webhook` side isn't completing the flip.
Currently diagnosing by reading the EXACT response Mux got / our function
returned. Candidate causes (in priority order):
  1. **Signature mismatch** → `mux-webhook` returns 401 and updates nothing
     (re-copy the webhook's signing secret → re-set `MUX_WEBHOOK_SECRET`).
  2. **Row match miss** → reaches us (200) but `updated: 0` (the
     `meta->>'mux_upload_id'` match or the `upload_id` on the event).
  3. **Delivery/config** → webhook URL or Mux environment mismatch.
Next: check Supabase `mux-webhook` logs (status code) + Mux Settings → Webhooks →
recent delivery response code, then fix precisely.


---

## 15. Session — Mux went LIVE, feed performance overhaul, and Curator Upload v2 spec (in progress)

This session: (a) resolved the §14.5 "stuck on processing" mystery — the
pipeline was actually fine; the bug was a UI read-path. (b) Made the video feed
feel A-grade (looping, per-user cache, bounded players, preconnect, fixed
audio/reload bugs). (c) Confirmed Mux plan/cost reality. (d) Started building
**Curator Upload v2** as a spec — requirements done, first two DB migrations
applied + verified.

> **How to continue in a new chat:** paste this file. Current task pointer is in
> §15.6 ("NEXT"). We are working **one task at a time**, DB-first, and the
> founder runs each migration in the Supabase SQL editor then says "go".

### 15.1 The "stuck on processing" was a UI lie — Mux is fully live
Diagnosed via ground truth (a service-role Node script reading the `content`
table), not the UI. Findings:
- The `mux-webhook` works perfectly: it flips `processing → live` and sets
  `mux_playback_id` etc. (confirmed `{updated:1}` in logs + every live clip's
  `stream.mux.com/<id>.m3u8` returns 200).
- The clips looked "stuck" only because **the profile read clip status from
  `sessionStorage` (the `ss_my_clips_v1` mirror written once at upload as
  'processing') and never queried the DB.** So the webhook flip was never
  reflected in the UI.
- The earlier uploads that "got stuck" were from before the webhook secret/deploy
  were fully wired; Mux had already exhausted retries for those old events. New
  uploads flip correctly.
- **Step 3 (Mux real video) is now LIVE end-to-end.** Webhook diagnostic logging
  was added then trimmed back; the temp raw-error leak in `mux-upload-url` was
  also removed. Functions redeployed clean.

### 15.2 Fixes shipped this session (all committed + pushed to main)
1. **My Clips loads from the DB** (`ssLoadMyClips()` in `showshak-shared.js` +
   profile hydrates from it). Uploads now persist across re-login and reflect
   real live status. (commit fix(profile)…)
2. **Viewer played only the gradient** → `_ssvNormalize` (the fullscreen viewer's
   clip normalizer) was **dropping `muxPlaybackId`/`poster`**, so `ssCreateSurface`
   fell back to GradientSurface. Fixed: it now carries Mux fields + Watch It
   cache through. (commit fix(viewer)…)
3. **Looping + preload** — the active clip now LOOPS until you scroll (native
   `loop` on `<mux-player>`; GradientSurface restarts). Added a `preload()` to the
   surface contract; the next clip is warmed when one becomes active. (commit
   feat(player)…)
4. **Per-user instant-open cache + poster-first + bounded warming** — the feed
   caches its first window in `localStorage` keyed per user (stale-while-
   revalidate; versioned/capped/TTL'd; skips the revalidation query if <30s old).
   Poster-first frames (Mux thumbnail) show instantly. Warming is bounded to the
   next ~2 clips. New `tests/feed-cache.test.js` (5 properties, incl. per-user
   isolation) all green. (commit feat(feed)…)
5. **0013_feed_index.sql** — partial index `idx_content_feed_live` on
   `content(created_at desc) where status='live' and deleted_at is null` matching
   the exact feed query. APPLIED in SQL editor (founder confirmed).
6. **Bounded viewer players (THE big perf fix)** — the fullscreen viewer was
   mounting a `<mux-player>` for EVERY clip at once (10-50+), all buffering in
   parallel → black screens / audio-without-video / everything slow. Now the
   viewer mirrors the inline feed's bounded band (`_ssvWireClip` +
   `_ssvPruneSurfaces` + `ssMountedPlayerSet`, max 4 players), with poster-first
   frames for un-mounted clips. (commit perf(viewer)…)
7. **No double-player on fullscreen open + reliable audio on scroll** —
   - Opening the viewer now PAUSES the inline feed behind it (they were both
     playing the same clip → double audio + bandwidth fight + visible re-load).
     Resumed on close. Viewer reuses the HTTP segment cache for a fast start.
   - New `_ssActivateSurface(surface, wantMuted)`: **play muted first (always
     allowed), then unmute the now-playing element** — the production-standard
     autoplay-policy-safe sequence. Fixes "video plays but no audio" on scroll.
     (commit fix(player)…)
8. **Preconnect hints** in every clip page `<head>` (stream.mux.com, image.mux.com,
   cdn.jsdelivr.net, the Supabase project) → faster first-clip start on cold open.
   (commit perf(open)…)

### 15.3 Performance architecture (how the feed scales to 100-200 clips / 2000 users)
- **Bounded players**: never more than `SS_MAX_LIVE_PLAYERS = 4` `<mux-player>`s
  mounted at once, sliding around the active clip — in BOTH the inline feed and
  the fullscreen viewer. This is the key to not crashing mobile / saturating
  bandwidth regardless of feed length.
- **Poster-first** everywhere (Mux `image.mux.com` thumbnails — NOT India-blocked).
- **Per-user `localStorage` feed cache** (stale-while-revalidate) → instant repeat
  opens, fewer DB hits.
- **Partial feed index** (0013) keeps the feed query cheap as content grows.
- The feed is inherently the slowest page to "open" because it's the only one that
  starts VIDEO on load (others render image/gradient cards). Cold first-open will
  always have some load; repeat opens are instant via the cache.
- Honest limit: web autoplay-with-sound is browser-policy-bound. The muted-first-
  then-unmute pattern is what TikTok/IG web do. Bulletproof audio comes with the
  future NATIVE app (the Mux playback id is the portable contract). PWA helps
  app-shell load + installability but does NOT fix first-video buffering or audio.

### 15.4 Mux plan + cost reality (researched)
- **Free plan = max 10 videos stored** (hard cap) — fine for prototyping, NOT for
  real curators. Must move off it.
- **Pay-as-you-go**: no storage cap, 100K free delivery min/month, $20/mo usage
  credit. At "Basic" quality (built for UGC): **input/encoding FREE**, storage
  $0.0024/min/mo, delivery $0.0008/min after the free 100K. For ShowShak's scale
  this is ~$0-5/mo, likely covered by the credit.
- **Action for founder:** upgrade off the 10-video free cap; apply to the **Mux
  Startup Program ($500 credits)** — covers months/years at this scale. (A draft
  message to Mux sales was prepared.)
- Implication baked into upload limits: **90s duration cap** controls cost; use
  Basic quality; Mux auto cold-storage discounts inactive clips.

### 15.5 New ops tooling (kept, re-runnable — NOT throwaway)
- `data/_healthcheck.js` — end-to-end pipeline health (content rows, no stuck
  processing, Mux streams reachable, feed query timing). `node data/_healthcheck.js`
- `data/_verify_upload_v2.js` — verifies the Upload v2 migrations against the live
  DB (service role): content_titles CRUD + PK + FK, content UPDATE path. Re-run as
  schema grows. `node data/_verify_upload_v2.js`
- `showshak-rls-check.html` — in-browser anon-key RLS check (the service role
  bypasses RLS, so owner-scoping can only be proven from the browser). Open it
  signed in as a curator and click "Run RLS checks": confirms a non-owner cannot
  read another curator's draft (9.3), cannot UPDATE another curator's clip (10.1),
  and cannot insert/delete another curator's `content_titles` (6.6) — i.e. the
  0014/0015 policies hold under the anon/authenticated role.
- (Lesson: we now VERIFY migrations against the DB right after applying, and run
  test suites before declaring a step done — so we don't discover breakage later
  like in the Mux debugging.)

### 15.6 Curator Upload v2 — the active feature (spec-driven, one task at a time)
**Why:** the current upload links to a MOCK catalog → `publish()` inserts
`title_id=null`/`platform_id=null` and never writes genres. So uploaded clips have
no real title (Watch It broken on them) and no genres (Discover broken). This is
the gap between "video works" and "the product works."

**Spec location:** `.kiro/specs/curator-upload-v2/` (requirements.md done;
design.md intentionally SKIPPED — building task-by-task instead per founder's
preference). Requirements = 10 requirements, EARS format:
1. Link clips to REAL `titles` (create-if-missing; Watch It degrades to the
   curator-selected platform until the TMDB ingest enriches providers).
2. MULTIPLE titles per clip (`content_titles` join table).
3. Auto-genres from linked TMDB titles → `content_genres` (union/dedup).
4. Duration ≤ 90s + size ≤ ~300MB, enforced client-side BEFORE minting the Mux
   upload AND re-checked in the webhook (delete asset if over). Mux "Basic" tier.
5. Pitch: **NO minimum**, **max 280 characters** (decided), soft sweet-spot hint.
6. Preserve core behavior (title hidden until Watch It, auth-gated, additive +
   RLS-safe, secrets server-side only).
7. Clip TRIM (in/out points; trimmed segment ≤ 90s; only the segment uploads).
8. Cover/thumbnail SELECT (pick a frame → Mux thumbnail at timestamp).
9. DRAFTS (status='draft' content row; owner-private; resume/publish/discard).
10. EDIT-AFTER-POST (edit pitch/titles/vibes/cover; video/Mux asset immutable).
**Deferred (NOT in v2):** image posts (media_type + Storage + ImageSurface),
resumable upload (Mux UpChunk), rights/guidelines acknowledgment, auto-captions.

**Build order (DB-first), with status:**
- ✅ **Task 1 — `0014_content_titles.sql`** APPLIED + verified. Many-to-many
  clip↔title join (sort_no, PK prevents double-link, FK cascade on content).
  `content.title_id` KEPT as the primary title (sort_no 0) for backward-compat;
  `content_titles` holds the full set. Public read for live clips; owner-only
  insert/delete (mirrors stack_items RLS).
- ✅ **Task 2 — `0015_content_update_and_drafts.sql`** APPLIED + verified. Added
  `content_select_own` (owner reads their own draft/processing/live/removed —
  this also fixed a latent gap: owners couldn't read their own non-live clips
  under RLS) and `content_update_own` + `grant update` (edit-after-post + draft
  publish + soft-delete). Drafts need no new column (status='draft', hidden by the
  public live-only read policy). Accepted tradeoff noted in-file: table-level
  update lets an owner set their own clip 'live' without a real asset (cosmetic
  only → renders as gradient; still owner-scoped). Status-transition hardening +
  status CHECK constraint deferred.

- ⬜ **NEXT — Task 3: Title search + create-if-missing.** Browser searches the real
  `titles` table (anon read); selecting links it; "not found → add it" creates a
  `titles` row (tmdb_id null until the founder re-runs `data/ingest-tmdb.js` to
  enrich genres+providers). DECISION TO MAKE in Task 3: allow authenticated
  INSERT on `titles` via RLS policy, OR route title-creation through an Edge
  Function (recommend evaluating both; an Edge Function gives more control over
  dedup/normalization but the RLS-insert path is simpler). Remember: browser
  NEVER calls TMDB (India-blocked).
- ⬜ Task 4: Auto-genres (recommend a SECURITY DEFINER function/trigger that copies
  a linked title's genres into `content_genres`, union/dedup).
- ⬜ Task 5: Validation (client-side duration via HTMLVideoElement.duration +
  file.size before minting; webhook duration re-check + asset delete if >90s;
  set Basic quality tier in `_shared/mux.ts` createDirectUpload
  new_asset_settings).
- ⬜ Task 6: Upload UI rewrite (`showshak-upload.html`) — real title picker +
  multi-title, pitch 280/no-min, publish() inserts content + content_titles +
  primary title_id; VERIFY RLS behavior live with a real session here.
- ⬜ Task 7: Clip trim (decide client-side re-encode vs Mux input slicing).
- ⬜ Task 8: Cover/thumbnail picker.
- ⬜ Task 9: Drafts UX. Task 10: Edit-after-post UX. Then Watch It multi-title UI
  update in `ssResolveWatchOptions`/the sheet (one title → list of titles, each
  with region-aware providers + curator-platform fallback).

### 15.7 Migrations index update
- `0013_feed_index.sql` — partial feed index (applied).
- `0014_content_titles.sql` — multi-title join table (applied).
- `0015_content_update_and_drafts.sql` — content owner read + update, drafts
  enablement (applied).
- Next migration numbers: 0016+ (e.g. titles insert policy and/or auto-genres
  function, if those tasks choose the DB route).

### 15.8 Known follow-ups / housekeeping
- A few duplicate/test clips from debugging exist in `content`; one was
  soft-deleted (deleted_at). Founder may want to tidy the rest before launch.
- `points to keep in mind pitch wise.txt` and `overview` are untouched founder docs.
- Roadmap after Upload v2: Step 5 (events + analytics rollups → real creator
  cockpit numbers), Step 6 (moderation/DMCA + reporting — needed before opening to
  public users), Step 7 (harden + PWA).

---

## 16. Curator Upload v2 — design-first spec, near-complete implementation

This section supersedes the §15.6 build-order pointer. After §15 we switched the
`curator-upload-v2` feature to a **design-first spec** (full `design.md` written
before tasks) and rebuilt the task list around it. We are executing **one task at
a time** via the spec task runner; the founder says "next" between tasks.

> **How to continue in a new chat:** paste this file. The current pointer is in
> §16.5 ("NEXT"). Pure helpers + Edge Functions + the entire upload UI + drafts
> are done and `npm test` is green (12 files). Remaining: edit-after-post UI,
> multi-title Watch It sheet, in-browser RLS checks, final checkpoint, cleanup.

### 16.1 Spec docs (in `.kiro/specs/curator-upload-v2/`)
- `requirements.md` — 10 requirements (EARS), done earlier (§15.6).
- `design.md` — full design: data-driven step model, **client-side ffmpeg.wasm
  stream-copy trim** (lazy CDN ESM), cover-as-timestamp, drafts = `status='draft'`
  rows, edit = mutable-only patch (video asset immutable), 10 correctness
  properties mapped to 10 property tests, fail-closed error table.
- `tasks.md` — ~60 leaf/checkpoint tasks across 20 groups, with a wave dependency
  graph. Pitch max locked at **280 chars**.

### 16.2 Pure helpers in `showshak-shared.js` (all built + property-tested)
All exported under the existing `module.exports` (and `window.*`) so Node tests
can require them. Each has a `fast-check` property test in `tests/` (≥100 iters,
one property per file, tagged `Feature: curator-upload-v2, Property <n>`):
- `ssValidatePitch` (P1, max 280, no min, soft sweet-spot 80–180).
- `ssTrimDuration` / `ssValidateTrim` / `ssIsFullSourceTrim` (P2, P3; cap 90s).
- `ssValidateMediaFile` (P4; SS_DURATION_CAP=90, SS_FILE_SIZE_CAP≈300MB).
- `ssGenreUnion` (P5; dedup, order-stable, empty-safe).
- `ssResolveWatchOptionsForTitles` (P6; one entry per title, reuses the existing
  single-title resolver + curator-platform fallback).
- `ssBuildTitleLinks` / `ssCanPublish` (P7; ordered sort_no 0..n-1, ≥1 to publish).
- `ssCoverThumbUrl` / `ssParseCoverTime` (P8; round-trips, `time=0` kept).
- `ssDraftToRow` / `ssDraftToLinks` / `ssRowToDraft` (P9; draft round-trip).
- `ssBuildEditPatch` (P10; mutable-only — never `mux_*`/`url`/bytes).

### 16.3 Database + ingest (DB-first foundation — DONE)
- **`0016_find_or_create_title.sql`** (applied earlier) — SECURITY DEFINER dedup
  create-if-missing; new rows `tmdb_id=null, meta.source='curator'`.
- **`0017_sync_content_genres.sql`** — SECURITY DEFINER `sync_content_genres()` +
  an `AFTER INSERT`/`AFTER DELETE` per-statement trigger on `content_titles` that
  re-derives `content_genres` as the de-duplicated union of linked titles'
  `meta.genres`. (Real bug fixed during build: Postgres forbids transition tables
  on a multi-event trigger, so it's split into two single-event triggers.)
  **APPLIED by the founder in the SQL editor + verified** via
  `node data/_verify_upload_v2.js` (ALL PASS).
- `data/ingest-tmdb.js` now also writes `titles.meta.genres` (TMDB genre names).
  **Founder still needs to re-run `node data/ingest-tmdb.js --force`** on a
  TMDB-reachable network so existing titles carry `meta.genres` (auto-genres is a
  no-op until then — publish is never blocked on it).
- `data/_verify_upload_v2.js` extended to assert 0017's function/trigger + the
  derived genre union.

### 16.4 Edge Functions (DONE, code-reviewed — Deno not runnable here)
- `mux-upload-url` (`_shared/mux.ts`): direct upload now requests
  `video_quality:"basic"` + `playback_policy:["public"]`. Auth gate unchanged.
- `mux-webhook`: on `video.asset.ready`, **duration backstop** — if `>90s`,
  DELETE the Mux asset + mark the row `removed` (`meta.rejected_reason`,
  `deleted_at`); otherwise flip `live` and, when `meta.cover_time` is present,
  build `thumbnail_url = image.mux.com/<pid>/thumbnail.jpg?time=<cover_time>`.
  Idempotent (only touches `processing` rows).
- Deno tests authored for both (pure models mirroring the handlers). Honest note:
  Deno isn't installed here, so these are author+review only; the founder runs
  them on deploy.

### 16.5 Upload UI rewrite (`showshak-upload.html`) — DONE
The five-step prototype is now a real **7-step data-driven flow**:
**1 Clip · 2 Trim · 3 Titles · 4 Pitch · 5 Vibe · 6 Cover · 7 Review**
(`TOTAL_STEPS` drives the progress bar; every per-step switch keys off it).
- **File select** probes duration via a throwaway `<video>` `loadedmetadata` +
  `ssValidateMediaFile`; over-cap files are rejected BEFORE any Mux mint.
- **Trim** in/out sliders gated by `ssValidateTrim`; `ssTrimToBlob` lazy-loads
  `@ffmpeg/ffmpeg@0.12.15` (+util/core) from jsDelivr ESM only on a real cut and
  stream-copies `-c copy` to a Blob; full-source skips the engine (Req 7.6).
- **Titles** = real debounced `titles` search + multi-select + create-if-missing
  via `find_or_create_title`. Replaced the mock `SHOW_CATALOG` entirely. All
  DB-sourced strings are HTML-escaped (`upEsc`).
- **Pitch** = 280-char counter via `ssValidatePitch` (replaced the old word-count
  gate; `wordCount` deleted).
- **Vibes** → `meta.vibes` (canonical string[]).
- **Cover** = scrub the local clip to pick `coverTime` (offset INTO the trimmed
  clip; preview seeks `trimIn + coverTime`); stored as `meta.cover_time`.
- **Publish** (`publish()`) is the real **fail-closed pipeline**, strict order:
  resolve/create titles → (trim) → mint `mux-upload-url` → PUT bytes → INSERT
  `content` (`processing`, `.select('id')`) → INSERT all `content_titles` in one
  call (fires the 0017 trigger). Engine-load failure falls back to the full
  source (safe — already capped) AND drops `meta.trim` so meta never lies. The
  old mock sessionStorage block was reduced to a minimal TRUTHFUL instant-UI
  record (real content id/title/pitch/status) — the profile My Clips layer reads
  it before the DB hydrate.

### 16.6 Drafts UX (`showshak-upload.html`) — DONE
- **Save draft** (`draft.draftId` tracks the row): first save INSERTs
  (`status='draft'`, `.select('id')`), re-save UPDATEs the same row; links
  reconciled via delete+insert. Owner-private via 0012/0015 RLS. Honest UX: the
  **video bytes are NOT stored** in a draft (re-attach on resume).
- **Resume draft** (`?draft=<contentId>`): loads the owner's row + links,
  hydrates via `ssRowToDraft`, **re-fetches title rows** to restore names/posters
  (preserving sort order), restores vibe visuals, lands on step 1 with a
  re-attach prompt.
- **Discard** = owner-scoped soft delete (`UPDATE deleted_at`). **Publish-draft**
  = `publish()` is draft-aware: if `draft.draftId` is set it UPDATEs that row to
  `processing` (no orphan draft) and reconciles links; fresh publish unchanged.

### 16.7 Status + what remains
**Done & verified:** tasks 1–13 (DB, helpers, Edge fns, checkpoints), 14.1–14.7
(entire upload UI), 15 (checkpoint), 16.1–16.3 (drafts). `npm test` = **12 files
all green**; no diagnostics on `showshak-upload.html` / `showshak-shared.js`.
~**50/60 tasks complete.**

- ⬜ **NEXT — 17.1 Edit-after-post (`?edit=<contentId>`):** hydrate a published
  clip; allow editing pitch / linked titles / vibes / cover only; build the
  UPDATE via `ssBuildEditPatch` (never `mux_*`/`url`/bytes); re-write
  `content_titles` so the trigger re-derives genres; RLS scopes to owner.
- ⬜ **18.1 Multi-title Watch It sheet:** render one entry per linked title via
  `ssResolveWatchOptionsForTitles`. **Replaces the single-title sheet path —
  delete the old one.**
- ⬜ **19.1 In-browser anon RLS checks** (non-owner can't read drafts / can't
  insert-delete others' `content_titles` / can't UPDATE others' clips).
- ⬜ **20 Final checkpoint** (full suite).
- ⬜ **Cleanup pass** (see §16.8).

### 16.8 Cleanup-pass backlog (tracked, to do after task 20)
- **`meta.vibes` (write) vs `meta.mood` (read) divergence:** the Discover display
  path (`ssMapContentRowsToClips`) reads moods from `meta.mood` (JSON string),
  but upload writes `meta.vibes` (string[]). So uploaded vibes persist but don't
  show as Discover mood chips until the read path is reconciled to `meta.vibes`.
- **CSS section-header comments** in `showshak-upload.html` weren't renumbered
  after steps were inserted (cosmetic only; e.g. two "STEP 3" banners).
- **`prop-pitch.test.js` prints no output** during the suite (its `process.exit`
  truncates the buffered stdout before flush). Pass/fail detection still works
  via exit code; purely cosmetic — consider flushing before exit.
- **`-webkit-line-clamp`** on `.up-review-pitch` lacks the standard `line-clamp`
  property (pre-existing compatibility warning).
- General sweep for any old/superseded code left after the replacement tasks.

### 16.9 Working-rhythm reminders (unchanged)
- ONE task at a time; report + wait for "next".
- Migrations are applied MANUALLY by the founder in the SQL editor; 0014–0017 are
  applied. Founder still owes the `ingest-tmdb.js --force` re-run for genres.
- Deno tests can't run here (author+review; founder runs on deploy).
- The optional `*` property-test sub-tasks ARE being done (top-grade quality).

---

## 17. Curator Upload v2 — COMPLETE (all 60 tasks) + cleanup pass

Finished the remaining tasks in one pass (founder said "complete the other tasks").

### 17.1 Edit-after-post (`?edit=<contentId>`) — DONE
Editing a PUBLISHED clip's Mutable_Metadata only (Pitch / Titles / vibes / Cover).
The Clip + Trim steps are SKIPPED (video is the Immutable_Asset, Req 10.3) via a
data-driven `editMode()`/`firstStep()`/`stepOffset()`/`visibleTotal()` model, so the
progress bar shows the visible subset and the flow starts on Titles. The Cover step
shows a REAL Mux thumbnail preview (`ssCoverThumbUrl(muxPlaybackId, t)`) since the
playback id now exists. `saveEdit()` builds the UPDATE via `ssBuildEditPatch`
(allowlist — never `mux_*`/`url`/bytes) and **merges** the patch's `meta` OVER the
stashed row meta so `mux_upload_id`/`trim` survive; re-writes `content_titles` so the
0017 trigger re-derives genres. Action label flips to "Save changes". RLS (0015)
scopes every write to the owner.

### 18.1 Multi-title Watch It sheet — DONE (replaced the single-title path)
`ssOpenSheet` now lazy-fetches a clip's linked titles (`content_titles → titles`,
keyed by `show.id`, ordered by sort_no) and renders ONE section per title via
`ssResolveWatchOptionsForTitles`, each with its own region-aware providers +
curator-platform fallback (the clip's `curatorPlat` is passed per-title). Single
title / mock / Discover-Watchlist clips fall back to a single section from the clip
itself. Click routing uses HTML-escaped `data-*` attributes (XSS-safe). The old
single-title-only render was deleted. Clip BODY still hides titles (Req 6.1). Minimal
`.sheet-title-section`/`.sheet-title-label` CSS added.

### 19.1 In-browser anon RLS checks — DONE
New kept, re-runnable `showshak-rls-check.html` (anon key only; sign-in box fallback).
4 checks, each PASS = the cross-owner op is BLOCKED: (1) can't read another curator's
draft (0 rows), (2) can't UPDATE another's clip (0 rows — the "empty data = RLS denied"
nuance, verified by reading the row back), (3) can't INSERT `content_titles` on
another's clip (WITH CHECK error), (4) can't DELETE another's link (0 rows). Cleans up
any leak; SKIPs gracefully when no other-curator clip/link exists. The Node verifier
can't prove this (service role bypasses RLS), hence a browser page.

### 20 Final checkpoint — DONE (caught a real bug)
`npm test` = 12 files green. But `get_diagnostics` flagged **84 errors in
showshak-upload.html** that `npm test` could NOT see (the suite only loads
`showshak-shared.js`, never the page). Root cause: a doc comment contained
`mux_*/url/bytes` — the `*/` inside it PREMATURELY CLOSED the `/* */` block comment,
so the rest parsed as broken JS and **would have broken the entire upload page at
runtime**. Found it by extracting the inline `<script>` and running `node --check`
(pinpointed the line). Fixed (`mux_* / url / bytes`); page now parses clean. Lesson:
HTML-embedded JS isn't covered by the Node suite — syntax-check the page script (or
get_diagnostics) before declaring done.

### Cleanup pass — DONE
- **`meta.vibes` vs `meta.mood` divergence (functional fix):** `ssMapContentRowsToClips`
  read moods only from the legacy `meta.mood` (JSON string), so uploaded clips'
  `meta.vibes` never showed in Discover. Now reads `meta.vibes` (array, v2 canonical)
  first, falling back to legacy `meta.mood` — additive, backward-compatible, all tests
  green.
- **`-webkit-line-clamp`** on `.up-review-pitch` now also sets standard `line-clamp`.
- **CSS section-header banners** in `showshak-upload.html` renumbered to the 7-step flow
  (3 Titles · 4 Pitch · 5 Vibe · 7 Review; Cover reuses the trim styles).
- **`prop-pitch.test.js`** now sets `process.exitCode` instead of `process.exit()` so its
  stdout flushes (output was being truncated; exit code unchanged).
- Dead-code scan: no superseded code left — `SHOW_CATALOG`/`upPickShow`/`renderShowList`/
  `wordCount`/`draft.show` and the single-title sheet path are gone (only history comments
  remain).

### Status
**Curator Upload v2 is implementation-complete: 60/60 tasks. `npm test` = 12 files green;
no diagnostics on the touched files.**

Founder activation still owed (an agent can't do these):
- **Re-run `node data/ingest-tmdb.js --force`** on a TMDB-reachable network so titles
  carry `meta.genres` (auto-genres is a no-op until then; publish is never blocked on it).
- Confirm the host serves **COOP/COEP** headers if needed for ffmpeg.wasm
  (SharedArrayBuffer) — else trim degrades to full-source-only; smoke-test trimming live.
- Run the **Deno** Edge-Function tests on deploy (not runnable here).
- Open `showshak-rls-check.html` signed in as a curator and confirm all RLS checks PASS.
- Smoke-test the full live flow: upload → trim → titles → pitch → vibe → cover → publish
  → webhook flips to live → plays; plus drafts (save/resume/discard/publish) and edit.
