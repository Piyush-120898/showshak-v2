/* ═══════════════════════════════════════════════════════════════
   tests/prop-storage-trim.test.js — Node property test for the
   prefetch-cache-pipeline generic byte-bounded LRU storage planner
   `ssStorageTrimPlan(entries, budgetBytes)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-storage-trim.test.js
   (auto-discovered by `node tests/run-all.js`).

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (a list of cache entries + a byte budget in, an { evict, keep } plan out), so
   the stub never affects behaviour — it only lets the module load and populate
   module.exports.

   ── Contract (design.md, Property 9 / Requirements 8.7, 12.4) ──
   ssStorageTrimPlan(entries, budgetBytes) governs the iOS total-storage guard.
   Given entries `{ key, bytes, lastUsed }` and a byte budget it returns
   `{ evict: string[], keep: string[] }` such that:
     • it evicts least-recently-used entries FIRST until kept bytes <= budget
       (floor: a single entry larger than the budget is KEPT — never shed below one),
     • no evicted entry has a newer `lastUsed` than any kept entry,
     • eviction is minimal — it never evicts more than required to satisfy the budget,
     • evict ∪ keep is EXACTLY the input key set, with no loss or duplication,
     • non-array entries / non-finite budget → { evict: [], keep: [] }.
   Total and deterministic — never throws.

   TDD NOTE: `ssStorageTrimPlan` does NOT exist yet — it is implemented in
   task 13.3. This file is authored FIRST (task 12.3) and is EXPECTED TO FAIL/ERROR
   ("ssStorageTrimPlan is not a function") until task 13.3 lands the helper.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function show(v) {
  try {
    if (typeof v === 'symbol') return v.toString();
    if (v !== null && typeof v === 'object') return JSON.stringify(v);
    return String(v);
  } catch (_) { return Object.prototype.toString.call(v); }
}

let failed = 0;

/* Well-formed entries: UNIQUE keys AND UNIQUE lastUsed (so the LRU ordering is
   unambiguous — no ties to make the partition non-deterministic). */
const wellFormedEntriesArb = fc.uniqueArray(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 12 })
  .chain((keys) =>
    fc.tuple(
      // unique lastUsed values, one per key
      fc.uniqueArray(fc.integer({ min: 0, max: 5000000 }), { minLength: keys.length, maxLength: keys.length }),
      // byte sizes, one per key (include 0-byte entries)
      fc.array(fc.integer({ min: 0, max: 3000000 }), { minLength: keys.length, maxLength: keys.length })
    ).map(([lasts, sizes]) =>
      keys.map((k, i) => ({ key: k, bytes: sizes[i], lastUsed: lasts[i] })))
  );

// Budgets straddling total size on both sides: negatives, 0, small, and large.
const budgetArb = fc.oneof(
  fc.integer({ min: -1000, max: 12000000 }),
  fc.constantFrom(0, 1, 100, 1000000, 5000000, 50000000),
  fc.double({ min: 0, max: 12000000, noNaN: true })
);

console.log('Feature: prefetch-cache-pipeline — iOS storage-trim property test\n');

/* ── Property 9 (core invariants over well-formed entries) ──────── */
// Feature: prefetch-cache-pipeline, Property 9: iOS storage-trim stays within budget and partitions input
// **Validates: Requirements 8.7, 12.4**
try {
  assert(typeof ss.ssStorageTrimPlan === 'function',
    'ssStorageTrimPlan is not implemented yet (expected by task 13.3)');

  fc.assert(fc.property(wellFormedEntriesArb, budgetArb, (entries, budget) => {
    const plan = ss.ssStorageTrimPlan(entries, budget);

    // Shape: { evict: string[], keep: string[] }.
    assert(plan && typeof plan === 'object' && !Array.isArray(plan),
      `plan must be a plain object: got ${show(plan)}`);
    assert(Array.isArray(plan.evict) && Array.isArray(plan.keep),
      `plan.evict and plan.keep must be arrays: got ${show(plan)}`);

    const byKey = {};
    entries.forEach((e) => { byKey[e.key] = e; });
    const inputKeys = entries.map((e) => e.key);

    // (1) Exact partition: evict ∪ keep === input key set, disjoint, no duplicates.
    const evictSet = new Set(plan.evict);
    const keepSet = new Set(plan.keep);
    assert(evictSet.size === plan.evict.length, `duplicate key in evict: ${show(plan.evict)}`);
    assert(keepSet.size === plan.keep.length, `duplicate key in keep: ${show(plan.keep)}`);
    assert(plan.evict.length + plan.keep.length === inputKeys.length,
      `partition size mismatch: |evict|=${plan.evict.length} + |keep|=${plan.keep.length} != |input|=${inputKeys.length}`);
    for (const k of plan.evict) assert(byKey.hasOwnProperty(k), `evicted unknown key ${show(k)}`);
    for (const k of plan.keep) assert(byKey.hasOwnProperty(k), `kept unknown key ${show(k)}`);
    for (const k of inputKeys) {
      assert(evictSet.has(k) !== keepSet.has(k),
        `key ${show(k)} must be in exactly one of evict/keep`);
    }

    // (2) keep is non-empty when there is at least one entry (never sheds below one).
    if (inputKeys.length > 0) {
      assert(plan.keep.length >= 1, 'must keep at least one entry (floor)');
    }

    // (3) No evicted entry is newer than any kept entry (LRU-first).
    if (plan.evict.length > 0 && plan.keep.length > 0) {
      const maxEvictLU = Math.max.apply(null, plan.evict.map((k) => byKey[k].lastUsed));
      const minKeepLU = Math.min.apply(null, plan.keep.map((k) => byKey[k].lastUsed));
      assert(maxEvictLU <= minKeepLU,
        `LRU order violated: an evicted entry (lastUsed ${maxEvictLU}) is newer than a kept entry (lastUsed ${minKeepLU})`);
    }

    // (4) Budget: kept bytes <= budget, OR the floor case (exactly one entry kept).
    const keptBytes = plan.keep.reduce((s, k) => s + byKey[k].bytes, 0);
    if (inputKeys.length > 0) {
      assert(keptBytes <= budget || plan.keep.length === 1,
        `kept bytes ${keptBytes} exceed budget ${budget} with ${plan.keep.length} entries kept (floor allows exactly 1)`);
    }

    // (5) Minimality: if anything was evicted, re-adding the NEWEST evicted entry
    //     would have exceeded the budget — i.e. we did not over-evict.
    if (plan.evict.length > 0) {
      let newestEvict = plan.evict[0];
      for (const k of plan.evict) if (byKey[k].lastUsed > byKey[newestEvict].lastUsed) newestEvict = k;
      assert(keptBytes + byKey[newestEvict].bytes > budget,
        `over-eviction: re-adding newest evicted entry (${byKey[newestEvict].bytes} bytes) ` +
        `to kept ${keptBytes} would still fit budget ${budget}`);
    }

    // (6) Determinism: same input → identical plan.
    const again = ss.ssStorageTrimPlan(entries, budget);
    assert(JSON.stringify(again.evict) === JSON.stringify(plan.evict) &&
           JSON.stringify(again.keep) === JSON.stringify(plan.keep),
      'non-deterministic plan for identical input');

    return true;
  }), { numRuns: ITER });

  console.log('  \u2713 Property 9 (within-budget LRU partition)');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 9 (within-budget LRU partition)\n      ' + e.message);
}

/* ── Property 9 (non-array entries / non-finite budget → empty plan) ── */
// **Validates: Requirements 8.7, 12.4**
try {
  const nonArrayEntries = fc.oneof(
    fc.constantFrom(null, undefined, 0, 1, NaN, true, false, '', 'entries'),
    fc.object(), fc.string()
  );
  const badBudget = fc.constantFrom(NaN, Infinity, -Infinity, null, undefined, '5', '', true, false, {}, []);

  // non-array entries → { evict: [], keep: [] }
  fc.assert(fc.property(nonArrayEntries, budgetArb, (entries, budget) => {
    const plan = ss.ssStorageTrimPlan(entries, budget);
    assert(plan && Array.isArray(plan.evict) && Array.isArray(plan.keep) &&
      plan.evict.length === 0 && plan.keep.length === 0,
      `non-array entries must yield { evict: [], keep: [] }: got ${show(plan)}`);
    return true;
  }), { numRuns: ITER });

  // non-finite budget → { evict: [], keep: [] }
  fc.assert(fc.property(wellFormedEntriesArb, badBudget, (entries, budget) => {
    const plan = ss.ssStorageTrimPlan(entries, budget);
    assert(plan && Array.isArray(plan.evict) && Array.isArray(plan.keep) &&
      plan.evict.length === 0 && plan.keep.length === 0,
      `non-finite budget must yield { evict: [], keep: [] }: budget=${show(budget)} got ${show(plan)}`);
    return true;
  }), { numRuns: ITER });

  console.log('  \u2713 Property 9 (empty plan on malformed input)');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 9 (empty plan on malformed input)\n      ' + e.message);
}

/* ── Property 9 (totality: malformed entries never throw) ───────── */
// **Validates: Requirements 8.7, 12.4**
try {
  // Arrays that MIX well-formed and malformed entries (junk objects, nulls, etc.).
  const messyEntriesArb = fc.array(
    fc.oneof(
      fc.record({ key: fc.string(), bytes: fc.integer(), lastUsed: fc.integer() }),
      fc.record({ key: fc.string() }),                 // missing fields
      fc.record({ bytes: fc.integer(), lastUsed: fc.integer() }), // missing key
      fc.constantFrom(null, undefined, 0, 'x', true, NaN, []),
      fc.object()
    ),
    { maxLength: 10 }
  );

  fc.assert(fc.property(messyEntriesArb, budgetArb, (entries, budget) => {
    const plan = ss.ssStorageTrimPlan(entries, budget);
    // Never throws; always returns the documented shape with string arrays.
    assert(plan && typeof plan === 'object' && Array.isArray(plan.evict) && Array.isArray(plan.keep),
      `malformed entries must still yield an { evict, keep } plan: got ${show(plan)}`);
    assert(plan.evict.every((k) => typeof k === 'string'), 'evict must contain only string keys');
    assert(plan.keep.every((k) => typeof k === 'string'), 'keep must contain only string keys');
    return true;
  }), { numRuns: ITER });

  console.log('  \u2713 Property 9 (totality over malformed entries)');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 9 (totality over malformed entries)\n      ' + e.message);
}

/* ── Explicit boundary rows from the property text ──────────────── */
try {
  // total <= budget → keep everything, evict nothing.
  const small = [
    { key: 'a', bytes: 10, lastUsed: 1 },
    { key: 'b', bytes: 10, lastUsed: 2 },
  ];
  let p = ss.ssStorageTrimPlan(small, 1000);
  assert(p.evict.length === 0 && p.keep.length === 2, 'within budget → keep all');

  // must evict the LRU (oldest) first.
  const three = [
    { key: 'old', bytes: 60, lastUsed: 1 },
    { key: 'mid', bytes: 60, lastUsed: 2 },
    { key: 'new', bytes: 60, lastUsed: 3 },
  ];
  p = ss.ssStorageTrimPlan(three, 120); // can keep 2 of 60 → evict the single oldest
  assert(p.keep.indexOf('old') === -1, 'LRU "old" must be evicted first');
  assert(p.keep.indexOf('new') !== -1 && p.keep.indexOf('mid') !== -1, 'two newest must be kept');
  assert(p.evict.length === 1 && p.evict[0] === 'old', 'exactly the oldest evicted');

  // floor: a single entry larger than the budget is kept.
  const big = [{ key: 'huge', bytes: 999, lastUsed: 1 }];
  p = ss.ssStorageTrimPlan(big, 10);
  assert(p.keep.length === 1 && p.keep[0] === 'huge' && p.evict.length === 0,
    'single oversized entry must be kept (floor)');

  // non-array / non-finite → empty plan.
  let q = ss.ssStorageTrimPlan(null, 100);
  assert(q.evict.length === 0 && q.keep.length === 0, 'null entries → empty plan');
  q = ss.ssStorageTrimPlan(small, NaN);
  assert(q.evict.length === 0 && q.keep.length === 0, 'NaN budget → empty plan');

  console.log('  \u2713 Property 9 (explicit boundary cases)');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 9 (explicit boundary cases)\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} check(s)` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
