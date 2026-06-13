/* ═══════════════════════════════════════════════════════════════
   tests/prop-owner-scope.test.js — Node property test for the
   creator-analytics owner-scoping filter `ssFilterOwnClips(clips, callerId)`
   in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-owner-scope.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper is PURE.

   EXACT semantics: returns exactly the clips whose `creator_id` STRICTLY equals
   `callerId`; non-object entries are skipped; a non-array `clips` yields [].
   Mirrors the 0019 `my_clips` CTE (`where creator_id = auth.uid()`).
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

/* Independent model. */
function modelFilter(clips, callerId) {
  if (!Array.isArray(clips)) return [];
  return clips.filter((c) => c && typeof c === 'object' && c.creator_id === callerId);
}

let failed = 0;

console.log('Feature: creator-analytics — owner-scope filter property test\n');

// Feature: creator-analytics, Property 8
// Property 8: Aggregates are scoped to the caller's own clips. For any set of
// clips with mixed owners and any caller id, ssFilterOwnClips returns exactly the
// clips whose creator_id equals the caller, so events on clips the caller does
// not own never contribute.
// **Validates: Requirements 7.1, 7.4, 10.2, 11.1**
try {
  const ownerPool = fc.constantFrom('owner-1', 'owner-2', 'owner-3');
  const clipObj = fc.record({
    id: fc.string({ minLength: 1, maxLength: 8 }),
    creator_id: ownerPool,
  });
  // Mix valid clip objects with non-object junk (must be skipped).
  const clipEntry = fc.oneof(
    { weight: 9, arbitrary: clipObj },
    { weight: 1, arbitrary: fc.constantFrom(null, undefined, 5, 'x', true) }
  );
  const clipsGen = fc.array(clipEntry, { maxLength: 20 });
  const callerGen = fc.constantFrom('owner-1', 'owner-2', 'owner-3', 'nobody');

  fc.assert(fc.property(clipsGen, callerGen, (clips, caller) => {
    const got = ss.ssFilterOwnClips(clips, caller);
    const exp = modelFilter(clips, caller);

    assert(got.length === exp.length, `length ${got.length} != ${exp.length}`);
    for (let i = 0; i < got.length; i++) {
      assert(got[i] === exp[i], `entry ${i} differs (reference identity)`);
    }
    // Every returned clip is owned by the caller; nothing else leaks in.
    got.forEach((c) => assert(c.creator_id === caller, `returned clip not owned by caller`));
    // Inclusion is exactly iff creator_id === caller, for every valid clip.
    clips.forEach((c) => {
      if (c && typeof c === 'object') {
        const included = got.indexOf(c) !== -1;
        assert(included === (c.creator_id === caller), `inclusion mismatch for ${JSON.stringify(c)}`);
      }
    });
    return true;
  }), { numRuns: ITER });

  // Explicit cases.
  const a = { id: '1', creator_id: 'owner-1' };
  const b = { id: '2', creator_id: 'owner-2' };
  const c = { id: '3', creator_id: 'owner-1' };
  assert(JSON.stringify(ss.ssFilterOwnClips([a, b, c], 'owner-1')) === JSON.stringify([a, c]),
    'owner-1 keeps a,c');
  assert(JSON.stringify(ss.ssFilterOwnClips([a, b, c], 'nobody')) === JSON.stringify([]),
    'unknown caller keeps none');
  assert(JSON.stringify(ss.ssFilterOwnClips([a, null, undefined, 5, b], 'owner-2')) === JSON.stringify([b]),
    'non-object entries skipped');
  assert(JSON.stringify(ss.ssFilterOwnClips(null, 'owner-1')) === JSON.stringify([]), 'non-array -> []');

  console.log('  \u2713 Property 8');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 8\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exitCode = failed ? 1 : 0;
