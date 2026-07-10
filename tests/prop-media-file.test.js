/* ═══════════════════════════════════════════════════════════════
   tests/prop-media-file.test.js — Node property test for the
   curator-upload-v2 media-file validation pure helper
   `ssValidateMediaFile(sizeBytes, durationSec)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-media-file.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (numbers in, plain object out), so the stub never affects behaviour.

   KEY FACTS confirmed from showshak-shared.js:
   - SS_DURATION_CAP = 90 and SS_FILE_SIZE_CAP = 314572800 (300*1024*1024) are
     EXPORTED; we require and use them (never hardcode 90 / the byte value).
   - ssValidateMediaFile(sizeBytes, durationSec) -> { ok, reason }.
   - Inputs coerced via Number(). Non-finite (NaN/±Infinity) OR negative
     size/duration -> ok=false, reason 'invalid'.
   - For valid finite non-negative inputs:
       ok === (durationSec <= 90) && (sizeBytes <= SS_FILE_SIZE_CAP).
   - Reason codes: '' when ok; 'invalid' (non-finite/negative);
     'over_duration' (duration > 90, checked FIRST);
     'over_size' (size > cap, only when duration is within cap).
     BOTH-over precedence = 'over_duration' (duration checked first).
   - Boundaries: exactly 90 -> ok; exactly SS_FILE_SIZE_CAP -> ok; one over -> not ok.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

const DURATION_CAP = ss.SS_DURATION_CAP;     // 90 (exported constant — never hardcode)
const SIZE_CAP = ss.SS_FILE_SIZE_CAP;        // 314572800 (exported constant — never hardcode)

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: curator-upload-v2 — media-file validation property test\n');

// Feature: curator-upload-v2, Property 4
// Property 4: Media-file validation gates on both duration and size.
// For any sizeBytes and durationSec, ssValidateMediaFile(sizeBytes, durationSec).ok
// is true IFF durationSec <= 90 AND sizeBytes <= FILE_SIZE_CAP (~300 MB); a failure
// reports which cap was exceeded; ok is the precondition the UI uses before minting
// a Mux upload (and the same duration bound the webhook re-applies).
// **Validates: Requirements 4.1, 4.2, 4.3, 4.5, 4.7**
try {
  const DOCUMENTED_REASONS = ['', 'invalid', 'over_duration', 'over_size'];

  // Independent recomputation of the documented gate + precedence (duration FIRST).
  function expected(sizeBytes, durationSec) {
    const size = Number(sizeBytes);
    const dur = Number(durationSec);
    if (!isFinite(size) || !isFinite(dur) || size < 0 || dur < 0) {
      return { ok: false, reason: 'invalid' };
    }
    if (dur > DURATION_CAP) {                 // duration checked first
      return { ok: false, reason: 'over_duration' };
    }
    if (size > SIZE_CAP) {
      return { ok: false, reason: 'over_size' };
    }
    return { ok: true, reason: '' };
  }

  /* Duration generator biased toward the cap edges:
       0, 45, 89, 90 (exactly cap → ok), 90.0001 / 91 (just over → over_duration),
       large, negatives (→ invalid), plus non-finite (NaN/±Infinity → invalid). */
  const finiteDur = fc.double({ min: -200, max: 600, noNaN: true, noDefaultInfinity: true });
  const edgeDur = fc.constantFrom(
    0, 1, 45, 89, DURATION_CAP, DURATION_CAP + 0.0001, DURATION_CAP + 1, 91, 300, -1, -90
  );
  const nonFinite = fc.constantFrom(NaN, Infinity, -Infinity);
  const durGen = fc.oneof(
    { weight: 5, arbitrary: finiteDur },
    { weight: 4, arbitrary: edgeDur },
    { weight: 2, arbitrary: nonFinite }
  );

  /* Size generator biased toward the cap edges:
       0, 1, CAP-1, CAP (exactly cap → ok), CAP+1 (just over → over_size),
       large, negatives (→ invalid), plus non-finite (→ invalid). */
  const finiteSize = fc.double({ min: -1000, max: SIZE_CAP * 2, noNaN: true, noDefaultInfinity: true });
  const edgeSize = fc.constantFrom(
    0, 1, 1000, SIZE_CAP - 1, SIZE_CAP, SIZE_CAP + 1, SIZE_CAP * 2, -1, -1000
  );
  const sizeGen = fc.oneof(
    { weight: 5, arbitrary: finiteSize },
    { weight: 4, arbitrary: edgeSize },
    { weight: 2, arbitrary: nonFinite }
  );

  fc.assert(fc.property(sizeGen, durGen, (sizeBytes, durationSec) => {
    // 1) Never throws (calling it inside the property already proves this).
    const r = ss.ssValidateMediaFile(sizeBytes, durationSec);

    // 2) ok is a strict boolean; reason is one of the documented codes.
    assert(r.ok === true || r.ok === false,
      `ok must be a strict boolean, got ${JSON.stringify(r.ok)}`);
    assert(DOCUMENTED_REASONS.indexOf(r.reason) !== -1,
      `undocumented reason ${JSON.stringify(r.reason)}`);

    // 3) reason is consistent with ok: empty IFF ok.
    assert((r.reason === '') === (r.ok === true),
      `reason '' must coincide with ok=true (ok=${r.ok}, reason=${JSON.stringify(r.reason)})`);

    // 4) Matches the independently-computed gate + precedence for every input.
    const e = expected(sizeBytes, durationSec);
    assert(r.ok === e.ok,
      `ok ${r.ok} != expected ${e.ok} for size=${sizeBytes}, dur=${durationSec}`);
    assert(r.reason === e.reason,
      `reason ${JSON.stringify(r.reason)} != expected ${JSON.stringify(e.reason)} for size=${sizeBytes}, dur=${durationSec}`);

    // 5) ok IFF (durationSec <= 90 AND sizeBytes <= SIZE_CAP), for finite non-negative input.
    const size = Number(sizeBytes), dur = Number(durationSec);
    if (isFinite(size) && isFinite(dur) && size >= 0 && dur >= 0) {
      const gate = (dur <= DURATION_CAP) && (size <= SIZE_CAP);
      assert(r.ok === gate,
        `ok ${r.ok} != gate ${gate} for size=${size}, dur=${dur}`);
    } else {
      // Non-finite or negative → ok=false, reason 'invalid'.
      assert(r.ok === false && r.reason === 'invalid',
        `invalid input must be ok=false/'invalid' (size=${sizeBytes}, dur=${durationSec})`);
    }

    // 6) Both-over precedence: duration over the cap always reports 'over_duration'
    //    even when size is also over the cap.
    if (isFinite(size) && isFinite(dur) && size >= 0 && dur >= 0 &&
        dur > DURATION_CAP && size > SIZE_CAP) {
      assert(r.reason === 'over_duration',
        `both-over case must report 'over_duration', got ${JSON.stringify(r.reason)}`);
    }

    return true;
  }), { numRuns: ITER });

  // ── Explicit literal cases called out in the design ───────────────────────
  let v;
  v = ss.ssValidateMediaFile(1000, 90);
  assert(v.ok === true && v.reason === '', "(1000, 90) must be ok=true");

  v = ss.ssValidateMediaFile(1000, DURATION_CAP + 1);
  assert(v.ok === false && v.reason === 'over_duration', "(1000, CAP+1) must be over_duration");

  v = ss.ssValidateMediaFile(SIZE_CAP, 10);
  assert(v.ok === true && v.reason === '', "(CAP, 10) must be ok=true");

  v = ss.ssValidateMediaFile(SIZE_CAP + 1, 10);
  assert(v.ok === false && v.reason === 'over_size', "(CAP+1, 10) must be over_size");

  // Precedence: both over → over_duration (duration checked first).
  v = ss.ssValidateMediaFile(SIZE_CAP + 1, DURATION_CAP + 1);
  assert(v.ok === false && v.reason === 'over_duration', "(CAP+1, CAP+1) must be over_duration (precedence)");

  v = ss.ssValidateMediaFile(-1, 10);
  assert(v.ok === false && v.reason === 'invalid', "(-1, 10) must be invalid");

  v = ss.ssValidateMediaFile(1000, -1);
  assert(v.ok === false && v.reason === 'invalid', "(1000, -1) must be invalid");

  v = ss.ssValidateMediaFile(NaN, 10);
  assert(v.ok === false && v.reason === 'invalid', "(NaN, 10) must be invalid");

  v = ss.ssValidateMediaFile(1000, Infinity);
  assert(v.ok === false && v.reason === 'invalid', "(1000, Infinity) must be invalid");

  // Boundary confirmations: exactly the caps are ok; one over is not.
  assert(ss.ssValidateMediaFile(SIZE_CAP, DURATION_CAP).ok === true,
    "(CAP, 90) — both exactly at cap — must be ok");
  assert(ss.ssValidateMediaFile(0, 0).ok === true, "(0, 0) must be ok");
  assert(ss.ssValidateMediaFile(SIZE_CAP - 1, DURATION_CAP).ok === true,
    "(CAP-1, 90) must be ok");

  // -Infinity on either arg → invalid.
  assert(ss.ssValidateMediaFile(-Infinity, 10).reason === 'invalid', "(-Infinity, 10) must be invalid");
  assert(ss.ssValidateMediaFile(1000, -Infinity).reason === 'invalid', "(1000, -Infinity) must be invalid");

  console.log('  \u2713 Property 4');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 4\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
