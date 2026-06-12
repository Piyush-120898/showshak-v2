/* ═══════════════════════════════════════════════════════════════
   tests/prop-trim-validate.test.js — Node property test for the
   curator-upload-v2 trim-validation pure helper `ssValidateTrim(in,out,src)`
   (and its companion `ssTrimDuration(in,out)`) in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-trim-validate.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helpers under test are PURE
   (numbers in, plain object out), so the stub never affects behaviour.

   KEY FACTS confirmed from showshak-shared.js:
   - SS_DURATION_CAP = 90 is EXPORTED; we require and use it (no hardcoded 90).
   - ssValidateTrim -> { ok, reason, durationSec }.
       ok === isFinite(in) && isFinite(out) && (out > in) && (out - in) <= CAP.
       srcDur is accepted but does NOT gate ok.
   - ssTrimDuration(in,out) === Math.max(0, out - in) for finite inputs, 0 otherwise.
   - durationSec in the result always equals ssTrimDuration(in,out).
   - reason: '' when ok; 'non_finite' when in/out not finite; 'out_not_after_in'
     when out <= in; 'over_cap' when (out - in) > CAP.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

const CAP = ss.SS_DURATION_CAP;                 // 90 (exported constant — never hardcode)

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: curator-upload-v2 — trim validation property test\n');

// Feature: curator-upload-v2, Property 2
// Property 2: Trim validation requires Out > In and a segment within the cap.
// For any numbers inSec, outSec, srcDur, ssValidateTrim(inSec, outSec, srcDur)
// reports ok IFF (outSec > inSec) AND ((outSec - inSec) <= 90); and when ok, its
// reported durationSec equals ssTrimDuration(inSec, outSec) = outSec - inSec >= 0.
// The function is NaN/Infinity-safe (never throws, never reports ok on non-finite input).
// **Validates: Requirements 7.2, 7.3, 7.4**
try {
  // Independent recomputation of the spec's ok-gate (does NOT depend on srcDur).
  function expectedOk(inSec, outSec) {
    const a = Number(inSec);
    const b = Number(outSec);
    return isFinite(a) && isFinite(b) && (b > a) && (b - a) <= CAP;
  }

  const DOCUMENTED_REASONS = ['', 'non_finite', 'out_not_after_in', 'over_cap'];

  /* A number generator that biases toward the interesting trim edges:
     - the zero-length / backwards case (out <= in, including out === in)
     - exactly-CAP segments (segment === 90) and just-over (90.0001, 91)
     - normal valid segments (0 < segment < 90)
     - non-finite values: NaN, +Infinity, -Infinity
     Plain finite doubles (incl. negatives and large) round out the space. */
  const finiteNum = fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true });
  const nonFinite = fc.constantFrom(NaN, Infinity, -Infinity);
  const edgeNum = fc.constantFrom(
    0, 1, 10, 45, 89, 90, 91, 90.0001, 100, 179.9999, 180, -1, -90, 0.0001
  );
  // Mixture: mostly finite/edge numbers, with a meaningful slice of non-finite ones
  // so we PROVE the helper is non-finite-safe for in AND/OR out.
  const numGen = fc.oneof(
    { weight: 5, arbitrary: finiteNum },
    { weight: 4, arbitrary: edgeNum },
    { weight: 2, arbitrary: nonFinite }
  );
  // srcDur is included as an arbitrary value (finite OR non-finite) to PROVE it
  // never affects ok / reason / durationSec.
  const srcGen = fc.oneof(
    { weight: 6, arbitrary: finiteNum },
    { weight: 2, arbitrary: edgeNum },
    { weight: 2, arbitrary: nonFinite }
  );

  fc.assert(fc.property(numGen, numGen, srcGen, (inSec, outSec, srcDur) => {
    // 1) Never throws (calling it inside the property already proves this).
    const r = ss.ssValidateTrim(inSec, outSec, srcDur);
    const dur = ss.ssTrimDuration(inSec, outSec);

    // 2) durationSec always equals ssTrimDuration(in,out), is finite and >= 0.
    assert(Object.is(r.durationSec, dur),
      `durationSec ${r.durationSec} != ssTrimDuration ${dur}`);
    assert(isFinite(r.durationSec) && r.durationSec >= 0,
      `durationSec must be finite and >= 0, got ${r.durationSec}`);

    // 3) ok matches the independently-computed gate (srcDur excluded).
    const eok = expectedOk(inSec, outSec);
    assert(r.ok === eok,
      `ok ${r.ok} != expected ${eok} for in=${inSec}, out=${outSec}`);

    // 4) Never reports ok on non-finite input.
    if (!isFinite(Number(inSec)) || !isFinite(Number(outSec))) {
      assert(r.ok === false, `ok must be false on non-finite input (in=${inSec}, out=${outSec})`);
      // durationSec is 0 for non-finite in/out.
      assert(r.durationSec === 0, `durationSec must be 0 on non-finite input, got ${r.durationSec}`);
    }

    // 5) When ok, durationSec === out - in (>= 0) — same subtraction the helper uses.
    if (r.ok) {
      assert(r.durationSec === (Number(outSec) - Number(inSec)),
        `ok durationSec ${r.durationSec} != out-in ${Number(outSec) - Number(inSec)}`);
      assert(r.durationSec >= 0, 'ok durationSec must be >= 0');
    }

    // 6) reason is one of the documented codes and is consistent with ok.
    assert(DOCUMENTED_REASONS.indexOf(r.reason) !== -1, `undocumented reason ${JSON.stringify(r.reason)}`);
    if (r.ok) {
      assert(r.reason === '', `ok must carry empty reason, got ${JSON.stringify(r.reason)}`);
    } else {
      const a = Number(inSec), b = Number(outSec);
      if (!isFinite(a) || !isFinite(b)) {
        assert(r.reason === 'non_finite', `expected non_finite, got ${r.reason}`);
      } else if (!(b > a)) {
        assert(r.reason === 'out_not_after_in', `expected out_not_after_in, got ${r.reason}`);
      } else {
        assert(r.reason === 'over_cap', `expected over_cap, got ${r.reason}`);
      }
    }

    // 7) srcDur must NOT influence the result: re-run with a different srcDur and
    //    assert ok / reason / durationSec are identical.
    const r2 = ss.ssValidateTrim(inSec, outSec, srcDur === 0 ? 12345 : 0);
    assert(r2.ok === r.ok && r2.reason === r.reason && Object.is(r2.durationSec, r.durationSec),
      'srcDur must not affect ok / reason / durationSec');

    return true;
  }), { numRuns: ITER });

  // ── Explicit edge cases called out in the design ──────────────────────────
  // out <= in (backwards) and the zero-length case (out === in) → ok false.
  assert(ss.ssValidateTrim(10, 5, 100).ok === false &&
         ss.ssValidateTrim(10, 5, 100).reason === 'out_not_after_in', 'backwards selection must be out_not_after_in');
  assert(ss.ssValidateTrim(7, 7, 100).ok === false &&
         ss.ssValidateTrim(7, 7, 100).reason === 'out_not_after_in', 'zero-length selection must be out_not_after_in');
  assert(ss.ssValidateTrim(7, 7, 100).durationSec === 0, 'zero-length durationSec must be 0');

  // Exactly-CAP segment → ok true (at zero offset and a non-zero offset).
  assert(ss.ssValidateTrim(0, CAP, 1000).ok === true, 'exactly-90 at offset 0 must be ok');
  assert(ss.ssValidateTrim(0, CAP, 1000).durationSec === CAP, 'exactly-90 durationSec must equal cap');
  assert(ss.ssValidateTrim(10, 10 + CAP, 1000).ok === true, 'exactly-90 at offset 10 must be ok');
  assert(ss.ssValidateTrim(10, 10 + CAP, 1000).durationSec === CAP, 'offset-90 durationSec must equal cap');

  // Just over the cap → ok false, reason over_cap.
  assert(ss.ssValidateTrim(0, CAP + 0.0001, 1000).ok === false &&
         ss.ssValidateTrim(0, CAP + 0.0001, 1000).reason === 'over_cap', '90.0001s segment must be over_cap');
  assert(ss.ssValidateTrim(0, CAP + 1, 1000).ok === false &&
         ss.ssValidateTrim(0, CAP + 1, 1000).reason === 'over_cap', '91s segment must be over_cap');

  // Normal valid segment (0 < segment < 90) → ok true, durationSec === out-in.
  assert(ss.ssValidateTrim(5, 20, 1000).ok === true &&
         ss.ssValidateTrim(5, 20, 1000).durationSec === 15, 'normal 15s segment must be ok with durationSec 15');

  // Non-finite inputs → ok false, no throw, durationSec === 0.
  [NaN, Infinity, -Infinity].forEach((bad) => {
    assert(ss.ssValidateTrim(bad, 10, 100).ok === false && ss.ssValidateTrim(bad, 10, 100).durationSec === 0,
      `non-finite in (${bad}) must be ok=false, durationSec=0`);
    assert(ss.ssValidateTrim(0, bad, 100).ok === false && ss.ssValidateTrim(0, bad, 100).durationSec === 0,
      `non-finite out (${bad}) must be ok=false, durationSec=0`);
    assert(ss.ssValidateTrim(bad, bad, 100).reason === 'non_finite', `non-finite in+out (${bad}) must be non_finite`);
  });
  // A non-finite srcDur must NOT change a valid in/out result.
  assert(ss.ssValidateTrim(0, 10, NaN).ok === true, 'non-finite srcDur must not block a valid segment');
  assert(ss.ssValidateTrim(0, 10, Infinity).ok === true, 'infinite srcDur must not block a valid segment');

  console.log('  \u2713 Property 2');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 2\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
