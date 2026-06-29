/* ═══════════════════════════════════════════════════════════════
   tests/prop-fresh-clip.test.js — Node property test for the profile "NEW"
   badge freshness decision `ssIsFreshClip(createdAt, nowMs, windowHours)` in
   showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-fresh-clip.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE.

   CONTEXT: the curator profile grid showed a "NEW" tag on EVERY owner clip. It
   should appear only on freshly-posted clips (≤ ~48h old). This pure helper gates
   that badge: a clip is "fresh" iff its created_at resolves to a finite ms-epoch,
   is not in the future, and its age is within the window (default 48h).

   Properties:
     1  Within window (0 ≤ age ≤ window) ⇒ true; beyond ⇒ false (boundary inclusive).
     2  Future-dated (age < 0) ⇒ false.
     3  Accepts ms-number, ISO string, and Date equivalently.
     4  Unresolvable / garbage createdAt ⇒ false.
     5  Non-finite / non-positive window ⇒ false.
     6  Totality / defensiveness + purity — never throws, returns a boolean, no mutation.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function show(v) {
  try { return (v !== null && typeof v === 'object') ? JSON.stringify(v) : String(v); }
  catch (_) { return Object.prototype.toString.call(v); }
}

let failed = 0;
function prop(name, fn) {
  try { fn(); console.log('  \u2713 ' + name); }
  catch (e) { failed++; console.log('  \u2717 ' + name + '\n      ' + e.message); }
}

console.log('Feature: profile NEW-badge freshness — ssIsFreshClip property test\n');

assert(typeof ss.ssIsFreshClip === 'function', 'ssIsFreshClip is not exported');
const H = 3600000;
const NOW = 1_700_000_000_000; // fixed "now" for determinism

// Property 1: within window ⇒ true, beyond ⇒ false (boundary inclusive).
prop('Property 1: within window ⇒ true, beyond ⇒ false', () => {
  fc.assert(fc.property(
    fc.integer({ min: 1, max: 240 }),          // window hours
    fc.integer({ min: 0, max: 500 }),          // age hours
    (winH, ageH) => {
      const createdAt = NOW - ageH * H;
      const out = ss.ssIsFreshClip(createdAt, NOW, winH);
      const expected = ageH <= winH;
      assert(out === expected,
        `age ${ageH}h vs window ${winH}h: expected ${expected}, got ${show(out)}`);
      return true;
    }), { numRuns: ITER });
  // Exact boundary: age === window ⇒ true; age === window + 1ms ⇒ false.
  assert(ss.ssIsFreshClip(NOW - 48 * H, NOW, 48) === true, 'age == window must be fresh');
  assert(ss.ssIsFreshClip(NOW - (48 * H + 1), NOW, 48) === false, 'age just past window must not be fresh');
});

// Property 2: future-dated ⇒ false.
prop('Property 2: future-dated ⇒ false', () => {
  fc.assert(fc.property(fc.integer({ min: 1, max: 1_000_000 }), (aheadMs) => {
    assert(ss.ssIsFreshClip(NOW + aheadMs, NOW, 48) === false, 'future-dated must not be fresh');
    return true;
  }), { numRuns: ITER });
});

// Property 3: ms-number, ISO string, and Date are equivalent.
prop('Property 3: number / ISO string / Date equivalence', () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 200 }), (ageH) => {
    const ms = NOW - ageH * H;
    const iso = new Date(ms).toISOString();
    const d = new Date(ms);
    const a = ss.ssIsFreshClip(ms, NOW, 48);
    const b = ss.ssIsFreshClip(iso, NOW, 48);
    const c = ss.ssIsFreshClip(d, NOW, 48);
    assert(a === b && b === c, `mismatch for age ${ageH}h: num=${a} iso=${b} date=${c}`);
    return true;
  }), { numRuns: ITER });
});

// Property 4: unresolvable / garbage createdAt ⇒ false.
prop('Property 4: garbage createdAt ⇒ false', () => {
  const garbage = [null, undefined, NaN, Infinity, -Infinity, '', 'not-a-date', {}, [], true, false];
  garbage.forEach(g => assert(ss.ssIsFreshClip(g, NOW, 48) === false, `${show(g)} → false`));
  fc.assert(fc.property(fc.oneof(fc.constantFrom(null, undefined, NaN, '', 'x'), fc.object(), fc.array(fc.anything())), (g) => {
    assert(ss.ssIsFreshClip(g, NOW, 48) === false, `garbage createdAt must be false: ${show(g)}`);
    return true;
  }), { numRuns: ITER });
});

// Property 5: non-finite / non-positive window ⇒ false.
prop('Property 5: bad window ⇒ false', () => {
  [0, -1, -48, NaN, Infinity, -Infinity].forEach(w =>
    assert(ss.ssIsFreshClip(NOW - H, NOW, w) === false, `window ${show(w)} → false`));
});

// Property 6: totality / defensiveness + purity.
prop('Property 6: total, defensive, pure', () => {
  const anything = () => fc.oneof(fc.anything(), fc.integer(), fc.double(), fc.string(), fc.date());
  fc.assert(fc.property(anything(), anything(), anything(), (ca, now, win) => {
    let out;
    try { out = ss.ssIsFreshClip(ca, now, win); }
    catch (e) { throw new Error(`threw on (${show(ca)},${show(now)},${show(win)}): ${e.message}`); }
    assert(typeof out === 'boolean', `must return boolean, got ${show(out)}`);
    return true;
  }), { numRuns: ITER });
  // Default window applies when omitted (48h).
  assert(ss.ssIsFreshClip(NOW - 1 * H, NOW) === true, 'default window: 1h old → fresh');
  assert(ss.ssIsFreshClip(NOW - 100 * H, NOW) === false, 'default window: 100h old → not fresh');
});

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
