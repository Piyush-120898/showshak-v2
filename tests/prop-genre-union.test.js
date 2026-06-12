/* ═══════════════════════════════════════════════════════════════
   tests/prop-genre-union.test.js — Node property test for the
   curator-upload-v2 genre-union pure helper `ssGenreUnion(titlesGenreLists)`
   in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-genre-union.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (takes an array of arrays, returns a plain array), so the stub never affects
   behaviour — it only lets the module load and populate module.exports.

   IMPORTANT — the helper's EXACT semantics (mirrored by this test's oracle):
     - input is an array of arrays of strings; outer null/undefined/non-array → [].
     - inner lists that are empty/null/undefined/non-array contribute nothing.
     - each entry: skip non-strings (no coercion of numbers/booleans/objects),
       TRIM strings, DROP names that trim to '' (blank/whitespace-only).
     - DE-DUP KEY is the TRIMMED string, CASE-SENSITIVE ("Drama" != "drama").
     - first-seen casing/order preserved; pure, never throws; idempotent.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
// JSON.stringify is sufficient for arrays of strings.
function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/* Independent oracle: compute the expected union using the SAME rules as the
   helper, so the property test asserts correctness rather than re-running the
   implementation. */
function expectedUnion(lists) {
  const out = [];
  const seen = Object.create(null);
  if (!Array.isArray(lists)) return out;
  for (let i = 0; i < lists.length; i++) {
    const list = lists[i];
    if (!Array.isArray(list)) continue;
    for (let j = 0; j < list.length; j++) {
      const name = list[j];
      if (typeof name !== 'string') continue;
      const trimmed = name.trim();
      if (trimmed === '') continue;
      if (seen[trimmed]) continue;
      seen[trimmed] = true;
      out.push(trimmed);
    }
  }
  return out;
}

let failed = 0;

console.log('Feature: curator-upload-v2 — genre union property test\n');

// Feature: curator-upload-v2, Property 5
// Property 5: Genre derivation is the de-duplicated, order-stable, empty-safe union.
// For any list of per-title genre name lists (including empty or missing lists),
// ssGenreUnion(lists) contains each distinct genre name exactly once, preserves
// first-seen order, contributes nothing for titles with no genres (never throws),
// and is idempotent (ssGenreUnion([u]) = u for an already-unioned u).
// **Validates: Requirements 3.1, 3.2, 3.3, 10.4**
try {
  // Genre-name pool exercises case-sensitivity ("Drama" vs "drama") and dups,
  // plus a value that needs trimming.
  const validName = fc.constantFrom(
    'Drama', 'Crime', 'Thriller', 'Comedy', 'Sci-Fi', 'drama', '  Drama  '
  );
  // Blank/whitespace-only strings → contribute nothing.
  const blankName = fc.constantFrom('', '   ', '\t', '\n', ' \t \n ');
  // Non-string junk → skipped entirely (never coerced).
  const junk = fc.constantFrom(null, undefined, 5, 0, true, false, {}, [], NaN);

  const entry = fc.oneof(
    { weight: 6, arbitrary: validName },
    { weight: 2, arbitrary: blankName },
    { weight: 2, arbitrary: junk }
  );

  // An inner list is usually an array of entries, occasionally null/undefined or
  // a non-array (to exercise "missing genres" titles), occasionally empty.
  const innerList = fc.oneof(
    { weight: 7, arbitrary: fc.array(entry, { maxLength: 6 }) },
    { weight: 2, arbitrary: fc.constantFrom(null, undefined) },
    { weight: 1, arbitrary: fc.constantFrom(42, 'not-an-array', {}) }
  );

  // The outer argument is usually an array of inner lists, occasionally a bad value.
  const listsGen = fc.oneof(
    { weight: 8, arbitrary: fc.array(innerList, { maxLength: 8 }) },
    { weight: 1, arbitrary: fc.constantFrom(null, undefined, 42, 'x', {}) }
  );

  fc.assert(fc.property(listsGen, (lists) => {
    const result = ss.ssGenreUnion(lists);
    const expected = expectedUnion(lists);

    // Core: result deep-equals the independently-computed union (same values, SAME order).
    assert(deepEqual(result, expected),
      `union mismatch: got ${JSON.stringify(result)} expected ${JSON.stringify(expected)} for ${JSON.stringify(lists)}`);

    // (a) no duplicates — exact-string comparison.
    assert(new Set(result).size === result.length,
      `duplicates present in ${JSON.stringify(result)}`);

    // (c) every result entry is a non-empty trimmed string.
    for (const g of result) {
      assert(typeof g === 'string', `non-string in result: ${JSON.stringify(g)}`);
      assert(g.length > 0, 'empty string in result');
      assert(g === g.trim(), `untrimmed value in result: ${JSON.stringify(g)}`);
    }

    // (b) order-stable — result is a subsequence in first-seen order. The oracle
    // already enforces this; double-check result equals its own re-union (stable).
    assert(deepEqual(ss.ssGenreUnion([result]), result), 'result not order-stable / re-union differs');

    // (d) idempotency — re-unioning an already-unioned array yields itself, and
    // wrapping each item in its own list also yields the same result.
    assert(deepEqual(ss.ssGenreUnion([result]), result), 'not idempotent for [result]');
    assert(deepEqual(ss.ssGenreUnion(result.map((x) => [x])), result),
      'not idempotent for per-item wrapped result');

    return true;
  }), { numRuns: ITER });

  // (f) never throws — already covered by the property running without throwing,
  // but assert explicitly on the awkward inputs too.
  ss.ssGenreUnion(null); ss.ssGenreUnion(undefined); ss.ssGenreUnion(42);
  ss.ssGenreUnion([[null, undefined, {}, 5]]);

  // (e) empty-safe.
  assert(deepEqual(ss.ssGenreUnion([]), []), 'ssGenreUnion([]) must be []');
  assert(deepEqual(ss.ssGenreUnion([[], [], null]), []), 'ssGenreUnion([[],[],null]) must be []');
  assert(deepEqual(ss.ssGenreUnion(null), []), 'ssGenreUnion(null) must be []');
  assert(deepEqual(ss.ssGenreUnion(undefined), []), 'ssGenreUnion(undefined) must be []');
  assert(deepEqual(ss.ssGenreUnion(42), []), 'ssGenreUnion(42) must be []');

  // Explicit literal cases from the design.
  assert(deepEqual(
    ss.ssGenreUnion([['Drama', 'Crime'], ['Crime', 'Thriller'], []]),
    ['Drama', 'Crime', 'Thriller']
  ), 'dedup across lists, order-stable failed');
  assert(deepEqual(
    ss.ssGenreUnion([['  Drama  '], ['drama']]),
    ['Drama', 'drama']
  ), 'trim + case-sensitive distinct failed');
  assert(deepEqual(
    ss.ssGenreUnion([['a'], null, undefined, ['a']]),
    ['a']
  ), 'missing inner lists + dedup failed');
  assert(deepEqual(
    ss.ssGenreUnion([[5, true, {}, 'X', '']]),
    ['X']
  ), 'non-string skip + blank drop failed');

  console.log('  \u2713 Property 5');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 5\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
