/* ═══════════════════════════════════════════════════════════════
   tests/prop-feed-evict-ceiling.test.js — Node property test for the
   feed-clip-load-performance service-worker Segment_Cache eviction planner
   `ssSegmentEvictionPlan(input)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-feed-evict-ceiling.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE — it
   operates on a snapshot the SW passes in (segments + ceiling + window), so the
   stub never affects behaviour.

   TDD NOTE: `ssSegmentEvictionPlan` does NOT exist yet — it is implemented in
   task 21. This file is authored FIRST (Phase 4, task 20.1) and is EXPECTED TO
   FAIL ("not implemented yet") until then; the failure is guarded into a clean
   assertion failure (not a crash).

   Contract — ssSegmentEvictionPlan(input) → { evict: key[], keep: key[] }
     input = { segments:[{key,bytes,lastUsed,clipDistance}], ceilingBytes,
               windowAhead, windowBehind }
     (1) a segment is OUT-OF-WINDOW iff clipDistance < -windowBehind
         OR clipDistance > windowAhead;
     (2) evict ALL out-of-window first (oldest lastUsed first);
     (3) if total KEPT bytes still exceed ceilingBytes, evict in-window LRU
         (oldest lastUsed first) until kept bytes <= ceiling.
     The output partitions the input keys exactly (every input key appears once
     across evict ∪ keep — no loss, no duplication).
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: feed-clip-load-performance — eviction ceiling + input partition property test\n');

// Build segments from generated records, giving each a unique key by index.
function buildSegments(records) {
  return records.map((r, i) => ({
    key: 'k' + i,
    bytes: r.bytes,
    lastUsed: r.lastUsed,
    clipDistance: r.clipDistance,
  }));
}

const isOutOfWindow = (seg, windowAhead, windowBehind) =>
  seg.clipDistance < -windowBehind || seg.clipDistance > windowAhead;

// Feature: feed-clip-load-performance, Property 6: Eviction stays within ceiling + partitions input
// **Validates: Requirements 4.5, 4.6**
try {
  // Guard: the function must exist (red until task 21 implements it).
  assert(typeof ss.ssSegmentEvictionPlan === 'function',
    'ssSegmentEvictionPlan is not implemented yet (expected until task 21)');

  const recordGen = fc.record({
    bytes: fc.integer({ min: 0, max: 50 * 1024 * 1024 }),
    lastUsed: fc.integer({ min: 0, max: 1000000 }),
    clipDistance: fc.integer({ min: -12, max: 12 }),
  });
  const recordsGen = fc.array(recordGen, { minLength: 0, maxLength: 30 });
  const ceilingGen = fc.integer({ min: 0, max: 300 * 1024 * 1024 });
  const windowGen = fc.integer({ min: 0, max: 8 });

  fc.assert(fc.property(recordsGen, ceilingGen, windowGen, windowGen,
    (records, ceilingBytes, windowAhead, windowBehind) => {
      const segments = buildSegments(records);
      const inputKeys = segments.map((s) => s.key);
      const byKey = new Map(segments.map((s) => [s.key, s]));

      const result = ss.ssSegmentEvictionPlan({ segments, ceilingBytes, windowAhead, windowBehind });

      // Shape: { evict: [], keep: [] }.
      assert(result && Array.isArray(result.evict) && Array.isArray(result.keep),
        'result must be { evict:[], keep:[] }');

      const evict = result.evict;
      const keep = result.keep;
      const evictSet = new Set(evict);
      const keepSet = new Set(keep);

      // Partition: exact, no loss, no duplication.
      assert(evict.length + keep.length === inputKeys.length,
        `partition size mismatch: evict ${evict.length} + keep ${keep.length} != input ${inputKeys.length}`);
      assert(evictSet.size === evict.length, 'evict has duplicate keys');
      assert(keepSet.size === keep.length, 'keep has duplicate keys');
      for (const k of inputKeys) {
        const inEvict = evictSet.has(k);
        const inKeep = keepSet.has(k);
        assert(inEvict !== inKeep, `key ${k} must be in exactly one of evict/keep (evict=${inEvict}, keep=${inKeep})`);
      }
      for (const k of evict) assert(byKey.has(k), `evict contains unknown key ${k}`);
      for (const k of keep) assert(byKey.has(k), `keep contains unknown key ${k}`);

      // Every out-of-window segment must be evicted.
      for (const s of segments) {
        if (isOutOfWindow(s, windowAhead, windowBehind)) {
          assert(evictSet.has(s.key),
            `out-of-window key ${s.key} (dist ${s.clipDistance}, win [-${windowBehind},${windowAhead}]) must be evicted`);
        }
      }

      // Kept segments are therefore all in-window.
      const keptSegs = keep.map((k) => byKey.get(k));
      for (const s of keptSegs) {
        assert(!isOutOfWindow(s, windowAhead, windowBehind),
          `kept key ${s.key} is out-of-window — should have been evicted`);
      }

      // Ceiling: kept bytes <= ceiling whenever feasible. The documented floor is
      // a single in-window segment larger than the ceiling that cannot be shed
      // without losing everything — so allow kept to exceed only when it is a
      // single unavoidable segment.
      const keptBytes = keptSegs.reduce((a, s) => a + s.bytes, 0);
      assert(keptBytes <= ceilingBytes || keep.length <= 1,
        `kept bytes ${keptBytes} exceed ceiling ${ceilingBytes} with ${keep.length} kept segments`);

      // Feasibility: if all in-window segments already fit under the ceiling, none
      // of them may be evicted (only out-of-window are shed).
      const inWindow = segments.filter((s) => !isOutOfWindow(s, windowAhead, windowBehind));
      const inWindowBytes = inWindow.reduce((a, s) => a + s.bytes, 0);
      if (inWindowBytes <= ceilingBytes) {
        for (const s of inWindow) {
          assert(keepSet.has(s.key),
            `in-window key ${s.key} evicted even though all in-window bytes (${inWindowBytes}) fit ceiling ${ceilingBytes}`);
        }
      }

      // Determinism: identical input → identical partition.
      const again = ss.ssSegmentEvictionPlan({ segments, ceilingBytes, windowAhead, windowBehind });
      assert(again.evict.length === evict.length && again.keep.length === keep.length,
        'non-deterministic output for identical input');

      return true;
    }), { numRuns: ITER });

  // ── Explicit example assertions ──
  // All out-of-window: distances beyond a 1+1 window, ample ceiling → all evicted.
  {
    const segments = [
      { key: 'a', bytes: 10, lastUsed: 1, clipDistance: 5 },
      { key: 'b', bytes: 10, lastUsed: 2, clipDistance: -5 },
    ];
    const r = ss.ssSegmentEvictionPlan({ segments, ceilingBytes: 1000, windowAhead: 1, windowBehind: 1 });
    assert(r.evict.length === 2 && r.keep.length === 0, 'both out-of-window segments evicted');
  }
  // In-window but over ceiling → LRU shed oldest until within ceiling.
  {
    const segments = [
      { key: 'old', bytes: 100, lastUsed: 1, clipDistance: 0 },
      { key: 'new', bytes: 100, lastUsed: 9, clipDistance: 1 },
    ];
    const r = ss.ssSegmentEvictionPlan({ segments, ceilingBytes: 100, windowAhead: 3, windowBehind: 3 });
    assert(r.evict.indexOf('old') !== -1, 'oldest in-window evicted to meet ceiling');
    assert(r.keep.indexOf('new') !== -1, 'newest in-window kept');
  }
  // All in-window and under ceiling → keep everything.
  {
    const segments = [
      { key: 'a', bytes: 10, lastUsed: 1, clipDistance: 0 },
      { key: 'b', bytes: 10, lastUsed: 2, clipDistance: 1 },
    ];
    const r = ss.ssSegmentEvictionPlan({ segments, ceilingBytes: 1000, windowAhead: 2, windowBehind: 2 });
    assert(r.evict.length === 0 && r.keep.length === 2, 'all in-window, under ceiling → keep all');
  }

  console.log('  \u2713 Property 6');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 6\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
