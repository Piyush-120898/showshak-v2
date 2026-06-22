/* ═══════════════════════════════════════════════════════════════
   tests/prop-watch-merge-subscription.test.js — RED-FIRST property test for the
   REDESIGNED Watch It resolver `ssResolveWatchOptions`. Encodes the TARGET
   source-independent subscription marking: an option's `included` flag is true
   IF AND ONLY IF its `platform_id` is in the subscription set; when the
   subscription set is empty/unavailable every option is `included: false` —
   identically for curator-declared and TMDB-sourced options. EXPECTED RED until
   the merge lands.

   Plain Node + fast-check. installDomStub() before requiring shared.js.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

// Feature: watch-it-curator-availability, Property 5: Subscription marking is source-independent
// **Validates: Requirements 6.1, 6.3**

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
const subsGen      = fc.uniqueArray(platformId, { maxLength: 4 }).map((a) => new Set(a));

let failed = 0;
console.log('Feature: watch-it-curator-availability — Property 5 (source-independent subscription marking)\n');

try {
  fc.assert(fc.property(regionGen, tmdbList, declaredList, subsGen, (region, tmdb, declared, subs) => {
    const clip = { providers: { [region]: tmdb }, declaredPlatforms: { [region]: declared } };
    const res  = ss.ssResolveWatchOptions(clip, region, subs);

    assert(res && Array.isArray(res.options), 'result.options must be an array');

    res.options.forEach((o) => {
      const expected = !!(o.platform_id && subs.has(o.platform_id));
      assert(o.included === expected,
        `included must be (platform_id ∈ subs): option ${JSON.stringify(o)} subs ${JSON.stringify([...subs])}`);
      assert(o.sub === (o.included ? 'In your plan' : 'Available to stream'),
        `sub label must track included: ${JSON.stringify(o)}`);
    });

    return true;
  }), { numRuns: ITER });

  // Empty subscription set → every option rendered as a standard (included:false) option.
  fc.assert(fc.property(regionGen, tmdbList, declaredList, (region, tmdb, declared) => {
    const clip = { providers: { [region]: tmdb }, declaredPlatforms: { [region]: declared } };
    const res  = ss.ssResolveWatchOptions(clip, region, new Set());
    res.options.forEach((o) => assert(o.included === false, 'empty subs → all options included:false'));
    return true;
  }), { numRuns: ITER });

  // ── Explicit example: declared platform subscribed is marked In your plan ──
  {
    const clip = { providers: {}, declaredPlatforms: { IN: [{ platform_id: 'p1', name: 'Netflix' }] } };
    const res  = ss.ssResolveWatchOptions(clip, 'IN', new Set(['p1']));
    assert(res.options.length === 1, 'declared-only clip → one option');
    assert(res.options[0].included === true && res.options[0].sub === 'In your plan',
      'subscribed declared platform must be In your plan');
  }

  console.log('  \u2713 Property 5');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 5\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
