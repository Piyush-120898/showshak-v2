/* ═══════════════════════════════════════════════════════════════
   tests/prop-watch-multi.test.js — Node property test for the
   curator-upload-v2 multi-title Watch It resolver pure helper
   `ssResolveWatchOptionsForTitles(titles, region, subs)` in
   showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-watch-multi.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helpers under test are PURE
   (take arrays/plain objects/Set, return plain arrays/objects), so the stub never
   affects behaviour — it only lets the module load and populate module.exports.

   IMPORTANT — the helpers' EXACT semantics (the oracle here is the single-title
   resolver itself, re-invoked per title):
     ssResolveWatchOptions(clip, region, subs) → { options, fallback, message }
       - region defaults to 'IN' when falsy; subs defaults to new Set() when falsy.
       - (1) region has providers → branded options, In-your-plan sorted first.
       - (2) no region providers but clip.curatorPlat → single curator option, fallback:true.
       - (3) neither → { options:[], fallback:true, message:'Not available ...' }.
       - guards null clip safely.
     ssResolveWatchOptionsForTitles(titles, region, subs)
       - non-array titles → [].
       - else maps EACH title to { title: titles[i], options, fallback, message }
         where options/fallback/message come from ssResolveWatchOptions(titles[i],
         region, subs). KEEPS null/undefined entries. Order preserved.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
// options are plain objects/arrays/strings/bools/null → JSON.stringify is a sound deep-equal.
function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/* ── Generators ──────────────────────────────────────────────── */

// Small pool of platform_id strings (used both for providers and the subs Set).
const platformIdPool = fc.constantFrom('p1', 'p2', 'p3', 'p4');

// A single provider entry; color present/absent (branded vs neutral),
// platform_id present/absent (so it may or may not be In-your-plan).
const providerEntry = fc.record({
  provider_name: fc.constantFrom('Netflix', 'Prime Video', 'Disney+', 'Hotstar'),
  provider_id:   fc.integer({ min: 1, max: 999 }),
  platform_id:   fc.option(platformIdPool, { nil: undefined }),
  color:         fc.option(fc.constantFrom('#e50914', '#00a8e1', '#113ccf'), { nil: undefined }),
  abbr:          fc.option(fc.constantFrom('N', 'P', 'D', 'H'), { nil: undefined }),
  catalog_name:  fc.option(fc.constantFrom('Netflix', 'Prime', 'Disney Plus'), { nil: undefined }),
});

const providerList = fc.array(providerEntry, { maxLength: 4 });

// A curator platform (used in the no-region-providers fallback path).
const curatorPlat = fc.record({
  platform_id: fc.option(platformIdPool, { nil: undefined }),
  name:        fc.constantFrom('Curator Pick', 'Founder Plat', 'House Stream'),
  color:       fc.option(fc.constantFrom('#ff0080', '#22cc88'), { nil: undefined }),
  abbr:        fc.option(fc.constantFrom('C', 'F', 'H'), { nil: undefined }),
});

// title WITH providers — sometimes for the queried region, sometimes only for
// OTHER regions (so the queried region has none → fallback path exercised).
const titleWithProviders = fc.record({
  providers: fc.dictionary(
    fc.constantFrom('IN', 'US', 'GB', 'AU'),
    providerList,
    { minKeys: 1, maxKeys: 3 }
  ),
});

// title WITHOUT region providers but WITH curatorPlat → curator fallback option.
const titleWithCuratorPlat = fc.record({
  providers:   fc.constant({}),
  curatorPlat: curatorPlat,
});

// title with NEITHER → neutral message.
const titleNeither = fc.record({ providers: fc.constant({}) });

// A title-like entry, occasionally null/undefined (kept by the helper).
const titleEntry = fc.oneof(
  { weight: 5, arbitrary: titleWithProviders },
  { weight: 3, arbitrary: titleWithCuratorPlat },
  { weight: 2, arbitrary: titleNeither },
  { weight: 1, arbitrary: fc.constantFrom(null, undefined) }
);

const titlesGen = fc.array(titleEntry, { maxLength: 5 });

// region generator: exercise the default ('' / undefined → 'IN') and a region
// for which a title may have no providers.
const regionGen = fc.constantFrom('IN', 'US', 'GB', '', undefined);

// subs generator: a Set built from a small pool (sometimes empty).
const subsGen = fc.uniqueArray(platformIdPool, { maxLength: 4 }).map((arr) => new Set(arr));

let failed = 0;

console.log('Feature: curator-upload-v2 — multi-title Watch It resolution property test\n');

// Feature: curator-upload-v2, Property 6
// Property 6: Multi-title Watch It resolves each title independently.
// For any list of linked titles, a region, and a subscription set,
// ssResolveWatchOptionsForTitles(titles, region, subs) returns exactly one entry
// per title in order, and each entry's resolution equals
// ssResolveWatchOptions(title, region, subs) for that title alone — including the
// curator-platform fallback when a title has no providers for the region.
// **Validates: Requirements 1.4, 2.4, 2.5, 6.2**
try {
  fc.assert(fc.property(titlesGen, regionGen, subsGen, (titles, region, subs) => {
    const result = ss.ssResolveWatchOptionsForTitles(titles, region, subs);

    // Always an array, exactly one entry per title, in order.
    assert(Array.isArray(result), 'must return an array');
    assert(result.length === titles.length,
      `length mismatch: got ${result.length} expected ${titles.length}`);

    for (let i = 0; i < titles.length; i++) {
      // result[i].title is the SAME reference as titles[i] (incl. null/undefined).
      assert(Object.is(result[i].title, titles[i]),
        `title reference mismatch at ${i}`);

      // The { options, fallback, message } triple deep-equals the single-title
      // resolver invoked with the SAME region and SAME subs instance.
      const expected = ss.ssResolveWatchOptions(titles[i], region, subs);
      const entryTriple = {
        options:  result[i].options,
        fallback: result[i].fallback,
        message:  result[i].message,
      };
      const expectedTriple = {
        options:  expected.options,
        fallback: expected.fallback,
        message:  expected.message,
      };
      assert(deepEqual(entryTriple, expectedTriple),
        `entry ${i} resolution mismatch: got ${JSON.stringify(entryTriple)} ` +
        `expected ${JSON.stringify(expectedTriple)} for title ${JSON.stringify(titles[i])} ` +
        `region ${JSON.stringify(region)}`);
    }

    return true;
  }), { numRuns: ITER });

  // ── Empty / defensive cases (never throw) ──
  assert(deepEqual(ss.ssResolveWatchOptionsForTitles([], 'IN', new Set()), []),
    'empty list must deep-equal []');
  assert(deepEqual(ss.ssResolveWatchOptionsForTitles(null), []),
    'null titles must deep-equal []');
  assert(deepEqual(ss.ssResolveWatchOptionsForTitles(undefined), []),
    'undefined titles must deep-equal []');
  assert(deepEqual(ss.ssResolveWatchOptionsForTitles(42), []),
    'non-array titles must deep-equal []');

  // ── Explicit 2-title example ──
  // t1: Netflix branded provider in IN; t2: no providers + curatorPlat Prime.
  const subs = new Set();
  const t1 = { providers: { IN: [{
    provider_name: 'Netflix', provider_id: 8, platform_id: 'p1',
    color: '#e50914', abbr: 'N', catalog_name: 'Netflix'
  }] } };
  const t2 = { providers: {}, curatorPlat: {
    platform_id: 'p2', name: 'Prime Video', color: '#00a8e1', abbr: 'P'
  } };
  const out = ss.ssResolveWatchOptionsForTitles([t1, t2], 'IN', subs);

  assert(out.length === 2, 'explicit example must return 2 entries');
  assert(out[0].title === t1 && out[1].title === t2, 'explicit example order/reference');

  // result[0] matches single-resolve of t1 (branded Netflix option, no fallback).
  const e1 = ss.ssResolveWatchOptions(t1, 'IN', subs);
  assert(deepEqual(
    { options: out[0].options, fallback: out[0].fallback, message: out[0].message },
    { options: e1.options, fallback: e1.fallback, message: e1.message }
  ), 'explicit t1 resolution mismatch');
  assert(out[0].fallback === false, 't1 should resolve from region providers (no fallback)');

  // result[1] matches single-resolve of t2 (curator fallback Prime, fallback:true).
  const e2 = ss.ssResolveWatchOptions(t2, 'IN', subs);
  assert(deepEqual(
    { options: out[1].options, fallback: out[1].fallback, message: out[1].message },
    { options: e2.options, fallback: e2.fallback, message: e2.message }
  ), 'explicit t2 resolution mismatch');
  assert(out[1].fallback === true, 't2 should resolve via curator-platform fallback');

  console.log('  \u2713 Property 6');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 6\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
