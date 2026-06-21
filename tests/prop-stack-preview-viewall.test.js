/* ═══════════════════════════════════════════════════════════════
   tests/prop-stack-preview-viewall.test.js — Node property test for the
   stack-folder-view preview rule `ssStackPreviewClips(clips, cap).viewAll` in
   showshak-shared.js. Plain Node + fast-check; run with:
     node tests/prop-stack-preview-viewall.test.js

   Install the shared DOM/window stub (tests/_pbt.js) BEFORE requiring
   showshak-shared.js. The helper is PURE.

   EXACT semantics: viewAll === true IFF clips.length > cap (strictly greater);
   false when clips.length <= cap. Non-array clips → []; non-positive/non-number
   cap → SS_STACK_PREVIEW_CAP.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: stack-folder-view — preview View-All biconditional property test\n');

// Feature: stack-folder-view, Property 1: Preview "View All" biconditional —
// viewAll is true iff clips.length > cap.
// **Validates: Requirements 4.2, 4.3, 10.1, 10.2**
try {
  const clipsGen = fc.array(fc.record({ id: fc.string() }), { maxLength: 40 });
  // caps include 0 and large values; the function clamps non-positive → default.
  const capGen = fc.oneof(fc.integer({ min: 1, max: 30 }), fc.constantFrom(0, -3, NaN, undefined, 1.9));

  fc.assert(fc.property(clipsGen, capGen, (clips, cap) => {
    const r = ss.ssStackPreviewClips(clips, cap);
    const effCap = (typeof cap === 'number' && cap > 0) ? Math.floor(cap) : ss.SS_STACK_PREVIEW_CAP;
    assert(r && typeof r === 'object', 'returns an object');
    assert(r.viewAll === (clips.length > effCap),
      `viewAll mismatch len=${clips.length} cap=${cap} effCap=${effCap} got=${r.viewAll}`);
    return true;
  }), { numRuns: ITER });

  // Non-array clips → [] → never viewAll.
  assert(ss.ssStackPreviewClips(null, 5).viewAll === false, 'null clips → no viewAll');
  assert(ss.ssStackPreviewClips(undefined, 5).viewAll === false, 'undefined clips → no viewAll');
  // Boundary: exactly cap → no tile; cap+1 → tile.
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: 'c' + i }));
  assert(ss.ssStackPreviewClips(mk(12), 12).viewAll === false, '12 with cap 12 → no tile');
  assert(ss.ssStackPreviewClips(mk(13), 12).viewAll === true, '13 with cap 12 → tile');
  // Default cap (12) applies when cap invalid.
  assert(ss.ssStackPreviewClips(mk(13), 0).viewAll === true, 'cap 0 falls back to 12 → tile at 13');
  assert(ss.ssStackPreviewClips(mk(12), 0).viewAll === false, 'cap 0 falls back to 12 → no tile at 12');

  console.log('  \u2713 Property 1');
} catch (e) { failed++; console.log('  \u2717 Property 1\n      ' + e.message); }

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exitCode = failed ? 1 : 0;
