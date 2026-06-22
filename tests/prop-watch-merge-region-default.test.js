/* ═══════════════════════════════════════════════════════════════
   tests/prop-watch-merge-region-default.test.js — RED-FIRST property test for
   the REDESIGNED Watch It resolver `ssResolveWatchOptions`. Encodes the TARGET
   region default: resolving with a falsy region (null, undefined, or '')
   produces the SAME result as resolving with region 'IN'. EXPECTED RED until
   the merge lands.

   Plain Node + fast-check. installDomStub() before requiring shared.js.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

// Feature: watch-it-curator-availability, Property 8: Region defaults to IN
// **Validates: Requirements 7.2**

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

// Clips carry IN data (plus optional noise in other regions).
const clipGen = fc.record({
  providers: fc.record({
    IN: fc.array(tmdbEntry, { maxLength: 4 }),
    US: fc.array(tmdbEntry, { maxLength: 2 }),
  }),
  declaredPlatforms: fc.record({
    IN: fc.array(declaredEntry, { maxLength: 4 }),
    US: fc.array(declaredEntry, { maxLength: 2 }),
  }),
});
const falsyRegion = fc.constantFrom(null, undefined, '');
const subsGen     = fc.uniqueArray(platformId, { maxLength: 4 }).map((a) => new Set(a));

let failed = 0;
console.log('Feature: watch-it-curator-availability — Property 8 (region defaults to IN)\n');

try {
  fc.assert(fc.property(clipGen, falsyRegion, subsGen, (clip, region, subs) => {
    const withFalsy = ss.ssResolveWatchOptions(clip, region, subs);
    const withIN    = ss.ssResolveWatchOptions(clip, 'IN', subs);
    assert(deepEqual(withFalsy, withIN),
      `falsy region ${JSON.stringify(region)} must equal 'IN' resolution: ` +
      `got ${JSON.stringify(withFalsy)} vs ${JSON.stringify(withIN)}`);
    return true;
  }), { numRuns: ITER });

  // ── Explicit example ──
  {
    const clip = { providers: { IN: [{ provider_name: 'Netflix', platform_id: 'p1', color: '#e50914', abbr: 'N', catalog_name: 'Netflix' }] },
                   declaredPlatforms: { IN: [{ platform_id: 'p2', name: 'Prime Video' }] } };
    const subs = new Set(['p1']);
    assert(deepEqual(ss.ssResolveWatchOptions(clip, null, subs), ss.ssResolveWatchOptions(clip, 'IN', subs)), 'null === IN');
    assert(deepEqual(ss.ssResolveWatchOptions(clip, '', subs), ss.ssResolveWatchOptions(clip, 'IN', subs)), "'' === IN");
    assert(deepEqual(ss.ssResolveWatchOptions(clip, undefined, subs), ss.ssResolveWatchOptions(clip, 'IN', subs)), 'undefined === IN');
  }

  console.log('  \u2713 Property 8');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 8\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
