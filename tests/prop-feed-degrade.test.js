/* ═══════════════════════════════════════════════════════════════
   tests/prop-feed-degrade.test.js — Node property test for the
   feed-clip-load-performance graceful-degradation-at-minimal-scale guarantee
   across the pure decision core (`ssPreloadTier`, `ssShouldDeepen` if present,
   `ssSegmentEvictionPlan`) in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-feed-degrade.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helpers under test are PURE.

   TDD NOTE: `ssSegmentEvictionPlan` does NOT exist yet — it is implemented in
   task 21, so this file is authored FIRST (Phase 4, task 20.3) and is EXPECTED
   TO FAIL until then. `ssPreloadTier` already exists (task 4); `ssShouldDeepen`
   lands in task 10 and is guarded with a typeof check so its assertions only run
   once it exists. Each missing-function failure is guarded into a clean assertion
   failure (not a crash).

   Property — the ladder / eviction / deepening decisions clamp to the clips that
   actually exist:
     • 1 clip (active only, 0 others)  → no NON-ACTIVE position is metadata/auto.
     • exactly 2 clips (distance 1 exists) → distance 1 resolves to `metadata`
       on a tier whose Prefetch_Depth >= 1 (all tiers qualify).
     • eviction with <= window clips (all clipDistances inside the window) evicts
       nothing for being out-of-window.
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
const TIERS = ['slow', 'medium', 'fast'];

console.log('Feature: feed-clip-load-performance — graceful degradation at minimal scale property test\n');

// Feature: feed-clip-load-performance, Property 8: Graceful degradation at minimal scale
// **Validates: Requirements 9.1, 9.2, 9.3**
try {
  assert(typeof ss.ssPreloadTier === 'function',
    'ssPreloadTier is not implemented yet (expected by task 4)');

  // ── (a) 1-clip feed: only the active clip exists; no non-active prefetch. ──
  // Model a feed of N clips with active index `a`; distance = i - a. For a 1-clip
  // feed (N=1) only the active position exists and must be 'auto'; there is no
  // non-active position that could be 'metadata'/'auto'.
  fc.assert(fc.property(fc.constantFrom(...TIERS), (tier) => {
    const N = 1;
    const a = 0;
    let autoCount = 0;
    for (let i = 0; i < N; i++) {
      const t = ss.ssPreloadTier(i - a, tier);
      if (t === 'auto') autoCount++;
      if (i !== a) assert(t === 'none', `1-clip feed: non-active position ${i} must be 'none', got ${t}`);
    }
    assert(autoCount === 1, `1-clip feed must have exactly one 'auto', got ${autoCount}`);
    return true;
  }), { numRuns: ITER });

  // ── (b) 2-clip feed: distance 1 exists → it resolves to 'metadata'. ──
  for (const tier of TIERS) {
    assert(depthFor(tier) >= 1, `tier ${tier} Prefetch_Depth must be >= 1 for 2-clip degradation`);
    assert(ss.ssPreloadTier(1, tier) === 'metadata',
      `2-clip feed: distance 1 on tier ${tier} (depth ${depthFor(tier)}) must be 'metadata'`);
  }
  // And exactly one 'auto' (the active clip) in a 2-clip feed.
  fc.assert(fc.property(fc.constantFrom(...TIERS), (tier) => {
    const distances = [0, 1];
    const autos = distances.filter((d) => ss.ssPreloadTier(d, tier) === 'auto').length;
    assert(autos === 1, `2-clip feed must have exactly one 'auto', got ${autos}`);
    assert(ss.ssPreloadTier(1, tier) === 'metadata', `2-clip feed: next clip must be 'metadata'`);
    return true;
  }), { numRuns: ITER });

  // ── (c) ssShouldDeepen (if present): deepening clamps to clips that exist. ──
  // A distance beyond maxDistance (e.g. there is no such clip) must never deepen.
  if (typeof ss.ssShouldDeepen === 'function') {
    fc.assert(fc.property(
      fc.constantFrom(...TIERS),
      fc.integer({ min: 1, max: 4 }),
      (tier, maxDistance) => {
        // distance just past the clips that exist → false (clamp to existing).
        const beyond = ss.ssShouldDeepen({
          activeBufferSatisfied: true,
          distance: maxDistance + 1,
          networkTier: tier,
          budgetRemainingBytes: 10 * 1024 * 1024,
          nextSegmentBytes: 1024,
          dwell: 1,
          dwellThreshold: 0.5,
          maxDistance,
        });
        assert(beyond === false,
          `deepening must clamp: distance ${maxDistance + 1} > maxDistance ${maxDistance} must be false`);
        return true;
      }), { numRuns: ITER });
  }

  // ── (d) Eviction at minimal scale: <= window clips, all in-window → evict nothing. ──
  // (Guarded: red until task 21 lands ssSegmentEvictionPlan.)
  assert(typeof ss.ssSegmentEvictionPlan === 'function',
    'ssSegmentEvictionPlan is not implemented yet (expected until task 21)');

  fc.assert(fc.property(
    fc.array(fc.record({
      bytes: fc.integer({ min: 0, max: 1024 }),
      lastUsed: fc.integer({ min: 0, max: 1000 }),
    }), { minLength: 0, maxLength: 6 }),
    fc.integer({ min: 2, max: 8 }),
    (records, window) => {
      // Assign clipDistances strictly inside [-window, +window] so nothing is
      // out-of-window, and an ample ceiling so no LRU pressure either.
      const segments = records.map((r, i) => ({
        key: 'k' + i,
        bytes: r.bytes,
        lastUsed: r.lastUsed,
        clipDistance: (i % (window + 1)), // 0..window, always in-window
      }));
      const r = ss.ssSegmentEvictionPlan({
        segments, ceilingBytes: 1024 * 1024, windowAhead: window, windowBehind: window,
      });
      assert(Array.isArray(r.evict) && Array.isArray(r.keep), 'result must be { evict:[], keep:[] }');
      assert(r.evict.length === 0,
        `minimal scale: <= window in-window clips under ceiling must evict nothing, got ${JSON.stringify(r.evict)}`);
      assert(r.keep.length === segments.length, 'all segments must be kept');
      return true;
    }), { numRuns: ITER });

  console.log('  \u2713 Property 8');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 8\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
