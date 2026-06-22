/* ═══════════════════════════════════════════════════════════════
   tests/prop-nav-strategy.test.js — Node property test for the
   pwa-black-screen-load View-Transition navigation strategy (Phase 2).

   Pure helper under test (added to showshak-shared.js in task 9.1):
     - ssNavStrategy(env) → 'view-transition' | 'instant'
       where env = { supportsViewTransition: boolean, reducedMotion: boolean }

   Plain Node (no framework) + fast-check; run with:
     node tests/prop-nav-strategy.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (takes a plain object, returns a string), so the stub never affects
   behaviour — it only lets the module load and populate module.exports.

   ── Nav-strategy 2×2 truth table (from design.md, Property 4 / Phase 2 step 3) ──
   ssNavStrategy SHALL return 'view-transition' ONLY when View Transitions are
   supported AND reduced motion is NOT requested; otherwise 'instant'. When the
   result is 'view-transition' the caller skips the manual ssNavigate opacity
   fade (no double-animation); when 'instant' it degrades to today's instant cut.

     supportsViewTransition   reducedMotion   → ssNavStrategy
     ──────────────────────── ─────────────── ──────────────────
     true                     false           → 'view-transition'
     true                     true            → 'instant'   (reduced motion)
     false                    false           → 'instant'   (unsupported)
     false                    true            → 'instant'   (unsupported + reduced)

   On the UNFIXED code, ssNavStrategy does NOT yet exist, so the calls below
   throw ('ssNavStrategy is not a function') — this test is EXPECTED TO FAIL
   until task 9.1 implements the strategy resolver.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: pwa-black-screen-load — View-Transition nav-strategy property test\n');

// Feature: pwa-black-screen-load, Property 4: View-Transition Strategy Has No Double-Animation — ssNavStrategy
// **Validates: Requirements 2.1, 3.4**
try {
  // Generated environments across the whole 2×2 boolean domain.
  const envArb = fc.record({
    supportsViewTransition: fc.boolean(),
    reducedMotion:          fc.boolean(),
  });

  // 'view-transition' IFF (supportsViewTransition === true AND reducedMotion === false);
  // every other combination → 'instant'.
  fc.assert(fc.property(envArb, (env) => {
    const strategy = ss.ssNavStrategy(env);
    const expected = (env.supportsViewTransition === true && env.reducedMotion === false)
      ? 'view-transition'
      : 'instant';
    assert(strategy === expected,
      `ssNavStrategy mismatch for ${JSON.stringify(env)}: expected ${expected}, got ${strategy}`);
    return true;
  }), { numRuns: ITER });

  // ── Exact 2×2 deterministic rows (from design.md, Property 4) ──

  // supported AND not reduced-motion → the only 'view-transition' row
  assert(ss.ssNavStrategy({ supportsViewTransition: true, reducedMotion: false }) === 'view-transition',
    'supported + no reduced-motion → view-transition');

  // supported BUT reduced-motion → instant (respect prefers-reduced-motion)
  assert(ss.ssNavStrategy({ supportsViewTransition: true, reducedMotion: true }) === 'instant',
    'supported + reduced-motion → instant');

  // unsupported, no reduced-motion → instant (graceful fallback)
  assert(ss.ssNavStrategy({ supportsViewTransition: false, reducedMotion: false }) === 'instant',
    'unsupported → instant (graceful fallback)');

  // unsupported AND reduced-motion → instant
  assert(ss.ssNavStrategy({ supportsViewTransition: false, reducedMotion: true }) === 'instant',
    'unsupported + reduced-motion → instant');

  console.log('  \u2713 Property 4');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 4\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
