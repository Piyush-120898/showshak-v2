/* ═══════════════════════════════════════════════════════════════
   tests/prop-feed-popularity-order.test.js — Node property test for the
   feed-follows pure ranker `ssRankFeed(input)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-feed-popularity-order.test.js
   (auto-discovered by `node tests/run-all.js`).

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The ranker under test is PURE.

   TDD NOTE (red-first): `ssRankFeed` does NOT exist yet — it lands in task 2.
   This file is EXPECTED to be RED until then. The missing function is reported
   as a clean assertion failure (not a crash), so the red result is meaningful.

   PROPERTY 4 — Within-popularity-tier ordering (score desc, id tie-break).
   For any candidate set, within Tiers 3 and 4 — AND within each seen/unseen
   sub-block of those tiers — every adjacent pair of clips is ordered by
   `ssPopularityScore` DESCENDING (most popular first), where the score is
   fires_count*3 + views_count*1, and where two clips share the same popularity
   score they are ordered by ASCENDING clip `id`.

   Tier definition (mutually exclusive + exhaustive over eligible clips):
     recent   = createdAtMs(clip) >= now - 1209600000   (14-day Recency_Window)
     followed = followIds.has(clip.creator_id)
     popular  = popularityScore(clip) > 0
       Tier 3: !recent && followed
       Tier 4: !recent && !followed && popular
   Adjacency is asserted ONLY within the same tier AND the same seen/unseen
   sub-block — never across a tier boundary or a sub-block boundary.
═══════════════════════════════════════════════════════════════ */
// Feature: feed-follows, Property 4: Within-popularity-tier ordering (score desc, id tie-break)
// **Validates: Requirements 1.4**
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

console.log('Feature: feed-follows — Property 4: within-popularity-tier ordering (score desc, id tie-break)\n');

/* ── Eligibility predicate, mirroring the design exactly (Req 9, 2.1) ──
   Same predicate as the sibling Property 1/2/3 tests. */
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

/* Seen-state normalisation, mirroring the design exactly (Req 4.1, 4.5, 8.4).
   Returns { available, set }: `available` is false for null/{available:false}/
   malformed; a bare list or { available:true, seen } is available. Same seen-id
   extraction rule as the dedup sibling (non-empty string ids only). */
function normalizeSeen(seenState) {
  let list = null;
  let available = false;
  if (Array.isArray(seenState)) { list = seenState; available = true; }
  else if (seenState && typeof seenState === 'object') {
    if (seenState.available === true && Array.isArray(seenState.seen)) {
      list = seenState.seen; available = true;
    }
  }
  const set = new Set();
  if (list) for (const v of list) if (typeof v === 'string' && v.length > 0) set.add(v);
  return { available, set };
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

/* ── Generators (design Testing Strategy coverage for Property 4) ── */
const idGen = fc.oneof(
  fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f'),
  fc.hexaString({ minLength: 1, maxLength: 8 }),
  fc.constant(''),                    // empty string id → ineligible
  fc.integer({ min: 0, max: 5 })      // non-string id → ineligible
);

const creatorGen = fc.constantFrom('cr1', 'cr2', 'cr3', 'cr4', 'cr5');

// created_at drawn mostly from OLD timestamps (strictly before now − 14 days) so
// clips land in Tiers 3/4/5, not 1/2 — that is where the popularity comparator
// applies. A few boundary/recent values keep coverage honest.
const oldTimestampGen = fc.oneof(
  fc.constant(NOW_BASE - WINDOW - 1),
  fc.constant(NOW_BASE - WINDOW - 1000),
  fc.constant(NOW_BASE - 2 * WINDOW),
  fc.integer({ min: NOW_BASE - 10 * WINDOW, max: NOW_BASE - WINDOW - 1 })
);
const createdAtGen = fc.oneof(
  oldTimestampGen, oldTimestampGen, oldTimestampGen,                 // heavy: old → Tiers 3/4/5
  fc.constantFrom(NOW_BASE - WINDOW - 1, NOW_BASE - WINDOW, NOW_BASE - WINDOW + 1, NOW_BASE), // boundary
  oldTimestampGen.map((ms) => new Date(ms).toISOString())           // ISO old (still Tiers 3/4/5)
);

// fires/views drawn from a SMALL set of values so that fires*3 + views*1 totals
// COLLIDE frequently — this is what exercises the ascending-id tie-break within
// Tiers 3 and 4. e.g. (f=1,v=0)→3 and (f=0,v=3)→3 collide; (f=2,v=0)→6 and
// (f=1,v=3)→6 collide; many entries also score 0 (Tier 5).
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
// are drawn from the SAME small pool the candidates use, so Tier 3 (older followed)
// and Tier 4 (older non-followed, popular) both populate.
const followGraphGen = fc.oneof(
  fc.constant(null),
  fc.constant([]),
  fc.constant({ creatorIds: [] }),
  fc.array(creatorGen, { maxLength: 5 }),
  fc.record({ creatorIds: fc.array(creatorGen, { maxLength: 5 }) })
);

// seen-state: available / empty / unavailable — exercises the per-sub-block path.
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
  console.log('  \u2717 Property 4: Within-popularity-tier ordering (score desc, id tie-break)' +
    '\n      ssRankFeed is not implemented yet (expected RED until task 2)');
} else {
  prop('Property 4: Within-popularity-tier ordering (score desc, id tie-break)', () => {
    fc.assert(fc.property(
      candidateSetGen, followGraphGen, seenGen, seedGen, nowGen,
      (candidateSet, followGraph, seenState, seed, now) => {
        const followIds = followIdSet(followGraph);
        const byId = firstEligibleById(candidateSet);
        const seen = normalizeSeen(seenState);

        const out = ss.ssRankFeed({ candidateSet, followGraph, seenState, seed, now });
        assert(Array.isArray(out), `Ranked_List must be an array, got ${show(out)}`);

        // For every adjacent pair, only compare WITHIN the same popularity tier
        // (Tier 3 or Tier 4) AND — when seen-state is available — the same
        // seen/unseen sub-block. Cross-tier and cross-sub-block boundaries are
        // skipped (they are governed by other properties).
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

          // Only Tiers 3 and 4 are popularity-ordered; both must be the SAME tier.
          if (!(tPrev === tNext && (tPrev === 3 || tPrev === 4))) continue;

          // When seen-state is available, only assert within a sub-block: both
          // unseen or both seen. A boundary unseen→seen is not a popularity step.
          if (seen.available) {
            const prevSeen = seen.set.has(prevId);
            const nextSeen = seen.set.has(nextId);
            if (prevSeen !== nextSeen) continue;
          }

          const scorePrev = popularityScore(prev);
          const scoreNext = popularityScore(next);
          // ssPopularityScore DESCENDING (most popular first).
          assert(scorePrev >= scoreNext,
            `Tier ${tPrev} popularity order violated at position ${i}: score ` +
            `${show(scorePrev)} (id ${show(prevId)}) precedes ${show(scoreNext)} (id ${show(nextId)})`);
          // Tie on popularity score ⇒ ASCENDING id (string comparison).
          if (scorePrev === scoreNext) {
            assert(prevId < nextId,
              `Tier ${tPrev} id tie-break violated at position ${i}: equal score ` +
              `${show(scorePrev)} but id ${show(prevId)} not < ${show(nextId)}`);
          }
        }
        return true;
      }
    ), { numRuns: ITER });
  });
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
