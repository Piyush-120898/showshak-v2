/* ═══════════════════════════════════════════════════════════════
   tests/prop-resolve-muted.test.js — Node property test for the
   clip-player-performance audio-resolution rule
   `ssResolveSurfaceMuted(unlocked, mutePref)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-resolve-muted.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (takes a boolean + an arbitrary value, returns a boolean), so the stub never
   affects behaviour — it only lets the module load and populate module.exports.

   Rule semantics (mirrored by this test's oracle):
     - Before Audio_Unlock (unlocked falsy) → ALWAYS true. The browser autoplay
       policy forces muted playback until the first user gesture, regardless of
       the persisted Mute_Preference.
     - After Audio_Unlock (unlocked truthy) → Boolean(mutePref). The persisted
       sound-on/off intent is honored exactly; a sound-on preference (falsy
       mutePref) never resolves to muted — which is precisely what lets the
       engine skip the muted→unmuted transition and keep audio continuous on
       scroll.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: clip-player-performance — audio-resolution rule property test\n');

// Feature: clip-player-performance, Property 1: Audio-resolution rule honors unlock and preference
// **Validates: Requirements 1.4, 1.5, 9.5**
try {
  // `unlocked` is a boolean in real use; assert with arbitrary truthy/falsy too,
  // since the helper coerces. `mutePref` is anything the persisted pref / a
  // forced state could be (booleans, but also numbers/strings/objects/null).
  const anyVal = fc.oneof(
    fc.boolean(),
    fc.integer(),
    fc.double(),
    fc.string(),
    fc.constantFrom(NaN, Infinity, -Infinity, 0, 1),
    fc.constant(null),
    fc.constant(undefined),
    fc.object()
  );

  fc.assert(fc.property(fc.boolean(), anyVal, (unlocked, mutePref) => {
    const out = ss.ssResolveSurfaceMuted(unlocked, mutePref);

    // Total: always a strict boolean, never throws.
    assert(out === true || out === false,
      `ssResolveSurfaceMuted must return a boolean: got ${typeof out}`);

    if (!unlocked) {
      // Pre-unlock: forced muted regardless of preference.
      assert(out === true,
        `pre-unlock must be muted=true regardless of pref: got ${out}`);
    } else {
      // Post-unlock: exactly Boolean(mutePref).
      assert(out === Boolean(mutePref),
        `post-unlock must equal Boolean(mutePref): got ${out} expected ${Boolean(mutePref)}`);
    }
    return true;
  }), { numRuns: ITER });

  // ── The audio-continuity guarantee (Req 9.5): once unlocked, a sound-on
  //    preference (mutePref falsy) NEVER resolves to muted. This is what removes
  //    the muted→unmuted dance on scroll. ──
  fc.assert(fc.property(fc.constantFrom(false, 0, '', null, undefined, NaN), (soundOn) => {
    assert(ss.ssResolveSurfaceMuted(true, soundOn) === false,
      `unlocked + sound-on pref must resolve unmuted: got true for ${String(soundOn)}`);
    return true;
  }), { numRuns: ITER });

  // ── Explicit truth-table examples ──
  const examples = [
    [false, false, true],   // pre-unlock, sound-on pref  → muted (autoplay policy)
    [false, true,  true],   // pre-unlock, sound-off pref → muted
    [true,  false, false],  // unlocked, sound-on pref    → unmuted
    [true,  true,  true],   // unlocked, sound-off pref   → muted
    [true,  1,     true],   // unlocked, truthy pref      → muted
    [true,  0,     false],  // unlocked, falsy pref       → unmuted
    [false, undefined, true],
    [true,  undefined, false],
  ];
  for (const [u, p, want] of examples) {
    const got = ss.ssResolveSurfaceMuted(u, p);
    assert(got === want,
      `example mismatch for (unlocked=${u}, pref=${String(p)}): got ${got} expected ${want}`);
  }

  console.log('  \u2713 Property 1');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 1\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
