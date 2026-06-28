/* ═══════════════════════════════════════════════════════════════
   tests/prop-killswitch-resolve.test.js — Node property test for the
   prefetch-cache-pipeline Kill_Switch resolver
   `ssResolveKillSwitches(rawFlags, defaults)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-killswitch-resolve.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (a raw flag map + a documented defaults map in, an effective on/off state map
   out), so the stub never affects behaviour — it only lets the module load and
   populate module.exports.

   ── Contract (design.md, Property 8 / Requirements 10.2, 10.5) ──
   ssResolveKillSwitches(rawFlags, defaults) returns an effective on/off state
   (boolean: true = on/enabled, false = off/disabled) for EVERY capability named
   in `defaults`:
     • a flag PRESENT in rawFlags overrides its default,
     • a flag ABSENT from rawFlags takes its documented default,
     • when rawFlags is UNREADABLE (null / non-object) EVERY capability takes its
       documented default — never a mix of present-and-defaulted flags (the
       all-or-defaults rule that prevents a half-configured pipeline).
   The result key set is exactly the capability set defined by `defaults`. Total
   and deterministic.

   TDD NOTE: `ssResolveKillSwitches` does NOT exist yet — it is implemented in
   task 2.1. This file is authored FIRST (task 1.1) and is EXPECTED TO FAIL/ERROR
   ("ssResolveKillSwitches is not a function") until task 2.1 lands the helper.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

// The 7 independently-shippable Pipeline capabilities (all documented default OFF).
const CAPS = [
  'ss_ff_prewarm',
  'ss_ff_idb',
  'ss_ff_poster_swr',
  'ss_ff_segprefetch',
  'ss_ff_segcache',
  'ss_ff_speculation',
  'ss_ff_viewtransition',
];

function keysEqualCaps(obj) {
  const ks = Object.keys(obj);
  if (ks.length !== CAPS.length) return false;
  return CAPS.every((c) => Object.prototype.hasOwnProperty.call(obj, c));
}

console.log('Feature: prefetch-cache-pipeline — kill-switch resolution property test\n');

// Feature: prefetch-cache-pipeline, Property 8: Kill-switch resolution is all-or-defaults
// **Validates: Requirements 10.2, 10.5**
try {
  assert(typeof ss.ssResolveKillSwitches === 'function',
    'ssResolveKillSwitches is not implemented yet (expected by task 2.1)');

  // Documented defaults map: every capability with a boolean default state.
  const defaultsArb = fc.record(
    CAPS.reduce((acc, c) => { acc[c] = fc.boolean(); return acc; }, {})
  );

  // A readable, possibly-partial raw flag map: pick a subset of capabilities to
  // be "present" and give each a boolean value; the rest are absent.
  const readableRawArb = fc.subarray(CAPS).chain((present) =>
    fc.tuple(
      fc.constant(present),
      fc.array(fc.boolean(), { minLength: present.length, maxLength: present.length })
    ).map(([keys, vals]) => {
      const m = {};
      keys.forEach((k, i) => { m[k] = vals[i]; });
      return m;
    })
  );

  // ── (a) Readable partial map: present overrides, absent defaults; total key set. ──
  fc.assert(fc.property(readableRawArb, defaultsArb, (rawFlags, defaults) => {
    const out = ss.ssResolveKillSwitches(rawFlags, defaults);
    assert(out && typeof out === 'object' && !Array.isArray(out),
      `result must be a plain object: got ${JSON.stringify(out)}`);
    assert(keysEqualCaps(out),
      `result must carry an effective state for EVERY capability and no others: got ${JSON.stringify(Object.keys(out))}`);
    for (const cap of CAPS) {
      const present = Object.prototype.hasOwnProperty.call(rawFlags, cap);
      const expected = present ? rawFlags[cap] : defaults[cap];
      assert(out[cap] === expected,
        `${cap}: present=${present} expected ${expected}, got ${out[cap]} ` +
        `(raw=${JSON.stringify(rawFlags)}, def=${JSON.stringify(defaults)})`);
    }
    return true;
  }), { numRuns: ITER });

  // ── (b) Unreadable rawFlags → EVERY capability takes its default (no mix). ──
  const unreadableArb = fc.constantFrom(
    null, undefined, 0, 1, NaN, '', 'on', 'off', true, false, Symbol.iterator,
    [], [1, 2, 3], function () {}, () => 0
  );
  fc.assert(fc.property(unreadableArb, defaultsArb, (rawFlags, defaults) => {
    const out = ss.ssResolveKillSwitches(rawFlags, defaults);
    assert(out && typeof out === 'object' && !Array.isArray(out),
      `unreadable-path result must be a plain object: got ${JSON.stringify(out)}`);
    assert(keysEqualCaps(out),
      `unreadable-path result must carry every capability and no others: got ${JSON.stringify(Object.keys(out))}`);
    for (const cap of CAPS) {
      assert(out[cap] === defaults[cap],
        `all-or-defaults violated for ${cap}: expected default ${defaults[cap]}, got ${out[cap]} ` +
        `(unreadable raw=${String(rawFlags)})`);
    }
    return true;
  }), { numRuns: ITER });

  // ── (c) Determinism: same inputs → identical result. ──
  fc.assert(fc.property(
    fc.oneof(readableRawArb, unreadableArb),
    defaultsArb,
    (rawFlags, defaults) => {
      const a = ss.ssResolveKillSwitches(rawFlags, defaults);
      const b = ss.ssResolveKillSwitches(rawFlags, defaults);
      assert(JSON.stringify(a) === JSON.stringify(b),
        `non-deterministic: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
      return true;
    }), { numRuns: ITER });

  // ── Deterministic example rows (documented defaults: all OFF) ──
  const allOff = CAPS.reduce((acc, c) => { acc[c] = false; return acc; }, {});

  // A single present 'on' flag overrides only its own capability; the rest stay off.
  const oneOn = ss.ssResolveKillSwitches({ ss_ff_prewarm: true }, allOff);
  assert(keysEqualCaps(oneOn), 'example: result must cover every capability');
  assert(oneOn.ss_ff_prewarm === true, 'example: present ss_ff_prewarm=true must be on');
  assert(CAPS.filter((c) => c !== 'ss_ff_prewarm').every((c) => oneOn[c] === false),
    'example: every absent capability must take its OFF default');

  // A present 'off' flag against an all-ON defaults map overrides only itself.
  const allOn = CAPS.reduce((acc, c) => { acc[c] = true; return acc; }, {});
  const oneOff = ss.ssResolveKillSwitches({ ss_ff_segcache: false }, allOn);
  assert(oneOff.ss_ff_segcache === false, 'example: present ss_ff_segcache=false must be off');
  assert(CAPS.filter((c) => c !== 'ss_ff_segcache').every((c) => oneOff[c] === true),
    'example: every absent capability must take its ON default');

  // Unreadable storage (null) → ALL capabilities take their documented default.
  const nullResolved = ss.ssResolveKillSwitches(null, allOff);
  assert(CAPS.every((c) => nullResolved[c] === false),
    'example: null rawFlags must default ALL capabilities OFF (never a mix)');

  // Empty map → every capability defaults.
  const emptyResolved = ss.ssResolveKillSwitches({}, allOff);
  assert(CAPS.every((c) => emptyResolved[c] === false),
    'example: empty rawFlags must default ALL capabilities OFF');

  console.log('  \u2713 Property 8');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 8\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
