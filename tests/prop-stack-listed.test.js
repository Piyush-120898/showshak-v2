/* ═══════════════════════════════════════════════════════════════
   tests/prop-stack-listed.test.js — Node property test for the
   stack-sharing listing rule `ssStackIsListed(stack)` in showshak-shared.js.
   Plain Node + fast-check; run with:
     node tests/prop-stack-listed.test.js

   Install the shared DOM/window stub (tests/_pbt.js) BEFORE requiring
   showshak-shared.js. The helper is PURE.

   EXACT semantics: listed (on a public profile) iff visibility === 'public'.
   Unlisted is NOT listed (the whole point); unknown values are not listed.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: stack-sharing — listed-iff-public property test\n');

// Feature: stack-sharing, Property 2
// Listed only when public: ssStackIsListed is true iff visibility === 'public'.
// **Validates: Requirements 2.3, 3.4**
try {
  const visGen = fc.constantFrom('private', 'unlisted', 'public', 'friends', '', undefined, 'Public', 'PUBLIC');
  const stackGen = fc.record({
    visibility: visGen,
    highlighted: fc.boolean(),
    user_id: fc.constantFrom('u1', 'u2'),
  });

  fc.assert(fc.property(stackGen, (stack) => {
    const got = ss.ssStackIsListed(stack);
    const exp = stack.visibility === 'public';
    assert(got === exp, `isListed mismatch stack=${JSON.stringify(stack)} got=${got} exp=${exp}`);
    // Invariant: an unlisted stack is never listed.
    if (stack.visibility === 'unlisted') assert(got === false, 'unlisted stack was listed');
    return true;
  }), { numRuns: ITER });

  assert(ss.ssStackIsListed({ visibility: 'public' }) === true, 'public listed');
  assert(ss.ssStackIsListed({ visibility: 'unlisted' }) === false, 'unlisted not listed');
  assert(ss.ssStackIsListed({ visibility: 'private' }) === false, 'private not listed');
  assert(ss.ssStackIsListed(null) === false, 'null → not listed');
  assert(ss.ssStackIsListed({}) === false, 'missing visibility → not listed');

  console.log('  \u2713 Property 2');
} catch (e) { failed++; console.log('  \u2717 Property 2\n      ' + e.message); }

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exitCode = failed ? 1 : 0;
