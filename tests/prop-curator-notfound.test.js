/* ═══════════════════════════════════════════════════════════════
   tests/prop-curator-notfound.test.js — Node property test for the
   public-curator-profile role gate + not-found shape of the PURE helper
   `ssResolveCuratorViewModel(usersRow, contentRows, followerCount)` in
   showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-curator-notfound.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE (takes
   plain objects/arrays, returns a plain view-model), so the stub never affects
   behaviour — it only lets the module load and populate module.exports.

   Helper semantics under test (exact):
     - usersRow null/undefined OR usersRow.role !== 'curator' (strict, case-sensitive)
       → { found:false, profile:null, clips:[], stats:{ followers:0, clips:0 } },
       regardless of the contentRows / followerCount supplied (they are ignored).
     - usersRow.role === 'curator' (with a username) → found === true.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// Assert the exact not-found shape: found=false, profile=null, clips=[] , stats={0,0}.
function assertNotFound(result, ctx) {
  assert(result && typeof result === 'object', `${ctx}: result must be an object`);
  assert(result.found === false, `${ctx}: result.found must be false, got ${result.found}`);
  assert(result.profile === null, `${ctx}: result.profile must be null, got ${JSON.stringify(result.profile)}`);
  assert(Array.isArray(result.clips) && result.clips.length === 0,
    `${ctx}: result.clips must be an empty array, got ${JSON.stringify(result.clips)}`);
  assert(result.stats && result.stats.followers === 0,
    `${ctx}: result.stats.followers must be 0, got ${result.stats && result.stats.followers}`);
  assert(result.stats && result.stats.clips === 0,
    `${ctx}: result.stats.clips must be 0, got ${result.stats && result.stats.clips}`);
}

let failed = 0;

console.log('Feature: public-curator-profile — role gate and not-found shape property test\n');

// Feature: public-curator-profile, Property 3: Existence gate and not-found shape
// **Validates: Requirements 1.4, 8.3, 8.4, 10.1**
//
// NOTE (changed): the resolver no longer gates on usersRow.role. The `role`
// column is not reliably set to 'curator' in practice (sign-up creates
// role='user' and posting a clip never flips it), so gating on it wrongly
// rejected real curators. The resolver's `found` is now an EXISTENCE gate:
// null/undefined (or non-object) → not-found; ANY object row → found=true,
// regardless of role. The "public curator surface" policy (role OR has-clips)
// lives in the page hydrator, not this pure helper.
try {
  // Arbitrary raw content rows — proven to be ignored in the not-found shape.
  const contentRowGen = fc.record({
    id: fc.oneof(fc.string(), fc.integer()),
    status: fc.constantFrom('live', 'draft', 'processing', 'deleted'),
    description: fc.string(),
    creator_id: fc.string(),
  });
  const contentRowsGen = fc.array(contentRowGen, { maxLength: 8 });

  // Arbitrary follower counts — proven to be ignored in the not-found shape.
  const followerCountGen = fc.oneof(
    fc.integer(),
    fc.double(),
    fc.constantFrom(NaN, Infinity, -Infinity, -1, 0, undefined, null),
    fc.string()
  );

  // Arbitrary role strings (incl. 'curator', 'user', '', random) — the resolver
  // is role-AGNOSTIC now, so any object row resolves found=true.
  const anyRole = fc.oneof(
    fc.constantFrom('curator', 'user', 'admin', 'viewer', 'Curator', '', ' curator '),
    fc.string()
  );

  // ── Property A: ONLY null/undefined usersRow → the not-found shape ──
  fc.assert(fc.property(
    fc.constantFrom(null, undefined),
    contentRowsGen,
    followerCountGen,
    (usersRow, contentRows, followerCount) => {
      const result = ss.ssResolveCuratorViewModel(usersRow, contentRows, followerCount);
      assertNotFound(result, `null/undefined row=${JSON.stringify(usersRow)}`);
      return true;
    }
  ), { numRuns: ITER });

  // ── Property B: ANY object row → found === true, regardless of role ──
  fc.assert(fc.property(
    fc.record({
      role: anyRole,
      username: fc.string({ minLength: 1, maxLength: 24 }).filter((s) => s.trim().length > 0),
    }),
    contentRowsGen,
    followerCountGen,
    (usersRow, contentRows, followerCount) => {
      const result = ss.ssResolveCuratorViewModel(usersRow, contentRows, followerCount);
      assert(result.found === true,
        `any object row should resolve found=true regardless of role, got ${result.found} for ${JSON.stringify(usersRow)}`);
      return true;
    }
  ), { numRuns: ITER });

  // ── Explicit examples ──
  // null / undefined → not-found
  assertNotFound(ss.ssResolveCuratorViewModel(null, [{ id: 1, status: 'live' }], 99), 'null');
  assertNotFound(ss.ssResolveCuratorViewModel(undefined, [{ id: 2, status: 'live' }], 5), 'undefined');
  // role 'user' → NOW found (role no longer gates) — this is the real-curator fix
  const userRole = ss.ssResolveCuratorViewModel({ role: 'user', username: 'x' }, [], 0);
  assert(userRole.found === true, "{role:'user'} must now resolve found=true (role-agnostic)");
  // missing role → found
  const noRole = ss.ssResolveCuratorViewModel({ username: 'x' }, [], 0);
  assert(noRole.found === true, "{username:'x'} (no role) must resolve found=true");
  // role 'curator' → found
  const found = ss.ssResolveCuratorViewModel({ role: 'curator', username: 'x' }, [], 0);
  assert(found.found === true, "{role:'curator',username:'x'} must resolve found=true");

  console.log('  \u2713 Property 3');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 3\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
