/* ═══════════════════════════════════════════════════════════════
   tests/prop-storage-tier.test.js — Node property test for the
   prefetch-cache-pipeline storage-tier router
   `ssStorageTier(resourceKind)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-storage-tier.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (a resource-kind string in, a storage-tier string out), so the stub never
   affects behaviour — it only lets the module load and populate module.exports.

   ── Contract (design.md, Property 4 / Requirements 4.1, 4.2, 4.3) ──
   ssStorageTier(resourceKind) is the pure tiering router. It maps:
     • URL-addressable resources — 'app_shell', 'css', 'js', 'html', 'poster',
       'segment' — to 'cache_storage' (the Cache_Storage tier, R4.1),
     • structured 'page_data' to 'indexeddb' (R4.2),
     • tiny-flag kinds — 'flag', 'last_uid', 'cache_meta' — to 'localstorage' (R4.3),
     • any unknown / garbage kind (unknown string, '', null, undefined, number,
       object, array, boolean, …) to 'localstorage' — the smallest, safest tier.
   Total and deterministic — never throws.

   TDD NOTE: `ssStorageTier` does NOT exist yet — it is implemented in task 7.1.
   This file is authored FIRST (task 6.1) and is EXPECTED TO FAIL/ERROR
   ("ssStorageTier is not a function") until task 7.1 lands the helper.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// Safe stringifier: fast-check's fc.object() can produce objects whose toString
// is a non-function, so a bare String(v) throws while building a diagnostic.
function show(v) {
  try {
    if (typeof v === 'symbol') return v.toString();
    if (v !== null && typeof v === 'object') return JSON.stringify(v);
    return String(v);
  } catch (_) { return Object.prototype.toString.call(v); }
}

let failed = 0;

// The complete known routing table (design.md Property 4).
const KNOWN = {
  // URL-addressable → Cache_Storage (R4.1)
  app_shell: 'cache_storage',
  css: 'cache_storage',
  js: 'cache_storage',
  html: 'cache_storage',
  poster: 'cache_storage',
  segment: 'cache_storage',
  // structured → IndexedDB (R4.2)
  page_data: 'indexeddb',
  // tiny flags → localStorage (R4.3)
  flag: 'localstorage',
  last_uid: 'localstorage',
  cache_meta: 'localstorage',
};
const KNOWN_KINDS = Object.keys(KNOWN);
const TIERS = ['cache_storage', 'indexeddb', 'localstorage'];

console.log('Feature: prefetch-cache-pipeline — storage tier routing property test\n');

// Feature: prefetch-cache-pipeline, Property 4: Storage tier routing
// **Validates: Requirements 4.1, 4.2, 4.3**
try {
  assert(typeof ss.ssStorageTier === 'function',
    'ssStorageTier is not implemented yet (expected by task 7.1)');

  // ── (a) Every known kind maps to its EXACT documented tier. ──
  fc.assert(fc.property(fc.constantFrom.apply(fc, KNOWN_KINDS), (kind) => {
    const tier = ss.ssStorageTier(kind);
    assert(tier === KNOWN[kind],
      `known mapping wrong for ${show(kind)}: got ${show(tier)} expected ${KNOWN[kind]}`);
    return true;
  }), { numRuns: ITER });

  // ── (b) Any unknown / garbage kind → 'localstorage' (smallest/safest tier). ──
  // Broad spread: arbitrary strings, '', null, undefined, numbers, objects,
  // arrays, booleans, symbols — none of which are a known kind.
  const garbageArb = fc.oneof(
    fc.string().filter((s) => !Object.prototype.hasOwnProperty.call(KNOWN, s)),
    fc.constantFrom('', ' ', 'APP_SHELL', 'PageData', 'segments', 'cookie',
      'sessionstorage', 'idb', 'cache', 'unknown', 'localStorage'),
    fc.constantFrom(null, undefined, NaN, 0, 1, -1, Infinity, -Infinity, true, false),
    fc.integer(),
    fc.double(),
    fc.array(fc.anything()),
    fc.object()
  ).filter((v) => !(typeof v === 'string' &&
    Object.prototype.hasOwnProperty.call(KNOWN, v)));

  fc.assert(fc.property(garbageArb, (kind) => {
    const tier = ss.ssStorageTier(kind);
    assert(tier === 'localstorage',
      `unknown/garbage kind must fall back to 'localstorage': got ${show(tier)} for ${show(kind)}`);
    return true;
  }), { numRuns: ITER });

  // ── (c) Totality + determinism over ANY input: always one of the three tiers,
  //        never throws, same input → same output. ──
  const anyArb = fc.oneof(
    fc.constantFrom.apply(fc, KNOWN_KINDS),
    garbageArb
  );
  fc.assert(fc.property(anyArb, (kind) => {
    const a = ss.ssStorageTier(kind);
    const b = ss.ssStorageTier(kind);
    assert(TIERS.indexOf(a) !== -1,
      `result must be one of ${TIERS}: got ${show(a)} for ${show(kind)}`);
    assert(a === b,
      `non-deterministic for ${show(kind)}: ${show(a)} vs ${show(b)}`);
    return true;
  }), { numRuns: ITER });

  // ── Deterministic example rows ──
  // URL-addressable → cache_storage (R4.1)
  assert(ss.ssStorageTier('app_shell') === 'cache_storage', "app_shell → cache_storage");
  assert(ss.ssStorageTier('css') === 'cache_storage', "css → cache_storage");
  assert(ss.ssStorageTier('js') === 'cache_storage', "js → cache_storage");
  assert(ss.ssStorageTier('html') === 'cache_storage', "html → cache_storage");
  assert(ss.ssStorageTier('poster') === 'cache_storage', "poster → cache_storage");
  assert(ss.ssStorageTier('segment') === 'cache_storage', "segment → cache_storage");
  // structured → indexeddb (R4.2)
  assert(ss.ssStorageTier('page_data') === 'indexeddb', "page_data → indexeddb");
  // tiny flags → localstorage (R4.3)
  assert(ss.ssStorageTier('flag') === 'localstorage', "flag → localstorage");
  assert(ss.ssStorageTier('last_uid') === 'localstorage', "last_uid → localstorage");
  assert(ss.ssStorageTier('cache_meta') === 'localstorage', "cache_meta → localstorage");
  // unknown / garbage → localstorage (smallest/safest tier)
  assert(ss.ssStorageTier('nope') === 'localstorage', "unknown string → localstorage");
  assert(ss.ssStorageTier('') === 'localstorage', "empty string → localstorage");
  assert(ss.ssStorageTier(null) === 'localstorage', "null → localstorage");
  assert(ss.ssStorageTier(undefined) === 'localstorage', "undefined → localstorage");
  assert(ss.ssStorageTier(42) === 'localstorage', "number → localstorage");
  assert(ss.ssStorageTier({}) === 'localstorage', "object → localstorage");
  assert(ss.ssStorageTier([]) === 'localstorage', "array → localstorage");
  assert(ss.ssStorageTier(true) === 'localstorage', "boolean → localstorage");
  // case-sensitive: only the exact lowercase kinds are known
  assert(ss.ssStorageTier('APP_SHELL') === 'localstorage', "case-sensitive: APP_SHELL → localstorage");

  console.log('  \u2713 Property 4');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 4\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
