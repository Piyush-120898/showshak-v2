/* ═══════════════════════════════════════════════════════════════
   tests/prop-pipeline-totality.test.js — Node property test asserting the
   TOTALITY of every new pure helper introduced by the prefetch-cache-pipeline
   feature, in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-pipeline-totality.test.js
   (auto-discovered by `node tests/run-all.js`).

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. Every helper under test is PURE, so
   the stub never affects behaviour — it only lets the module load and populate
   module.exports.

   ── Contract (design.md, Property 10 / Requirements 1.5, 9.4, 13.3, 13.4) ──
   For ANY input — including null, undefined, wrong-typed, non-finite, or
   otherwise malformed — every new pure helper resolves WITHOUT THROWING and
   returns a well-formed result of its documented shape:
     • ssShouldPrewarm(a,b,c)            → boolean
     • ssPosterPrewarmList(a,b)          → string[]
     • ssPublicSignalsOnly(r)            → plain object (never null/array)
     • ssStorageTier(k)                  → 'cache_storage' | 'indexeddb' | 'localstorage'
     • ssDeviceProfile(ua)               → 'ios' | 'android'
     • ssResolvePrefetchBudget(d,t)      → { byteBudget, prefetchDepth, storageBudget } (finite numbers)
     • ssResolveKillSwitches(raw,def)    → plain object (effective flag state)
     • ssStorageTrimPlan(entries,budget) → { evict: string[], keep: string[] }

   Each helper is checked in its own block so the output shows exactly which
   helpers are total. The three Phase-3 helpers (ssDeviceProfile,
   ssResolvePrefetchBudget, ssStorageTrimPlan) do NOT exist until task 13 lands;
   their blocks are EXPECTED to fail now (guarded with a "not a function" assert),
   while the five already-shipped helpers pass their part.
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
const isPlainObject = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);

// A broad arbitrary covering null/undefined/wrong-typed/non-finite/malformed.
const junkArb = fc.oneof(
  fc.anything(),
  fc.constantFrom(null, undefined, NaN, Infinity, -Infinity, 0, 1, -1, '', true, false),
  fc.string(), fc.integer(), fc.double(), fc.object(), fc.array(fc.anything()),
  fc.constant(Symbol('x'))
);

const TIERS = ['cache_storage', 'indexeddb', 'localstorage'];
const PROFILES = ['ios', 'android'];

let failed = 0;
let total = 0;

console.log('Feature: prefetch-cache-pipeline — totality of all new pure helpers\n');

/* Run a totality block for one helper. `check` throws on a violation. */
function block(label, fn) {
  total++;
  try {
    fn();
    console.log('  \u2713 ' + label);
  } catch (e) {
    failed++;
    console.log('  \u2717 ' + label + '\n      ' + e.message);
  }
}

// Feature: prefetch-cache-pipeline, Property 10: Totality of all new pure helpers
// **Validates: Requirements 1.5, 9.4, 13.3, 13.4**

/* ── 1. ssShouldPrewarm → boolean ─────────────────────────────── */
block('Property 10: ssShouldPrewarm is total (→ boolean)', () => {
  assert(typeof ss.ssShouldPrewarm === 'function', 'ssShouldPrewarm is not a function');
  const setOrJunk = fc.oneof(junkArb, fc.array(fc.string()).map((a) => new Set(a)));
  fc.assert(fc.property(junkArb, junkArb, setOrJunk, (a, b, c) => {
    const out = ss.ssShouldPrewarm(a, b, c);
    assert(out === true || out === false,
      `must return a boolean for (${show(a)}, ${show(b)}, ${show(c)}): got ${show(out)}`);
    return true;
  }), { numRuns: ITER });
});

/* ── 2. ssPosterPrewarmList → string[] ────────────────────────── */
block('Property 10: ssPosterPrewarmList is total (→ string[])', () => {
  assert(typeof ss.ssPosterPrewarmList === 'function', 'ssPosterPrewarmList is not a function');
  fc.assert(fc.property(junkArb, junkArb, (a, b) => {
    const out = ss.ssPosterPrewarmList(a, b);
    assert(Array.isArray(out), `must return an array for (${show(a)}, ${show(b)}): got ${show(out)}`);
    assert(out.every((u) => typeof u === 'string'),
      `every element must be a string: got ${show(out)}`);
    return true;
  }), { numRuns: ITER });
});

/* ── 3. ssPublicSignalsOnly → plain object ────────────────────── */
block('Property 10: ssPublicSignalsOnly is total (→ plain object)', () => {
  assert(typeof ss.ssPublicSignalsOnly === 'function', 'ssPublicSignalsOnly is not a function');
  fc.assert(fc.property(junkArb, (r) => {
    const out = ss.ssPublicSignalsOnly(r);
    assert(isPlainObject(out), `must return a plain object for ${show(r)}: got ${show(out)}`);
    return true;
  }), { numRuns: ITER });
});

/* ── 4. ssStorageTier → one of the three tiers ────────────────── */
block('Property 10: ssStorageTier is total (→ tier string)', () => {
  assert(typeof ss.ssStorageTier === 'function', 'ssStorageTier is not a function');
  fc.assert(fc.property(junkArb, (k) => {
    const out = ss.ssStorageTier(k);
    assert(TIERS.indexOf(out) !== -1, `must return a known tier for ${show(k)}: got ${show(out)}`);
    return true;
  }), { numRuns: ITER });
});

/* ── 5. ssResolveKillSwitches → plain object ──────────────────── */
block('Property 10: ssResolveKillSwitches is total (→ plain object)', () => {
  assert(typeof ss.ssResolveKillSwitches === 'function', 'ssResolveKillSwitches is not a function');
  // defaults: a valid CAPS map, plus junk, to exercise both readable + unreadable paths.
  const CAPS = ['ss_ff_prewarm', 'ss_ff_idb', 'ss_ff_poster_swr', 'ss_ff_segprefetch',
    'ss_ff_segcache', 'ss_ff_speculation', 'ss_ff_viewtransition'];
  const defaultsArb = fc.oneof(
    fc.constant(CAPS.reduce((acc, c) => { acc[c] = false; return acc; }, {})),
    fc.record(CAPS.reduce((acc, c) => { acc[c] = fc.boolean(); return acc; }, {})),
    junkArb
  );
  fc.assert(fc.property(junkArb, defaultsArb, (raw, defaults) => {
    const out = ss.ssResolveKillSwitches(raw, defaults);
    assert(isPlainObject(out),
      `must return a plain object for (${show(raw)}, ${show(defaults)}): got ${show(out)}`);
    return true;
  }), { numRuns: ITER });
});

/* ── 6. ssDeviceProfile → 'ios' | 'android' (Phase 3, expected red) ── */
block('Property 10: ssDeviceProfile is total (→ profile string)', () => {
  assert(typeof ss.ssDeviceProfile === 'function', 'ssDeviceProfile is not a function');
  fc.assert(fc.property(junkArb, (ua) => {
    const out = ss.ssDeviceProfile(ua);
    assert(PROFILES.indexOf(out) !== -1, `must return a profile for ${show(ua)}: got ${show(out)}`);
    return true;
  }), { numRuns: ITER });
});

/* ── 7. ssResolvePrefetchBudget → well-formed budget (Phase 3, expected red) ── */
block('Property 10: ssResolvePrefetchBudget is total (→ budget object)', () => {
  assert(typeof ss.ssResolvePrefetchBudget === 'function', 'ssResolvePrefetchBudget is not a function');
  fc.assert(fc.property(junkArb, junkArb, (d, t) => {
    const out = ss.ssResolvePrefetchBudget(d, t);
    assert(isPlainObject(out), `must return a plain object for (${show(d)}, ${show(t)}): got ${show(out)}`);
    assert(isFiniteNum(out.byteBudget) && isFiniteNum(out.prefetchDepth) && isFiniteNum(out.storageBudget),
      `byteBudget/prefetchDepth/storageBudget must be finite numbers: got ${show(out)}`);
    return true;
  }), { numRuns: ITER });
});

/* ── 8. ssStorageTrimPlan → { evict: string[], keep: string[] } (Phase 3, expected red) ── */
block('Property 10: ssStorageTrimPlan is total (→ { evict, keep })', () => {
  assert(typeof ss.ssStorageTrimPlan === 'function', 'ssStorageTrimPlan is not a function');
  fc.assert(fc.property(junkArb, junkArb, (entries, budget) => {
    const out = ss.ssStorageTrimPlan(entries, budget);
    assert(out && typeof out === 'object' && Array.isArray(out.evict) && Array.isArray(out.keep),
      `must return { evict: [], keep: [] } for (${show(entries)}, ${show(budget)}): got ${show(out)}`);
    assert(out.evict.every((k) => typeof k === 'string') && out.keep.every((k) => typeof k === 'string'),
      `evict/keep must contain only string keys: got ${show(out)}`);
    return true;
  }), { numRuns: ITER });
});

console.log('\n' + (failed
  ? `FAILED: ${failed}/${total} helper totality block(s)`
  : `ALL PASSED (${total} helpers total)`));
process.exit(failed ? 1 : 0);
