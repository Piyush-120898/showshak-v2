/* ═══════════════════════════════════════════════════════════════
   tests/prop-feed-empty-follow.test.js — Node property test for the
   feed-follows pure ranker `ssRankFeed(input)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-feed-empty-follow.test.js
   (auto-discovered by `node tests/run-all.js`).

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The ranker under test is PURE.

   TDD NOTE (red-first): `ssRankFeed` does NOT exist yet — it lands in task 2.
   This file is EXPECTED to be RED until then. The missing function is reported
   as a clean assertion failure (not a crash), so the red result is meaningful.

   PROPERTY 9 — Empty-follow degradation.
   For any candidate set ranked with an EMPTY (or missing / malformed) follow
   graph:
     - Tiers 1 and 3 are EMPTY — no clip can be "followed" (Req 5.3).
     - Every eligible clip appears exactly once, distributed across Tiers 2, 4,
       and 5 (Req 5.3).
     - The Ranked_List is ordered so every Tier 2 clip precedes every Tier 4 clip
       and every Tier 4 precedes every Tier 5 (Req 5.1).
     - The Tier 2 (recent) subset is ordered newest-first — `created_at`
       descending, ascending `id` tie-break — equivalent to the Fallback_Feed
       ordering over that recent subset (Req 7.1).
     - An EMPTY candidate set yields an EMPTY Ranked_List (Req 5.4).
═══════════════════════════════════════════════════════════════ */
// Feature: feed-follows, Property 9: Empty-follow degradation
// **Validates: Requirements 5.1, 5.3, 5.4, 7.1**
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

console.log('Feature: feed-follows — Property 9: empty-follow degradation\n');

/* ── Eligibility predicate, mirroring the design exactly (Req 9, 2.1) ──
   Same predicate as the sibling tier-priority test. */
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

/* ── Generators (design Testing Strategy coverage for Property 9) ── */
const idGen = fc.oneof(
  fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f'),
  fc.hexaString({ minLength: 1, maxLength: 8 }),
  fc.constant(''),                    // empty string id → ineligible
  fc.integer({ min: 0, max: 5 })      // non-string id → ineligible
);

const creatorGen = fc.constantFrom('cr1', 'cr2', 'cr3', 'cr4', 'cr5');

// created_at straddling the 14-day window relative to NOW_BASE: recent / exactly
// at the boundary / old, as numbers and ISO strings — so Tiers 2/4/5 all populate.
const createdAtGen = fc.oneof(
  fc.integer({ min: NOW_BASE - WINDOW + 1, max: NOW_BASE }),                       // recent
  fc.constantFrom(NOW_BASE - WINDOW - 1, NOW_BASE - WINDOW, NOW_BASE - WINDOW + 1, NOW_BASE), // boundary
  fc.integer({ min: NOW_BASE - 10 * WINDOW, max: NOW_BASE - WINDOW - 1 }),         // old
  fc.integer({ min: NOW_BASE - 3 * WINDOW, max: NOW_BASE }).map((ms) => new Date(ms).toISOString())
);

// A small pool of colliding recent timestamps to exercise the Tier 2 ascending-id
// tie-break (created_at desc, id asc) over the recent subset.
const collidingRecentGen = fc.constantFrom(
  NOW_BASE - 1000, NOW_BASE - 2000, NOW_BASE - 3000
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
  created_at: fc.oneof(createdAtGen, collidingRecentGen),
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

// EMPTY / missing / malformed follow-graph variants ONLY — none of these can ever
// produce a followed creator id, so Tiers 1 and 3 must stay empty (Req 5.3, 8.3).
const emptyFollowGraphGen = fc.constantFrom(
  null, undefined, [], { creatorIds: [] }, {}, 42, 'x', { creatorIds: 'nope' }
);

const seedGen = fc.oneof(fc.integer(), fc.string());
const nowGen = fc.integer({ min: NOW_BASE - 1000, max: NOW_BASE + 1000 });

/* ── The property ── */
if (typeof ss.ssRankFeed !== 'function') {
  // Red-first: ssRankFeed lands in task 2. Report a clean assertion failure.
  failed++;
  console.log('  \u2717 Property 9: Empty-follow degradation' +
    '\n      ssRankFeed is not implemented yet (expected RED until task 2)');
} else {
  // (a) Empty follow graph ⇒ no Tier 1 / Tier 3, every eligible clip exactly once
  //     across Tiers 2/4/5, non-decreasing tier index over {2,4,5}, and the Tier 2
  //     recent subset is newest-first (created_at desc, id asc).
  prop('Property 9: empty-follow degradation distributes across Tiers 2, 4, 5', () => {
    fc.assert(fc.property(
      candidateSetGen, emptyFollowGraphGen, seedGen, nowGen,
      (candidateSet, followGraph, seed, now) => {
        // The follow graph is one of the empty/malformed variants, so the followed
        // id set is necessarily empty — assert that to anchor the property.
        const followIds = followIdSet(followGraph);
        assert(followIds.size === 0,
          `empty/malformed follow graph ${show(followGraph)} must yield no followed ids`);

        const byId = firstEligibleById(candidateSet);

        // Expected per-tier multiset, computed independently with an EMPTY follow set.
        const expectedCounts = [0, 0, 0, 0, 0, 0]; // index 1..5 used
        for (const clip of byId.values()) {
          expectedCounts[expectedTier(clip, followIds, now)]++;
        }

        // seenState=null keeps it simple; seen behaviour is covered by P6/P7.
        const out = ss.ssRankFeed({ candidateSet, followGraph, seenState: null, seed, now });
        assert(Array.isArray(out), `Ranked_List must be an array, got ${show(out)}`);

        // Map each output id back to its (first-occurrence) clip and its tier.
        const tierSeq = [];
        for (const id of out) {
          const clip = byId.get(id);
          assert(clip !== undefined,
            `Ranked_List id ${show(id)} is not a distinct eligible candidate id`);
          tierSeq.push(expectedTier(clip, followIds, now));
        }

        // De-dup / permutation sanity (anchors Req 5.3 "every clip exactly once"):
        // the output id set equals the distinct eligible id set, no dups.
        assert(out.length === byId.size,
          `Ranked_List length ${out.length} must equal distinct eligible count ${byId.size}`);
        const outSet = new Set(out);
        assert(outSet.size === out.length, 'Ranked_List contains duplicate ids');
        for (const id of byId.keys()) {
          assert(outSet.has(id), `eligible id ${show(id)} missing from Ranked_List`);
        }

        // No clip lands in Tier 1 or Tier 3 (Req 5.3 — nothing can be followed).
        for (let i = 0; i < tierSeq.length; i++) {
          assert(tierSeq[i] !== 1 && tierSeq[i] !== 3,
            `id ${show(out[i])} landed in Tier ${tierSeq[i]}, but Tiers 1 and 3 ` +
            'must be empty with an empty follow graph');
        }

        // Tier index is non-decreasing along the list and only contains {2,4,5}
        // (Req 5.1 — every Tier 2 precedes every Tier 4 precedes every Tier 5).
        for (let i = 0; i < tierSeq.length; i++) {
          const t = tierSeq[i];
          assert(t === 2 || t === 4 || t === 5,
            `unexpected tier ${t} for id ${show(out[i])} (only 2/4/5 allowed)`);
          if (i > 0) {
            assert(t >= tierSeq[i - 1],
              `tier index decreased at position ${i}: tier ${tierSeq[i - 1]} (id ` +
              `${show(out[i - 1])}) precedes tier ${t} (id ${show(out[i])})`);
          }
        }

        // Per-tier multiset matches the independent expectation exactly (Req 5.3).
        const actualCounts = [0, 0, 0, 0, 0, 0];
        for (const t of tierSeq) actualCounts[t]++;
        for (let t = 1; t <= 5; t++) {
          assert(actualCounts[t] === expectedCounts[t],
            `Tier ${t} membership mismatch: expected ${expectedCounts[t]}, ` +
            `got ${actualCounts[t]}`);
        }

        // The Tier 2 (recent) subset is newest-first: created_at desc, id asc
        // (Req 7.1 — equivalent to the Fallback_Feed ordering over the recent
        // subset). Check the whole Tier 2 run, pure, with no seen partition.
        const tier2Ids = out.filter((id) => expectedTier(byId.get(id), followIds, now) === 2);
        for (let i = 1; i < tier2Ids.length; i++) {
          const prev = byId.get(tier2Ids[i - 1]);
          const cur = byId.get(tier2Ids[i]);
          const pMs = createdAtMs(prev), cMs = createdAtMs(cur);
          assert(pMs >= cMs,
            `Tier 2 not newest-first: id ${show(tier2Ids[i - 1])} (created_at ${pMs}) ` +
            `precedes id ${show(tier2Ids[i])} (created_at ${cMs})`);
          if (pMs === cMs) {
            assert(tier2Ids[i - 1] < tier2Ids[i],
              `Tier 2 created_at tie not broken by ascending id: ${show(tier2Ids[i - 1])} ` +
              `before ${show(tier2Ids[i])}`);
          }
        }
        return true;
      }
    ), { numRuns: ITER });
  });

  // (b) An EMPTY candidate set yields an EMPTY Ranked_List (Req 5.4), for any of
  //     the empty/malformed follow-graph variants, seed, and now.
  prop('Property 9: empty candidate set ⇒ empty Ranked_List', () => {
    fc.assert(fc.property(
      emptyFollowGraphGen, seedGen, nowGen,
      (followGraph, seed, now) => {
        const out = ss.ssRankFeed({ candidateSet: [], followGraph, seenState: null, seed, now });
        assert(Array.isArray(out), `Ranked_List must be an array, got ${show(out)}`);
        assert(out.length === 0,
          `empty candidate set must yield an empty Ranked_List, got ${show(out)}`);
        return true;
      }
    ), { numRuns: ITER });
  });
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
