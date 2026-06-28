/* ═══════════════════════════════════════════════════════════════
   tests/prop-device-budget.test.js — Node property test for the
   prefetch-cache-pipeline device prefetch-budget resolver
   `ssResolvePrefetchBudget(deviceProfile, networkTier)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-device-budget.test.js
   (auto-discovered by `node tests/run-all.js`).

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (a device-profile + a network-tier string in, a budget object out), so the
   stub never affects behaviour — it only lets the module load and populate
   module.exports.

   ── Contract (design.md, Property 7 / Requirements 8.3, 8.4, 8.5) ──
   ssResolvePrefetchBudget(deviceProfile, networkTier) returns
   `{ byteBudget, prefetchDepth, storageBudget }` (all finite numbers) and
   guarantees, for every Network_Tier:
     • android.byteBudget    >= ios.byteBudget       (Android gets the deeper budget, R8.5)
     • android.storageBudget >= ios.storageBudget
     • ios.storageBudget === SS_IOS_STORAGE_BUDGET   (iOS pinned to the lean ceiling, R8.4)
     • ('android','fast').prefetchDepth === SS_PREFETCH_DEPTH.fast and
       >= the depth of any other tier (R8.3)
     • unknown device → iOS row; unknown tier → medium row (fail lean).
   Total and deterministic.

   TDD NOTE: `ssResolvePrefetchBudget` does NOT exist yet — it is implemented in
   task 13.2. This file is authored FIRST (task 12.2) and is EXPECTED TO FAIL/ERROR
   ("ssResolvePrefetchBudget is not a function") until task 13.2 lands the helper.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function show(v) {
  try {
    if (typeof v === 'symbol') return v.toString();
    if (v !== null && typeof v === 'object') return JSON.stringify(v);
    return String(v);
  } catch (_) { return Object.prototype.toString.call(v); }
}

const isFiniteNum = (n) => typeof n === 'number' && Number.isFinite(n);

// A budget object is well-formed iff all three documented fields are finite numbers.
function assertShape(b, label) {
  assert(b && typeof b === 'object' && !Array.isArray(b),
    `${label}: result must be a plain object, got ${show(b)}`);
  assert(isFiniteNum(b.byteBudget), `${label}: byteBudget must be a finite number, got ${show(b.byteBudget)}`);
  assert(isFiniteNum(b.prefetchDepth), `${label}: prefetchDepth must be a finite number, got ${show(b.prefetchDepth)}`);
  assert(isFiniteNum(b.storageBudget), `${label}: storageBudget must be a finite number, got ${show(b.storageBudget)}`);
}

function budgetEq(a, b) {
  return a && b &&
    a.byteBudget === b.byteBudget &&
    a.prefetchDepth === b.prefetchDepth &&
    a.storageBudget === b.storageBudget;
}

const TIERS = ['slow', 'medium', 'fast'];
const IOS_STORAGE = ss.SS_IOS_STORAGE_BUDGET;
const PREFETCH_DEPTH = ss.SS_PREFETCH_DEPTH;

let failed = 0;

console.log('Feature: prefetch-cache-pipeline — device prefetch-budget invariants property test\n');

// Feature: prefetch-cache-pipeline, Property 7: Device prefetch-budget invariants
// **Validates: Requirements 8.3, 8.4, 8.5**
try {
  assert(typeof ss.ssResolvePrefetchBudget === 'function',
    'ssResolvePrefetchBudget is not implemented yet (expected by task 13.2)');
  assert(isFiniteNum(IOS_STORAGE), 'SS_IOS_STORAGE_BUDGET must be exported as a finite number');
  assert(PREFETCH_DEPTH && isFiniteNum(PREFETCH_DEPTH.fast),
    'SS_PREFETCH_DEPTH.fast must be exported as a finite number');

  // ── (a) Per-tier invariants: Android >= iOS, iOS storage pinned, shapes valid. ──
  fc.assert(fc.property(fc.constantFrom.apply(fc, TIERS), (tier) => {
    const ios = ss.ssResolvePrefetchBudget('ios', tier);
    const android = ss.ssResolvePrefetchBudget('android', tier);
    assertShape(ios, `ios/${tier}`);
    assertShape(android, `android/${tier}`);

    // Android gets the deeper budget (R8.5).
    assert(android.byteBudget >= ios.byteBudget,
      `android.byteBudget (${android.byteBudget}) must be >= ios.byteBudget (${ios.byteBudget}) for tier ${tier}`);
    assert(android.storageBudget >= ios.storageBudget,
      `android.storageBudget (${android.storageBudget}) must be >= ios.storageBudget (${ios.storageBudget}) for tier ${tier}`);

    // iOS storage pinned to the lean ceiling for EVERY tier (R8.4).
    assert(ios.storageBudget === IOS_STORAGE,
      `ios.storageBudget must equal SS_IOS_STORAGE_BUDGET (${IOS_STORAGE}) for tier ${tier}, got ${ios.storageBudget}`);

    // Determinism.
    assert(budgetEq(ss.ssResolvePrefetchBudget('android', tier), android),
      `non-deterministic android budget for tier ${tier}`);
    return true;
  }), { numRuns: ITER });

  // ── (b) ('android','fast') depth === fast-tier depth and >= every other tier. ──
  const androidFast = ss.ssResolvePrefetchBudget('android', 'fast');
  assert(androidFast.prefetchDepth === PREFETCH_DEPTH.fast,
    `('android','fast').prefetchDepth must equal SS_PREFETCH_DEPTH.fast (${PREFETCH_DEPTH.fast}), got ${androidFast.prefetchDepth}`);
  for (const tier of TIERS) {
    const other = ss.ssResolvePrefetchBudget('android', tier);
    assert(androidFast.prefetchDepth >= other.prefetchDepth,
      `('android','fast') depth (${androidFast.prefetchDepth}) must be >= ('android','${tier}') depth (${other.prefetchDepth})`);
  }

  // ── (c) Unknown device → iOS row; unknown tier → medium row (fail lean). ──
  const garbageDevice = fc.oneof(
    fc.constantFrom('desktop', 'IOS', 'Android', 'windows', '', 'tablet', null, undefined, 0, 1, true, false, NaN),
    fc.string().filter((s) => s !== 'ios' && s !== 'android'),
    fc.object()
  );
  const garbageTier = fc.oneof(
    fc.constantFrom('SLOW', 'turbo', '4g', '3g', '', 'mediumish', null, undefined, 0, 1, true, false, NaN),
    fc.string().filter((s) => TIERS.indexOf(s) === -1),
    fc.object()
  );

  // Unknown device resolves to the iOS row for the same tier.
  fc.assert(fc.property(fc.constantFrom.apply(fc, TIERS), garbageDevice, (tier, dev) => {
    const got = ss.ssResolvePrefetchBudget(dev, tier);
    const ios = ss.ssResolvePrefetchBudget('ios', tier);
    assertShape(got, `unknown-device/${tier}`);
    assert(budgetEq(got, ios),
      `unknown device ${show(dev)} must resolve to the iOS row for tier ${tier}: got ${show(got)} vs ${show(ios)}`);
    return true;
  }), { numRuns: ITER });

  // Unknown tier resolves to the medium row for the same device.
  fc.assert(fc.property(fc.constantFrom('ios', 'android'), garbageTier, (dev, tier) => {
    const got = ss.ssResolvePrefetchBudget(dev, tier);
    const medium = ss.ssResolvePrefetchBudget(dev, 'medium');
    assertShape(got, `${dev}/unknown-tier`);
    assert(budgetEq(got, medium),
      `unknown tier ${show(tier)} must resolve to the medium row for device ${dev}: got ${show(got)} vs ${show(medium)}`);
    return true;
  }), { numRuns: ITER });

  // ── (d) Totality: ANY (device, tier) — including junk — yields a well-formed
  //        budget object, never throws, deterministic. ──
  fc.assert(fc.property(
    fc.oneof(fc.constantFrom('ios', 'android'), garbageDevice),
    fc.oneof(fc.constantFrom.apply(fc, TIERS), garbageTier),
    (dev, tier) => {
      const a = ss.ssResolvePrefetchBudget(dev, tier);
      const b = ss.ssResolvePrefetchBudget(dev, tier);
      assertShape(a, `totality(${show(dev)},${show(tier)})`);
      assert(budgetEq(a, b), `non-deterministic for (${show(dev)}, ${show(tier)})`);
      return true;
    }), { numRuns: ITER });

  console.log('  \u2713 Property 7');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 7\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
