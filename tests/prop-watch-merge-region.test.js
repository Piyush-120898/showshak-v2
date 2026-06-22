/* ═══════════════════════════════════════════════════════════════
   tests/prop-watch-merge-region.test.js — RED-FIRST property test for the
   REDESIGNED Watch It resolver `ssResolveWatchOptions`. Encodes the TARGET
   region-scoping invariant: for a clip carrying TMDB providers and
   curator-declared platforms across multiple regions, resolving for region R
   produces options derived ONLY from R's TMDB providers and R's declared
   platforms — no platform unique to another region appears. EXPECTED RED until
   the merge lands.

   Plain Node + fast-check. installDomStub() before requiring shared.js.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

// Feature: watch-it-curator-availability, Property 7: Region-scoped resolution
// **Validates: Requirements 7.1**

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function normalizeName(s) {
  return String(s == null ? '' : s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
function srcKeyTmdb(e) { return (e && e.platform_id) ? ('id:' + e.platform_id) : ('nm:' + normalizeName(e && (e.catalog_name || e.provider_name))); }
function srcKeyDeclared(d) { return (d && d.platform_id) ? ('id:' + d.platform_id) : ('nm:' + normalizeName(d && d.name)); }
function optKey(o) { return o.platform_id ? ('id:' + o.platform_id) : ('nm:' + normalizeName(o.name)); }

/* ── Generators ──────────────────────────────────────────────── */
const REGIONS = ['IN', 'US', 'GB'];
// Region-specific platform ids so platforms are DISJOINT across regions
// (lets us prove a platform unique to another region never appears).
function regionTmdb(region) {
  return fc.array(fc.record({
    provider_name: fc.constantFrom('Netflix', 'Prime Video', 'Disney+'),
    platform_id:   fc.constantFrom(region + '-t1', region + '-t2'),
    color:         fc.option(fc.constantFrom('#e50914', '#00a8e1'), { nil: undefined }),
    abbr:          fc.option(fc.constantFrom('N', 'P', 'D'), { nil: undefined }),
    catalog_name:  fc.option(fc.constantFrom('Netflix', 'Prime'), { nil: undefined }),
  }), { maxLength: 3 });
}
function regionDeclared(region) {
  return fc.array(fc.record({
    platform_id: fc.constantFrom(region + '-d1', region + '-d2'),
    name:        fc.constantFrom('Curator Pick', 'Founder Plat', 'Hotstar'),
    color:       fc.option(fc.constantFrom('#ff0080', '#22cc88'), { nil: undefined }),
    abbr:        fc.option(fc.constantFrom('C', 'F', 'H'), { nil: undefined }),
  }), { maxLength: 3 });
}

const clipGen = fc.record({
  providers: fc.record({ IN: regionTmdb('IN'), US: regionTmdb('US'), GB: regionTmdb('GB') }),
  declaredPlatforms: fc.record({ IN: regionDeclared('IN'), US: regionDeclared('US'), GB: regionDeclared('GB') }),
});
const regionGen = fc.constantFrom(...REGIONS);
const subsGen   = fc.uniqueArray(
  fc.constantFrom('IN-t1', 'IN-d1', 'US-t1', 'US-d1', 'GB-t1', 'GB-d1'), { maxLength: 4 }
).map((a) => new Set(a));

let failed = 0;
console.log('Feature: watch-it-curator-availability — Property 7 (region scoping)\n');

try {
  fc.assert(fc.property(clipGen, regionGen, subsGen, (clip, region, subs) => {
    const res = ss.ssResolveWatchOptions(clip, region, subs);
    assert(res && Array.isArray(res.options), 'result.options must be an array');

    // Allowed keys = keys of R's TMDB providers ∪ R's declared platforms.
    const allowed = new Set();
    (clip.providers[region] || []).forEach((e) => allowed.add(srcKeyTmdb(e)));
    (clip.declaredPlatforms[region] || []).forEach((d) => allowed.add(srcKeyDeclared(d)));

    // No option may originate from a region other than R.
    res.options.forEach((o) => assert(allowed.has(optKey(o)),
      `option key ${optKey(o)} not scoped to region ${region}; allowed ${JSON.stringify([...allowed])}`));

    return true;
  }), { numRuns: ITER });

  // ── Explicit example: US-only platform must not appear when resolving IN ──
  {
    const clip = {
      providers:        { IN: [{ provider_name: 'Netflix', platform_id: 'IN-t1', catalog_name: 'Netflix' }],
                          US: [{ provider_name: 'Hulu', platform_id: 'US-t1', catalog_name: 'Hulu' }] },
      declaredPlatforms: { IN: [], US: [{ platform_id: 'US-d1', name: 'HBO Max' }] },
    };
    const res  = ss.ssResolveWatchOptions(clip, 'IN', new Set());
    const keys = new Set(res.options.map(optKey));
    assert(keys.has('id:IN-t1'), 'IN platform must appear');
    assert(!keys.has('id:US-t1') && !keys.has('id:US-d1'), 'US-only platforms must not appear in IN');
  }

  console.log('  \u2713 Property 7');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 7\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
