/* ═══════════════════════════════════════════════════════════════
   tests/prop-watch-merge-dedup.test.js — RED-FIRST property test for the
   REDESIGNED Watch It resolver `ssResolveWatchOptions`. Encodes the TARGET
   de-duplication behaviour: a platform present in BOTH the region's TMDB
   providers and the curator-declared platforms (same `platform_id`, or same
   normalized name when ids are absent) yields EXACTLY ONE option, with
   `included` OR-ed across the two sources. EXPECTED RED until the merge lands.

   Plain Node + fast-check. installDomStub() before requiring shared.js.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

// Feature: watch-it-curator-availability, Property 2: De-duplication (a platform in both appears exactly once)
// **Validates: Requirements 4.2**

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function normalizeName(s) {
  return String(s == null ? '' : s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
function optKey(o) { return o.platform_id ? ('id:' + o.platform_id) : ('nm:' + normalizeName(o.name)); }

/* ── Generators ──────────────────────────────────────────────── */
// Shared platform expressed via a stable id and via a stable name (ids absent).
// "Other" entries use a DISJOINT id/name pool so they never collide with the shared key.
const sharedId   = 's1';
const sharedName = 'SharedFlix';
const otherId    = fc.constantFrom('o1', 'o2');
const otherName  = fc.constantFrom('OtherA', 'OtherB');

const otherTmdb = fc.record({
  provider_name: otherName,
  platform_id:   fc.option(otherId, { nil: undefined }),
  color:         fc.option(fc.constantFrom('#111', '#222'), { nil: undefined }),
  abbr:          fc.option(fc.constantFrom('O', 'X'), { nil: undefined }),
});
const otherDeclared = fc.record({
  platform_id: fc.option(otherId, { nil: undefined }),
  name:        otherName,
  color:       fc.option(fc.constantFrom('#333', '#444'), { nil: undefined }),
  abbr:        fc.option(fc.constantFrom('O', 'X'), { nil: undefined }),
});

// subs may or may not contain the shared id (so OR-of-included is exercised).
const subsGen = fc.uniqueArray(fc.constantFrom('s1', 'o1', 'o2'), { maxLength: 3 }).map((a) => new Set(a));

// overlap mode: 'id' (shared via platform_id) or 'name' (shared via normalized name, ids absent)
const overlapMode = fc.constantFrom('id', 'name');

let failed = 0;
console.log('Feature: watch-it-curator-availability — Property 2 (de-duplication)\n');

try {
  fc.assert(fc.property(
    overlapMode,
    fc.array(otherTmdb, { maxLength: 3 }),
    fc.array(otherDeclared, { maxLength: 3 }),
    subsGen,
    (mode, otherT, otherD, subs) => {
      let sharedTmdb, sharedDecl, sharedKey;
      if (mode === 'id') {
        sharedTmdb = { provider_name: sharedName, platform_id: sharedId, color: '#e50914', abbr: 'S', catalog_name: sharedName };
        sharedDecl = { platform_id: sharedId, name: sharedName, color: '#00a8e1', abbr: 'S' };
        sharedKey  = 'id:' + sharedId;
      } else {
        // ids absent → keyed by normalized name; same name in both sources.
        sharedTmdb = { provider_name: sharedName, platform_id: undefined, color: '#e50914', abbr: 'S', catalog_name: sharedName };
        sharedDecl = { platform_id: undefined, name: sharedName, color: '#00a8e1', abbr: 'S' };
        sharedKey  = 'nm:' + normalizeName(sharedName);
      }

      const tmdb     = otherT.concat([sharedTmdb]);
      const declared = [sharedDecl].concat(otherD);
      const clip = { providers: { IN: tmdb }, declaredPlatforms: { IN: declared } };
      const res  = ss.ssResolveWatchOptions(clip, 'IN', subs);

      assert(res && Array.isArray(res.options), 'result.options must be an array');

      // The shared platform appears EXACTLY ONCE.
      const matches = res.options.filter((o) => optKey(o) === sharedKey);
      assert(matches.length === 1,
        `shared platform should appear exactly once, found ${matches.length} (mode ${mode})`);

      // included is the OR of both sources' subscription state.
      const tIncluded = !!(sharedTmdb.platform_id && subs.has(sharedTmdb.platform_id));
      const dIncluded = !!(sharedDecl.platform_id && subs.has(sharedDecl.platform_id));
      assert(matches[0].included === (tIncluded || dIncluded),
        `merged option.included must be OR of sources (mode ${mode}); ` +
        `got ${matches[0].included} expected ${tIncluded || dIncluded}`);

      // Overall: number of options equals the number of distinct keys (no dup survives).
      const distinct = new Set(res.options.map(optKey));
      assert(distinct.size === res.options.length, 'no duplicate option keys may survive');

      return true;
    }
  ), { numRuns: ITER });

  // ── Explicit example: same platform_id in both sources → one option, subscribed ──
  {
    const clip = {
      providers:        { IN: [{ provider_name: 'Netflix', platform_id: 'p1', color: '#e50914', abbr: 'N', catalog_name: 'Netflix' }] },
      declaredPlatforms: { IN: [{ platform_id: 'p1', name: 'Netflix', color: '#e50914', abbr: 'N' }] },
    };
    const res = ss.ssResolveWatchOptions(clip, 'IN', new Set(['p1']));
    assert(res.options.length === 1, 'shared id → exactly one option');
    assert(res.options[0].included === true, 'subscribed shared platform must be included');
  }

  console.log('  \u2713 Property 2');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 2\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
