/* ═══════════════════════════════════════════════════════════════
   tests/prop-stack-join.test.js — Node property test for the
   stack-sharing join rule `ssCanJoinStack(stack, memberCount, cap,
   alreadyMember)` in showshak-shared.js. Plain Node + fast-check; run with:
     node tests/prop-stack-join.test.js

   Install the shared DOM/window stub (tests/_pbt.js) BEFORE requiring
   showshak-shared.js. The helper is PURE.

   EXACT semantics: a join is allowed iff the stack is collaborative AND the
   member count is strictly below the cap AND the joiner is not already a
   member. The cap defaults to SS_STACK_MEMBER_CAP when not a positive number.
   Critically, allowing the join must NEVER let the resulting count exceed cap.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: stack-sharing — join-respects-cap property test\n');

// Feature: stack-sharing, Property 4
// Join respects the cap: ssCanJoinStack is true iff collaborative AND
// memberCount < cap AND not already a member; it never permits membership to
// exceed the cap.
// **Validates: Requirements 6.2, 6.3, 6.4**
try {
  const modeGen = fc.constantFrom('view', 'collaborative', undefined);
  const stackGen = fc.record({ mode: modeGen, user_id: fc.constant('owner') });
  const countGen = fc.integer({ min: 0, max: 12 });
  const capGen = fc.oneof(fc.integer({ min: 1, max: 12 }), fc.constantFrom(undefined, 0, -1, NaN));
  const memberGen = fc.boolean();

  fc.assert(fc.property(stackGen, countGen, capGen, memberGen, (stack, count, cap, already) => {
    const got = ss.ssCanJoinStack(stack, count, cap, already);
    const effCap = (typeof cap === 'number' && cap > 0) ? cap : ss.SS_STACK_MEMBER_CAP;
    const exp = stack.mode === 'collaborative' && !already && count < effCap;
    assert(got === exp, `join mismatch stack=${JSON.stringify(stack)} count=${count} cap=${cap} already=${already} got=${got} exp=${exp}`);
    // Cap invariant: if a join is permitted, the post-join count never exceeds the cap.
    if (got) assert(count + 1 <= effCap, `join would exceed cap: ${count + 1} > ${effCap}`);
    // A view-only stack can never be joined.
    if (stack.mode !== 'collaborative') assert(got === false, 'non-collaborative stack joined');
    // An existing member can never re-join.
    if (already) assert(got === false, 'already-member re-joined');
    return true;
  }), { numRuns: ITER });

  const collab = { mode: 'collaborative', user_id: 'owner' };
  assert(ss.ssCanJoinStack(collab, 0, 6, false) === true, 'empty room joinable');
  assert(ss.ssCanJoinStack(collab, 5, 6, false) === true, 'last slot joinable');
  assert(ss.ssCanJoinStack(collab, 6, 6, false) === false, 'full → denied');
  assert(ss.ssCanJoinStack(collab, 3, 6, true) === false, 'already member → denied');
  assert(ss.ssCanJoinStack({ mode: 'view' }, 0, 6, false) === false, 'view stack → denied');
  assert(ss.ssCanJoinStack(collab, 0, undefined, false) === true, 'default cap applies');
  assert(ss.ssCanJoinStack(collab, ss.SS_STACK_MEMBER_CAP, undefined, false) === false, 'default cap enforced');

  console.log('  \u2713 Property 4');
} catch (e) { failed++; console.log('  \u2717 Property 4\n      ' + e.message); }

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exitCode = failed ? 1 : 0;
