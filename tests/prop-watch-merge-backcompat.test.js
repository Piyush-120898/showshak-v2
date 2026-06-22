/* ═══════════════════════════════════════════════════════════════
   tests/prop-watch-merge-backcompat.test.js — RED-FIRST property test for the
   REDESIGNED Watch It resolver `ssResolveWatchOptions`. This is the CRITICAL
   REGRESSION GUARD: for ANY clip with NO curator-declared platforms
   (`declaredPlatforms` empty/absent AND no legacy `curatorPlat`), the merge
   resolver must return EXACTLY the legacy result — the TMDB region providers
   mapped to options when present, otherwise the neutral "Not available" message
   (the merge of "TMDB ∪ ∅" equals "TMDB"). EXPECTED RED until the merge lands,
   and complements `tests/prop-watch-multi.test.js` staying green.

   Plain Node + fast-check. installDomStub() before requiring shared.js.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

// Feature: watch-it-curator-availability, Property 10: Backward compatibility (no declarations ⇒ today's behaviour)
// **Validates: Requirements 1.3, 4.1**

const NEUTRAL_COLOR = 'var(--ss-neutral, #2a2a2a)';
const NEUTRAL_MSG   = 'Not available to stream in your region';
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/* The legacy mapping for a TMDB provider entry — reproduced EXACTLY from the
   existing resolver so this stays a faithful regression guard. NOTE: the legacy
   `name` is `catalog_name || provider_name`, but the legacy `label` first-letter
   is taken from `provider_name` (not the catalog name). The merge MUST preserve
   this exact mapping for TMDB-sourced options. */
function tmdbOption(e, subs) {
  const matched  = !!e.color;
  const included = !!(e.platform_id && subs.has(e.platform_id));
  const name     = e.catalog_name || e.provider_name;
  return {
    name:        name,
    color:       matched ? e.color : NEUTRAL_COLOR,
    label:       e.abbr || (e.provider_name ? String(e.provider_name).charAt(0) : '\u25B6'),
    sub:         included ? 'In your plan' : 'Available to stream',
    included:    included,
    platform_id: e.platform_id || null,
  };
}

/* Legacy oracle: TMDB providers for the region only (no declarations). */
function legacyResolve(clip, region, subs) {
  region = region || 'IN';
  const set = subs || new Set();
  const tmdb = (clip && clip.providers && clip.providers[region]) || [];
  if (tmdb.length) {
    const options = tmdb.map((e) => tmdbOption(e, set));
    options.sort((a, b) => (b.included ? 1 : 0) - (a.included ? 1 : 0));
    return { options: options, fallback: false, message: null };
  }
  return { options: [], fallback: true, message: NEUTRAL_MSG };
}

/* ── Generators ──────────────────────────────────────────────── */
const platformId = fc.constantFrom('p1', 'p2', 'p3', 'p4');
const optId      = fc.option(platformId, { nil: undefined });
const tmdbEntry  = fc.record({
  provider_name: fc.constantFrom('Netflix', 'Prime Video', 'Disney+', 'Hotstar'),
  platform_id:   optId,
  color:         fc.option(fc.constantFrom('#e50914', '#00a8e1', '#113ccf'), { nil: undefined }),
  abbr:          fc.option(fc.constantFrom('N', 'P', 'D', 'H'), { nil: undefined }),
  catalog_name:  fc.option(fc.constantFrom('Netflix', 'Prime', 'Disney Plus'), { nil: undefined }),
});
const regionGen = fc.constantFrom('IN', 'US', 'GB');
const subsGen   = fc.uniqueArray(platformId, { maxLength: 4 }).map((a) => new Set(a));
const regionList = fc.array(tmdbEntry, { maxLength: 4 });

// Clips with NO declarations: declaredPlatforms either absent, or empty per
// region; never a legacy curatorPlat. providers carry data across regions so a
// resolved region may or may not have providers.
const noDeclClip = fc.oneof(
  // declaredPlatforms entirely absent
  fc.record({ providers: fc.record({ IN: regionList, US: regionList, GB: regionList }) }),
  // declaredPlatforms present but EMPTY for every region
  fc.record({
    providers:        fc.record({ IN: regionList, US: regionList, GB: regionList }),
    declaredPlatforms: fc.record({ IN: fc.constant([]), US: fc.constant([]), GB: fc.constant([]) }),
  }),
  // no providers for any region (→ neutral message)
  fc.record({ providers: fc.constant({}), declaredPlatforms: fc.constant({}) })
);

let failed = 0;
console.log('Feature: watch-it-curator-availability — Property 10 (backward compatibility — CRITICAL GUARD)\n');

try {
  fc.assert(fc.property(noDeclClip, regionGen, subsGen, (clip, region, subs) => {
    const got      = ss.ssResolveWatchOptions(clip, region, subs);
    const expected = legacyResolve(clip, region, subs);
    assert(deepEqual(got, expected),
      `no-declaration clip must match legacy result:\n  got      ${JSON.stringify(got)}\n  expected ${JSON.stringify(expected)}\n  clip ${JSON.stringify(clip)} region ${region}`);
    return true;
  }), { numRuns: ITER });

  // ── Explicit examples ──
  // TMDB present, no declarations → branded option, fallback false.
  {
    const clip = { providers: { IN: [{ provider_name: 'Netflix', platform_id: 'p1', color: '#e50914', abbr: 'N', catalog_name: 'Netflix' }] } };
    const got  = ss.ssResolveWatchOptions(clip, 'IN', new Set());
    assert(deepEqual(got, legacyResolve(clip, 'IN', new Set())), 'TMDB-only clip must match legacy');
    assert(got.fallback === false && got.message === null, 'TMDB present → fallback false, null message');
  }
  // No TMDB, no declarations → neutral message.
  {
    const clip = { providers: {}, declaredPlatforms: {} };
    const got  = ss.ssResolveWatchOptions(clip, 'IN', new Set());
    assert(deepEqual(got, { options: [], fallback: true, message: NEUTRAL_MSG }), 'empty clip → neutral message');
  }

  console.log('  \u2713 Property 10');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 10\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
