/* ═══════════════════════════════════════════════════════════════
   tests/prop-curator-admin-actor.test.js — Node property test for the
   curator-application-approval Admin_Authorizer pure helper
   `ssIsAdminActor({ is_admin })` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-curator-admin-actor.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE, so the
   stub never affects behaviour — it only lets the module load.

   CONTRACT under test (design.md "Property 4", Req 13.2, 13.5, 13.6):
   ssIsAdminActor(actor) -> boolean returns strict `true` IFF
   actor.is_admin === true (STRICT boolean); `false` for EVERY other value —
   absent, null, 'true', 1, or any non-strict-true value — and for a
   null/undefined/non-object actor. Deterministic; never throws. This decides
   UI/UX only; the database ss_is_admin() gate is the real security boundary.

   Feature: curator-application-approval, Property 4
   **Validates: Requirements 13.2, 13.5, 13.6**
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// Independent oracle: authorized IFF a plain object with is_admin strictly true.
function expectedAuth(actor) {
  return !!actor && typeof actor === 'object' && actor.is_admin === true;
}

let failed = 0;

console.log('Feature: curator-application-approval — admin authorizer property test\n');

// is_admin values: strict true plus every kind of near-miss / junk.
const isAdminValue = fc.constantFrom(true, false, 'true', 'false', 1, 0, null, undefined, 'yes', {}, []);

const actorObj = fc.record({ is_admin: isAdminValue }, { requiredKeys: [] });

const actorArg = fc.oneof(
  { weight: 8, arbitrary: actorObj },
  { weight: 1, arbitrary: fc.constantFrom(null, undefined, 0, '', 'x', 42, true, []) }
);

try {
  fc.assert(fc.property(actorArg, (actor) => {
    // 1) Never throws + strict boolean.
    const r = ss.ssIsAdminActor(actor);
    assert(r === true || r === false, `must return a strict boolean, got ${JSON.stringify(r)}`);

    // 2) Matches the oracle exactly.
    assert(r === expectedAuth(actor),
      `isAdminActor(${JSON.stringify(actor)}) = ${r}, expected ${expectedAuth(actor)}`);

    // 3) true ONLY for strict-boolean-true is_admin.
    const isObj = actor && typeof actor === 'object' && !Array.isArray(actor);
    if (r === true) {
      assert(isObj && actor.is_admin === true, `authorized without strict-true is_admin: ${JSON.stringify(actor)}`);
    }

    // 4) Determinism.
    assert(ss.ssIsAdminActor(actor) === r, 'must be deterministic');
    return true;
  }), { numRuns: ITER });

  // ── Explicit contract pins ────────────────────────────────────────────────
  assert(ss.ssIsAdminActor({ is_admin: true }) === true, 'is_admin:true → authorized');
  assert(ss.ssIsAdminActor({ is_admin: false }) === false, 'is_admin:false → not');
  assert(ss.ssIsAdminActor({ is_admin: 'true' }) === false, "is_admin:'true' → not");
  assert(ss.ssIsAdminActor({ is_admin: 1 }) === false, 'is_admin:1 → not');
  assert(ss.ssIsAdminActor({ is_admin: 0 }) === false, 'is_admin:0 → not');
  assert(ss.ssIsAdminActor({}) === false, 'absent is_admin → not');
  assert(ss.ssIsAdminActor({ role: 'curator' }) === false, 'unrelated fields → not');
  assert(ss.ssIsAdminActor(null) === false, 'null → not');
  assert(ss.ssIsAdminActor(undefined) === false, 'undefined → not');
  assert(ss.ssIsAdminActor('true') === false, 'string → not');
  assert(ss.ssIsAdminActor(1) === false, 'number → not');

  console.log('  \u2713 Property 4');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 4\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
