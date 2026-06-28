# Implementation Plan

## Overview

Direction-aware band-bias fix for the pure helper `ssMountedPlayerSet` in
`showshak-shared.js`, plus the inline-observer wiring that threads a scroll-
direction signal into it. The fix ships **ON by default** with `localStorage
ss_ff_aheadband = 'off'` as the on-device revert (via `_ssFeatureOff('aheadband')`).

Methodology (bug condition):
- **C(X)** — `isBugCondition`: under a constrained band (`totalLoaded > maxLive`),
  the original band `F` omits the in-range neighbour in the travel direction
  (`next = down ? activeIdx+1 : activeIdx-1`), so that clip cold-starts on arrival.
- **F** — original 3-arg `ssMountedPlayerSet` (biases one behind).
- **F'** — fixed 4-arg direction-aware helper; byte-identical to `F` when
  `direction` is absent/unrecognised.

TDD-leaning ordering: the bug-condition exploration test is authored FIRST (Task 1)
and is EXPECTED TO FAIL on the unfixed 3-arg helper, confirming the root cause,
before any production code changes.

## Tasks

- [x] 1. Write the bug-condition EXPLORATION property test (BEFORE the fix)
  - **Property 1: Bug Condition** - Direction-aware pre-mount (down-scroll cold-start)
  - **CRITICAL**: This test MUST FAIL on the unfixed code — failure CONFIRMS the bug exists. Do NOT fix the test or the helper when it fails.
  - **DO NOT attempt to fix the code in this task** — only author, run, and document the failure.
  - **GOAL**: Surface counterexamples proving the current 3-arg `ssMountedPlayerSet` omits the travel-direction neighbour under `cap = 2`.
  - Create `tests/prop-mounted-set-direction.test.js` following project conventions: `require('./_pbt.js')`, call `installDomStub()` BEFORE `require('../showshak-shared.js')`, `fast-check`, run with `{ numRuns: ITER }`, plain-Node runner that `process.exit(1)` on failure, tagged `// Feature: feed-scroll-stutter-fix, Property 1` + `// **Validates: Requirements 2.1**`.
  - **Scoped PBT approach** (deterministic bug): scope the property to the concrete down-scroll counterexample family — `activeIdx = 5`, `totalLoaded = 20`, `maxLive = 2`, `direction = down` (and generalise over a small range of mid-feed `activeIdx` with `cap = 2`).
  - Drive the CURRENT 3-arg helper `ss.ssMountedPlayerSet(5, 20, 2)` and assert the travel-direction neighbour IS present: `assert(set.includes(6))` (the `next = activeIdx + 1` for `down`). On unfixed code `F` returns `{4,5}`, so this assertion FAILS.
  - Include the explicit counterexamples from the design's exploratory plan: `ssMountedPlayerSet(5,20,2) → {4,5}` (missing 6), `ssMountedPlayerSet(10,50,2) → {9,10}` (missing 11), and the contrast `ssMountedPlayerSet(5,20,3) → {4,5,6}` (cap-3 already contains 6, isolating the cap-2 squeeze).
  - Run `node tests/prop-mounted-set-direction.test.js` on UNFIXED code.
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug). Mark failure = bug confirmed.
  - Document the counterexamples found (e.g., "ssMountedPlayerSet(5,20,2) returned [4,5]; expected to contain 6 — next clip cold-starts and stalls on iOS").
  - Mark this task complete when the test is written, run, and the failure is documented.
  - _Requirements: 1.1, 1.4, 2.1_

- [x] 2. Write preservation property tests (BEFORE the fix)
  - **Property 2: Preservation** - 3-arg / direction-less band byte-identical to original F
  - **IMPORTANT**: Follow the observation-first methodology — record the UNFIXED helper's outputs for non-buggy / direction-less inputs, then assert them across the domain.
  - The existing `tests/prop-mounted-set.test.js` and `tests/pure-helpers.test.js` already exercise the 3-arg form and ARE the preservation check on the real call surface — confirm they are GREEN on unfixed code by running `node tests/run-all.js` and record the baseline.
  - In `tests/prop-mounted-set-direction.test.js`, add the preservation property: embed `referenceF(activeIdx, totalLoaded, maxLive)` — a VERBATIM copy of the current one-behind algorithm (`start = activeIdx - 1`, clamp, fill) — as the oracle. Tag `// Feature: feed-scroll-stutter-fix, Property 3` (Preservation) + `// **Validates: Requirements 3.1, 3.5, 3.6, 3.7**`.
  - Property-based generators over ALL inputs (`activeIdx` including out-of-range `-5..60`, `totalLoaded 0..60`, `maxLive 1..10`); assert `ss.ssMountedPlayerSet(a, t, m)` (no direction) deep-equals `referenceF(a, t, m)`.
  - Observe and record concrete baselines on UNFIXED code, e.g. `ssMountedPlayerSet(5,20,2) === [4,5]`, `ssMountedPlayerSet(0,20,2) === [0,1]`, `ssMountedPlayerSet(19,20,2) === [18,19]`, `ssMountedPlayerSet(1,2,2) === [0,1]`.
  - Run the preservation property on UNFIXED code (no-direction call surface).
  - **EXPECTED OUTCOME**: Preservation property PASSES on unfixed code (the no-direction path trivially equals `referenceF` today; this fixes the baseline the fix must keep). The new Property 1 from task 1 still FAILS.
  - Mark complete when preservation tests are written, run, and passing on unfixed code, and the existing two suites are confirmed green.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Direction-aware band-bias fix for the inline feed cold-start

  - [x] 3.1 Implement the direction-aware `F'` in `ssMountedPlayerSet`
    - In `showshak-shared.js`, add an OPTIONAL 4th parameter `direction` to `ssMountedPlayerSet(activeIdx, totalLoaded, maxLive, direction)`.
    - Keep the totality guard, `cap`, `band`, the shared clamp block, and the fill loop IDENTICAL to the current implementation.
    - Only the initial `start` choice becomes direction-aware: when `direction !== 'down' && direction !== 'up'`, compute `start = activeIdx - 1` EXACTLY as today (byte-identical to `F`); else compute `neighbours = band - 1`, `behind = (direction === 'down') ? Math.floor(neighbours/2) : Math.ceil(neighbours/2)`, `start = activeIdx - behind`. (Down → ahead-heavy so `next = activeIdx + 1` is mounted; up → behind-heavy.)
    - Keep the helper PURE, TOTAL (never throws on `null`/`undefined`/negative/non-finite/zero inputs), and DUAL-EXPORTED on `window.*` + `module.exports`.
    - Verify the worked table under `cap = 2`: `(5,20,down)→{5,6}`, `(5,20,up)→{4,5}`, `(5,20,none)→{4,5}`, `(0,20,*)→{0,1}`, `(19,20,down)→{18,19}`, `(1,2,*)→{0,1}`.
    - _Bug_Condition: isBugCondition(X) — band omits `next = (direction=down)?activeIdx+1:activeIdx-1` under cap (design Bug Condition)_
    - _Expected_Behavior: F'(X) contains `next` and `activeIdx`, size ≤ maxLive (design Property 1)_
    - _Preservation: direction-less / non-buggy calls equal referenceF; cap stays 2; totality + dual-export preserved (design Property 3)_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Wire the scroll-direction signal through the impure inline shell
    - In `_inlineSetupObserver`, derive direction BEFORE pruning (pruneInlineSurfaces runs before setActive, so `_inlineActiveIdx` still holds the previous active): `dir = (idx > _inlineActiveIdx) ? 'down' : (idx < _inlineActiveIdx) ? 'up' : undefined`. Pass it to `pruneInlineSurfaces(idx, dir)`.
    - Thread `direction` through `pruneInlineSurfaces(activeIdx, direction) → _poolRecycle(activeIdx, 'INLINE', direction) → ssMountedPlayerSet(a, clips.length, SS_MAX_LIVE_PLAYERS, dir)`.
    - Gate the ahead-bias behind the on-device kill-switch in `_poolRecycle`: `var dir = (isInline && !_ssFeatureOff('aheadband')) ? direction : undefined;` — ON by default; `ss_ff_aheadband='off'` reverts to the original one-behind band (F) with no redeploy.
    - FULLSCREEN is unaffected: `_ssvPruneSurfaces` keeps calling `_poolRecycle(activeIdx, 'FULLSCREEN')` with NO direction.
    - Leave the `_inlineSetActive` "preload next" line (`_inlineSurfaces[idx + 1].preload()`) UNCHANGED — it becomes effective automatically once the ahead-band mounts `idx + 1`.
    - _Bug_Condition: no direction signal threaded to the helper (design root cause #4); dead preload under cap=2 (1.3)_
    - _Expected_Behavior: down-scroll mounts `{idx, idx+1}` so `play()` does not cold-start (2.2); preload of `idx+1` fires_
    - _Preservation: FULLSCREEN + 3-arg callers pass no direction → unchanged; kill-switch reverts to F (3.5, 3.6, 3.7)_
    - _Requirements: 1.2, 1.3, 2.1, 2.2, 3.5, 3.6_

  - [x] 3.3 Verify the bug-condition exploration test now passes
    - **Property 1: Expected Behavior** - Direction-aware pre-mount
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test. It encodes the expected behaviour; passing confirms the fix.
    - Run `node tests/prop-mounted-set-direction.test.js`.
    - **EXPECTED OUTCOME**: Property 1 (Fix Checking) PASSES — for all `isBugCondition(X)` the band now contains `next` and `activeIdx` with size ≤ `maxLive`; the down-scroll counterexample `(5,20,2,down)` returns `{5,6}`.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7_

  - [x] 3.4 Verify preservation + invariant tests still pass
    - **Property 2: Preservation** - 3-arg / direction-less band unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests.
    - Run the new direction test's Preservation + Invariants properties, plus the existing `tests/prop-mounted-set.test.js` and `tests/pure-helpers.test.js`.
    - **EXPECTED OUTCOME**: All PASS — no-direction `F'` deep-equals `referenceF`, invariants hold for all inputs (sorted-unique, in-range, size ≤ cap, active included, `[]` for degenerate, never throws), and the cap stays 2 (no regressions).
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7_

- [x] 4. Checkpoint — full suite green + diagnostics clean
  - Run `node tests/run-all.js` and confirm ALL suites pass (the new `prop-mounted-set-direction.test.js`, the existing `prop-mounted-set.test.js`, `pure-helpers.test.js`, and the rest of the player/feed suite — no regressions).
  - Run `get_diagnostics` on `showshak-shared.js` and confirm no new compile/lint/type issues.
  - Confirm the kill-switch revert path at the helper level: with the flag off, `_poolRecycle` passes no direction and the band reverts exactly to `referenceF` (F) behaviour.
  - Ask the user if any questions arise.

- [~] 5. FOUNDER on-device verification (real installed iOS PWA — NOT a coding task)
  - This task is reserved for the founder; it is manual device verification and requires no code changes.
  - Scroll DOWN through the inline feed: confirm the next clip is pre-mounted and buffering — no first-frame stall and no pause/tap affordance on forward scroll.
  - Flip `localStorage.setItem('ss_ff_aheadband', 'off')` and reload: confirm the stutter RETURNS (proves the on-device revert to the original one-behind band works without a redeploy).
  - Switch to FULLSCREEN: confirm behaviour is unchanged from before the fix.
  - _Requirements: 2.2, 3.6_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3.1"] },
    { "id": 2, "tasks": ["3.2"] },
    { "id": 3, "tasks": ["3.3", "3.4"] },
    { "id": 4, "tasks": ["4"] }
  ]
}
```

- Wave 0: tasks 1 and 2 are independent and both run on UNFIXED code first
  (exploration test FAILS; preservation tests PASS).
- Wave 1 → 2: 3.1 (helper `F'`) precedes 3.2 (its inline-shell wiring).
- Wave 3: 3.3 and 3.4 depend on 3.2 and re-run the SAME tests from tasks 1 and 2.
- Wave 4: the checkpoint (task 4) depends on 3.3 + 3.4.
- Task 5 (FOUNDER on-device verification) is a manual, non-coding task and is
  intentionally excluded from the wave graph; it follows task 4.

## Notes

- **Single source of truth**: `bugfix.md` (requirements) and `design.md`
  (Properties 1–3, F' algorithm, kill-switch design) in this spec directory.
- **Decision locked**: ship ON by default; `ss_ff_aheadband = 'off'` is the
  on-device revert via `_ssFeatureOff('aheadband')`. No OFF-by-default variant.
- **SACRED constraints**: `SS_MAX_LIVE_PLAYERS` stays `2`; one-player iOS+Android
  behaviour; recycled `<mux-player>` pool; no MP4/CDN/player swap; no hls.js
  rewrite; vanilla JS, no build step; `fast-check` is a dev-only dependency.
- **Test harness**: pure helpers are dual-exported on `window.*` +
  `module.exports`; new property file uses `tests/_pbt.js` `installDomStub`
  with `{ numRuns: ITER }`, auto-discovered by `node tests/run-all.js`.
- **Property → hover-status mapping**: Property 1 = Bug Condition / Expected
  Behavior (Fix Checking); Property 2 = Preservation. The design's Property 2
  (Invariants) is verified within the new test file alongside Property 3.
