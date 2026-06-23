/* ═══════════════════════════════════════════════════════════════
   tests/prop-feed-evict-lru.test.js — Node property test for the
   feed-clip-load-performance Segment_Cache eviction LRU ordering
   `ssSegmentEvictionPlan(input)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-feed-evict-lru.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE.

   TDD NOTE: `ssSegmentEvictionPlan` does NOT exist yet — it is implemented in
   task 21. This file is authored FIRST (Phase 4, task 20.2) and is EXPECTED TO
   FAIL ("not implemented yet") until then; the failure is guarded into a clean
   assertion failure (not a crash).

   Property — among IN-WINDOW segments (those whose clipDistance lies in
   [-windowBehind, +windowAhead]), eviction is least-recently-used: no evicted
   in-window segment may have a NEWER lastUsed than any KEPT in-window segment.
   (Out-of-window segments are always evicted regardless of recency, so they are
   excluded from this ordering check — see Property 6 for their guarantee.)
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: feed-clip-load-performance — eviction LRU ordering property test\n');

const isOutOfWindow = (seg, windowAhead, windowBehind) =>
  seg.clipDistance < -windowBehind || seg.clipDistance > windowAhead;

// Feature: feed-clip-load-performance, Property 7: Eviction respects LRU order
// **Validates: Requirements 4.5**
try {
  // Guard: the function must exist (red until task 21 implements it).
  assert(typeof ss.ssSegmentEvictionPlan === 'function',
    'ssSegmentEvictionPlan is not implemented yet (expected until task 21)');

  const recordGen = fc.record({
    bytes: fc.integer({ min: 0, max: 30 * 1024 * 1024 }),
    lastUsed: fc.integer({ min: 0, max: 1000000 }),
    clipDistance: fc.integer({ min: -10, max: 10 }),
  });
  const recordsGen = fc.array(recordGen, { minLength: 0, maxLength: 30 });
  // Ceilings biased small so in-window LRU eviction is actually exercised.
  const ceilingGen = fc.integer({ min: 0, max: 60 * 1024 * 1024 });
  const windowGen = fc.integer({ min: 0, max: 6 });

  fc.assert(fc.property(recordsGen, ceilingGen, windowGen, windowGen,
    (records, ceilingBytes, windowAhead, windowBehind) => {
      const segments = records.map((r, i) => ({
        key: 'k' + i, bytes: r.bytes, lastUsed: r.lastUsed, clipDistance: r.clipDistance,
      }));
      const byKey = new Map(segments.map((s) => [s.key, s]));

      const result = ss.ssSegmentEvictionPlan({ segments, ceilingBytes, windowAhead, windowBehind });
      assert(result && Array.isArray(result.evict) && Array.isArray(result.keep),
        'result must be { evict:[], keep:[] }');

      const evictSet = new Set(result.evict);
      const keepSet = new Set(result.keep);

      // Restrict to in-window segments.
      const inWindow = segments.filter((s) => !isOutOfWindow(s, windowAhead, windowBehind));
      const evictedInWindow = inWindow.filter((s) => evictSet.has(s.key));
      const keptInWindow = inWindow.filter((s) => keepSet.has(s.key));

      if (evictedInWindow.length > 0 && keptInWindow.length > 0) {
        const newestEvicted = Math.max(...evictedInWindow.map((s) => s.lastUsed));
        const oldestKept = Math.min(...keptInWindow.map((s) => s.lastUsed));
        assert(newestEvicted <= oldestKept,
          `LRU violated: evicted in-window lastUsed ${newestEvicted} is newer than kept in-window lastUsed ${oldestKept}`);
      }

      return true;
    }), { numRuns: ITER });

  // ── Explicit example assertions ──
  // Three in-window segments, ceiling fits one → the two oldest are shed, newest kept.
  {
    const segments = [
      { key: 'a', bytes: 100, lastUsed: 1, clipDistance: 0 },
      { key: 'b', bytes: 100, lastUsed: 5, clipDistance: 1 },
      { key: 'c', bytes: 100, lastUsed: 9, clipDistance: 2 },
    ];
    const r = ss.ssSegmentEvictionPlan({ segments, ceilingBytes: 100, windowAhead: 5, windowBehind: 5 });
    const evictSet = new Set(r.evict);
    const keepSet = new Set(r.keep);
    // Whatever is kept among in-window must be newer than whatever is evicted.
    const evictedNewest = ['a', 'b', 'c'].filter((k) => evictSet.has(k))
      .map((k) => segments.find((s) => s.key === k).lastUsed);
    const keptOldest = ['a', 'b', 'c'].filter((k) => keepSet.has(k))
      .map((k) => segments.find((s) => s.key === k).lastUsed);
    if (evictedNewest.length && keptOldest.length) {
      assert(Math.max(...evictedNewest) <= Math.min(...keptOldest), 'newest kept, oldest evicted');
    }
    assert(keepSet.has('c'), 'most-recently-used in-window segment is kept');
  }

  console.log('  \u2713 Property 7');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 7\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
