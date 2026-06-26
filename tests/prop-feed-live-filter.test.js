/* ═══════════════════════════════════════════════════════════════
   tests/prop-feed-live-filter.test.js — Node property test for the
   feed-follows pure ranker `ssRankFeed(input)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-feed-live-filter.test.js
   (auto-discovered by `node tests/run-all.js`).

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The ranker under test is PURE.

   TDD NOTE (red-first): `ssRankFeed` does NOT exist yet — it lands in task 2.
   This file is EXPECTED to be RED until then. The missing function is reported
   as a clean assertion failure (not a crash), so the red result is meaningful.

   PROPERTY 11 — Live and non-deleted filtering.
   For any candidate set that mixes feed-eligible clips with ineligible ones —
   clips whose `status` is PRESENT but not exactly `'live'` (null, wrong-case like
   'LIVE'/'Live', a trailing-space 'live ', 'draft', 'removed', a non-string), OR
   whose `deleted_at` is non-null or malformed (a timestamp, a number, an object) —
   NONE of the ineligible clips appear anywhere in the Ranked_List, in any tier.
   When EVERY candidate is excluded by these criteria, the Ranked_List is empty.

   NOTE (feed-follows wiring, Req 3.3): the candidate query selects ONLY the five
   public-signal columns and pre-filters status='live' / deleted_at IS NULL in SQL,
   so a real candidate row carries NO `status`/`deleted_at` field. The ranker
   therefore honours these fields ONLY WHEN PRESENT — an ABSENT (undefined)
   status/deleted_at is eligible; a PRESENT status must equal 'live' exactly and a
   PRESENT deleted_at must be null (design §"CandidateEntry" — "honours them if
   present"). Without this, the public-signals-only projection would feed the ranker
   rows it then rejects, emptying the live feed.

   Eligibility (mirroring the design exactly, Req 9.1–9.5, 2.1):
     (status === 'live' || status === undefined)   // present ⇒ exactly 'live'
     && (deleted_at === null || deleted_at === undefined)
     && typeof id === 'string' && id.length > 0
═══════════════════════════════════════════════════════════════ */
// Feature: feed-follows, Property 11: Live and non-deleted filtering
// **Validates: Requirements 9.2, 9.3, 9.4, 9.5**
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

console.log('Feature: feed-follows — Property 11: live and non-deleted filtering\n');

/* ── Eligibility predicate, mirroring the design exactly (Req 9, 2.1) ──
   Same predicate as the sibling property tests. */
function isEligible(e) {
  return e !== null && typeof e === 'object'
    && (e.status === 'live' || e.status === undefined)   // present ⇒ exactly 'live'; absent ⇒ eligible (SQL pre-filtered)
    && (e.deleted_at === null || e.deleted_at === undefined)
    && typeof e.id === 'string' && e.id.length > 0;
}

/* Build the distinct-eligible first-occurrence map (id → clip), mirroring the
   ranker's "keep first occurrence of each id" de-dup. The same id string could
   appear on both an eligible AND an ineligible entry; the ranker keeps the
   eligible one, so the precise membership test is "is this output id a key here". */
function firstEligibleById(candidateSet) {
  const map = new Map();
  if (Array.isArray(candidateSet)) {
    for (const e of candidateSet) {
      if (isEligible(e) && !map.has(e.id)) map.set(e.id, e);
    }
  }
  return map;
}

/* ── Generators (design Testing Strategy coverage for Property 11) ── */
const WINDOW = 1209600000;            // 14 days in ms (Recency_Window)
const NOW_BASE = 1700000000000;       // fixed reference epoch

const idGen = fc.oneof(
  fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f'),
  fc.hexaString({ minLength: 1, maxLength: 8 }),
  fc.constant(''),                    // empty string id → ineligible
  fc.integer({ min: 0, max: 5 })      // non-string id → ineligible
);

const creatorGen = fc.constantFrom('cr1', 'cr2', 'cr3', 'cr4', 'cr5');

// created_at straddling the 14-day window relative to NOW_BASE: recent / old, as
// numbers and ISO strings — so the surviving eligible clips land across tiers.
const createdAtGen = fc.oneof(
  fc.integer({ min: NOW_BASE - WINDOW + 1, max: NOW_BASE }),                       // recent
  fc.integer({ min: NOW_BASE - 10 * WINDOW, max: NOW_BASE - WINDOW - 1 }),         // old
  fc.integer({ min: NOW_BASE - 3 * WINDOW, max: NOW_BASE }).map((ms) => new Date(ms).toISOString())
);

const countGen = fc.oneof(fc.constant(0), fc.nat({ max: 10000 }));

// status variants — heavy on wrong-case, trailing-space, non-string, and missing.
const statusGen = fc.oneof(
  fc.constant('live'), fc.constant('live'),                       // eligible (weighted)
  fc.constantFrom('LIVE', 'Live', 'live ', ' live', 'draft', 'removed', 'pending', ''),
  fc.constant(null),                                              // null status → ineligible
  fc.integer({ min: 0, max: 3 })                                  // non-string status → ineligible
);

// deleted_at variants — null/undefined are eligible; everything else ineligible.
const deletedAtGen = fc.oneof(
  fc.constant(null), fc.constant(undefined),                      // eligible (weighted)
  fc.constantFrom('2020-01-01T00:00:00Z', 1577836800000, 0),      // timestamp / number / 0
  fc.constant({}),                                                // malformed object
  fc.constant('garbage')                                          // malformed string
);

// Entries where `status` / `deleted_at` may be present, missing, or malformed.
const entryGen = fc.oneof(
  // full record (status + deleted_at present, often eligible)
  fc.record({
    id: idGen, creator_id: creatorGen, created_at: createdAtGen,
    fires_count: countGen, views_count: countGen,
    status: statusGen, deleted_at: deletedAtGen,
  }),
  // missing `status` field entirely → ELIGIBLE when deleted_at ok (absent status ⇒
  // SQL pre-filtered; design "honours them if present"). (Req 9.4 reconciled)
  fc.record({
    id: idGen, creator_id: creatorGen, created_at: createdAtGen,
    fires_count: countGen, views_count: countGen, deleted_at: deletedAtGen,
  }),
  // missing `deleted_at` field entirely (undefined → eligible if status==='live')
  fc.record({
    id: idGen, creator_id: creatorGen, created_at: createdAtGen,
    fires_count: countGen, views_count: countGen, status: statusGen,
  })
);

// candidate sets: empty / single / large, deliberately mixing eligible + ineligible.
const candidateSetGen = fc.oneof(
  fc.constant([]),
  fc.array(entryGen, { maxLength: 1 }),
  fc.array(entryGen, { minLength: 1, maxLength: 300 })
);

const followGraphGen = fc.oneof(
  fc.constant(null),
  fc.constant([]),
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

/* ── The property ── */
if (typeof ss.ssRankFeed !== 'function') {
  // Red-first: ssRankFeed lands in task 2. Report a clean assertion failure.
  failed++;
  console.log('  \u2717 Property 11: Live and non-deleted filtering' +
    '\n      ssRankFeed is not implemented yet (expected RED until task 2)');
} else {
  // (a) Every output id maps to an eligible first-occurrence clip, and no output id
  //     corresponds to a clip that is ONLY ever ineligible (Req 9.2, 9.3, 9.4).
  prop('Property 11: ineligible clips never appear in any tier', () => {
    fc.assert(fc.property(
      candidateSetGen, followGraphGen, seenGen, seedGen, nowGen,
      (candidateSet, followGraph, seenState, seed, now) => {
        const byId = firstEligibleById(candidateSet);

        // Ids that NEVER appear on an eligible entry (only-ever-ineligible ids).
        const onlyIneligibleIds = new Set();
        if (Array.isArray(candidateSet)) {
          for (const e of candidateSet) {
            if (e !== null && typeof e === 'object'
              && typeof e.id === 'string' && e.id.length > 0
              && !isEligible(e) && !byId.has(e.id)) {
              onlyIneligibleIds.add(e.id);
            }
          }
        }

        const out = ss.ssRankFeed({ candidateSet, followGraph, seenState, seed, now });
        assert(Array.isArray(out), `Ranked_List must be an array, got ${show(out)}`);

        for (const id of out) {
          // Every output id is a distinct eligible candidate id.
          assert(byId.has(id),
            `Ranked_List contains id ${show(id)} that is not a distinct eligible candidate id`);
          // No output id is an id that was only ever ineligible.
          assert(!onlyIneligibleIds.has(id),
            `Ranked_List contains id ${show(id)} that only ever appears on ineligible entries`);
        }
        return true;
      }
    ), { numRuns: ITER });
  });

  // (b) When EVERY candidate is excluded by the live/non-deleted criteria, the
  //     Ranked_List is empty (Req 9.5). Build candidate sets that are all-ineligible
  //     by construction (every entry either non-'live' status or non-null deleted_at).
  prop('Property 11: all-ineligible candidate set ⇒ empty Ranked_List', () => {
    const badStatusGen = fc.constantFrom('LIVE', 'Live', 'live ', 'draft', 'removed', '', null);
    const badDeletedGen = fc.constantFrom('2020-01-01T00:00:00Z', 1577836800000, {}, 'garbage');
    // Each entry is ineligible: EITHER a non-'live' status OR a non-null deleted_at.
    const ineligibleEntryGen = fc.oneof(
      fc.record({
        id: fc.hexaString({ minLength: 1, maxLength: 8 }), creator_id: creatorGen,
        created_at: createdAtGen, fires_count: countGen, views_count: countGen,
        status: badStatusGen, deleted_at: fc.constant(null),
      }),
      fc.record({
        id: fc.hexaString({ minLength: 1, maxLength: 8 }), creator_id: creatorGen,
        created_at: createdAtGen, fires_count: countGen, views_count: countGen,
        status: fc.constant('live'), deleted_at: badDeletedGen,
      })
    );
    fc.assert(fc.property(
      fc.array(ineligibleEntryGen, { minLength: 1, maxLength: 200 }),
      followGraphGen, seenGen, seedGen, nowGen,
      (candidateSet, followGraph, seenState, seed, now) => {
        // Sanity: the set really is all-ineligible.
        assert(firstEligibleById(candidateSet).size === 0,
          'test setup error: candidate set unexpectedly contains an eligible clip');
        const out = ss.ssRankFeed({ candidateSet, followGraph, seenState, seed, now });
        assert(Array.isArray(out), `Ranked_List must be an array, got ${show(out)}`);
        assert(out.length === 0,
          `expected empty Ranked_List when every candidate is ineligible, got ${show(out)}`);
        return true;
      }
    ), { numRuns: ITER });
  });
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
