/* ═══════════════════════════════════════════════════════════════
   tests/prop-page-cache-bound.test.js — Node property test for the
   prefetch-cache-pipeline Page_Data write-path bound `ssPageCacheBound(clips)`
   in showshak-shared.js.

   Plain Node (no framework) + fast-check; run with:
     node tests/prop-page-cache-bound.test.js
   (auto-discovered by `node tests/run-all.js`).

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The boundary under test is PURE
   (an array in, the clamped array out), so the stub never affects behaviour — it
   only lets the module load and populate module.exports.

   TDD NOTE (red-first): `ssPageCacheBound` does NOT exist yet — it lands in
   task 7.2 ("Factor the min(clips.length, SS_PAGE_CACHE_MAX) clamp the page-cache
   write path uses into a pure, total, dual-exported boundary"). This file is
   authored FIRST (task 6.2) and is EXPECTED to be RED until task 7.2 lands the
   helper. The missing function is reported as a clean assertion failure (not a
   crash) — mirroring how tests/prop-scoreboard-safe.test.js guards a
   not-yet-implemented helper — so the red result is meaningful and the rest of
   the suite still runs.

   ── PROPERTY 5 — Page-cache bound (NO cache grows unbounded). ──
   The Page_Data write path retains AT MOST SS_PAGE_CACHE_MAX clips. The contract
   for the pure boundary the write path uses:
     ssPageCacheBound(clips) →
       • returns an array whose length === min(clips.length, SS_PAGE_CACHE_MAX)
       • the kept clips are the order-preserving FIRST-N prefix of `clips`
         (result[i] is the SAME reference as clips[i] for every kept i)
       • a non-array input → [] (total; never throws)
   so no Target_Page cache (localStorage page cache OR the IndexedDB tier) can
   grow without bound.
═══════════════════════════════════════════════════════════════ */
// Feature: prefetch-cache-pipeline, Property 5: Page-cache bound — for any clips
// array, the Page_Data write path retains at most SS_PAGE_CACHE_MAX clips (stored
// length === min(clips.length, SS_PAGE_CACHE_MAX), order-preserving first-N prefix,
// same clip references); non-array input → [].
// **Validates: Requirements 4.6, 12.4**
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function show(v) {
  try {
    if (Array.isArray(v)) return `Array(len=${v.length})`;
    if (v !== null && typeof v === 'object') return JSON.stringify(v);
    return String(v);
  } catch (_) { return Object.prototype.toString.call(v); }
}

let failed = 0;
function prop(name, fn) {
  try { fn(); console.log('  \u2713 ' + name); }
  catch (e) { failed++; console.log('  \u2717 ' + name + '\n      ' + (e && e.message)); }
}

console.log('Feature: prefetch-cache-pipeline — Property 5: Page-cache bound\n');

if (typeof ss.ssPageCacheBound !== 'function') {
  // Red-first: ssPageCacheBound lands in task 7.2. Report a clean assertion
  // failure (not a crash) so the RED result is meaningful and the rest of the
  // suite still runs.
  failed++;
  console.log('  \u2717 Property 5: Page-cache bound' +
    '\n      ssPageCacheBound is not implemented yet (expected RED until task 7.2)');
} else {
  /* ── SS_PAGE_CACHE_MAX must be the single, finite, positive-integer bound. ──── */
  const MAX = ss.SS_PAGE_CACHE_MAX;
  assert(typeof MAX === 'number' && Number.isInteger(MAX) && MAX > 0 && Number.isFinite(MAX),
    `SS_PAGE_CACHE_MAX must be a finite positive integer, got ${show(MAX)}`);

  /* ── Generators ────────────────────────────────────────────────────────────
     A clip is a distinct object reference so we can verify the kept entries are
     the order-preserving FIRST-N prefix BY REFERENCE (===), not just by value. */
  let _seq = 0;
  const clipArb = fc.record({
    id: fc.string(),
    caption: fc.string(),
    posterUrl: fc.webUrl(),
  }).map((c) => { c.__seq = _seq++; return c; });

  // Arrays spanning every boundary region: shorter than MAX, exactly MAX, and
  // longer than MAX (up to ~2x so the over-cap path is well covered).
  const clipsArb = fc.array(clipArb, { minLength: 0, maxLength: MAX * 2 + 5 });

  // Non-array inputs that MUST map to [].
  const nonArrayInput = fc.oneof(
    fc.constant(null),
    fc.constant(undefined),
    fc.integer(),
    fc.double(),
    fc.string(),
    fc.boolean(),
    fc.record({ length: fc.integer() }),  // array-like object, but not an Array
    fc.anything().filter((v) => !Array.isArray(v))
  );

  // Build an array of N distinct clip references (helper for the boundary cases).
  function makeClips(n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push({ id: 'c' + i, caption: 'cap' + i, __seq: i });
    return out;
  }

  /* ── (a) length === min(clips.length, SS_PAGE_CACHE_MAX) ────────────────────── */
  prop('Property 5a: stored length equals min(clips.length, SS_PAGE_CACHE_MAX)', () => {
    fc.assert(fc.property(clipsArb, (clips) => {
      const out = ss.ssPageCacheBound(clips);
      assert(Array.isArray(out), `result must be an array, got ${show(out)}`);
      const expected = Math.min(clips.length, MAX);
      assert(out.length === expected,
        `length ${out.length} != min(${clips.length}, ${MAX}) = ${expected}`);
      // Bound holds unconditionally: never more than the cap.
      assert(out.length <= MAX, `result length ${out.length} exceeds the cap ${MAX}`);
      return true;
    }), { numRuns: ITER });
  });

  /* ── (b) Kept clips are the order-preserving FIRST-N prefix, same references ── */
  prop('Property 5b: kept clips are the order-preserving first-N prefix (same refs)', () => {
    fc.assert(fc.property(clipsArb, (clips) => {
      const out = ss.ssPageCacheBound(clips);
      for (let i = 0; i < out.length; i++) {
        assert(out[i] === clips[i],
          `entry ${i} is not the same reference / not in prefix order ` +
          `(out[${i}]=${show(out[i])}, clips[${i}]=${show(clips[i])})`);
      }
      return true;
    }), { numRuns: ITER });
  });

  /* ── (c) Non-array input → [] (total; never throws) ─────────────────────────── */
  prop('Property 5c: non-array input → [] (total, never throws)', () => {
    fc.assert(fc.property(nonArrayInput, (v) => {
      const out = ss.ssPageCacheBound(v);   // throwing here fails the property
      assert(Array.isArray(out) && out.length === 0,
        `non-array input must yield [], got ${show(out)} for ${show(v)}`);
      return true;
    }), { numRuns: ITER });
    // Explicit literal cases pinning the contract.
    assert(ss.ssPageCacheBound(null).length === 0, 'null → []');
    assert(ss.ssPageCacheBound(undefined).length === 0, 'undefined → []');
    assert(ss.ssPageCacheBound(42).length === 0, 'number → []');
    assert(ss.ssPageCacheBound('xyz').length === 0, 'string → []');
    assert(ss.ssPageCacheBound({ length: 3 }).length === 0, 'array-like object → []');
  });

  /* ── (d) Determinism + purity: no mutation of the input array ───────────────── */
  prop('Property 5d: deterministic and does not mutate the input', () => {
    fc.assert(fc.property(clipsArb, (clips) => {
      const lenBefore = clips.length;
      const a = ss.ssPageCacheBound(clips);
      const b = ss.ssPageCacheBound(clips);
      assert(a.length === b.length, `non-deterministic length: ${a.length} != ${b.length}`);
      for (let i = 0; i < a.length; i++) {
        assert(a[i] === b[i], `non-deterministic entry at ${i}`);
      }
      assert(clips.length === lenBefore, `input array length was mutated (${clips.length} != ${lenBefore})`);
      return true;
    }), { numRuns: ITER });
  });

  /* ── Explicit boundary cases: under / exactly / over the cap. ───────────────── */
  prop('Property 5 (boundaries): empty, under, exactly, and over SS_PAGE_CACHE_MAX', () => {
    // Empty array → kept whole (length 0).
    assert(ss.ssPageCacheBound([]).length === 0, 'empty array → []');

    // Shorter than MAX → kept whole, order preserved.
    const short = makeClips(MAX - 1);
    const outShort = ss.ssPageCacheBound(short);
    assert(outShort.length === MAX - 1, `under-cap kept whole: ${outShort.length} != ${MAX - 1}`);
    assert(outShort[0] === short[0] && outShort[MAX - 2] === short[MAX - 2], 'under-cap prefix order preserved');

    // Exactly MAX → kept whole.
    const exact = makeClips(MAX);
    const outExact = ss.ssPageCacheBound(exact);
    assert(outExact.length === MAX, `exactly-cap kept whole: ${outExact.length} != ${MAX}`);
    assert(outExact[MAX - 1] === exact[MAX - 1], 'exactly-cap last entry preserved');

    // One over MAX → clamped to exactly MAX, first-N prefix.
    const over1 = makeClips(MAX + 1);
    const outOver1 = ss.ssPageCacheBound(over1);
    assert(outOver1.length === MAX, `MAX+1 clamps to ${MAX}, got ${outOver1.length}`);
    assert(outOver1[0] === over1[0] && outOver1[MAX - 1] === over1[MAX - 1],
      'MAX+1 keeps the first-N prefix');

    // Far over MAX → still clamped to exactly MAX.
    const over = makeClips(MAX * 3);
    const outOver = ss.ssPageCacheBound(over);
    assert(outOver.length === MAX, `far-over-cap clamps to ${MAX}, got ${outOver.length}`);
    assert(outOver[MAX - 1] === over[MAX - 1], 'far-over-cap keeps clips[MAX-1] as the last kept ref');
  });
}

console.log('\n' + (failed ? `FAILED: ${failed} propert${failed === 1 ? 'y' : 'ies'}` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
