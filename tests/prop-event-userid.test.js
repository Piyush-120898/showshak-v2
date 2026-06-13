/* ═══════════════════════════════════════════════════════════════
   tests/prop-event-userid.test.js — Node property test for the
   creator-analytics insert-payload user_id resolution helper
   `ssResolveEventUserId(currentUser)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-event-userid.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE.

   EXACT semantics (mirrored by the oracle): a signed-in user OBJECT whose `id`
   is a non-empty string resolves to that id; everything else (guest null /
   undefined, an object without a usable string id, an empty-string id, a
   non-object) resolves to null. The helper NEVER returns any other value.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

/* Independent oracle mirroring the helper's documented rule. */
function expected(user) {
  if (user && typeof user === 'object') {
    const id = user.id;
    if (typeof id === 'string' && id) return id;
  }
  return null;
}

let failed = 0;

console.log('Feature: creator-analytics — event user_id resolution property test\n');

// Feature: creator-analytics, Property 2
// Property 2: Insert user_id resolves to the viewer or null.
// For any current-user value, ssResolveEventUserId(user) returns the user's id
// when a signed-in user object with a non-empty string id is present, and null
// for a guest (null/undefined/object without a usable id) — never any other value.
// **Validates: Requirements 1.2, 1.3, 2.3, 2.4, 3.2, 3.3, 5.2, 5.3**
try {
  const nonEmptyId = fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s.length > 0);

  // A signed-in user object: has a non-empty string id, plus arbitrary extra keys.
  const signedIn = fc.record({
    id: nonEmptyId,
    email: fc.option(fc.string(), { nil: undefined }),
    name: fc.option(fc.string(), { nil: undefined }),
  });

  // A guest / non-resolving user: null, undefined, non-objects, or objects whose
  // id is missing / empty / not a string.
  const guest = fc.oneof(
    fc.constantFrom(null, undefined, true, false, 0, 42, 'a-string'),
    fc.record({ id: fc.constantFrom('', null, undefined, 5, true, {}) }),
    fc.record({ email: fc.string() }),         // object without an id at all
    fc.constant({})
  );

  const userGen = fc.oneof(
    { weight: 5, arbitrary: signedIn },
    { weight: 5, arbitrary: guest }
  );

  fc.assert(fc.property(userGen, (user) => {
    const got = ss.ssResolveEventUserId(user);
    const exp = expected(user);
    assert(got === exp, `ssResolveEventUserId(${JSON.stringify(user)}) = ${JSON.stringify(got)}, expected ${JSON.stringify(exp)}`);
    // Result is only ever a non-empty string (signed-in) or null (guest).
    assert(got === null || (typeof got === 'string' && got.length > 0), `result must be null or non-empty string, got ${JSON.stringify(got)}`);
    return true;
  }), { numRuns: ITER });

  // Signed-in always yields exactly the user's id.
  fc.assert(fc.property(signedIn, (user) => {
    assert(ss.ssResolveEventUserId(user) === user.id, 'signed-in must resolve to user.id');
    return true;
  }), { numRuns: ITER });

  // Explicit cases.
  assert(ss.ssResolveEventUserId({ id: 'abc' }) === 'abc', 'object id resolves');
  assert(ss.ssResolveEventUserId(null) === null, 'null guest -> null');
  assert(ss.ssResolveEventUserId(undefined) === null, 'undefined guest -> null');
  assert(ss.ssResolveEventUserId({}) === null, 'object without id -> null');
  assert(ss.ssResolveEventUserId({ id: '' }) === null, 'empty id -> null');
  assert(ss.ssResolveEventUserId({ id: 5 }) === null, 'non-string id -> null');
  assert(ss.ssResolveEventUserId('xyz') === null, 'non-object -> null');

  console.log('  \u2713 Property 2');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 2\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exitCode = failed ? 1 : 0;
