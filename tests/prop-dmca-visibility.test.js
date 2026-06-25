/* ═══════════════════════════════════════════════════════════════
   tests/prop-dmca-visibility.test.js — Node property test for the
   dmca-moderation-scaffolding public-visibility predicate pure helper
   `ssContentPubliclyVisible(content, viewerId)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-dmca-visibility.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (plain object in, boolean out, no side effects), so the stub never affects
   behaviour — it only lets the module load and populate module.exports.

   CONTRACT under test (design.md "Property 4", Req 4.9):
   ssContentPubliclyVisible(content, viewerId) -> boolean
     • returns true IFF content.status === 'live' AND content.deleted_at is unset
       (null or undefined); false otherwise.
     • explicitly false when status === 'removed' OR deleted_at is set.
     • null/undefined/non-object content → false.
     • viewerId is accepted but does NOT affect the result (signature symmetry,
       mirroring the read_live_content RLS policy — the public-surface predicate).
   PURE: always returns a strict boolean, never throws.

   Feature: dmca-moderation-scaffolding, Property 4
   **Validates: Requirements 4.9**
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

/* Independent oracle: the documented contract recomputed from scratch. */
function oracle(content) {
  if (!content || typeof content !== 'object') return false;
  return content.status === 'live' && content.deleted_at == null;
}

let failed = 0;

console.log('Feature: dmca-moderation-scaffolding — public-visibility predicate property test\n');

// ── Generators ───────────────────────────────────────────────────────────────

// status ∈ the real content states plus junk / absent.
const statusValue = fc.oneof(
  fc.constantFrom('processing', 'live', 'removed', 'draft'),   // real states
  fc.constantFrom('Live', 'LIVE', '', 'active', 'published'),  // junk / near-misses
  fc.constantFrom(null, undefined, 0, 1, true)                 // non-string / absent
);

// deleted_at: unset (null/undefined) OR set (timestamp / Date / string).
const deletedAtValue = fc.oneof(
  fc.constantFrom(null, undefined),                            // unset → eligible
  fc.constantFrom(
    0, 1700000000000, '2024-01-01T00:00:00Z', '2023-12-31',    // set (number/string)
  ),
  fc.date().map((d) => d),                                     // set (Date)
  fc.integer({ min: 1, max: 2_000_000_000_000 })               // set (timestamp)
);

// Arbitrary viewerId: string, null, undefined, number.
const viewerIdValue = fc.oneof(
  fc.string(),
  fc.constantFrom(null, undefined),
  fc.integer(),
  fc.constantFrom('user-1', 'anon', '')
);

// A content object with status + deleted_at (+ noise fields), or a non-object.
const contentObj = fc.record({
  status: statusValue,
  deleted_at: deletedAtValue,
  id: fc.constantFrom('clip-1', 'abc', undefined),
  title: fc.constantFrom('x', undefined),
}, { requiredKeys: [] });

const contentArg = fc.oneof(
  { weight: 8, arbitrary: contentObj },
  { weight: 1, arbitrary: fc.constantFrom(null, undefined, 0, '', 'x', 42, true, [], NaN) }
);

try {
  fc.assert(fc.property(contentArg, viewerIdValue, (content, viewerId) => {
    // 1) Never throws (calling inside the property proves this) + strict boolean.
    const r = ss.ssContentPubliclyVisible(content, viewerId);
    assert(r === true || r === false, `must return a strict boolean, got ${typeof r}`);

    // 2) Equals the independent oracle.
    const exp = oracle(content);
    assert(r === exp,
      `result ${r} != oracle ${exp} for ${JSON.stringify(content)}`);

    // 3) Invariant to viewerId — same content + a DIFFERENT viewerId → same result.
    const otherViewer = viewerId === 'OTHER_SENTINEL' ? 'ALT_SENTINEL' : 'OTHER_SENTINEL';
    const r2 = ss.ssContentPubliclyVisible(content, otherViewer);
    assert(r === r2,
      `viewerId must not affect result: ${r} (${String(viewerId)}) != ${r2} (${otherViewer})`);

    // 4) A 'removed' clip is ALWAYS false; a deleted_at-set clip is ALWAYS false.
    if (content && typeof content === 'object') {
      if (content.status === 'removed') assert(r === false, "status 'removed' must be false");
      if (content.deleted_at != null) assert(r === false, 'deleted_at set must be false');
    }

    return true;
  }), { numRuns: ITER });

  // ── Explicit literal cases pinning the contract ──────────────────────────

  // Visible: live + no deleted_at.
  assert(ss.ssContentPubliclyVisible({ status: 'live', deleted_at: null }) === true,
    'live + null deleted_at → true');
  assert(ss.ssContentPubliclyVisible({ status: 'live' }) === true,
    'live + absent deleted_at → true');
  assert(ss.ssContentPubliclyVisible({ status: 'live', deleted_at: undefined }) === true,
    'live + undefined deleted_at → true');

  // Hidden: removed, regardless of deleted_at.
  assert(ss.ssContentPubliclyVisible({ status: 'removed', deleted_at: null }) === false,
    'removed → false');
  assert(ss.ssContentPubliclyVisible({ status: 'removed' }) === false,
    'removed (no deleted_at) → false');

  // Hidden: live but soft-deleted.
  assert(ss.ssContentPubliclyVisible({ status: 'live', deleted_at: '2024-01-01T00:00:00Z' }) === false,
    'live + deleted_at set → false');
  assert(ss.ssContentPubliclyVisible({ status: 'live', deleted_at: 0 }) === false,
    'live + deleted_at=0 (set) → false');

  // Hidden: other statuses.
  assert(ss.ssContentPubliclyVisible({ status: 'processing', deleted_at: null }) === false,
    'processing → false');
  assert(ss.ssContentPubliclyVisible({ status: 'draft', deleted_at: null }) === false,
    'draft → false');

  // Null / non-object → false.
  assert(ss.ssContentPubliclyVisible(null) === false, 'null → false');
  assert(ss.ssContentPubliclyVisible(undefined) === false, 'undefined → false');
  assert(ss.ssContentPubliclyVisible('live') === false, 'string → false');
  assert(ss.ssContentPubliclyVisible(42) === false, 'number → false');

  // viewerId does not change the outcome.
  const live = { status: 'live', deleted_at: null };
  assert(ss.ssContentPubliclyVisible(live, 'a') === ss.ssContentPubliclyVisible(live, 'b'),
    'viewerId invariance on a live clip');
  const removed = { status: 'removed', deleted_at: null };
  assert(ss.ssContentPubliclyVisible(removed, 'a') === ss.ssContentPubliclyVisible(removed, null),
    'viewerId invariance on a removed clip');

  console.log('  \u2713 Property 4');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 4\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
