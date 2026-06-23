/* ═══════════════════════════════════════════════════════════════
   tests/prop-feed-ladder-totality.test.js — Node property test for the
   feed-clip-load-performance preload priority ladder
   `ssPreloadTier(distance, networkTier, depthByTier)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-feed-ladder-totality.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (distance + tier in, a tier string out), so the stub never affects behaviour.

   TDD NOTE: `ssPreloadTier` does NOT exist yet — it is implemented in task 4.
   This file is authored FIRST and is EXPECTED TO FAIL ("not a function") until
   then; the failure is guarded into a clean assertion failure (not a crash).

   Semantics — the active clip is the ONLY clip ever `auto`:
     - distance === 0                         → 'auto'
     - 1 <= distance <= depthByTier[tier]      → 'metadata'
     - everything else (distance < 0, distance > depth,
       or non-finite / garbage)               → 'none'
   depthByTier defaults from ssNetworkPolicy(tier).preloadDepth
   (slow 1, medium 2, fast 2; unknown tier → medium). Total, deterministic,
   never throws.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// Safe stringifier: fast-check's fc.object() can produce objects whose toString
// is a non-function, so a bare String(v) can throw while building a diagnostic.
function show(v) {
  try {
    if (v !== null && typeof v === 'object') return JSON.stringify(v);
    return String(v);
  } catch (_) { return Object.prototype.toString.call(v); }
}

let failed = 0;
const TIERS_VALUES = ['auto', 'metadata', 'none'];

console.log('Feature: feed-clip-load-performance — preload-ladder totality + single-auto property test\n');

// Feature: feed-clip-load-performance, Property 1: Preload-ladder totality + single-auto
// **Validates: Requirements 1.1, 1.6**
try {
  // Guard: the function must exist (red until task 4 implements it).
  assert(typeof ss.ssPreloadTier === 'function',
    'ssPreloadTier is not implemented yet (expected until task 4)');

  // distance: ints incl. negative, plus non-finite / garbage values.
  const distanceGen = fc.oneof(
    fc.integer({ min: -10, max: 10 }),
    fc.integer(),
    fc.constantFrom(NaN, Infinity, -Infinity, undefined, null, '0', '1', 'x', 1.5, -0.5),
    fc.string(),
    fc.object()
  );
  const tierGen = fc.constantFrom('slow', 'medium', 'fast', undefined, 'garbage');

  fc.assert(fc.property(distanceGen, tierGen, (distance, tier) => {
    const result = ss.ssPreloadTier(distance, tier);

    // Totality: result is always exactly one of the three values, never throws.
    assert(TIERS_VALUES.indexOf(result) !== -1,
      `result must be one of ${TIERS_VALUES}: got ${show(result)} for (${show(distance)}, ${show(tier)})`);

    // Single-auto: result === 'auto' IFF distance is exactly the number 0.
    const isActive = distance === 0;
    if (isActive) {
      assert(result === 'auto',
        `distance 0 must be 'auto': got ${show(result)} for tier ${show(tier)}`);
    } else {
      assert(result !== 'auto',
        `only distance 0 may be 'auto': got 'auto' for (${show(distance)}, ${show(tier)})`);
    }

    // Determinism: identical inputs → identical output.
    const again = ss.ssPreloadTier(distance, tier);
    assert(again === result,
      `non-deterministic output for (${show(distance)}, ${show(tier)}): ${show(result)} vs ${show(again)}`);

    return true;
  }), { numRuns: ITER });

  // ── Explicit example assertions ──
  assert(ss.ssPreloadTier(0, 'medium') === 'auto', "distance 0 → auto");
  assert(ss.ssPreloadTier(0, 'slow') === 'auto', "distance 0 (slow) → auto");
  assert(ss.ssPreloadTier(1, 'medium') === 'metadata', "distance 1 medium → metadata");
  assert(ss.ssPreloadTier(5, 'medium') === 'none', "distance 5 → none (beyond depth)");
  assert(ss.ssPreloadTier(-1, 'fast') === 'none', "negative distance → none");
  assert(ss.ssPreloadTier(NaN, 'medium') === 'none', "NaN distance → none");

  console.log('  \u2713 Property 1');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 1\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
