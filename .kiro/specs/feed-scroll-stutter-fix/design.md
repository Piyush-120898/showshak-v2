# Feed Scroll Stutter Fix — Bugfix Design

## Overview

The inline Feed stutters on the installed iOS PWA: each clip the user scrolls into
cold-starts because the mounted band produced by `ssMountedPlayerSet(activeIdx,
totalLoaded, maxLive)` is biased ONE BEHIND the active clip (`{ activeIdx - 1,
activeIdx }`). With the iOS decoder cap `SS_MAX_LIVE_PLAYERS = 2`, that leaves
ZERO slots for the clip ahead, so the next clip (`activeIdx + 1`) is mounted cold
on arrival and stalls on its first frame until the `SS_STALL_GRACE_MS` (2500ms)
check shows the pause/tap affordance.

The fix makes the band **direction-aware** so the next clip in the direction of
travel is pre-mounted and buffering before the user arrives, WITHOUT raising the
cap. The approach is deliberately conservative and total:

- `ssMountedPlayerSet` gains an **optional 4th parameter** `direction` (`'down' |
  'up'`). When `direction` is absent or unrecognised, `F'` runs the **exact**
  original algorithm — byte-identical to `F` — so every existing caller and every
  existing test is preserved without change.
- The direction signal is derived in the inline IntersectionObserver (comparing
  the entering index to the previous `_inlineActiveIdx`) and threaded through
  `pruneInlineSurfaces → _poolRecycle → ssMountedPlayerSet`.
- The new ahead-bias is gated behind the on-device kill-switch convention
  (`_ssFeatureOff('aheadband')` reading `localStorage ss_ff_aheadband`), so the
  founder can revert to the pre-fix band on-device without a redeploy.
- The dead "preload next" line in `_inlineSetActive` (`_inlineSurfaces[idx +
  1].preload()`) becomes effective once the ahead-band actually mounts `idx + 1`.

This is a band-composition change only. The live-player cap stays 2; the recycled
`<mux-player>` pool, one-player iOS+Android behaviour, and the pure helper's
totality and dual-export are all preserved.

## Glossary

- **Bug_Condition (C)**: The band, under cap `maxLive`, omits the in-range
  neighbour in the direction of travel — `next = (direction = down) ? activeIdx +
  1 : activeIdx - 1` — so that clip cold-starts on arrival. Formalised in
  `isBugCondition` below.
- **Property (P)**: For inputs satisfying `C`, the fixed band SHALL contain `next`
  and `activeIdx`, with size ≤ `maxLive`.
- **Preservation**: For inputs NOT satisfying `C`, and for every call that omits
  the `direction` argument, `F'` SHALL return exactly what `F` returned.
- **F** — the original `ssMountedPlayerSet(activeIdx, totalLoaded, maxLive)`: a
  contiguous band biased one behind the active clip; no direction parameter.
- **F'** — the fixed `ssMountedPlayerSet(activeIdx, totalLoaded, maxLive,
  direction)`: direction-aware ahead-bias, falling back to `F` when `direction`
  is absent/unknown.
- **ssMountedPlayerSet** — pure helper in `showshak-shared.js` (dual-exported on
  `window.*` and `module.exports`) that returns the bounded set of clip indices
  whose `<mux-player>` surface must stay mounted.
- **_poolRecycle(activeIdx, host)** — impure shell in `showshak-shared.js`,
  shared by INLINE and FULLSCREEN, that re-points freed surfaces onto entering
  clips based on the band from `ssMountedPlayerSet`.
- **pruneInlineSurfaces(activeIdx)** — INLINE entry point that delegates to
  `_poolRecycle(activeIdx, 'INLINE')`.
- **_inlineSetupObserver(container)** — inline IntersectionObserver (threshold
  0.6); on intersection it calls `pruneInlineSurfaces(idx)` then `setActive(idx)`.
- **_inlineActiveIdx** — module-level index of the currently-active inline clip;
  the previous value is the basis for deriving scroll direction.
- **SS_MAX_LIVE_PLAYERS** — the iOS decoder-contention cap; stays `2`.
- **direction** — `'down'` (scrolling to higher indices) or `'up'` (lower
  indices); anything else is treated as absent.

## Bug Details

### Bug Condition

The bug manifests when the band is constrained (more loaded clips than the cap),
the active clip and the in-range neighbour in the travel direction are both valid,
but the original band `F` does NOT contain that neighbour. The helper is biasing
the band one behind regardless of the direction the user is moving, so under a cap
of 2 nothing ahead is ever pre-mounted.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X = { activeIdx, totalLoaded, maxLive, direction }   // direction ∈ {down, up}
  OUTPUT: boolean

  IF totalLoaded <= maxLive THEN RETURN false           // degenerate: everything mounts
  IF activeIdx < 0 OR activeIdx >= totalLoaded THEN RETURN false

  next ← (direction = down) ? activeIdx + 1 : activeIdx - 1
  IF next < 0 OR next >= totalLoaded THEN RETURN false   // no neighbour in this direction

  set ← ssMountedPlayerSet(activeIdx, totalLoaded, maxLive)   // F: original (3-arg)
  RETURN NOT contains(set, next)
END FUNCTION
```

### Examples

- `activeIdx = 5, totalLoaded = 20, maxLive = 2, direction = down`: `F` returns
  `{ 4, 5 }` → does NOT contain `6`. Clip 6 cold-starts and stalls on iOS.
  (Expected: `F'` returns `{ 5, 6 }`.)
- `activeIdx = 0, totalLoaded = 20, maxLive = 2, direction = down`: `F` returns
  `{ 0, 1 }` → already contains `1`, so NOT a bug condition (start of feed already
  biases ahead). `F'` must preserve `{ 0, 1 }`.
- `activeIdx = 5, totalLoaded = 20, maxLive = 2, direction = up`: `F` returns
  `{ 4, 5 }` → contains `4` (= next when going up), so NOT a bug condition. `F'`
  must preserve `{ 4, 5 }`.
- `activeIdx = 19, totalLoaded = 20, maxLive = 2, direction = down`: `next = 20`
  is out of range → NOT a bug condition. `F'` biases behind → `{ 18, 19 }`.
- `activeIdx = 1, totalLoaded = 2, maxLive = 2`: `totalLoaded <= maxLive` →
  degenerate, everything mounts → `{ 0, 1 }`, direction irrelevant.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `SS_MAX_LIVE_PLAYERS` stays `2`; the cap is never raised (bugfix.md 3.1).
- `ssMountedPlayerSet` stays **total**: any input (`null`, `undefined`, negative,
  out-of-range, non-finite, zero `totalLoaded`) returns a well-formed sorted array
  and never throws (3.2).
- A non-empty result is always in range `[0, totalLoaded)`, strictly sorted
  ascending, size ≤ `maxLive` (3.3).
- `activeIdx < 0`, `activeIdx >= totalLoaded`, or `totalLoaded <= 0` returns `[]`
  (3.4).
- One-player behaviour for iOS and Android, the recycled `<mux-player>` pool, no
  swap to MP4/CDN/another player, no raw hls.js rewrite (3.5).
- The pure helper stays dual-exported (`window.*` + `module.exports`).
- Segment-byte prefetch / SW segment cache and the `setActive` debounce /
  IntersectionObserver threshold are untouched (3.7).

**Scope:**
Every call that does NOT pass a recognised `direction` — including all existing
callers and the FULLSCREEN host — must be completely unaffected by this fix:
- The 3-arg `ssMountedPlayerSet(activeIdx, totalLoaded, maxLive)` form.
- `ssMountedPlayerSet(..., undefined)` or any unrecognised direction value.
- FULLSCREEN recycling through `_ssvPruneSurfaces → _poolRecycle(idx,
  'FULLSCREEN')` (no direction passed).

The actual expected correct behavior for buggy inputs is defined in the
Correctness Properties section (Property 1).

## Hypothesized Root Cause

Based on the bug description and the code in `showshak-shared.js`, the cause is
well isolated:

1. **Fixed "one behind" band bias (primary, confirmed by code read)**: `F`
   computes `start = activeIdx - 1` unconditionally, then clamps. Under `band =
   min(cap, totalLoaded)` with `cap = 2`, this yields `{ activeIdx - 1, activeIdx
   }` everywhere except the feed start. The clip ahead in the scroll direction is
   never in the band, so it is mounted cold by `_poolRecycle` only on arrival.

2. **Cold mount → iOS first-frame stall**: `_poolRecycle` mounts the entering
   clip when it is already the active clip; `play()` is then called on a
   `<mux-player>` with zero buffered segments. iOS stalls on the first frame; the
   `SS_STALL_GRACE_MS` check surfaces the pause/tap affordance (bugfix.md 1.2).

3. **Dead "preload next" line under cap = 2**: `_inlineSetActive` calls
   `_inlineSurfaces[idx + 1].preload()`, but with the one-behind band `idx + 1` is
   never mounted, so `_inlineSurfaces[idx + 1]` is `undefined` and the call is a
   no-op (bugfix.md 1.3). The ahead-band fix mounts `idx + 1`, making this warm
   effective (and the `_ssApplyPreloadTiers` ladder already assigns distance-1 =
   `'metadata'`, consistent with `preload()`).

4. **No direction signal threaded to the helper**: the observer / prune / recycle
   path never tells the helper which way the user is moving, so it cannot bias
   correctly (bugfix.md 1.4).

## Correctness Properties

Property 1: Bug Condition — Direction-aware pre-mount

_For any_ input where the bug condition holds (`isBugCondition(X)` returns true),
the fixed `ssMountedPlayerSet(activeIdx, totalLoaded, maxLive, direction)` SHALL
return a set that contains `next` (the in-range neighbour in the direction of
travel: `activeIdx + 1` for `down`, `activeIdx - 1` for `up`), contains
`activeIdx`, and has size ≤ `maxLive` — so the next clip is pre-mounted and
buffering before the user arrives, avoiding the iOS cold-start stall. At the start
of the feed the remaining slot biases ahead; at the end it biases behind.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Invariants — totality, bounds, ordering (hold for ALL inputs)

_For any_ `activeIdx, totalLoaded, maxLive, direction` (recognised, unrecognised,
or absent), the fixed function SHALL return an array that is strictly sorted
ascending with unique entries, every index within `[0, totalLoaded)`, size ≤
`maxLive` (capped at `SS_MAX_LIVE_PLAYERS` when `maxLive` is invalid), SHALL
include `activeIdx` whenever `activeIdx ∈ [0, totalLoaded)` and `totalLoaded > 0`,
SHALL return `[]` for out-of-range/degenerate inputs, and SHALL never throw. When
`totalLoaded <= maxLive` it SHALL return all in-range indices regardless of
direction.

**Validates: Requirements 2.6, 2.7, 3.2, 3.3, 3.4**

Property 3: Preservation — non-buggy inputs and direction-less calls unchanged

_For any_ input where the bug condition does NOT hold, and for _any_ call that
omits or does not recognise `direction`, the fixed function SHALL produce exactly
the same result as the original function `F`, preserving every existing caller,
the FULLSCREEN host, the 2-player cap, the recycled-pool/one-player behaviour, and
the on-device kill-switch revert path.

**Validates: Requirements 3.1, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

**File**: `showshak-shared.js`

#### 1. Pure helper — `ssMountedPlayerSet` gains an optional `direction` (the F' algorithm)

The change is additive: the existing clamp/totality logic is reused verbatim, and
only the initial `start` choice becomes direction-aware. When `direction` is not
`'down'` or `'up'`, `start` is computed exactly as today (`activeIdx - 1`), so the
function is byte-identical to `F` on the entire existing call surface.

```
FUNCTION ssMountedPlayerSet(activeIdx, totalLoaded, maxLive, direction)
  cap  ← (maxLive AND maxLive > 0) ? maxLive : SS_MAX_LIVE_PLAYERS
  IF (NOT totalLoaded) OR totalLoaded <= 0 OR activeIdx < 0 OR activeIdx >= totalLoaded
     RETURN []                                  // unchanged totality guard (3.4)
  band ← min(cap, totalLoaded)

  // ── Direction-aware initial bias ──────────────────────────────
  IF direction ≠ 'down' AND direction ≠ 'up'
     start ← activeIdx - 1                       // PRESERVATION: original F bias
  ELSE
     neighbours ← band - 1                       // slots other than the active clip
     IF direction = 'down'
        behind ← floor(neighbours / 2)           // ahead-heavy: ahead gets the ceil
     ELSE  // 'up'
        behind ← ceil(neighbours / 2)            // behind-heavy: behind gets the ceil
     start ← activeIdx - behind

  // ── Shared clamp (IDENTICAL to original F) ────────────────────
  IF start + band > totalLoaded THEN start ← totalLoaded - band   // fit against the end
  IF start < 0 THEN start ← 0
  IF activeIdx < start THEN start ← activeIdx                     // keep active in window
  ELSE IF activeIdx >= start + band THEN start ← activeIdx - band + 1
  IF start < 0 THEN start ← 0

  set ← []
  FOR i ← start TO totalLoaded - 1 WHILE set.length < band
     set.push(i)
  RETURN set
END FUNCTION
```

Worked results under `cap = 2`:

| activeIdx | totalLoaded | direction | behind | band result | note |
|-----------|-------------|-----------|--------|-------------|------|
| 5  | 20 | down      | 0 | `{5,6}` | pre-mounts the next clip (the fix) |
| 5  | 20 | up        | 1 | `{4,5}` | biases behind (= F) |
| 5  | 20 | _(none)_  | — | `{4,5}` | byte-identical to F (preservation) |
| 0  | 20 | down/up   | 0/1→clamp | `{0,1}` | start of feed → biases ahead (2.4) |
| 19 | 20 | down      | 0→clamp | `{18,19}` | end of feed → biases behind (2.5) |
| 1  | 2  | any       | — | `{0,1}` | `totalLoaded ≤ maxLive` → all (2.6) |

Generalisation to `maxLive > 2` is clean (ahead-heavy split of the `band - 1`
neighbour slots in the travel direction) even though the live cap stays 2 in
production — the helper stays correct if the cap is ever explored in tests.

#### 2. Impure shell — thread the scroll-direction signal

`pruneInlineSurfaces` and `_poolRecycle` gain an optional `direction` parameter
that is threaded into `ssMountedPlayerSet`. FULLSCREEN passes nothing, so it is
unaffected.

```
// _inlineSetupObserver: derive direction from the previous active index BEFORE
// pruning (pruneInlineSurfaces runs before setActive, so _inlineActiveIdx still
// holds the previous active at this point).
const idx = parseInt(entry.target.dataset.ssIdx, 10);
if (!isNaN(idx)) {
  const dir = (idx > _inlineActiveIdx) ? 'down'
            : (idx < _inlineActiveIdx) ? 'up'
            : undefined;                         // re-entry / same clip → no bias change
  ClipEngine.pruneInlineSurfaces(idx, dir);
  ClipEngine.setActive(idx, 'INLINE');
  _inlineMaybeLoadNext(idx);
}
```

```
// ClipEngine.pruneInlineSurfaces — pass direction through.
pruneInlineSurfaces(activeIdx, direction) {
  _poolRecycle(activeIdx, 'INLINE', direction);
}
```

```
// _poolRecycle — gate the ahead-bias behind the kill-switch, then pass to helper.
function _poolRecycle(activeIdx, host, direction) {
  ...
  var a = (activeIdx == null) ? (isInline ? _inlineActiveIdx : _ssvActiveIdx) : activeIdx;
  // Kill-switch (founder, on-device, no redeploy): flag off → drop the direction
  // so the band falls back to the original one-behind bias (F).
  var dir = (isInline && !_ssFeatureOff('aheadband')) ? direction : undefined;
  var band = ssMountedPlayerSet(a, clips.length, SS_MAX_LIVE_PLAYERS, dir);
  ...
}
```

- `_ssvPruneSurfaces(activeIdx)` keeps calling `_poolRecycle(activeIdx,
  'FULLSCREEN')` — `direction` is `undefined`, so FULLSCREEN behaviour is
  unchanged. (The fix is deliberately scoped to INLINE, where the bug occurs; if
  we later want it in FULLSCREEN we thread direction from `_ssvSetupObserver` the
  same way — called out for sign-off, not done here.)
- Direction derivation uses the existing module state (`_inlineActiveIdx`), so no
  new scroll listener is needed. (An alternative, tracking `lastScrollY`, is
  rejected: it adds a scroll listener and is noisier than the deterministic
  index comparison the observer already has in hand.)

#### 3. Preload fix — make the warm of `idx + 1` effective

`_inlineSetActive` already contains:
```
const nextSurface = _inlineSurfaces[idx + 1];
if (nextSurface && typeof nextSurface.preload === 'function') nextSurface.preload();
```
No code change is required here: once the ahead-band mounts `idx + 1`,
`_inlineSurfaces[idx + 1]` is a real surface and `preload()` fires. The
`_ssApplyPreloadTiers` ladder assigns distance-1 = `'metadata'`, which is
consistent with this warm. (If, after verification on-device, an explicit
`'metadata'` preload tier is preferred over the bare `preload()`, that is a
one-line follow-up — but it is not needed for the fix and is left intact to keep
the change minimal.)

### Kill-switch design

The fix follows the established `_ssFeatureOff` convention: a feature named
`<name>` is OFF when `localStorage['ss_ff_' + name] === 'off'`, and ON otherwise
(fail-soft: missing storage / any error → feature stays ON). The ahead-bias is
gated as `_ssFeatureOff('aheadband')` reading `ss_ff_aheadband`.

**Ship ON-by-default, with `ss_ff_aheadband = 'off'` as the on-device revert.**

Justification:
- This is a **bug fix**, not a speculative feature. The current behaviour is
  defective on the primary target (iOS PWA); shipping the fix OFF would leave the
  stutter in place for all users by default.
- It matches the convention of the sibling feed-clip-load-performance flags
  (`ss_ff_tiering`, `ss_ff_deepen`, `ss_ff_coldstart`), which default ON via
  `_ssFeatureOff` (off only when explicitly set to the string `'off'`). It
  deliberately does NOT follow the prefetch-cache-pipeline `SS_KILL_SWITCH_DEFAULTS`
  (all OFF), because those are additive speculative capabilities, not a fix.
- It **degrades safely**: with the flag off, `_poolRecycle` passes no direction,
  `F'` runs the original `F` algorithm, and the band reverts exactly to today's
  one-behind behaviour with no redeploy (bugfix.md 3.6).

This default is called out explicitly for founder sign-off. If the founder
prefers OFF-by-default (opt-in via `ss_ff_aheadband = 'on'`), the only change is
to read `_ssSegPrefetchOn`-style `=== 'on'` semantics instead of `_ssFeatureOff`;
the rest of the design is unchanged.

## Testing Strategy

### Validation Approach

Two phases: first surface counterexamples on the UNFIXED helper to confirm the
root cause, then verify the fix and prove preservation. Preservation is anchored
on the fact that the existing tests call the **3-arg** form, which `F'` must keep
byte-identical.

### Exploratory Bug Condition Checking

**Goal**: Confirm (or refute) that the original `F` omits the travel-direction
neighbour under the cap, demonstrating the bug before the fix.

**Test Plan**: Drive the 3-arg `ssMountedPlayerSet` with the observed inputs and
assert that the neighbour ahead is absent. Run on UNFIXED code to observe the
failure that the fix must close.

**Test Cases**:
1. **Down mid-feed**: `ssMountedPlayerSet(5, 20, 2)` returns `{4,5}` — does not
   contain `6` (will fail a "contains next" assertion on unfixed code).
2. **Down deeper**: `ssMountedPlayerSet(10, 50, 2)` returns `{9,10}` — does not
   contain `11`.
3. **Generalised cap**: `ssMountedPlayerSet(5, 20, 3)` returns `{4,5,6}` —
   contains `6` (shows the bug is specifically the cap-2 squeeze).
4. **Edge (end of feed)**: `ssMountedPlayerSet(19, 20, 2)` returns `{18,19}` — no
   neighbour ahead, correctly NOT a bug condition.

**Expected Counterexamples**: the band ahead is missing whenever `cap = 2` and the
active clip is not at the feed start — matching root cause #1.

### Fix Checking

**Goal**: For all inputs where the bug condition holds, `F'` pre-mounts the
travel-direction neighbour.

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  set  ← ssMountedPlayerSet(X.activeIdx, X.totalLoaded, X.maxLive, X.direction)   // F'
  next ← (X.direction = down) ? X.activeIdx + 1 : X.activeIdx - 1
  ASSERT contains(set, next)
  ASSERT contains(set, X.activeIdx)
  ASSERT set.length <= X.maxLive
END FOR
```

### Preservation Checking

**Goal**: For all inputs where the bug condition does NOT hold, and for every
direction-less call, `F'` equals `F`.

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT ssMountedPlayerSet(X.activeIdx, X.totalLoaded, X.maxLive /* no direction */)
       = referenceF(X.activeIdx, X.totalLoaded, X.maxLive)
END FOR
```

**Testing Approach**: Property-based testing with `fast-check` is used because it
generates many cases across the input domain (including out-of-range and
degenerate inputs) and catches edge cases manual tests miss. The new test embeds a
`referenceF` — a verbatim copy of the original one-behind algorithm — as the
preservation oracle, and asserts the no-direction `F'` matches it for every
generated input.

**Test Plan**: Keep the existing `tests/prop-mounted-set.test.js` and
`tests/pure-helpers.test.js` green (they call the 3-arg form and therefore ARE the
preservation check on the real call surface). Add a new direction-aware property
file.

**Test Cases**:
1. **3-arg unchanged**: existing `prop-mounted-set.test.js` continues to pass
   (bounded, contiguous, sorted, contains active) — proves no regression.
2. **Reference-F oracle**: new test asserts `F'(a, t, m)` (no direction) deep-
   equals `referenceF(a, t, m)` across the generated domain.
3. **FULLSCREEN parity**: `_poolRecycle(idx, 'FULLSCREEN')` passes no direction →
   covered by case 2 at the helper level.

### Unit Tests

- Down/up/start/end/degenerate worked examples from the F' table (explicit
  assertions in the new test file).
- Out-of-range and non-finite inputs return `[]` and never throw.
- Kill-switch logic: documented for the impure shell; the pure helper test proves
  that omitting direction reproduces `F`.

### Property-Based Tests

New file **`tests/prop-mounted-set-direction.test.js`** (auto-discovered by
`node tests/run-all.js`; `fast-check`; `_pbt.js` `installDomStub`; `{ numRuns:
ITER }`; dual-export require of `../showshak-shared.js`), implementing the three
properties from bugfix.md mapped to the Correctness Properties above:

- **Property 1 — Fix Checking**: generators over `activeIdx`, `totalLoaded`,
  `maxLive`, `direction`; filter to `isBugCondition`; assert `contains(next)`,
  `contains(activeIdx)`, `length ≤ maxLive`.
- **Property 2 — Invariants**: over ALL inputs (direction in `{'down','up',
  undefined, 'garbage'}`, indices including out-of-range): array, strictly sorted
  unique, all in `[0, totalLoaded)`, size ≤ `cap`, active included when in range,
  `[]` for degenerate, never throws.
- **Property 3 — Preservation**: over ALL inputs, `F'(a,t,m)` (no direction)
  deep-equals the embedded `referenceF(a,t,m)`.

The existing `tests/prop-mounted-set.test.js` (Property 6 of
clip-player-performance) and `tests/pure-helpers.test.js` stay unchanged and green
as the regression anchor.

### Integration Tests

- Inline observer flow: scrolling down derives `'down'`, `pruneInlineSurfaces`
  mounts `{ idx, idx + 1 }`, and `_inlineSetActive`'s `preload()` of `idx + 1`
  fires (manual on-device verification on the iOS PWA — the stall affordance no
  longer appears on forward scroll).
- Kill-switch flip: with `localStorage.ss_ff_aheadband = 'off'`, the band reverts
  to `{ idx - 1, idx }` and the pre-fix behaviour returns (no redeploy).
- FULLSCREEN unaffected: switching to the fullscreen viewer recycles through
  `_poolRecycle(idx, 'FULLSCREEN')` with no direction — band identical to today.

## SACRED-Constraint Compliance

- **`SS_MAX_LIVE_PLAYERS` stays 2**: `_poolRecycle` still calls the helper with
  `SS_MAX_LIVE_PLAYERS`; the fix changes only which 2 indices are chosen, never
  the cap. `set.length ≤ maxLive` is asserted by Property 1 and Property 2.
- **One-player behaviour, iOS + Android**: no platform branch added; the band
  change is platform-agnostic.
- **Recycled `<mux-player>` pool**: `_poolRecycle`'s re-point/reuse logic is
  untouched; it simply receives a differently-composed band.
- **No MP4 / CDN / player swap, no raw hls.js rewrite**: nothing in the media
  layer changes.
- **Pure helper stays total and dual-exported**: `ssMountedPlayerSet` keeps its
  totality guards and `window.* + module.exports` exports; the new 4th parameter
  is optional and defaults to the original behaviour.
- **Vanilla JS, no build step**: the change is plain functions and an optional
  parameter; `fast-check` remains a dev-only dependency, production code stays
  dependency-free and unbundled.
- **Out of scope untouched**: segment-byte prefetch / SW segment cache and the
  `setActive` debounce / observer threshold are not modified.
