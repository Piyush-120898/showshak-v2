/* ═══════════════════════════════════════════════════════════════
   tests/prop-selfactivity-collapse.test.js — Node property test for the
   creator-analytics Self_Activity collapse counter
   `ssCountWithSelfCollapse(events, creatorId)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-selfactivity-collapse.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper is PURE.

   EXACT semantics (mirrored by the model below, encoding SQL distinctness):
     count = #{events whose user_id IS DISTINCT FROM creatorId}
           + (1 if any event's user_id SQL-equals creatorId, else 0)
   A guest (user_id null/undefined→null) is DISTINCT FROM a non-null creatorId, so
   guests always count individually; all owner events collapse to exactly one.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

/* SQL-semantics helpers, mirroring _ssEventUserId / _ssIsDistinctFrom / _ssSqlEquals. */
function uid(ev) {
  if (!ev || typeof ev !== 'object') return null;
  const u = ev.user_id;
  return (u === undefined) ? null : u;
}
function isDistinct(a, b) {
  if (a === null && b === null) return false;
  if (a === null || b === null) return true;
  return a !== b;
}
function sqlEquals(a, b) {
  if (a === null || b === null) return false;
  return a === b;
}

/* Independent model formula. */
function modelCount(events, creatorId) {
  if (!Array.isArray(events)) return 0;
  const owner = (creatorId === undefined) ? null : creatorId;
  let nonOwner = 0;
  let hasSelf = false;
  for (const ev of events) {
    const u = uid(ev);
    if (isDistinct(u, owner)) nonOwner++;
    else if (sqlEquals(u, owner)) hasSelf = true;
  }
  return nonOwner + (hasSelf ? 1 : 0);
}

let failed = 0;

console.log('Feature: creator-analytics — Self_Activity collapse property test\n');

// Feature: creator-analytics, Property 5
// Property 5: Self_Activity collapse for views and shares. For any clip owned by
// creatorId and any multiset of events (owner, non-owner, guests, repeats), the
// aggregate counts every non-owner event individually and collapses all owner
// events to exactly one (zero when none exist).
// **Validates: Requirements 1.7, 1.8, 1.9, 3.6, 3.7, 7.6, 10.4**
try {
  const creatorId = fc.constantFrom('owner-1', 'owner-2');
  // user_id pool deliberately includes the owner ids, other users, and guests.
  const userIdPool = fc.constantFrom('owner-1', 'owner-2', 'viewer-x', 'viewer-y', null, undefined);
  // An event is usually { user_id } but occasionally an object missing user_id
  // (→ treated as null guest) to exercise normalization.
  const eventGen = fc.oneof(
    { weight: 8, arbitrary: fc.record({ user_id: userIdPool }) },
    { weight: 1, arbitrary: fc.constant({}) },                   // missing user_id → null
    { weight: 1, arbitrary: fc.record({ user_id: userIdPool, watch_ms: fc.integer() }) }
  );
  const eventsGen = fc.array(eventGen, { maxLength: 30 });

  fc.assert(fc.property(eventsGen, creatorId, (events, owner) => {
    const got = ss.ssCountWithSelfCollapse(events, owner);
    const exp = modelCount(events, owner);
    assert(got === exp, `count ${got} != model ${exp} for owner=${owner} events=${JSON.stringify(events)}`);

    // Self events never contribute more than one in aggregate.
    const ownerEventCount = events.filter((e) => sqlEquals(uid(e), owner)).length;
    const nonOwnerCount = events.filter((e) => isDistinct(uid(e), owner)).length;
    assert(got === nonOwnerCount + (ownerEventCount > 0 ? 1 : 0), 'collapse shape mismatch');
    return true;
  }), { numRuns: ITER });

  // Explicit cases.
  assert(ss.ssCountWithSelfCollapse([], 'owner-1') === 0, 'empty -> 0');
  assert(ss.ssCountWithSelfCollapse([{ user_id: 'owner-1' }, { user_id: 'owner-1' }], 'owner-1') === 1,
    'multiple self events collapse to 1');
  assert(ss.ssCountWithSelfCollapse([{ user_id: 'a' }, { user_id: 'a' }], 'owner-1') === 2,
    'repeat non-owner views counted individually');
  assert(ss.ssCountWithSelfCollapse([{ user_id: null }, { user_id: null }], 'owner-1') === 2,
    'guest views are non-owner and counted individually');
  assert(ss.ssCountWithSelfCollapse([{ user_id: 'owner-1' }, { user_id: 'a' }, { user_id: null }], 'owner-1') === 3,
    'self collapse + non-owner + guest');
  // Non-array → 0.
  assert(ss.ssCountWithSelfCollapse(null, 'owner-1') === 0, 'null -> 0');
  assert(ss.ssCountWithSelfCollapse(undefined, 'owner-1') === 0, 'undefined -> 0');

  console.log('  \u2713 Property 5');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 5\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exitCode = failed ? 1 : 0;
