/* ═══════════════════════════════════════════════════════════════
   tests/prop-fire-count.test.js — Node property test for the
   creator-analytics fire counter `ssCountFires(records)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-fire-count.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper is PURE.

   EXACT semantics: at most one fire per DISTINCT user (owner included), so
   duplicate records for the same user collapse — ssCountFires(records) equals the
   number of distinct user_id values (undefined normalized to null). A non-array
   input yields 0.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function uid(ev) {
  if (!ev || typeof ev !== 'object') return null;
  const u = ev.user_id;
  return (u === undefined) ? null : u;
}
/* Independent model: number of distinct normalized user_id values. */
function modelCount(records) {
  if (!Array.isArray(records)) return 0;
  const users = new Set();
  for (const r of records) users.add(uid(r));
  return users.size;
}

let failed = 0;

console.log('Feature: creator-analytics — fire count property test\n');

// Feature: creator-analytics, Property 7
// Property 7: Fires count at most one per user per clip. For any clip and any set
// of fire records, the fire aggregate equals the number of distinct users who
// fired that clip (owner included), regardless of duplicate records per user.
// **Validates: Requirements 4.1, 4.4, 7.7, 10.4**
try {
  // user_id pool with frequent repeats + owner + guests, to exercise collapse.
  const userIdPool = fc.constantFrom('owner-1', 'user-a', 'user-b', 'user-c', null, undefined);
  const fireRecord = fc.oneof(
    { weight: 8, arbitrary: fc.record({ user_id: userIdPool }) },
    { weight: 1, arbitrary: fc.constant({}) },                               // missing -> null
    { weight: 1, arbitrary: fc.record({ user_id: userIdPool, content_id: fc.constant('clip-1') }) }
  );
  const recordsGen = fc.array(fireRecord, { maxLength: 40 });

  fc.assert(fc.property(recordsGen, (records) => {
    const got = ss.ssCountFires(records);
    const exp = modelCount(records);
    assert(got === exp, `count ${got} != distinct-users ${exp} for ${JSON.stringify(records)}`);
    // Never exceeds the number of records.
    assert(got <= records.length, 'count exceeds record count');
    return true;
  }), { numRuns: ITER });

  // Duplicate records for the same user collapse to one.
  fc.assert(fc.property(fc.nat({ max: 30 }), (n) => {
    const records = [];
    for (let i = 0; i < n; i++) records.push({ user_id: 'user-a' });
    assert(ss.ssCountFires(records) === (n > 0 ? 1 : 0), 'same-user duplicates must collapse to one');
    return true;
  }), { numRuns: ITER });

  // Non-array → 0.
  const nonArray = fc.constantFrom(null, undefined, 0, 42, 'x', {}, true);
  fc.assert(fc.property(nonArray, (v) => {
    assert(ss.ssCountFires(v) === 0, `non-array ${JSON.stringify(v)} must yield 0`);
    return true;
  }), { numRuns: ITER });

  // Explicit cases.
  assert(ss.ssCountFires([]) === 0, 'empty -> 0');
  assert(ss.ssCountFires([{ user_id: 'a' }, { user_id: 'a' }, { user_id: 'b' }]) === 2, 'distinct users a,b -> 2');
  assert(ss.ssCountFires([{ user_id: 'owner-1' }]) === 1, 'owner fire counted');
  assert(ss.ssCountFires([{ user_id: null }, { user_id: null }]) === 1, 'guest fires collapse to one null key');
  assert(ss.ssCountFires(null) === 0, 'null -> 0');

  console.log('  \u2713 Property 7');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 7\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exitCode = failed ? 1 : 0;
