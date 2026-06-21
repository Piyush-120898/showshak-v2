/* ═══════════════════════════════════════════════════════════════
   tests/prop-stack-preview-prefix.test.js — Node property test for the
   stack-folder-view preview rule `ssStackPreviewClips(clips, cap).shown` in
   showshak-shared.js. Plain Node + fast-check; run with:
     node tests/prop-stack-preview-prefix.test.js

   Install the shared DOM/window stub (tests/_pbt.js) BEFORE requiring
   showshak-shared.js. The helper is PURE.

   EXACT semantics: shown === clips.slice(0, min(cap, len)) — an order-preserving
   prefix whose length never exceeds the cap, with no clip dropped from within
   the prefix and none duplicated. Same references (no clone).
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: stack-folder-view — preview prefix property test\n');

// Feature: stack-folder-view, Property 2: Preview shown is the order-preserving
// prefix — shown === clips.slice(0, min(cap, len)).
// **Validates: Requirements 4.1, 4.4, 10.3, 10.4**
try {
  // Unique ids let us detect any drop/dup/reorder.
  const clipsGen = fc.uniqueArray(fc.integer({ min: 0, max: 9999 }), { maxLength: 40 })
    .map(ids => ids.map(n => ({ id: 'c' + n })));
  const capGen = fc.oneof(fc.integer({ min: 1, max: 30 }), fc.constantFrom(0, -2, NaN, undefined));

  fc.assert(fc.property(clipsGen, capGen, (clips, cap) => {
    const r = ss.ssStackPreviewClips(clips, cap);
    const effCap = (typeof cap === 'number' && cap > 0) ? Math.floor(cap) : ss.SS_STACK_PREVIEW_CAP;
    const exp = clips.slice(0, Math.min(effCap, clips.length));
    assert(r.shown.length === exp.length, `length ${r.shown.length} != ${exp.length}`);
    assert(r.shown.length <= effCap, `shown ${r.shown.length} exceeds cap ${effCap}`);
    for (let i = 0; i < exp.length; i++) {
      // Same reference, same order (prefix).
      assert(r.shown[i] === clips[i], `entry ${i} not the same reference / order`);
    }
    // No duplicates within shown.
    const ids = r.shown.map(c => c.id);
    assert(new Set(ids).size === ids.length, 'duplicate clip in shown');
    return true;
  }), { numRuns: ITER });

  assert(ss.ssStackPreviewClips(null, 5).shown.length === 0, 'null clips → []');
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: 'c' + i }));
  assert(ss.ssStackPreviewClips(mk(5), 12).shown.length === 5, 'fewer than cap → all shown');
  assert(ss.ssStackPreviewClips(mk(20), 12).shown.length === 12, 'more than cap → capped');

  console.log('  \u2713 Property 2');
} catch (e) { failed++; console.log('  \u2717 Property 2\n      ' + e.message); }

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exitCode = failed ? 1 : 0;
