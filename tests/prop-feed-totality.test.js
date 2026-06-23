/* ═══════════════════════════════════════════════════════════════
   tests/prop-feed-totality.test.js — Node property test for the
   feed-clip-load-performance totality / defensiveness guarantee across the whole
   pure decision core: `ssPreloadTier`, `ssShouldDeepen`, `ssSplashLift`, and
   `ssSegmentEvictionPlan` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-feed-totality.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helpers under test are PURE.

   TDD NOTE: these four pure functions land across tasks 4 / 10 / 15 / 21. Each
   function is guarded with a `typeof` check so its assertions run only once it
   exists — the file stays meaningful as the functions arrive. A final guard
   requires `ssSegmentEvictionPlan` to exist, so the file is RED overall until
   task 21 implements it; the failure is a clean assertion (not a crash).

   Property — every pure decision function resolves WITHOUT THROWING on
   null/undefined/malformed/non-finite inputs and returns a well-formed result of
   its documented shape:
     • ssPreloadTier         → one of 'auto' | 'metadata' | 'none'
     • ssShouldDeepen        → a boolean
     • ssSplashLift          → 'lift' | 'hold'
     • ssSegmentEvictionPlan → { evict: string[], keep: string[] }
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function show(v) {
  try {
    if (v !== null && typeof v === 'object') return JSON.stringify(v);
    return String(v);
  } catch (_) { return Object.prototype.toString.call(v); }
}

let failed = 0;

// A broad garbage generator: primitives, non-finite numbers, strings, arrays,
// and arbitrary objects — anything a malformed caller might pass.
const garbage = () => fc.oneof(
  fc.constantFrom(undefined, null, NaN, Infinity, -Infinity, 0, 1, -1, '', '0', 'x', true, false),
  fc.integer(),
  fc.double(),
  fc.string(),
  fc.array(fc.anything(), { maxLength: 5 }),
  fc.object(),
  fc.anything()
);

console.log('Feature: feed-clip-load-performance — totality / defensiveness property test\n');

// Feature: feed-clip-load-performance, Property 9: Totality / defensiveness
// **Validates: Requirements 10.1, 10.7**
try {
  // ── ssPreloadTier (exists from task 4) ──
  if (typeof ss.ssPreloadTier === 'function') {
    const TIER_VALUES = ['auto', 'metadata', 'none'];
    fc.assert(fc.property(garbage(), garbage(), garbage(), (a, b, c) => {
      let out;
      try { out = ss.ssPreloadTier(a, b, c); }
      catch (e) { throw new Error(`ssPreloadTier threw on (${show(a)},${show(b)},${show(c)}): ${e.message}`); }
      assert(TIER_VALUES.indexOf(out) !== -1,
        `ssPreloadTier returned malformed value ${show(out)}`);
      return true;
    }), { numRuns: ITER });
  }

  // ── ssShouldDeepen (lands task 10) ──
  if (typeof ss.ssShouldDeepen === 'function') {
    // Pass both wholly-garbage values and garbage-filled state objects.
    const stateGen = fc.record({
      activeBufferSatisfied: garbage(),
      distance: garbage(),
      networkTier: garbage(),
      budgetRemainingBytes: garbage(),
      nextSegmentBytes: garbage(),
      dwell: garbage(),
      dwellThreshold: garbage(),
      maxDistance: garbage(),
    });
    fc.assert(fc.property(fc.oneof(garbage(), stateGen), (state) => {
      let out;
      try { out = ss.ssShouldDeepen(state); }
      catch (e) { throw new Error(`ssShouldDeepen threw on ${show(state)}: ${e.message}`); }
      assert(typeof out === 'boolean', `ssShouldDeepen must return boolean, got ${show(out)}`);
      return true;
    }), { numRuns: ITER });
  }

  // ── ssSplashLift (lands task 15) ──
  if (typeof ss.ssSplashLift === 'function') {
    const stateGen = fc.record({
      floorElapsed: garbage(),
      clipReady: garbage(),
      ceilingReached: garbage(),
    });
    fc.assert(fc.property(fc.oneof(garbage(), stateGen), (state) => {
      let out;
      try { out = ss.ssSplashLift(state); }
      catch (e) { throw new Error(`ssSplashLift threw on ${show(state)}: ${e.message}`); }
      assert(out === 'lift' || out === 'hold', `ssSplashLift must return 'lift'|'hold', got ${show(out)}`);
      return true;
    }), { numRuns: ITER });
  }

  // ── ssSegmentEvictionPlan (lands task 21) ──
  if (typeof ss.ssSegmentEvictionPlan === 'function') {
    const inputGen = fc.record({
      segments: fc.oneof(garbage(), fc.array(fc.oneof(garbage(), fc.record({
        key: garbage(), bytes: garbage(), lastUsed: garbage(), clipDistance: garbage(),
      })), { maxLength: 6 })),
      ceilingBytes: garbage(),
      windowAhead: garbage(),
      windowBehind: garbage(),
    });
    fc.assert(fc.property(fc.oneof(garbage(), inputGen), (input) => {
      let out;
      try { out = ss.ssSegmentEvictionPlan(input); }
      catch (e) { throw new Error(`ssSegmentEvictionPlan threw on ${show(input)}: ${e.message}`); }
      assert(out && Array.isArray(out.evict) && Array.isArray(out.keep),
        `ssSegmentEvictionPlan must return { evict:[], keep:[] }, got ${show(out)}`);
      return true;
    }), { numRuns: ITER });

    // Documented defensive default for clearly-malformed top-level input.
    const empty = ss.ssSegmentEvictionPlan(null);
    assert(empty && empty.evict.length === 0 && empty.keep.length === 0,
      'ssSegmentEvictionPlan(null) must be { evict:[], keep:[] }');
    const nonArray = ss.ssSegmentEvictionPlan({ segments: 'nope', ceilingBytes: 10, windowAhead: 1, windowBehind: 1 });
    assert(nonArray.evict.length === 0 && nonArray.keep.length === 0,
      'ssSegmentEvictionPlan with non-array segments must be { evict:[], keep:[] }');
  }

  // Final guard: the full quartet must be present for this property to hold.
  // Red until task 21 lands ssSegmentEvictionPlan (and tasks 10/15 land the
  // deepening/splash deciders).
  assert(typeof ss.ssSegmentEvictionPlan === 'function',
    'ssSegmentEvictionPlan is not implemented yet (expected until task 21)');

  console.log('  \u2713 Property 9');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 9\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
