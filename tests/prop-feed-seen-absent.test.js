/* ═══════════════════════════════════════════════════════════════
   tests/prop-feed-seen-absent.test.js — Node property test for the
   feed-follows pure ranker `ssRankFeed(input)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-feed-seen-absent.test.js
   (auto-discovered by `node tests/run-all.js`).

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The ranker under test is PURE.

   TDD NOTE (red-first): `ssRankFeed` does NOT exist yet — it lands in task 2.
   This file is EXPECTED to be RED until then. The missing function is reported
   as a clean assertion failure (not a crash), so the red result is meaningful.

   PROPERTY 7 — Seen-state absent ⇒ primary order only.
   When seen-state is UNAVAILABLE or EMPTY (including missing, null, malformed,
   { available:false }, or an empty list):
     (a) the Ranked_List equals the one produced with no seen-state at all
         (seenState = null) — any unavailable/empty seen-state behaves exactly
         like absent;
     (b) there is NO seen/unseen partitioning — within Tiers 1/2 the order is pure
         created_at descending + id ascending across the WHOLE tier (no sub-block
         break), and within Tiers 3/4 the order is pure score descending + id
         ascending across the WHOLE tier. (Tier 5 ordering is seeded — skipped.)

   Tier definition (mutually exclusive + exhaustive over eligible clips):
     recent   = createdAtMs(clip) >= now - 1209600000   (14-day Recency_Window)
     followed = followIds.has(clip.creator_id)
     popular  = popularityScore(clip) > 0
       Tier 1: recent && followed        (primary rule: created_at desc, id asc)
       Tier 2: recent && !followed       (primary rule: created_at desc, id asc)
       Tier 3: !recent && followed       (primary rule: score desc, id asc)
       Tier 4: !recent && !followed && popular   (primary rule: score desc, id asc)
       Tier 5: everything else           (primary rule: seeded shuffle)
   (b) is asserted on adjacent ids WITHIN the same tier; tiers are contiguous blocks
   so adjacency walks each tier's internal order in full. (a) deep-compares the
   absent-variant run against a second run with seenState = null.
═══════════════════════════════════════════════════════════════ */
// Feature: feed-follows, Property 7: Seen-state absent ⇒ primary order only
// **Validates: Requirements 4.5**
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

console.log('Feature: feed-follows — Property 7: seen-state absent ⇒ primary order only\n');

/* ── Eligibility predicate, mirroring the design exactly (Req 9, 2.1) ──
   Same predicate as the sibling Property 1/2/3/4/6 tests. */
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

/* ── Generators (design Testing Strategy coverage for Property 7) ── */
// Small id pool so ids can collide for the ascending-id tie-break inside tiers.
const idGen = fc.oneof(
  fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f'),
  fc.hexaString({ minLength: 1, maxLength: 8 }),
  fc.constant(''),                    // empty string id → ineligible
  fc.integer({ min: 0, max: 5 })      // non-string id → ineligible
);

const creatorGen = fc.constantFrom('cr1', 'cr2', 'cr3', 'cr4', 'cr5');

// created_at spans RECENT and OLD (plus the 14-day boundary) so all five tiers can
// populate — this property must see multiple tiers ordered purely by primary rule.
const recentTimestampGen = fc.oneof(
  fc.constant(NOW_BASE),
  fc.constant(NOW_BASE - 1000),
  fc.constant(NOW_BASE - WINDOW + 1),
  fc.integer({ min: NOW_BASE - WINDOW + 1, max: NOW_BASE })
);
const oldTimestampGen = fc.oneof(
  fc.constant(NOW_BASE - WINDOW - 1),
  fc.constant(NOW_BASE - WINDOW - 1000),
  fc.constant(NOW_BASE - 2 * WINDOW),
  fc.integer({ min: NOW_BASE - 10 * WINDOW, max: NOW_BASE - WINDOW - 1 })
);
const createdAtGen = fc.oneof(
  recentTimestampGen, oldTimestampGen,                              // both halves
  fc.constantFrom(NOW_BASE - WINDOW - 1, NOW_BASE - WINDOW, NOW_BASE - WINDOW + 1, NOW_BASE), // boundary
  oldTimestampGen.map((ms) => new Date(ms).toISOString()),         // ISO old
  recentTimestampGen.map((ms) => new Date(ms).toISOString())       // ISO recent
);

// fires/views from a small set: mixes popular (Tier 4) and zero-engagement (Tier 5),
// and produces colliding scores for the ascending-id tie-break inside tiers.
const firesGen = fc.constantFrom(0, 1, 2);
const viewsGen = fc.constantFrom(0, 1, 2, 3);

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
  fires_count: firesGen,
  views_count: viewsGen,
  status: statusGen,
  deleted_at: deletedAtGen,
});

const candidateSetGen = fc.oneof(
  fc.constant([]),
  fc.array(entryGen, { maxLength: 1 }),
  fc.array(entryGen, { minLength: 1, maxLength: 300 })
);

// follow graph: empty AND non-empty in each accepted shape (+ null). creator ids
// are drawn from the SAME small pool the candidates use, so Tiers 1/3 (followed) and
// Tiers 2/4 (non-followed) both populate.
const followGraphGen = fc.oneof(
  fc.constant(null),
  fc.constant([]),
  fc.constant({ creatorIds: [] }),
  fc.array(creatorGen, { maxLength: 5 }),
  fc.record({ creatorIds: fc.array(creatorGen, { maxLength: 5 }) })
);

// This property is about the UNAVAILABLE / EMPTY seen-state case. Every variant here
// must behave EXACTLY like absent (seenState = null). Seen ids (where present) are
// drawn from the candidate id pool so a "malformed-but-has-ids" shape genuinely
// references real clips, proving such shapes are still treated as unavailable.
const seenIdGen = fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f');
const absentSeenStateGen = fc.oneof(
  fc.constant(null),                                                                   // explicit null
  fc.constant(undefined),                                                              // missing
  fc.constant([]),                                                                     // empty bare list
  fc.record({ available: fc.constant(false), seen: fc.array(seenIdGen, { maxLength: 8 }) }), // {available:false}
  fc.constant({ seen: 'nope' }),                                                       // malformed: seen not an array
  fc.constant({ foo: 1 }),                                                             // malformed: foreign object
  fc.record({ available: fc.constant(true) }),                                         // available:true but no seen array
  fc.constant(42),                                                                     // malformed: number
  fc.constant('x')                                                                     // malformed: string
);

const seedGen = fc.oneof(fc.integer(), fc.string());
const nowGen = fc.integer({ min: NOW_BASE - 1000, max: NOW_BASE + 1000 });

/* ── The property ── */
if (typeof ss.ssRankFeed !== 'function') {
  // Red-first: ssRankFeed lands in task 2. Report a clean assertion failure.
  failed++;
  console.log('  \u2717 Property 7: Seen-state absent \u21d2 primary order only' +
    '\n      ssRankFeed is not implemented yet (expected RED until task 2)');
} else {
  prop('Property 7: Seen-state absent \u21d2 primary order only', () => {
    fc.assert(fc.property(
      candidateSetGen, followGraphGen, absentSeenStateGen, seedGen, nowGen,
      (candidateSet, followGraph, seenState, seed, now) => {
        const followIds = followIdSet(followGraph);
        const byId = firstEligibleById(candidateSet);

        // Run WITH the unavailable/empty/malformed seen-state.
        const out = ss.ssRankFeed({ candidateSet, followGraph, seenState, seed, now });
        assert(Array.isArray(out), `Ranked_List must be an array, got ${show(out)}`);

        // ── (a) The unavailable/empty seen-state behaves EXACTLY like absent. Run
        // AGAIN with seenState = null and the same other inputs; the two Ranked_Lists
        // must be deeply equal (same order, same ids). This is the core of Req 4.5.
        const outAbsent = ss.ssRankFeed({ candidateSet, followGraph, seenState: null, seed, now });
        assert(Array.isArray(outAbsent), `Ranked_List (absent run) must be an array, got ${show(outAbsent)}`);
        assert(out.length === outAbsent.length,
          `Ranked_List length differs from the absent run: ${show(out.length)} vs ${show(outAbsent.length)} ` +
          `(seenState=${show(seenState)})`);
        for (let i = 0; i < out.length; i++) {
          assert(out[i] === outAbsent[i],
            `Ranked_List differs from the absent run at position ${i}: ` +
            `${show(out[i])} vs ${show(outAbsent[i])} (seenState=${show(seenState)})`);
        }

        // ── (b) No seen/unseen partition: each tier is ordered SOLELY by its primary
        // rule across the WHOLE tier (no sub-block break). Walk adjacent pairs; for any
        // pair in the SAME deterministic tier (1–4) assert the pure primary comparator.
        // Tier 5 ordering is seeded — skipped. (Tiers are contiguous blocks, so
        // adjacency covers each tier's internal order in full.)
        for (let i = 1; i < out.length; i++) {
          const prevId = out[i - 1];
          const nextId = out[i];
          const prev = byId.get(prevId);
          const next = byId.get(nextId);
          assert(prev !== undefined,
            `Ranked_List id ${show(prevId)} is not a distinct eligible candidate id`);
          assert(next !== undefined,
            `Ranked_List id ${show(nextId)} is not a distinct eligible candidate id`);

          const tPrev = expectedTier(prev, followIds, now);
          const tNext = expectedTier(next, followIds, now);
          if (tPrev !== tNext) continue;          // tier boundary — governed by Property 2

          if (tPrev === 1 || tPrev === 2) {
            // Recency primary rule across the WHOLE tier: created_at desc, id asc.
            const aMs = createdAtMs(prev);
            const bMs = createdAtMs(next);
            assert(aMs >= bMs,
              `Tier ${tPrev} recency order violated at position ${i}: ` +
              `created_at ${show(aMs)} (id ${show(prevId)}) precedes ${show(bMs)} (id ${show(nextId)})`);
            if (aMs === bMs) {
              assert(prevId < nextId,
                `Tier ${tPrev} id tie-break violated at position ${i}: ` +
                `equal created_at but id ${show(prevId)} not < ${show(nextId)}`);
            }
          } else if (tPrev === 3 || tPrev === 4) {
            // Popularity primary rule across the WHOLE tier: score desc, id asc.
            const aS = popularityScore(prev);
            const bS = popularityScore(next);
            assert(aS >= bS,
              `Tier ${tPrev} popularity order violated at position ${i}: ` +
              `score ${show(aS)} (id ${show(prevId)}) precedes ${show(bS)} (id ${show(nextId)})`);
            if (aS === bS) {
              assert(prevId < nextId,
                `Tier ${tPrev} id tie-break violated at position ${i}: ` +
                `equal score but id ${show(prevId)} not < ${show(nextId)}`);
            }
          }
        }

        return true;
      }
    ), { numRuns: ITER });
  });
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
