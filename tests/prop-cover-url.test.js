/* ═══════════════════════════════════════════════════════════════
   tests/prop-cover-url.test.js — Node property test for the
   curator-upload-v2 cover-thumbnail pure helpers
   `ssCoverThumbUrl(playbackId, timeSec)` and `ssParseCoverTime(thumbUrl)`
   in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-cover-url.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helpers under test are PURE
   (take a string/number, return a string/number/null), so the stub never affects
   behaviour — it only lets the module load and populate module.exports.

   IMPORTANT — the helpers' EXACT semantics (mirrored by this test's oracle):
     ssCoverThumbUrl(playbackId, timeSec):
       - base = `https://image.mux.com/<pid>/thumbnail.jpg` (pid = String(playbackId),
         '' when playbackId is null/undefined; pid is NOT url-encoded).
       - "usable time" = coerces to a FINITE, NON-NEGATIVE Number, INCLUDING 0.
         usable  → base + '?time=' + String(Number(t))   (0 → '?time=0', 5.5 → '?time=5.5')
         not usable (undefined/null/NaN/Infinity/negative) → base, NO time param.
     ssParseCoverTime(thumbUrl):
       - non-string, no `time` param, or a non-finite captured value → null.
       - otherwise → Number(captured), an exact inverse of ssCoverThumbUrl
         (String(Number(t)) then Number() round-trips any finite Number exactly).

   pid generator note: the helper does NOT encode the pid, so a pid containing a
   query delimiter ('?', '&', '#') would corrupt the query string. We therefore
   restrict the pid generator to URL-safe characters (alphanumerics + dash), which
   keeps the exact-substring/round-trip assertions clean and matches real Mux
   playback ids (uuid-like).
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: curator-upload-v2 — cover thumbnail URL round-trip property test\n');

// Feature: curator-upload-v2, Property 8
// Property 8: Cover thumbnail URL round-trips with its parser.
// For any playback id pid and non-negative time t,
// ssParseCoverTime(ssCoverThumbUrl(pid, t)) === t, and the URL has the form
// image.mux.com/<pid>/thumbnail.jpg?time=<t>; when no cover time is supplied the
// default cover URL carries no time parameter.
// **Validates: Requirements 8.2, 8.3**
try {
  // URL-safe playback id: alphanumerics + dash, 1..40 chars (uuid-like). The helper
  // does not encode the pid, so we keep it free of query-delimiter characters so the
  // produced query string is unambiguous.
  const pidGen = fc.array(
    fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-".split('')),
    { minLength: 1, maxLength: 40 }
  ).map((chars) => chars.join(''));

  // Non-negative finite time: include 0, small floats like 5.5, and large values.
  const timeGen = fc.double({ min: 0, max: 1e12, noNaN: true, noDefaultInfinity: true });

  fc.assert(fc.property(pidGen, timeGen, (pid, t) => {
    const url = ss.ssCoverThumbUrl(pid, t);

    // The URL is an absolute https Mux thumbnail URL containing the pid path.
    const path = 'image.mux.com/' + pid + '/thumbnail.jpg';
    assert(typeof url === 'string', 'ssCoverThumbUrl must return a string');
    assert(url.indexOf(path) !== -1,
      `URL missing expected path: got ${url} expected to contain ${path}`);

    // t >= 0 finite is "usable" (including 0), so the URL ends with the time param,
    // independently built as String(Number(t)).
    const expectedSuffix = '?time=' + String(Number(t));
    assert(url === 'https://' + path + expectedSuffix,
      `URL shape mismatch: got ${url} expected https://${path}${expectedSuffix}`);
    assert(url.slice(-expectedSuffix.length) === expectedSuffix,
      `URL does not end with ${expectedSuffix}: ${url}`);

    // Round-trip: parsing the produced URL yields the exact same Number (strict ===).
    const parsed = ss.ssParseCoverTime(url);
    assert(parsed === t,
      `round-trip mismatch: ssParseCoverTime(${url}) = ${parsed} expected ${t}`);

    return true;
  }), { numRuns: ITER });

  // ── No-time cases: undefined/null/NaN/Infinity/negative → no `?time=`, parse → null ──
  const pidLit = 'abc-123';
  const noTimeInputs = [
    ss.ssCoverThumbUrl(pidLit),            // undefined (omitted)
    ss.ssCoverThumbUrl(pidLit, undefined),
    ss.ssCoverThumbUrl(pidLit, null),
    ss.ssCoverThumbUrl(pidLit, NaN),
    ss.ssCoverThumbUrl(pidLit, Infinity),
    ss.ssCoverThumbUrl(pidLit, -Infinity),
    ss.ssCoverThumbUrl(pidLit, -1),
  ];
  for (const url of noTimeInputs) {
    assert(url === 'https://image.mux.com/' + pidLit + '/thumbnail.jpg',
      `no-time URL should be the default thumbnail: got ${url}`);
    assert(url.indexOf('?time=') === -1,
      `no-time URL must not contain ?time=: ${url}`);
    assert(ss.ssParseCoverTime(url) === null,
      `ssParseCoverTime of a no-time URL must be null: ${url}`);
  }

  // ── 0 distinction: 0 is a real cover time → ?time=0, parses back to 0 (NOT null) ──
  const zeroUrl = ss.ssCoverThumbUrl(pidLit, 0);
  assert(zeroUrl === 'https://image.mux.com/' + pidLit + '/thumbnail.jpg?time=0',
    `0 must produce ?time=0: got ${zeroUrl}`);
  assert(zeroUrl.slice(-7) === '?time=0', `0 URL must end with ?time=0: ${zeroUrl}`);
  assert(ss.ssParseCoverTime(zeroUrl) === 0,
    `ssParseCoverTime(?time=0) must be 0 (not null): got ${ss.ssParseCoverTime(zeroUrl)}`);

  // ── Float / large explicit round-trips (exactness of String(Number(t)) <-> Number) ──
  for (const t of [5, 5.5, 0.25, 12.345, 89.999, 1234567.89]) {
    const u = ss.ssCoverThumbUrl(pidLit, t);
    assert(u.slice(-('?time=' + String(t)).length) === '?time=' + String(t),
      `float URL suffix mismatch for ${t}: ${u}`);
    assert(ss.ssParseCoverTime(u) === t,
      `float round-trip mismatch for ${t}: got ${ss.ssParseCoverTime(u)}`);
  }

  // ── ssParseCoverTime defensive cases ──
  assert(ss.ssParseCoverTime(null) === null, 'ssParseCoverTime(null) must be null');
  assert(ss.ssParseCoverTime(undefined) === null, 'ssParseCoverTime(undefined) must be null');
  assert(ss.ssParseCoverTime(42) === null, 'ssParseCoverTime(number) must be null');
  assert(ss.ssParseCoverTime('garbage') === null, "ssParseCoverTime('garbage') must be null");
  assert(ss.ssParseCoverTime('https://image.mux.com/x/thumbnail.jpg') === null,
    'ssParseCoverTime of a no-param URL must be null');

  console.log('  \u2713 Property 8');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 8\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
