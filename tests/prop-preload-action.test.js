/* ═══════════════════════════════════════════════════════════════
   tests/prop-preload-action.test.js — Node property test for the
   clip-player-performance bandwidth-discipline decision
   `ssPreloadAction(state)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-preload-action.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper is PURE (a state object
   in, an action string out).

   Semantics — the active clip ALWAYS wins the pipe:
     - active not ready             → 'pause'  (regardless of all else)
     - active ready, inFlight > 1   → 'cancel' (single in-flight discipline)
     - active ready, warmed>=depth  → 'idle'   (window full)
     - active ready, inFlight == 0, warmed<depth → 'start'
     - active ready, inFlight == 1, warmed<depth → 'idle' (let it finish)
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;
const ACTIONS = ['start', 'pause', 'resume', 'cancel', 'idle'];

console.log('Feature: clip-player-performance — preload gate property test\n');

// Feature: clip-player-performance, Property 4: Preload gate always prioritizes the active clip
// **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
try {
  const stateGen = fc.record({
    activeReady: fc.boolean(),
    inFlight: fc.integer({ min: 0, max: 4 }),
    warmed: fc.integer({ min: 0, max: 8 }),
    preloadDepth: fc.integer({ min: 0, max: 6 }),
  });

  fc.assert(fc.property(stateGen, (st) => {
    const action = ss.ssPreloadAction(st);
    assert(ACTIONS.indexOf(action) !== -1, `action must be one of ${ACTIONS}: got ${action}`);

    // Active not ready → always 'pause' (active wins the pipe), regardless of all else.
    if (!st.activeReady) {
      assert(action === 'pause', `active not ready must pause: got ${action} for ${JSON.stringify(st)}`);
      return true;
    }
    // From here, active IS ready.
    // inFlight > 1 → cancel (single in-flight discipline).
    if (st.inFlight > 1) {
      assert(action === 'cancel', `inFlight>1 must cancel: got ${action} for ${JSON.stringify(st)}`);
      return true;
    }
    // start/resume only when active ready, inFlight === 0, warmed < depth.
    if (action === 'start' || action === 'resume') {
      assert(st.activeReady && st.inFlight === 0 && st.warmed < st.preloadDepth,
        `start/resume under wrong conditions: ${JSON.stringify(st)}`);
    }
    // Never start/resume once the window is full.
    if (st.warmed >= st.preloadDepth) {
      assert(action !== 'start' && action !== 'resume',
        `must not start/resume when warmed>=depth: got ${action} for ${JSON.stringify(st)}`);
    }
    return true;
  }), { numRuns: ITER });

  // ── Explicit cases ──
  assert(ss.ssPreloadAction({ activeReady: false, inFlight: 0, warmed: 0, preloadDepth: 3 }) === 'pause', 'not ready → pause');
  assert(ss.ssPreloadAction({ activeReady: true, inFlight: 2, warmed: 0, preloadDepth: 3 }) === 'cancel', 'inFlight>1 → cancel');
  assert(ss.ssPreloadAction({ activeReady: true, inFlight: 0, warmed: 1, preloadDepth: 3 }) === 'start', 'ready,0 in flight,room → start');
  assert(ss.ssPreloadAction({ activeReady: true, inFlight: 1, warmed: 1, preloadDepth: 3 }) === 'idle', 'one in flight → idle');
  assert(ss.ssPreloadAction({ activeReady: true, inFlight: 0, warmed: 3, preloadDepth: 3 }) === 'idle', 'window full → idle');
  // Defensive: empty/garbage state never throws.
  assert(ACTIONS.indexOf(ss.ssPreloadAction(undefined)) !== -1, 'undefined state → pause (not ready)');

  console.log('  \u2713 Property 4');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 4\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
