# Bugfix Requirements Document

## Introduction

On the installed iOS PWA, scrolling the inline Feed makes clips stutter: one clip
plays, then the next is stuck/paused on its first frame, then the next, and so on
for essentially every forward scroll. The problem became noticeably worse after
the prior "iOS streaming fix" that introduced the 2-live-player cap
(`SS_MAX_LIVE_PLAYERS = 2`).

The root cause is the band composition produced by the pure helper
`ssMountedPlayerSet(activeIdx, totalLoaded, maxLive)`. It biases the mounted band
ONE BEHIND the active clip (`start = activeIdx - 1`, band size 2), so the mounted
set is `{ activeIdx - 1, activeIdx }`. With a cap of 2, ZERO clips ahead are ever
mounted. The clip the user scrolls into next (`activeIdx + 1`) is therefore never
pre-mounted; on arrival the IntersectionObserver (threshold 0.6) calls
`pruneInlineSurfaces` then `setActive`, which calls `play()` on a freshly-mounted
`<mux-player>` that has ZERO buffered segments. On iOS this stalls on the first
frame, and after the `SS_STALL_GRACE_MS` (2500ms) stall check the pause/tap
affordance appears. A secondary symptom: the "preload next"
(`_inlineSurfaces[idx + 1].preload()`) call in `_inlineSetActive` is dead under
cap = 2, because `idx + 1` is outside the 2-clip band (it resolves to `undefined`,
a no-op).

The fix changes the BAND BIAS/composition so the band becomes direction-aware: when
scrolling down the band must include the next clip (`activeIdx + 1`) so it is
pre-mounted and buffering before the user arrives, while the mounted set size stays
≤ `maxLive` and the active clip is always included. The live-player cap MUST remain
2 (the iOS decoder-contention limit). This is the `ssMountedPlayerSet` band-bias
fix only.

**In scope:** the `ssMountedPlayerSet` band bias becoming direction-aware (a
scroll-direction signal threaded from the inline observer), so the next clip in the
direction of travel is pre-mounted.

**Out of scope (noted, not addressed here):**
- Segment-byte prefetch / Service-Worker segment cache (the separate
  `prefetch-cache-pipeline` Phase 3 work).
- `setActive` debounce / IntersectionObserver threshold tuning.

## Bug Analysis

### Current Behavior (Defect)

`ssMountedPlayerSet` always biases the band one behind the active clip, so the
clip ahead in the scroll direction is never pre-mounted and cold-starts on arrival.

1.1 WHEN the user scrolls DOWN to arrive at active clip `i` with `i + 1` in range (and `totalLoaded > maxLive`) THEN the system produces a mounted set of `{ i - 1, i }` that does NOT contain `i + 1`, so clip `i + 1` is mounted cold (zero buffered segments) only on arrival
1.2 WHEN a clip is mounted cold and `play()` is called on iOS THEN the system stalls on the first frame and, after `SS_STALL_GRACE_MS` (2500ms), shows the pause/tap affordance instead of playing
1.3 WHEN `_inlineSetActive(idx)` runs the "preload next" line `_inlineSurfaces[idx + 1].preload()` under cap = 2 THEN the system does nothing because `idx + 1` is outside the mounted band (`_inlineSurfaces[idx + 1]` is `undefined`)
1.4 WHEN the user scrolls UP THEN the system applies the same fixed "one behind" bias regardless of travel direction, so the band composition is not aligned to the direction the user is moving

### Expected Behavior (Correct)

The band becomes direction-aware so the next clip in the direction of travel is
pre-mounted and buffering before the user arrives, without raising the cap.

2.1 WHEN the user scrolls DOWN to active clip `i` with `i + 1` in range THEN the system SHALL include `i + 1` in the mounted set so the next clip is pre-mounted and buffering before arrival
2.2 WHEN a clip becomes active that was pre-mounted by the band THEN the system SHALL have an already-mounted surface available so `play()` does not cold-start, avoiding the iOS first-frame stall and the resulting pause/tap affordance
2.3 WHEN the user scrolls UP to active clip `i` with `i - 1` in range THEN the system SHALL bias the band behind the active clip so `i - 1` is pre-mounted in the direction of travel
2.4 WHEN the active clip is at the start of the feed (`activeIdx = 0`, no clip behind) THEN the system SHALL still include the active clip and bias the remaining band slot(s) AHEAD (toward `activeIdx + 1`)
2.5 WHEN the active clip is at the end of the feed (`activeIdx = totalLoaded - 1`, no clip ahead) THEN the system SHALL still include the active clip and bias the remaining band slot(s) BEHIND (toward `activeIdx - 1`)
2.6 WHEN `totalLoaded <= maxLive` (degenerate case) THEN the system SHALL return all in-range indices `0 .. totalLoaded - 1` regardless of direction
2.7 WHEN the band is computed for any direction THEN the resulting mounted set SHALL always include `activeIdx` and SHALL always have size ≤ `maxLive`

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `SS_MAX_LIVE_PLAYERS` is consulted THEN the system SHALL CONTINUE TO use a value of 2 — the cap MUST NOT be raised (it is the iOS decoder-contention limit; raising it re-breaks iOS). The fix changes band composition only.
3.2 WHEN `ssMountedPlayerSet` is called with any input — including `null`, `undefined`, negative, out-of-range, non-finite, or zero `totalLoaded` — THEN the system SHALL CONTINUE TO return a well-formed sorted array of in-range indices and SHALL NEVER throw (preserve the existing totality of the helper)
3.3 WHEN `ssMountedPlayerSet` returns a non-empty set THEN the system SHALL CONTINUE TO return indices that are all in range `[0, totalLoaded)`, strictly sorted ascending, with size ≤ `maxLive`
3.4 WHEN `activeIdx < 0`, `activeIdx >= totalLoaded`, or `totalLoaded <= 0` THEN the system SHALL CONTINUE TO return an empty array `[]`
3.5 WHEN clips are played on iOS and Android THEN the system SHALL CONTINUE TO use one player behaviour for both platforms, keep the recycled `<mux-player>` pool, and SHALL NOT swap to MP4/CDN/another player or rewrite to raw hls.js
3.6 WHEN the band-bias fix is shipped THEN the system SHALL CONTINUE TO honour the on-device kill-switch convention (`localStorage ss_ff_*` read by `_ssFeatureOff`), so the founder can revert to the pre-fix band behaviour on-device WITHOUT a redeploy, and the fix SHALL degrade safely to the existing behaviour when its flag is off
3.7 WHEN the segment-byte prefetch / SW segment cache and the `setActive` debounce/threshold are concerned THEN the system SHALL CONTINUE TO leave them unchanged (out of scope for this fix)

## Bug Condition and Properties

### Bug Condition

```pascal
FUNCTION isBugCondition(X)
  INPUT: X = { activeIdx, totalLoaded, maxLive, direction }   // direction ∈ {down, up}
  OUTPUT: boolean

  // The active clip and the in-range neighbour in the direction of travel
  // are both valid, the band is constrained (more clips than the cap), but
  // the neighbour in the travel direction is NOT in the mounted set.
  IF totalLoaded <= maxLive THEN RETURN false          // degenerate: everything mounts
  IF activeIdx < 0 OR activeIdx >= totalLoaded THEN RETURN false

  next ← (direction = down) ? activeIdx + 1 : activeIdx - 1
  IF next < 0 OR next >= totalLoaded THEN RETURN false  // no neighbour ahead in this direction

  set ← ssMountedPlayerSet(activeIdx, totalLoaded, maxLive)   // F: original
  RETURN NOT contains(set, next)
END FUNCTION
```

Concrete counterexample (the observed bug): `activeIdx = 5`, `totalLoaded = 20`,
`maxLive = 2`, `direction = down`. `F` returns `{ 4, 5 }`, which does not contain
`6` → the next clip cold-starts and stalls on iOS.

### Property: Fix Checking (direction-aware pre-mount)

```pascal
// F': the fixed, direction-aware ssMountedPlayerSet(activeIdx, totalLoaded, maxLive, direction)
FOR ALL X WHERE isBugCondition(X) DO
  set ← F'(X)
  next ← (X.direction = down) ? X.activeIdx + 1 : X.activeIdx - 1
  ASSERT contains(set, next)            // the next clip in travel direction is pre-mounted
  ASSERT contains(set, X.activeIdx)     // active is always mounted
  ASSERT set.length <= X.maxLive        // cap never exceeded
END FOR
```

### Property: Invariants (totality, bounds, ordering) — hold for ALL inputs

```pascal
FOR ALL activeIdx, totalLoaded, maxLive, direction DO
  set ← F'(activeIdx, totalLoaded, maxLive, direction)
  ASSERT isArray(set)
  ASSERT set.length <= max(maxLive, SS_MAX_LIVE_PLAYERS-bounded cap)
  ASSERT isSortedAscendingUnique(set)
  ASSERT every index in set is within [0, totalLoaded)
  ASSERT (activeIdx in [0, totalLoaded) AND totalLoaded > 0) IMPLIES contains(set, activeIdx)
  ASSERT no throw
END FOR
```

### Property: Preservation Checking (non-buggy inputs unchanged)

```pascal
// For inputs that do NOT trigger the bug, the fixed band must match the original
// band so existing passing behaviour does not regress. When direction is absent
// or the configuration is degenerate, F' must equal F.
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F'(X.activeIdx, X.totalLoaded, X.maxLive, /*no direction*/) = F(X.activeIdx, X.totalLoaded, X.maxLive)
END FOR
```

**Key definitions:**
- **F** — the original `ssMountedPlayerSet(activeIdx, totalLoaded, maxLive)` (biases one behind; no direction parameter).
- **F'** — the fixed, direction-aware `ssMountedPlayerSet` that pre-mounts the next clip in the direction of travel while keeping the cap and totality.
