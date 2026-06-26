/* ═══════════════════════════════════════════════════════════════
   tests/prop-feed-seen-partition.test.js — Node property test for the
   feed-follows pure ranker `ssRankFeed(input)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-feed-seen-partition.test.js
   (auto-discovered by `node tests/run-all.js`).

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The ranker under test is PURE.

   TDD NOTE (red-first): `ssRankFeed` does NOT exist yet — it lands in task 2.
   This file is EXPECTED to be RED until then. The missing function is reported
   as a clean assertion failure (not a crash), so the red result is meaningful.

   PROPERTY 6 — Seen-state de-prioritization within a tier (no cross-tier movement).
   For any candidate set and any AVAILABLE seen-state:
     (a) within every tier no already-seen clip precedes any unseen clip — each tier
         is an unseen sub-block followed by a seen sub-block;
     (b) each sub-block is ordered by that tier's primary rule;
     (c) the tier each clip is assigned to is IDENTICAL to its assignment when
         seen-state is absent — seen-state never moves a clip across tiers.

   Tier definition (mutually exclusive + exhaustive over eligible clips):
     recent   = createdAtMs(clip) >= now - 1209600000   (14-day Recency_Window)
     followed = followIds.has(clip.creator_id)
     popular  = popularityScore(clip) > 0
       Tier 1: recent && followed        (primary rule: created_at desc, id asc)
       Tier 2: recent && !followed       (primary rule: created_at desc, id asc)
       Tier 3: !recent && followed       (primary rule: score desc, id asc)
       Tier 4: !recent && !followed && popular   (primary rule: score desc, id asc)
       Tier 5: everything else           (primary rule: seeded shuffle)
   (a) is asserted on adjacent ids WITHIN the same tier; tiers are contiguous blocks
   so adjacency walks each tier's internal order in full. (c) compares the per-tier
   id SETS between the seen run and a second run with seenState=null.
═══════════════════════════════════════════════════════════════ */
// Feature: feed-follows, Property 6: Seen-state de-prioritization within a tier (no cross-tier movement)
// **Validates: Requirements 4.1, 4.2, 4.3**
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

console.log('Feature: feed-follows — Property 6: seen-state de-prioritization within a tier (no cross-tier movement)\n');

/* ── Eligibility predicate, mirroring the design exactly (Req 9, 2.1) ──
   Same predicate as the sibling Property 1/2/3/4 tests. */
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

// Partition an output id list into per-tier id SETS (tier from expectedTier).
function tierIdSets(outIds, byId, followIds, now) {
  const sets = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set(), 5: new Set() };
  for (const id of outIds) {
    const clip = byId.get(id);
    if (clip === undefined) continue;          // foreign ids caught by the (a) walk
    sets[expectedTier(clip, followIds, now)].add(id);
  }
  return sets;
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/* ── Generators (design Testing Strategy coverage for Property 6) ── */
// Small id pool so seen-state ids actually intersect the candidate ids.
const idGen = fc.oneof(
  fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f'),
  fc.hexaString({ minLength: 1, maxLength: 8 }),
  fc.constant(''),                    // empty string id → ineligible
  fc.integer({ min: 0, max: 5 })      // non-string id → ineligible
);

const creatorGen = fc.constantFrom('cr1', 'cr2', 'cr3', 'cr4', 'cr5');

// created_at spans RECENT and OLD (plus the 14-day boundary) so all five tiers can
// populate — this property must see both seen and unseen members in multiple tiers.
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
// and produces colliding scores for the ascending-id tie-break inside sub-blocks.
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
// Tiers 2/4 (non-followed) both populate with seen and unseen members.
const followGraphGen = fc.oneof(
  fc.constant(null),
  fc.constant([]),
  fc.constant({ creatorIds: [] }),
  fc.array(creatorGen, { maxLength: 5 }),
  fc.record({ creatorIds: fc.array(creatorGen, { maxLength: 5 }) })
);

// This property is about the AVAILABLE, non-empty case. Seen ids are drawn from the
// SAME id pool as the candidates so the seen set genuinely intersects the eligible
// clips, spreading seen/unseen members across multiple tiers. Both the explicit
// { available:true, seen:[...] } shape and the bare-list shape (treated as
// available) are generated.
const seenIdGen = fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f');
const seenStateGen = fc.oneof(
  fc.array(seenIdGen, { minLength: 1, maxLength: 8 }),                                  // bare list (available)
  fc.record({ available: fc.constant(true), seen: fc.array(seenIdGen, { minLength: 1, maxLength: 8 }) })
);

const seedGen = fc.oneof(fc.integer(), fc.string());
const nowGen = fc.integer({ min: NOW_BASE - 1000, max: NOW_BASE + 1000 });

/* ── The property ── */
if (typeof ss.ssRankFeed !== 'function') {
  // Red-first: ssRankFeed lands in task 2. Report a clean assertion failure.
  failed++;
  console.log('  \u2717 Property 6: Seen-state de-prioritization within a tier (no cross-tier movement)' +
    '\n      ssRankFeed is not implemented yet (expected RED until task 2)');
} else {
  prop('Property 6: Seen-state de-prioritization within a tier (no cross-tier movement)', () => {
    fc.assert(fc.property(
      candidateSetGen, followGraphGen, seenStateGen, seedGen, nowGen,
      (candidateSet, followGraph, seenState, seed, now) => {
        const followIds = followIdSet(followGraph);
        const byId = firstEligibleById(candidateSet);
        const seen = normalizeSeen(seenState);
        // Guard: the generator only produces AVAILABLE seen-state for this property.
        assert(seen.available, 'test setup: seen-state must be available for Property 6');

        // Run WITH the available seen-state.
        const out = ss.ssRankFeed({ candidateSet, followGraph, seenState, seed, now });
        assert(Array.isArray(out), `Ranked_List must be an array, got ${show(out)}`);

        // ── (a) Within every tier, no seen clip precedes any unseen clip. Walk
        // adjacent pairs; for any pair in the SAME tier assert NOT (prev seen AND
        // next unseen). Once a tier's seen sub-block starts, no unseen may follow
        // within that tier. (Tiers are contiguous blocks, so adjacency covers the
        // whole within-tier order.)
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

          const prevSeen = seen.set.has(prevId);
          const nextSeen = seen.set.has(nextId);
          assert(!(prevSeen && !nextSeen),
            `Tier ${tPrev} seen/unseen partition violated at position ${i}: seen id ` +
            `${show(prevId)} precedes unseen id ${show(nextId)} within the same tier`);

          // ── (b) Light within-sub-block primary-rule check. Only when both clips
          // are in the SAME sub-block (both seen or both unseen) of a deterministic
          // tier (1–4). Tier 5 is a seeded shuffle, so it has no asserted order.
          if (prevSeen === nextSeen) {
            if (tPrev === 1 || tPrev === 2) {
              // Recency primary rule: created_at descending, id ascending tie-break.
              const aMs = createdAtMs(prev);
              const bMs = createdAtMs(next);
              assert(aMs >= bMs,
                `Tier ${tPrev} sub-block recency order violated at position ${i}: ` +
                `created_at ${show(aMs)} (id ${show(prevId)}) precedes ${show(bMs)} (id ${show(nextId)})`);
              if (aMs === bMs) {
                assert(prevId < nextId,
                  `Tier ${tPrev} sub-block id tie-break violated at position ${i}: ` +
                  `equal created_at but id ${show(prevId)} not < ${show(nextId)}`);
              }
            } else if (tPrev === 3 || tPrev === 4) {
              // Popularity primary rule: score descending, id ascending tie-break.
              const aS = popularityScore(prev);
              const bS = popularityScore(next);
              assert(aS >= bS,
                `Tier ${tPrev} sub-block popularity order violated at position ${i}: ` +
                `score ${show(aS)} (id ${show(prevId)}) precedes ${show(bS)} (id ${show(nextId)})`);
              if (aS === bS) {
                assert(prevId < nextId,
                  `Tier ${tPrev} sub-block id tie-break violated at position ${i}: ` +
                  `equal score but id ${show(prevId)} not < ${show(nextId)}`);
              }
            }
          }
        }

        // ── (c) Seen-state never moves a clip across tiers. Run AGAIN with
        // seenState=null (absent) and the same other inputs; the partition of ids
        // into tiers must be IDENTICAL between the two runs.
        const outAbsent = ss.ssRankFeed({ candidateSet, followGraph, seenState: null, seed, now });
        assert(Array.isArray(outAbsent), `Ranked_List (absent run) must be an array, got ${show(outAbsent)}`);

        const seenSets = tierIdSets(out, byId, followIds, now);
        const absentSets = tierIdSets(outAbsent, byId, followIds, now);
        for (let t = 1; t <= 5; t++) {
          assert(setsEqual(seenSets[t], absentSets[t]),
            `Tier ${t} membership changed between seen and absent runs: ` +
            `seen=${show([...seenSets[t]])} vs absent=${show([...absentSets[t]])}`);
        }

        return true;
      }
    ), { numRuns: ITER });
  });
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
