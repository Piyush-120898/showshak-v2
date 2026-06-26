/* ═══════════════════════════════════════════════════════════════
   tests/prop-feed-dedup-permutation.test.js — Node property test for the
   feed-follows pure ranker `ssRankFeed(input)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-feed-dedup-permutation.test.js
   (auto-discovered by `node tests/run-all.js`).

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The ranker under test is PURE.

   TDD NOTE (red-first): `ssRankFeed` does NOT exist yet — it lands in task 2.
   This file is EXPECTED to be RED until then. The missing function is reported
   as a clean assertion failure (not a crash), so the red result is meaningful.

   PROPERTY 1 — De-duplicated permutation of the eligible id set.
   For any candidate set (INCLUDING one containing duplicate ids and already-seen
   clips), follow graph, seen-state, seed, and `now`, the SET of ids in the
   Ranked_List equals exactly the set of DISTINCT eligible candidate ids:
     • every eligible id appears,
     • no ineligible or absent id appears,
     • each id appears exactly once (output multiset has count 1 per id), and
     • already-seen clips are RETAINED (not removed).
   Eligible = status === 'live' (exact, case-sensitive) AND deleted_at == null
   AND id is a non-empty string.
═══════════════════════════════════════════════════════════════ */
// Feature: feed-follows, Property 1: De-duplicated permutation of the eligible id set
// **Validates: Requirements 2.1, 2.3, 2.4, 4.4, 1.5**
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

console.log('Feature: feed-follows — Property 1: de-duplicated permutation of the eligible id set\n');

/* ── Eligibility predicate, mirroring the design exactly (Req 9, 2.1) ──
   eligible = well-formed object whose status is EXACTLY 'live', whose
   deleted_at is null/undefined, and whose id is a non-empty string. */
function isEligible(e) {
  return e !== null && typeof e === 'object'
    && e.status === 'live'
    && (e.deleted_at === null || e.deleted_at === undefined)
    && typeof e.id === 'string' && e.id.length > 0;
}

/* Extract the set of seen ids from any accepted seen-state shape (bare list,
   { seen: [...] }, or null/garbage → empty) so we can assert seen-retention. */
function seenIdSet(seenState) {
  let list = [];
  if (Array.isArray(seenState)) list = seenState;
  else if (seenState && typeof seenState === 'object' && Array.isArray(seenState.seen)) list = seenState.seen;
  const s = new Set();
  for (const v of list) if (typeof v === 'string' && v.length > 0) s.add(v);
  return s;
}

/* ── Generators (design Testing Strategy coverage for Property 1) ── */
const WINDOW = 1209600000;            // 14 days in ms (Recency_Window)
const NOW_BASE = 1700000000000;       // fixed reference epoch for created_at coverage

// id pool: a SMALL pool guarantees DUPLICATE ids appear within larger sets,
// plus random hex ids, plus '' and a non-string to exercise the non-empty-string
// id eligibility rule.
const idGen = fc.oneof(
  fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f'),
  fc.hexaString({ minLength: 1, maxLength: 8 }),
  fc.constant(''),                    // empty string id → ineligible
  fc.integer({ min: 0, max: 5 })      // non-string id → ineligible
);

const creatorGen = fc.constantFrom('cr1', 'cr2', 'cr3', 'cr4', 'cr5');

// created_at straddling the 14-day window relative to NOW_BASE, as numbers and
// ISO strings (mix recent / boundary / old). Does not affect Property 1's set
// equality, but is required generator coverage.
const createdAtGen = fc.oneof(
  fc.integer({ min: NOW_BASE - WINDOW + 1, max: NOW_BASE }),                       // recent
  fc.constantFrom(NOW_BASE - WINDOW - 1, NOW_BASE - WINDOW, NOW_BASE - WINDOW + 1, NOW_BASE), // boundary
  fc.integer({ min: NOW_BASE - 10 * WINDOW, max: NOW_BASE - WINDOW - 1 }),         // old
  fc.integer({ min: NOW_BASE - 3 * WINDOW, max: NOW_BASE }).map((ms) => new Date(ms).toISOString())
);

const countGen = fc.oneof(
  fc.constant(0),                     // zero engagement → Tier 4/5 split coverage
  fc.nat({ max: 10000 })
);

// status: weight 'live' heavily; mix in ineligible / wrong-case values.
const statusGen = fc.oneof(
  fc.constant('live'), fc.constant('live'), fc.constant('live'),
  fc.constantFrom('draft', 'removed', 'pending', 'LIVE', 'Live', 'live ', '')
);

// deleted_at: null/undefined → eligible; a real timestamp/number → ineligible.
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

// candidate sets: empty / single / large (up to a few hundred).
const candidateSetGen = fc.oneof(
  fc.constant([]),
  fc.array(entryGen, { maxLength: 1 }),
  fc.array(entryGen, { minLength: 1, maxLength: 300 })
);

// follow graph: empty and non-empty, in each accepted shape (+ null).
const followGraphGen = fc.oneof(
  fc.constant(null),
  fc.constant([]),
  fc.constant({ creatorIds: [] }),
  fc.array(creatorGen, { maxLength: 5 }),
  fc.record({ creatorIds: fc.array(creatorGen, { maxLength: 5 }) })
);

// seen-state: available (bare list or { available, seen }) / empty / unavailable.
// seen ids drawn from the same id pool so they actually intersect the candidates.
const seenGen = fc.oneof(
  fc.constant(null),                                              // unavailable
  fc.constant({ available: false, seen: [] }),                   // unavailable/empty
  fc.array(idGen, { maxLength: 12 }),                            // bare list → available
  fc.record({ available: fc.constant(true), seen: fc.array(idGen, { maxLength: 12 }) })
);

const seedGen = fc.oneof(fc.integer(), fc.string());
const nowGen = fc.integer({ min: NOW_BASE - 1000, max: NOW_BASE + 1000 });

/* ── The property ── */
if (typeof ss.ssRankFeed !== 'function') {
  // Red-first: ssRankFeed lands in task 2. Report a clean assertion failure.
  failed++;
  console.log('  \u2717 Property 1: De-duplicated permutation of the eligible id set' +
    '\n      ssRankFeed is not implemented yet (expected RED until task 2)');
} else {
  prop('Property 1: De-duplicated permutation of the eligible id set', () => {
    fc.assert(fc.property(
      candidateSetGen, followGraphGen, seenGen, seedGen, nowGen,
      (candidateSet, followGraph, seenState, seed, now) => {
        // Expected: the set of DISTINCT eligible candidate ids.
        const expected = new Set();
        for (const e of candidateSet) if (isEligible(e)) expected.add(e.id);

        const out = ss.ssRankFeed({ candidateSet, followGraph, seenState, seed, now });

        // Shape: an array of strings.
        assert(Array.isArray(out), `Ranked_List must be an array, got ${show(out)}`);
        for (const id of out) {
          assert(typeof id === 'string' && id.length > 0,
            `Ranked_List must contain only non-empty string ids, got ${show(id)}`);
        }

        // Exactly once: no duplicate id (Req 2.4).
        const outSet = new Set(out);
        assert(outSet.size === out.length,
          `Ranked_List has duplicate ids: length ${out.length} vs distinct ${outSet.size}`);

        // Set equality with the distinct eligible id set (Req 2.1, 2.3).
        assert(outSet.size === expected.size,
          `Ranked_List id-set size ${outSet.size} != distinct eligible size ${expected.size}`);
        for (const id of expected) {
          assert(outSet.has(id), `eligible id ${show(id)} missing from Ranked_List`);
        }
        for (const id of out) {
          assert(expected.has(id),
            `ineligible/absent id ${show(id)} present in Ranked_List`);
        }

        // Already-seen clips are RETAINED, not removed (Req 4.4): every eligible
        // id that is also in the seen-state must still appear in the output.
        const seen = seenIdSet(seenState);
        for (const id of expected) {
          if (seen.has(id)) {
            assert(outSet.has(id),
              `already-seen eligible id ${show(id)} was dropped from Ranked_List`);
          }
        }
        return true;
      }
    ), { numRuns: ITER });
  });
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
