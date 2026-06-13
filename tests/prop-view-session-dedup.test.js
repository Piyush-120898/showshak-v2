/* ═══════════════════════════════════════════════════════════════
   tests/prop-view-session-dedup.test.js — Node property test for the
   creator-analytics per-session view de-dup decision helper
   `ssShouldRecordView(viewedSet, clipId)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-view-session-dedup.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE — it
   reads the Set but never mutates it; the impure caller marks the id on a `true`
   result.

   EXACT semantics: with no usable Set the helper returns true; otherwise it
   returns `!viewedSet.has(clipId)` and does NOT mutate the Set.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: creator-analytics — view session de-dup property test\n');

// Feature: creator-analytics, Property 3
// Property 3: At most one View_Event per clip per session.
// For any sequence of view attempts within a session, using a real Set that the
// caller updates on a true result, ssShouldRecordView returns true the first
// time a clip id is seen and false thereafter, so each distinct clip is recorded
// at most once per session while distinct clips are each recordable. The helper
// never mutates the Set itself.
// **Validates: Requirements 1.5, 12.4**
try {
  // Draw clip ids from a small pool so repeats are frequent within a sequence.
  const clipId = fc.constantFrom('uuid-a', 'uuid-b', 'uuid-c', 'uuid-d');
  const sequenceGen = fc.array(clipId, { minLength: 0, maxLength: 40 });

  fc.assert(fc.property(sequenceGen, (sequence) => {
    const set = new Set();          // real session set, caller-managed
    const model = new Set();        // independent model of what has been recorded
    const recordCount = Object.create(null);

    for (let i = 0; i < sequence.length; i++) {
      const id = sequence[i];

      const sizeBefore = set.size;
      const hadBefore = set.has(id);

      const result = ss.ssShouldRecordView(set, id);

      // The helper must NOT mutate the Set on its own.
      assert(set.size === sizeBefore, 'helper mutated set size');
      assert(set.has(id) === hadBefore, 'helper mutated set membership');

      // First sighting → true; subsequent → false.
      assert(result === !model.has(id), `decision mismatch for ${id} at ${i}: got ${result}`);

      if (result) {
        // Caller marks on a true result (this is the documented contract).
        set.add(id);
        model.add(id);
        recordCount[id] = (recordCount[id] || 0) + 1;
      }
    }

    // Each distinct id recorded at most once across the whole session.
    for (const k in recordCount) {
      assert(recordCount[k] <= 1, `${k} recorded ${recordCount[k]} times`);
    }
    // Every distinct id that appeared was recorded exactly once.
    const distinct = new Set(sequence);
    distinct.forEach((id) => {
      assert(recordCount[id] === 1, `distinct id ${id} not recorded exactly once`);
    });

    return true;
  }), { numRuns: ITER });

  // Distinct clips are each independently recordable on first sighting.
  {
    const set = new Set();
    assert(ss.ssShouldRecordView(set, 'x') === true, 'first sighting of x must be true');
    set.add('x');
    assert(ss.ssShouldRecordView(set, 'x') === false, 'second sighting of x must be false');
    assert(ss.ssShouldRecordView(set, 'y') === true, 'first sighting of y must be true');
  }

  // Missing / non-Set viewedSet → always true (graceful).
  assert(ss.ssShouldRecordView(null, 'x') === true, 'null set -> true');
  assert(ss.ssShouldRecordView(undefined, 'x') === true, 'undefined set -> true');
  assert(ss.ssShouldRecordView({}, 'x') === true, 'non-Set -> true');

  console.log('  \u2713 Property 3');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 3\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exitCode = failed ? 1 : 0;
