/* ═══════════════════════════════════════════════════════════════
   tests/prop-dmca-attestation.test.js — Node property test for the
   dmca-moderation-scaffolding upload-attestation completeness pure helper
   `ssAttestationComplete(attestation, requiredVersion)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-dmca-attestation.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (plain object + comparable version in, boolean out), so the stub never affects
   behaviour — it only lets the module load and populate module.exports.

   CONTRACT under test (design.md "Property 1", Req 1.8):
   ssAttestationComplete(attestation, requiredVersion) returns true IFF ALL hold:
     • accepting user id (attestation.curator_id || attestation.accepting_user_id)
       is a non-empty string (non-empty after trim);
     • accepted_at is a valid/parseable finite timestamp — a finite number
       (epoch ms), a Date, or a Date-parseable string;
     • tos_version is a non-empty (after trim) string;
     • attestation_version is a non-empty (after trim) string;
     • BOTH recorded versions compare >= requiredVersion (numeric/semantic-tolerant).
   else false. Null/undefined/partial/non-object attestation → false (never throws).
   A missing/blank requiredVersion (null/undefined/whitespace-only string) is the
   lowest possible bound, so any recorded version satisfies it.

   Feature: dmca-moderation-scaffolding, Property 1
   **Validates: Requirements 1.8**
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

/* ── Independent oracles: faithfully mirror the (private, non-exported)
   helpers showshak-shared.js uses, so `expected()` can be computed without
   reaching into module internals. ──────────────────────────────────────── */

// mirror of _ssParseTimestamp: finite number | Date | Date-parseable string → ms, else null
function parseTimestamp(v) {
  if (v == null) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (v instanceof Date) { const dt = v.getTime(); return isFinite(dt) ? dt : null; }
  if (typeof v === 'string') { const t = Date.parse(v); return isNaN(t) ? null : t; }
  return null;
}

// mirror of _ssCompareVersion: numeric/semantic-tolerant compare → -1 | 0 | 1
function compareVersion(a, b) {
  function segs(v) {
    return String(v == null ? '' : v).trim().replace(/^[vV]/, '').split('.');
  }
  const pa = segs(a), pb = segs(b);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const sa = pa[i] !== undefined ? pa[i] : '0';
    const sb = pb[i] !== undefined ? pb[i] : '0';
    const aNum = /^\d+$/.test(sa.trim());
    const bNum = /^\d+$/.test(sb.trim());
    if (aNum && bNum) {
      const na = parseInt(sa, 10), nb = parseInt(sb, 10);
      if (na !== nb) return na < nb ? -1 : 1;
    } else {
      if (sa < sb) return -1;
      if (sa > sb) return 1;
    }
  }
  return 0;
}

// Independent recomputation of the documented IFF contract.
function expected(attestation, requiredVersion) {
  if (!attestation || typeof attestation !== 'object') return false;
  const userId = attestation.curator_id || attestation.accepting_user_id;
  if (typeof userId !== 'string' || userId.trim() === '') return false;
  if (parseTimestamp(attestation.accepted_at) === null) return false;
  const tos = attestation.tos_version;
  const att = attestation.attestation_version;
  if (typeof tos !== 'string' || tos.trim() === '') return false;
  if (typeof att !== 'string' || att.trim() === '') return false;
  const reqMissing = requiredVersion == null ||
    (typeof requiredVersion === 'string' && requiredVersion.trim() === '');
  if (reqMissing) return true;
  return compareVersion(tos, requiredVersion) >= 0 &&
         compareVersion(att, requiredVersion) >= 0;
}

let failed = 0;

console.log('Feature: dmca-moderation-scaffolding — attestation completeness property test\n');

// ── Generators ─────────────────────────────────────────────────────────────

// Accepting-user-id values: valid ids, empty / whitespace-only, and non-strings.
const idValue = fc.oneof(
  fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s.trim() !== ''),
  fc.constantFrom('', '   ', '\t', '\n', 'curator-123', 'u_1'),
  fc.constantFrom(0, 1, null, undefined, true, {}, [])
);

// accepted_at values: valid (epoch number, Date, ISO/parseable string) and invalid
// (NaN, ±Infinity, junk strings, objects, null/undefined).
const acceptedAt = fc.oneof(
  fc.integer({ min: 0, max: 4102444800000 }),                 // epoch ms (valid)
  fc.date({ min: new Date(0), max: new Date(4102444800000) }), // Date (valid)
  fc.constantFrom(
    '2024-01-01', '2024-06-15T12:00:00Z', 'Jan 1 2020',       // parseable strings (valid)
    'not-a-date', '', '   ', 'banana',                         // junk strings (invalid)
    NaN, Infinity, -Infinity,                                  // non-finite numbers (invalid)
    null, undefined, {}, []                                    // other (invalid)
  )
);

// Version values: version-like strings, plain numbers-as-strings, empty/blank,
// and non-strings (which make the recorded version invalid).
const versionValue = fc.oneof(
  fc.constantFrom('1', '1.0', '1.2', '1.10', '2', '2.0.0', '0.9', 'v1.5',
                  '2024-01-01', '2024-06-01', '', '   '),
  fc.string({ minLength: 0, maxLength: 8 }),
  fc.constantFrom(1, 2, null, undefined, true, {})
);

// requiredVersion: missing-bound variants (null/undefined/blank) plus comparable
// versions above/below/equal to the recorded ones.
const requiredVersion = fc.oneof(
  fc.constantFrom(null, undefined, '', '   '),                 // lowest-bound (any satisfies)
  fc.constantFrom('1', '1.0', '1.2', '1.10', '2', '2.0.0', '0.9', 'v1.5',
                  '2024-01-01', '2024-06-01'),
  fc.integer({ min: 0, max: 5 })
);

// An attestation object with each field independently present/absent.
const attestationObj = fc.record({
  curator_id: idValue,
  accepting_user_id: idValue,
  accepted_at: acceptedAt,
  tos_version: versionValue,
  attestation_version: versionValue,
}, { requiredKeys: [] });   // any subset of keys may be present (randomizes presence/absence)

// The full attestation argument: usually an object, sometimes null/undefined/non-object.
const attestationArg = fc.oneof(
  { weight: 8, arbitrary: attestationObj },
  { weight: 2, arbitrary: fc.constantFrom(null, undefined, 0, '', 'x', 42, true, []) }
);

try {
  fc.assert(fc.property(attestationArg, requiredVersion, (attestation, reqVer) => {
    // 1) Never throws (calling it inside the property already proves this).
    const r = ss.ssAttestationComplete(attestation, reqVer);

    // 2) Always returns a strict boolean.
    assert(r === true || r === false,
      `must return a strict boolean, got ${JSON.stringify(r)}`);

    // 3) Matches the independently-computed IFF contract for every input.
    const e = expected(attestation, reqVer);
    assert(r === e,
      `result ${r} != expected ${e} for attestation=${JSON.stringify(attestation)}, requiredVersion=${JSON.stringify(reqVer)}`);

    // 4) Null/undefined/non-object attestation → always false.
    if (!attestation || typeof attestation !== 'object') {
      assert(r === false, 'null/undefined/non-object attestation must be false');
    }

    return true;
  }), { numRuns: ITER });

  // ── Explicit literal cases pinning the contract ──────────────────────────
  const baseValid = {
    curator_id: 'curator-1',
    accepted_at: '2024-01-01T00:00:00Z',
    tos_version: '1.0',
    attestation_version: '1.0',
  };

  // Fully valid, missing requiredVersion → true (lowest bound).
  assert(ss.ssAttestationComplete(baseValid, null) === true, 'valid + null req → true');
  assert(ss.ssAttestationComplete(baseValid, undefined) === true, 'valid + undefined req → true');
  assert(ss.ssAttestationComplete(baseValid, '   ') === true, 'valid + blank req → true');

  // Versions exactly equal to / above / below requiredVersion.
  assert(ss.ssAttestationComplete(baseValid, '1.0') === true, 'equal versions → true');
  assert(ss.ssAttestationComplete(baseValid, '0.9') === true, 'recorded above req → true');
  assert(ss.ssAttestationComplete(baseValid, '2.0') === false, 'recorded below req → false');
  // semantic compare: '1.10' >= '1.2'
  assert(ss.ssAttestationComplete(
    { curator_id: 'c', accepted_at: 0, tos_version: '1.10', attestation_version: '1.10' }, '1.2'
  ) === true, "'1.10' >= '1.2' semantic → true");

  // accepting_user_id alternative key works.
  assert(ss.ssAttestationComplete(
    { accepting_user_id: 'u-9', accepted_at: 0, tos_version: '1', attestation_version: '1' }, null
  ) === true, 'accepting_user_id alternative → true');

  // Each missing/blank field individually → false.
  assert(ss.ssAttestationComplete({ ...baseValid, curator_id: '' }, null) === false, 'empty id → false');
  assert(ss.ssAttestationComplete({ ...baseValid, curator_id: '   ' }, null) === false, 'whitespace id → false');
  assert(ss.ssAttestationComplete({ ...baseValid, accepted_at: 'banana' }, null) === false, 'unparseable accepted_at → false');
  assert(ss.ssAttestationComplete({ ...baseValid, accepted_at: NaN }, null) === false, 'NaN accepted_at → false');
  assert(ss.ssAttestationComplete({ ...baseValid, accepted_at: undefined }, null) === false, 'missing accepted_at → false');
  assert(ss.ssAttestationComplete({ ...baseValid, tos_version: '' }, null) === false, 'empty tos → false');
  assert(ss.ssAttestationComplete({ ...baseValid, tos_version: '  ' }, null) === false, 'whitespace tos → false');
  assert(ss.ssAttestationComplete({ ...baseValid, attestation_version: '' }, null) === false, 'empty att → false');

  // Null / non-object attestation → false.
  assert(ss.ssAttestationComplete(null, null) === false, 'null → false');
  assert(ss.ssAttestationComplete(undefined, '1.0') === false, 'undefined → false');
  assert(ss.ssAttestationComplete('x', null) === false, 'string → false');
  assert(ss.ssAttestationComplete(42, null) === false, 'number → false');

  // One version below req → false even if the other satisfies.
  assert(ss.ssAttestationComplete(
    { curator_id: 'c', accepted_at: 0, tos_version: '2.0', attestation_version: '1.0' }, '2.0'
  ) === false, 'one version below req → false');

  console.log('  \u2713 Property 1');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 1\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
