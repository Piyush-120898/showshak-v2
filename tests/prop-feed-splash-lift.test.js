/* ═══════════════════════════════════════════════════════════════
   tests/prop-feed-splash-lift.test.js — Node property test for the
   feed-clip-load-performance cold-start splash lane decision
   `ssSplashLift(state)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-feed-splash-lift.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (a small state object in, a string out), so the stub never affects behaviour.

   TDD NOTE: `ssSplashLift` does NOT exist yet — it is implemented in task 15.
   This file is authored FIRST and is EXPECTED TO FAIL ("not implemented yet")
   until then; the failure is guarded into a clean assertion failure (not a crash).

   Contract — `ssSplashLift(state)` → `'lift' | 'hold'`, where
     state = { floorElapsed, clipReady, ceilingReached } (booleans, coerced):
     - returns 'lift' when ceilingReached === true
       OR (floorElapsed === true AND clipReady === true);
     - returns 'hold' otherwise.
   Ceiling precedence: ANY input with ceilingReached truthy → 'lift' (the splash
   can never hang). Total, deterministic, never throws/blocks on garbage input.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// Safe stringifier: fast-check's fc.object()/fc.anything() can produce objects
// whose toString is a non-function, so a bare String(v) can throw while building
// a diagnostic message.
function show(v) {
  try {
    if (v !== null && typeof v === 'object') return JSON.stringify(v);
    return String(v);
  } catch (_) { return Object.prototype.toString.call(v); }
}

// Reference oracle: lift = ceiling OR (floor AND ready); coerced to boolean.
function expected(floorElapsed, clipReady, ceilingReached) {
  const ceiling = !!ceilingReached;
  const floor = !!floorElapsed;
  const ready = !!clipReady;
  return (ceiling || (floor && ready)) ? 'lift' : 'hold';
}

let failed = 0;
const OUTPUTS = ['lift', 'hold'];

console.log('Feature: feed-clip-load-performance — splash-lift ceiling precedence + determinism property test\n');

// Feature: feed-clip-load-performance, Property 5: Splash-lift ceiling precedence + determinism
// **Validates: Requirements 5.3, 5.4, 5.5**
try {
  // Guard: the function must exist (red until task 15 implements it).
  assert(typeof ss.ssSplashLift === 'function',
    'ssSplashLift is not implemented yet (expected until task 15)');

  // ── Explicit 8-row truth table (all boolean combinations) ──
  // floorElapsed, clipReady, ceilingReached  →  expected
  const TRUTH_TABLE = [
    [false, false, false, 'hold'],
    [false, false, true,  'lift'], // ceiling precedence
    [false, true,  false, 'hold'],
    [false, true,  true,  'lift'], // ceiling precedence
    [true,  false, false, 'hold'],
    [true,  false, true,  'lift'], // ceiling precedence
    [true,  true,  false, 'lift'], // floor AND ready
    [true,  true,  true,  'lift'], // ceiling precedence
  ];
  for (const [floorElapsed, clipReady, ceilingReached, want] of TRUTH_TABLE) {
    const got = ss.ssSplashLift({ floorElapsed, clipReady, ceilingReached });
    assert(got === want,
      `truth table {floor:${floorElapsed}, ready:${clipReady}, ceiling:${ceilingReached}} → ` +
      `expected '${want}', got ${show(got)}`);
  }

  // ── Property: enumerate ALL 8 boolean combinations via generators and assert
  // the output equals the (ceiling || (floor && ready)) oracle ──
  const boolGen = fc.boolean();
  fc.assert(fc.property(boolGen, boolGen, boolGen, (floorElapsed, clipReady, ceilingReached) => {
    const result = ss.ssSplashLift({ floorElapsed, clipReady, ceilingReached });

    // Totality: result is always exactly one of the two values, never throws.
    assert(OUTPUTS.indexOf(result) !== -1,
      `result must be one of ${OUTPUTS}: got ${show(result)} for ` +
      `{floor:${floorElapsed}, ready:${clipReady}, ceiling:${ceilingReached}}`);

    // Matches the truth-table oracle.
    const want = expected(floorElapsed, clipReady, ceilingReached);
    assert(result === want,
      `output mismatch for {floor:${floorElapsed}, ready:${clipReady}, ceiling:${ceilingReached}}: ` +
      `expected '${want}', got ${show(result)}`);

    // Ceiling precedence: any input with ceilingReached true → 'lift'.
    if (ceilingReached === true) {
      assert(result === 'lift',
        `ceiling precedence violated: ceilingReached=true must lift, got ${show(result)} ` +
        `for {floor:${floorElapsed}, ready:${clipReady}}`);
    }

    // Determinism: identical inputs → identical output.
    const again = ss.ssSplashLift({ floorElapsed, clipReady, ceilingReached });
    assert(again === result,
      `non-deterministic output for {floor:${floorElapsed}, ready:${clipReady}, ceiling:${ceilingReached}}: ` +
      `${show(result)} vs ${show(again)}`);

    return true;
  }), { numRuns: ITER });

  // ── Property: ceiling precedence holds even with garbage/non-boolean fields ──
  const garbageGen = fc.oneof(
    fc.boolean(),
    fc.constantFrom(undefined, null, 0, 1, NaN, '', 'true', 'false', 'x'),
    fc.integer(),
    fc.string(),
    fc.object()
  );
  fc.assert(fc.property(garbageGen, garbageGen, (floorElapsed, clipReady) => {
    // ceilingReached truthy must always lift, regardless of the other (coerced) fields.
    const lifted = ss.ssSplashLift({ floorElapsed, clipReady, ceilingReached: true });
    assert(lifted === 'lift',
      `ceiling=true must lift for any {floor:${show(floorElapsed)}, ready:${show(clipReady)}}: got ${show(lifted)}`);
    return true;
  }), { numRuns: ITER });

  // ── Property: never throws on non-boolean / malformed / missing inputs (coerced) ──
  const stateGen = fc.oneof(
    fc.record({
      floorElapsed: garbageGen,
      clipReady: garbageGen,
      ceilingReached: garbageGen,
    }),
    fc.constantFrom(undefined, null, {}, 'garbage', 0, NaN, []),
    fc.object(),
    fc.anything()
  );
  fc.assert(fc.property(stateGen, (state) => {
    const result = ss.ssSplashLift(state);
    assert(OUTPUTS.indexOf(result) !== -1,
      `result must be one of ${OUTPUTS} for malformed input ${show(state)}: got ${show(result)}`);
    // Determinism on garbage too.
    const again = ss.ssSplashLift(state);
    assert(again === result,
      `non-deterministic output for malformed input ${show(state)}: ${show(result)} vs ${show(again)}`);
    return true;
  }), { numRuns: ITER });

  console.log('  \u2713 Property 5');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 5\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
