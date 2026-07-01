/* ═══════════════════════════════════════════════════════════════
   tests/prop-curator-badge.test.js — Node property test for the
   curator-application-approval Badge_Resolver pure helper
   `ssResolveBadge({ role, verified })` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-curator-badge.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE, so the
   stub never affects behaviour — it only lets the module load.

   CONTRACT under test (design.md "Property 3", Req 15.1-15.5):
   ssResolveBadge(account) -> exactly ONE of { 'none', 'curator', 'verified' }:
     • verified === true            -> 'verified'  (STRICT true; overrides curator)
     • else role === 'curator'      -> 'curator'
     • else                         -> 'none'
   Truthy non-true `verified` (1, 'true') does NOT resolve to 'verified'.
   Null/undefined/non-object/garbage input -> 'none'. Deterministic; never throws.

   Feature: curator-application-approval, Property 3
   **Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5**
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const BADGES = ['none', 'curator', 'verified'];

// Independent oracle.
function expectedBadge(account) {
  const a = (account && typeof account === 'object') ? account : null;
  if (a && a.verified === true) return 'verified';
  if (a && a.role === 'curator') return 'curator';
  return 'none';
}

let failed = 0;

console.log('Feature: curator-application-approval — badge resolution property test\n');

// role: the two real roles, unknown strings, and non-string junk.
const roleValue = fc.oneof(
  fc.constantFrom('curator', 'user'),
  fc.constantFrom('Curator', 'admin', '', 'CURATOR'),
  fc.constantFrom(null, undefined, 0, 1, true, {}, [])
);
// verified: strict true plus truthy near-misses and junk.
const verifiedValue = fc.constantFrom(true, false, 'true', 1, 0, null, undefined, 'yes', {});

const accountObj = fc.record({ role: roleValue, verified: verifiedValue }, { requiredKeys: [] });

const accountArg = fc.oneof(
  { weight: 8, arbitrary: accountObj },
  { weight: 1, arbitrary: fc.constantFrom(null, undefined, 0, '', 'x', 42, true, []) }
);

try {
  fc.assert(fc.property(accountArg, (account) => {
    // 1) Never throws + always one of the three badge values.
    const r = ss.ssResolveBadge(account);
    assert(BADGES.indexOf(r) !== -1, `must be one of ${BADGES.join('|')}, got ${JSON.stringify(r)}`);

    // 2) Matches the oracle exactly.
    assert(r === expectedBadge(account),
      `resolveBadge(${JSON.stringify(account)}) = ${r}, expected ${expectedBadge(account)}`);

    // 3) 'verified' iff verified === true (strict) — the override rule.
    const isObj = account && typeof account === 'object';
    if (isObj && account.verified === true) {
      assert(r === 'verified', 'strict-true verified must resolve verified (overrides role)');
    } else if (r === 'verified') {
      assert(false, `resolved 'verified' without strict-true verified: ${JSON.stringify(account)}`);
    }

    // 4) Determinism.
    assert(ss.ssResolveBadge(account) === r, 'must be deterministic');
    return true;
  }), { numRuns: ITER });

  // ── Explicit contract pins ────────────────────────────────────────────────
  assert(ss.ssResolveBadge({ role: 'curator', verified: false }) === 'curator', 'curator+unverified → curator');
  assert(ss.ssResolveBadge({ role: 'curator', verified: true }) === 'verified', 'curator+verified → verified');
  assert(ss.ssResolveBadge({ role: 'user', verified: true }) === 'verified', 'verified overrides even role=user');
  assert(ss.ssResolveBadge({ role: 'user', verified: false }) === 'none', 'user+unverified → none');
  assert(ss.ssResolveBadge({ role: 'user' }) === 'none', 'plain user → none');
  assert(ss.ssResolveBadge({ role: 'curator' }) === 'curator', 'curator, no verified → curator');

  // Truthy non-true verified does NOT verify.
  assert(ss.ssResolveBadge({ role: 'curator', verified: 1 }) === 'curator', 'verified:1 → not verified');
  assert(ss.ssResolveBadge({ role: 'user', verified: 'true' }) === 'none', "verified:'true' → not verified");

  // Garbage input → none.
  assert(ss.ssResolveBadge(null) === 'none', 'null → none');
  assert(ss.ssResolveBadge(undefined) === 'none', 'undefined → none');
  assert(ss.ssResolveBadge('curator') === 'none', 'string → none');
  assert(ss.ssResolveBadge({}) === 'none', 'empty object → none');

  console.log('  \u2713 Property 3');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 3\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
