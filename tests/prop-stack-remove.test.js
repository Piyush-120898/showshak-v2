/* ═══════════════════════════════════════════════════════════════
   tests/prop-stack-remove.test.js — Node property test for the
   stack-sharing removal rule `ssCanRemoveStackItem(viewerId, item, stack)`
   in showshak-shared.js. Plain Node + fast-check; run with:
     node tests/prop-stack-remove.test.js

   Install the shared DOM/window stub (tests/_pbt.js) BEFORE requiring
   showshak-shared.js. The helper is PURE.

   EXACT semantics: the owner may remove ANY item; a non-owner may remove ONLY
   an item whose added_by equals them. A non-owner can never remove another
   member's item. owner_id and user_id are both honored as the owner field.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: stack-sharing — removal authority property test\n');

// Feature: stack-sharing, Property 5
// Removal authority: ssCanRemoveStackItem is true iff the viewer is the owner
// OR the original contributor — a non-owner can never remove another member's
// item.
// **Validates: Requirements 8.1, 8.2**
try {
  const person = fc.constantFrom('owner', 'm1', 'm2', 'stranger');
  const ownerKey = fc.constantFrom('owner_id', 'user_id');
  const stackGen = fc.record({ key: ownerKey })
    .map(({ key }) => { const s = {}; s[key] = 'owner'; return s; });
  const itemGen = fc.record({ id: fc.string({ minLength: 1, maxLength: 6 }), added_by: person });

  fc.assert(fc.property(person, itemGen, stackGen, (viewer, item, stack) => {
    const got = ss.ssCanRemoveStackItem(viewer, item, stack);
    const owner = stack.owner_id || stack.user_id;
    const exp = (viewer === owner) || (item.added_by === viewer);
    assert(got === exp, `remove mismatch viewer=${viewer} item=${JSON.stringify(item)} got=${got} exp=${exp}`);
    // Cross-member invariant: a non-owner can NEVER remove an item they didn't add.
    if (viewer !== owner && item.added_by !== viewer) {
      assert(got === false, 'non-owner removed another member\'s item');
    }
    return true;
  }), { numRuns: ITER });

  assert(ss.ssCanRemoveStackItem('owner', { added_by: 'm1' }, { user_id: 'owner' }) === true, 'owner removes any');
  assert(ss.ssCanRemoveStackItem('m1', { added_by: 'm1' }, { user_id: 'owner' }) === true, 'contributor removes own');
  assert(ss.ssCanRemoveStackItem('m1', { added_by: 'm2' }, { user_id: 'owner' }) === false, 'member cannot remove other\'s');
  assert(ss.ssCanRemoveStackItem(null, { added_by: 'm1' }, { user_id: 'owner' }) === false, 'no viewer → false');
  assert(ss.ssCanRemoveStackItem('m1', null, { user_id: 'owner' }) === false, 'no item → false');

  console.log('  \u2713 Property 5');
} catch (e) { failed++; console.log('  \u2717 Property 5\n      ' + e.message); }

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exitCode = failed ? 1 : 0;
