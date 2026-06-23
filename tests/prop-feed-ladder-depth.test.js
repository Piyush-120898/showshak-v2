/* ═══════════════════════════════════════════════════════════════
   tests/prop-feed-ladder-depth.test.js — Node property test for the
   feed-clip-load-performance preload priority ladder depth discipline
   `ssPreloadTier(distance, networkTier, depthByTier)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-feed-ladder-depth.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE.

   TDD NOTE: `ssPreloadTier` does NOT exist yet — it is implemented in task 4.
   This file is authored FIRST and is EXPECTED TO FAIL ("not a function") until
   then; the failure is guarded into a clean assertion failure (not a crash).

   Semantics — fewer upcoming clips are prefetched on `slow` than on `fast`:
   the count of `metadata` positions on `slow` must be <= the count on `fast`,
   and no clip beyond the tier's Prefetch_Depth (or behind the active clip) is
   ever `metadata`. Prefetch_Depth comes from ssNetworkPolicy(tier).preloadDepth
   (documented slow 1, fast 2) used as the oracle.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// Depth oracle: prefer ssNetworkPolicy(tier).preloadDepth, else documented defaults.
function depthFor(tier) {
  try {
    const pol = ss.ssNetworkPolicy(tier);
    if (pol && Number.isFinite(pol.preloadDepth)) return pol.preloadDepth;
  } catch (_) { /* fall through */ }
  return tier === 'slow' ? 1 : 2;
}

let failed = 0;

console.log('Feature: feed-clip-load-performance — preload-ladder depth monotonicity property test\n');

// Feature: feed-clip-load-performance, Property 2: Preload-ladder depth monotonicity
// **Validates: Requirements 1.3, 1.5**
try {
  // Guard: the function must exist (red until task 4 implements it).
  assert(typeof ss.ssPreloadTier === 'function',
    'ssPreloadTier is not implemented yet (expected until task 4)');

  const slowDepth = depthFor('slow');
  const fastDepth = depthFor('fast');

  // A generated set of distances spanning behind, active, and ahead of the active clip.
  const distancesGen = fc.array(fc.integer({ min: -6, max: 8 }), { minLength: 1, maxLength: 40 });

  fc.assert(fc.property(distancesGen, (distances) => {
    let slowMeta = 0;
    let fastMeta = 0;

    for (const d of distances) {
      const slowTier = ss.ssPreloadTier(d, 'slow');
      const fastTier = ss.ssPreloadTier(d, 'fast');

      if (slowTier === 'metadata') {
        slowMeta++;
        // No clip beyond the tier depth or behind the active clip may be metadata.
        assert(d >= 1 && d <= slowDepth,
          `slow: distance ${d} is 'metadata' but outside [1, ${slowDepth}]`);
      }
      if (fastTier === 'metadata') {
        fastMeta++;
        assert(d >= 1 && d <= fastDepth,
          `fast: distance ${d} is 'metadata' but outside [1, ${fastDepth}]`);
      }
    }

    // Monotonicity: slow prefetches no more upcoming clips than fast.
    assert(slowMeta <= fastMeta,
      `metadata count must be non-decreasing slow->fast: slow=${slowMeta} fast=${fastMeta} for ${JSON.stringify(distances)}`);

    return true;
  }), { numRuns: ITER });

  // ── Explicit example assertions (full window of distances 0..6) ──
  const window = [-2, -1, 0, 1, 2, 3, 4, 5, 6];
  const countMeta = (tier) => window.filter((d) => ss.ssPreloadTier(d, tier) === 'metadata').length;
  const slowCount = countMeta('slow');
  const fastCount = countMeta('fast');
  assert(slowCount <= fastCount, `slow metadata (${slowCount}) must be <= fast metadata (${fastCount})`);
  assert(ss.ssPreloadTier(slowDepth + 1, 'slow') !== 'metadata', "slow: distance beyond depth is not metadata");
  assert(ss.ssPreloadTier(fastDepth + 1, 'fast') !== 'metadata', "fast: distance beyond depth is not metadata");
  assert(ss.ssPreloadTier(-1, 'fast') !== 'metadata', "behind active is never metadata");

  console.log('  \u2713 Property 2');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 2\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
