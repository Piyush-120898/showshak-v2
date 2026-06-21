/* ═══════════════════════════════════════════════════════════════
   tests/prop-stack-shelf.test.js — Node property test for the
   stack-sharing profile-placement rule `ssStackShelfPlacement(stack)` in
   showshak-shared.js. Plain Node + fast-check; run with:
     node tests/prop-stack-shelf.test.js

   Install the shared DOM/window stub (tests/_pbt.js) BEFORE requiring
   showshak-shared.js. The helper is PURE.

   EXACT semantics: 'highlights' iff public AND highlighted; 'folder' iff
   public AND not highlighted; 'none' for every non-public stack (highlighted
   is meaningless unless public — it must NEVER place a non-public stack).
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: stack-sharing — shelf placement property test\n');

// Feature: stack-sharing, Property 3
// Shelf placement: returns 'highlights' iff public+highlighted, 'folder' iff
// public+not-highlighted, 'none' otherwise — never places a non-public stack.
// **Validates: Requirements 3.2, 3.3**
try {
  const visGen = fc.constantFrom('private', 'unlisted', 'public', 'friends', undefined);
  // highlighted is intentionally messy (truthy/falsy non-booleans) to prove the
  // rule only ever returns the three valid placements.
  const hlGen = fc.constantFrom(true, false, undefined, null, 1, 0, 'yes', '');
  const stackGen = fc.record({ visibility: visGen, highlighted: hlGen, user_id: fc.constant('u1') });

  fc.assert(fc.property(stackGen, (stack) => {
    const got = ss.ssStackShelfPlacement(stack);
    assert(got === 'highlights' || got === 'folder' || got === 'none',
      `placement not in enum: ${got}`);
    if (stack.visibility !== 'public') {
      assert(got === 'none', `non-public stack placed in ${got}`);
    } else {
      assert(got === (stack.highlighted ? 'highlights' : 'folder'),
        `public placement mismatch hl=${stack.highlighted} got=${got}`);
    }
    return true;
  }), { numRuns: ITER });

  assert(ss.ssStackShelfPlacement({ visibility: 'public', highlighted: true }) === 'highlights', 'public+hl → highlights');
  assert(ss.ssStackShelfPlacement({ visibility: 'public', highlighted: false }) === 'folder', 'public → folder');
  assert(ss.ssStackShelfPlacement({ visibility: 'unlisted', highlighted: true }) === 'none', 'unlisted+hl → none');
  assert(ss.ssStackShelfPlacement({ visibility: 'private', highlighted: true }) === 'none', 'private+hl → none');
  assert(ss.ssStackShelfPlacement(null) === 'none', 'null → none');

  console.log('  \u2713 Property 3');
} catch (e) { failed++; console.log('  \u2717 Property 3\n      ' + e.message); }

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exitCode = failed ? 1 : 0;
