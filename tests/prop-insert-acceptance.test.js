/* ═══════════════════════════════════════════════════════════════
   tests/prop-insert-acceptance.test.js — Node property test for the
   creator-analytics insert-acceptance model `ssEventInsertAccepted(viewerId,
   payloadUserId)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-insert-acceptance.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper is PURE.

   EXACT semantics: models the 0019 `with check (user_id is not distinct from
   auth.uid())` insert RLS. Accept IFF payloadUserId IS NOT DISTINCT FROM viewerId
   (signed-in → equal own id; guest null/undefined → null/undefined). Forged or
   mismatched ids are rejected. undefined is treated as null (Guest) on both sides.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function norm(v) { return (v === undefined) ? null : v; }
function isDistinct(a, b) {
  if (a === null && b === null) return false;
  if (a === null || b === null) return true;
  return a !== b;
}
/* Independent model: accept iff NOT distinct. */
function modelAccept(viewerId, payloadUserId) {
  return !isDistinct(norm(payloadUserId), norm(viewerId));
}

let failed = 0;

console.log('Feature: creator-analytics — insert acceptance property test\n');

// Feature: creator-analytics, Property 9
// Property 9: Insert-payload acceptance mirrors the anti-spoofing rule. For any
// viewer identity (signed-in id or guest) and any proposed payload user_id, the
// model accepts IFF the payload user_id is not distinct from the viewer's
// identity, and rejects every other value.
// **Validates: Requirements 5.2, 5.3, 5.4**
try {
  const idPool = fc.constantFrom('user-a', 'user-b', 'user-c');
  const viewerGen = fc.oneof(
    { weight: 6, arbitrary: idPool },                       // signed-in
    { weight: 4, arbitrary: fc.constantFrom(null, undefined) } // guest
  );
  const payloadGen = fc.oneof(
    { weight: 6, arbitrary: idPool },
    { weight: 4, arbitrary: fc.constantFrom(null, undefined) }
  );

  fc.assert(fc.property(viewerGen, payloadGen, (viewer, payload) => {
    const got = ss.ssEventInsertAccepted(viewer, payload);
    const exp = modelAccept(viewer, payload);
    assert(got === exp, `accept ${got} != model ${exp} for viewer=${JSON.stringify(viewer)} payload=${JSON.stringify(payload)}`);
    assert(typeof got === 'boolean', 'result must be boolean');
    return true;
  }), { numRuns: ITER });

  // Signed-in viewer: accept only their own id; reject any other id and reject null.
  fc.assert(fc.property(idPool, payloadGen, (viewer, payload) => {
    const got = ss.ssEventInsertAccepted(viewer, payload);
    assert(got === (norm(payload) === viewer), 'signed-in must accept only own id');
    return true;
  }), { numRuns: ITER });

  // Guest viewer: accept only null/undefined payload; reject any forged id.
  fc.assert(fc.property(fc.constantFrom(null, undefined), payloadGen, (viewer, payload) => {
    const got = ss.ssEventInsertAccepted(viewer, payload);
    assert(got === (norm(payload) === null), 'guest must accept only null payload');
    return true;
  }), { numRuns: ITER });

  // Explicit cases.
  assert(ss.ssEventInsertAccepted('user-a', 'user-a') === true, 'signed-in own id accepted');
  assert(ss.ssEventInsertAccepted('user-a', 'user-b') === false, 'forged id rejected');
  assert(ss.ssEventInsertAccepted('user-a', null) === false, 'signed-in null payload rejected');
  assert(ss.ssEventInsertAccepted(null, null) === true, 'guest null accepted');
  assert(ss.ssEventInsertAccepted(undefined, undefined) === true, 'guest undefined accepted');
  assert(ss.ssEventInsertAccepted(null, 'user-a') === false, 'guest forged id rejected');

  console.log('  \u2713 Property 9');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 9\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exitCode = failed ? 1 : 0;
