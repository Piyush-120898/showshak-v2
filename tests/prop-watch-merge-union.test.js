/* ═══════════════════════════════════════════════════════════════
   tests/prop-watch-merge-union.test.js — RED-FIRST property test for the
   REDESIGNED Watch It resolver `ssResolveWatchOptions(clip, region, subs)`
   in showshak-shared.js.

   This encodes the TARGET merge behaviour (Task 3 will implement it):
   ssResolveWatchOptions builds Merged_Availability = the de-duplicated UNION
   of (a) the region's TMDB providers `clip.providers[region]` and (b) the
   curator-declared platforms `clip.declaredPlatforms[region]`. It is EXPECTED
   to be RED until the merge lands.

   Plain Node + fast-check. installDomStub() runs BEFORE requiring shared.js so
   the module loads in Node; the resolver under test is PURE.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

// Feature: watch-it-curator-availability, Property 1: Merge is a set union (every source platform appears)
// **Validates: Requirements 1.1, 4.1, 4.3, 4.4**

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

/* Same normalisation TMDB matching uses: NFKD-strip diacritics, lowercase, trim. */
function normalizeName(s) {
  return String(s == null ? '' : s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
/* Dedup key for a TMDB source entry. */
function srcKeyTmdb(e) {
  return (e && e.platform_id) ? ('id:' + e.platform_id) : ('nm:' + normalizeName(e && (e.catalog_name || e.provider_name)));
}
/* Dedup key for a curator-declared source entry. */
function srcKeyDeclared(d) {
  return (d && d.platform_id) ? ('id:' + d.platform_id) : ('nm:' + normalizeName(d && d.name));
}
/* Dedup key for a resolved option. */
function optKey(o) {
  return o.platform_id ? ('id:' + o.platform_id) : ('nm:' + normalizeName(o.name));
}

/* ── Generators ──────────────────────────────────────────────── */
const platformId = fc.constantFrom('p1', 'p2', 'p3', 'p4');
const optId      = fc.option(platformId, { nil: undefined });
const colorOpt   = fc.option(fc.constantFrom('#e50914', '#00a8e1', '#113ccf'), { nil: undefined });
const abbrOpt    = fc.option(fc.constantFrom('N', 'P', 'D', 'H'), { nil: undefined });
const nameWord   = fc.constantFrom('Netflix', 'Prime Video', 'Disney+', 'Hotstar', 'JioCinema');

const tmdbEntry = fc.record({
  provider_name: nameWord,
  provider_id:   fc.integer({ min: 1, max: 999 }),
  platform_id:   optId,
  color:         colorOpt,
  abbr:          abbrOpt,
  catalog_name:  fc.option(fc.constantFrom('Netflix', 'Prime', 'Disney Plus'), { nil: undefined }),
});
const declaredEntry = fc.record({
  platform_id: optId,
  name:        fc.constantFrom('Netflix', 'Prime Video', 'Curator Pick', 'Founder Plat', 'Hotstar'),
  color:       fc.option(fc.constantFrom('#ff0080', '#22cc88', '#e50914'), { nil: undefined }),
  abbr:        fc.option(fc.constantFrom('C', 'F', 'N', 'P'), { nil: undefined }),
});

const regionGen   = fc.constantFrom('IN', 'US', 'GB');
const tmdbList     = fc.array(tmdbEntry, { maxLength: 4 });
const declaredList = fc.array(declaredEntry, { maxLength: 4 });
const subsGen      = fc.uniqueArray(platformId, { maxLength: 4 }).map((a) => new Set(a));

let failed = 0;
console.log('Feature: watch-it-curator-availability — Property 1 (merge is a set union)\n');

try {
  fc.assert(fc.property(regionGen, tmdbList, declaredList, subsGen, (region, tmdb, declared, subs) => {
    const clip = { providers: { [region]: tmdb }, declaredPlatforms: { [region]: declared } };
    const res  = ss.ssResolveWatchOptions(clip, region, subs);

    assert(res && Array.isArray(res.options), 'result.options must be an array');

    // Expected key set = union of TMDB source keys and declared source keys.
    const expected = new Set();
    tmdb.forEach((e) => expected.add(srcKeyTmdb(e)));
    declared.forEach((d) => expected.add(srcKeyDeclared(d)));

    const got = new Set(res.options.map(optKey));

    // (a) Every source platform appears (union covers both sources).
    expected.forEach((k) => assert(got.has(k),
      `missing source platform key ${k}; got keys ${JSON.stringify([...got])} for ` +
      `region ${region} tmdb ${JSON.stringify(tmdb)} declared ${JSON.stringify(declared)}`));

    // (b) No option whose key is in neither source.
    got.forEach((k) => assert(expected.has(k),
      `extraneous option key ${k} present in neither source`));

    return true;
  }), { numRuns: ITER });

  // ── Explicit example: one TMDB-only + one declared-only platform both appear ──
  {
    const clip = {
      providers:        { IN: [{ provider_name: 'Netflix', platform_id: 'p1', color: '#e50914', abbr: 'N', catalog_name: 'Netflix' }] },
      declaredPlatforms: { IN: [{ platform_id: 'p2', name: 'Prime Video', color: '#00a8e1', abbr: 'P' }] },
    };
    const res = ss.ssResolveWatchOptions(clip, 'IN', new Set());
    const keys = new Set(res.options.map(optKey));
    assert(keys.has('id:p1') && keys.has('id:p2'), 'both TMDB and declared platforms must appear');
    assert(res.options.length === 2, 'two distinct platforms → two options');
  }

  console.log('  \u2713 Property 1');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 1\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
