# Implementation Plan

## Overview

One principle ships in three independently-shippable, dependency-ordered phases —
*warm the next thing during idle, paint from cache, revalidate, and never let anything
prefetched starve or destabilize the active surface.* Each phase is a coherent increment
the founder can deploy on its own; the **Feed must never break**, so every capability sits
behind its own `ss_ff_<name>` Kill_Switch and degrades to today's load-after-mount path on
any miss/quota/error.

- **Phase 1 — Cross-page data + poster prewarm.** During Feed `Idle_Time`, warm Discover's
  and Watchlist's `Page_Data` (into the existing page cache) and decode the first
  `SS_PREWARM_POSTER_COUNT` posters. The founder's main visible win; needs nothing from later
  phases. Gated by `ss_ff_prewarm`. *(R1, R2, R11, R14.1, R14.2)*
- **Phase 2 — Generic prewarm helper + storage tiering + SW per-resource strategies.** Route
  structured `Page_Data` to `IndexedDB` (with synchronous `localStorage` fallback), keep
  URL-addressable resources in `Cache_Storage`, and add the per-resource SW strategy branches
  (app-shell Cache_First, HTML + poster Stale_While_Revalidate). Gated by `ss_ff_idb`,
  `ss_ff_poster_swr`. *(R3, R4, R5, R14.3)*
- **Phase 3 — Segment-byte prefetch + device-verified Segment_Cache + platform split.** Warm
  upcoming clips' HLS segment **bytes** within the player cap (never mounting extra players),
  land the range-aware SW `Segment_Cache` with a bounded `Back_Buffer`, split Android-deeper /
  iOS-lean budgets, and add Speculation Rules + cross-document View Transitions. Gated by
  `ss_ff_segprefetch`, `ss_ff_segcache`, `ss_ff_speculation`, `ss_ff_viewtransition`.
  *(R6, R7, R8, R9, R14.3)*

**Conventions (match the shipped `feed-follows` and `feed-clip-load-performance` plans).**
All new pure logic lives in the `showshak-shared.js` pure export block, dual-exported
(`window.*` + `module.exports`); each correctness property gets its own
`tests/prop-*.test.js` fast-check file (`const { ITER, installDomStub } = require('./_pbt.js')`;
`installDomStub()` before `require('../showshak-shared.js')`; `{ numRuns: ITER }` with
`ITER ≥ 100`; `process.exit(1)` on failure), auto-discovered by `node tests/run-all.js` and
tagged `// Feature: prefetch-cache-pipeline, Property N: <text>` + `// **Validates: Requirements X.Y**`.
**TDD-leaning:** each phase authors its property tests FIRST (red), then implements the pure
helpers to make them green, then wires the impure shell that consumes those decisions as data
— mirroring the established `ssRankFeed` (pure) before `ssLoadClips` (impure) /
`ssPrewarmProfile` (impure) split. Pure vanilla HTML/CSS/JS, no build step, hand-rolled `sw.js`
(no Workbox). Run `node tests/run-all.js` after every `showshak-shared.js` change; keep the
suite — including the entire existing player/feed/nav suite — GREEN at every checkpoint
(R13.4, R13.5). The 8 new pure helpers are: `ssShouldPrewarm`, `ssPosterPrewarmList`,
`ssPublicSignalsOnly`, `ssResolveKillSwitches` (Phase 1); `ssStorageTier` (Phase 2);
`ssDeviceProfile`, `ssResolvePrefetchBudget`, `ssStorageTrimPlan` (Phase 3).

**SACRED locked decisions preserved.** `SS_MAX_LIVE_PLAYERS = 2` is never raised; prefetch
warms **bytes only** and never mounts a player; no MP4 / CDN / player swap, no raw-hls.js
rewrite; ONE player behaviour for iOS + Android; the recycled `<mux-player>` pool stays; no
unbounded cache (every cache bounded by count, byte ceiling, or TTL). **Scoreboard safety:**
only `Public_Signals` ever enter a cached payload — `ssPublicSignalsOnly` strips every
Scoreboard field before any write. The `sw.js` `CACHE_VERSION` (currently `v42`) is bumped on
each phase that changes the service worker, since the installed PWA only picks up SW changes
on a version bump (founder reopens the PWA twice).

## Tasks

### PHASE 1 — Cross-page data + poster prewarm (ship alone; gated `ss_ff_prewarm`)

- [x] 1. Write the 4 Phase-1 property tests (TDD — author FIRST, before task 2)
  - **IMPORTANT**: these encode the target pure-core behaviour and are EXPECTED to be red until
    task 2 lands. One `tests/prop-*.test.js` file each (fast-check; `_pbt.js`; `installDomStub()`
    before `require('../showshak-shared.js')`; `{ numRuns: ITER }`, `ITER ≥ 100`; auto-discovered
    by `node tests/run-all.js`). Generators must cover malformed/`null`/`undefined`/wrong-typed
    inputs so totality is exercised per helper.

  - [x] 1.1 Property 8 — kill-switch resolution is all-or-defaults
    - `tests/prop-killswitch-resolve.test.js`: for any `rawFlags` and documented `defaults`,
      `ssResolveKillSwitches(rawFlags, defaults)` returns an effective state for every capability
      — a present flag overrides its default, an absent flag takes its default, and when
      `rawFlags` is unreadable (`null`/non-object) **every** capability takes its default (never a
      mix). Total, deterministic.
    - **Property 8: Kill-switch resolution is all-or-defaults**
    - **Validates: Requirements 10.2, 10.5**
    - _Files: tests/prop-killswitch-resolve.test.js_

  - [x] 1.2 Property 1 — prewarm gate skips current and already-warmed, warms eligible
    - `tests/prop-prewarm-gate.test.js`: `ssShouldPrewarm(targetPage, currentPage, doneSet)`
      returns `true` iff `targetPage` is a known Target_Page, `!== currentPage`, and not in
      `doneSet`; every other input (unknown/non-string page, target equal to current, target in
      `doneSet`) returns `false`. Total, deterministic.
    - **Property 1: Prewarm gate skips current and already-warmed, warms eligible**
    - **Validates: Requirements 1.3, 3.3, 3.5**
    - _Files: tests/prop-prewarm-gate.test.js_

  - [x] 1.3 Property 2 — poster prewarm list clamps to count and to available posters
    - `tests/prop-poster-clamp.test.js`: `ssPosterPrewarmList(pageData, count)` returns a list of
      length `min(count, entries-with-a-poster)`; never exceeds `count`, never pads beyond posters
      that exist, every element is a real poster URL drawn in order; non-array / non-finite count
      → `[]`.
    - **Property 2: Poster prewarm list clamps to count and to available posters**
    - **Validates: Requirements 2.1, 2.4, 2.6**
    - _Files: tests/prop-poster-clamp.test.js_

  - [x] 1.4 Property 3 — Scoreboard-safe sanitization
    - `tests/prop-scoreboard-safe.test.js`: `ssPublicSignalsOnly(record)` returns an object with
      no Scoreboard field (`fires_received`, `fires_received_total`, `watch_taps`,
      `watch_it_taps`, any denylisted private total), preserves every Public_Signal, returns the
      public fields (not an empty/skipped result) when a record carries both kinds, is idempotent
      (fixpoint), and maps non-object → `{}`.
    - **Property 3: Scoreboard-safe sanitization**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4**
    - _Files: tests/prop-scoreboard-safe.test.js_

- [x] 2. Implement the Phase-1 pure helpers in the `showshak-shared.js` pure export block (make P1, P2, P3, P8 green)
  - [x] 2.1 Add `SS_PREWARM_POSTER_COUNT` + `ssResolveKillSwitches(rawFlags, defaults)`
    - Add the Tunable_Constant `SS_PREWARM_POSTER_COUNT = 12` (must stay in `[12, 15]`, R2.2) and
      the documented Kill_Switch defaults map (`ss_ff_prewarm`, `ss_ff_idb`, `ss_ff_poster_swr`,
      `ss_ff_segprefetch`, `ss_ff_segcache`, `ss_ff_speculation`, `ss_ff_viewtransition`, all
      default OFF). Implement `ssResolveKillSwitches` per Property 8 (all-or-defaults on an
      unreadable map). Dual-export.
    - _Files: showshak-shared.js_
    - _Requirements: 2.2, 10.1, 10.2, 10.5_

  - [x] 2.2 Add `ssShouldPrewarm(targetPage, currentPage, doneSet)`
    - Returns `true` iff `targetPage` is a known Target_Page (Discover/Watchlist), `!== currentPage`,
      and not in `doneSet`; any non-string / unknown page → `false`. Total, never throws.
      Dual-export.
    - _Files: showshak-shared.js_
    - _Requirements: 1.3, 3.3, 3.5_

  - [x] 2.3 Add `ssPosterPrewarmList(pageData, count)`
    - Returns the first `min(count, pageData.length)` poster URLs, skipping entries with no poster
      URL, never exceeding `count`; non-array / non-finite count → `[]`. Total. Dual-export.
    - _Files: showshak-shared.js_
    - _Requirements: 2.1, 2.4, 2.6_

  - [x] 2.4 Add `ssPublicSignalsOnly(record)`
    - Shallow copy with every Scoreboard/denylist field removed, all Public_Signals preserved;
      keeps (not skips) a mixed record with only its public fields; idempotent; non-object → `{}`.
      Total. Dual-export. **This is the Scoreboard-safety gate every cached payload passes through.**
    - _Files: showshak-shared.js_
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 2.5 Verify P1, P2, P3, P8 pass and the existing suite stays green
    - **IMPORTANT**: re-run the SAME tests from task 1 — do NOT write new tests. Run
      `node tests/run-all.js`: `prop-prewarm-gate`, `prop-poster-clamp`, `prop-scoreboard-safe`,
      `prop-killswitch-resolve` PASS and every pre-existing test still PASSES. Confirm dual-export
      of all four helpers on both `window.*` and `module.exports`.
    - _Files: tests/prop-prewarm-gate.test.js, tests/prop-poster-clamp.test.js, tests/prop-scoreboard-safe.test.js, tests/prop-killswitch-resolve.test.js, showshak-shared.js_
    - _Requirements: 13.3, 13.4, 13.5_

- [x] 3. Wire the Phase-1 impure shell — `ssPrewarmPages` from the Feed (gated `ss_ff_prewarm`)
  - [x] 3.1 Add `ssPrewarmPages()` (mirrors `ssPrewarmProfile`) + idle scheduling
    - Resolve flags via `ssResolveKillSwitches`; if `ss_ff_prewarm` is off, do nothing (today's
      behaviour). Schedule off the first-paint critical path with `requestIdleCallback(fn, {timeout})`
      and a `setTimeout` fallback (R1.2). For each Target_Page (Discover, Watchlist), gate on
      `ssShouldPrewarm` against a session `doneSet` (warm at most once per Feed session, R1.3),
      query its `Page_Data`, sanitize **every record through `ssPublicSignalsOnly`** before writing
      (R11), persist via `ssWritePageCache`, and decode `ssPosterPrewarmList(pageData, SS_PREWARM_POSTER_COUNT)`
      via the existing `_ssWarmImage` (R2.1, R2.4, R2.6). Every step fire-and-forget + try/catch:
      a query/decode failure leaves the Target_Page's load-after-mount path untouched (R1.5) and a
      single poster decode failure continues with the rest (R2.5). Kick it from the Feed bootstrap
      next to where `ssPrewarmProfile` is kicked. Dual-export.
    - _Files: showshak-shared.js, showshak-feed.html_
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.5, 10.3, 11.1_

  - [x] 3.2 Paint Discover/Watchlist from cache, then revalidate (Cache_Then_Revalidate)
    - In `showshak-discover.html` and `showshak-watchlist.html`, on mount read the cached
      `Page_Data` via `ssReadPageCache` and paint it on first paint (posters already decoded → no
      new poster request, R2.3), then re-query the DB and re-render **only if** `ssFeedListChanged`
      reports a change (R1.4). Unchanged when the cache is empty (today's load-after-mount).
    - _Files: showshak-discover.html, showshak-watchlist.html_
    - _Requirements: 1.4, 2.3, 14.2_

  - [x] 3.3 Bump `sw.js` `CACHE_VERSION` `v42` → `v43`
    - Change `CACHE_VERSION` so the founder picks up the Phase-1 page changes on-device (reopen the
      installed PWA twice). No other `sw.js` logic changes in Phase 1.
    - _Files: sw.js_
    - _Requirements: 13.1_

- [x] 4. Phase 1 checkpoint — suite green, Feed unaffected
  - Run `node tests/run-all.js` (P1/P2/P3/P8 + entire existing suite GREEN) and `get_diagnostics`
    on `showshak-shared.js`. Confirm with `ss_ff_prewarm` off the Feed/Discover/Watchlist behave
    exactly as today (R10.4, R14.2). Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 10.4, 13.4, 13.5, 14.1, 14.2_

- [ ] 5. FOUNDER-RUN — Phase 1 on-device verification (real installed PWA)
  - **Founder** (after the `v43` bump, push, reopen the PWA twice): confirm prewarm runs after
    first paint (rIC, with setTimeout fallback), Discover and Watchlist paint from cache with the
    prewarmed posters and **no new poster request** (DevTools network), and that forcing a prewarm
    failure leaves load-after-mount intact with no Feed regression (R1.1, R1.2, R2.3, R2.5, R14.2).
  - _Requirements: 1.1, 1.2, 2.3, 2.5, 14.2_

### PHASE 2 — Generic helper + storage tiering + SW per-resource strategies (gated `ss_ff_idb`, `ss_ff_poster_swr`)

- [x] 6. Write the 2 Phase-2 property tests (TDD — author FIRST, before task 7)
  - [x] 6.1 Property 4 — storage tier routing
    - `tests/prop-storage-tier.test.js`: `ssStorageTier(resourceKind)` maps every URL-addressable
      kind (`app_shell`, `css`, `js`, `html`, `poster`, `segment`) → `'cache_storage'`, `page_data`
      → `'indexeddb'`, tiny-flag kinds (`flag`, `last_uid`, `cache_meta`) → `'localstorage'`, and any
      unknown/garbage kind → `'localstorage'`. Total, never throws.
    - **Property 4: Storage tier routing**
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - _Files: tests/prop-storage-tier.test.js_

  - [x] 6.2 Property 5 — page-cache bound
    - `tests/prop-page-cache-bound.test.js`: for any `clips` array, the value produced by the
      Page_Data write path retains at most `SS_PAGE_CACHE_MAX` clips (stored length
      `= min(clips.length, SS_PAGE_CACHE_MAX)`), so no Target_Page cache grows unbounded. Drive this
      through the pure clamp the write path uses (the `clips.slice(0, SS_PAGE_CACHE_MAX)` boundary).
    - **Property 5: Page-cache bound**
    - **Validates: Requirements 4.6, 12.4**
    - _Files: tests/prop-page-cache-bound.test.js_

- [x] 7. Implement the Phase-2 pure helper + page-cache clamp (make P4, P5 green)
  - [x] 7.1 Add `ssStorageTier(resourceKind)`
    - Pure router per Property 4 (URL-addressable → `cache_storage`; `page_data` → `indexeddb`;
      tiny flags → `localstorage`; unknown → `localstorage`, the smallest/safest tier). Total.
      Dual-export.
    - _Files: showshak-shared.js_
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 7.2 Expose the page-cache clamp as a pure, dual-exported boundary
    - Factor the `min(clips.length, SS_PAGE_CACHE_MAX)` clamp the page-cache write path uses into a
      pure, total, dual-exported boundary (or assert the existing `SS_PAGE_CACHE_MAX = 60` clamp in
      `ssWritePageCache`/`ssWritePageData` is the single bound) so Property 5 tests it directly and
      both Storage_Tiers honour it. No new unbounded path (R12.4).
    - _Files: showshak-shared.js_
    - _Requirements: 4.6, 12.4_

  - [x] 7.3 Verify P4, P5 pass and the existing suite stays green
    - **IMPORTANT**: re-run task-6 tests; run `node tests/run-all.js` (P4/P5 + all prior + existing
      GREEN). Confirm `ssStorageTier` dual-export.
    - _Files: tests/prop-storage-tier.test.js, tests/prop-page-cache-bound.test.js, showshak-shared.js_
    - _Requirements: 13.3, 13.4, 13.5_

- [x] 8. Wire the Phase-2 impure shell — IndexedDB tiering + SW per-resource strategies
  - [x] 8.1 Add `ssReadPageData(name)` / `ssWritePageData(name, clips)` (IndexedDB + localStorage fallback)
    - Async IndexedDB object store (`ss_pagedata`, key `name|uid`, value `{ v, ts, clips }`) read off
      the main thread (R4.4), clamped to `SS_PAGE_CACHE_MAX` per Target_Page (R4.6). On IndexedDB
      absence or any read/write failure, fall back to the existing synchronous
      `ssReadPageCache`/`ssWritePageCache` localStorage path (R4.5). Gated by `ss_ff_idb` (off →
      localStorage page cache). Sanitize writes through `ssPublicSignalsOnly` (R11). Dual-export.
    - _Files: showshak-shared.js_
    - _Requirements: 4.1, 4.4, 4.5, 4.6, 11.1, 11.3_

  - [x] 8.2 Route page reads/writes through the tier, switch prewarm + pages to `ssReadPageData`/`ssWritePageData`
    - Use `ssStorageTier` to confirm `page_data` → IndexedDB and tiny flags/last-uid → localStorage
      (R4.3); switch `ssPrewarmPages` (task 3.1) and the Discover/Watchlist Cache_Then_Revalidate
      paint (task 3.2) to read/write via `ssReadPageData`/`ssWritePageData`, preserving the
      localStorage fallback so Phase 1 behaviour is intact when `ss_ff_idb` is off.
    - _Files: showshak-shared.js, showshak-discover.html, showshak-watchlist.html_
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [x] 8.3 Add the `sw.js` per-resource strategy branches
    - Extend the hand-rolled `sw.js` fetch handler (no Workbox, no build step, R5.4): app shell
      (CSS/JS/icons/manifest) Cache_First with the read-only fallback that keeps serving the shell
      when a write fails but reads succeed (R5.1, R5.6); HTML navigations Stale_While_Revalidate
      (R5.2); an explicit poster branch (`image.mux.com` thumbnails) Stale_While_Revalidate gated by
      `ss_ff_poster_swr` (R5.3); any cache read failure falls through to the network (R5.5). Do not
      touch the `showshak-seg` segment bucket here.
    - _Files: sw.js_
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 8.4 Bump `sw.js` `CACHE_VERSION` `v43` → `v44`
    - Publish the new SW strategy branches; founder reopens the PWA twice. Separate from 8.3 so the
      version line and the strategy edits don't collide.
    - _Files: sw.js_
    - _Requirements: 13.1_

- [x] 9. Phase 2 checkpoint — suite green, fallbacks intact
  - Run `node tests/run-all.js` (P4/P5 + all prior + existing GREEN) and `get_diagnostics` on
    `showshak-shared.js` and `sw.js`. Confirm with `ss_ff_idb`/`ss_ff_poster_swr` off the app uses
    the localStorage page cache + today's poster fetch (R10.2, R10.4). Ensure all tests pass, ask
    the user if questions arise.
  - _Requirements: 10.2, 10.4, 13.4, 13.5, 14.4_

- [ ] 10. FOUNDER-RUN — Phase 2 on-device verification (real installed PWA)
  - **Founder** (after the `v44` bump): confirm Page_Data reads are async from IndexedDB with no
    main-thread jank; disabling IndexedDB (or `ss_ff_idb` off) falls back to the localStorage page
    cache and still paints; the SW serves the app shell Cache_First, HTML + posters
    Stale_While_Revalidate; and an app-shell write-fail with read-success keeps the shell serving
    (R4.4, R4.5, R5.1–R5.6).
  - _Requirements: 4.4, 4.5, 5.1, 5.2, 5.3, 5.6_

### PHASE 3 — Segment-byte prefetch + Segment_Cache + platform split (gated `ss_ff_segprefetch`, `ss_ff_segcache`, `ss_ff_speculation`, `ss_ff_viewtransition`)

- [x] 11. Add the Phase-3 tunable constants
  - [x] 11.1 Add `SS_BACK_BUFFER_S`, `SS_IOS_STORAGE_BUDGET`, `SS_ANDROID_STORAGE_BUDGET`
    - Add `SS_BACK_BUFFER_S` (~30 s, finite positive), `SS_IOS_STORAGE_BUDGET` (~50 MB), and
      `SS_ANDROID_STORAGE_BUDGET` (≥ iOS). Reuse the existing `SS_PREFETCH_DEPTH`,
      `SS_SESSION_BYTE_BUDGET`, `SS_SEG_CACHE_CEILING`, `SS_SEG_CACHE_WINDOW`. Dual-export. Add the
      example/constant checks: `SS_PREWARM_POSTER_COUNT ∈ [12,15]`, `SS_MAX_LIVE_PLAYERS === 2`
      (unchanged, R12.1), `SS_BACK_BUFFER_S` finite positive (R7.5). No behaviour change yet.
    - _Files: showshak-shared.js_
    - _Requirements: 7.5, 8.4, 8.5, 12.1_

- [x] 12. Write the 4 Phase-3 property tests (TDD — author FIRST, before task 13)
  - [x] 12.1 Property 6 — device profile classification
    - `tests/prop-device-profile.test.js`: `ssDeviceProfile(ua)` returns `'ios'` for iOS user agents
      (iPhone/iPad/iPod and iPadOS-as-desktop signals) and `'android'` otherwise; non-string / absent
      input → `'ios'` (fail lean — never grant the deep budget on uncertainty). Total, deterministic.
    - **Property 6: Device profile classification**
    - **Validates: Requirements 8.2**
    - _Files: tests/prop-device-profile.test.js_

  - [x] 12.2 Property 7 — device prefetch-budget invariants
    - `tests/prop-device-budget.test.js`: for any tier, `ssResolvePrefetchBudget('android', tier)`
      yields `byteBudget` and `storageBudget` ≥ the `'ios'` values; iOS `storageBudget ===
      SS_IOS_STORAGE_BUDGET` for every tier; `('android','fast')` `prefetchDepth ===
      SS_PREFETCH_DEPTH.fast` and ≥ any other tier's depth; unknown device → iOS row, unknown tier →
      medium row.
    - **Property 7: Device prefetch-budget invariants**
    - **Validates: Requirements 8.3, 8.4, 8.5**
    - _Files: tests/prop-device-budget.test.js_

  - [x] 12.3 Property 9 — iOS storage-trim stays within budget and partitions input
    - `tests/prop-storage-trim.test.js`: `ssStorageTrimPlan(entries, budgetBytes)` evicts
      least-recently-used first until kept bytes ≤ budget (floor: a single entry larger than the
      budget is kept); no evicted entry has a newer `lastUsed` than any kept entry; `evict ∪ keep`
      equals the input key set exactly (no loss/dup); non-array / non-finite budget →
      `{ evict: [], keep: [] }`.
    - **Property 9: iOS storage-trim stays within budget and partitions input**
    - **Validates: Requirements 8.7, 12.4**
    - _Files: tests/prop-storage-trim.test.js_

  - [x] 12.4 Property 10 — totality of all 8 new pure helpers
    - `tests/prop-pipeline-totality.test.js`: for any input (incl. `null`, `undefined`, wrong-typed,
      non-finite, malformed) every new pure helper (`ssShouldPrewarm`, `ssPosterPrewarmList`,
      `ssPublicSignalsOnly`, `ssStorageTier`, `ssDeviceProfile`, `ssResolvePrefetchBudget`,
      `ssResolveKillSwitches`, `ssStorageTrimPlan`) resolves without throwing and returns a
      well-formed result of its documented shape.
    - **Property 10: Totality of all new pure helpers**
    - **Validates: Requirements 1.5, 9.4, 13.3, 13.4**
    - _Files: tests/prop-pipeline-totality.test.js_

- [x] 13. Implement the Phase-3 pure helpers (make P6, P7, P9, P10 green)
  - [x] 13.1 Add `ssDeviceProfile(ua)`
    - Classify iOS (`iPhone|iPad|iPod`, iPadOS-as-Mac-with-touch when signalled) → `'ios'`; otherwise
      → `'android'`; non-string → `'ios'` (fail lean). Total. Dual-export.
    - _Files: showshak-shared.js_
    - _Requirements: 8.2_

  - [x] 13.2 Add `ssResolvePrefetchBudget(deviceProfile, networkTier)`
    - Return `{ byteBudget, prefetchDepth, storageBudget }` per Property 7's invariants (Android ≥
      iOS for the same tier; iOS storage `=== SS_IOS_STORAGE_BUDGET`; `('android','fast')` depth `=
      SS_PREFETCH_DEPTH.fast`; unknown device → iOS, unknown tier → medium via `ssNetworkPolicy`).
      Total. Dual-export.
    - _Files: showshak-shared.js_
    - _Requirements: 8.3, 8.4, 8.5_

  - [x] 13.3 Add `ssStorageTrimPlan(entries, budgetBytes)`
    - Generic byte-bounded LRU planner per Property 9 (evict LRU-first to budget, single-entry floor,
      exact partition); non-array / non-finite budget → `{ evict: [], keep: [] }`. Mirrors
      `ssSegmentEvictionPlan` but tier-agnostic. Total. Dual-export.
    - _Files: showshak-shared.js_
    - _Requirements: 8.7, 12.4_

  - [x] 13.4 Verify P6, P7, P9, P10 pass and the existing suite stays green
    - **IMPORTANT**: re-run task-12 tests; run `node tests/run-all.js` (P6/P7/P9/P10 + all prior +
      existing GREEN). Confirm dual-export of `ssDeviceProfile`, `ssResolvePrefetchBudget`,
      `ssStorageTrimPlan`, and that `prop-pipeline-totality` sees all 8 helpers on `module.exports`.
    - _Files: tests/prop-device-profile.test.js, tests/prop-device-budget.test.js, tests/prop-storage-trim.test.js, tests/prop-pipeline-totality.test.js, showshak-shared.js_
    - _Requirements: 13.3, 13.4, 13.5_

- [x] 14. Wire the segment-byte prefetch loop within the player cap (gated `ss_ff_segprefetch`)
  - [x] 14.1 Warm upcoming clips' HLS bytes only — never mount extra players
    - Reuse `ssWarmClips` / `_ssDeepenController`: while the Active_Clip's buffer is satisfied and
      the `Circuit_Breaker` is closed, prefetch upcoming clips' init + first media segment **bytes**
      into the SW Segment_Cache, charging `_ssChargePrefetch` (R6.1). Depth from
      `ssResolvePrefetchBudget` for the current `Network_Tier` + `Device_Profile` (R6.3, R8.3); stop
      when the `Byte_Budget` opens the breaker (R6.4); a failed prefetch falls back to the player's
      own fetch (R6.5). **SACRED: warms bytes only — never mounts a player, so `SS_MAX_LIVE_PLAYERS`
      is structurally preserved** (R6.2, R12.1, R12.3). Gated by `ss_ff_segprefetch` (off → no
      prefetch).
    - _Files: showshak-shared.js_
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.3, 8.5, 12.1, 12.3_

- [x] 15. Land the device-verified Segment_Cache + bounded back-buffer + iOS storage guard
  - [x] 15.1 Extend the `sw.js` `showshak-seg` range-aware Segment_Cache (gated `ss_ff_segcache`)
    - When `ss_ff_segcache` is `on`, intercept Mux HLS_Segment requests against the
      `showshak-seg` bucket (kept out of the activate-time cleanup so a version bump never re-downloads
      warmed video): serve a ranged hit by slicing the cached full body into an HTTP **206** with
      `Content-Range`/`Content-Length`/`Accept-Ranges` (R7.2), serve a full hit as 200, fetch+store on
      a miss then serve (R7.1, R7.7), bypass to network on an unsatisfiable range / opaque body (never
      throw a 416, R7.3), and evict via the existing `ssSegmentEvictionPlan` on ceiling/window breach
      (R7.4). When `off`, do **not** intercept Mux — deliver exactly as today (R7.6). Any SW cache read
      failure → network (R5.5).
    - _Files: sw.js_
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 7.7_

  - [x] 15.2 Cap the player `Back_Buffer` to `SS_BACK_BUFFER_S`
    - Cap retained played-back media bytes to `SS_BACK_BUFFER_S` on the recycled `<mux-player>` pool
      so L3 stays bounded (R7.5). **SACRED: one player behaviour for iOS + Android, recycled pool, no
      player/MP4/CDN swap, no raw-hls.js rewrite** (R12.2, R12.3).
    - _Files: showshak-shared.js_
    - _Requirements: 7.5, 12.2, 12.3, 12.4_

  - [x] 15.3 Enforce the iOS total-storage guard via `ssStorageTrimPlan`
    - On an `ios` `Device_Profile`, keep total Pipeline storage within `SS_IOS_STORAGE_BUDGET`,
      evicting via `ssStorageTrimPlan` when it is exceeded, and never assume cached resources persist
      across sessions (R8.4, R8.7). Android uses `SS_ANDROID_STORAGE_BUDGET` (≥ iOS, R8.5). No
      unbounded cache (R12.4).
    - _Files: showshak-shared.js, sw.js_
    - _Requirements: 8.4, 8.5, 8.7, 12.4_

- [ ] 16. Wire the platform enhancements + final SW bump
  - [ ] 16.1 Speculation Rules wiring (Android + supported; manual fallback) (gated `ss_ff_speculation`)
    - When `ssDeviceProfile` is `android` and Speculation_Rules are supported, register a prerender/
      prefetch entry for the next likely page (R8.1); on iOS / unsupported / registration failure,
      fall back to manual `Cross_Page_Prewarm` (`ssPrewarmPages`) (R8.2, R8.6). Gated by
      `ss_ff_speculation`. Coordinate with the existing prerender guards so view/analytics side
      effects do not double-fire.
    - _Files: showshak-feed.html, showshak-shared.js_
    - _Requirements: 8.1, 8.2, 8.6_

  - [ ] 16.2 View Transitions wiring via `ssNavStrategy` (gated `ss_ff_viewtransition`)
    - Use the existing pure `ssNavStrategy(env)` to decide: supported → cross-document View
      Transition for navigations between ShowShak pages (R9.1, R9.4); unsupported → standard
      navigation with no visual regression (R9.2); a failed-to-start transition completes the
      navigation without it (R9.3). Gated by `ss_ff_viewtransition`. (Reuses the shipped
      `ssNavStrategy` / `ssNavigate` path — pure decision already property-tested.)
    - _Files: showshak-shared.js, showshak-feed.html, showshak-discover.html, showshak-watchlist.html_
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ] 16.3 Bump `sw.js` `CACHE_VERSION` `v44` → `v45`
    - Publish the Segment_Cache + back-buffer + storage-guard SW changes; founder reopens the PWA
      twice. Separate from 15.1/15.3 so the version line doesn't collide with the strategy edits.
    - _Files: sw.js_
    - _Requirements: 13.1_

- [x] 17. Phase 3 checkpoint — suite green, locked decisions intact
  - Run `node tests/run-all.js` (all 10 `prop-*` files + the entire existing suite GREEN) and
    `get_diagnostics` on `showshak-shared.js` and `sw.js`. Confirm in code review: bytes-only
    prefetch never mounts a player, `SS_MAX_LIVE_PLAYERS === 2` unchanged, one player behaviour,
    recycled `<mux-player>` pool with no swap/MP4/CDN/raw-hls, every cache bounded, and every flag
    off → today's behaviour (R10.4, R12.1–R12.4). Ensure all tests pass, ask the user if questions
    arise.
  - _Requirements: 10.4, 12.1, 12.2, 12.3, 12.4, 13.4, 13.5_

- [ ] 18. FOUNDER-RUN — Phase 3 on-device verification (real installed PWA)
  - **Founder** (after the `v45` bump): confirm prefetch warms bytes only and the live player count
    never exceeds `SS_MAX_LIVE_PLAYERS`; `ss_ff_segcache` on → 206 slicing correct, miss fetched+
    stored, unsatisfiable range bypasses, a `CACHE_VERSION` bump does NOT wipe `showshak-seg`,
    storage stays under the ceiling; `ss_ff_segcache` off → Mux untouched; Back_Buffer capped; iOS
    stays within `SS_IOS_STORAGE_BUDGET`; Android registers Speculation Rules (manual fallback on
    failure); View Transitions animate where supported and degrade cleanly. Finally toggle EVERY
    kill switch on, then off — the Feed works both ways; inject a throw per capability and confirm
    it degrades to load-after-mount (R6.1, R6.2, R7.1–R7.3, R7.6, R7.7, R8.1, R8.6, R9.1, R9.3,
    R10.1, R10.3, R10.4, R10.6).
  - _Requirements: 6.1, 6.2, 7.1, 7.2, 7.3, 7.6, 7.7, 8.1, 8.6, 9.1, 9.3, 10.1, 10.3, 10.4, 10.6_

## Notes

- **TDD-leaning per phase:** the 10 `tests/prop-*.test.js` files (tasks 1, 6, 12) are authored
  FIRST and are red until their pure helpers land (tasks 2, 7, 13). Each is its own file, one design
  property each, `ITER ≥ 100`, auto-discovered by `node tests/run-all.js`, tagged
  `// Feature: prefetch-cache-pipeline, Property N: <text>`.
- **Pure core stays pure:** the 8 new helpers (`ssShouldPrewarm`, `ssPosterPrewarmList`,
  `ssPublicSignalsOnly`, `ssResolveKillSwitches`, `ssStorageTier`, `ssDeviceProfile`,
  `ssResolvePrefetchBudget`, `ssStorageTrimPlan`) are dual-exported with no DOM/network; the impure
  shell (`ssPrewarmPages`, `ssReadPageData`/`ssWritePageData`, the `sw.js` strategy + Segment_Cache
  branches, the segment-byte prefetch loop, Speculation Rules, View Transitions) consumes those
  decisions as data — mirroring `ssRankFeed`/`ssLoadClips` and `ssPrewarmProfile`/`ssReadPageCache`.
- **Reused, already-tested pure helpers** (cited, not re-authored): `ssFeedListChanged` (R1.4),
  `ssNetworkTier`/`ssNetworkPolicy`/`ssShouldDeepen` (R6.1, R6.3, R6.4), `ssSegmentEvictionPlan`
  (R7.4, R12.4), `ssNavStrategy` (R9.1, R9.2, R9.4).
- **Scoreboard safety is structural:** every cached payload passes through `ssPublicSignalsOnly`
  (tasks 3.1, 8.1) before any write to any Storage_Tier — no `fires_received`/`fires_received_total`/
  `watch_taps`/`watch_it_taps` ever persists (R11).
- **SACRED locked decisions** (R12): `SS_MAX_LIVE_PLAYERS = 2` never raised; prefetch warms bytes
  only and never mounts a player; no MP4/CDN/player swap, no raw-hls.js rewrite; ONE behaviour for
  iOS + Android; recycled `<mux-player>` pool; no unbounded cache — verified in code review at the
  Phase 3 checkpoint (task 17) and on-device (task 18).
- **CACHE_VERSION bumps:** `v42 → v43` (Phase 1, task 3.3), `v43 → v44` (Phase 2, task 8.4),
  `v44 → v45` (Phase 3, task 16.3). The installed PWA only picks up SW changes on a version bump —
  the founder reopens the PWA twice after each deploy.
- **Phased & independently shippable** (R14): Phase 1 ships the founder's main visible win and needs
  nothing later; while any later phase is undeployed the earlier phases stay fully functional; every
  phase keeps `node tests/run-all.js` green and the live Feed working.
- **FOUNDER-RUN tasks (5, 10, 18)** are on-device checks on the real installed PWA — they are not
  coding-agent tasks and are excluded from the dependency graph below.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4"] },
    { "id": 3, "tasks": ["2.5"] },
    { "id": 4, "tasks": ["3.1"] },
    { "id": 5, "tasks": ["3.2"] },
    { "id": 6, "tasks": ["3.3"] },
    { "id": 7, "tasks": ["6.1", "6.2"] },
    { "id": 8, "tasks": ["7.1"] },
    { "id": 9, "tasks": ["7.2"] },
    { "id": 10, "tasks": ["7.3"] },
    { "id": 11, "tasks": ["8.1"] },
    { "id": 12, "tasks": ["8.2"] },
    { "id": 13, "tasks": ["8.3"] },
    { "id": 14, "tasks": ["8.4"] },
    { "id": 15, "tasks": ["11.1"] },
    { "id": 16, "tasks": ["12.1", "12.2", "12.3", "12.4"] },
    { "id": 17, "tasks": ["13.1"] },
    { "id": 18, "tasks": ["13.2"] },
    { "id": 19, "tasks": ["13.3"] },
    { "id": 20, "tasks": ["13.4"] },
    { "id": 21, "tasks": ["14.1"] },
    { "id": 22, "tasks": ["15.1"] },
    { "id": 23, "tasks": ["15.2"] },
    { "id": 24, "tasks": ["15.3"] },
    { "id": 25, "tasks": ["16.1"] },
    { "id": 26, "tasks": ["16.2"] },
    { "id": 27, "tasks": ["16.3"] }
  ]
}
```

## Workflow Complete

This planning workflow is complete — requirements, design, and this task plan are the artifacts.
No implementation has been done as part of this workflow. To begin, open
`.kiro/specs/prefetch-cache-pipeline/tasks.md` and click **Start task** next to a task item
(begin with task 1 in Phase 1).
