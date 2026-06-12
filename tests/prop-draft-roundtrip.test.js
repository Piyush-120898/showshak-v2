/* ═══════════════════════════════════════════════════════════════
   tests/prop-draft-roundtrip.test.js — Node property test for the
   curator-upload-v2 draft persistence round-trip pure helpers
   `ssDraftToRow(draft)`, `ssDraftToLinks(draft)` and
   `ssRowToDraft(row, links)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-draft-roundtrip.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helpers under test are PURE
   (take/return plain objects + arrays), so the stub never affects behaviour — it
   only lets the module load and populate module.exports.

   IMPORTANT — the round-trip is over a NORMALISED draft (the canonical draft
   shape the helpers persist and reconstruct exactly), NOT arbitrary objects:
     ssDraftToRow(draft) → { description, title_id, status:'draft',
                             meta:{ vibes, cover_time, trim } }
       - description = draft.pitch when a string, else ''.
       - title_id    = ssBuildTitleLinks(draft.selectedTitles)[0]?.title_id ?? null.
       - meta.vibes  = draft.vibes when an array (sliced copy), else [].
       - meta.cover_time = finite Number(draft.coverTime) (0 allowed), else null.
       - meta.trim   = { in, out, src } from draft.trim when an object, else null.
     ssDraftToLinks(draft) → one { title_id, sort_no } per DISTINCT title,
       sort_no 0..n-1 in curator order (de-dups, trims ids).
     ssRowToDraft(row, links) → { selectedTitles, pitch, vibes, coverTime, trim }
       - selectedTitles = links sorted by sort_no asc, mapped to { id: title_id }.
       - pitch = row.description || '' (string).
       - vibes = row.meta.vibes when an array, else [].
       - coverTime = finite Number(meta.cover_time) (0 allowed), else null.
       - trim = { in, out, src } from meta.trim, else null.

   So the generator MUST produce drafts already in the round-trippable shape:
     - selectedTitles: DISTINCT { id:<clean non-empty string> } objects, since
       ssBuildTitleLinks de-dups and TRIMS ids (duplicates / whitespace ids would
       NOT round-trip). Each entry is exactly { id } because ssRowToDraft rebuilds
       entries as { id: title_id }. Order matters and is preserved.
     - pitch: a STRING (stored raw as description, returned raw — round-trips by
       value; avoid the empty-vs-undefined ambiguity by always providing a string).
     - vibes: an array of strings (sliced copy round-trips by value).
     - coverTime: a FINITE number (incl. 0 and floats) OR null. undefined/NaN/±∞
       would normalise to null and NOT deep-equal, so they are excluded.
     - trim: { in, out, src } with FINITE numbers OR null. Only those three keys
       (extra keys would be dropped) and not undefined (→ null).
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
// All draft values are strings / finite numbers / null / arrays / plain objects,
// so JSON.stringify is a sufficient structural deep-equality oracle.
function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

let failed = 0;

console.log('Feature: curator-upload-v2 — draft persistence round-trip property test\n');

// Feature: curator-upload-v2, Property 9
// Property 9: Draft state round-trips through persistence.
// For any draft state d (selected video reference, trim points, linked titles,
// pitch within the maximum, vibes, cover time),
//   ssRowToDraft(ssDraftToRow(d), ssDraftToLinks(d)) deep-equals d.
// In particular the pitch survives as description and the cover time survives in meta.
// **Validates: Requirements 5.4, 9.1, 9.4**
try {
  // DISTINCT, clean (no surrounding whitespace, non-empty) ids → entries { id }.
  // fc.uuid() yields unique-able, whitespace-free, non-empty id strings; uniqueArray
  // guarantees distinctness so ssBuildTitleLinks never de-dups any away.
  const selectedTitlesGen = fc
    .uniqueArray(fc.uuid(), { maxLength: 8 })
    .map((ids) => ids.map((id) => ({ id })));

  // Finite numbers only (incl. 0 and floats); NaN/±∞ normalise to null so are excluded.
  const finiteNum = fc.double({ noNaN: true, noDefaultInfinity: true });

  // coverTime: a finite number OR null (never undefined → would normalise to null).
  const coverTimeGen = fc.option(finiteNum, { nil: null });

  // trim: exactly { in, out, src } finite numbers, OR null (never undefined).
  const trimGen = fc.option(
    fc.record({ in: finiteNum, out: finiteNum, src: finiteNum }),
    { nil: null }
  );

  // A draft in the canonical, round-trippable normalised shape.
  const normalisedDraftGen = fc.record({
    selectedTitles: selectedTitlesGen,
    pitch: fc.string(),
    vibes: fc.array(fc.string(), { maxLength: 5 }),
    coverTime: coverTimeGen,
    trim: trimGen,
  });

  fc.assert(fc.property(normalisedDraftGen, (d) => {
    const row = ss.ssDraftToRow(d);
    const links = ss.ssDraftToLinks(d);
    const back = ss.ssRowToDraft(row, links);

    // Core round-trip: reconstructed draft deep-equals the original normalised draft.
    assert(deepEqual(back, d),
      `round-trip mismatch: got ${JSON.stringify(back)} for ${JSON.stringify(d)}`);

    // Spec call-out: pitch survives as description.
    assert(row.description === d.pitch,
      `pitch did not survive as description: ${JSON.stringify(row.description)} !== ${JSON.stringify(d.pitch)}`);

    // Spec call-out: cover time survives in meta (finite number stays; null stays null).
    assert(row.meta.cover_time === d.coverTime,
      `cover time did not survive in meta: ${JSON.stringify(row.meta.cover_time)} !== ${JSON.stringify(d.coverTime)}`);

    // status is always 'draft'.
    assert(row.status === 'draft', `status must be 'draft', got ${JSON.stringify(row.status)}`);

    // title_id is the first selected title's id (or null when none selected).
    const expectedTitleId = d.selectedTitles[0] ? d.selectedTitles[0].id : null;
    assert(row.title_id === expectedTitleId,
      `title_id mismatch: ${JSON.stringify(row.title_id)} !== ${JSON.stringify(expectedTitleId)}`);

    return true;
  }), { numRuns: ITER });

  // ── Defensive cases: never throw, yield the sensible empty row / draft ──
  const emptyRow = ss.ssDraftToRow(null);
  assert(emptyRow.description === '' && emptyRow.title_id === null && emptyRow.status === 'draft',
    'ssDraftToRow(null) must be the empty draft row');
  assert(deepEqual(emptyRow.meta, { vibes: [], cover_time: null, trim: null }),
    'ssDraftToRow(null).meta must carry the empty defaults');
  assert(deepEqual(ss.ssDraftToRow(undefined), emptyRow),
    'ssDraftToRow(undefined) must equal the empty row');

  const emptyDraft = { selectedTitles: [], pitch: '', vibes: [], coverTime: null, trim: null };
  assert(deepEqual(ss.ssRowToDraft(null), emptyDraft),
    'ssRowToDraft(null) must be the empty draft');
  assert(deepEqual(ss.ssRowToDraft(null, null), emptyDraft),
    'ssRowToDraft(null, null) must be the empty draft');
  assert(deepEqual(ss.ssDraftToLinks(null), []),
    'ssDraftToLinks(null) must be []');

  // ── Explicit example: a fully-populated draft round-trips exactly ──
  const sample = {
    selectedTitles: [{ id: 'tt-aaa' }, { id: 'tt-bbb' }, { id: 'tt-ccc' }],
    pitch: 'A tense, funny heist that sticks the landing.',
    vibes: ['tense', 'funny'],
    coverTime: 12.5,
    trim: { in: 3, out: 41.2, src: 90 },
  };
  const sampleBack = ss.ssRowToDraft(ss.ssDraftToRow(sample), ss.ssDraftToLinks(sample));
  assert(deepEqual(sampleBack, sample),
    `fully-populated sample did not round-trip: ${JSON.stringify(sampleBack)}`);
  // and the specific persistence locations for the sample:
  const sampleRow = ss.ssDraftToRow(sample);
  assert(sampleRow.description === sample.pitch, 'sample pitch must persist as description');
  assert(sampleRow.meta.cover_time === sample.coverTime, 'sample cover time must persist in meta');
  assert(sampleRow.title_id === 'tt-aaa', 'sample primary title_id must be the first selected id');
  // coverTime === 0 (first frame default) survives as a finite 0, not null.
  assert(ss.ssDraftToRow({ coverTime: 0 }).meta.cover_time === 0,
    'coverTime 0 must survive as 0 (not null)');

  console.log('  \u2713 Property 9');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 9\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
