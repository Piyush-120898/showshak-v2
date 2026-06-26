/* ═══════════════════════════════════════════════════════════════
   tests/prop-feed-tier-priority.test.js — Node property test for the
   feed-follows pure ranker `ssRankFeed(input)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-feed-tier-priority.test.js
   (auto-discovered by `node tests/run-all.js`).

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The ranker under test is PURE.

   TDD NOTE (red-first): `ssRankFeed` does NOT exist yet — it lands in task 2.
   This file is EXPECTED to be RED until then. The missing function is reported
   as a clean assertion failure (not a crash), so the red result is meaningful.

   PROPERTY 2 — Tier partition and priority ordering.
   For any candidate set, follow graph, and reference time `now`, every eligible
   clip is placed in EXACTLY the tier its definition selects, in that single
   highest-priority tier, and the Ranked_List is ordered so the tier index is
   NON-DECREASING along the list (every Tier 1 id precedes every Tier 2 id, every
   Tier 2 precedes every Tier 3, etc.). A non-empty follow graph that matches some
   candidates' creator_ids populates Tier 1 (recent followed) and Tier 3 (older
   followed).

   Tier definition (mutually exclusive + exhaustive over eligible clips):
     recent   = createdAtMs(clip) >= now - 1209600000   (14-day Recency_Window)
     followed = followIds.has(clip.creator_id)
     popular  = ssPopularityScore(clip) > 0  (fires*3 + views*1, clamp <0/NaN → 0)
       Tier 1: recent && followed
       Tier 2: recent && !followed
       Tier 3: !recent && followed
       Tier 4: !recent && !followed && popular
       Tier 5: !recent && !followed && !popular
═══════════════════════════════════════════════════════════════ */
// Feature: feed-follows, Property 2: Tier partition and priority ordering
// **Validates: Requirements 1.1, 1.2, 1.6, 2.2, 7.4**
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

console.log('Feature: feed-follows — Property 2: tier partition and priority ordering\n');

/* ── Eligibility predicate, mirroring the design exactly (Req 9, 2.1) ──
   Same predicate as the sibling Property 1 test. */
function isEligible(e) {
  return e !== null && typeof e === 'object'
    && e.status === 'live'
    && (e.deleted_at === null || e.deleted_at === undefined)
    && typeof e.id === 'string' && e.id.length > 0;
}

/* ── Independent re-derivation of the tier definition from a clip's fields ── */
const WINDOW = 1209600000;            // 14 days in ms (Recency_Window)
const NOW_BASE = 1700000000000;       // fixed reference epoch for created_at coverage

// created_at → ms epoch via Number/Date.parse; non-finite/garbage → NaN (not recent).
function createdAtMs(clip) {
  const v = clip && clip.created_at;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v === 'string') {
    const n = Date.parse(v);
    return Number.isNaN(n) ? NaN : n;
  }
  return NaN;
}

// Replicate the popularity formula: fires*3 + views*1, non-finite/negative → 0.
function popularityScore(clip) {
  const f = (clip && Number.isFinite(+clip.fires_count)) ? Math.max(0, +clip.fires_count) : 0;
  const v = (clip && Number.isFinite(+clip.views_count)) ? Math.max(0, +clip.views_count) : 0;
  return f * 3 + v * 1;
}

// Extract the followed creator-id Set from any accepted follow-graph shape.
function followIdSet(followGraph) {
  let list = [];
  if (Array.isArray(followGraph)) list = followGraph;
  else if (followGraph && typeof followGraph === 'object' && Array.isArray(followGraph.creatorIds)) {
    list = followGraph.creatorIds;
  }
  const s = new Set();
  for (const v of list) if (typeof v === 'string' && v.length > 0) s.add(v);
  return s;
}

// The tier each eligible clip's definition selects (mutually exclusive, exhaustive).
function expectedTier(clip, followIds, now) {
  const followed = followIds.has(clip.creator_id);
  const ms = createdAtMs(clip);
  const recent = Number.isFinite(ms) && ms >= now - WINDOW;
  const popular = popularityScore(clip) > 0;
  if (recent && followed) return 1;
  if (recent && !followed) return 2;
  if (!recent && followed) return 3;
  if (!recent && !followed && popular) return 4;
  return 5;
}

/* Build the distinct-eligible first-occurrence map (id → clip), mirroring the
   ranker's "keep first occurrence of each id" de-dup so tier lookup is unambiguous. */
function firstEligibleById(candidateSet) {
  const map = new Map();
  if (Array.isArray(candidateSet)) {
    for (const e of candidateSet) {
      if (isEligible(e) && !map.has(e.id)) map.set(e.id, e);
    }
  }
  return map;
}

/* ── Generators (design Testing Strategy coverage for Property 2) ── */
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

// candidate sets: empty / single / large.
const candidateSetGen = fc.oneof(
  fc.constant([]),
  fc.array(entryGen, { maxLength: 1 }),
  fc.array(entryGen, { minLength: 1, maxLength: 300 })
);

// follow graph: empty and non-empty, in each accepted shape (+ null). creator ids
// are drawn from the SAME small pool the candidates use so they actually match.
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

/* ── The property ── */
if (typeof ss.ssRankFeed !== 'function') {
  // Red-first: ssRankFeed lands in task 2. Report a clean assertion failure.
  failed++;
  console.log('  \u2717 Property 2: Tier partition and priority ordering' +
    '\n      ssRankFeed is not implemented yet (expected RED until task 2)');
} else {
  // (a) non-decreasing tier index along the list, and (b) the multiset of tiers
  //     present matches the per-clip expected assignment.
  prop('Property 2: Tier partition and priority ordering', () => {
    fc.assert(fc.property(
      candidateSetGen, followGraphGen, seenGen, seedGen, nowGen,
      (candidateSet, followGraph, seenState, seed, now) => {
        const followIds = followIdSet(followGraph);
        const byId = firstEligibleById(candidateSet);

        // Expected tier multiset, computed independently per distinct eligible clip.
        const expectedCounts = [0, 0, 0, 0, 0, 0]; // index 1..5 used
        for (const clip of byId.values()) {
          expectedCounts[expectedTier(clip, followIds, now)]++;
        }

        const out = ss.ssRankFeed({ candidateSet, followGraph, seenState, seed, now });
        assert(Array.isArray(out), `Ranked_List must be an array, got ${show(out)}`);

        // Map each output id back to its (first-occurrence) clip and its tier.
        const tierSeq = [];
        for (const id of out) {
          const clip = byId.get(id);
          assert(clip !== undefined,
            `Ranked_List id ${show(id)} is not a distinct eligible candidate id`);
          tierSeq.push(expectedTier(clip, followIds, now));
        }

        // (a) Tier index is non-decreasing along the Ranked_List (Req 1.2, 2.2):
        //     every Tier N id precedes every Tier N+1 id.
        for (let i = 1; i < tierSeq.length; i++) {
          assert(tierSeq[i] >= tierSeq[i - 1],
            `tier index decreased at position ${i}: tier ${tierSeq[i - 1]} (id ` +
            `${show(out[i - 1])}) precedes tier ${tierSeq[i]} (id ${show(out[i])})`);
        }

        // (b) The multiset of tiers present matches the per-clip expected
        //     assignment exactly — every eligible clip lands in exactly its one
        //     highest-priority tier (Req 1.1, 2.2).
        const actualCounts = [0, 0, 0, 0, 0, 0];
        for (const t of tierSeq) actualCounts[t]++;
        for (let t = 1; t <= 5; t++) {
          assert(actualCounts[t] === expectedCounts[t],
            `Tier ${t} membership mismatch: expected ${expectedCounts[t]}, ` +
            `got ${actualCounts[t]}`);
        }
        return true;
      }
    ), { numRuns: ITER });
  });

  // (c) A non-empty follow graph that matches candidates' creator_ids within /
  //     outside the recency window populates Tier 1 (recent followed) and Tier 3
  //     (older followed) (Req 7.4 — follows change the contract without breaking it).
  prop('Property 2: non-empty follow graph populates Tiers 1 and 3', () => {
    const extrasGen = fc.array(
      fc.record({
        creator_id: creatorGen,
        created_at: createdAtGen,
        fires_count: countGen,
        views_count: countGen,
      }),
      { maxLength: 50 }
    );
    fc.assert(fc.property(
      extrasGen, seedGen, nowGen,
      (extras, seed, now) => {
        let i = 0;
        const mk = (creator, ms, fires, views) => ({
          id: 'p' + (i++), creator_id: creator, created_at: ms,
          fires_count: fires, views_count: views, status: 'live', deleted_at: null,
        });

        // Two guaranteed-eligible, followed clips: one recent (→ Tier 1), one old
        // (→ Tier 3). 'cr1' is in the follow graph below.
        const candidateSet = [
          mk('cr1', now - 1000, 5, 5),            // recent followed → Tier 1
          mk('cr1', now - 3 * WINDOW, 5, 5),      // old followed    → Tier 3
        ];
        for (const e of extras) {
          candidateSet.push({
            id: 'p' + (i++), creator_id: e.creator_id, created_at: e.created_at,
            fires_count: e.fires_count, views_count: e.views_count,
            status: 'live', deleted_at: null,
          });
        }

        const followGraph = { creatorIds: ['cr1'] };
        const followIds = followIdSet(followGraph);
        const byId = firstEligibleById(candidateSet);

        const out = ss.ssRankFeed({ candidateSet, followGraph, seenState: null, seed, now });
        assert(Array.isArray(out), `Ranked_List must be an array, got ${show(out)}`);

        let hasTier1 = false, hasTier3 = false;
        for (const id of out) {
          const clip = byId.get(id);
          assert(clip !== undefined, `Ranked_List id ${show(id)} is not eligible`);
          const t = expectedTier(clip, followIds, now);
          if (t === 1) hasTier1 = true;
          if (t === 3) hasTier3 = true;
        }
        assert(hasTier1, 'expected a non-empty Tier 1 (recent followed clip) but found none');
        assert(hasTier3, 'expected a non-empty Tier 3 (older followed clip) but found none');
        return true;
      }
    ), { numRuns: ITER });
  });
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
