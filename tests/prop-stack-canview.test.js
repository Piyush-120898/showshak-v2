/* ═══════════════════════════════════════════════════════════════
   tests/prop-stack-canview.test.js — Node property test for the
   stack-sharing view-access rule `ssStackCanView(viewerId, stack)` in
   showshak-shared.js. Plain Node + fast-check; run with:
     node tests/prop-stack-canview.test.js

   showshak-shared.js runs DOM setup at load, so install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper is PURE.

   EXACT semantics: the owner can view regardless of visibility; any other
   viewer can view iff visibility is NOT 'private'. Unknown/missing visibility
   collapses to 'private' (never leak). owner_id and user_id are both honored.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: stack-sharing — view access property test\n');

// Feature: stack-sharing, Property 1
// View access: ssStackCanView is true for the owner regardless of visibility,
// and for any viewer when visibility !== 'private'; false only for a non-owner
// on a private stack.
// **Validates: Requirements 2.1, 2.2, 4.2**
try {
  const idGen  = fc.constantFrom('u1', 'u2', 'u3', 'owner', null, undefined, '');
  const visGen = fc.constantFrom('private', 'unlisted', 'public', 'friends', '', undefined, 'PUBLIC');
  const ownerKey = fc.constantFrom('owner_id', 'user_id'); // both shapes must work
  const stackGen = fc.record({ owner: fc.constantFrom('u1', 'u2', 'owner'), visibility: visGen, key: ownerKey })
    .map(({ owner, visibility, key }) => { const s = { visibility }; s[key] = owner; return s; });

  fc.assert(fc.property(idGen, stackGen, (viewer, stack) => {
    const got = ss.ssStackCanView(viewer, stack);
    const owner = stack.owner_id || stack.user_id;
    const isOwner = !!viewer && !!owner && viewer === owner;
    const notPrivate = stack.visibility === 'unlisted' || stack.visibility === 'public';
    const exp = isOwner || notPrivate;
    assert(got === exp, `canView mismatch viewer=${viewer} stack=${JSON.stringify(stack)} got=${got} exp=${exp}`);
    // Privacy invariant: a private stack is NEVER viewable by a non-owner.
    if (!notPrivate && !isOwner) assert(got === false, 'private stack leaked to non-owner');
    return true;
  }), { numRuns: ITER });

  // Explicit cases.
  assert(ss.ssStackCanView('owner', { user_id: 'owner', visibility: 'private' }) === true, 'owner sees own private');
  assert(ss.ssStackCanView('stranger', { user_id: 'owner', visibility: 'private' }) === false, 'stranger blocked on private');
  assert(ss.ssStackCanView('stranger', { user_id: 'owner', visibility: 'unlisted' }) === true, 'stranger sees unlisted');
  assert(ss.ssStackCanView('stranger', { owner_id: 'owner', visibility: 'public' }) === true, 'stranger sees public');
  assert(ss.ssStackCanView(null, null) === false, 'null stack → false');
  assert(ss.ssStackCanView('stranger', { user_id: 'owner', visibility: 'friends' }) === false, 'legacy friends value → private (no leak)');

  console.log('  \u2713 Property 1');
} catch (e) { failed++; console.log('  \u2717 Property 1\n      ' + e.message); }

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exitCode = failed ? 1 : 0;
