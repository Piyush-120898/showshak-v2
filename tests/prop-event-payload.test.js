/* ═══════════════════════════════════════════════════════════════
   tests/prop-event-payload.test.js — Node property test for the
   creator-analytics insert-payload builders `ssBuildViewEvent`,
   `ssBuildShareEvent`, and `ssBuildWatchEvent` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-event-payload.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The builders are PURE.

   EXACT semantics: view/share payloads are exactly { content_id, user_id }.
   ssBuildWatchEvent always carries content_id + user_id and includes title_id /
   platform_id / region ONLY when the opt is provided (defined, not null, not '');
   each absent value is omitted entirely — values are never invented.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function keys(o) { return Object.keys(o).sort(); }
function provided(v) { return v !== undefined && v !== null && v !== ''; }

let failed = 0;

console.log('Feature: creator-analytics — event payload builders property test\n');

// Feature: creator-analytics, Property 4
// Property 4: Event payloads carry the clip and resolved viewer, and only
// resolved Watch fields. For any clip id, resolved user id, and Watch It
// selection, the builders always include content_id and the resolved user_id;
// ssBuildWatchEvent includes title_id/platform_id/region exactly when provided
// and omits each absent one, never inventing values.
// **Validates: Requirements 1.1, 2.1, 2.2, 3.1**
try {
  const clipId = fc.string({ minLength: 1, maxLength: 36 });
  const userId = fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 36 }));
  // Each optional Watch field is either "provided" (a non-empty value) or "absent".
  const optField = fc.oneof(
    fc.string({ minLength: 1, maxLength: 12 }),       // provided
    fc.constantFrom(undefined, null, '')              // absent
  );

  // View payload: exactly { content_id, user_id }.
  fc.assert(fc.property(clipId, userId, (cid, uid) => {
    const p = ss.ssBuildViewEvent(cid, uid);
    assert(JSON.stringify(keys(p)) === JSON.stringify(['content_id', 'user_id']),
      `view payload keys = ${JSON.stringify(keys(p))}`);
    assert(p.content_id === cid, 'view content_id mismatch');
    assert(p.user_id === uid, 'view user_id mismatch');
    return true;
  }), { numRuns: ITER });

  // Share payload: exactly { content_id, user_id }.
  fc.assert(fc.property(clipId, userId, (cid, uid) => {
    const p = ss.ssBuildShareEvent(cid, uid);
    assert(JSON.stringify(keys(p)) === JSON.stringify(['content_id', 'user_id']),
      `share payload keys = ${JSON.stringify(keys(p))}`);
    assert(p.content_id === cid, 'share content_id mismatch');
    assert(p.user_id === uid, 'share user_id mismatch');
    return true;
  }), { numRuns: ITER });

  // Watch payload: content_id + user_id always; optional fields iff provided.
  const optsGen = fc.record({ title_id: optField, platform_id: optField, region: optField });
  fc.assert(fc.property(clipId, userId, optsGen, (cid, uid, opts) => {
    const p = ss.ssBuildWatchEvent(cid, uid, opts);

    // Always carries the clip and the resolved viewer.
    assert(p.content_id === cid, 'watch content_id mismatch');
    assert(p.user_id === uid, 'watch user_id mismatch');

    ['title_id', 'platform_id', 'region'].forEach((f) => {
      if (provided(opts[f])) {
        assert(Object.prototype.hasOwnProperty.call(p, f), `expected ${f} present`);
        assert(p[f] === opts[f], `${f} value not preserved`);
      } else {
        assert(!Object.prototype.hasOwnProperty.call(p, f), `expected ${f} omitted (opt=${JSON.stringify(opts[f])})`);
      }
    });

    // Keys are exactly content_id, user_id, plus the provided optional fields —
    // nothing invented.
    const expectedKeys = ['content_id', 'user_id'];
    ['title_id', 'platform_id', 'region'].forEach((f) => { if (provided(opts[f])) expectedKeys.push(f); });
    assert(JSON.stringify(keys(p)) === JSON.stringify(expectedKeys.sort()),
      `watch keys = ${JSON.stringify(keys(p))}, expected ${JSON.stringify(expectedKeys.sort())}`);
    return true;
  }), { numRuns: ITER });

  // Explicit cases.
  assert(JSON.stringify(ss.ssBuildWatchEvent('c', 'u', {})) === JSON.stringify({ content_id: 'c', user_id: 'u' }),
    'empty opts must omit all optional fields');
  assert(JSON.stringify(ss.ssBuildWatchEvent('c', null, { title_id: 't', platform_id: 'p', region: 'IN' })) ===
    JSON.stringify({ content_id: 'c', user_id: null, title_id: 't', platform_id: 'p', region: 'IN' }),
    'all provided opts must be included');
  assert(!Object.prototype.hasOwnProperty.call(ss.ssBuildWatchEvent('c', 'u', { title_id: '' }), 'title_id'),
    'empty-string opt must be omitted');
  // Missing opts argument entirely → just content_id + user_id.
  assert(JSON.stringify(ss.ssBuildWatchEvent('c', 'u')) === JSON.stringify({ content_id: 'c', user_id: 'u' }),
    'missing opts must yield content_id + user_id only');

  console.log('  \u2713 Property 4');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 4\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exitCode = failed ? 1 : 0;
