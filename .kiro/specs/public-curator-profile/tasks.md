# Implementation Plan: Public Curator Profile

## Overview

Convert the design into incremental coding steps. The work is confined to the client: two PURE
helpers in `showshak-shared.js` (exported under the existing `module.exports` block), their
fast-check property tests under `tests/`, and a new async hydrator plus surgical render-pipeline
edits in `showshak-profile.html`. No new SQL, migrations, table grants, or RLS policies are
authored (Req 14).

Sequencing rule: the two pure helpers and their property tests land first (they are the testable
seams), then the inline `showshak-profile.html` wiring consumes them. Each task references the
specific requirement clauses it satisfies. Property test sub-tasks map one-to-one to the five
files named in the design's Testing Strategy and are marked optional with `*`.

Language: JavaScript (the shipped app is pure HTML/CSS/vanilla JS, no build step; pure logic in
`showshak-shared.js` is exported via `module.exports` for Node tests).

## Tasks

- [x] 1. Add the two pure curator helpers to `showshak-shared.js`
  - [x] 1.1 Implement `ssNormalizeCuratorUsername(raw)`
    - Add the function in the pure-helpers region of `showshak-shared.js`.
    - Semantics (exact, per design table): URL-decode (treat a malformed percent-escape as
      identity — never throw), trim surrounding whitespace, strip exactly ONE leading `@`, trim
      again; return the cleaned non-empty string, or `null` when the result is empty / whitespace
      only / a lone `@`. Only the first leading `@` is stripped (`"@@alice"` → `"@alice"`).
    - Export it under the consolidated `module.exports` block.
    - _Requirements: 1.1, 1.3, 1.6, 8.1_

  - [x] 1.2 Implement `ssResolveCuratorViewModel(usersRow, contentRows, followerCount)`
    - Add the function in the same pure-helpers region; PURE — no Supabase, no DOM, no network.
    - Role gate: `usersRow` null/undefined OR `usersRow.role !== 'curator'` →
      `{ found:false, profile:null, clips:[], stats:{ followers:0, clips:0 } }`.
    - Otherwise `found:true` with the exact fallback chain from the design: `name` →
      `usersRow.name` else `username`; `handle` → `'@' + username`; `photo` → `avatar_url` else
      `null`; `letter` → uppercased first char of `name` (else `username`); `bio` → row `bio`
      else `''`; `genres` → row `genres` when a non-empty array else `[]`; `verified` →
      `!!usersRow.verified`.
    - `clips` = `ssMapContentRowsToClips(contentRows)` (reuse the existing pure mapper; preserve
      most-recent-first order). `stats.clips` = `clips.length`. `stats.followers` =
      `followerCount` coerced to a non-negative integer, else `0` (handle negative, fractional,
      `NaN`, non-numeric, very large).
    - Export it under the consolidated `module.exports` block.
    - _Requirements: 1.2, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 3.2, 4.1, 4.2, 4.3, 7.1, 8.3, 8.4, 10.1, 10.3_

  - [x]* 1.3 Write property test for username normalization
    - File: `tests/prop-curator-username-normalize.test.js`.
    - **Property 1: Username normalization**
    - **Validates: Requirements 1.1, 1.3, 1.6, 8.1**
    - `require('./_pbt.js')`, call `installDomStub()` before requiring `showshak-shared.js`.
      Generators: arbitrary strings, strings with leading whitespace + `0..n` leading `@`, and
      `%40`-encoded variants. Assert decode/trim/single-`@` semantics, `null` for
      empty/whitespace/`@`-only, no leading `@` in output, idempotence, and that
      whitespace/`%40`-only differences normalize to the same value. Tag file with
      `// Feature: public-curator-profile, Property 1: ...`; `>= 100` iterations.

  - [x]* 1.4 Write property test for resolved identity fallbacks
    - File: `tests/prop-curator-identity.test.js`.
    - **Property 2: Resolved identity reflects the real users row with safe fallbacks**
    - **Validates: Requirements 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 7.1, 12.4**
    - Generators: arbitrary `users` rows (`role='curator'`) varying presence/emptiness of
      name/username/avatar_url/bio/genres/verified. Assert the fallback chain and the
      no-mock-placeholder guarantee. `>= 100` iterations; standard tag + validates comment.

  - [x]* 1.5 Write property test for role gate and not-found shape
    - File: `tests/prop-curator-notfound.test.js`.
    - **Property 3: Role gate and not-found shape**
    - **Validates: Requirements 1.4, 1.5, 8.3, 8.4, 10.1**
    - Generators: `null`/`undefined` rows and rows with arbitrary non-`curator` role strings.
      Assert the not-found shape (`found:false, profile:null, clips:[], stats:{0,0}`) and that
      `role='curator'` yields `found:true`. `>= 100` iterations; standard tag + validates comment.

  - [x]* 1.6 Write property test for clips (MOCK-free, order-preserving)
    - File: `tests/prop-curator-clips.test.js`.
    - **Property 4: Clips come only from real rows, MOCK-free and order-preserving**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 7.3, 10.1, 11.3, 12.4**
    - Generators: arbitrary `content` row arrays mixing live/non-live/deleted rows in random
      order, plus occasional MOCK-shaped ids. Assert `clips === ssMapContentRowsToClips(rows)`,
      MOCK-free, order preserved, and the `min(5, clips.length)` wall slice. `>= 100` iterations.

  - [x]* 1.7 Write property test for stats clamping
    - File: `tests/prop-curator-stats.test.js`.
    - **Property 5: Stats are non-negative integers and clip count matches the clip array**
    - **Validates: Requirements 4.1, 4.2, 4.3, 8.4, 10.3**
    - Generators: arbitrary clip arrays and arbitrary `followerCount` (negative, float, `NaN`,
      strings, large). Assert non-negative integer `followers` (default `0`) and
      `clips === clips.length`. `>= 100` iterations; standard tag + validates comment.

- [x] 2. Checkpoint - pure helpers and their property tests pass
  - Run `npm test` (or `node tests/run-all.js`) and confirm the five new property files pass.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Add the async Curator_Hydrator and view-model applier in `showshak-profile.html`
  - [x] 3.1 Declare the new module-level state
    - Add `_viewedCuratorClips` (`Clip[]`), `_viewedCuratorStacks` (`Stack[]`),
      `_viewedCuratorFound` (`boolean`), and `_viewedCuratorId` (resolved real id), plus the
      resolved real `username`, in the page's module scope.
    - _Requirements: 13.6_

  - [x] 3.2 Implement `applyCuratorViewModel(vm, usersRow)`
    - Write the resolved view-model into `PROFILE` (name, handle, photo, letter, bio, genres,
      verified, follower + clip counts), set `_viewedCuratorClips` from `vm.clips`, set
      `_viewedCuratorFound = vm.found`, and store the resolved real `id`/`username` for the
      Follow control. Do NOT read `ss_view_curator_v1` for any field. Remove the legacy
      `?curator=` block's `PROFILE.photo = null` so `avatar_url` renders.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 7.1, 7.2, 7.4, 13.6_

  - [x] 3.3 Implement `async hydrateCuratorProfile()`
    - Force `face = 'public'`. Normalize via `ssNormalizeCuratorUsername(_params.get('curator'))`;
      if `null` or `!window.ssDB`, call `applyCuratorViewModel(ssResolveCuratorViewModel(null))`
      and return (not-found, no query).
    - Step 1 — users row: `from('users').select('id, username, name, bio, avatar_url, genres,
      verified, role').eq('username', username).is('deleted_at', null).maybeSingle()` wrapped in
      try/catch → `usersRow=null` on error. Resolve `vm0 = ssResolveCuratorViewModel(usersRow,
      [], 0)`; if `!vm0.found`, apply and return.
    - Step 2 — clips: `from('content').select(CONTENT_SELECT).eq('creator_id', usersRow.id)
      .eq('status','live').is('deleted_at', null).order('created_at',{ascending:false})
      .range(0,199)`; try/catch → `[]`.
    - Step 3 — follower count: `from('follows').select('*',{count:'exact',head:true})
      .eq('creator_id', usersRow.id).is('deleted_at', null)`; try/catch → `0`.
    - Step 4 — public stacks: `_viewedCuratorStacks = await fetchCuratorPublicStacks(usersRow.id)`;
      try/catch → `[]` (implemented in Task 5).
    - Finish: `applyCuratorViewModel(ssResolveCuratorViewModel(usersRow, contentRows, followers),
      usersRow)`. Never throw at any step.
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 3.1, 4.2, 8.1, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 3.4 Wire `hydrateCuratorProfile()` into the boot sequence
    - Change the boot IIFE so that when `_params.get('curator')` is present it `await
      hydrateCuratorProfile()` instead of `hydrateOwnProfile()`, and does NOT call
      `fetchOwnFollowers()` / `fetchOwnAnalytics()` / `hydrateMyClipsFromDB()` on the curator
      branch (they are also gated on `isSignedInOwn()`, which is false when `?curator=` is
      present — so zero owner-scoped analytics requests are issued). Keep `renderWall();
      renderAll();` after hydration.
    - _Requirements: 6.4, 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 4. Surgical render-pipeline edits to read the viewed-curator caches
  - [x] 4.1 `renderPrimary()` reads `_viewedCuratorClips` (no MOCK merge) when `?curator=`
    - When `?curator=` is present, set `list = _viewedCuratorClips` (never merge `MOCK_CLIPS`),
      and set `window._PROFILE_PRIMARY = list` so the viewer carries only Real_Clips.
    - _Requirements: 3.3, 3.5, 7.3, 11.2, 11.3_

  - [x] 4.2 `renderWall()` builds from `_viewedCuratorClips` when `?curator=`
    - When `?curator=` is present, build the Hero_Wall from the first `min(5, n)` of
      `_viewedCuratorClips`; render a single default brand backdrop when the cache is empty (zero
      clips / clip-query failure). Never use `MOCK_CLIPS` gradients.
    - _Requirements: 3.4, 9.4, 10.2_

  - [x] 4.3 `getMyClips()` / `myClipsCount()` read the viewed-curator cache when `?curator=`
    - When `?curator=` is present, return `_viewedCuratorClips` / its length so the Clips count
      and clip-dependent rendering use the real cache.
    - _Requirements: 4.3, 10.3_

  - [x] 4.4 Add the public not-found render branch
    - Keyed off `_viewedCuratorFound === false`: show the unavailable message including the
      requested username with any leading `@` removed, render an empty Clip_Grid (zero cards, no
      `MOCK_CLIPS`), Followers 0 / Clips 0, keep cockpit + "Preview as" hidden, never throw.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 9.1, 9.2_

  - [ ]* 4.5 Write unit/example tests for the render edits
    - Public stats bar renders exactly Followers + Clips with labels, no fires/Watch-It/reach
      (Req 4.4). Per-clip cards show no fires/view/Watch-It/reach numbers (Req 6.5). Not-found
      state shows the unavailable message, zero clip cards, Followers 0 / Clips 0, owner surfaces
      hidden, no throw (Req 8.2, 8.5, 8.6). Stash precedence: a populated `ss_view_curator_v1`
      does not override resolved values (Req 7.2, 7.4). Zero-clip empty state: empty-clips
      message, single default backdrop, Clips 0 (Req 10.1, 10.2, 10.3).
    - _Requirements: 4.4, 6.5, 7.2, 7.4, 8.2, 8.5, 8.6, 10.1, 10.2, 10.3_

- [x] 5. Public shared-stacks fetch and shelf wiring
  - [x] 5.1 Implement `fetchCuratorPublicStacks(curatorId)`
    - `from('stacks').select('id, name, user_id, visibility, sort_no, created_at')
      .eq('user_id', curatorId).eq('visibility','public').is('deleted_at', null)
      .order('sort_no',{ascending:true}).order('created_at',{ascending:false}).range(0,49)`;
      return the rows, or `[]` on error (fail-soft).
    - _Requirements: 5.1, 9.6, 14.1_

  - [x] 5.2 Wire `renderShelf()` to render `_viewedCuratorStacks` when `?curator=`
    - When `?curator=` is present, render `_viewedCuratorStacks` (already public-only) in the
      Shared Stacks shelf in the queried order, displaying each stack `name`; render the existing
      empty state when there are zero stacks. Never render private/friends stacks.
    - _Requirements: 5.2, 5.3, 5.4_

  - [ ]* 5.3 Write tests for the stacks shelf
    - Renders N cards in order with names; empty → existing empty state; never renders
      private/friends stacks.
    - _Requirements: 5.2, 5.3, 5.4_

- [x] 6. Follow control wiring with the resolved real id/username
  - [x] 6.1 Pass the resolved real `id`/`username` to the public Follow control
    - Ensure `paintPublicFollow` / `togglePublicFollow` reflect existing follow state via
      `ssIsFollowing` (follower_id = visitor, creator_id = `_viewedCuratorId`, deleted_at null),
      toggle create/remove via the existing `ssToggleFollow`, repaint within 1s, revert + toast
      on error, and target the resolved real `id`/`username` rather than mock fields.
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [ ]* 6.2 Write tests for the Follow control
    - Reflects existing follow state, toggles create/remove via `ssToggleFollow`, repaints
      immediately, reverts on backend error without throwing, and carries the resolved real
      id/username.
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [ ]* 6.3 Verify clip-tap wiring opens the shared viewer
    - Tapping a Real_Clip sets `window._PROFILE_PRIMARY = _viewedCuratorClips` and calls
      `ssOpenClip` at the tapped index; a missing/throwing `ssOpenClip` stays on the profile and
      does not throw.
    - _Requirements: 11.1, 11.2, 11.4_

- [x] 7. Checkpoint - integration, hide-the-scoreboard, and no-SQL checks
  - [ ]* 7.1 Write integration tests for the three fixed queries
    - `content`: `creator_id` + `status='live'` + `deleted_at IS NULL`, ordered `created_at
      desc`, limited to 200 (Req 3.1). `follows` count: `creator_id` + `deleted_at IS NULL`
      (Req 4.2). `stacks`: `user_id` + `visibility='public'` + `deleted_at IS NULL`, ordered
      `sort_no asc, created_at desc`, limited to 50 (Req 5.1). All three queries identical with
      and without an authenticated session (Req 12.1, 12.2, 12.3, 12.5). 1-3 examples each.
    - _Requirements: 3.1, 4.2, 5.1, 12.1, 12.2, 12.3, 12.5_

  - [ ]* 7.2 Write hide-the-scoreboard tests including tab switches
    - Public face hides the Analytics_Cockpit, all analytics charts, and the "Preview as"
      switcher (no such element/value in the DOM), and stays hidden across tab switches; assert
      the boot curator branch invokes neither `fetchOwnAnalytics` nor `fetchOwnFollowers` (zero
      owner-scoped analytics requests).
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6_

  - [ ]* 7.3 Smoke/review: confirm the no-SQL constraint
    - Grep confirms the hydrator issues only `.select()` against `users`/`content`/`follows`/
      `stacks` and no `INSERT`/`UPDATE`/`DELETE` on `users`/`content`/`stacks` (the sole write is
      the existing owner-scoped follow). Review confirms no migration/grant/RLS file is added or
      modified; if a required public `SELECT` is found missing, stop and report the table + grant
      to the founder rather than authoring SQL.
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [x] 7.4 Run the full suite
    - Run `npm test` (or `node tests/run-all.js`) and confirm all property, unit, and integration
      tests pass.
    - Ensure all tests pass, ask the user if questions arise.

- [~] 8. [FOUNDER-RUN — MANUAL BROWSER VERIFICATION] Confirm the live public profile
  - **This task is performed manually by the founder, not by the coding agent**, because the
    migrations and live data are founder-applied and this requires a real signed-in session and
    real backend data.
  - Steps: sign in as a curator, use search/Discover to open another curator's profile
    (`?curator=<username>`), and confirm the real name, real photo (`avatar_url`), real live
    clips, and real Followers + Clips counts render — with NO analytics cockpit, charts, or
    "Preview as" switcher visible. Verify the not-found state for a bogus `?curator=` value, and
    that tapping a clip opens the shared viewer.
  - _Requirements: 2.1, 2.3, 3.3, 4.1, 6.1, 8.1, 11.1, 12.1, 12.2_

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP; core
  implementation tasks are never optional.
- Pure helpers (Task 1) and their property tests (1.3-1.7) land before the inline wiring (Tasks
  3-6) so the testable seams are validated first.
- Property tests use `fast-check` at `>= 100` iterations, follow the `tests/prop-*.test.js`
  convention, `require('./_pbt.js')`, call `installDomStub()` before requiring
  `showshak-shared.js`, and are tagged `// Feature: public-curator-profile, Property <n>: ...`
  with `// **Validates: Requirements X.Y**`.
- No new SQL: the feature is client-only and relies on existing grants/RLS (Req 14).
- Task 8 is a manual founder-run check and is the only non-coding task in this plan.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "1.5", "1.6", "1.7"] },
    { "id": 2, "tasks": ["3.1", "5.1"] },
    { "id": 3, "tasks": ["3.2"] },
    { "id": 4, "tasks": ["3.3"] },
    { "id": 5, "tasks": ["3.4"] },
    { "id": 6, "tasks": ["4.1", "4.2", "4.3", "4.4"] },
    { "id": 7, "tasks": ["5.2", "6.1"] },
    { "id": 8, "tasks": ["4.5", "5.3", "6.2", "6.3", "7.1", "7.2", "7.3"] }
  ]
}
```
