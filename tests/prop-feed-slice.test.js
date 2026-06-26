/* ═══════════════════════════════════════════════════════════════
   tests/prop-feed-slice.test.js — Node property test for the feed-follows
   pure pagination slice `ssSliceRankedPage(rankedIds, limit, offset)` in
   showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-feed-slice.test.js
   (auto-discovered by `node tests/run-all.js`).

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The function under test is PURE.

   TDD NOTE (red-first): `ssSliceRankedPage` does NOT exist yet — it lands in
   task 2. This file is EXPECTED to be RED until then. The missing function is
   reported as a clean assertion failure (not a crash), so the red result is
   meaningful.

   PROPERTY 13 — Pagination slice is contiguous, complete, and edge-safe.
   For any ranked id list and any limit/offset, ssSliceRankedPage:
     - returns the contiguous slice rankedIds[offset .. offset+limit) of length
       at most `limit` (Req 6.1);
     - concatenating consecutive pages at offsets 0, limit, 2·limit, …
       reproduces rankedIds EXACTLY — no id duplicated, none skipped, order
       preserved (Req 6.2, 6.3);
     - offset >= rankedIds.length ⇒ empty page (Req 6.5);
     - non-positive limit (0 or negative) OR negative offset ⇒ empty page, no
       throw (Req 6.6);
     - non-array rankedIds ⇒ empty page (defensive).
═══════════════════════════════════════════════════════════════ */
// Feature: feed-follows, Property 13: Pagination slice is contiguous, complete, and edge-safe
// **Validates: Requirements 6.1, 6.2, 6.3, 6.5, 6.6**
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function show(v) {
  try {
    if (v !== null && typeof v === 'object') return JSON.stringify(v);
    return String(v);
  } catch (_) { return Object.prototype.toString.call(v); }
}

let failed = 0;
function prop(name, fn) {
  try { fn(); console.log('  \u2713 ' + name); }
  catch (e) { failed++; console.log('  \u2717 ' + name + '\n      ' + e.message); }
}

console.log('Feature: feed-follows — Property 13: pagination slice is contiguous, complete, and edge-safe\n');

/* ── Generators ──
   Ranked lists of UNIQUE string ids of various lengths (incl. 0 and large), so
   "no duplicate / no skip" is observable directly. */
const idGen = fc.hexaString({ minLength: 1, maxLength: 10 });
const rankedIdsGen = fc.oneof(
  fc.constant([]),
  fc.uniqueArray(idGen, { maxLength: 1 }),
  fc.uniqueArray(idGen, { maxLength: 400 })
);

// valid pagination args for the slice-correctness property.
const limitGen = fc.integer({ min: 1, max: 60 });
const offsetGen = fc.integer({ min: 0, max: 500 });

/* ── The properties ── */
if (typeof ss.ssSliceRankedPage !== 'function') {
  // Red-first: ssSliceRankedPage lands in task 2. Report a clean assertion failure.
  failed++;
  console.log('  \u2717 Property 13: Pagination slice is contiguous, complete, and edge-safe' +
    '\n      ssSliceRankedPage is not implemented yet (expected RED until task 2)');
} else {
  // Property A — slice correctness: result equals the native slice oracle and is
  // at most `limit` long (Req 6.1).
  prop('Property 13A: slice equals rankedIds[offset .. offset+limit) and length <= limit', () => {
    fc.assert(fc.property(
      rankedIdsGen, limitGen, offsetGen,
      (rankedIds, limit, offset) => {
        const out = ss.ssSliceRankedPage(rankedIds, limit, offset);
        assert(Array.isArray(out), `page must be an array, got ${show(out)}`);

        const expected = rankedIds.slice(offset, offset + limit);
        assert(out.length === expected.length,
          `page length ${out.length} != native slice length ${expected.length} ` +
          `(limit=${limit}, offset=${offset}, n=${rankedIds.length})`);
        for (let i = 0; i < expected.length; i++) {
          assert(out[i] === expected[i],
            `page[${i}] = ${show(out[i])} != native slice ${show(expected[i])} ` +
            `(limit=${limit}, offset=${offset})`);
        }
        assert(out.length <= limit,
          `page length ${out.length} exceeds limit ${limit}`);
        return true;
      }
    ), { numRuns: ITER });
  });

  // Property B — full pagination reconstruction: walking offsets 0, limit,
  // 2*limit, … until the list is consumed and concatenating the pages reproduces
  // rankedIds EXACTLY — order preserved, no id duplicated, none skipped
  // (Req 6.2, 6.3).
  prop('Property 13B: consecutive pages concatenate back to rankedIds exactly', () => {
    fc.assert(fc.property(
      rankedIdsGen, limitGen,
      (rankedIds, limit) => {
        const pages = [];
        const n = rankedIds.length;
        // Bound iterations defensively so a buggy empty-page contract can't loop
        // forever: at most ceil(n/limit) + 2 pages are ever needed.
        const maxPages = Math.ceil(n / limit) + 2;
        let count = 0;
        for (let offset = 0; ; offset += limit) {
          const page = ss.ssSliceRankedPage(rankedIds, limit, offset);
          assert(Array.isArray(page), `page must be an array, got ${show(page)}`);
          if (offset >= n) {
            assert(page.length === 0,
              `offset ${offset} >= length ${n} must yield an empty page, got ${show(page)}`);
            break;
          }
          pages.push(page);
          count++;
          assert(count <= maxPages,
            `pagination did not terminate within ${maxPages} pages ` +
            `(n=${n}, limit=${limit}) — pages are not advancing`);
        }

        const concat = [].concat.apply([], pages);
        assert(concat.length === n,
          `concatenated pages length ${concat.length} != rankedIds length ${n} ` +
          `(limit=${limit})`);
        for (let i = 0; i < n; i++) {
          assert(concat[i] === rankedIds[i],
            `reconstructed[${i}] = ${show(concat[i])} != rankedIds[${i}] = ` +
            `${show(rankedIds[i])} (limit=${limit})`);
        }
        return true;
      }
    ), { numRuns: ITER });
  });

  // Property C — edge cases, all without throwing:
  //   offset >= length            → []   (Req 6.5)
  //   limit <= 0                  → []   (Req 6.6)
  //   offset < 0                  → []   (Req 6.6)
  //   non-array rankedIds         → []   (defensive)
  prop('Property 13C: edge cases yield an empty page without throwing', () => {
    // offset >= length → [] (Req 6.5)
    fc.assert(fc.property(
      rankedIdsGen, limitGen, fc.integer({ min: 0, max: 50 }),
      (rankedIds, limit, extra) => {
        const offset = rankedIds.length + extra;     // offset >= length
        const out = ss.ssSliceRankedPage(rankedIds, limit, offset);
        assert(Array.isArray(out) && out.length === 0,
          `offset ${offset} >= length ${rankedIds.length} must yield [], got ${show(out)}`);
        return true;
      }
    ), { numRuns: ITER });

    // non-positive limit → [] (Req 6.6)
    fc.assert(fc.property(
      rankedIdsGen, fc.integer({ min: -50, max: 0 }), offsetGen,
      (rankedIds, limit, offset) => {
        const out = ss.ssSliceRankedPage(rankedIds, limit, offset);
        assert(Array.isArray(out) && out.length === 0,
          `non-positive limit ${limit} must yield [], got ${show(out)}`);
        return true;
      }
    ), { numRuns: ITER });

    // negative offset → [] (Req 6.6)
    fc.assert(fc.property(
      rankedIdsGen, limitGen, fc.integer({ min: -50, max: -1 }),
      (rankedIds, limit, offset) => {
        const out = ss.ssSliceRankedPage(rankedIds, limit, offset);
        assert(Array.isArray(out) && out.length === 0,
          `negative offset ${offset} must yield [], got ${show(out)}`);
        return true;
      }
    ), { numRuns: ITER });

    // non-array rankedIds → [] (defensive)
    fc.assert(fc.property(
      fc.oneof(fc.constant(null), fc.constant(undefined), fc.integer(),
        fc.string(), fc.record({ length: fc.integer() })),
      limitGen, offsetGen,
      (rankedIds, limit, offset) => {
        const out = ss.ssSliceRankedPage(rankedIds, limit, offset);
        assert(Array.isArray(out) && out.length === 0,
          `non-array rankedIds ${show(rankedIds)} must yield [], got ${show(out)}`);
        return true;
      }
    ), { numRuns: ITER });
  });
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
