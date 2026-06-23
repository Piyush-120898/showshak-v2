# Implementation Plan

## Overview

One principle ships in five independently-shippable, dependency-ordered phases — **the
active clip always wins the pipe; everything else is prefetched only with spare, bounded
bandwidth.** Phases 1–3 deliver most of the felt (TikTok/Instagram) improvement WITHOUT the
service-worker segment cache; Phase 4 adds true scroll-back persistence + guaranteed
prefetch reuse and is the highest-risk piece (range/206, quota, Mux egress to fill), shipped
behind measurement. Every phase keeps the live Feed working and `node tests/run-all.js` green.

Conventions (match the existing repo + the `watch-it-curator-availability` plan): all pure
logic lives in `showshak-shared.js`, dual-exported (`window.*` + `module.exports`); each
correctness property gets its own `tests/prop-feed-*.test.js` fast-check file
(`installDomStub()` before `require('../showshak-shared.js')`, `{ numRuns: ITER }` with
`ITER = 200`), auto-discovered by `tests/run-all.js`. Run `node tests/run-all.js` after every
`showshak-shared.js` change; the suite — including the existing player/feed helpers
(`ssMountedPlayerSet`, `ssPreloadAction`, `ssNetworkPolicy`, `ssResolveSurfaceMuted`) — MUST
stay green. **TDD-leaning:** the property tests for each new pure function are written FIRST
(red), then the function is implemented to pass them. Pure vanilla HTML/CSS/JS, no build step.
The `sw.js` change (Phase 4) requires a founder `CACHE_VERSION` bump on deploy; the segment
cache lives in a **separate** Cache Storage bucket so a version bump never wipes warmed video.
LOCKED decisions are preserved (keep `<mux-player>`, bounded pool ~4, no unbounded memory
cache, no player swap/MP4/CDN swap).

## Tasks

### PHASE 0 — Instrument + budget guard (FOUNDATION — measure first)

- [x] 1. Add the tunable-constants block + session prefetch counters
  - In `showshak-shared.js` add the named tunables from the design's tunables table:
    `SS_PREFETCH_DEPTH` (per tier), `SS_SESSION_BYTE_BUDGET`, `SS_SEG_CACHE_WINDOW`,
    `SS_SEG_CACHE_CEILING`, `SS_RES_CAP` (per tier), `SS_SPLASH_FLOOR_MS`,
    `SS_SPLASH_CEILING_MS`, `SS_METADATA_WINDOW`, `SS_BUFFER_SATISFIED_S`, `SS_DWELL_THRESHOLD`.
    Dual-export them. No behaviour change yet.
  - Add module-level session state `_ssPrefetchBytes = 0` and `_ssCircuitOpen = false`, a
    `_ssChargePrefetch(bytes)` helper that increments the counter and flips `_ssCircuitOpen`
    when it reaches `SS_SESSION_BYTE_BUDGET`, and a reset (both → 0/false) wired into the feed
    cold-open (`initFeed`). No prefetch consumes the budget yet (Phases 1–2 do).
  - _Files: showshak-shared.js, showshak-feed.html_
  - _Requirements: 3.1, 3.2, 3.5, 11.1, 11.2_

- [ ] 2. Founder-run — baseline measurement (FOUNDER-RUN)
  - **Founder:** turn on the Mux Data dashboards (views are already labelled with
    `metadata-video-id`/title/viewer) and capture a BASELINE: time-to-first-frame and rebuffer
    ratio on a real mid-range Android / 4G session, plus a DevTools network trace scrolling
    3–4 clips. This is the before/after scoreboard for the whole feature.
  - _Requirements: 8.1, 8.2_

### PHASE 1 — Preload tiering + replace broken warm + resolution cap (PRIORITY; biggest, lowest-risk win)

- [x] 3. Write the property tests for `ssPreloadTier` + `ssNetworkPolicy` extension (TDD — author FIRST)
  - **IMPORTANT**: these encode target behaviour and are red until task 4 lands. Author each as
    its own fast-check file (`installDomStub()` first; `{ numRuns: ITER }`, `ITER=200`; tagged
    `// Feature: feed-clip-load-performance, Property <n>: <text>` + `// **Validates: Requirements X.Y**`).

  - [x] 3.1 Property 1 — Preload-ladder totality + single-auto
    - `tests/prop-feed-ladder-totality.test.js`: for any `(distance, tier)`, `ssPreloadTier`
      returns exactly one of `{auto,metadata,none}`; returns `auto` iff `distance===0`; identical
      inputs → identical output; never throws on null/NaN/non-finite distance or unknown tier.
    - **Property 1: Preload-ladder totality + single-auto** — **Validates: Requirements 1.1, 1.6**
    - _Files: tests/prop-feed-ladder-totality.test.js_

  - [x] 3.2 Property 2 — Preload-ladder depth monotonicity
    - `tests/prop-feed-ladder-depth.test.js`: count of `metadata` positions on `slow` ≤ on `fast`;
      no clip beyond the tier's Prefetch_Depth (or behind active) is `metadata`.
    - **Property 2: Preload-ladder depth monotonicity** — **Validates: Requirements 1.3, 1.5**
    - _Files: tests/prop-feed-ladder-depth.test.js_

- [x] 4. Implement `ssPreloadTier` + extend `ssNetworkPolicy` (make P1/P2 pass)
  - Add pure `ssPreloadTier(distance, networkTier, depthByTier)` → `'auto'|'metadata'|'none'`
    per the design (active=auto; `1..depth`=metadata; else none; guarded/total). Extend
    `ssNetworkPolicy(tier)` so it carries `{ preloadDepth, maxResolution }` = slow `1`/`480p`,
    medium `2`/`720p`, fast `2`/`720p` (single source for Prefetch_Depth + Resolution_Cap).
    Dual-export. Run `node tests/run-all.js` (P1/P2 green; existing suite green).
  - _Files: showshak-shared.js, tests/prop-feed-ladder-*.test.js_
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 6.3_

- [x] 5. Wire preload tiering + resolution cap into the engine (impure)
  - In `ClipEngine.setActive` (INLINE + FULLSCREEN) and `_poolRecycle`, on every active-clip
    change compute `ssPreloadTier(i − activeIdx, tier)` for each mounted clip `i` and set that
    player's `preload` attribute (`auto`/`metadata`/`none`); apply
    `setMaxResolution(ssNetworkPolicy(tier).maxResolution)` to mounted surfaces. `VideoSurface`
    `mount`/`repoint` must STOP hardcoding `preload="auto"` and instead take the tier from the
    engine (default `none` until the engine assigns). Only the active clip is ever `auto`
    (Req 1.1/12 — active wins). While `_ssCircuitOpen`, force all non-active to `none`.
  - _Files: showshak-shared.js_
  - _Requirements: 1.1, 1.4, 6.1, 6.2, 3.3, 12.4, 12.5_

- [x] 6. Replace the broken warm with a CORS first-segment prefetch (impure)
  - Rewrite `ssWarmClips` (and its callers `_warmNext`/`initFeed` cold-warm) to prefetch the
    next `Prefetch_Depth` clips' **init + first media segment** with a CORS `fetch` (NOT
    `no-cors`), de-duped per `playback_id` (reuse `_ssWarmed`), charging `_ssChargePrefetch`
    with the response size. Keep poster warming. Resolve the first-segment URL from the
    rendition playlist (best-effort). Fire-and-forget + fail-soft: any failure → the player's
    own fetch still works. NOTE: without the Phase-4 SW cache these prefetched bytes are not yet
    guaranteed-reused; this task removes the wasted opaque warm and primes DNS/TLS/CDN + edge.
  - _Files: showshak-shared.js_
  - _Requirements: 1.2, 3.1, 10.7_

- [x] 7. Phase 1 checkpoint — suite green + diagnostics
  - Run `node tests/run-all.js` (all green incl. existing). `get_diagnostics` on
    `showshak-shared.js`. No behaviour regression to audio/pool/dwell.
  - _Requirements: 10.7_

- [ ] 8. Founder-run — Phase 1 on-device verification (FOUNDER-RUN)
  - **Founder** (bump `CACHE_VERSION`, push, reopen PWA twice): confirm via DevTools that only
    the active `<mux-player>` is `preload="auto"` and others are `metadata`/`none`; swipe feels
    faster to first frame; the delivered rendition is capped (≤720p, ≤480p on throttled "slow");
    compare TTFF/rebuffer to the Phase-0 baseline.
  - _Requirements: 1.1, 1.4, 6.1, 6.2, 8.1_

### PHASE 2 — Progressive deepening (after Phase 1)

- [x] 9. Write the property tests for `ssShouldDeepen` (TDD — author FIRST)

  - [x] 9.1 Property 3 — Deepening gating
    - `tests/prop-feed-deepen-gating.test.js`: `ssShouldDeepen` is false whenever active buffer
      not satisfied, OR budget remaining ≤ next segment, OR `dwell < dwellThreshold`, OR distance
      outside `[1, maxDistance]` / beyond tier depth; total; never throws.
    - **Property 3: Deepening gating** — **Validates: Requirements 2.1, 2.3**
    - _Files: tests/prop-feed-deepen-gating.test.js_

  - [x] 9.2 Property 4 — Deepening never starves the active clip
    - `tests/prop-feed-deepen-active-wins.test.js`: for ALL inputs with
      `activeBufferSatisfied===false`, `ssShouldDeepen` returns false.
    - **Property 4: Deepening never starves the active clip** — **Validates: Requirements 2.4**
    - _Files: tests/prop-feed-deepen-active-wins.test.js_

- [x] 10. Implement `ssShouldDeepen` (make P3/P4 pass)
  - Pure `ssShouldDeepen({activeBufferSatisfied, distance, networkTier, budgetRemainingBytes,
    nextSegmentBytes, dwell, dwellThreshold, maxDistance})` → bool per the design (true iff all
    gates pass; any missing/non-finite field → false). Dual-export. Run the suite.
  - _Files: showshak-shared.js, tests/prop-feed-deepen-*.test.js_
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 11. Implement the deepening controller + circuit breaker (impure)
  - Add `_ssDeepenController`: observe "active buffer satisfied" from the active surface's
    `buffered`/`currentTime` (`bufferedAhead ≥ SS_BUFFER_SATISFIED_S`); on a coalesced
    `timeupdate` tick, evaluate `ssShouldDeepen(...)` for the next clips in order (distance +1
    toward full, then +2..+4 first-segment) and, when true, fetch the next segment into cache,
    charging `_ssChargePrefetch`. Compute `dwell` from `currentTime/duration` (reuse the dwell
    machinery). Wire start/stop to `ClipEngine.setActive`. When `_ssCircuitOpen`, stop deepening
    and (via task 5) force non-active `preload="none"` for the session.
  - _Files: showshak-shared.js_
  - _Requirements: 2.1, 2.2, 2.4, 3.3, 3.4, 3.6, 10.7_

- [x] 12. Phase 2 checkpoint — suite green + diagnostics
  - Run `node tests/run-all.js`; `get_diagnostics`. Active clip must never be starved by deepening.
  - _Requirements: 2.4, 10.7_

- [ ] 13. Founder-run — Phase 2 on-device verification (FOUNDER-RUN)
  - **Founder:** confirm the next 2–3 clips are ready by swipe-time on wifi without the active
    clip stalling; throttle to slow 3G and confirm deepening backs off (active still smooth);
    force many rapid skips and confirm the byte counter rises and the circuit breaker engages
    (DevTools logs), after which only the active clip loads.
  - _Requirements: 2.1, 2.3, 2.4, 3.3, 3.4_

### PHASE 3 — Cold-start splash lane (after Phase 1; independent of Phase 2)

- [x] 14. Write the property test for `ssSplashLift` (TDD — author FIRST)
  - [x] 14.1 Property 5 — Splash-lift ceiling precedence + determinism
    - `tests/prop-feed-splash-lift.test.js`: across all 8 boolean combinations of
      `{floorElapsed, clipReady, ceilingReached}`, output matches `lift = ceiling OR (floor AND
      ready)`; returns `lift` for every input with `ceilingReached`; total, deterministic, never
      throws/blocks.
    - **Property 5: Splash-lift ceiling precedence + determinism** — **Validates: Requirements 5.3, 5.4, 5.5**
    - _Files: tests/prop-feed-splash-lift.test.js_

- [x] 15. Implement `ssSplashLift` (make P5 pass)
  - Pure `ssSplashLift({floorElapsed, clipReady, ceilingReached})` → `'lift'|'hold'` per the
    design (ceiling precedence). Dual-export. Run the suite.
  - _Files: showshak-shared.js, tests/prop-feed-splash-lift.test.js_
  - _Requirements: 5.3, 5.4, 5.5_

- [x] 16. Wire the cold-start lane (impure)
  - In `showshak-feed.html`: in the `#ss-splash` inline script, synchronously read the L1 feed
    cache (`localStorage`, key from `ss_last_uid`) → `clips[0].muxPlaybackId` + poster → issue a
    first-segment `fetch` + poster `Image()` within ~100 ms of launch (returning users). In
    `initFeed`, fire the same prefetch as soon as the metadata query returns (first-ever users).
    Replace the fixed `SS_SPLASH_MIN_MS` lift with a tick calling `ssSplashLift(...)`:
    `floorElapsed` from `SS_SPLASH_FLOOR_MS` (700 / 3000 first-ever), `clipReady` from the active
    surface `canplay`, `ceilingReached` from `SS_SPLASH_CEILING_MS` (the existing safety-net
    timeout becomes the ceiling). `__ssHideSplash` fires on the first `'lift'`. Fail-soft: query/
    prefetch failure keeps `clipReady=false` and the ceiling lifts the splash.
  - _Files: showshak-feed.html_
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7, 10.7_

- [x] 17. Phase 3 checkpoint — suite green + diagnostics
  - Run `node tests/run-all.js`; `get_diagnostics` on touched files. Splash can never hang.
  - _Requirements: 5.4, 10.7_

- [ ] 18. Founder-run — Phase 3 on-device verification (FOUNDER-RUN)
  - **Founder:** cold-open the installed PWA — confirm clip-1 plays the instant the splash lifts
    (no buffering after the logo), the brand beat still shows on first-ever launch, the splash
    never sticks on a stalled network (ceiling lifts it), and internal nav never shows the splash.
  - _Requirements: 5.1, 5.3, 5.4_

### PHASE 4 — Metadata window + SW persistent Segment_Cache (HIGHEST RISK; measure-first)

- [x] 19. Expand the metadata window
  - Bump `SS_FEED_CACHE_MAX` (and the rolling page cap as needed) to `SS_METADATA_WINDOW` (~30)
    so scroll-back within the window renders metadata with no DB round-trip. Metadata only —
    never video bytes. Verify the SWR read/write/`ssFeedListChanged` still behave.
  - _Files: showshak-shared.js_
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 20. Write the property tests for `ssSegmentEvictionPlan` + cross-cutting properties (TDD — author FIRST)

  - [x] 20.1 Property 6 — Eviction stays within ceiling + partitions input
    - `tests/prop-feed-evict-ceiling.test.js`: after `ssSegmentEvictionPlan`, kept bytes ≤
      ceiling whenever feasible; every out-of-window segment is in `evict`; `evict ∪ keep`
      equals the input with no loss/dup.
    - **Property 6: Eviction stays within ceiling + partitions input** — **Validates: Requirements 4.5, 4.6**
    - _Files: tests/prop-feed-evict-ceiling.test.js_

  - [x] 20.2 Property 7 — Eviction respects LRU order
    - `tests/prop-feed-evict-lru.test.js`: among in-window segments, no evicted segment has a
      newer `lastUsed` than any kept in-window segment.
    - **Property 7: Eviction respects LRU order** — **Validates: Requirements 4.5**
    - _Files: tests/prop-feed-evict-lru.test.js_

  - [x] 20.3 Property 8 — Graceful degradation at minimal scale
    - `tests/prop-feed-degrade.test.js`: ladder/eviction/deepening clamp to clips that exist;
      1 clip → no non-active prefetch produced; 2 clips → next clip resolves to `metadata`.
    - **Property 8: Graceful degradation at minimal scale** — **Validates: Requirements 9.1, 9.2, 9.3**
    - _Files: tests/prop-feed-degrade.test.js_

  - [x] 20.4 Property 9 — Totality / defensiveness (all four pure fns)
    - `tests/prop-feed-totality.test.js`: `ssPreloadTier`, `ssShouldDeepen`, `ssSplashLift`,
      `ssSegmentEvictionPlan` each resolve without throwing on null/undefined/malformed/
      non-finite inputs and return a well-formed result of the documented shape.
    - **Property 9: Totality / defensiveness** — **Validates: Requirements 10.1, 10.7**
    - _Files: tests/prop-feed-totality.test.js_

- [x] 21. Implement `ssSegmentEvictionPlan` (make P6/P7/P8/P9 pass)
  - Pure `ssSegmentEvictionPlan({segments, ceilingBytes, windowAhead, windowBehind})` →
    `{evict, keep}` per the design (out-of-window first, then LRU-by-bytes to ceiling;
    partitions input; total/defensive). Dual-export. Run the suite (all property files green,
    existing suite green).
  - _Files: showshak-shared.js, tests/prop-feed-evict-*.test.js, tests/prop-feed-degrade.test.js, tests/prop-feed-totality.test.js_
  - _Requirements: 4.4, 4.5, 4.6, 9.1, 10.1_

- [x] 22. Implement the service-worker Segment_Cache (impure)
  - In `sw.js` add a Mux-segment branch: match `stream.mux.com` segment/init/playlist requests;
    store media/init in a SEPARATE Cache Storage bucket (`showshak-seg`, NOT wiped on
    `CACHE_VERSION` change); serve hit (200) / miss (fetch+store). Implement **Range → 206**:
    on a `Range` request, read the cached full segment body, slice, and synthesize a `206
    Partial Content` with `Content-Range`/`Content-Length`/`Accept-Ranges`; unsatisfiable range
    or opaque/!ok body → bypass to network (never throw). Maintain a segment index
    `{key→{bytes,lastUsed,clipDistance}}` (in-memory, optionally IndexedDB); the page sends the
    active `playback_id` + window via `postMessage` so the SW can compute `clipDistance`; after
    writes, call `ssSegmentEvictionPlan(...)` and `cache.delete` the evict set. This makes a
    page-prefetched first segment (task 6/11) a guaranteed hit for BOTH hls.js and iOS native HLS.
  - _Files: sw.js, showshak-shared.js (postMessage active-clip info)_
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 10.1, 10.2, 10.3_

- [x] 23. Phase 4 checkpoint — suite green + diagnostics
  - Run `node tests/run-all.js` (all green incl. the 9 `prop-feed-*` files + existing suite);
    `get_diagnostics` on `showshak-shared.js` and `sw.js`.
  - _Requirements: 10.7_

- [ ] 24. Founder-run — Phase 4 on-device verification (FOUNDER-RUN)
  - **Founder** (bump `CACHE_VERSION`, push, reopen PWA): in DevTools confirm Mux segment
    requests are served from Cache Storage (`showshak-seg`), Range requests return 206,
    scroll-back to a recently-seen clip does NOT re-download, a `CACHE_VERSION` bump does NOT
    wipe `showshak-seg`, storage stays under the ceiling (eviction works), and Mux Data
    TTFF/rebuffer improved vs the Phase-0 baseline. Watch the prefetch byte counter vs the
    Mux budget.
  - _Requirements: 4.1, 4.2, 4.5, 4.6, 8.1, 8.3_

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"], "dependsOn": [] },
    { "wave": 2, "tasks": ["2", "3"], "dependsOn": ["1"] },
    { "wave": 3, "tasks": ["4"], "dependsOn": ["3"] },
    { "wave": 4, "tasks": ["5", "6"], "dependsOn": ["4"] },
    { "wave": 5, "tasks": ["7"], "dependsOn": ["5", "6"] },
    { "wave": 6, "tasks": ["8"], "dependsOn": ["7"] },
    { "wave": 7, "tasks": ["9"], "dependsOn": ["7"] },
    { "wave": 8, "tasks": ["10"], "dependsOn": ["9"] },
    { "wave": 9, "tasks": ["11"], "dependsOn": ["10"] },
    { "wave": 10, "tasks": ["12"], "dependsOn": ["11"] },
    { "wave": 11, "tasks": ["13"], "dependsOn": ["12"] },
    { "wave": 12, "tasks": ["14"], "dependsOn": ["7"] },
    { "wave": 13, "tasks": ["15"], "dependsOn": ["14"] },
    { "wave": 14, "tasks": ["16"], "dependsOn": ["15"] },
    { "wave": 15, "tasks": ["17"], "dependsOn": ["16"] },
    { "wave": 16, "tasks": ["18"], "dependsOn": ["17"] },
    { "wave": 17, "tasks": ["19", "20"], "dependsOn": ["7"] },
    { "wave": 18, "tasks": ["21"], "dependsOn": ["20"] },
    { "wave": 19, "tasks": ["22"], "dependsOn": ["19", "21"] },
    { "wave": 20, "tasks": ["23"], "dependsOn": ["22"] },
    { "wave": 21, "tasks": ["24"], "dependsOn": ["23"] }
  ]
}
```

```
PHASE 0  1 (tunables + counters) → 2 (FOUNDER baseline)
PHASE 1  3 (P1,P2 red) → 4 (ssPreloadTier+policy) → 5 (tier wiring) ∥ 6 (warm rewrite)
         → 7 (checkpoint) → 8 (FOUNDER on-device)
PHASE 2  9 (P3,P4 red) → 10 (ssShouldDeepen) → 11 (controller+breaker) → 12 → 13 (FOUNDER)
PHASE 3  14 (P5 red) → 15 (ssSplashLift) → 16 (cold-start wiring) → 17 → 18 (FOUNDER)
PHASE 4  19 (metadata 30) ∥ 20 (P6-P9 red) → 21 (ssSegmentEvictionPlan) → 22 (SW cache)
         → 23 (checkpoint) → 24 (FOUNDER on-device)
```

- Phases are sequenced but 1/2/3 are each independently shippable; Phase 3 (cold-start) and the
  Phase-4 prep (19/20) only need Phase 1's checkpoint (task 7), so they can proceed in parallel
  with Phase 2. Phase 4's SW cache (22) is the highest-risk and ships last, behind measurement.
- Founder-run tasks: 2 (baseline), 8/13/18/24 (on-device per phase). The `sw.js` change (22)
  needs a `CACHE_VERSION` bump on the founder's deploy.

## Notes

- **TDD-leaning:** every `prop-feed-*` file (tasks 3, 9, 14, 20) is written FIRST and is red
  until its implementation lands; they encode totality, the active-wins invariant, ceiling
  precedence, eviction correctness, and graceful degradation.
- **Pure core stays pure:** `ssPreloadTier` / `ssShouldDeepen` / `ssSplashLift` /
  `ssSegmentEvictionPlan` (+ the `ssNetworkPolicy` extension) are dual-exported with no
  DOM/network; the deepening controller and SW cache are impure and consume those decisions as
  data. Run `node tests/run-all.js` after every `showshak-shared.js` change.
- **Feed never breaks:** each phase is independently shippable and reversible; Phases 1–3 are
  pure-JS / page changes (no SW risk); Phase 4 isolates the SW segment cache behind its own
  bucket + measurement.
- **Cost guardrail throughout:** the session byte budget + circuit breaker (task 1/11) and the
  resolution cap (task 5) bound Mux egress; all magnitudes are tunable (task 1).
- **On-device / founder verification:** tasks 2, 8, 13, 18, 24 are run by the founder (Mux Data
  baseline/after, DevTools network + Cache Storage checks, real-device feel). The impure SW +
  player integration is verified there, not by property tests — only the pure decisions are
  property-tested.

## Workflow Complete

Requirements, design, and this task plan are the artifacts. To begin, open
`.kiro/specs/feed-clip-load-performance/tasks.md` and start at task 1 (Phase 0).
