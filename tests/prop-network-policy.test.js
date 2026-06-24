/* ═══════════════════════════════════════════════════════════════
   tests/prop-network-policy.test.js — Node property test for the
   clip-player-performance network policy
   `ssNetworkPolicy(tier)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-network-policy.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper is PURE (a tier string
   in, a { preloadDepth, maxResolution } object out).

   Semantics: slow → {1,'720p'}, medium → {3,'720p'}, fast → {5,'720p'};
   unknown tier falls back to the medium row. preloadDepth strictly increases
   slow<medium<fast; maxResolution is non-decreasing across the same order
   (720p ceiling everywhere — the low initial-bandwidth seed gives a fast start,
   then ABR climbs up to 720p only when bandwidth is free; see feed-clip-load-performance).
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;
const RES_RANK = { '480p': 1, '720p': 2, '1080p': 3 };

console.log('Feature: clip-player-performance — network policy property test\n');

// Feature: clip-player-performance, Property 3: Network policy is monotonic in tier
// **Validates: Requirements 4.2, 4.3, 4.4, 4.6**
try {
  const anyTier = fc.oneof(
    fc.constantFrom('slow', 'medium', 'fast'),
    fc.string(),
    fc.constantFrom(undefined, null, 'SLOW', 'turbo'),
    fc.object()
  );

  fc.assert(fc.property(anyTier, (tier) => {
    const pol = ss.ssNetworkPolicy(tier);
    assert(pol && typeof pol === 'object', 'policy must be an object');
    assert(typeof pol.preloadDepth === 'number' && pol.preloadDepth >= 1,
      `preloadDepth must be >= 1: got ${pol.preloadDepth}`);
    assert(RES_RANK[pol.maxResolution] !== undefined,
      `maxResolution must be a known value: got ${pol.maxResolution}`);
    // Unknown tier → medium row.
    if (tier !== 'slow' && tier !== 'medium' && tier !== 'fast') {
      assert(pol.preloadDepth === 3 && pol.maxResolution === '720p',
        `unknown tier must fall back to medium: got ${JSON.stringify(pol)}`);
    }
    return true;
  }), { numRuns: ITER });

  // Monotonicity across slow < medium < fast.
  const slow = ss.ssNetworkPolicy('slow');
  const medium = ss.ssNetworkPolicy('medium');
  const fast = ss.ssNetworkPolicy('fast');
  assert(slow.preloadDepth < medium.preloadDepth && medium.preloadDepth < fast.preloadDepth,
    `preloadDepth must strictly increase: ${slow.preloadDepth},${medium.preloadDepth},${fast.preloadDepth}`);
  assert(slow.preloadDepth === 1, `slow preloadDepth must be 1: got ${slow.preloadDepth}`);
  assert(RES_RANK[slow.maxResolution] <= RES_RANK[medium.maxResolution] &&
         RES_RANK[medium.maxResolution] <= RES_RANK[fast.maxResolution],
    `maxResolution must be non-decreasing: ${slow.maxResolution},${medium.maxResolution},${fast.maxResolution}`);

  // Exact rows.
  assert(slow.preloadDepth === 1 && slow.maxResolution === '720p', 'slow row');
  assert(medium.preloadDepth === 3 && medium.maxResolution === '720p', 'medium row');
  assert(fast.preloadDepth === 5 && fast.maxResolution === '720p', 'fast row');

  console.log('  \u2713 Property 3');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 3\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
