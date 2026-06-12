/* ═══════════════════════════════════════════════════════════════
   tests/prop-title-links.test.js — Node property test for the
   curator-upload-v2 title-linking + publish-gating pure helpers
   `ssBuildTitleLinks(selectedTitles)` and `ssCanPublish(draft)` in
   showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-title-links.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helpers under test are PURE
   (take arrays/plain objects, return plain arrays/booleans), so the stub never
   affects behaviour — it only lets the module load and populate module.exports.

   IMPORTANT — the helpers' EXACT semantics (mirrored by this test's oracle):
     ssBuildTitleLinks(selectedTitles):
       - input is an array of selected-title entries; null/undefined/non-array → [].
       - id extraction by shape PRECEDENCE:
           1. object with string `id`        → entry.id   (primary)
           2. object with string `title_id`  → entry.title_id (fallback)
           3. a bare string/uuid             → the entry IS the id
         anything else (numbers, {}, {id:5}, null, undefined) → skipped.
       - ids are TRIMMED; empty/whitespace-only → skipped.
       - DE-DUP first-wins on the trimmed id; later duplicates dropped.
       - output: one { title_id, sort_no } per distinct id, sort_no contiguous
         0..m-1 in first-seen order (primary id at sort_no 0). Pure, never throws.
     ssCanPublish(draft):
       - null/undefined/non-object → false.
       - true IFF ssBuildTitleLinks(draft.selectedTitles).length >= 1
         OR draft.title_id is a non-empty (trimmed) string. Pure, strict boolean.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
// JSON.stringify is sufficient for arrays of {title_id, sort_no}.
function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/* Independent oracle: extract a usable id from one entry using the SAME shape
   precedence as the helper (id → title_id → bare-string), trimming and rejecting
   non-usable values. Returns a trimmed non-empty string, or null when unusable. */
function extractId(entry) {
  let id = null;
  if (typeof entry === 'string') {
    id = entry;
  } else if (entry && typeof entry === 'object') {
    if (typeof entry.id === 'string') id = entry.id;
    else if (typeof entry.title_id === 'string') id = entry.title_id;
  }
  if (typeof id !== 'string') return null;
  id = id.trim();
  return id === '' ? null : id;
}

/* Independent oracle: compute the expected links using the SAME rules as the
   helper (extract per shape precedence, trim, skip non-usable, de-dup first-wins,
   contiguous sort_no), so the property asserts correctness rather than re-running
   the implementation. */
function expectedLinks(entries) {
  const out = [];
  const seen = Object.create(null);
  if (!Array.isArray(entries)) return out;
  for (let i = 0; i < entries.length; i++) {
    const id = extractId(entries[i]);
    if (id === null) continue;
    if (seen[id]) continue;
    seen[id] = true;
    out.push({ title_id: id, sort_no: out.length });
  }
  return out;
}

let failed = 0;

console.log('Feature: curator-upload-v2 — title linking + publish gating property test\n');

// Feature: curator-upload-v2, Property 7
// Property 7: Title linking produces one ordered row per selected title and gates publish.
// For any set of distinct selected titles, the produced content_titles rows are
// exactly one per title with sort_no values 0..n-1 (the primary title at sort_no 0,
// matching content.title_id); and ssCanPublish(draft) is true IFF at least one title
// is linked, in which case the publish row's title_id is non-null.
// **Validates: Requirements 1.2, 1.5, 2.2, 2.3**
try {
  // A small pool of id strings so duplicates occur naturally; some need trimming.
  const idPool = fc.constantFrom(
    'a', 'b', 'c',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '  ok  '
  );

  // Accepted entry shapes mixed with junk that must be skipped.
  const entry = fc.oneof(
    { weight: 4, arbitrary: idPool.map((id) => ({ id })) },        // primary shape {id}
    { weight: 3, arbitrary: idPool.map((id) => ({ title_id: id })) }, // fallback shape {title_id}
    { weight: 3, arbitrary: idPool },                               // bare string/uuid
    // Junk to be skipped:
    { weight: 2, arbitrary: fc.constantFrom(
      null, undefined, {}, { id: '' }, { id: '   ' }, { title_id: '' },
      5, 0, -1, true, false, NaN, { id: 5 }, { title_id: 7 }, []
    ) }
  );

  const entriesGen = fc.oneof(
    { weight: 8, arbitrary: fc.array(entry, { maxLength: 12 }) },
    // Occasionally a bad outer value to exercise the defensive null/undefined/non-array path.
    { weight: 1, arbitrary: fc.constantFrom(null, undefined, 42, 'x', {}) }
  );

  fc.assert(fc.property(entriesGen, (entries) => {
    const result = ss.ssBuildTitleLinks(entries);
    const expected = expectedLinks(entries);

    // ssBuildTitleLinks always returns an array.
    assert(Array.isArray(result), 'ssBuildTitleLinks must return an array');

    // Core: result deep-equals the independently-computed links (same values, SAME order).
    assert(deepEqual(result, expected),
      `links mismatch: got ${JSON.stringify(result)} expected ${JSON.stringify(expected)} for ${JSON.stringify(entries)}`);

    // (a) sort_no values are exactly 0..n-1 contiguous in order.
    for (let k = 0; k < result.length; k++) {
      assert(result[k].sort_no === k,
        `sort_no not contiguous: index ${k} has sort_no ${result[k].sort_no}`);
    }

    // (b) no duplicate title_id in the result.
    const ids = result.map((r) => r.title_id);
    assert(new Set(ids).size === result.length,
      `duplicate title_id in ${JSON.stringify(result)}`);

    // (c) every title_id is a non-empty string.
    for (const r of result) {
      assert(typeof r.title_id === 'string', `non-string title_id: ${JSON.stringify(r.title_id)}`);
      assert(r.title_id.length > 0, 'empty title_id in result');
    }

    if (result.length > 0) {
      // (d) the FIRST distinct usable id is the primary at sort_no 0.
      const firstId = expected[0].title_id; // first-extracted id by the oracle
      assert(result[0].title_id === firstId && result[0].sort_no === 0,
        `primary mismatch: result[0]=${JSON.stringify(result[0])} firstId=${firstId}`);
    }

    // (e) order is first-seen order of distinct ids (oracle already enforces this; the
    // deepEqual above guarantees it). Double-check rebuilding from result is stable.
    assert(deepEqual(ss.ssBuildTitleLinks(ids), result),
      'order not stable / re-build differs');

    // ── ssCanPublish gating ──
    const canPublish = ss.ssCanPublish({ selectedTitles: entries });
    assert(canPublish === (result.length >= 1),
      `ssCanPublish gate mismatch: got ${canPublish} for links length ${result.length}`);
    assert(typeof canPublish === 'boolean', 'ssCanPublish must return a strict boolean');

    if (result.length > 0) {
      // when links non-empty, the primary id (the publish row's title_id) is non-null.
      assert(typeof result[0].title_id === 'string' && result[0].title_id.length > 0,
        'primary publish title_id must be a non-empty string when publishable');
    }

    return true;
  }), { numRuns: ITER });

  // Never throws on awkward inputs; always returns an array / strict boolean.
  ss.ssBuildTitleLinks(null); ss.ssBuildTitleLinks(undefined); ss.ssBuildTitleLinks(42);
  ss.ssBuildTitleLinks([null, undefined, {}, 5, { id: 5 }]);
  assert(Array.isArray(ss.ssBuildTitleLinks(null)), 'ssBuildTitleLinks(null) must be an array');

  // ── ssCanPublish explicit literal cases ──
  assert(ss.ssCanPublish({ title_id: 'x' }) === true, "ssCanPublish({title_id:'x'}) must be true");
  assert(ss.ssCanPublish({ title_id: '   ' }) === false, "ssCanPublish({title_id:'   '}) must be false");
  assert(ss.ssCanPublish({ selectedTitles: [] }) === false, 'ssCanPublish({selectedTitles:[]}) must be false');
  // a draft with empty selectedTitles but a valid title_id → canPublish true.
  assert(ss.ssCanPublish({ selectedTitles: [], title_id: 't' }) === true,
    'empty selectedTitles + valid title_id → publishable');
  // a draft with usable selectedTitles → publishable regardless of title_id.
  assert(ss.ssCanPublish({ selectedTitles: [{ id: 'a' }] }) === true,
    'usable selectedTitles → publishable');
  // null/undefined/non-object → false; strict boolean throughout.
  assert(ss.ssCanPublish(null) === false, 'ssCanPublish(null) must be false');
  assert(ss.ssCanPublish(undefined) === false, 'ssCanPublish(undefined) must be false');
  assert(ss.ssCanPublish(42) === false, 'ssCanPublish(42) must be false');
  assert(ss.ssCanPublish('x') === false, "ssCanPublish('x') must be false");

  // ── ssBuildTitleLinks explicit literal cases (from the design / task) ──
  assert(deepEqual(
    ss.ssBuildTitleLinks([{ id: 'a' }, { id: 'b' }, { id: 'a' }]),
    [{ title_id: 'a', sort_no: 0 }, { title_id: 'b', sort_no: 1 }]
  ), 'dedup with {id} entries failed');
  assert(deepEqual(
    ss.ssBuildTitleLinks(['x', 'y']),
    [{ title_id: 'x', sort_no: 0 }, { title_id: 'y', sort_no: 1 }]
  ), 'bare-string entries failed');
  assert(deepEqual(
    ss.ssBuildTitleLinks([{ title_id: 'z' }]),
    [{ title_id: 'z', sort_no: 0 }]
  ), 'fallback {title_id} shape failed');
  assert(deepEqual(
    ss.ssBuildTitleLinks([null, {}, { id: '' }, 5, { id: '  ok  ' }]),
    [{ title_id: 'ok', sort_no: 0 }]
  ), 'junk-skip + trim failed');

  console.log('  \u2713 Property 7');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 7\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
