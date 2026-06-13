/* ═══════════════════════════════════════════════════════════════
   tests/prop-watch-count.test.js — Node property test for the
   creator-analytics watch counter `ssCountWatch(events)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-watch-count.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper is PURE.

   EXACT semantics: every Watch_Event counts — no de-dup, no self-collapse — so
   ssCountWatch(events) === events.length for any array (owner taps and repeats
   included); a non-array input yields 0.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: creator-analytics — watch count property test\n');

// Feature: creator-analytics, Property 6
// Property 6: Watch It taps count every event with no collapse. For any clip and
// any multiset of Watch_Events, the watch aggregate equals the total number of
// events — owner taps and repeated taps by the same viewer are each counted.
// **Validates: Requirements 2.7, 2.8, 7.7, 10.4**
try {
  // Watch events can repeat by the same user and include owner taps.
  const watchEvent = fc.record({
    user_id: fc.constantFrom('owner-1', 'viewer-x', 'viewer-x', null, undefined),
    content_id: fc.constant('clip-1'),
  });
  const eventsGen = fc.array(watchEvent, { maxLength: 40 });

  fc.assert(fc.property(eventsGen, (events) => {
    const got = ss.ssCountWatch(events);
    assert(got === events.length, `count ${got} != length ${events.length}`);
    return true;
  }), { numRuns: ITER });

  // Repeated taps by the same viewer all count (no de-dup).
  fc.assert(fc.property(fc.nat({ max: 50 }), (n) => {
    const events = [];
    for (let i = 0; i < n; i++) events.push({ user_id: 'viewer-x', content_id: 'clip-1' });
    assert(ss.ssCountWatch(events) === n, 'repeated same-viewer taps must all count');
    return true;
  }), { numRuns: ITER });

  // Non-array → 0.
  const nonArray = fc.constantFrom(null, undefined, 0, 42, 'x', {}, true);
  fc.assert(fc.property(nonArray, (v) => {
    assert(ss.ssCountWatch(v) === 0, `non-array ${JSON.stringify(v)} must yield 0`);
    return true;
  }), { numRuns: ITER });

  // Explicit cases.
  assert(ss.ssCountWatch([]) === 0, 'empty -> 0');
  assert(ss.ssCountWatch([{}, {}, {}]) === 3, 'three events -> 3');
  assert(ss.ssCountWatch([{ user_id: 'owner-1' }, { user_id: 'owner-1' }]) === 2, 'owner taps counted, no collapse');
  assert(ss.ssCountWatch(null) === 0, 'null -> 0');

  console.log('  \u2713 Property 6');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 6\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exitCode = failed ? 1 : 0;
