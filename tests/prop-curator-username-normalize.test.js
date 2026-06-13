/* ═══════════════════════════════════════════════════════════════
   tests/prop-curator-username-normalize.test.js — Node property test for the
   public-curator-profile pure helper `ssNormalizeCuratorUsername(raw)` in
   showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-curator-username-normalize.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE (takes a
   value, returns a string or null), so the stub never affects behaviour — it only
   lets the module load and populate module.exports.

   ── EXACT semantics under test (mirrored by the oracle below) ──
     ssNormalizeCuratorUsername(raw):
       - non-string (null/undefined/number/object) → null.
       - URL-decode via decodeURIComponent; a malformed percent-escape must NOT
         throw — decode failure is treated as identity (the original string).
       - trim surrounding whitespace.
       - strip EXACTLY ONE leading '@' (so "@@alice" → "@alice", extras preserved).
       - trim again.
       - return the cleaned non-empty string, or null when the result is empty /
         whitespace-only / a lone '@'.

   ── A note on idempotence / "no leading @" ──
     Because only ONE leading '@' is stripped (Req 1.3), a pathological multi-'@'
     input like "@@alice" normalizes to "@alice", which STILL begins with '@'.
     Feeding that back through the function would strip another '@'. Therefore the
     universal claims "result never starts with '@'" and "norm(result) === result"
     hold only for the CANONICAL form (results that do not begin with '@') — which
     is every realistic username and every value the structured generators below
     produce. The oracle-equality assertion captures the full exact semantics
     (including the multi-'@' case) for arbitrary inputs.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

/* Faithful oracle — mirrors ssNormalizeCuratorUsername exactly. */
function oracle(raw) {
  if (typeof raw !== 'string') return null;
  var decoded;
  try { decoded = decodeURIComponent(raw); }
  catch (e) { decoded = raw; }
  var trimmed = decoded.trim();
  if (trimmed.charAt(0) === '@') trimmed = trimmed.slice(1);
  trimmed = trimmed.trim();
  return trimmed.length ? trimmed : null;
}

let failed = 0;

console.log('Feature: public-curator-profile — username normalization property test\n');

// Feature: public-curator-profile, Property 1: Username normalization
// **Validates: Requirements 1.1, 1.3, 1.6, 8.1**
try {
  // Whitespace characters trim() removes; used to build surrounding-whitespace inputs.
  const wsGen = fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 0, maxLength: 4 })
    .map((a) => a.join(''));

  // A "core" username body: URL-safe (no '%' so decode is identity), no whitespace
  // (so trim() never touches it), and never starting with '@' (so it survives the
  // single-'@' strip unchanged). Non-empty so the normalized result is non-null.
  const coreGen = fc.array(
    fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~".split('')),
    { minLength: 1, maxLength: 30 }
  ).map((chars) => chars.join(''));

  // ── 1. Arbitrary strings: never throws, exact oracle match, shape invariant ──
  fc.assert(fc.property(fc.string(), (raw) => {
    let r;
    // Must never throw, even on a malformed percent-escape.
    try { r = ss.ssNormalizeCuratorUsername(raw); }
    catch (e) { assert(false, `threw on input ${JSON.stringify(raw)}: ${e.message}`); }

    // Result is either null or a non-empty string.
    assert(r === null || (typeof r === 'string' && r.length > 0),
      `result must be null or non-empty string, got ${JSON.stringify(r)} for ${JSON.stringify(raw)}`);

    // Exact semantics: decode → trim → strip one '@' → trim.
    assert(r === oracle(raw),
      `oracle mismatch for ${JSON.stringify(raw)}: got ${JSON.stringify(r)} expected ${JSON.stringify(oracle(raw))}`);

    // Idempotence on the canonical form: a result that does not begin with '@' is a
    // fixed point. (A result beginning with '@' can only arise from a multi-'@' input
    // per Req 1.3, and is intentionally not a fixed point.)
    if (r !== null && r.charAt(0) !== '@') {
      assert(ss.ssNormalizeCuratorUsername(r) === r,
        `not idempotent on canonical result ${JSON.stringify(r)} (from ${JSON.stringify(raw)})`);
    }
    return true;
  }), { numRuns: ITER });

  // ── 2. Single-'@' stripping + whitespace trimming (0 or 1 leading '@') ──
  // Input = leadingWs + optional single '@' + core + trailingWs → normalizes to core,
  // which has no leading '@' and is itself a fixed point (idempotent).
  fc.assert(fc.property(wsGen, fc.boolean(), coreGen, wsGen, (wsL, hasAt, core, wsR) => {
    const input = wsL + (hasAt ? '@' : '') + core + wsR;
    const r = ss.ssNormalizeCuratorUsername(input);
    assert(r === core,
      `single-'@'/ws case: got ${JSON.stringify(r)} expected ${JSON.stringify(core)} for ${JSON.stringify(input)}`);
    assert(r.charAt(0) !== '@', `result unexpectedly starts with '@': ${JSON.stringify(r)}`);
    assert(ss.ssNormalizeCuratorUsername(r) === r, `not idempotent on ${JSON.stringify(r)}`);
    return true;
  }), { numRuns: ITER });

  // ── 3. Exactly ONE leading '@' stripped — extras preserved (Req 1.3) ──
  // Input with n>=2 leading '@' → result keeps (n-1) of them, whitespace trimmed.
  fc.assert(fc.property(wsGen, fc.integer({ min: 2, max: 6 }), coreGen, wsGen, (wsL, n, core, wsR) => {
    const input = wsL + '@'.repeat(n) + core + wsR;
    const r = ss.ssNormalizeCuratorUsername(input);
    const expected = '@'.repeat(n - 1) + core;
    assert(r === expected,
      `multi-'@' case: got ${JSON.stringify(r)} expected ${JSON.stringify(expected)} for ${JSON.stringify(input)}`);
    return true;
  }), { numRuns: ITER });

  // ── 4. Encoded equivalence: '%40' (encoded '@') behaves like a literal '@' ──
  fc.assert(fc.property(coreGen, (core) => {
    assert(ss.ssNormalizeCuratorUsername('%40' + core) === ss.ssNormalizeCuratorUsername('@' + core),
      `'%40'+core must normalize like '@'+core for core=${JSON.stringify(core)}`);
    assert(ss.ssNormalizeCuratorUsername('%40' + core) === core,
      `'%40'+core must normalize to core=${JSON.stringify(core)}`);
    return true;
  }), { numRuns: ITER });

  // ── 5. Surrounding-whitespace-only differences normalize identically ──
  fc.assert(fc.property(wsGen, coreGen, wsGen, (wsL, core, wsR) => {
    assert(ss.ssNormalizeCuratorUsername(wsL + core + wsR) === ss.ssNormalizeCuratorUsername(core),
      `surrounding-whitespace difference changed result for core=${JSON.stringify(core)}`);
    return true;
  }), { numRuns: ITER });

  // ── 6. Explicit cases from the design table ──
  assert(ss.ssNormalizeCuratorUsername('alice') === 'alice', "'alice' → 'alice'");
  assert(ss.ssNormalizeCuratorUsername('@alice') === 'alice', "'@alice' → 'alice'");
  assert(ss.ssNormalizeCuratorUsername('%40alice') === 'alice', "'%40alice' → 'alice'");
  assert(ss.ssNormalizeCuratorUsername('  @alice  ') === 'alice', "'  @alice  ' → 'alice'");
  assert(ss.ssNormalizeCuratorUsername('@@alice') === '@alice', "'@@alice' → '@alice' (only ONE '@' stripped)");
  assert(ss.ssNormalizeCuratorUsername('') === null, "'' → null");
  assert(ss.ssNormalizeCuratorUsername('   ') === null, "'   ' → null");
  assert(ss.ssNormalizeCuratorUsername('@') === null, "'@' → null");
  assert(ss.ssNormalizeCuratorUsername('%40') === null, "'%40' → null");

  // ── 7. Non-string inputs → null ──
  assert(ss.ssNormalizeCuratorUsername(null) === null, 'null → null');
  assert(ss.ssNormalizeCuratorUsername(undefined) === null, 'undefined → null');
  assert(ss.ssNormalizeCuratorUsername(42) === null, '42 → null');
  assert(ss.ssNormalizeCuratorUsername({}) === null, '{} → null');

  // ── 8. Malformed percent-escape → never throws, treated as identity ──
  let malformed;
  try { malformed = ss.ssNormalizeCuratorUsername('%E0%A4'); }
  catch (e) { assert(false, `malformed escape must not throw: ${e.message}`); }
  assert(malformed === '%E0%A4', `malformed escape identity: got ${JSON.stringify(malformed)}`);

  console.log('  \u2713 Property 1: Username normalization');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 1: Username normalization\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
