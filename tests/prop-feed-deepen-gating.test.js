/* ═══════════════════════════════════════════════════════════════
   tests/prop-feed-deepen-gating.test.js — Node property test for the
   feed-clip-load-performance progressive-deepening decision
   `ssShouldDeepen(state)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-feed-deepen-gating.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (a plain state object in, a boolean out), so the stub never affects behaviour.

   TDD NOTE: `ssShouldDeepen` does NOT exist yet — it is implemented in task 10.
   This file is authored FIRST and is EXPECTED TO FAIL ("not implemented yet")
   until then; the absence is guarded into a clean assertion failure, not a crash.

   Semantics — spare bandwidth deepens an upcoming clip ONLY when every gate
   passes. ssShouldDeepen(state) returns TRUE iff ALL of the following hold:
     - activeBufferSatisfied === true
     - distance is a finite number with 1 <= distance <= maxDistance
     - distance <= ssNetworkPolicy(networkTier).preloadDepth   (slow 1 / medium 3 / fast 5)
     - budgetRemainingBytes > nextSegmentBytes   (both finite numbers)
     - dwell >= dwellThreshold
   Any missing / non-finite / wrong-type field ⇒ FALSE (never deepen on
   uncertainty). Pure, total, deterministic; never throws.
   state = { activeBufferSatisfied, distance, networkTier, budgetRemainingBytes,
             nextSegmentBytes, dwell, dwellThreshold, maxDistance }.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// Safe stringifier: fast-check garbage can have a non-function toString.
function show(v) {
  try {
    if (v !== null && typeof v === 'object') return JSON.stringify(v);
    return String(v);
  } catch (_) { return Object.prototype.toString.call(v); }
}

const isNum = (x) => typeof x === 'number' && isFinite(x);

// Depth oracle mirrors the contract: depth = ssNetworkPolicy(tier).preloadDepth.
function depthFor(tier) {
  try {
    const pol = ss.ssNetworkPolicy(tier);
    if (pol && isNum(pol.preloadDepth)) return pol.preloadDepth;
  } catch (_) { /* fall through */ }
  return NaN;
}

// Reference oracle: the exact gating contract, used only for WELL-FORMED states
// whose networkTier is a known tier (so depth is well-defined).
function expectedDeepen(s) {
  if (!s || typeof s !== 'object') return false;
  if (s.activeBufferSatisfied !== true) return false;
  if (!isNum(s.distance) || !isNum(s.maxDistance)) return false;
  if (!(s.distance >= 1 && s.distance <= s.maxDistance)) return false;
  const depth = depthFor(s.networkTier);
  if (!isNum(depth)) return false;
  if (!(s.distance <= depth)) return false;
  if (!isNum(s.budgetRemainingBytes) || !isNum(s.nextSegmentBytes)) return false;
  if (!(s.budgetRemainingBytes > s.nextSegmentBytes)) return false;
  if (!isNum(s.dwell) || !isNum(s.dwellThreshold)) return false;
  if (!(s.dwell >= s.dwellThreshold)) return false;
  return true;
}

let failed = 0;

console.log('Feature: feed-clip-load-performance — deepening gating property test\n');

// Feature: feed-clip-load-performance, Property 3: Deepening gating
// **Validates: Requirements 2.1, 2.3**
try {
  // Guard: the function must exist (red until task 10 implements it).
  assert(typeof ss.ssShouldDeepen === 'function',
    'ssShouldDeepen is not implemented yet (expected until task 10)');

  // ── (a) Well-formed states across the whole gate space (known tiers) ──
  // distance/maxDistance span in- and out-of-range; budget can be <,=,> next;
  // dwell can be <,=,> threshold; activeBufferSatisfied true/false. The decision
  // must match the contract oracle EXACTLY — this asserts false whenever any
  // gate fails AND true when every gate passes.
  const wellFormed = fc.record({
    activeBufferSatisfied: fc.boolean(),
    distance: fc.integer({ min: -3, max: 12 }),
    networkTier: fc.constantFrom('slow', 'medium', 'fast'),
    budgetRemainingBytes: fc.integer({ min: 0, max: 2000000 }),
    nextSegmentBytes: fc.integer({ min: 0, max: 2000000 }),
    dwell: fc.double({ min: 0, max: 1, noNaN: true }),
    dwellThreshold: fc.double({ min: 0, max: 1, noNaN: true }),
    maxDistance: fc.integer({ min: -1, max: 12 }),
  });

  fc.assert(fc.property(wellFormed, (state) => {
    const result = ss.ssShouldDeepen(state);
    assert(typeof result === 'boolean',
      `result must be a boolean: got ${show(result)} for ${show(state)}`);
    const exp = expectedDeepen(state);
    assert(result === exp,
      `gating mismatch: got ${result}, expected ${exp} for ${show(state)}`);
    // Determinism: identical inputs → identical output.
    assert(ss.ssShouldDeepen(state) === result,
      `non-deterministic output for ${show(state)}`);
    return true;
  }), { numRuns: ITER });

  // ── (b) A fully-satisfied base state deepens; breaking ONE gate → false ──
  // Build a state where every gate passes, then mutate exactly one gate and
  // assert the decision flips to false (the others held constant).
  const tierAndDepth = fc.constantFrom('slow', 'medium', 'fast').map((t) => ({ t, d: depthFor(t) }));
  fc.assert(fc.property(
    tierAndDepth,
    fc.integer({ min: 0, max: 4 }),         // extra maxDistance headroom
    fc.integer({ min: 1, max: 1000000 }),   // nextSegmentBytes
    fc.integer({ min: 1, max: 1000000 }),   // budget surplus over next
    fc.double({ min: 0, max: 1, noNaN: true }), // dwellThreshold
    (td, head, next, surplus, thr) => {
      const depth = td.d;
      const distance = depth;                 // largest in-range distance for the tier
      const base = {
        activeBufferSatisfied: true,
        distance,
        networkTier: td.t,
        budgetRemainingBytes: next + surplus, // strictly greater than next
        nextSegmentBytes: next,
        dwell: 1,                             // >= any threshold in [0,1]
        dwellThreshold: thr,
        maxDistance: distance + head,
      };
      // Fully satisfied → true.
      assert(ss.ssShouldDeepen(base) === true,
        `fully-satisfied state must deepen: ${show(base)}`);

      // Gate 1: active buffer not satisfied → false.
      assert(ss.ssShouldDeepen(Object.assign({}, base, { activeBufferSatisfied: false })) === false,
        'unsatisfied active buffer must block deepening');
      // Gate 2: distance below range (0 or negative) → false.
      assert(ss.ssShouldDeepen(Object.assign({}, base, { distance: 0 })) === false,
        'distance 0 must block deepening');
      // Gate 3: distance beyond maxDistance → false.
      assert(ss.ssShouldDeepen(Object.assign({}, base, { maxDistance: distance - 1 })) === false,
        'distance beyond maxDistance must block deepening');
      // Gate 4: distance beyond the tier depth → false.
      assert(ss.ssShouldDeepen(Object.assign({}, base, { distance: depth + 1, maxDistance: depth + 5 })) === false,
        'distance beyond tier depth must block deepening');
      // Gate 5: budget not exceeding next segment → false.
      assert(ss.ssShouldDeepen(Object.assign({}, base, { budgetRemainingBytes: next })) === false,
        'budget equal to next segment must block deepening');
      // Gate 6: dwell below threshold → false (only meaningful when thr > 0).
      if (thr > 0) {
        assert(ss.ssShouldDeepen(Object.assign({}, base, { dwell: 0, dwellThreshold: thr })) === false,
          'dwell below threshold must block deepening');
      }
      return true;
    }
  ), { numRuns: ITER });

  // ── (c) Totality: malformed / missing / non-finite fields never throw and
  // always yield a boolean (and must be false — never deepen on uncertainty). ──
  const garbage = fc.oneof(
    fc.constant(undefined), fc.constant(null), fc.string(), fc.integer(),
    fc.constantFrom(NaN, Infinity, -Infinity), fc.object(),
    fc.record({
      activeBufferSatisfied: fc.constantFrom(true, false, 'yes', 1, 0, null, undefined),
      distance: fc.oneof(fc.integer(), fc.constantFrom(NaN, Infinity, -Infinity, '2', null, undefined)),
      networkTier: fc.oneof(fc.string(), fc.constantFrom(undefined, null, 'turbo')),
      budgetRemainingBytes: fc.oneof(fc.integer(), fc.constantFrom(NaN, Infinity, '10', null, undefined)),
      nextSegmentBytes: fc.oneof(fc.integer(), fc.constantFrom(NaN, Infinity, '5', null, undefined)),
      dwell: fc.oneof(fc.double(), fc.constantFrom(NaN, Infinity, '0.5', null, undefined)),
      dwellThreshold: fc.oneof(fc.double(), fc.constantFrom(NaN, Infinity, null, undefined)),
      maxDistance: fc.oneof(fc.integer(), fc.constantFrom(NaN, Infinity, '4', null, undefined)),
    }, { requiredKeys: [] })
  );

  fc.assert(fc.property(garbage, (state) => {
    const result = ss.ssShouldDeepen(state);          // must not throw
    assert(typeof result === 'boolean',
      `result must be a boolean for malformed input: got ${show(result)} for ${show(state)}`);
    // A malformed/non-finite field can never satisfy the contract.
    if (!expectedDeepen(state)) {
      assert(result === false,
        `uncertain/malformed state must not deepen: got true for ${show(state)}`);
    }
    return true;
  }), { numRuns: ITER });

  // ── Explicit example assertions ──
  const good = {
    activeBufferSatisfied: true, distance: 1, networkTier: 'medium',
    budgetRemainingBytes: 1000, nextSegmentBytes: 500,
    dwell: 0.8, dwellThreshold: 0.5, maxDistance: 4,
  };
  assert(ss.ssShouldDeepen(good) === true, 'clearly-true state must deepen');
  // One example per failing gate → false.
  assert(ss.ssShouldDeepen(Object.assign({}, good, { activeBufferSatisfied: false })) === false, 'gate: active buffer');
  assert(ss.ssShouldDeepen(Object.assign({}, good, { distance: 0 })) === false, 'gate: distance < 1');
  assert(ss.ssShouldDeepen(Object.assign({}, good, { distance: 5, maxDistance: 10 })) === false, 'gate: distance > medium depth(3)');
  assert(ss.ssShouldDeepen(Object.assign({}, good, { maxDistance: 0 })) === false, 'gate: distance > maxDistance');
  assert(ss.ssShouldDeepen(Object.assign({}, good, { budgetRemainingBytes: 500 })) === false, 'gate: budget == next');
  assert(ss.ssShouldDeepen(Object.assign({}, good, { budgetRemainingBytes: 100 })) === false, 'gate: budget < next');
  assert(ss.ssShouldDeepen(Object.assign({}, good, { dwell: 0.2 })) === false, 'gate: dwell < threshold');
  assert(ss.ssShouldDeepen(Object.assign({}, good, { nextSegmentBytes: NaN })) === false, 'gate: non-finite next');
  assert(ss.ssShouldDeepen(Object.assign({}, good, { distance: Infinity })) === false, 'gate: non-finite distance');
  assert(ss.ssShouldDeepen(null) === false, 'null state → false');
  assert(ss.ssShouldDeepen(undefined) === false, 'undefined state → false');
  // On the fast tier depth is 5, so distance 5 (with headroom) deepens.
  assert(ss.ssShouldDeepen(Object.assign({}, good, { networkTier: 'fast', distance: 5, maxDistance: 6 })) === true,
    'fast tier permits distance up to depth 5');

  console.log('  \u2713 Property 3');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 3\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
