/* ═══════════════════════════════════════════════════════════════
   tests/prop-tap-to-play.test.js — Node property test for the inline feed's
   tap-to-play affordance decision `ssShouldShowTapToPlay(state)` in
   showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-tap-to-play.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE.

   CONTEXT: iOS/WebKit caps simultaneous inline <video> elements, so a contended
   ACTIVE clip can fail to autoplay and stick on its first frame. The affordance
   is shown ONLY for the ACTIVE, video clip when it is NOT actually playing — so
   non-active clips (expected to be paused) and gradient/demo clips never flash
   it, and a normally-playing clip (Android, or a healthy iOS clip) never shows it.

   Properties:
     1  Truth table — shows iff (active AND isVideo AND NOT playing).
     2  Never shows for a non-active clip (regardless of the other inputs).
     3  Never shows for a non-video clip (gradient/demo).
     4  Never shows while the clip is actually playing.
     5  Totality / defensiveness — never throws, always returns a boolean.
═══════════════════════════════════════════════════════════════ */
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

console.log('Feature: android-nan-watchit-fix — inline tap-to-play affordance property test\n');

assert(typeof ss.ssShouldShowTapToPlay === 'function', 'ssShouldShowTapToPlay is not exported');

const bool = () => fc.boolean();
// Broad garbage for the defensiveness property.
const garbage = () => fc.oneof(
  fc.constantFrom(undefined, null, NaN, Infinity, -Infinity, 0, 1, -1, '', '0', 'x', true, false),
  fc.integer(), fc.double(), fc.string(),
  fc.array(fc.anything(), { maxLength: 5 }), fc.object(), fc.anything()
);

// Property 1: Truth table — shows iff (active AND isVideo AND NOT playing).
prop('Property 1: truth table', () => {
  fc.assert(fc.property(bool(), bool(), bool(), (active, isVideo, playing) => {
    const out = ss.ssShouldShowTapToPlay({ active, isVideo, playing });
    const expected = !!(active && isVideo && !playing);
    assert(out === expected,
      `expected ${expected} for {active:${active},isVideo:${isVideo},playing:${playing}}, got ${show(out)}`);
    return true;
  }), { numRuns: ITER });
});

// Property 2: Never shows for a non-active clip.
prop('Property 2: non-active never shows', () => {
  fc.assert(fc.property(bool(), bool(), (isVideo, playing) => {
    assert(ss.ssShouldShowTapToPlay({ active: false, isVideo, playing }) === false,
      'non-active clip must never show the affordance');
    return true;
  }), { numRuns: ITER });
});

// Property 3: Never shows for a non-video (gradient/demo) clip.
prop('Property 3: non-video never shows', () => {
  fc.assert(fc.property(bool(), bool(), (active, playing) => {
    assert(ss.ssShouldShowTapToPlay({ active, isVideo: false, playing }) === false,
      'non-video clip must never show the affordance');
    return true;
  }), { numRuns: ITER });
});

// Property 4: Never shows while the clip is actually playing.
prop('Property 4: playing never shows', () => {
  fc.assert(fc.property(bool(), bool(), (active, isVideo) => {
    assert(ss.ssShouldShowTapToPlay({ active, isVideo, playing: true }) === false,
      'a playing clip must never show the affordance');
    return true;
  }), { numRuns: ITER });
});

// Property 5: Totality / defensiveness — never throws, always returns a boolean.
prop('Property 5: total and defensive', () => {
  fc.assert(fc.property(garbage(), (state) => {
    let out;
    try { out = ss.ssShouldShowTapToPlay(state); }
    catch (e) { throw new Error(`threw on ${show(state)}: ${e.message}`); }
    assert(typeof out === 'boolean', `must return boolean, got ${show(out)}`);
    return true;
  }), { numRuns: ITER });
  // Documented defaults for clearly-malformed input.
  assert(ss.ssShouldShowTapToPlay(null) === false, 'null → false');
  assert(ss.ssShouldShowTapToPlay(undefined) === false, 'undefined → false');
  assert(ss.ssShouldShowTapToPlay('nope') === false, 'string → false');
});

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
