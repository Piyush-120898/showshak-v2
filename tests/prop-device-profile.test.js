/* ═══════════════════════════════════════════════════════════════
   tests/prop-device-profile.test.js — Node property test for the
   prefetch-cache-pipeline device-profile classifier
   `ssDeviceProfile(ua)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-device-profile.test.js
   (auto-discovered by `node tests/run-all.js`).

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (a user-agent string in, a device-profile string out), so the stub never
   affects behaviour — it only lets the module load and populate module.exports.

   ── Contract (design.md, Property 6 / Requirements 8.2) ──
   ssDeviceProfile(ua) classifies the platform from a user-agent string:
     • iOS user agents — iPhone / iPad / iPod, and the iPadOS-as-desktop signal
       (Macintosh + touch) — return 'ios',
     • every other user agent returns 'android' (the deeper-budget default, since
       the only platform that needs the lean treatment is iOS),
     • a non-string / absent input returns 'ios' (FAIL LEAN — never grant the deep
       budget on uncertainty).
   Total and deterministic — never throws.

   TDD NOTE: `ssDeviceProfile` does NOT exist yet — it is implemented in task 13.1.
   This file is authored FIRST (task 12.1) and is EXPECTED TO FAIL/ERROR
   ("ssDeviceProfile is not a function") until task 13.1 lands the helper.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// Safe stringifier for diagnostics (fc.anything()/fc.object() can produce values
// whose toString is hostile, so never let a diagnostic crash the test).
function show(v) {
  try {
    if (typeof v === 'symbol') return v.toString();
    if (v !== null && typeof v === 'object') return JSON.stringify(v);
    return String(v);
  } catch (_) { return Object.prototype.toString.call(v); }
}

const PROFILES = ['ios', 'android'];

// Reference oracle — the EXACT classification the contract requires.
// iPhone/iPad/iPod (any case) → ios; Macintosh + touch (iPadOS-as-desktop) → ios;
// every other string → android; any non-string → ios (fail lean).
function expectedProfile(ua) {
  if (typeof ua !== 'string') return 'ios';
  if (/(iphone|ipad|ipod)/i.test(ua)) return 'ios';
  if (/macintosh/i.test(ua) && /touch/i.test(ua)) return 'ios';
  return 'android';
}

let failed = 0;

console.log('Feature: prefetch-cache-pipeline — device profile classification property test\n');

/* ── generators ───────────────────────────────────────────────── */

// Clear iOS user agents (iPhone / iPad / iPod tokens).
const iosUaArb = fc.oneof(
  fc.constantFrom(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    'iPhone', 'iPad', 'iPod'
  ),
  // arbitrary strings that embed an iOS token somewhere
  fc.tuple(fc.string(), fc.constantFrom('iPhone', 'iPad', 'iPod', 'iphone', 'IPAD'), fc.string())
    .map(([a, tok, b]) => a + tok + b)
);

// iPadOS-as-desktop signal: Macintosh + an explicit touch token → ios.
const ipadOsDesktopArb = fc.tuple(fc.string(), fc.string()).map(([a, b]) =>
  a + 'Macintosh; Intel Mac OS X 10_15' + b + ' Touch');

// Clear NON-iOS user agents (must classify to 'android'): real Android + other
// non-iOS platforms, none carrying an iOS token or the Macintosh+touch combo.
const androidUaArb = fc.constantFrom(
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 Chrome/118.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', // plain Mac, no touch → android
  'curl/8.4.0', 'AndroidBot', '', 'some-random-agent'
);

// Arbitrary fuzz strings that DO NOT carry an iOS token and are NOT Macintosh+touch,
// so the oracle's "otherwise → android" branch is exercised over a wide space.
const fuzzNonIosArb = fc.string().filter((s) =>
  !/(iphone|ipad|ipod)/i.test(s) && !(/macintosh/i.test(s) && /touch/i.test(s)));

// Non-string / absent inputs (fail lean → ios).
const nonStringArb = fc.oneof(
  fc.constantFrom(null, undefined, NaN, 0, 1, -1, Infinity, true, false),
  fc.integer(), fc.double(), fc.object(), fc.array(fc.anything()),
  fc.constant(Symbol('ua'))
);

/* ── Property 6 (main, against the oracle over all input classes) ── */
// Feature: prefetch-cache-pipeline, Property 6: Device profile classification
// **Validates: Requirements 8.2**
try {
  assert(typeof ss.ssDeviceProfile === 'function',
    'ssDeviceProfile is not implemented yet (expected by task 13.1)');

  const anyUaArb = fc.oneof(
    iosUaArb, ipadOsDesktopArb, androidUaArb, fuzzNonIosArb, nonStringArb
  );

  fc.assert(fc.property(anyUaArb, (ua) => {
    const got = ss.ssDeviceProfile(ua);
    // Total: always one of the two profiles, never throws.
    assert(PROFILES.indexOf(got) !== -1,
      `result must be 'ios' or 'android' for ${show(ua)}: got ${show(got)}`);
    // Matches the contract oracle exactly.
    const want = expectedProfile(ua);
    assert(got === want,
      `profile mismatch for ${show(ua)}: expected ${want}, got ${got}`);
    // Deterministic: a second identical call agrees.
    assert(ss.ssDeviceProfile(ua) === got, `non-deterministic result for ${show(ua)}`);
    return true;
  }), { numRuns: ITER });

  // ── Explicit deterministic rows ──
  // iOS tokens → ios.
  assert(ss.ssDeviceProfile('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)') === 'ios',
    'iPhone UA → ios');
  assert(ss.ssDeviceProfile('Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X)') === 'ios',
    'iPad UA → ios');
  assert(ss.ssDeviceProfile('Mozilla/5.0 (iPod touch; CPU iPhone OS 15_7 like Mac OS X)') === 'ios',
    'iPod UA → ios');
  // iPadOS-as-desktop: Macintosh + touch → ios.
  assert(ss.ssDeviceProfile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Touch') === 'ios',
    'Macintosh + touch (iPadOS-as-desktop) → ios');
  // Android + other non-iOS → android.
  assert(ss.ssDeviceProfile('Mozilla/5.0 (Linux; Android 14; Pixel 8)') === 'android',
    'Android UA → android');
  assert(ss.ssDeviceProfile('Mozilla/5.0 (Windows NT 10.0; Win64; x64)') === 'android',
    'Windows UA → android');
  // Plain Macintosh (no touch) → android.
  assert(ss.ssDeviceProfile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15') === 'android',
    'plain Macintosh (no touch) → android');
  assert(ss.ssDeviceProfile('') === 'android', 'empty string → android');
  // Non-string / absent → ios (fail lean).
  assert(ss.ssDeviceProfile(null) === 'ios', 'null → ios (fail lean)');
  assert(ss.ssDeviceProfile(undefined) === 'ios', 'undefined → ios (fail lean)');
  assert(ss.ssDeviceProfile(12345) === 'ios', 'number → ios (fail lean)');
  assert(ss.ssDeviceProfile({}) === 'ios', 'object → ios (fail lean)');

  console.log('  \u2713 Property 6');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 6\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
