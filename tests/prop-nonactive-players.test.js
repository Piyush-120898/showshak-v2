/* ═══════════════════════════════════════════════════════════════
   tests/prop-nonactive-players.test.js — Node property test for the
   background-autoplay fix helper `ssNonActivePlayers(activeIdx, count)` in
   showshak-shared.js.

   Plain Node (no framework) + fast-check; run with:
     node tests/prop-nonactive-players.test.js
   (auto-discovered by `node tests/run-all.js`).

   showshak-shared.js runs DOM setup at load, so install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (two numbers in, an index array out), so the stub never affects behaviour.

   ── CONTRACT (the "only the active clip may play" invariant) ──
   ssNonActivePlayers(activeIdx, count) returns the set of mounted-surface indices
   that MUST be paused so only the active clip can play:
     • a sorted, duplicate-free array of integers in [0, floor(count)),
     • NEVER contains activeIdx,
     • when activeIdx is an integer in range: exactly [0..n-1] minus activeIdx
       (length n-1), and result ∪ {activeIdx} === [0..n-1],
     • when activeIdx is out of range (e.g. -1 = no active clip) or non-integer:
       EVERY index [0..n-1] (length n) — pause everything, nothing should play,
     • count <= 0 / non-finite / non-number → [],
     • total + deterministic: never throws, same input → same output.
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
  catch (e) { failed++; console.log('  \u2717 ' + name + '\n      ' + (e && e.message)); }
}

console.log('Feature: feed background-autoplay fix — ssNonActivePlayers invariant\n');

if (typeof ss.ssNonActivePlayers !== 'function') {
  failed++;
  console.log('  \u2717 ssNonActivePlayers is not exported');
} else {
  const fn = ss.ssNonActivePlayers;

  // A small int count (the mounted-surface array length) + an activeIdx that
  // straddles in-range and out-of-range (incl. -1 = no active clip, floats, big).
  const countArb  = fc.integer({ min: 0, max: 40 });
  const activeArb  = fc.oneof(
    fc.integer({ min: -3, max: 43 }),
    fc.constantFrom(-1, 0),
    fc.double({ min: -2, max: 42, noNaN: true })   // non-integer active → out of range
  );

  /* ── (1) Shape: sorted, unique, integers, in [0, n); never the active index ── */
  prop('Property 1: in-range, sorted, unique, never includes activeIdx', () => {
    fc.assert(fc.property(activeArb, countArb, (activeIdx, count) => {
      const out = fn(activeIdx, count);
      assert(Array.isArray(out), `must return an array, got ${show(out)}`);
      const n = Math.floor(count);
      for (let k = 0; k < out.length; k++) {
        const v = out[k];
        assert(Number.isInteger(v) && v >= 0 && v < n,
          `index ${show(v)} out of [0,${n}) for active=${show(activeIdx)} count=${show(count)}`);
        assert(v !== activeIdx, `result must never contain the active index ${show(activeIdx)}`);
        if (k > 0) assert(out[k] > out[k - 1], `must be strictly ascending: ${show(out)}`);
      }
      return true;
    }), { numRuns: ITER });
  });

  /* ── (2) In-range active → exactly [0..n-1] minus active; union recovers all ── */
  prop('Property 2: integer active in range ⇒ all-but-active (length n-1)', () => {
    const nAndActive = fc.integer({ min: 1, max: 40 })
      .chain((n) => fc.tuple(fc.constant(n), fc.integer({ min: 0, max: n - 1 })));
    fc.assert(fc.property(nAndActive, ([n, active]) => {
      const out = fn(active, n);
      assert(out.length === n - 1,
        `expected ${n - 1} non-active indices, got ${out.length} (${show(out)})`);
      assert(out.indexOf(active) === -1, 'active index must be excluded');
      // Union with the active index recovers the full [0..n-1] set, no dup.
      const union = out.concat([active]).sort((a, b) => a - b);
      for (let i = 0; i < n; i++) assert(union[i] === i, `union mismatch at ${i}: ${show(union)}`);
      return true;
    }), { numRuns: ITER });
  });

  /* ── (3) Out-of-range / non-integer active ⇒ pause EVERYTHING ([0..n-1]) ─────── */
  prop('Property 3: out-of-range / non-integer active ⇒ every index', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 40 }),
      fc.oneof(fc.constantFrom(-1, -2), fc.integer({ min: 41, max: 100 }), fc.constant(1.5)),
      (n, active) => {
        const out = fn(active, n);
        assert(out.length === n, `out-of-range active must pause all ${n}, got ${out.length}`);
        for (let i = 0; i < n; i++) assert(out[i] === i, `expected full set, got ${show(out)}`);
        return true;
      }
    ), { numRuns: ITER });
  });

  /* ── (4) Degenerate count → [] ─────────────────────────────────────────────── */
  prop('Property 4: non-positive / non-finite / non-number count → []', () => {
    const bad = [0, -1, -50, NaN, Infinity, -Infinity, null, undefined, '5', '', {}, [], true, false];
    bad.forEach((c) => {
      const out = fn(5, c);
      assert(Array.isArray(out) && out.length === 0, `count=${show(c)} must yield [], got ${show(out)}`);
    });
    // float count floors: count=3.9, active=1 → [0,2]
    assert(show(fn(1, 3.9)) === show([0, 2]), 'count floors to 3 → [0,2]');
  });

  /* ── (5) Total + deterministic: never throws, same input → same output ──────── */
  prop('Property 5: total (never throws) + deterministic', () => {
    // active can be ANYTHING; count is bounded (a huge numeric count would
    // legitimately allocate a huge array — that is not the totality concern here)
    // but still includes the weird non-number / non-finite values.
    const weirdCount = fc.oneof(
      fc.integer({ min: -5, max: 45 }),
      fc.constantFrom(NaN, Infinity, -Infinity, null, undefined, '5', '', {}, [], true, false)
    );
    fc.assert(fc.property(fc.anything(), weirdCount, (a, c) => {
      let r1, r2;
      try { r1 = fn(a, c); r2 = fn(a, c); }
      catch (e) { throw new Error(`threw on active=${show(a)} count=${show(c)}: ${e.message}`); }
      assert(Array.isArray(r1) && Array.isArray(r2), 'always returns arrays');
      assert(show(r1) === show(r2), `non-deterministic: ${show(r1)} != ${show(r2)}`);
      return true;
    }), { numRuns: ITER });
  });

  /* ── (6) Explicit literal cases pinning the headline behaviour ──────────────── */
  prop('Property 6 (literals): solo-play index set', () => {
    assert(show(fn(0, 3)) === show([1, 2]), 'active 0 of 3 → [1,2]');
    assert(show(fn(2, 3)) === show([0, 1]), 'active 2 of 3 → [0,1]');
    assert(show(fn(1, 2)) === show([0]),    'active 1 of 2 → [0]');
    assert(show(fn(-1, 2)) === show([0, 1]),'no active → pause all [0,1]');
    assert(show(fn(0, 1)) === show([]),     'single mounted active → nothing to pause');
    assert(show(fn(0, 0)) === show([]),     'empty → []');
  });
}

/* ── ssShouldPauseSurface — the CONTINUOUS solo-play guard ───────────────────
   A non-active surface that reports real playback must be paused at once; the
   active surface must NEVER be flagged for pause. */
if (typeof ss.ssShouldPauseSurface !== 'function') {
  failed++;
  console.log('  \u2717 ssShouldPauseSurface is not exported');
} else {
  const g = ss.ssShouldPauseSurface;

  prop('Guard 1: never pauses the active surface (any playing state)', () => {
    fc.assert(fc.property(fc.integer({ min: -3, max: 50 }), fc.anything(), (active, playing) => {
      assert(g(active, active, playing) === false,
        `active index ${show(active)} must never be paused (playing=${show(playing)})`);
      return true;
    }), { numRuns: ITER });
  });

  prop('Guard 2: pauses a non-active surface iff it is actually playing', () => {
    const idxArb = fc.integer({ min: -3, max: 50 });
    fc.assert(fc.property(idxArb, idxArb, (i, active) => {
      if (i === active) return true;                 // covered by Guard 1
      assert(g(i, active, true) === true,  `non-active ${show(i)} playing → must pause`);
      assert(g(i, active, false) === false, `non-active ${show(i)} not playing → must NOT pause`);
      return true;
    }), { numRuns: ITER });
  });

  prop('Guard 3: total + boolean (coerces any playing value, never throws)', () => {
    fc.assert(fc.property(fc.anything(), fc.anything(), fc.anything(), (i, active, playing) => {
      let r;
      try { r = g(i, active, playing); }
      catch (e) { throw new Error(`threw on (${show(i)},${show(active)},${show(playing)}): ${e.message}`); }
      assert(r === true || r === false, `must return a boolean, got ${show(r)}`);
      return true;
    }), { numRuns: ITER });
  });

  prop('Guard 4 (literals): only-active-plays invariant', () => {
    assert(g(1, 0, true)  === true,  'non-active playing → pause');
    assert(g(0, 0, true)  === false, 'active playing → keep');
    assert(g(1, 0, false) === false, 'non-active idle → keep');
    assert(g(2, -1, true) === true,  'no active clip → any playing surface is paused');
  });
}

console.log('\n' + (failed ? `FAILED: ${failed} propert${failed === 1 ? 'y' : 'ies'}` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
