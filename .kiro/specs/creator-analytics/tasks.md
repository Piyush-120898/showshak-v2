# Implementation Plan: Creator Analytics

## Overview

This plan makes the curator "cockpit" numbers real for the first time by closing the two gaps
identified in the design — nothing writes engagement events, and nothing reads owner-scoped
aggregates — entirely **additively** (no new tables, no data changes).

The work is sequenced **DB-first and low-risk**, so each layer is in place before the layer
that depends on it:

1. **Migration `0019`** (founder-applied): insert-only grants, anti-spoofing `with check` RLS,
   and the three owner-scoped `SECURITY DEFINER` reader functions.
2. **Pure helpers** in `showshak-shared.js` — the Event_Recorder decision/payload helpers and
   the counting-model helpers that are the executable specification of the `0019` SQL reader —
   each with its standalone `fast-check` property test.
3. **Fire-and-forget recorder wrappers** wired into the existing action hooks (`ssOpenClip`,
   `ssHandleWatchNow` + the feed's Watch It handler, `ssShare`).
4. **Cockpit read-path wiring** in `showshak-profile.html` (`renderCockpit` / `renderAnalytics`
   / per-clip grid + a new `fetchOwnAnalytics()`).
5. **Verification** — the integration/smoke checks described in the design's Testing Strategy.

Conventions honored from the project:
- **No build step.** UI is vanilla JS; pure logic lives in `showshak-shared.js` and is exported
  under the existing `module.exports` block so Node tests can `require` it.
- **Migrations are applied manually by the founder** in the Supabase SQL editor. `0019` is the
  next sequential number after `0018` and is **additive only**. Every task that depends on
  `0019` being live calls out the founder-applied step explicitly (mirroring how the
  curator-upload-v2 and mux-video-clips task lists flag manual/founder-only steps).
- **Property tests** are plain-Node + `fast-check`, ≥100 iterations (`ITER` in `tests/_pbt.js`
  is 200), **one property per file** under `tests/prop-*.test.js`, following the existing
  `tests/_pbt.js` DOM-stub convention (install the stub before requiring `showshak-shared.js`),
  tagged `// Feature: creator-analytics, Property <n>`. These are optional sub-tasks (`*`).
- The design defines exactly **10 Correctness Properties (P1–P10)** → ten standalone
  property-test files, each annotated with its **Validates: Requirements** references.
- DB-side behavior (insert grants, no-raw-reads, RLS acceptance, owner-scoping, `SECURITY
  DEFINER` posture, index usage) is verified by the **integration/smoke tests** in the design's
  Testing Strategy, not by property tests.
- The view is recorded through the **existing view hook** (`ssOpenClip`) per the requirements'
  existing view model and per-session de-dup. The design specifies **no watch-time threshold**,
  so none is introduced here.

## Tasks

- [x] 1. Database layer — migration `0019` (founder-applied)
  - [x] 1.1 Create migration `0019_creator_analytics.sql`
    - Add `supabase/migrations/0019_creator_analytics.sql` following `supabase/SCHEMA_CHANGE_PROCESS.md`, exactly as specified in the design's "Migration `0019` — exact additive SQL".
    - Grant `insert` (and **not** `select`) on `view_events`, `watch_events`, `share_events` to `anon` + `authenticated`; `grant usage on schema public` (idempotent).
    - Enable RLS on the three event tables and add anti-spoofing `for insert ... with check (user_id is not distinct from auth.uid())` policies (drop-if-exists for idempotency); add no SELECT/UPDATE/DELETE policy so raw rows stay unreadable.
    - Define `creator_analytics_totals()`, `creator_analytics_weekly()`, and `creator_analytics_per_clip()` as `SECURITY DEFINER`, `stable`, `set search_path = public`, scoped to `content.creator_id = auth.uid()`, applying the Self_Activity collapse (views/shares), watch no-collapse, and one-fire-per-user rules; derive the owning curator via the `content_id → content.creator_id` join with no denormalized `creator_id`; bound the weekly query to the last 7 calendar days; `grant execute` to `authenticated` only; `notify pgrst, 'reload schema'`.
    - **Founder-applied step:** this migration must be pasted into the Supabase SQL editor and run by the founder before any task that depends on the grants, RLS, or RPCs can be verified. It is additive and idempotent (re-runnable).
    - _Requirements: 2.9, 4.1, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.3, 7.1, 7.2, 7.4, 7.5, 7.6, 7.7, 9.1, 9.4, 9.5, 10.1, 10.2, 10.3, 11.1, 12.1, 13.3, 13.4_

- [x] 2. Event_Recorder pure helpers (`showshak-shared.js`)
  - [x] 2.1 Implement the Event_Recorder pure helpers
    - In `showshak-shared.js`, implement `ssIsRecordableClipId(clipId)` (reuse the existing `_ssIsUuid` test so only persisted `content` uuids record and mock/prototype integer ids, null, undefined, and malformed strings are skipped), `ssResolveEventUserId(currentUser)` (signed-in object → its id; guest/null/no-id → `null`; never throws), and `ssShouldRecordView(viewedSet, clipId)` (true the first time a clip id is seen, false thereafter; pure, does not mutate the set).
    - Implement the payload builders `ssBuildViewEvent(clipId, userId)`, `ssBuildShareEvent(clipId, userId)` (`{ content_id, user_id }`), and `ssBuildWatchEvent(clipId, userId, opts)` which includes `title_id` / `platform_id` / `region` only when provided and omits each absent value (never invents values).
    - Export all six helpers under the existing `module.exports` block.
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.6, 3.1, 3.2, 3.3, 3.5, 12.4_

  - [x]* 2.2 Write property test for recordable-clip skip
    - **Property 1: Mock/prototype clips are never recorded**
    - **Validates: Requirements 1.6, 2.6, 3.5, 12.4**
    - New file `tests/prop-recordable-clip.test.js`; generators include 36-char uuids, prototype integer ids, null, undefined, and malformed strings.

  - [x]* 2.3 Write property test for insert user_id resolution
    - **Property 2: Insert user_id resolves to the viewer or null**
    - **Validates: Requirements 1.2, 1.3, 2.3, 2.4, 3.2, 3.3, 5.2, 5.3**
    - New file `tests/prop-event-userid.test.js`; generators include signed-in user objects, guests (null/undefined), and objects without an id.

  - [x]* 2.4 Write property test for per-session view de-dup
    - **Property 3: At most one View_Event per clip per session**
    - **Validates: Requirements 1.5, 12.4**
    - New file `tests/prop-view-session-dedup.test.js`; generators include repeated and interleaved clip-id sequences.

  - [x]* 2.5 Write property test for event payload shape
    - **Property 4: Event payloads carry the clip and resolved viewer, and only resolved Watch fields**
    - **Validates: Requirements 1.1, 2.1, 2.2, 3.1**
    - New file `tests/prop-event-payload.test.js`; generators include Watch It selections with any subset of `title_id` / `platform_id` / `region` present or absent.

- [x] 3. Analytics_Reader model helpers (`showshak-shared.js`) — executable spec of `0019`
  - [x] 3.1 Implement the counting-model helpers
    - In `showshak-shared.js`, implement the pure counting model that the SQL reader mirrors: a Self_Activity collapse for views and shares (each event whose `user_id` is distinct from the clip's `creator_id` counted individually, including guests and repeats; all of the owner's own events collapse to exactly one when ≥1 exists, zero otherwise), a watch counter (every event, no de-dup, no self-collapse), a fire counter (at most one per distinct user per clip, owner included), and an owner-scoping filter (include a clip's events iff its `creator_id` equals the caller).
    - Export the helpers under the existing `module.exports` block.
    - _Requirements: 1.7, 1.8, 1.9, 2.7, 2.8, 3.6, 3.7, 4.1, 4.4, 7.1, 7.4, 7.6, 7.7, 10.2, 10.4, 11.1_

  - [x]* 3.2 Write property test for the Self_Activity collapse
    - **Property 5: Self_Activity collapse for views and shares**
    - **Validates: Requirements 1.7, 1.8, 1.9, 3.6, 3.7, 7.6, 10.4**
    - New file `tests/prop-selfactivity-collapse.test.js`; generators include multisets mixing owner and non-owner (and guest) events and repeats.

  - [x]* 3.3 Write property test for Watch It counting
    - **Property 6: Watch It taps count every event with no collapse**
    - **Validates: Requirements 2.7, 2.8, 7.7, 10.4**
    - New file `tests/prop-watch-count.test.js`; generators include owner taps and repeated taps by the same viewer.

  - [x]* 3.4 Write property test for fire counting
    - **Property 7: Fires count at most one per user per clip**
    - **Validates: Requirements 4.1, 4.4, 7.7, 10.4**
    - New file `tests/prop-fire-count.test.js`; generators include duplicate fire records for the same user and the owner firing their own clip.

  - [x]* 3.5 Write property test for owner-scoping
    - **Property 8: Aggregates are scoped to the caller's own clips**
    - **Validates: Requirements 7.1, 7.4, 10.2, 11.1**
    - New file `tests/prop-owner-scope.test.js`; generators include clip sets with mixed owners and arbitrary caller ids.

  - [x] 3.6 Implement the weekly-trend and insert-acceptance model helpers
    - In `showshak-shared.js`, implement the weekly-trend helper: exactly one entry for each of the last 7 calendar days (no day omitted, missing days zero-filled), bucketing each event into its day and applying the same collapse/watch/fire rules as the totals. Implement `ssEventInsertAccepted(viewerId, payloadUserId)` modelling the `with check` policy (accept iff `payloadUserId` is not distinct from `viewerId`: signed-in → equals their id, guest → null; reject anything else).
    - Export both helpers under the existing `module.exports` block.
    - _Requirements: 5.2, 5.3, 5.4, 9.1, 9.2, 9.3, 9.5, 13.4_

  - [x]* 3.7 Write property test for the weekly trend
    - **Property 10: Weekly trend is a 7-day, zero-filled bucketing of the same rules**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.5, 13.4**
    - New file `tests/prop-weekly-trend.test.js`; generators include events spread across and outside the 7-day window and days with no events.

  - [x]* 3.8 Write property test for insert-payload acceptance
    - **Property 9: Insert-payload acceptance mirrors the anti-spoofing rule**
    - **Validates: Requirements 5.2, 5.3, 5.4**
    - New file `tests/prop-insert-acceptance.test.js`; generators include signed-in and guest viewers paired with matching, null, and forged payload `user_id`s.

- [x] 4. Checkpoint — migration and pure helpers
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Fire-and-forget recorder wrappers and action-hook wiring (`showshak-shared.js`)
  - [x] 5.1 Implement the impure recorder wrappers
    - In `showshak-shared.js`, implement `ssRecordView(clipId)`, `ssRecordWatch(clipId, opts)`, and `ssRecordShare(clipId)`: resolve the viewer via `ssCurrentUser()`, return early (no-op) when `window.ssDB` is missing or `ssIsRecordableClipId` is false, build the payload with the pure builders, then call `window.ssDB.from(<table>).insert(payload)` **without `await`** on the caller's path, swallowing rejection (a `console.warn` at most), mirroring `_ssDbFire`.
    - `ssRecordView` consults a module-level `Set` (`_ssViewedThisSession`) via `ssShouldRecordView`, inserts only on `true`, then marks the id; `ssRecordWatch` applies no de-dup and no self-collapse.
    - _Requirements: 1.4, 2.5, 3.4, 4.2, 13.1, 13.2_

  - [x]* 5.2 Write unit tests for recorder fire-and-forget error handling
    - Stub `window.ssDB.from().insert()` to reject and assert each wrapper resolves without throwing and the caller's action continues; assert a non-recordable clip id, a missing `window.ssDB`, and a repeat view within the session each result in a no-op (no insert attempted), and that guests insert with `user_id = null`.
    - _Requirements: 1.4, 2.5, 3.4, 13.1, 13.2_

  - [x] 5.3 Wire the recorders into the existing action hooks
    - In `showshak-shared.js`, call `ssRecordView(clip.id)` from `ssOpenClip(clipOrId, list)` (the existing view hook — records the view per the existing view model, no new watch-time threshold), `ssRecordWatch(clip.id, { title_id, platform_id, region })` from `ssHandleWatchNow(platform, showTitle)` **and** the feed's bespoke Watch It handler, and `ssRecordShare(show.id)` from `ssShare(show)`.
    - Confirm the wrappers no-op cleanly for guests on mock clips and on the prototype surfaces so the demo keeps working.
    - _Requirements: 1.1, 2.1, 3.1, 4.2_

- [x] 6. Cockpit read-path wiring (`showshak-profile.html`)
  - [x] 6.1 Add `fetchOwnAnalytics()` and wire totals + weekly trend into the cockpit
    - Add an async `fetchOwnAnalytics()` alongside the existing `fetchOwnFollowers()`: gated on `isSignedInOwn()` and `window.ssDB`, it calls `rpc('creator_analytics_totals')` and `rpc('creator_analytics_weekly')`, caches results on `PROFILE`, and re-renders. Wrap each RPC in `try/catch` so on error the affected metric stays at its initialized `0` and the rest of the profile renders (fail-to-zero, never throws), mirroring `fetchOwnFollowers()`.
    - Update `renderCockpit()` / `renderAnalytics()` so a signed-in owner shows real Fires_Received, Watch_Event count, Reach (View_Event count), Share_Event count, and the 7-day zero-filled trend instead of the hard-coded zeros; follower count continues to come from the existing `follows` count (`fetchOwnFollowers`). Invoke `fetchOwnAnalytics()` from the existing post-session hydrate path.
    - **Depends on the founder having applied migration `0019`** so the RPCs exist; until then the fail-to-zero path keeps the cockpit rendering zeros without error.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 9.2, 9.3, 11.2, 11.3_

  - [x] 6.2 Wire per-clip stats into the cockpit per-clip grid
    - Extend `fetchOwnAnalytics()` to also call `rpc('creator_analytics_per_clip')`, cache the result on `PROFILE`, and render each owned clip's Fire / View / Watch_Event counts in the per-clip grid (zeros for clips with no events), owner-only behind `isSignedInOwn()` / `isOwner()`.
    - _Requirements: 10.1, 10.3, 11.2, 11.3_

  - [ ]* 6.3 Write unit test for cockpit fail-to-zero
    - Stub `rpc` to reject and assert the cockpit metrics render `0` and the rest of the profile still renders without throwing.
    - _Requirements: 8.5_

- [x] 7. Checkpoint — capture and cockpit wired
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Verification (integration/smoke per the design's Testing Strategy)
  - [x] 8.1 Add anti-spoofing RLS and no-raw-reads integration checks
    - In the reusable `showshak-rls-check.html` harness, add re-runnable anon/authenticated checks: as a guest, insert with `user_id = null` (accepted) and a non-null id (rejected); as a signed-in user, insert with own id (accepted) and a different id (rejected); and `select` from each event table returns no rows for both `anon` and `authenticated`.
    - **Founder applies migration `0019` first**, then runs these checks.
    - _Requirements: 5.2, 5.3, 5.4, 6.1, 6.3_

  - [ ] 8.2 Add owner-scoped reader-correctness integration checks
    - In `showshak-rls-check.html`, seed two curators' clips and a known event mix (owner + non-owner views/shares, repeated watches, an owner fire) and assert each curator's `creator_analytics_totals` / `creator_analytics_weekly` / `creator_analytics_per_clip` returns only their own aggregates, excludes the other curator's clips, derives the owner via the `content_id → content.creator_id` join, and matches the collapse / no-collapse / one-fire-per-user rules verified by the property tests.
    - **Founder applies migration `0019` first.**
    - _Requirements: 2.9, 7.1, 7.4, 7.6, 7.7, 9.5, 10.1, 11.1_

  - [ ] 8.3 Add config/smoke checks for the `0019` posture
    - Add re-runnable checks (service-role/SQL editor) asserting: `insert` but not `select` is granted on the three tables to `anon` + `authenticated`; RLS is enabled on all three; the three functions exist as `SECURITY DEFINER` with `search_path = public` and `execute` granted to `authenticated` only; `explain` on the reader queries confirms use of the existing `(content_id, created_at)` and `(creator_id, created_at)` indexes; no analytics code path writes `content_fires`; `content_fires` owner-read RLS is unchanged; and `analytics_daily` is untouched (no rollup job built).
    - **Founder runs these after applying migration `0019`.**
    - _Requirements: 4.2, 5.1, 5.5, 6.1, 6.2, 6.4, 7.5, 12.2, 12.3, 13.3_

- [ ] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each task references the specific requirement clauses it satisfies for traceability.
- **DB-first, founder-applied:** migration `0019` is created in code (task 1.1) but **applied manually by the founder** in the Supabase SQL editor; every downstream task that needs the grants/RLS/RPCs flags this explicitly. `0019` is additive only and idempotent.
- The ten correctness properties map to ten standalone property-based tests (one property per file, `fast-check`, ≥100 iterations via `tests/_pbt.js`'s `ITER`, tagged `Feature: creator-analytics, Property <n>`); they target the pure helpers in `showshak-shared.js`, which are the executable specification of the `0019` SQL reader.
- DB-side guarantees (insert grants, no raw reads, RLS acceptance, owner-scoping, `SECURITY DEFINER` posture, index usage) are covered by the integration/smoke checks in task 8, not by property tests.
- The view is recorded through the existing `ssOpenClip` hook per the requirements' existing view model and per-session de-dup; the design specifies no watch-time threshold, so none is added.
- Checkpoints provide incremental validation between the migration/helper layer, the wired capture + cockpit, and the final feature.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["3.1", "2.2", "2.3", "2.4", "2.5"] },
    { "id": 2, "tasks": ["3.6", "3.2", "3.3", "3.4", "3.5"] },
    { "id": 3, "tasks": ["5.1", "3.7", "3.8"] },
    { "id": 4, "tasks": ["5.3", "5.2", "6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3"] },
    { "id": 6, "tasks": ["8.1", "8.2", "8.3"] }
  ]
}
```
