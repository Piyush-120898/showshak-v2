/* ═══════════════════════════════════════════════════════════════
   tests/prop-mounted-set.test.js — Node property test for the
   clip-player-performance Mounted_Band helper
   `ssMountedPlayerSet(activeIdx, totalLoaded, maxLive)` in showshak-shared.js.
   (Re-anchored to this feature; the helper itself already existed.)
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-mounted-set.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper is PURE (three numbers
   in, a sorted index array out), so the stub never affects behaviour.

   Semantics: a bounded, contiguous sliding band of clip indices around the
   active clip (size ≤ min(maxLive, totalLoaded)), always containing the active
   index when it is in range; empty for out-of-range/empty inputs.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: clip-player-performance — mounted band property test\n');

// Feature: clip-player-performance, Property 6: Mounted band is bounded, contiguous, and contains the active clip
// **Validates: Requirements 2.8**
try {
  const numGen = fc.integer({ min: -5, max: 60 });      // includes out-of-range
  const totalGen = fc.integer({ min: 0, max: 60 });
  const maxGen = fc.integer({ min: 1, max: 10 });

  fc.assert(fc.property(numGen, totalGen, maxGen, (activeIdx, totalLoaded, maxLive) => {
    const set = ss.ssMountedPlayerSet(activeIdx, totalLoaded, maxLive);
    assert(Array.isArray(set), 'must return an array');

    const inRange = (totalLoaded > 0 && activeIdx >= 0 && activeIdx < totalLoaded);
    if (!inRange) {
      assert(set.length === 0, `out-of-range/empty must give []: got ${JSON.stringify(set)}`);
      return true;
    }

    // Bounded by min(maxLive, totalLoaded).
    assert(set.length <= Math.min(maxLive, totalLoaded),
      `band too large: ${set.length} > min(${maxLive},${totalLoaded})`);
    assert(set.length >= 1, 'in-range band must be non-empty');

    // All indices valid and in range.
    for (const i of set) {
      assert(Number.isInteger(i) && i >= 0 && i < totalLoaded,
        `index out of range: ${i} (total ${totalLoaded})`);
    }

    // Sorted ascending.
    for (let k = 1; k < set.length; k++) {
      assert(set[k] > set[k - 1], `not strictly sorted: ${JSON.stringify(set)}`);
    }

    // Contiguous (no gaps).
    for (let k = 1; k < set.length; k++) {
      assert(set[k] === set[k - 1] + 1, `not contiguous: ${JSON.stringify(set)}`);
    }

    // Contains the active clip.
    assert(set.includes(activeIdx), `band must contain activeIdx ${activeIdx}: ${JSON.stringify(set)}`);

    return true;
  }), { numRuns: ITER });

  // ── Explicit examples ──
  assert(ss.ssMountedPlayerSet(0, 0, 4).length === 0, 'empty total → []');
  assert(ss.ssMountedPlayerSet(-1, 10, 4).length === 0, 'negative active → []');
  assert(ss.ssMountedPlayerSet(10, 10, 4).length === 0, 'active == total → []');
  const mid = ss.ssMountedPlayerSet(5, 20, 4);
  assert(mid.length === 4 && mid.includes(5), `mid band size 4 incl 5: ${JSON.stringify(mid)}`);

  console.log('  \u2713 Property 6');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 6\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
