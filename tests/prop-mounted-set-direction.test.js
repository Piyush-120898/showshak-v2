/* ═══════════════════════════════════════════════════════════════
   tests/prop-mounted-set-direction.test.js — Node property test for the
   feed-scroll-stutter-fix bug condition: the mounted band must be
   DIRECTION-AWARE so the next clip in the travel direction is pre-mounted
   and buffering before the user arrives (no iOS cold-start stall).

   Plain Node (no framework) + fast-check; run with:
     node tests/prop-mounted-set-direction.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper is PURE, so the stub
   never affects behaviour.

   ── BUG-CONDITION EXPLORATION TEST (authored BEFORE the fix) ──
   This test encodes the EXPECTED (fixed) behaviour the direction-aware helper
   `F'` will deliver. It is EXPECTED TO FAIL on the current unfixed 3-arg helper
   `F` — that failure CONFIRMS the bug exists. The helper is called WITH a 4th
   `direction` argument; on unfixed code that argument is ignored (returns the
   one-behind band `{activeIdx-1, activeIdx}`), so the "next is present"
   assertion FAILS now. After the fix lands the same call returns
   `{activeIdx, activeIdx+1}` and this SAME test (re-run unchanged in Task 3.3)
   PASSES.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: feed-scroll-stutter-fix — direction-aware pre-mount (bug condition)\n');

// Feature: feed-scroll-stutter-fix, Property 1: Bug Condition - direction-aware pre-mount
// **Validates: Requirements 2.1**
try {
  // Down-scroll counterexample family: mid-feed activeIdx in ~2..(total-2),
  // cap = 2, totalLoaded = 20 (constrained band → the squeeze that drops the
  // next clip on unfixed code). Generalise over mid-feed activeIdx.
  const TOTAL = 20;
  const CAP = 2;
  const activeGen = fc.integer({ min: 2, max: TOTAL - 2 });

  fc.assert(fc.property(activeGen, (activeIdx) => {
    // Drive the helper as a DOWN scroll. On the fixed direction-aware helper the
    // band biases ahead so the next clip (activeIdx + 1) is pre-mounted.
    const set = ss.ssMountedPlayerSet(activeIdx, TOTAL, CAP, 'down');
    assert(Array.isArray(set), 'must return an array');

    // Core fix-checking assertion: the travel-direction neighbour (next) for a
    // DOWN scroll IS present. On unfixed F this is {activeIdx-1, activeIdx} → FAILS.
    assert(set.includes(activeIdx + 1),
      `down-scroll band must pre-mount next clip ${activeIdx + 1}: ` +
      `ssMountedPlayerSet(${activeIdx},${TOTAL},${CAP},'down') returned ${JSON.stringify(set)}`);

    // The active clip must remain mounted, and the cap must be respected.
    assert(set.includes(activeIdx),
      `band must contain activeIdx ${activeIdx}: ${JSON.stringify(set)}`);
    assert(set.length <= CAP,
      `band too large: ${set.length} > cap ${CAP} (${JSON.stringify(set)})`);

    return true;
  }), { numRuns: ITER });

  // ── Explicit design counterexamples (concrete checks) ──
  // (5,20,2,down): unfixed F returns [4,5] (missing 6); fix → [5,6].
  const ex1 = ss.ssMountedPlayerSet(5, 20, 2, 'down');
  assert(ex1.includes(6),
    `ssMountedPlayerSet(5,20,2,'down') returned ${JSON.stringify(ex1)}; expected to include 6 ` +
    `— next clip cold-starts and stalls on iOS`);

  // (10,50,2,down): unfixed F returns [9,10] (missing 11); fix → [10,11].
  const ex2 = ss.ssMountedPlayerSet(10, 50, 2, 'down');
  assert(ex2.includes(11),
    `ssMountedPlayerSet(10,50,2,'down') returned ${JSON.stringify(ex2)}; expected to include 11 ` +
    `— next clip cold-starts and stalls on iOS`);

  // Contrast (cap-3 squeeze isolation): (5,20,3) → [4,5,6] already contains 6,
  // so this PASSES even on unfixed code — proving the bug is specifically the
  // cap-2 squeeze, not the band logic in general.
  const ex3 = ss.ssMountedPlayerSet(5, 20, 3);
  assert(ex3.includes(6),
    `ssMountedPlayerSet(5,20,3) returned ${JSON.stringify(ex3)}; expected to include 6 ` +
    `(cap-3 band already reaches ahead — isolates the cap-2 squeeze)`);

  console.log('  \u2713 Property 1');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 1\n      ' + e.message);
}

/* ──────────────────────────────────────────────────────────────
   referenceF — VERBATIM copy of the CURRENT one-behind algorithm in
   showshak-shared.js (the original 3-arg `ssMountedPlayerSet`, a.k.a. `F`).
   This is the PRESERVATION ORACLE: the fixed direction-aware `F'`, when called
   WITHOUT a recognised direction, must return byte-identical results to this.
   SS_MAX_LIVE_PLAYERS is 2 in production; mirror the fallback here so the oracle
   is faithful even when maxLive is invalid (the generators below keep maxLive
   >= 1, but the fallback keeps the copy exact).
────────────────────────────────────────────────────────────── */
const SS_MAX_LIVE_PLAYERS = 2;
function referenceF(activeIdx, totalLoaded, maxLive) {
  var cap = (maxLive && maxLive > 0) ? maxLive : SS_MAX_LIVE_PLAYERS;
  if (!totalLoaded || totalLoaded <= 0 || activeIdx < 0 || activeIdx >= totalLoaded) return [];
  var band = Math.min(cap, totalLoaded);
  var start = activeIdx - 1;                      // bias one behind the active clip
  if (start + band > totalLoaded) start = totalLoaded - band;  // fit against the end
  if (start < 0) start = 0;
  // Guarantee the active clip is inside [start, start+band) so it stays mounted.
  if (activeIdx < start) start = activeIdx;
  else if (activeIdx >= start + band) start = activeIdx - band + 1;
  if (start < 0) start = 0;
  var set = [];
  for (var i = start; i < totalLoaded && set.length < band; i++) set.push(i);
  return set;
}

// Feature: feed-scroll-stutter-fix, Property 3: Preservation - direction-less band byte-identical to original F
// **Validates: Requirements 3.1, 3.5, 3.6, 3.7**
try {
  // Over ALL inputs (incl. out-of-range / degenerate), the no-direction 3-arg
  // call must deep-equal the embedded original algorithm `referenceF`. On unfixed
  // code this is trivially true (the 3-arg path IS referenceF); after the fix the
  // no-direction branch must remain byte-identical, preserving every existing
  // caller, the FULLSCREEN host, the 2-player cap, and the kill-switch revert.
  fc.assert(fc.property(
    fc.integer({ min: -5, max: 60 }),   // activeIdx (incl. out-of-range)
    fc.integer({ min: 0, max: 60 }),    // totalLoaded (incl. 0 / degenerate)
    fc.integer({ min: 1, max: 10 }),    // maxLive
    (activeIdx, totalLoaded, maxLive) => {
      const actual = ss.ssMountedPlayerSet(activeIdx, totalLoaded, maxLive); // NO direction arg
      const expected = referenceF(activeIdx, totalLoaded, maxLive);
      assert(JSON.stringify(actual) === JSON.stringify(expected),
        `no-direction ssMountedPlayerSet(${activeIdx},${totalLoaded},${maxLive}) ` +
        `returned ${JSON.stringify(actual)}; referenceF expected ${JSON.stringify(expected)}`);
      return true;
    }), { numRuns: ITER });

  // ── Concrete recorded baselines (observed on the unfixed helper) ──
  assert(JSON.stringify(ss.ssMountedPlayerSet(5, 20, 2)) === JSON.stringify([4, 5]),
    `baseline ssMountedPlayerSet(5,20,2) expected [4,5], got ${JSON.stringify(ss.ssMountedPlayerSet(5, 20, 2))}`);
  assert(JSON.stringify(ss.ssMountedPlayerSet(0, 20, 2)) === JSON.stringify([0, 1]),
    `baseline ssMountedPlayerSet(0,20,2) expected [0,1], got ${JSON.stringify(ss.ssMountedPlayerSet(0, 20, 2))}`);
  assert(JSON.stringify(ss.ssMountedPlayerSet(19, 20, 2)) === JSON.stringify([18, 19]),
    `baseline ssMountedPlayerSet(19,20,2) expected [18,19], got ${JSON.stringify(ss.ssMountedPlayerSet(19, 20, 2))}`);
  assert(JSON.stringify(ss.ssMountedPlayerSet(1, 2, 2)) === JSON.stringify([0, 1]),
    `baseline ssMountedPlayerSet(1,2,2) expected [0,1], got ${JSON.stringify(ss.ssMountedPlayerSet(1, 2, 2))}`);

  console.log('  \u2713 Property 3 (Preservation)');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 3 (Preservation)\n      ' + e.message);
}

// Feature: feed-scroll-stutter-fix, Property 2: Invariants - totality, bounds, ordering (hold for ALL inputs)
// **Validates: Requirements 2.6, 2.7, 3.2, 3.3, 3.4**
try {
  // Over ALL inputs, including every direction value (recognised, absent, garbage),
  // the helper must: never throw; return an array; be strictly sorted ascending with
  // unique entries; keep every index in [0, totalLoaded); have length <= cap; include
  // activeIdx when activeIdx in [0, totalLoaded) and totalLoaded > 0; and return [] for
  // out-of-range / degenerate inputs. (The 4th-arg fix is not implemented yet, so
  // 'down'/'up' are ignored today and return F — the invariants still hold.)
  const dirGen = fc.constantFrom('down', 'up', undefined, 'garbage');
  fc.assert(fc.property(
    fc.integer({ min: -5, max: 60 }),   // activeIdx (incl. out-of-range)
    fc.integer({ min: 0, max: 60 }),    // totalLoaded (incl. 0 / degenerate)
    fc.integer({ min: 1, max: 10 }),    // maxLive
    dirGen,
    (activeIdx, totalLoaded, maxLive, direction) => {
      const cap = (maxLive && maxLive > 0) ? maxLive : SS_MAX_LIVE_PLAYERS;
      let set;
      try {
        set = ss.ssMountedPlayerSet(activeIdx, totalLoaded, maxLive, direction);
      } catch (err) {
        assert(false, `threw on (${activeIdx},${totalLoaded},${maxLive},${String(direction)}): ${err && err.message}`);
      }
      assert(Array.isArray(set), 'must return an array');

      const inRangeActive = (activeIdx >= 0 && activeIdx < totalLoaded && totalLoaded > 0);
      if (!inRangeActive) {
        assert(set.length === 0,
          `degenerate/out-of-range (${activeIdx},${totalLoaded}) must be [], got ${JSON.stringify(set)}`);
        return true;
      }

      // Non-empty: bounds, strict-ascending uniqueness, cap, active membership.
      assert(set.length <= cap,
        `length ${set.length} > cap ${cap} (${JSON.stringify(set)})`);
      for (let i = 0; i < set.length; i++) {
        assert(set[i] >= 0 && set[i] < totalLoaded,
          `index ${set[i]} out of [0,${totalLoaded}) in ${JSON.stringify(set)}`);
        if (i > 0) assert(set[i] > set[i - 1],
          `not strictly sorted ascending/unique: ${JSON.stringify(set)}`);
      }
      assert(set.includes(activeIdx),
        `must include activeIdx ${activeIdx}: ${JSON.stringify(set)}`);
      return true;
    }), { numRuns: ITER });

  console.log('  \u2713 Property 2 (Invariants)');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 2 (Invariants)\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
