/* ═══════════════════════════════════════════════════════════════
   tests/prop-feed-deepen-active-wins.test.js — Node property test for the
   feed-clip-load-performance "active clip always wins the pipe" invariant of
   `ssShouldDeepen(state)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-feed-deepen-active-wins.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (a plain state object in, a boolean out), so the stub never affects behaviour.

   TDD NOTE: `ssShouldDeepen` does NOT exist yet — it is implemented in task 10.
   This file is authored FIRST and is EXPECTED TO FAIL ("not implemented yet")
   until then; the absence is guarded into a clean assertion failure, not a crash.

   Semantics — the Active_Clip always wins the pipe: progressive deepening may
   NEVER run while the active clip's buffer is unsatisfied. So for EVERY input
   with `activeBufferSatisfied === false` (every other field arbitrary, including
   otherwise-perfect gates), `ssShouldDeepen(...)` MUST return false.
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

console.log('Feature: feed-clip-load-performance — deepening never starves the active clip property test\n');

// Feature: feed-clip-load-performance, Property 4: Deepening never starves the active clip
// **Validates: Requirements 2.4**
try {
  // Guard: the function must exist (red until task 10 implements it).
  assert(typeof ss.ssShouldDeepen === 'function',
    'ssShouldDeepen is not implemented yet (expected until task 10)');

  // activeBufferSatisfied is pinned to false; EVERYTHING else is arbitrary,
  // and deliberately includes values that would otherwise satisfy every gate
  // (in-range distance, ample budget, dwell at the ceiling) to prove the
  // active-buffer gate alone forbids deepening.
  const otherFieldsArbitrary = fc.record({
    activeBufferSatisfied: fc.constant(false),
    distance: fc.oneof(
      fc.integer({ min: 1, max: 5 }),                 // would-be in-range
      fc.integer({ min: -5, max: 12 }),
      fc.constantFrom(NaN, Infinity, -Infinity, '1', null, undefined)
    ),
    networkTier: fc.oneof(fc.constantFrom('slow', 'medium', 'fast'), fc.string(), fc.constantFrom(undefined, null)),
    budgetRemainingBytes: fc.oneof(fc.integer({ min: 0, max: 5000000 }), fc.constantFrom(NaN, Infinity, null, undefined)),
    nextSegmentBytes: fc.oneof(fc.integer({ min: 0, max: 1000000 }), fc.constantFrom(NaN, Infinity, null, undefined)),
    dwell: fc.oneof(fc.double({ min: 0, max: 1, noNaN: true }), fc.constant(1), fc.constantFrom(NaN, Infinity, null, undefined)),
    dwellThreshold: fc.oneof(fc.double({ min: 0, max: 1, noNaN: true }), fc.constant(0), fc.constantFrom(NaN, null, undefined)),
    maxDistance: fc.oneof(fc.integer({ min: 1, max: 12 }), fc.constantFrom(NaN, Infinity, null, undefined)),
  }, { requiredKeys: ['activeBufferSatisfied'] });

  fc.assert(fc.property(otherFieldsArbitrary, (state) => {
    const result = ss.ssShouldDeepen(state);          // must not throw
    assert(result === false,
      `activeBufferSatisfied===false must never deepen: got ${show(result)} for ${show(state)}`);
    return true;
  }), { numRuns: ITER });

  // ── Explicit example assertions ──
  // An otherwise-perfect state with only the active buffer unsatisfied → false.
  const perfectExceptActive = {
    activeBufferSatisfied: false, distance: 1, networkTier: 'fast',
    budgetRemainingBytes: 1000000, nextSegmentBytes: 1,
    dwell: 1, dwellThreshold: 0, maxDistance: 5,
  };
  assert(ss.ssShouldDeepen(perfectExceptActive) === false,
    'every gate perfect but active buffer unsatisfied → false');
  // Sanity: missing activeBufferSatisfied (not strictly true) also never deepens.
  assert(ss.ssShouldDeepen(Object.assign({}, perfectExceptActive, { activeBufferSatisfied: undefined })) === false,
    'missing activeBufferSatisfied → false');

  console.log('  \u2713 Property 4');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 4\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
