/* ═══════════════════════════════════════════════════════════════
   tests/prop-stack-contributors.test.js — Node property test for the
   stack-folder-view header attribution rule `ssStackContributors(owner, members)`
   in showshak-shared.js. Plain Node + fast-check; run with:
     node tests/prop-stack-contributors.test.js

   Install the shared DOM/window stub (tests/_pbt.js) BEFORE requiring
   showshak-shared.js. The helper is PURE.

   EXACT semantics: owner FIRST, then the other members in their given order,
   each identity at most once (owner never duplicated even if present in
   members). No non-owner member → [owner]. Identity key = user_id || id ||
   username.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function keyOf(x) {
  if (x == null) return null;
  if (typeof x === 'string') { const s = x.replace(/^@/, '').trim(); return s || null; }
  return String(x.user_id || x.id || x.username);
}

let failed = 0;

console.log('Feature: stack-folder-view — contributors attribution property test\n');

// Feature: stack-folder-view, Property 3: Contributors are owner-first,
// de-duplicated, order-preserving.
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 11.1, 11.2, 11.3, 11.4**
try {
  const idGen = fc.integer({ min: 1, max: 8 }).map(n => 'u' + n);
  const memberGen = fc.record({ user_id: idGen, role: fc.constantFrom('member', 'owner'), username: idGen });
  const ownerGen = fc.record({ user_id: idGen, role: fc.constant('owner'), username: idGen });

  fc.assert(fc.property(ownerGen, fc.array(memberGen, { maxLength: 12 }), (owner, members) => {
    const out = ss.ssStackContributors(owner, members);
    assert(Array.isArray(out) && out.length >= 1, 'returns a non-empty array');
    // Owner first.
    assert(out[0].id === keyOf(owner), 'owner is not first');
    // De-duplicated.
    const keys = out.map(o => o.id);
    assert(new Set(keys).size === keys.length, 'duplicate identity in output');
    // Every output identity comes from owner or members.
    const allowed = new Set([keyOf(owner)].concat(members.map(keyOf)));
    keys.forEach(k => assert(allowed.has(k), 'unknown identity leaked in: ' + k));
    // Non-owner members appear in their original relative order (first occurrence).
    const expectedTail = [];
    const seen = new Set([keyOf(owner)]);
    members.forEach(m => { const k = keyOf(m); if (!seen.has(k)) { seen.add(k); expectedTail.push(k); } });
    assert(JSON.stringify(keys.slice(1)) === JSON.stringify(expectedTail),
      `tail order mismatch got=${JSON.stringify(keys.slice(1))} exp=${JSON.stringify(expectedTail)}`);
    return true;
  }), { numRuns: ITER });

  // View-only (no members) → just the creator.
  const o = { user_id: 'owner1', username: 'owner1', role: 'owner' };
  assert(JSON.stringify(ss.ssStackContributors(o, []).map(x => x.id)) === JSON.stringify(['owner1']),
    'no members → [owner]');
  // Owner present in members (the RPC includes the owner row) → not duplicated.
  const withOwnerRow = ss.ssStackContributors(o, [{ user_id: 'owner1', role: 'owner', username: 'owner1' }, { user_id: 'm2', role: 'member', username: 'm2' }]);
  assert(JSON.stringify(withOwnerRow.map(x => x.id)) === JSON.stringify(['owner1', 'm2']), 'owner-in-members deduped');
  // Bare-string owner/handle works.
  assert(ss.ssStackContributors('@alice', []).length === 1, 'bare handle owner → 1');

  console.log('  \u2713 Property 3');
} catch (e) { failed++; console.log('  \u2717 Property 3\n      ' + e.message); }

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exitCode = failed ? 1 : 0;
