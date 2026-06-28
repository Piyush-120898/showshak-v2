/* ═══════════════════════════════════════════════════════════════
   tests/prop-poster-clamp.test.js — Node property test for the
   prefetch-cache-pipeline poster-prewarm pure helper
   `ssPosterPrewarmList(pageData, count)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-poster-clamp.test.js

   TDD (red): this test encodes the TARGET behaviour of Property 2 and is
   EXPECTED to fail/error until `ssPosterPrewarmList` lands (task 2.3). The
   helper is PURE (takes an array + a number, returns a string[]), so the
   shared DOM/window stub (tests/_pbt.js) — installed BEFORE requiring
   showshak-shared.js — never affects behaviour; it only lets the module load.

   CONTRACT under test (design.md → Property 2, Data Models: `posterUrl`):
   ssPosterPrewarmList scans pageData IN ORDER, collecting the poster URL of
   every entry that HAS one (a non-empty string `posterUrl`), skipping entries
   with no poster URL, and returns the FIRST `count` of those collected URLs.
   Therefore the result length equals min(count, number-of-entries-with-a-
   poster); it never exceeds `count`, never pads beyond the posters that exist,
   and every returned element is a real poster URL drawn in order from pageData.
   Non-array input or non-finite `count` yields `[]`.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

/* An entry "has a poster URL" iff it is a non-null object whose `posterUrl`
   is a non-empty string. This is the single rule the helper uses to decide
   which entries contribute a poster (and which are skipped). */
function hasPoster(e) {
  return !!e && typeof e === 'object' && typeof e.posterUrl === 'string' && e.posterUrl.length > 0;
}

/* Reference oracle: the exact list the contract requires. */
function expected(pageData, count) {
  if (!Array.isArray(pageData)) return [];
  if (typeof count !== 'number' || !Number.isFinite(count)) return [];
  const all = [];
  for (const e of pageData) if (hasPoster(e)) all.push(e.posterUrl);
  const n = Math.max(0, Math.floor(count));
  return all.slice(0, n);
}

function deepEqStrArr(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

let failed = 0;

console.log('Feature: prefetch-cache-pipeline — poster prewarm clamp property test\n');

/* ── generators ───────────────────────────────────────────────── */

// Always-non-empty poster URLs (mux-thumbnail-shaped + arbitrary non-empty).
const posterUrlGen = fc.oneof(
  fc.webUrl(),
  fc.string({ minLength: 1, maxLength: 40 })
    .map((s) => 'https://image.mux.com/' + encodeURIComponent(s) + '/thumbnail.jpg'),
  fc.constantFrom(
    'https://image.mux.com/abc123/thumbnail.jpg?time=1',
    'https://image.mux.com/def456/thumbnail.webp'
  )
);

const clipWithPoster = fc.record({
  id: fc.string(), caption: fc.string(), posterUrl: posterUrlGen,
});

// Entries that DO NOT have a poster URL → must be skipped.
const clipNoPoster = fc.oneof(
  fc.record({ id: fc.string(), caption: fc.string() }),               // field absent
  fc.record({ id: fc.string(), posterUrl: fc.constant('') }),         // empty string
  fc.record({ id: fc.string(), posterUrl: fc.constantFrom(null, undefined, 0, 42, false, [], {}) })
);

// Non-object junk interspersed in the list (also "no poster" → skipped, totality).
const junkEntry = fc.constantFrom(null, undefined, 0, 1, -1, 'x', '', true, false, NaN, []);

// Weight toward clips-with-posters so most arrays have several posters, but mix
// in missing-poster + junk entries so skipping is always exercised.
const entryGen = fc.oneof(
  { weight: 5, arbitrary: clipWithPoster },
  { weight: 2, arbitrary: clipNoPoster },
  { weight: 1, arbitrary: junkEntry }
);

const pageDataGen = fc.array(entryGen, { maxLength: 40 });

// Finite counts that straddle the array length on BOTH sides (fewer/more clips
// than count) plus the SS_PREWARM_POSTER_COUNT window [12,15], zero, and
// negatives/fractionals (clamped to a 0-floored integer by the contract).
const finiteCountGen = fc.oneof(
  fc.constantFrom(0, 1, 2, 5, 12, 13, 14, 15, 30),
  fc.integer({ min: 0, max: 60 }),
  fc.integer({ min: -5, max: 60 }),
  fc.double({ min: 0, max: 30, noNaN: true }) // fractional finite counts
);

/* ── Property 2 (main) ────────────────────────────────────────── */
// Feature: prefetch-cache-pipeline, Property 2: Poster prewarm list clamps to count and to available posters
// **Validates: Requirements 2.1, 2.4, 2.6**
try {
  fc.assert(fc.property(pageDataGen, finiteCountGen, (pageData, count) => {
    const out = ss.ssPosterPrewarmList(pageData, count);

    // Always an array.
    assert(Array.isArray(out), 'result must be an array');

    const posters = pageData.filter(hasPoster).map((e) => e.posterUrl);
    const nWithPoster = posters.length;
    const want = Math.max(0, Math.floor(count));
    const expectedLen = Math.min(want, nWithPoster);

    // (R2.4 / R2.6) length === min(count, #entries-with-a-poster):
    // never exceeds count, never pads beyond the posters that exist.
    assert(out.length === expectedLen,
      `length ${out.length} != min(count=${count}, withPoster=${nWithPoster})=${expectedLen}`);

    // never exceeds count (explicit, R2.6).
    assert(out.length <= want, `length ${out.length} exceeds count ${want}`);

    // every element is a real (non-empty string) poster URL (R2.1).
    for (const u of out) {
      assert(typeof u === 'string' && u.length > 0, `non-poster element returned: ${JSON.stringify(u)}`);
    }

    // every returned element is drawn IN ORDER from the page's posters.
    assert(deepEqStrArr(out, expected(pageData, count)),
      `result not the in-order first-${expectedLen} posters: ${JSON.stringify(out)} vs ${JSON.stringify(expected(pageData, count))}`);

    return true;
  }), { numRuns: ITER });

  console.log('  \u2713 Property 2 (clamp to count & available posters)');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 2 (clamp to count & available posters)\n      ' + e.message);
}

/* ── Property 2 (non-array input → []) ────────────────────────── */
// **Validates: Requirements 2.1, 2.4, 2.6**
try {
  const nonArray = fc.oneof(
    fc.constantFrom(null, undefined, 0, 1, NaN, true, false, '', 'posters'),
    fc.object(),
    fc.string()
  );
  fc.assert(fc.property(nonArray, finiteCountGen, (pageData, count) => {
    const out = ss.ssPosterPrewarmList(pageData, count);
    assert(Array.isArray(out) && out.length === 0, `non-array pageData must yield []: got ${JSON.stringify(out)}`);
    return true;
  }), { numRuns: ITER });

  console.log('  \u2713 Property 2 (non-array input \u2192 [])');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 2 (non-array input \u2192 [])\n      ' + e.message);
}

/* ── Property 2 (non-finite / non-number count → []) ──────────── */
// **Validates: Requirements 2.1, 2.4, 2.6**
try {
  const badCount = fc.constantFrom(NaN, Infinity, -Infinity, null, undefined, '5', '', true, false, {}, []);
  fc.assert(fc.property(pageDataGen, badCount, (pageData, count) => {
    const out = ss.ssPosterPrewarmList(pageData, count);
    assert(Array.isArray(out) && out.length === 0,
      `non-finite count must yield []: count=${String(count)} got ${JSON.stringify(out)}`);
    return true;
  }), { numRuns: ITER });

  console.log('  \u2713 Property 2 (non-finite count \u2192 [])');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 2 (non-finite count \u2192 [])\n      ' + e.message);
}

/* ── Explicit boundary cases called out by the property text ──── */
try {
  const A = { id: 'a', posterUrl: 'https://image.mux.com/a/thumbnail.jpg' };
  const B = { id: 'b', posterUrl: 'https://image.mux.com/b/thumbnail.jpg' };
  const C = { id: 'c', posterUrl: 'https://image.mux.com/c/thumbnail.jpg' };
  const NOPOSTER = { id: 'n', caption: 'no poster' };

  // fewer posters than count → clamp to what exists (R2.4).
  assert(deepEqStrArr(ss.ssPosterPrewarmList([A, B], 10), [A.posterUrl, B.posterUrl]),
    'fewer posters than count must return all existing posters in order');

  // more posters than count → at most count (R2.6).
  assert(deepEqStrArr(ss.ssPosterPrewarmList([A, B, C], 2), [A.posterUrl, B.posterUrl]),
    'more posters than count must return exactly the first count posters');

  // missing-poster entries are skipped, order preserved (R2.1).
  assert(deepEqStrArr(ss.ssPosterPrewarmList([NOPOSTER, A, NOPOSTER, B], 5), [A.posterUrl, B.posterUrl]),
    'entries with no poster URL must be skipped');

  // count 0 → empty.
  assert(deepEqStrArr(ss.ssPosterPrewarmList([A, B], 0), []), 'count 0 must return []');

  // empty array → empty.
  assert(deepEqStrArr(ss.ssPosterPrewarmList([], 12), []), 'empty pageData must return []');

  // non-array / non-finite count → [].
  assert(deepEqStrArr(ss.ssPosterPrewarmList(null, 12), []), 'null pageData must return []');
  assert(deepEqStrArr(ss.ssPosterPrewarmList([A, B], NaN), []), 'NaN count must return []');
  assert(deepEqStrArr(ss.ssPosterPrewarmList([A, B], Infinity), []), 'Infinity count must return []');

  console.log('  \u2713 Property 2 (explicit boundary cases)');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 2 (explicit boundary cases)\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} check(s)` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
