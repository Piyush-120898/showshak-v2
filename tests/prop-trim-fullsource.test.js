/* ═══════════════════════════════════════════════════════════════
   tests/prop-trim-fullsource.test.js — Node property test for the
   curator-upload-v2 full-source detector `ssIsFullSourceTrim(in,out,src)`
   in showshak-shared.js. Plain Node (no framework) + fast-check; run with:
     node tests/prop-trim-fullsource.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (numbers in, boolean out), so the stub never affects behaviour.

   KEY FACTS confirmed from showshak-shared.js:
   - ssIsFullSourceTrim(inSec, outSec, srcDur) coerces via Number(),
     returns false if Number(srcDur) is non-finite, else returns
     (in === 0 && out === srcDur) with EXACT equality (no epsilon).
   - Pure, never throws, always returns a strict boolean.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: curator-upload-v2 — full-source detection property test\n');

// Feature: curator-upload-v2, Property 3
// Property 3: Untrimmed selection is detected as the full source.
// For any inSec, outSec, srcDur, ssIsFullSourceTrim(inSec, outSec, srcDur) is true
// IFF inSec === 0 AND outSec === srcDur; whenever it is true the published segment
// equals the whole source, still subject to the same 90s cap as a trimmed segment.
// **Validates: Requirements 7.6**
try {
  // Independent recomputation of the spec's full-source predicate. Uses the same
  // Number() coercion and EXACT equality the helper documents (no epsilon).
  function expected(inSec, outSec, srcDur) {
    const a = Number(inSec);
    const b = Number(outSec);
    const s = Number(srcDur);
    return Number.isFinite(s) && a === 0 && b === s;
  }

  const finiteNum = fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true });
  const nonFinite = fc.constantFrom(NaN, Infinity, -Infinity);

  /* A triple generator that biases toward the interesting full-source edges so the
     TRUE branch is hit frequently (we do NOT rely on random chance to ever make
     in === 0 && out === srcDur):
       - exact full-source triples { in: 0, out: s, src: s } for a finite s
       - near-misses that PROVE exact equality: out off by a tiny epsilon, or
         in off by a tiny epsilon (both must be false)
       - full-source shape but with a NON-FINITE src (must be false)
       - arbitrary independent triples (finite or non-finite) to cover the space */
  const tripleGen = fc.oneof(
    // Exact full source → TRUE (s finite, in=0, out=s).
    { weight: 5, arbitrary: finiteNum.map((s) => ({ inSec: 0, outSec: s, srcDur: s })) },
    // out off by a tiny epsilon → FALSE (proves no epsilon tolerance).
    { weight: 3, arbitrary: finiteNum.map((s) => ({ inSec: 0, outSec: s + 0.0001, srcDur: s })) },
    // in off by a tiny epsilon → FALSE.
    { weight: 3, arbitrary: finiteNum.map((s) => ({ inSec: 0.0001, outSec: s, srcDur: s })) },
    // Full-source shape but non-finite src → FALSE even though in=0 && out matches.
    { weight: 2, arbitrary: nonFinite.map((s) => ({ inSec: 0, outSec: s, srcDur: s })) },
    // Fully arbitrary triples (each component finite OR non-finite).
    { weight: 4, arbitrary: fc.record({
        inSec: fc.oneof(finiteNum, nonFinite),
        outSec: fc.oneof(finiteNum, nonFinite),
        srcDur: fc.oneof(finiteNum, nonFinite),
      }) }
  );

  fc.assert(fc.property(tripleGen, ({ inSec, outSec, srcDur }) => {
    // 1) Never throws (calling it inside the property already proves this).
    const r = ss.ssIsFullSourceTrim(inSec, outSec, srcDur);

    // 2) Always a strict boolean.
    assert(typeof r === 'boolean',
      `result must be a strict boolean, got ${typeof r} (${String(r)})`);

    // 3) Matches the independently-computed predicate for every triple.
    const e = expected(inSec, outSec, srcDur);
    assert(r === e,
      `ssIsFullSourceTrim(${inSec}, ${outSec}, ${srcDur}) = ${r} != expected ${e}`);

    // 4) Whenever true, it really is the full source: in coerces to 0, out === src,
    //    and src is finite.
    if (r) {
      assert(Number(inSec) === 0, `true case must have in === 0, got ${inSec}`);
      assert(Number(outSec) === Number(srcDur), `true case must have out === src`);
      assert(Number.isFinite(Number(srcDur)), `true case must have finite src, got ${srcDur}`);
    }

    return true;
  }), { numRuns: ITER });

  // ── Explicit literal cases called out in the design ───────────────────────
  assert(ss.ssIsFullSourceTrim(0, 120, 120) === true, '0/120/120 must be full source (true)');
  assert(ss.ssIsFullSourceTrim(0, 119.999, 120) === false, '0/119.999/120 must be false (exact equality)');
  assert(ss.ssIsFullSourceTrim(0.0001, 120, 120) === false, '0.0001/120/120 must be false (in != 0)');
  assert(ss.ssIsFullSourceTrim(0, Infinity, Infinity) === false, '0/Inf/Inf must be false (non-finite src)');
  assert(ss.ssIsFullSourceTrim(0, NaN, NaN) === false, '0/NaN/NaN must be false (non-finite src)');
  // Zero-length full source of a 0-length src — exact equality says true. This is
  // only the detector; the 90s cap gate is ssValidateTrim's job, not this function.
  assert(ss.ssIsFullSourceTrim(0, 0, 0) === true, '0/0/0 must be true (exact-equality detector)');

  // Extra non-finite proofs: full-source shape but src non-finite is always false.
  assert(ss.ssIsFullSourceTrim(0, -Infinity, -Infinity) === false, '0/-Inf/-Inf must be false');
  // out !== src → false even when in is 0 and src is finite.
  assert(ss.ssIsFullSourceTrim(0, 90, 120) === false, '0/90/120 must be false (out != src)');

  console.log('  \u2713 Property 3');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 3\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
