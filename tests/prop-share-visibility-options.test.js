/* ═══════════════════════════════════════════════════════════════
   tests/prop-share-visibility-options.test.js — Node property test for the
   stack-folder-view share rule `ssShareVisibilityOptions(role, currentVisibility)`
   in showshak-shared.js. Plain Node + fast-check; run with:
     node tests/prop-share-visibility-options.test.js

   Install the shared DOM/window stub (tests/_pbt.js) BEFORE requiring
   showshak-shared.js. The helper is PURE.

   EXACT semantics: curator → exactly ['private','unlisted','public']; anyone
   else → exactly ['private','unlisted']. public present IFF curator. The set
   never changes with currentVisibility.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: stack-folder-view — share visibility options property test\n');

// Feature: stack-folder-view, Property 4: Share options are role-gated and
// independent of current visibility.
// **Validates: Requirements 8.3, 8.4, 12.1, 12.2, 12.3, 12.4**
try {
  const roleGen = fc.oneof(
    fc.constantFrom('curator', true),                         // curator signals
    fc.constantFrom('user', 'guest', '', null, undefined, false, 'CURATOR', 'admin') // non-curator
  );
  const visGen = fc.constantFrom('private', 'unlisted', 'public', 'friends', '', undefined, 'junk');

  fc.assert(fc.property(roleGen, visGen, (role, vis) => {
    const opts = ss.ssShareVisibilityOptions(role, vis);
    const isCurator = (role === 'curator') || (role === true);
    const exp = isCurator ? ['private', 'unlisted', 'public'] : ['private', 'unlisted'];
    assert(JSON.stringify(opts) === JSON.stringify(exp),
      `opts mismatch role=${String(role)} got=${JSON.stringify(opts)} exp=${JSON.stringify(exp)}`);
    // public present iff curator.
    assert((opts.indexOf('public') !== -1) === isCurator, 'public gating wrong');
    // private + unlisted always present.
    assert(opts.indexOf('private') !== -1 && opts.indexOf('unlisted') !== -1, 'missing base options');
    return true;
  }), { numRuns: ITER });

  // currentVisibility never widens the set.
  const a = ss.ssShareVisibilityOptions('user', 'public');
  const b = ss.ssShareVisibilityOptions('user', 'private');
  assert(JSON.stringify(a) === JSON.stringify(b), 'currentVisibility changed the set');
  assert(a.indexOf('public') === -1, 'normal user must never get public even when current is public');
  assert(JSON.stringify(ss.ssShareVisibilityOptions('curator')) === JSON.stringify(['private', 'unlisted', 'public']),
    'curator full set with no currentVisibility');

  console.log('  \u2713 Property 4');
} catch (e) { failed++; console.log('  \u2717 Property 4\n      ' + e.message); }

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exitCode = failed ? 1 : 0;
