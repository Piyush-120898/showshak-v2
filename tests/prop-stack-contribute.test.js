/* ═══════════════════════════════════════════════════════════════
   tests/prop-stack-contribute.test.js — Node property test for the
   stack-sharing contribution rule `ssCanContribute(viewerId, stack,
   memberIds)` in showshak-shared.js. Plain Node + fast-check; run with:
     node tests/prop-stack-contribute.test.js

   Install the shared DOM/window stub (tests/_pbt.js) BEFORE requiring
   showshak-shared.js. The helper is PURE.

   EXACT semantics: a viewer may contribute iff the stack is collaborative AND
   the viewer is a member (the owner is always a member). A view-only stack
   admits NO contributors (not even the owner — adds go through the normal
   owner path, not the collaborative one).
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: stack-sharing — contribution authority property test\n');

// Feature: stack-sharing, Property 6
// Contribution authority: ssCanContribute is true iff the stack is
// collaborative AND the viewer is a member (owner included).
// **Validates: Requirements 7.1**
try {
  const person = fc.constantFrom('owner', 'm1', 'm2', 'stranger', null, undefined);
  const modeGen = fc.constantFrom('view', 'collaborative', undefined);
  const stackGen = fc.record({ mode: modeGen, user_id: fc.constant('owner') });
  const membersGen = fc.subarray(['owner', 'm1', 'm2'], { minLength: 0, maxLength: 3 });
  // Sometimes pass a non-array to prove robustness.
  const membersArg = fc.oneof({ weight: 9, arbitrary: membersGen },
                              { weight: 1, arbitrary: fc.constantFrom(null, undefined, 'm1') });

  fc.assert(fc.property(person, stackGen, membersArg, (viewer, stack, members) => {
    const got = ss.ssCanContribute(viewer, stack, members);
    const owner = stack.user_id;
    const isMember = !!viewer && ((viewer === owner) || (Array.isArray(members) && members.indexOf(viewer) !== -1));
    const exp = !!viewer && stack.mode === 'collaborative' && isMember;
    assert(got === exp, `contribute mismatch viewer=${viewer} stack=${JSON.stringify(stack)} members=${JSON.stringify(members)} got=${got} exp=${exp}`);
    // View-only stacks admit no collaborative contributors.
    if (stack.mode !== 'collaborative') assert(got === false, 'contributed to non-collaborative stack');
    return true;
  }), { numRuns: ITER });

  const collab = { mode: 'collaborative', user_id: 'owner' };
  assert(ss.ssCanContribute('owner', collab, []) === true, 'owner always contributes');
  assert(ss.ssCanContribute('m1', collab, ['m1']) === true, 'member contributes');
  assert(ss.ssCanContribute('m2', collab, ['m1']) === false, 'non-member blocked');
  assert(ss.ssCanContribute('owner', { mode: 'view', user_id: 'owner' }, []) === false, 'view stack → no collab contribute');
  assert(ss.ssCanContribute(null, collab, []) === false, 'no viewer → false');

  console.log('  \u2713 Property 6');
} catch (e) { failed++; console.log('  \u2717 Property 6\n      ' + e.message); }

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exitCode = failed ? 1 : 0;
