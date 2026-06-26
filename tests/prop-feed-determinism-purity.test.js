/* ═══════════════════════════════════════════════════════════════
   tests/prop-feed-determinism-purity.test.js — Node property test for the
   feed-follows pure ranker `ssRankFeed(input)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-feed-determinism-purity.test.js
   (auto-discovered by `node tests/run-all.js`).

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The ranker under test is PURE.

   TDD NOTE (red-first): `ssRankFeed` does NOT exist yet — it lands in task 2.
   This file is EXPECTED to be RED until then. The missing function is reported
   as a clean assertion failure (not a crash), so the red result is meaningful.

   PROPERTY 10 — Determinism and purity (fixed seed).
   For any fixed inputs (candidate set, follow graph, seen-state, seed, and
   reference time `now`):
     (a) two successive calls to `ssRankFeed` with the SAME input references
         return DEEPLY-EQUAL Ranked_Lists — same length and the same id at every
         index, INCLUDING an identical Tier 5 order for the fixed seed (the seeded
         shuffle is reproducible); and
     (b) neither call MUTATES any input argument — after both calls, each argument
         (candidateSet and its entries, followGraph, seenState) still deep-equals
         the snapshot taken before the first call.
   Identical inputs (including `seed` and `now`) ⇒ identical output, with no I/O,
   no global reads, and no observable side effect on the arguments (Req 10.1 purity,
   Req 10.2 deterministic seeded randomization).
═══════════════════════════════════════════════════════════════ */
// Feature: feed-follows, Property 10: Determinism and purity (fixed seed)
// **Validates: Requirements 10.1, 10.2**
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function show(v) {
  try {
    if (v !== null && typeof v === 'object') return JSON.stringify(v);
    return String(v);
  } catch (_) { return Object.prototype.toString.call(v); }
}

let failed = 0;
function prop(name, fn) {
  try { fn(); console.log('  \u2713 ' + name); }
  catch (e) { failed++; console.log('  \u2717 ' + name + '\n      ' + e.message); }
}

console.log('Feature: feed-follows — Property 10: determinism and purity (fixed seed)\n');

/* ── Local deep-clone / deep-equal (no external libs beyond fast-check) ──
   Inputs are plain JSON-ish (arrays / plain objects / primitives), but a value
   may legitimately be `undefined` (e.g. `deleted_at: undefined`), which a JSON
   round-trip would silently drop. So we use a small recursive clone/compare that
   preserves `undefined` and handles arrays, plain objects, null, and primitives
   (incl. NaN). structuredClone is avoided to keep behaviour explicit across Node
   versions. */
function deepClone(v) {
  if (v === null || typeof v !== 'object') return v;          // primitive / null / undefined
  if (Array.isArray(v)) {
    const out = new Array(v.length);
    for (let i = 0; i < v.length; i++) out[i] = deepClone(v[i]);
    return out;
  }
  const out = {};
  for (const k of Object.keys(v)) out[k] = deepClone(v[k]);
  return out;
}

function deepEqual(a, b) {
  if (a === b) return true;
  // NaN === NaN for our purposes (created_at can be NaN-producing garbage).
  if (typeof a === 'number' && typeof b === 'number'
    && Number.isNaN(a) && Number.isNaN(b)) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  const aArr = Array.isArray(a), bArr = Array.isArray(b);
  if (aArr !== bArr) return false;
  if (aArr) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

/* ── Constants mirroring the design (14-day Recency_Window, fixed epoch) ── */
const WINDOW = 1209600000;            // 14 days in ms (Recency_Window)
const NOW_BASE = 1700000000000;       // fixed reference epoch for created_at coverage

/* ── Generators (design Testing Strategy coverage) ──
   Same generator style as the sibling Property 2 test, kept deliberately close so
   the input space is consistent across the suite. */
const idGen = fc.oneof(
  fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f'),
  fc.hexaString({ minLength: 1, maxLength: 8 }),
  fc.constant(''),                    // empty string id → ineligible
  fc.integer({ min: 0, max: 5 })      // non-string id → ineligible
);

const creatorGen = fc.constantFrom('cr1', 'cr2', 'cr3', 'cr4', 'cr5');

// created_at straddling the 14-day window relative to NOW_BASE: recent / exactly
// at the boundary / old, as numbers and ISO strings.
const createdAtGen = fc.oneof(
  fc.integer({ min: NOW_BASE - WINDOW + 1, max: NOW_BASE }),                       // recent
  fc.constantFrom(NOW_BASE - WINDOW - 1, NOW_BASE - WINDOW, NOW_BASE - WINDOW + 1, NOW_BASE), // boundary
  fc.integer({ min: NOW_BASE - 10 * WINDOW, max: NOW_BASE - WINDOW - 1 }),         // old
  fc.integer({ min: NOW_BASE - 3 * WINDOW, max: NOW_BASE }).map((ms) => new Date(ms).toISOString())
);

// zero and non-zero counts for the Tier 4/5 split.
const countGen = fc.oneof(
  fc.constant(0),
  fc.nat({ max: 10000 })
);

const statusGen = fc.oneof(
  fc.constant('live'), fc.constant('live'), fc.constant('live'),
  fc.constantFrom('draft', 'removed', 'pending', 'LIVE', 'Live', 'live ', '')
);

const deletedAtGen = fc.oneof(
  fc.constant(null), fc.constant(null), fc.constant(undefined),
  fc.constantFrom('2020-01-01T00:00:00Z', 1577836800000)
);

const entryGen = fc.record({
  id: idGen,
  creator_id: creatorGen,
  created_at: createdAtGen,
  fires_count: countGen,
  views_count: countGen,
  status: statusGen,
  deleted_at: deletedAtGen,
});

/* A clip guaranteed to fall into Tier 5 (eligible, OLD, NON-followed creator, and
   ZERO engagement) so the seeded Tier-5 shuffle order is actually exercised. The
   creator pool here ('z1'..'z4') is disjoint from any follow graph below. */
const tier5EntryGen = fc.record({
  id: fc.hexaString({ minLength: 1, maxLength: 10 }),
  creator_id: fc.constantFrom('z1', 'z2', 'z3', 'z4'),
  created_at: fc.integer({ min: NOW_BASE - 10 * WINDOW, max: NOW_BASE - WINDOW - 1 }), // old
  fires_count: fc.constant(0),
  views_count: fc.constant(0),
  status: fc.constant('live'),
  deleted_at: fc.constant(null),
});

// candidate sets: empty / single / large, with a generous share of Tier-5-bound
// clips mixed into the general entries so Tier 5 is populated and its order pinned.
const candidateSetGen = fc.oneof(
  fc.constant([]),
  fc.array(entryGen, { maxLength: 1 }),
  fc.array(fc.oneof(entryGen, tier5EntryGen, tier5EntryGen), { minLength: 1, maxLength: 300 })
);

// follow graph: empty and non-empty, in each accepted shape (+ null). creator ids
// are drawn from the candidates' pool ('cr*') and NEVER the Tier-5 pool ('z*').
const followGraphGen = fc.oneof(
  fc.constant(null),
  fc.constant([]),
  fc.constant({ creatorIds: [] }),
  fc.array(creatorGen, { maxLength: 5 }),
  fc.record({ creatorIds: fc.array(creatorGen, { maxLength: 5 }) })
);

const seenGen = fc.oneof(
  fc.constant(null),
  fc.constant({ available: false, seen: [] }),
  fc.array(idGen, { maxLength: 12 }),
  fc.record({ available: fc.constant(true), seen: fc.array(idGen, { maxLength: 12 }) })
);

const seedGen = fc.oneof(fc.integer(), fc.string());
const nowGen = fc.integer({ min: NOW_BASE - 1000, max: NOW_BASE + 1000 });

/* Assert two Ranked_Lists are deeply equal (array, same length, same id at each
   index). Returns nothing; throws on mismatch. */
function assertSameRankedList(a, b) {
  assert(Array.isArray(a), `first Ranked_List must be an array, got ${show(a)}`);
  assert(Array.isArray(b), `second Ranked_List must be an array, got ${show(b)}`);
  assert(a.length === b.length,
    `Ranked_List length differs between calls: ${a.length} vs ${b.length}`);
  for (let i = 0; i < a.length; i++) {
    assert(a[i] === b[i],
      `Ranked_List id differs at index ${i}: ${show(a[i])} vs ${show(b[i])}`);
  }
  assert(deepEqual(a, b),
    `Ranked_Lists are not deeply equal: ${show(a)} vs ${show(b)}`);
}

/* ── The property ── */
if (typeof ss.ssRankFeed !== 'function') {
  // Red-first: ssRankFeed lands in task 2. Report a clean assertion failure.
  failed++;
  console.log('  \u2717 Property 10: Determinism and purity (fixed seed)' +
    '\n      ssRankFeed is not implemented yet (expected RED until task 2)');
} else {
  // (a) determinism + (b) purity over the full, varied input space.
  prop('Property 10: two successive calls are deeply equal and mutate no input', () => {
    fc.assert(fc.property(
      candidateSetGen, followGraphGen, seenGen, seedGen, nowGen,
      (candidateSet, followGraph, seenState, seed, now) => {
        // Snapshot every input BEFORE any call (deep clone preserves undefined).
        const candidateBefore = deepClone(candidateSet);
        const followBefore = deepClone(followGraph);
        const seenBefore = deepClone(seenState);

        // Call TWICE with the SAME references and the SAME seed/now.
        const out1 = ss.ssRankFeed({ candidateSet, followGraph, seenState, seed, now });
        const out2 = ss.ssRankFeed({ candidateSet, followGraph, seenState, seed, now });

        // (a) Determinism: the two outputs are deeply equal (Tier 5 order included).
        assertSameRankedList(out1, out2);

        // (b) Purity: no input argument was mutated by either call.
        assert(deepEqual(candidateSet, candidateBefore),
          `candidateSet was mutated by ssRankFeed:\n        before ${show(candidateBefore)}` +
          `\n        after  ${show(candidateSet)}`);
        assert(deepEqual(followGraph, followBefore),
          `followGraph was mutated by ssRankFeed:\n        before ${show(followBefore)}` +
          `\n        after  ${show(followGraph)}`);
        assert(deepEqual(seenState, seenBefore),
          `seenState was mutated by ssRankFeed:\n        before ${show(seenBefore)}` +
          `\n        after  ${show(seenState)}`);
        return true;
      }
    ), { numRuns: ITER });
  });

  // (a, focused) Tier-5 seeded order is pinned: a candidate set whose eligible
  // clips ALL fall into Tier 5 (old, non-followed, zero engagement) makes the
  // seeded shuffle the only thing deciding order. Two ranks with the same seed
  // must produce the identical Tier 5 sequence.
  prop('Property 10: Tier-5 seeded order is identical across successive calls', () => {
    fc.assert(fc.property(
      fc.array(tier5EntryGen, { minLength: 2, maxLength: 200 }), seedGen, nowGen,
      (tier5Clips, seed, now) => {
        const candidateSet = tier5Clips;
        const followGraph = { creatorIds: ['cr1', 'cr2'] }; // never matches 'z*' creators
        const seenState = null;                              // unavailable → primary order only

        const before = deepClone(candidateSet);

        const out1 = ss.ssRankFeed({ candidateSet, followGraph, seenState, seed, now });
        const out2 = ss.ssRankFeed({ candidateSet, followGraph, seenState, seed, now });

        assertSameRankedList(out1, out2);
        assert(deepEqual(candidateSet, before),
          'candidateSet was mutated during Tier-5 determinism check');
        return true;
      }
    ), { numRuns: ITER });
  });
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
