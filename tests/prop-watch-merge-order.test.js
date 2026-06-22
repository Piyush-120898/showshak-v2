/* ═══════════════════════════════════════════════════════════════
   tests/prop-watch-merge-order.test.js — RED-FIRST property test for the
   REDESIGNED Watch It resolver `ssResolveWatchOptions`. Encodes the TARGET
   In_Your_Plan ordering invariant: in the resolved option list, no option with
   `included: false` precedes an option with `included: true`, regardless of
   whether each option is TMDB-sourced or curator-declared. EXPECTED RED until
   the merge lands.

   Plain Node + fast-check. installDomStub() before requiring shared.js.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

// Feature: watch-it-curator-availability, Property 6: In_Your_Plan options are ordered first
// **Validates: Requirements 6.2**

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

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

const regionGen    = fc.constantFrom('IN', 'US', 'GB');
const tmdbList     = fc.array(tmdbEntry, { maxLength: 4 });
const declaredList = fc.array(declaredEntry, { maxLength: 4 });
// subs deliberately drawn from the same pool so some options ARE included.
const subsGen      = fc.uniqueArray(platformId, { maxLength: 4 }).map((a) => new Set(a));

let failed = 0;
console.log('Feature: watch-it-curator-availability — Property 6 (In_Your_Plan ordering)\n');

try {
  fc.assert(fc.property(regionGen, tmdbList, declaredList, subsGen, (region, tmdb, declared, subs) => {
    const clip = { providers: { [region]: tmdb }, declaredPlatforms: { [region]: declared } };
    const res  = ss.ssResolveWatchOptions(clip, region, subs);

    assert(res && Array.isArray(res.options), 'result.options must be an array');

    // Once we have seen an included:false option, no later option may be included:true.
    let seenExcluded = false;
    for (let i = 0; i < res.options.length; i++) {
      if (!res.options[i].included) { seenExcluded = true; continue; }
      assert(!seenExcluded,
        `included:true option at index ${i} follows an included:false option — ordering violated: ` +
        JSON.stringify(res.options.map((o) => o.included)));
    }

    return true;
  }), { numRuns: ITER });

  // ── Explicit example: one subscribed declared + one unsubscribed TMDB → subscribed first ──
  {
    const clip = {
      providers:        { IN: [{ provider_name: 'Prime Video', platform_id: 'p2', color: '#00a8e1', abbr: 'P', catalog_name: 'Prime' }] },
      declaredPlatforms: { IN: [{ platform_id: 'p1', name: 'Netflix', color: '#e50914', abbr: 'N' }] },
    };
    const res = ss.ssResolveWatchOptions(clip, 'IN', new Set(['p1']));
    assert(res.options.length === 2, 'two distinct options');
    assert(res.options[0].included === true, 'subscribed option must be ordered first');
  }

  console.log('  \u2713 Property 6');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 6\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
