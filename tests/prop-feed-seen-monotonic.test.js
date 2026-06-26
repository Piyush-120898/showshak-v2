/* ═══════════════════════════════════════════════════════════════
   tests/prop-feed-seen-monotonic.test.js — Node property test for the
   feed-follows pure ranker `ssRankFeed(input)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-feed-seen-monotonic.test.js
   (auto-discovered by `node tests/run-all.js`).

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The ranker under test is PURE.

   TDD NOTE (red-first): `ssRankFeed` does NOT exist yet — it lands in task 2.
   This file is EXPECTED to be RED until then. The missing function is reported
   as a clean assertion failure (not a crash), so the red result is meaningful.

   PROPERTY 8 — Cross-session seen-state monotonicity.
   For any candidate set, follow graph, a FIXED seed, and a FIXED `now`: when the
   seen-state grows from a set S to a superset S ∪ X, every clip NEWLY added to the
   seen set (an id in X that is an eligible candidate and was not already in S)
     (i)  stays in the SAME tier (seen-state never moves a clip across tiers), and
     (ii) occupies a within-tier position NO HIGHER than it did under S — i.e. its
          within-tier index under S ∪ X is >= its within-tier index under S (it
          sinks toward the tier's seen sub-block, or stays put; it never rises).

   Tier definition (mutually exclusive + exhaustive over eligible clips):
     recent   = createdAtMs(clip) >= now - 1209600000   (14-day Recency_Window)
     followed = followIds.has(clip.creator_id)
     popular  = popularityScore(clip) > 0
       Tier 1: recent && followed        (primary rule: created_at desc, id asc)
       Tier 2: recent && !followed       (primary rule: created_at desc, id asc)
       Tier 3: !recent && followed       (primary rule: score desc, id asc)
       Tier 4: !recent && !followed && popular   (primary rule: score desc, id asc)
       Tier 5: everything else           (primary rule: seeded shuffle)
   Tier 5 is a seeded shuffle, but with a FIXED seed its base order is stable across
   the two runs, and the unseen→seen partition still applies, so monotonicity holds
   there too. The within-tier index is computed by filtering the output to the ids
   of that clip's tier (via expectedTier over the distinct-eligible map) and taking
   the target id's position in that filtered sub-sequence. SEED and NOW are held
   FIXED across run A (seen = S) and run B (seen = S ∪ X).
═══════════════════════════════════════════════════════════════ */
// Feature: feed-follows, Property 8: Cross-session seen-state monotonicity
// **Validates: Requirements 4.6**
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

console.log('Feature: feed-follows — Property 8: cross-session seen-state monotonicity\n');

/* ── Eligibility predicate, mirroring the design exactly (Req 9, 2.1) ──
   Same predicate as the sibling Property 1/2/3/4/6/7 tests. */
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
// Tier assignment does NOT depend on seen-state, so it must be identical in A and B.
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
   Returns { available, set }. Same seen-id extraction rule as the dedup sibling
   (non-empty string ids only). Used here only to compute the NEWLY-seen id set. */
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

/* Within-tier index of `targetId`: filter the output to the ids whose clip is in
   the SAME tier as the target (tier via expectedTier over byId), then take the
   target's position in that filtered sub-sequence. Returns -1 if not present. */
function withinTierIndex(outIds, byId, followIds, now, targetId, tier) {
  let idx = -1;
  let pos = 0;
  for (const id of outIds) {
    const clip = byId.get(id);
    if (clip === undefined) continue;               // foreign id — ignore here
    if (expectedTier(clip, followIds, now) !== tier) continue;
    if (id === targetId) { idx = pos; break; }
    pos++;
  }
  return idx;
}

/* ── Generators (design Testing Strategy coverage for Property 8) ── */
// Small id pool so the seen sets (S and X) actually intersect the candidate ids.
const idGen = fc.oneof(
  fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f'),
  fc.hexaString({ minLength: 1, maxLength: 8 }),
  fc.constant(''),                    // empty string id → ineligible
  fc.integer({ min: 0, max: 5 })      // non-string id → ineligible
);

const creatorGen = fc.constantFrom('cr1', 'cr2', 'cr3', 'cr4', 'cr5');

// created_at spans RECENT and OLD (plus the 14-day boundary) so multiple tiers can
// populate — this property needs newly-seen members across several tiers.
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
// Tiers 2/4 (non-followed) both populate with newly-seen members.
const followGraphGen = fc.oneof(
  fc.constant(null),
  fc.constant([]),
  fc.constant({ creatorIds: [] }),
  fc.array(creatorGen, { maxLength: 5 }),
  fc.record({ creatorIds: fc.array(creatorGen, { maxLength: 5 }) })
);

// S and X are id-sets drawn from the SAME id pool as the candidates so they
// genuinely reference real eligible clips. X often holds ids not in S (so the
// union strictly grows), and both empty and large sets occur.
const seenIdGen = fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f');
const sSetGen = fc.array(seenIdGen, { minLength: 0, maxLength: 8 });
const xSetGen = fc.array(seenIdGen, { minLength: 0, maxLength: 8 });

const seedGen = fc.oneof(fc.integer(), fc.string());
const nowGen = fc.integer({ min: NOW_BASE - 1000, max: NOW_BASE + 1000 });

/* ── The property ── */
if (typeof ss.ssRankFeed !== 'function') {
  // Red-first: ssRankFeed lands in task 2. Report a clean assertion failure.
  failed++;
  console.log('  \u2717 Property 8: Cross-session seen-state monotonicity' +
    '\n      ssRankFeed is not implemented yet (expected RED until task 2)');
} else {
  prop('Property 8: Cross-session seen-state monotonicity', () => {
    fc.assert(fc.property(
      candidateSetGen, followGraphGen, sSetGen, xSetGen, seedGen, nowGen,
      (candidateSet, followGraph, sSet, xSet, seed, now) => {
        const followIds = followIdSet(followGraph);
        const byId = firstEligibleById(candidateSet);

        // Seen-state S and its superset S ∪ X. Both use the available shape so the
        // partition is active in each run (an empty seen set still ranks as primary
        // order, which is the monotonicity baseline).
        const unionList = sSet.concat(xSet);
        const seenS = { available: true, seen: sSet };
        const seenU = { available: true, seen: unionList };

        // FIXED seed + FIXED now reused across BOTH runs (do not let them vary).
        const outA = ss.ssRankFeed({ candidateSet, followGraph, seenState: seenS, seed, now });
        const outB = ss.ssRankFeed({ candidateSet, followGraph, seenState: seenU, seed, now });
        assert(Array.isArray(outA), `Ranked_List A must be an array, got ${show(outA)}`);
        assert(Array.isArray(outB), `Ranked_List B must be an array, got ${show(outB)}`);

        // NEWLY-seen ids: in the union's seen set but NOT in S's seen set, and an
        // eligible candidate (so it is present in both Ranked_Lists).
        const sNorm = normalizeSeen(seenS);
        const uNorm = normalizeSeen(seenU);
        for (const id of uNorm.set) {
          if (sNorm.set.has(id)) continue;       // already seen under S — not newly-seen
          if (!byId.has(id)) continue;           // not an eligible candidate
          const clip = byId.get(id);

          // (i) Tier is unchanged by seen-state — assert it explicitly in both runs.
          const tier = expectedTier(clip, followIds, now);

          // (ii) Within-tier index must not decrease from A to B (it sinks or stays).
          const idxA = withinTierIndex(outA, byId, followIds, now, id, tier);
          const idxB = withinTierIndex(outB, byId, followIds, now, id, tier);
          assert(idxA >= 0,
            `newly-seen eligible id ${show(id)} missing from Ranked_List A (tier ${tier})`);
          assert(idxB >= 0,
            `newly-seen eligible id ${show(id)} missing from Ranked_List B (tier ${tier})`);
          assert(idxB >= idxA,
            `Tier ${tier} monotonicity violated for newly-seen id ${show(id)}: ` +
            `within-tier index moved UP from ${idxA} (under S) to ${idxB} (under S \u222a X)`);
        }

        return true;
      }
    ), { numRuns: ITER });
  });
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
