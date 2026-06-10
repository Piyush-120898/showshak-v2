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
⬜ Step 3   Clips + real video (Mux) — the emotional core
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
