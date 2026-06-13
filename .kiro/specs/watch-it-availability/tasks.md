# Implementation Plan: Watch It Availability

## Overview

Cache-first, region-aware "Watch It" availability with a strict producer/consumer
split. The producer is a NEW local Node script (`data/ingest-tmdb.js`) — the only
component that touches TMDB — which links titles, fetches flatrate providers, maps
them onto the `platforms` catalog, and writes `titles.providers` + `titles.cached_at`
via the Supabase service role key. The consumer is the existing vanilla-JS frontend
(`showshak-shared.js` + `showshak-components.css`), edited additively to read the
cache, resolve the viewer's region/subscriptions, and render the sheet with a graceful
fallback chain. The browser never calls TMDB.

Tasks are sequenced to minimize risk and keep the live app working between steps:
secrets/scaffolding first (no behavior change), then the offline ingest, then the
user-facing read path edits (ordered so `showshak-shared.js` stays valid between
tasks). There is NO automated test framework — every task's verification references the
design's manual browser regression checklist and/or the ingest dry-run/verification
steps. The ingest dry-run requires the founder, a TMDB-reachable network, and real
keys, so it is marked founder-run.

## Tasks

- [x] 1. Secrets and ingest scaffolding (no behavior change to the live app)
  - [x] 1.1 Add env example and gitignore protection
    - Create `data/.env.example` with placeholder-only values for `TMDB_API_KEY`,
      `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` (no real keys)
    - Add `data/.env` and `.env` to `.gitignore` so the real env file can never be
      committed
    - Verify: `git status` shows `data/.env.example` and `.gitignore` only; a created
      `data/.env` is ignored. No real keys appear in any committed file (ingest
      dry-run/verification step 7). _Requirements: 1.1, 3.2_
  - [x] 1.2 Scaffold `data/ingest-tmdb.js` with env loading, fail-fast, and service client
    - Create `data/ingest-tmdb.js` (standalone Node script, never `<script>`-included)
    - Add env loading supporting both `node --env-file=data/.env` and a self-contained
      `_loadEnv()` fallback (split on first `=`, ignore blanks/`#`, set `process.env`
      if unset)
    - Add `assertEnv()` that fails fast with an explicit message if any of the three
      variables is missing (no partial run)
    - Create the service-role Supabase client via `createClient(SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })`; document in the
      header that this key is local/server-only and must never appear in any
      `showshak-*.js`/HTML/commit
    - Verify: running the script with a missing/empty `data/.env` errors cleanly with
      the fail-fast message and no stack-trace half-run; nothing committed contains a
      real key (ingest dry-run/verification step 7). _Requirements: 1.1, 3.1, 3.2_

- [x] 2. Ingest core — link, fetch, map, write
  - [x] 2.1 Implement title selection and TMDB search + ranking
    - Implement `selectTitles(force)`: non-forced selects `tmdb_id is null AND
      deleted_at is null`; `--force` selects all `deleted_at is null`
    - Implement `searchTmdb(name, year)` calling `/3/search/movie` and `/3/search/tv`,
      combining results, with deterministic ranking (normalized exact-name equality >
      smallest absolute year diff > `popularity` desc tie-break), returning
      `{ id, media_type }` or `null` below the similarity threshold
    - Add `REGIONS = ['IN']` and `TMDB_DELAY_MS = 300` constants
    - Verify via ingest dry-run/verification steps 2, 5, 6 (founder-run): correct
      titles selected, sensible matches, unmatched left unchanged.
      _Requirements: 1.2, 1.3, 1.5, 1.6_
  - [x] 2.2 Implement provider fetch, catalog load, and `toCacheEntry`
    - Implement `fetchWatchProviders(mediaType, tmdbId)` calling
      `/3/{movie|tv}/{tmdbId}/watch/providers`; read `flatrate[]` only; a region with
      no entry yields `[]`
    - Load the `platforms` catalog once (`select id,name,color,abbr` where
      `deleted_at is null`), indexed by lowercased name
    - Add the `PROVIDER_TO_CATALOG` normalization map and `toCacheEntry(p)` producing
      the required shape `{ provider_name, provider_id, logo_path, type:'flatrate' }`
      plus nullable catalog enrichment `{ platform_id, catalog_name, color, abbr }`
      (`null` when no catalog match); store `logo_path` verbatim, never fetched
    - Verify via ingest dry-run/verification step 3 (founder-run): `providers.IN`
      arrays contain only flatrate entries of the correct shape; unmatched providers
      carry null catalog fields. _Requirements: 2.1, 2.2, 2.3, 11.1, 11.2_
  - [x] 2.3 Implement the main loop with write, per-title resilience, tally, and summary
    - Implement `main()`: parse `--force`, call `selectTitles`, loop per title with the
      link → fetch → build region-keyed `providers` → update flow
    - Skip linking when already linked and not forced (`tally.skipped++`); on no match
      leave `tmdb_id` unchanged (`tally.unmatched++`); on match set
      `tmdb_id`/`media_type` (`tally.matched++`)
    - Write `titles.update({ tmdb_id, providers, cached_at: now, meta:{...,media_type} })`
      keyed by `id` (`tally.updated++`)
    - Wrap each title in try/catch (`tally.failed++`, log, continue — never abort the
      batch); apply `sleep(TMDB_DELAY_MS)` between titles; call `printSummary(tally)`
      at the end (matched/unmatched/failed/updated counts)
    - Verify via ingest dry-run/verification steps 3 and 4 (founder-run): rows updated
      with fresh `cached_at`; summary counts print correctly; a single failure does not
      stop the run. _Requirements: 1.3, 1.4, 2.4, 3.3, 3.4_

- [ ] 3. Checkpoint — Ingest dry-run (FOUNDER-RUN: requires the founder, the TMDB API key, a populated `data/.env`, and a TMDB-reachable network)
  - This step cannot be performed by a coding agent or on an India-egress path.
  - Founder populates `data/.env` from `.env.example` with real keys, then runs
    `node data/ingest-tmdb.js` against the 8 seed titles (Sacred Games, The Bear,
    Mirzapur, Stranger Things, Panchayat, Squid Game, Scam 1992, The Last of Us).
  - Confirm in Supabase: those rows have `tmdb_id` set and `titles.providers` populated
    with an `IN` array of `{provider_name,provider_id,logo_path,type:'flatrate',...}`
    entries plus a fresh `cached_at`; the summary log prints matched/unmatched/failed/
    updated counts.
  - Confirm re-run without `--force` skips already-linked titles; re-run with `--force`
    re-links and re-caches.
  - Confirm `git status` never shows `data/.env`; no `showshak-*.js`/HTML contains a
    service-role or TMDB key.
  - Ensure the dry-run checklist passes, ask the user if questions arise.

- [x] 4. Frontend read path (user-facing) — additive edits to `showshak-shared.js`, ordered so the file stays valid between tasks; must not regress existing behavior
  - [x] 4.1 Extend `ssLoadClips()` select and row mapping
    - Expand the `titles` join to pull `providers,cached_at`; add
      `platform:platform_id(id,name,color,abbr)` (include `id` for the curator
      fallback)
    - In the row mapper, carry `providers` (default `{}`), `cachedAt` (default `null`),
      and `curatorPlat` (`{ platform_id, name, color, abbr }` or `null`) onto the clip;
      leave all other fields unchanged
    - Verify via manual browser checklist step 7 (regression sweep): clips still load
      and render on feed/discover/watchlist/profile + viewer with no console error.
      _Requirements: 4.1, 4.3_
  - [x] 4.2 Add `ssGetRegion()` and `ssGetSubscribedPlatformIds()` with auth invalidation
    - Add module caches `_ssRegion` and `_ssSubIds`
    - Implement `ssGetRegion()`: signed-in → `users.region`; guest/unknown/error →
      default `'IN'`
    - Implement `ssGetSubscribedPlatformIds()`: signed-in → `Set` of `platform_id` from
      `user_subscriptions` (`deleted_at is null`); guest or fetch failure → empty `Set`
      (swallow errors)
    - Invalidate both caches in `onAuthStateChange` (`_ssRegion = null;
      _ssSubIds = null;`)
    - Verify via manual browser checklist steps 4, 5 (founder-run sign-in vs guest):
      region/subs resolve correctly and re-resolve after sign-in/out, no error.
      _Requirements: 8.2, 8.3, 9.1, 9.2_
  - [x] 4.3 Add the `ssResolveWatchOptions(clip, region, subscribedPlatformIds)` resolver
    - Implement exactly per design: region providers → one option per cached entry with
      `included` (non-null `platform_id` present in subs) and In-plan-first sort,
      branded color/abbr when catalog-matched else neutral default
    - Fallback chain: empty region providers + `curatorPlat` → single curator option;
      else `{ options: [], fallback: true, message: 'Not available to stream in your
      region' }`
    - Guarantee totality: never throws on missing `providers`, unknown region, or empty
      subs; always returns a non-empty option list OR a fallback message
    - Verify via manual browser checklist steps 1, 2, 3, 4, 5, 6: provider list,
      curator fallback, neutral message, in-plan marking/ordering, guest no-badge,
      neutral styling for uncatalogued providers.
      _Requirements: 4.2, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 8.1, 8.2, 8.3, 11.1, 11.2_
  - [x] 4.4 Edit `ssClipsForFeed()` and `ssClipsForDiscover()` to carry the cache forward
    - Drop the single hardcoded mock platform; carry `providers` and `curatorPlat`
      through to the clip object for the resolver
    - Keep `platLabel`/`platColor` (derived from `curatorPlat`) for any existing card
      styling; keep the clip surface hiding the title (title only in sheet)
    - Verify via manual browser checklist steps 1, 7: feed and discover clips resolve
      identically through the sheet; clip surface still hides the title; no card-style
      regression. _Requirements: 4.2, 10.1, 10.3_
  - [x] 4.5 Make `ssOpenSheet()` async-aware and add the neutral-message branch
    - Make `ssOpenSheet(show)` async: `await ssGetRegion()`, `await
      ssGetSubscribedPlatformIds()`, run `ssResolveWatchOptions`, then render either the
      option list (preserving `ssHandleWatchNow` and title-only-in-sheet) or the
      `<div class="sheet-empty">…</div>` neutral branch
    - Add a `.sheet-empty` style to `showshak-components.css` if needed
    - Preserve `ssHandleWatchNow()` behavior exactly (R7.2)
    - Verify via manual browser checklist steps 1, 2, 3, 4, 5, 6, 8: sheet renders
      options or the neutral message correctly, "✓ In your plan" first, no empty list,
      no error, and DevTools shows zero `themoviedb.org`/`image.tmdb.org` requests.
      _Requirements: 5.1, 5.3, 6.2, 6.3, 7.2, 10.3_

- [ ] 5. Checkpoint — Full manual browser regression (feed + viewer + discover)
  - Run the design's full manual browser regression checklist (steps 1–8): title with
    IN providers (branded), title → curator fallback, title → neutral message,
    signed-in "in your plan" first, guest no-badge, unmatched provider neutral styling,
    no-TMDB-network proof (zero requests to `themoviedb.org`/`image.tmdb.org`), and no
    regression of feed/discover/watchlist/profile/viewer + save/fire/follow.
  - Ensure all checks pass, ask the user if questions arise. _Requirements: 4.3, 10.1,
    10.2, 10.3, 11.1, 11.2_

## Notes

- There is NO automated test framework. Verification for every task references the
  design's manual browser regression checklist and/or the ingest dry-run/verification
  steps. No standalone test tasks are included.
- The ingest dry-run (Task 3) is FOUNDER-RUN: it depends on the founder having the TMDB
  API key, a populated `data/.env`, and a TMDB-reachable network. It cannot be executed
  by a coding agent or on an India-egress path.
- Tasks editing `showshak-shared.js` (4.1 → 4.5) are ordered so the file stays valid
  between them; each touches a distinct function/section.
- Tasks are tied to real files and functions: `data/ingest-tmdb.js`
  (`selectTitles`, `searchTmdb`, `fetchWatchProviders`, `toCacheEntry`,
  `PROVIDER_TO_CATALOG`, `main`), `showshak-shared.js` (`ssLoadClips`, `ssGetRegion`,
  `ssGetSubscribedPlatformIds`, `ssResolveWatchOptions`, `ssClipsForFeed`,
  `ssClipsForDiscover`, `ssOpenSheet`, `ssHandleWatchNow`), and
  `showshak-components.css` (`.sheet-empty`).
- Each task references specific requirements for traceability; checkpoints provide
  incremental validation gates.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "4.1"] },
    { "id": 1, "tasks": ["2.1", "4.2"] },
    { "id": 2, "tasks": ["2.2", "4.3"] },
    { "id": 3, "tasks": ["2.3", "4.4"] },
    { "id": 4, "tasks": ["4.5"] }
  ]
}
```
