/* ═══════════════════════════════════════════════════════════════
   tests/prop-feed-rank-totality.test.js — Node property test for the
   feed-follows pure ranker `ssRankFeed(input)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-feed-rank-totality.test.js
   (auto-discovered by `node tests/run-all.js`).

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The ranker under test is PURE.

   TDD NOTE (red-first): `ssRankFeed` does NOT exist yet — it lands in task 2.
   This file is EXPECTED to be RED until then. The missing function is reported
   as a clean assertion failure (not a crash), so the red result is meaningful.

   PROPERTY 12 — Totality (never throws on malformed input).
   For ANY input whatsoever — including null/undefined/non-array candidateSet,
   entries that are null or missing id/creator_id/created_at, non-numeric counts,
   malformed/missing followGraph, malformed/missing seenState, non-numeric seed or
   now, and even a missing/weird whole input argument — `ssRankFeed` returns a
   WELL-FORMED array of unique eligible ids WITHOUT throwing, excluding every
   malformed entry. This asserts ONLY totality + well-formedness (no-throw, array,
   non-empty string ids, no duplicates); WHICH ids appear is left to other
   properties.
═══════════════════════════════════════════════════════════════ */
// Feature: feed-follows, Property 12: Totality (never throws on malformed input)
// **Validates: Requirements 8.3, 8.4, 8.5**
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

console.log('Feature: feed-follows — Property 12: totality (never throws on malformed input)\n');

/* ── Well-formedness check on a Ranked_List, regardless of WHICH ids it holds.
   The result MUST be an array of unique, non-empty-string ids (Req 8.5: malformed
   entries excluded ⇒ only valid string ids survive; Property 1's no-dup contract
   re-asserted here as part of well-formedness). Throwing anywhere is a totality
   violation (Req 8.3, 8.4, 8.5). */
function assertWellFormed(out, label) {
  assert(Array.isArray(out), `${label}: Ranked_List must be an array, got ${show(out)}`);
  const seen = new Set();
  for (const id of out) {
    assert(typeof id === 'string' && id.length > 0,
      `${label}: Ranked_List element must be a non-empty string, got ${show(id)}`);
    seen.add(id);
  }
  assert(seen.size === out.length,
    `${label}: Ranked_List contains duplicate ids (size ${seen.size} != length ${out.length})`);
}

// Wrap the call so an exception becomes a clean, descriptive assertion failure
// rather than crashing the run (the whole point of a totality property).
function callNoThrow(input, label) {
  let out;
  try {
    out = ss.ssRankFeed(input);
  } catch (e) {
    assert(false, `${label}: ssRankFeed threw on malformed input — ${e && e.message}`);
  }
  assertWellFormed(out, label);
}

/* ── Generators: the most permissive junk fast-check can produce ──
   fc.anything() for every argument so truly arbitrary values are fed in. */

// A plausible-ISH entry record, deliberately allowing junk in every field so the
// entry-level malformed path (Req 8.5) is exercised, not just top-level non-arrays.
const junkEntryGen = fc.oneof(
  fc.anything(),                                   // null / number / string / object / array …
  fc.record({                                      // shape-like but with arbitrary field values
    id: fc.anything(),
    creator_id: fc.anything(),
    created_at: fc.anything(),
    fires_count: fc.anything(),
    views_count: fc.anything(),
    status: fc.anything(),
    deleted_at: fc.anything(),
  }, { requiredKeys: [] }),                         // any subset of keys may be missing
  fc.record({                                      // occasionally a well-formed-looking eligible entry
    id: fc.hexaString({ minLength: 1, maxLength: 8 }),
    creator_id: fc.constantFrom('cr1', 'cr2', 'cr3'),
    created_at: fc.integer({ min: 1, max: 2000000000000 }),
    fires_count: fc.nat({ max: 1000 }),
    views_count: fc.nat({ max: 1000 }),
    status: fc.constant('live'),
    deleted_at: fc.constant(null),
  })
);

// candidateSet generators: pure junk, arrays of pure junk, and arrays mixing
// valid-ish entries with junk (Req 8.5 entry-level path).
const candidateSetGen = fc.oneof(
  fc.anything(),                                   // null / undefined-ish / non-array junk
  fc.array(fc.anything(), { maxLength: 20 }),      // array of arbitrary junk
  fc.array(junkEntryGen, { maxLength: 40 })        // array mixing valid-ish records with junk
);

const followGraphGen = fc.anything();              // malformed/missing follow graph (Req 8.3)
const seenStateGen = fc.anything();                // malformed/missing seen-state (Req 8.4)
const seedGen = fc.anything();                     // non-numeric / arbitrary seed
const nowGen = fc.anything();                      // non-numeric / arbitrary now

/* ── The property ── */
if (typeof ss.ssRankFeed !== 'function') {
  // Red-first: ssRankFeed lands in task 2. Report a clean assertion failure.
  failed++;
  console.log('  \u2717 Property 12: Totality (never throws on malformed input)' +
    '\n      ssRankFeed is not implemented yet (expected RED until task 2)');
} else {
  // (a) Arbitrary junk across every argument never throws and yields a
  //     well-formed Ranked_List (Req 8.3, 8.4, 8.5).
  prop('Property 12: Totality (never throws on malformed input)', () => {
    fc.assert(fc.property(
      candidateSetGen, followGraphGen, seenStateGen, seedGen, nowGen,
      (candidateSet, followGraph, seenState, seed, now) => {
        callNoThrow({ candidateSet, followGraph, seenState, seed, now },
          `input=${show({ cs: candidateSet, fg: followGraph, ss: seenState, seed, now })}`);
        return true;
      }
    ), { numRuns: ITER });
  });

  // (b) The whole input argument itself is weird — missing / null / non-object /
  //     primitive. The design says ssRankFeed normalises defensively; a missing or
  //     non-object input still returns [] without throwing (Req 8.3–8.5).
  prop('Property 12: weird whole-input argument still returns an array (no throw)', () => {
    const weirdInputs = [
      undefined, null, {}, 42, 'oops', true, false, [], NaN,
      { candidateSet: null }, { candidateSet: undefined }, { candidateSet: 7 },
    ];
    for (const input of weirdInputs) {
      callNoThrow(input, `whole-input=${show(input)}`);
    }
    // ...and a fuzzed sweep of arbitrary whole-input values for good measure.
    fc.assert(fc.property(fc.anything(), (input) => {
      callNoThrow(input, `whole-input=${show(input)}`);
      return true;
    }), { numRuns: ITER });
  });
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
