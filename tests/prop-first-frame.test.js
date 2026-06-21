/* ═══════════════════════════════════════════════════════════════
   tests/prop-first-frame.test.js — Node property test for the
   pwa-black-screen-load first-frame resolution rule (Phase 1).

   Pure helper under test (added to showshak-shared.js in task 5.1):
     - ssResolveFirstFrame(state) → { visibleLayer: 'splash'|'skeleton'|'shell', revealBody: true }

   Plain Node (no framework) + fast-check; run with:
     node tests/prop-first-frame.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (takes a plain object, returns a plain object), so the stub never affects
   behaviour — it only lets the module load and populate module.exports.

   ── First-frame decision rows (from design.md, Phase 1 / Testing Strategy) ──
     visibleLayer = 'splash'    iff standalone && !splashShownThisSession && navType==='cold-launch'
     else         = 'skeleton'  iff page==='feed' && !haveFeedCache        (feed cold open, no cache)
     else         = 'shell'                                                (everything else)
     revealBody   = true        ALWAYS (never a held-black document; no double-skeleton)
     exactly one  visibleLayer ∈ { splash, skeleton, shell }

   This FINALIZED test encodes the expected first-frame behaviour across the
   WHOLE input domain (not just buggy inputs). On the UNFIXED code,
   ssResolveFirstFrame does NOT yet exist, so the calls below throw
   ('ssResolveFirstFrame is not a function') — this test is EXPECTED TO FAIL
   until task 5.1 implements the resolver.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const PAGES = ['feed', 'discover', 'watchlist', 'profile', 'settings', 'stack'];
const NAV_TYPES = ['cold-launch', 'internal-nav', 'bfcache-restore'];
const LAYERS = ['splash', 'skeleton', 'shell'];

// Expected first-frame layer per the design decision rows. The test asserts the
// real resolver matches this reference across the whole input domain.
function expectedLayer(s) {
  if (s.standalone && !s.splashShownThisSession && s.navType === 'cold-launch') return 'splash';
  if (s.page === 'feed' && !s.haveFeedCache) return 'skeleton';
  return 'shell';
}

let failed = 0;

console.log('Feature: pwa-black-screen-load — first-frame resolution property test\n');

// Feature: pwa-black-screen-load, Property 1: Bug Condition — Instant Non-Black First Paint
// **Validates: Requirements 2.1, 2.2, 2.4**
try {
  const stateArb = fc.record({
    navType:                fc.constantFrom(...NAV_TYPES),
    standalone:             fc.boolean(),
    splashShownThisSession: fc.boolean(),
    haveFeedCache:          fc.boolean(),
    page:                   fc.constantFrom(...PAGES),
  });

  // Across the WHOLE input domain: exactly one coherent layer, never held-black,
  // and the layer matches the design decision rows (splash/skeleton/shell).
  fc.assert(fc.property(stateArb, (s) => {
    const frame = ss.ssResolveFirstFrame(s);

    assert(frame && typeof frame === 'object',
      `ssResolveFirstFrame must return an object: got ${typeof frame}`);

    // Never a held-black document — body is always revealed on the first frame.
    assert(frame.revealBody === true,
      `revealBody must always be true (never held black): got ${frame.revealBody} for ${JSON.stringify(s)}`);

    // Exactly one coherent layer (no double-skeleton, no void).
    assert(LAYERS.indexOf(frame.visibleLayer) !== -1,
      `visibleLayer must be exactly one of {splash,skeleton,shell}: got ${frame.visibleLayer} for ${JSON.stringify(s)}`);

    // The selected layer matches the design decision rows.
    assert(frame.visibleLayer === expectedLayer(s),
      `visibleLayer mismatch for ${JSON.stringify(s)}: expected ${expectedLayer(s)}, got ${frame.visibleLayer}`);

    return true;
  }), { numRuns: ITER });

  // ── Exact unit rows from design.md (deterministic anchors) ──

  // splash ONLY when standalone && !splashShownThisSession && navType==='cold-launch'
  assert(ss.ssResolveFirstFrame({ navType: 'cold-launch', standalone: true, splashShownThisSession: false, haveFeedCache: false, page: 'feed' }).visibleLayer === 'splash',
    'standalone cold-launch, splash not yet shown → splash');
  // already shown this session → never splash again (splash once per session)
  assert(ss.ssResolveFirstFrame({ navType: 'cold-launch', standalone: true, splashShownThisSession: true, haveFeedCache: false, page: 'feed' }).visibleLayer !== 'splash',
    'splash already shown this session → not splash again');
  // not standalone → never splash
  assert(ss.ssResolveFirstFrame({ navType: 'cold-launch', standalone: false, splashShownThisSession: false, haveFeedCache: false, page: 'feed' }).visibleLayer !== 'splash',
    'browser tab (not standalone) → not splash');
  // internal-nav → never splash even when standalone & not-yet-shown
  assert(ss.ssResolveFirstFrame({ navType: 'internal-nav', standalone: true, splashShownThisSession: false, haveFeedCache: false, page: 'feed' }).visibleLayer !== 'splash',
    'internal-nav → not splash (splash is cold-launch only)');

  // skeleton on feed cold open with no cache (and not the splash case)
  assert(ss.ssResolveFirstFrame({ navType: 'internal-nav', standalone: false, splashShownThisSession: false, haveFeedCache: false, page: 'feed' }).visibleLayer === 'skeleton',
    'feed, no cache, not splash → skeleton');
  // feed WITH cache → shell (no skeleton — feed-cache instant-mount path)
  assert(ss.ssResolveFirstFrame({ navType: 'internal-nav', standalone: false, splashShownThisSession: false, haveFeedCache: true, page: 'feed' }).visibleLayer === 'shell',
    'feed with cache → shell (instant-mount, no skeleton)');

  // shell otherwise — non-feed pages never get the feed skeleton
  assert(ss.ssResolveFirstFrame({ navType: 'internal-nav', standalone: false, splashShownThisSession: false, haveFeedCache: false, page: 'profile' }).visibleLayer === 'shell',
    'non-feed page, no cache → shell');
  assert(ss.ssResolveFirstFrame({ navType: 'bfcache-restore', standalone: true, splashShownThisSession: true, haveFeedCache: true, page: 'discover' }).visibleLayer === 'shell',
    'bfcache-restore, splash shown, discover → shell');

  // revealBody is true even on the splash row (splash covers the shell but body still revealed)
  assert(ss.ssResolveFirstFrame({ navType: 'cold-launch', standalone: true, splashShownThisSession: false, haveFeedCache: false, page: 'feed' }).revealBody === true,
    'splash row still reveals the body (never held black)');

  console.log('  \u2713 Property 1');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 1\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
