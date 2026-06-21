/* ═══════════════════════════════════════════════════════════════
   tests/prop-reveal-body.test.js — Node property test for the
   pwa-black-screen-load early-reveal rule (Phase 1).

   Pure helper under test (added to showshak-shared.js in task 5.1):
     - ssShouldRevealBody(evt) → boolean

   Plain Node (no framework) + fast-check; run with:
     node tests/prop-reveal-body.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (takes a plain event-like object, returns a boolean), so the stub never affects
   behaviour — it only lets the module load and populate module.exports.

   ── Reveal-body truth table (from design.md, Property 3 / Phase 1 step 5) ──
   ssShouldRevealBody(evt) SHALL return true for every real document-load reveal
   event, so the body is revealed on internal MPA navigations and not only on
   persisted bfcache restores:

     evt.type            evt.persisted   → ssShouldRevealBody
     ─────────────────── ─────────────── ──────────────────────
     'DOMContentLoaded'  (n/a)           → true
     'pageshow'          true            → true   (true bfcache restore)
     'pageshow'          false           → true   (fresh internal-nav load — THE BUG)

   The heart of the bug: the OLD code's `e.persisted === true` guard returned
   false for `pageshow` with `persisted=false` (the normal ssNavigate() fresh
   document load), so the early-reveal never fired on the founder's
   feed → page → feed loop. The fix must return true regardless of persisted.

   On the UNFIXED code, ssShouldRevealBody does NOT yet exist, so the calls below
   throw ('ssShouldRevealBody is not a function') — this test is EXPECTED TO FAIL
   until task 5.1 implements the helper.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: pwa-black-screen-load — early-reveal-on-fresh-loads property test\n');

// Feature: pwa-black-screen-load, Property 3: Early Reveal Fires on Fresh Loads — ssShouldRevealBody
// **Validates: Requirements 2.1, 2.3**
try {
  // Generated events across the real document-load reveal domain:
  //   type ∈ {DOMContentLoaded, pageshow}, persisted ∈ {true, false}.
  // Every such event is a real document-load reveal and MUST reveal the body.
  const evtArb = fc.record({
    type:      fc.constantFrom('DOMContentLoaded', 'pageshow'),
    persisted: fc.boolean(),
  });

  fc.assert(fc.property(evtArb, (evt) => {
    const result = ss.ssShouldRevealBody(evt);
    assert(result === true,
      `ssShouldRevealBody must return true for every real load event: got ${result} for ${JSON.stringify(evt)}`);
    return true;
  }), { numRuns: ITER });

  // ── Deterministic truth-table anchors (from design.md, Property 3) ──

  // DOMContentLoaded → always reveals (persisted is irrelevant for this type)
  assert(ss.ssShouldRevealBody({ type: 'DOMContentLoaded' }) === true,
    'DOMContentLoaded → reveal');
  assert(ss.ssShouldRevealBody({ type: 'DOMContentLoaded', persisted: false }) === true,
    'DOMContentLoaded (persisted=false) → reveal');
  assert(ss.ssShouldRevealBody({ type: 'DOMContentLoaded', persisted: true }) === true,
    'DOMContentLoaded (persisted=true) → reveal');

  // pageshow with persisted=true → reveal (true bfcache restore — already worked)
  assert(ss.ssShouldRevealBody({ type: 'pageshow', persisted: true }) === true,
    'pageshow persisted=true → reveal (bfcache restore)');

  // pageshow with persisted=false → reveal (fresh internal-nav load — THE BUG FIX)
  assert(ss.ssShouldRevealBody({ type: 'pageshow', persisted: false }) === true,
    'pageshow persisted=false → reveal (internal MPA nav — the heart of the bug)');

  console.log('  \u2713 Property 3');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 3\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
