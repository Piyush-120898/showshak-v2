/* ═══════════════════════════════════════════════════════════════
   tests/prop-recordable-clip.test.js — Node property test for the
   creator-analytics mock/prototype-clip skip helper `ssIsRecordableClipId(id)`
   in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-recordable-clip.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (takes any value, returns a boolean), so the stub never affects behaviour.

   EXACT semantics (mirrored by this test's oracle): the helper returns false for
   null/undefined, and otherwise `/^[0-9a-f-]{36}$/i.test(String(id))` — i.e. true
   IFF the id is a 36-char uuid form (hex digits + dashes, case-insensitive). So
   persisted content rows (uuid ids) are recordable; prototype integer ids, null,
   undefined and malformed strings are not.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

/* Independent oracle mirroring the helper's documented rule. */
function expected(id) {
  if (id === null || id === undefined) return false;
  return /^[0-9a-f-]{36}$/i.test(String(id));
}

let failed = 0;

console.log('Feature: creator-analytics — recordable clip id property test\n');

// Feature: creator-analytics, Property 1
// Property 1: Mock/prototype clips are never recorded.
// For any clip id, ssIsRecordableClipId(id) is true IFF the id is a persisted
// content row id (36-char uuid form), and false for prototype integer ids, null,
// undefined and malformed strings.
// **Validates: Requirements 1.6, 2.6, 3.5, 12.4**
try {
  const hexChar = fc.constantFrom.apply(fc, '0123456789abcdefABCDEF'.split(''));
  const hex = (n) => fc.array(hexChar, { minLength: n, maxLength: n }).map((a) => a.join(''));
  // Canonical 8-4-4-4-12 uuid form (32 hex + 4 dashes = 36 chars).
  const uuidGen = fc.tuple(hex(8), hex(4), hex(4), hex(4), hex(12)).map((p) => p.join('-'));

  // Integer (prototype) ids — never 36 hex/dash chars.
  const intGen = fc.oneof(fc.integer(), fc.nat(), fc.constantFrom(1, 2, 3, 42, 0, -7));

  // Nullish + non-string junk.
  const junkGen = fc.constantFrom(null, undefined, true, false, {}, [], NaN);

  // Arbitrary strings (almost never 36-char uuid form) + near-miss lengths.
  const strGen = fc.oneof(
    fc.string(),
    fc.string({ minLength: 35, maxLength: 35 }),
    fc.string({ minLength: 37, maxLength: 37 }),
    // 36 chars but containing a non-hex char (e.g. 'z') → must be false.
    hex(35).map((s) => s + 'z')
  );

  const anyId = fc.oneof(
    { weight: 5, arbitrary: uuidGen },
    { weight: 3, arbitrary: intGen },
    { weight: 2, arbitrary: junkGen },
    { weight: 4, arbitrary: strGen }
  );

  fc.assert(fc.property(anyId, (id) => {
    const got = ss.ssIsRecordableClipId(id);
    const exp = expected(id);
    assert(got === exp, `ssIsRecordableClipId(${JSON.stringify(id)}) = ${got}, expected ${exp}`);
    assert(typeof got === 'boolean', 'result must be boolean');
    return true;
  }), { numRuns: ITER });

  // A generated valid uuid is always recordable.
  fc.assert(fc.property(uuidGen, (u) => {
    assert(ss.ssIsRecordableClipId(u) === true, `valid uuid not recordable: ${u}`);
    return true;
  }), { numRuns: ITER });

  // Explicit cases from the design.
  assert(ss.ssIsRecordableClipId('00000000-0000-0000-0000-000000000000') === true, 'zero uuid must be recordable');
  assert(ss.ssIsRecordableClipId(1) === false, 'integer id must not be recordable');
  assert(ss.ssIsRecordableClipId(42) === false, 'integer id must not be recordable');
  assert(ss.ssIsRecordableClipId(null) === false, 'null must not be recordable');
  assert(ss.ssIsRecordableClipId(undefined) === false, 'undefined must not be recordable');
  assert(ss.ssIsRecordableClipId('not-a-uuid') === false, 'malformed string must not be recordable');
  assert(ss.ssIsRecordableClipId('') === false, 'empty string must not be recordable');

  console.log('  \u2713 Property 1');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 1\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exitCode = failed ? 1 : 0;
