/* ═══════════════════════════════════════════════════════════════
   tests/prop-watch-merge-message.test.js — RED-FIRST property test for the
   REDESIGNED Watch It resolver `ssResolveWatchOptions`. Encodes the TARGET
   "never dead-end" message biconditional: the resolver returns a non-empty
   option list with `message === null` whenever the curator declared ≥1 platform
   for the region (regardless of TMDB), and returns `options: []` with the
   neutral "Not available to stream in your region" message IF AND ONLY IF both
   the TMDB providers and the curator-declared platforms are empty for the
   region. EXPECTED RED until the merge lands.

   Plain Node + fast-check. installDomStub() before requiring shared.js.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

// Feature: watch-it-curator-availability, Property 3: Never dead-end; message is exactly the empty-both case
// **Validates: Requirements 1.2, 1.3**

const NEUTRAL = 'Not available to stream in your region';
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
// Lists that can be empty OR non-empty so all four combinations occur.
const tmdbList     = fc.array(tmdbEntry, { maxLength: 3 });
const declaredList = fc.array(declaredEntry, { maxLength: 3 });
const subsGen      = fc.uniqueArray(platformId, { maxLength: 3 }).map((a) => new Set(a));

let failed = 0;
console.log('Feature: watch-it-curator-availability — Property 3 (message biconditional)\n');

try {
  fc.assert(fc.property(regionGen, tmdbList, declaredList, subsGen, (region, tmdb, declared, subs) => {
    // NOTE: no legacy curatorPlat — so "empty" truly means no fallback source.
    const clip = { providers: { [region]: tmdb }, declaredPlatforms: { [region]: declared } };
    const res  = ss.ssResolveWatchOptions(clip, region, subs);

    assert(res && Array.isArray(res.options), 'result.options must be an array');

    const bothEmpty = (tmdb.length === 0 && declared.length === 0);

    // Whenever the curator declared ≥1 platform → non-empty options AND message null.
    if (declared.length >= 1) {
      assert(res.options.length > 0, 'declared ≥1 → options must be non-empty');
      assert(res.message === null, 'declared ≥1 → message must be null');
    }

    // Biconditional: options empty with the neutral message IFF both sources empty.
    const emptyWithMessage = (res.options.length === 0 && res.message === NEUTRAL);
    assert(emptyWithMessage === bothEmpty,
      `biconditional violated: emptyWithMessage=${emptyWithMessage} bothEmpty=${bothEmpty} ` +
      `(tmdb ${tmdb.length}, declared ${declared.length}, message ${JSON.stringify(res.message)})`);

    // When NOT both empty, message must be null and options non-empty.
    if (!bothEmpty) {
      assert(res.options.length > 0 && res.message === null,
        'at least one source present → non-empty options and null message');
    }

    return true;
  }), { numRuns: ITER });

  // ── Explicit examples ──
  // both empty → neutral message
  {
    const res = ss.ssResolveWatchOptions({ providers: { IN: [] }, declaredPlatforms: { IN: [] } }, 'IN', new Set());
    assert(res.options.length === 0 && res.message === NEUTRAL, 'both empty → neutral message');
  }
  // declared only → non-empty, null message
  {
    const res = ss.ssResolveWatchOptions(
      { providers: { IN: [] }, declaredPlatforms: { IN: [{ platform_id: 'p1', name: 'Prime Video' }] } }, 'IN', new Set());
    assert(res.options.length === 1 && res.message === null, 'declared only → non-empty, null message');
  }

  console.log('  \u2713 Property 3');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 3\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
