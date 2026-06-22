/* ═══════════════════════════════════════════════════════════════
   tests/prop-watch-merge-multititle.test.js — RED-FIRST property test for the
   REDESIGNED Watch It resolver wrapper `ssResolveWatchOptionsForTitles`. Encodes
   the TARGET multi-title independence: for any array of title-like inputs
   (each carrying merge-shaped `providers` + `declaredPlatforms`), the wrapper
   returns one section per input title in input order, where each section's
   { options, fallback, message } DEEP-EQUALS
   ssResolveWatchOptions(titles[i], region, subs). The wrapper inherits the merge
   per title. EXPECTED RED until the merge lands.

   Plain Node + fast-check. installDomStub() before requiring shared.js.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

// Feature: watch-it-curator-availability, Property 11: Multi-title wrapper resolves each title independently, in order
// **Validates: Requirements 4.5**

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/* ── Generators ──────────────────────────────────────────────── */
const platformId = fc.constantFrom('p1', 'p2', 'p3', 'p4');
const optId      = fc.option(platformId, { nil: undefined });

const tmdbEntry = fc.record({
  provider_name: fc.constantFrom('Netflix', 'Prime Video', 'Disney+', 'Hotstar'),
  platform_id:   optId,
  color:         fc.option(fc.constantFrom('#e50914', '#00a8e1'), { nil: undefined }),
  abbr:          fc.option(fc.constantFrom('N', 'P', 'D'), { nil: undefined }),
  catalog_name:  fc.option(fc.constantFrom('Netflix', 'Prime'), { nil: undefined }),
});
const declaredEntry = fc.record({
  platform_id: optId,
  name:        fc.constantFrom('Netflix', 'Curator Pick', 'Founder Plat', 'Hotstar'),
  color:       fc.option(fc.constantFrom('#ff0080', '#22cc88'), { nil: undefined }),
  abbr:        fc.option(fc.constantFrom('C', 'F'), { nil: undefined }),
});

// A merge-shaped title; sometimes null/undefined (kept by the wrapper).
const titleEntry = fc.oneof(
  { weight: 5, arbitrary: fc.record({
      providers:        fc.dictionary(fc.constantFrom('IN', 'US', 'GB'), fc.array(tmdbEntry, { maxLength: 3 }), { maxKeys: 2 }),
      declaredPlatforms: fc.dictionary(fc.constantFrom('IN', 'US', 'GB'), fc.array(declaredEntry, { maxLength: 3 }), { maxKeys: 2 }),
    }) },
  { weight: 2, arbitrary: fc.record({ providers: fc.constant({}), declaredPlatforms: fc.constant({}) }) },
  { weight: 1, arbitrary: fc.constantFrom(null, undefined) }
);

const titlesGen = fc.array(titleEntry, { maxLength: 5 });
const regionGen = fc.constantFrom('IN', 'US', 'GB', '', undefined);
const subsGen   = fc.uniqueArray(platformId, { maxLength: 4 }).map((a) => new Set(a));

let failed = 0;
console.log('Feature: watch-it-curator-availability — Property 11 (multi-title independence)\n');

try {
  fc.assert(fc.property(titlesGen, regionGen, subsGen, (titles, region, subs) => {
    const result = ss.ssResolveWatchOptionsForTitles(titles, region, subs);

    assert(Array.isArray(result), 'wrapper must return an array');
    assert(result.length === titles.length,
      `one section per title in order: got ${result.length} expected ${titles.length}`);

    for (let i = 0; i < titles.length; i++) {
      // same reference, same position.
      assert(Object.is(result[i].title, titles[i]), `title reference/order mismatch at ${i}`);

      const single = ss.ssResolveWatchOptions(titles[i], region, subs);
      const got      = { options: result[i].options, fallback: result[i].fallback, message: result[i].message };
      const expected = { options: single.options, fallback: single.fallback, message: single.message };
      assert(deepEqual(got, expected),
        `section ${i} must deep-equal single-title resolution: got ${JSON.stringify(got)} expected ${JSON.stringify(expected)}`);
    }

    return true;
  }), { numRuns: ITER });

  // ── Defensive cases ──
  assert(deepEqual(ss.ssResolveWatchOptionsForTitles([], 'IN', new Set()), []), 'empty list → []');
  assert(deepEqual(ss.ssResolveWatchOptionsForTitles(null), []), 'null titles → []');
  assert(deepEqual(ss.ssResolveWatchOptionsForTitles(42), []), 'non-array titles → []');

  // ── Explicit 2-title example: one TMDB-only, one declared-only ──
  {
    const t1 = { providers: { IN: [{ provider_name: 'Netflix', platform_id: 'p1', color: '#e50914', abbr: 'N', catalog_name: 'Netflix' }] }, declaredPlatforms: {} };
    const t2 = { providers: {}, declaredPlatforms: { IN: [{ platform_id: 'p2', name: 'Prime Video' }] } };
    const subs = new Set();
    const out  = ss.ssResolveWatchOptionsForTitles([t1, t2], 'IN', subs);
    assert(out.length === 2 && out[0].title === t1 && out[1].title === t2, 'order/reference preserved');
    for (const [i, t] of [[0, t1], [1, t2]]) {
      const s = ss.ssResolveWatchOptions(t, 'IN', subs);
      assert(deepEqual({ options: out[i].options, fallback: out[i].fallback, message: out[i].message },
                       { options: s.options, fallback: s.fallback, message: s.message }),
        `explicit section ${i} mismatch`);
    }
  }

  console.log('  \u2713 Property 11');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 11\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
