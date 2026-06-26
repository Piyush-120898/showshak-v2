/* ═══════════════════════════════════════════════════════════════
   tests/prop-feed-public-signals-inert.test.js — Node property test for the
   feed-follows pure ranker `ssRankFeed(input)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-feed-public-signals-inert.test.js
   (auto-discovered by `node tests/run-all.js`).

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The ranker under test is PURE.

   TDD NOTE (red-first): `ssRankFeed` does NOT exist yet — it lands in task 2.
   This file is EXPECTED to be RED until then. The missing function is reported
   as a clean assertion failure (not a crash), so the red result is meaningful.

   PROPERTY 5 — Public-signals-only (private fields are inert). HIDE THE
   SCOREBOARD safety. The ranker may read ONLY the public-signal whitelist on a
   candidate entry — id, creator_id, created_at, fires_count, views_count, plus
   the eligibility fields status and deleted_at. For any candidate set, injecting
   arbitrary NON-whitelist fields onto its entries — including private metrics
   like watch_it_count, watch_it_taps, watch_events, reach, fires_received,
   analytics_daily, and arbitrary junk keys with arbitrary values — produces
   EXACTLY the same Ranked_List as when those fields are absent.

   APPROACH: generate a base candidate set with the usual entry generator
   (id/creator_id/created_at/fires_count/views_count/status/deleted_at). Build a
   "polluted" copy where each entry gets arbitrary private fields injected, taking
   care the injected keys NEVER collide with the 7 whitelisted keys. Call
   ssRankFeed with identical { followGraph, seenState, seed, now } on BOTH the
   clean and polluted candidate sets and assert the two Ranked_Lists are deeply
   equal (same length, same ids in same order).
═══════════════════════════════════════════════════════════════ */
// Feature: feed-follows, Property 5: Public-signals-only (private fields are inert)
// **Validates: Requirements 3.1, 3.5**
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

console.log('Feature: feed-follows — Property 5: public-signals-only (private fields are inert)\n');

/* ── The seven keys the ranker is allowed to read on a candidate entry ──
   The five Public_Signals (id, creator_id, created_at, fires_count,
   views_count) plus the two eligibility fields (status, deleted_at). An
   injected private field MUST NOT collide with any of these, or it would no
   longer be testing inertness — it would be overwriting a whitelisted input. */
const WHITELIST = new Set([
  'id', 'creator_id', 'created_at', 'fires_count', 'views_count',
  'status', 'deleted_at',
]);

const NOW_BASE = 1700000000000;       // fixed reference epoch for created_at coverage
const WINDOW = 1209600000;            // 14 days in ms (Recency_Window)

/* ── Base entry generator (identical field space to the sibling tests) ── */
const idGen = fc.oneof(
  fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f'),
  fc.hexaString({ minLength: 1, maxLength: 8 }),
  fc.constant(''),                    // empty string id → ineligible
  fc.integer({ min: 0, max: 5 })      // non-string id → ineligible
);

const creatorGen = fc.constantFrom('cr1', 'cr2', 'cr3', 'cr4', 'cr5');

// created_at straddling the 14-day boundary (just inside, exactly at, just
// outside), with colliding values for the recency tie-break, in both ms and ISO.
const tsGen = fc.oneof(
  fc.constant(NOW_BASE - WINDOW - 1),
  fc.constant(NOW_BASE - WINDOW),
  fc.constant(NOW_BASE - WINDOW + 1),
  fc.constant(NOW_BASE),
  fc.constant(NOW_BASE - 1000),
  fc.integer({ min: NOW_BASE - 10 * WINDOW, max: NOW_BASE + 1000 })
);
const createdAtGen = fc.oneof(
  tsGen, tsGen,
  tsGen.map((ms) => new Date(ms).toISOString())
);

// Small value sets so popularity scores and recency timestamps COLLIDE often.
const firesGen = fc.constantFrom(0, 1, 2, 3);
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

/* ── Follow graph / seen-state / seed / now generators (same space as siblings) ── */
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

/* ── Injected private-field generator ──
   An arbitrary JSON-ish value to assign to a private metric or junk key. */
const junkValueGen = fc.oneof(
  fc.integer(),
  fc.integer({ min: -1000000, max: 1000000 }),
  fc.double({ noNaN: false }),
  fc.boolean(),
  fc.string(),
  fc.constant(null),
  fc.constant(undefined),
  fc.array(fc.integer(), { maxLength: 4 }),
  fc.record({ count: fc.integer(), reach: fc.integer() })
);

// A random key that is NOT one of the whitelisted seven (so it tests inertness,
// never overwrites a real signal). Mixes named private metrics with junk keys.
const privateKeyGen = fc.oneof(
  fc.constantFrom(
    'watch_it_count', 'watch_it_taps', 'watch_events', 'reach',
    'fires_received', 'analytics_daily', 'engagement', 'private_score',
    'internal_rank', 'shadow_boost'
  ),
  fc.string({ minLength: 1, maxLength: 10 })
).filter((k) => typeof k === 'string' && k.length > 0 && !WHITELIST.has(k));

// A bag of private fields to inject onto a single entry: always includes the
// canonical private metrics with arbitrary values, plus a couple of random junk
// keys. Guaranteed to exclude all seven whitelisted keys.
const injectionGen = fc.record({
  watch_it_count: fc.integer({ min: 0, max: 1000000 }),
  watch_it_taps: fc.integer({ min: 0, max: 1000000 }),
  watch_events: fc.array(fc.record({ at: fc.integer(), kind: fc.string() }), { maxLength: 5 }),
  reach: fc.integer({ min: 0, max: 1000000 }),
  fires_received: fc.integer({ min: 0, max: 1000000 }),
  analytics_daily: fc.array(fc.integer(), { maxLength: 7 }),
  extraA: fc.tuple(privateKeyGen, junkValueGen),
  extraB: fc.tuple(privateKeyGen, junkValueGen),
});

// Build a polluted copy of the candidate set: each entry keeps its whitelisted
// fields verbatim and gains the injected private fields. Junk keys colliding with
// the whitelist are skipped so the seven signals are never overwritten.
function pollute(candidateSet, injections) {
  if (!Array.isArray(candidateSet)) return candidateSet;
  return candidateSet.map((entry, i) => {
    if (entry === null || typeof entry !== 'object') return entry;
    const inj = injections[i % injections.length] || {};
    const polluted = {
      watch_it_count: inj.watch_it_count,
      watch_it_taps: inj.watch_it_taps,
      watch_events: inj.watch_events,
      reach: inj.reach,
      fires_received: inj.fires_received,
      analytics_daily: inj.analytics_daily,
    };
    // Two arbitrary extra junk keys (skip if they would collide with whitelist).
    for (const pair of [inj.extraA, inj.extraB]) {
      if (Array.isArray(pair)) {
        const k = pair[0];
        if (typeof k === 'string' && k.length > 0 && !WHITELIST.has(k)) {
          polluted[k] = pair[1];
        }
      }
    }
    // Whitelisted fields copied LAST so an injected key can never shadow them.
    polluted.id = entry.id;
    polluted.creator_id = entry.creator_id;
    polluted.created_at = entry.created_at;
    polluted.fires_count = entry.fires_count;
    polluted.views_count = entry.views_count;
    polluted.status = entry.status;
    polluted.deleted_at = entry.deleted_at;
    return polluted;
  });
}

function deepEqualIds(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/* ── The property ── */
if (typeof ss.ssRankFeed !== 'function') {
  // Red-first: ssRankFeed lands in task 2. Report a clean assertion failure.
  failed++;
  console.log('  \u2717 Property 5: Public-signals-only (private fields are inert)' +
    '\n      ssRankFeed is not implemented yet (expected RED until task 2)');
} else {
  prop('Property 5: Public-signals-only (private fields are inert)', () => {
    fc.assert(fc.property(
      candidateSetGen, fc.array(injectionGen, { minLength: 1, maxLength: 16 }),
      followGraphGen, seenGen, seedGen, nowGen,
      (candidateSet, injections, followGraph, seenState, seed, now) => {
        const polluted = pollute(candidateSet, injections);

        const clean = ss.ssRankFeed({ candidateSet, followGraph, seenState, seed, now });
        const dirty = ss.ssRankFeed({ candidateSet: polluted, followGraph, seenState, seed, now });

        assert(Array.isArray(clean), `clean Ranked_List must be an array, got ${show(clean)}`);
        assert(Array.isArray(dirty), `polluted Ranked_List must be an array, got ${show(dirty)}`);

        // The injected private fields must be completely inert: identical order,
        // identical ids, identical length.
        assert(deepEqualIds(clean, dirty),
          `private fields changed the Ranked_List — clean ${show(clean)} ` +
          `!= polluted ${show(dirty)}`);
        return true;
      }
    ), { numRuns: ITER });
  });
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
