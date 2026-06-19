/* ═══════════════════════════════════════════════════════════════
   tests/prop-network-tier.test.js — Node property test for the
   clip-player-performance network-tier classifier
   `ssNetworkTier(effectiveType)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-network-tier.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper is PURE (a value in, a
   tier string out), so the stub never affects behaviour.

   Semantics: 'slow-2g'/'2g' → 'slow'; '3g' → 'medium'; '4g' → 'fast'; any other
   value (undefined, garbage, objects) → 'medium' (safe default), never throws.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// Safe stringifier: fast-check's fc.object() can produce objects whose toString
// is a non-function (e.g. { toString: "" }), so a bare String(v) throws while
// building a diagnostic. Never let a diagnostic crash the test.
function show(v) {
  try {
    if (v !== null && typeof v === 'object') return JSON.stringify(v);
    return String(v);
  } catch (_) { return Object.prototype.toString.call(v); }
}

let failed = 0;

console.log('Feature: clip-player-performance — network tier classification property test\n');

// Feature: clip-player-performance, Property 2: Network tier classification is total
// **Validates: Requirements 4.1, 4.5**
try {
  const TIERS = ['slow', 'medium', 'fast'];
  const known = { 'slow-2g': 'slow', '2g': 'slow', '3g': 'medium', '4g': 'fast' };

  const anyInput = fc.oneof(
    fc.constantFrom('slow-2g', '2g', '3g', '4g'),
    fc.string(),
    fc.constantFrom(undefined, null, NaN, 0, 1, '5g', '4G', ' 4g'),
    fc.integer(),
    fc.object()
  );

  fc.assert(fc.property(anyInput, (input) => {
    const tier = ss.ssNetworkTier(input);
    // Total: always exactly one of the three tiers, never throws.
    assert(TIERS.indexOf(tier) !== -1, `tier must be one of ${TIERS}: got ${show(tier)}`);
    // Only a known string maps non-default; everything else (incl. objects) → medium.
    if (typeof input === 'string' && Object.prototype.hasOwnProperty.call(known, input)) {
      assert(tier === known[input], `known mapping wrong for ${show(input)}: got ${tier} expected ${known[input]}`);
    } else {
      // Anything not an exact known string → safe default 'medium'.
      assert(tier === 'medium', `unknown input must default to medium: got ${tier} for ${show(input)}`);
    }
    return true;
  }), { numRuns: ITER });

  // ── Explicit mappings ──
  assert(ss.ssNetworkTier('slow-2g') === 'slow', "slow-2g → slow");
  assert(ss.ssNetworkTier('2g') === 'slow', "2g → slow");
  assert(ss.ssNetworkTier('3g') === 'medium', "3g → medium");
  assert(ss.ssNetworkTier('4g') === 'fast', "4g → fast");
  assert(ss.ssNetworkTier(undefined) === 'medium', "undefined → medium");
  assert(ss.ssNetworkTier('4G') === 'medium', "case-sensitive: 4G → medium (unknown)");

  console.log('  \u2713 Property 2');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 2\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
