/* ═══════════════════════════════════════════════════════════════
   tests/prop-watch-merge-total.test.js — RED-FIRST property test for the
   REDESIGNED Watch It resolver. Encodes the TARGET totality/defensiveness
   invariant: for ANY input — including null/undefined/malformed clip,
   `providers`, `declaredPlatforms`, individual entries, region, or subscription
   set — both `ssResolveWatchOptions` and `ssResolveWatchOptionsForTitles`
   resolve WITHOUT throwing and return a well-formed result
   ({ options, fallback, message }; and an array of such sections of length
   equal to the input titles array, respectively). EXPECTED RED until the merge
   lands.

   Plain Node + fast-check. installDomStub() before requiring shared.js.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

// Feature: watch-it-curator-availability, Property 9: Total and defensive (never throws)
// **Validates: Requirements 4.6**

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function wellFormed(res) {
  return res && typeof res === 'object' &&
    Array.isArray(res.options) &&
    typeof res.fallback === 'boolean' &&
    (res.message === null || typeof res.message === 'string');
}

/* ── Generators of malformed / hostile inputs ─────────────────── */
// A region-keyed dictionary whose values may be junk (non-arrays, nulls, arrays
// of nulls / partial entries / missing platform_id).
const junkEntry = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.constant({}),
  fc.record({ provider_name: fc.string() }),                       // missing platform_id
  fc.record({ platform_id: fc.option(fc.string(), { nil: undefined }), name: fc.option(fc.string(), { nil: undefined }) }),
  fc.anything()
);
const junkList = fc.oneof(
  fc.array(junkEntry, { maxLength: 4 }),
  fc.constant(null),
  fc.constant(undefined),
  fc.constant(42),                                                 // non-array
  fc.string()
);
const junkRegionDict = fc.oneof(
  fc.dictionary(fc.constantFrom('IN', 'US', 'GB', 'xx'), junkList, { maxKeys: 3 }),
  fc.constant(null),
  fc.constant(undefined),
  fc.constant(7),                                                  // non-object
  fc.anything()
);

const junkClip = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.constant({}),
  fc.record({ providers: junkRegionDict }),
  fc.record({ declaredPlatforms: junkRegionDict }),
  fc.record({ providers: junkRegionDict, declaredPlatforms: junkRegionDict }),
  fc.record({ providers: junkRegionDict, declaredPlatforms: junkRegionDict, curatorPlat: fc.anything() }),
  fc.anything()
);
const junkRegion = fc.oneof(fc.constantFrom('IN', 'US', '', null, undefined), fc.integer(), fc.boolean(), fc.object());
const junkSubs   = fc.oneof(
  fc.uniqueArray(fc.string(), { maxLength: 4 }).map((a) => new Set(a)),
  fc.constant(null),
  fc.constant(undefined),
  fc.array(fc.string()),                                           // non-Set
  fc.anything()
);

let failed = 0;
console.log('Feature: watch-it-curator-availability — Property 9 (total and defensive)\n');

try {
  // Single-title resolver never throws and returns a well-formed result.
  fc.assert(fc.property(junkClip, junkRegion, junkSubs, (clip, region, subs) => {
    let res;
    try {
      res = ss.ssResolveWatchOptions(clip, region, subs);
    } catch (e) {
      throw new Error('ssResolveWatchOptions threw on ' +
        JSON.stringify({ clip: '…', region }) + ' : ' + e.message);
    }
    assert(wellFormed(res), 'malformed input must still yield a well-formed result: ' + JSON.stringify(res));
    return true;
  }), { numRuns: ITER });

  // Multi-title wrapper never throws; returns an array of well-formed sections
  // whose length equals the input titles array length (and [] for non-arrays).
  const junkTitles = fc.oneof(
    fc.array(junkClip, { maxLength: 5 }),
    fc.constant(null),
    fc.constant(undefined),
    fc.constant(99),
    fc.anything()
  );
  fc.assert(fc.property(junkTitles, junkRegion, junkSubs, (titles, region, subs) => {
    let res;
    try {
      res = ss.ssResolveWatchOptionsForTitles(titles, region, subs);
    } catch (e) {
      throw new Error('ssResolveWatchOptionsForTitles threw: ' + e.message);
    }
    assert(Array.isArray(res), 'wrapper must always return an array');
    const expectedLen = Array.isArray(titles) ? titles.length : 0;
    assert(res.length === expectedLen, `wrapper length ${res.length} must equal ${expectedLen}`);
    res.forEach((section) => assert(wellFormed(section),
      'each wrapper section must be well-formed: ' + JSON.stringify(section)));
    return true;
  }), { numRuns: ITER });

  // ── Explicit defensive examples ──
  assert(wellFormed(ss.ssResolveWatchOptions(null, null, null)), 'null clip/region/subs');
  assert(wellFormed(ss.ssResolveWatchOptions({ providers: 5, declaredPlatforms: 'x' }, 7, [])), 'non-object providers');
  assert(wellFormed(ss.ssResolveWatchOptions({ providers: { IN: [null, {}] } }, 'IN', new Set())), 'null entries in list');
  assert(Array.isArray(ss.ssResolveWatchOptionsForTitles(null)), 'wrapper null → array');

  console.log('  \u2713 Property 9');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 9\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
