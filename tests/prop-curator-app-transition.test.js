/* ═══════════════════════════════════════════════════════════════
   tests/prop-curator-app-transition.test.js — Node property test for the
   curator-application-approval State_Machine pure helper
   `ssCuratorAppTransition(from, to)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-curator-app-transition.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE, so the
   stub never affects behaviour — it only lets the module load.

   CONTRACT under test (design.md "Property 2", Req 8.2-8.6):
   ssCuratorAppTransition(from, to) -> boolean returns strict `true` for EXACTLY:
     ('pending','approved') and ('pending','rejected');
   `false` for EVERY other pair — terminal origins 'approved'/'rejected',
   self-loops incl. 'pending'->'pending', unknown states, and
   null/undefined/non-string inputs. Total over all inputs; never throws.

   Feature: curator-application-approval, Property 2
   **Validates: Requirements 8.2, 8.3, 8.4, 8.5, 8.6**
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// Independent oracle: the ONLY two permitted transitions.
function expectedAllowed(from, to) {
  return from === 'pending' && (to === 'approved' || to === 'rejected');
}

let failed = 0;

console.log('Feature: curator-application-approval — application state machine property test\n');

// A wide value space: the three real statuses, unknown strings, self-referential
// values, and non-string junk.
const statusValue = fc.oneof(
  fc.constantFrom('pending', 'approved', 'rejected'),
  fc.constantFrom('PENDING', 'Approved', 'reject', 'live', 'removed', '', '  ', 'pending '),
  fc.constantFrom(null, undefined, 0, 1, true, false, {}, [], 42),
  fc.string()
);

try {
  fc.assert(fc.property(statusValue, statusValue, (from, to) => {
    // 1) Never throws + always a strict boolean.
    const r = ss.ssCuratorAppTransition(from, to);
    assert(r === true || r === false, `must return a strict boolean, got ${JSON.stringify(r)}`);

    // 2) Matches the oracle exactly.
    assert(r === expectedAllowed(from, to),
      `transition(${JSON.stringify(from)}, ${JSON.stringify(to)}) = ${r}, expected ${expectedAllowed(from, to)}`);

    // 3) Determinism — same inputs, same answer.
    assert(ss.ssCuratorAppTransition(from, to) === r, 'must be deterministic');
    return true;
  }), { numRuns: ITER });

  // ── Explicit contract pins ────────────────────────────────────────────────
  // The ONLY two true transitions.
  assert(ss.ssCuratorAppTransition('pending', 'approved') === true, "pending→approved");
  assert(ss.ssCuratorAppTransition('pending', 'rejected') === true, "pending→rejected");

  // Terminal origins never transition (Req 8.3/8.4).
  assert(ss.ssCuratorAppTransition('approved', 'rejected') === false, 'approved→rejected false');
  assert(ss.ssCuratorAppTransition('approved', 'approved') === false, 'approved→approved false');
  assert(ss.ssCuratorAppTransition('approved', 'pending') === false, 'approved→pending false');
  assert(ss.ssCuratorAppTransition('rejected', 'approved') === false, 'rejected→approved false');
  assert(ss.ssCuratorAppTransition('rejected', 'pending') === false, 'rejected→pending false');
  assert(ss.ssCuratorAppTransition('rejected', 'rejected') === false, 'rejected→rejected false');

  // Self-loops + no-op (Req 8.5).
  assert(ss.ssCuratorAppTransition('pending', 'pending') === false, 'pending→pending false');

  // Unknown states + junk (Req 8.5/8.6).
  assert(ss.ssCuratorAppTransition('pending', 'live') === false, 'pending→live false');
  assert(ss.ssCuratorAppTransition('PENDING', 'approved') === false, 'case-sensitive');
  assert(ss.ssCuratorAppTransition(null, 'approved') === false, 'null from false');
  assert(ss.ssCuratorAppTransition('pending', null) === false, 'null to false');
  assert(ss.ssCuratorAppTransition(undefined, undefined) === false, 'undefined pair false');

  console.log('  \u2713 Property 2');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 2\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
