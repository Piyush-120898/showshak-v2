/* ═══════════════════════════════════════════════════════════════
   tests/prop-prewarm-gate.test.js — Node property test for the
   prefetch-cache-pipeline cross-page prewarm gate
   `ssShouldPrewarm(targetPage, currentPage, doneSet)` in showshak-shared.js.

   Plain Node (no framework) + fast-check; run with:
     node tests/prop-prewarm-gate.test.js
   (auto-discovered by `node tests/run-all.js`).

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (page strings + a Set in, a boolean out), so the stub never affects behaviour —
   it only lets the module load and populate module.exports.

   ── Gate semantics (design.md, Property 1 / Phase 1) ──
   The Target_Pages eligible for prewarm are EXACTLY 'discover' and 'watchlist'.
   ssShouldPrewarm SHALL return `true` IFF:
     • targetPage is a known Target_Page (a string in {'discover','watchlist'}), AND
     • targetPage !== currentPage (skip the current page), AND
     • targetPage is NOT already in doneSet (skip what was warmed this session).
   For EVERY other input — unknown / non-string page, target equal to current,
   or target already in doneSet — it returns `false`. Total and deterministic.

   On the UNFIXED code, ssShouldPrewarm does NOT yet exist (task 2.2 implements it),
   so the calls below throw ('ssShouldPrewarm is not a function') — this test is
   EXPECTED TO FAIL until that helper lands. That red is the correct TDD outcome.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// Safe stringifier for diagnostics (fc.object()/fc.anything() can produce values
// whose toString is hostile, so never let a diagnostic crash the test).
function show(v) {
  try {
    if (v instanceof Set) return 'Set(' + JSON.stringify(Array.from(v)) + ')';
    if (v !== null && typeof v === 'object') return JSON.stringify(v);
    return String(v);
  } catch (_) { return Object.prototype.toString.call(v); }
}

// The known Target_Pages — the ONLY two pages eligible for prewarm.
const KNOWN = ['discover', 'watchlist'];

// Reference oracle: what the gate MUST return for a given (target, current, doneSet).
function expectedGate(target, current, doneSet) {
  const isKnown = (typeof target === 'string') && KNOWN.indexOf(target) !== -1;
  const inDone = (doneSet instanceof Set) ? doneSet.has(target) : false;
  return isKnown && target !== current && !inDone;
}

let failed = 0;

console.log('Feature: prefetch-cache-pipeline — prewarm gate property test\n');

// Feature: prefetch-cache-pipeline, Property 1: Prewarm gate skips current and already-warmed, warms eligible
// **Validates: Requirements 1.3, 3.3, 3.5**
try {
  // A page slot generator: known Target_Pages, plausible-but-unknown pages,
  // and a broad spread of non-string / malformed inputs (totality coverage).
  const pageArb = fc.oneof(
    fc.constantFrom('discover', 'watchlist'),                          // known targets
    fc.constantFrom('feed', 'profile', 'settings', 'stack', 'Discover', 'WATCHLIST', ''),
    fc.string(),                                                       // arbitrary strings
    fc.constantFrom(undefined, null, NaN, 0, 1, true, false),         // non-strings
    fc.integer(),
    fc.object()                                                        // wrong-typed objects
  );

  // doneSet generator: a Set drawn from a pool that INCLUDES the known targets,
  // so membership (already-warmed) is exercised, plus unrelated noise.
  const doneSetArb = fc.array(
    fc.oneof(fc.constantFrom('discover', 'watchlist', 'feed', 'profile'), fc.string()),
    { maxLength: 5 }
  ).map((arr) => new Set(arr));

  fc.assert(fc.property(pageArb, pageArb, doneSetArb, (target, current, doneSet) => {
    const got = ss.ssShouldPrewarm(target, current, doneSet);
    // Total: always a strict boolean, never throws.
    assert(got === true || got === false,
      `result must be a boolean for (${show(target)}, ${show(current)}, ${show(doneSet)}): got ${show(got)}`);
    // Matches the IFF oracle exactly.
    const want = expectedGate(target, current, doneSet);
    assert(got === want,
      `gate mismatch for (${show(target)}, ${show(current)}, ${show(doneSet)}): expected ${want}, got ${got}`);
    // Deterministic: a second identical call agrees.
    assert(ss.ssShouldPrewarm(target, current, doneSet) === got,
      `non-deterministic result for (${show(target)}, ${show(current)}, ${show(doneSet)})`);
    return true;
  }), { numRuns: ITER });

  // ── Explicit deterministic rows ──

  // Eligible: known target, not current, not yet warmed → true.
  assert(ss.ssShouldPrewarm('discover', 'feed', new Set()) === true,
    "discover from feed, not warmed → true");
  assert(ss.ssShouldPrewarm('watchlist', 'feed', new Set()) === true,
    "watchlist from feed, not warmed → true");

  // Skip the current page: target === current → false.
  assert(ss.ssShouldPrewarm('discover', 'discover', new Set()) === false,
    "target equals current → false");
  assert(ss.ssShouldPrewarm('watchlist', 'watchlist', new Set()) === false,
    "target equals current → false");

  // Skip already-warmed: target in doneSet → false.
  assert(ss.ssShouldPrewarm('discover', 'feed', new Set(['discover'])) === false,
    "target already in doneSet → false");
  assert(ss.ssShouldPrewarm('watchlist', 'feed', new Set(['watchlist'])) === false,
    "target already in doneSet → false");

  // A warmed sibling does not block an un-warmed target.
  assert(ss.ssShouldPrewarm('watchlist', 'feed', new Set(['discover'])) === true,
    "sibling warmed, target not → true");

  // Unknown / non-Target pages → false (even from a different current page).
  assert(ss.ssShouldPrewarm('feed', 'discover', new Set()) === false,
    "unknown page 'feed' → false");
  assert(ss.ssShouldPrewarm('profile', 'feed', new Set()) === false,
    "unknown page 'profile' → false");
  assert(ss.ssShouldPrewarm('Discover', 'feed', new Set()) === false,
    "case-sensitive: 'Discover' is not a known target → false");

  // Non-string / malformed target → false (never throws).
  assert(ss.ssShouldPrewarm(null, 'feed', new Set()) === false, "null target → false");
  assert(ss.ssShouldPrewarm(undefined, 'feed', new Set()) === false, "undefined target → false");
  assert(ss.ssShouldPrewarm(123, 'feed', new Set()) === false, "numeric target → false");
  assert(ss.ssShouldPrewarm({}, 'feed', new Set()) === false, "object target → false");

  console.log('  \u2713 Property 1');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 1\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
