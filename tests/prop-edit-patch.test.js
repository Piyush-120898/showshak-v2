/* ═══════════════════════════════════════════════════════════════
   tests/prop-edit-patch.test.js — Node property test for the
   curator-upload-v2 edit-after-post pure helper `ssBuildEditPatch(editInput)`
   in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-edit-patch.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (takes a plain object, returns a plain object), so the stub never affects
   behaviour — it only lets the module load and populate module.exports.

   IMPORTANT — the helper's EXACT semantics (mirrored by this test's oracle):
     ssBuildEditPatch(editInput):
       - null/undefined/non-object → {}.
       - Builds `patch` by EXPLICIT ALLOWLIST assignment only — it never spreads
         editInput, so forbidden/immutable keys can NEVER leak.
       - ALLOWED top-level keys: { description, title_id, meta, thumbnail_url }.
         meta sub-keys: { vibes, cover_time }.
       - description : included IFF typeof pitch==='string' && ssValidatePitch(pitch).ok
                       (length 1..280); when present === editInput.pitch.
       - title_id    : ssBuildTitleLinks(selectedTitles)[0].title_id when non-empty;
                       else editInput.title_id when a non-empty trimmed string; else omitted.
       - meta.vibes  : present IFF Array.isArray(editInput.vibes) (a slice copy).
       - meta.cover_time : present IFF coverTime is a finite number (incl 0):
                       coverTime != null/undefined AND isFinite(Number(coverTime));
                       value === Number(coverTime). meta omitted entirely if empty.
       - thumbnail_url : explicit string thumbnailUrl wins, else string coverUrl;
                       else built via ssCoverThumbUrl(muxPlaybackId, Number(coverTime))
                       when muxPlaybackId is non-empty AND coverTime is finite; else omitted.
       - Pure, never throws.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// The ONLY keys the edit patch is ever allowed to carry.
const ALLOWED_TOP = ['description', 'title_id', 'meta', 'thumbnail_url'];
const ALLOWED_META = ['vibes', 'cover_time'];

// Keys that must NEVER appear (top-level OR nested in meta) — swapping the
// Immutable_Asset through an edit must be impossible.
const FORBIDDEN = [
  'mux_asset_id', 'mux_playback_id', 'url', 'mux_upload_id', 'duration_sec',
  'status', 'creator_id', 'deleted_at', 'id', 'asset_id', 'playback_id',
  'bytes', 'file', 'video',
];

// Mirror the helper's finiteness rule for coverTime (incl 0; reject null/undefined).
function coverTimeIsFinite(coverTime) {
  return coverTime !== undefined && coverTime !== null && isFinite(Number(coverTime));
}

let failed = 0;

console.log('Feature: curator-upload-v2 — edit patch (mutable-only) property test\n');

// Feature: curator-upload-v2, Property 10
// Property 10: Edit patch only ever touches Mutable_Metadata.
// For any edit input, the patch produced by the edit path contains only mutable
// keys (description, title_id, meta.vibes, thumbnail_url / meta.cover_time) and
// NEVER contains mux_asset_id, mux_playback_id, url, or any video-bytes field —
// guaranteeing the Immutable_Asset cannot be swapped through an edit.
// **Validates: Requirements 10.2, 10.3**
try {
  // Pool of title ids so ssBuildTitleLinks can extract a primary (some need trimming).
  const idPool = fc.constantFrom('a', 'b', 'c', '  ok  ', '');

  // selectedTitles: sometimes a usable array, sometimes empty/absent/junk.
  const selectedTitlesGen = fc.oneof(
    { weight: 4, arbitrary: fc.array(idPool.map((id) => ({ id })), { maxLength: 4 }) },
    { weight: 2, arbitrary: fc.constantFrom(undefined, null, [], 'x', 42) }
  );

  // pitch: valid 1..280 string, over-max (281), non-string, or empty.
  const pitchGen = fc.oneof(
    { weight: 3, arbitrary: fc.string({ minLength: 1, maxLength: 100 }) },
    { weight: 2, arbitrary: fc.string({ minLength: 281, maxLength: 300 }) }, // over-max
    { weight: 2, arbitrary: fc.constantFrom(undefined, null, 42, true, '', '   ') }
  );

  // title_id: sometimes a string, sometimes empty/whitespace, sometimes junk.
  const titleIdGen = fc.oneof(
    { weight: 3, arbitrary: fc.constantFrom('t1', 't2', '  pad  ') },
    { weight: 2, arbitrary: fc.constantFrom('', '   ', undefined, null, 5) }
  );

  // vibes: sometimes an array, sometimes not.
  const vibesGen = fc.oneof(
    { weight: 3, arbitrary: fc.array(fc.string(), { maxLength: 3 }) },
    { weight: 2, arbitrary: fc.constantFrom(undefined, null, 'x', 7, {}) }
  );

  // coverTime: finite numbers incl 0/negative, plus non-finite junk.
  const coverTimeGen = fc.oneof(
    { weight: 3, arbitrary: fc.double({ min: -10, max: 600, noNaN: true }) },
    { weight: 1, arbitrary: fc.constantFrom(0) },
    { weight: 2, arbitrary: fc.constantFrom(undefined, null, NaN, Infinity, -Infinity, 'abc') }
  );

  // thumbnailUrl / coverUrl: sometimes explicit string, sometimes junk/absent.
  const urlGen = fc.oneof(
    { weight: 2, arbitrary: fc.webUrl() },
    { weight: 3, arbitrary: fc.constantFrom(undefined, null, 42, {}) }
  );

  // muxPlaybackId: sometimes a non-empty string, sometimes absent/empty.
  const playbackIdGen = fc.oneof(
    { weight: 3, arbitrary: fc.constantFrom('pb', 'PLAYBACK123', 'x') },
    { weight: 2, arbitrary: fc.constantFrom(undefined, null, '', 99) }
  );

  // Junk value for forbidden fields.
  const junk = fc.constantFrom('NOPE', 'EVIL', 123, true, { swap: 1 }, ['bytes']);

  // The edit input: valid mutable fields ALONGSIDE always-present forbidden fields.
  const editInputGen = fc.record({
    pitch: pitchGen,
    selectedTitles: selectedTitlesGen,
    title_id: titleIdGen,
    vibes: vibesGen,
    coverTime: coverTimeGen,
    thumbnailUrl: urlGen,
    coverUrl: urlGen,
    muxPlaybackId: playbackIdGen,
    // Forbidden / immutable fields — always present, junk values.
    mux_asset_id: junk,
    mux_playback_id: junk,
    url: junk,
    mux_upload_id: junk,
    duration_sec: junk,
    status: junk,
    creator_id: junk,
    deleted_at: junk,
    id: junk,
    asset_id: junk,
    playback_id: junk,
    bytes: junk,
    file: junk,
    video: junk,
  });

  // Occasionally pass a wholly defensive value too.
  const inputGen = fc.oneof(
    { weight: 9, arbitrary: editInputGen },
    { weight: 1, arbitrary: fc.constantFrom(null, undefined, 42, 'x', [], {}) }
  );

  fc.assert(fc.property(inputGen, (input) => {
    const e = (input && typeof input === 'object' && !Array.isArray(input)) ? input : {};
    let patch;
    // (a) NEVER THROWS, returns a plain object.
    try {
      patch = ss.ssBuildEditPatch(input);
    } catch (err) {
      throw new Error('ssBuildEditPatch threw: ' + err.message + ' for ' + JSON.stringify(input));
    }
    assert(patch && typeof patch === 'object' && !Array.isArray(patch),
      'patch must be a plain object, got ' + JSON.stringify(patch));

    const topKeys = Object.keys(patch);

    // (b) top-level keys ⊆ allowed set.
    for (const k of topKeys) {
      assert(ALLOWED_TOP.indexOf(k) !== -1,
        'disallowed top-level key "' + k + '" in patch ' + JSON.stringify(patch));
    }

    // (c) meta sub-keys ⊆ { vibes, cover_time }.
    if (Object.prototype.hasOwnProperty.call(patch, 'meta')) {
      assert(patch.meta && typeof patch.meta === 'object' && !Array.isArray(patch.meta),
        'patch.meta must be a plain object');
      for (const mk of Object.keys(patch.meta)) {
        assert(ALLOWED_META.indexOf(mk) !== -1,
          'disallowed meta sub-key "' + mk + '" in ' + JSON.stringify(patch.meta));
      }
      // meta is omitted entirely when empty (never an empty object).
      assert(Object.keys(patch.meta).length > 0, 'patch.meta must not be empty when present');
    }

    // (d) NONE of the forbidden keys appear at top level NOR inside patch.meta.
    for (const fk of FORBIDDEN) {
      assert(!Object.prototype.hasOwnProperty.call(patch, fk),
        'FORBIDDEN key "' + fk + '" leaked at top level of ' + JSON.stringify(patch));
      if (patch.meta) {
        assert(!Object.prototype.hasOwnProperty.call(patch.meta, fk),
          'FORBIDDEN key "' + fk + '" leaked into patch.meta of ' + JSON.stringify(patch.meta));
      }
    }

    // (e) Mutable-correctness ties (pin behaviour, not just the allowlist).

    // description IFF (typeof pitch==='string' && ssValidatePitch(pitch).ok)
    const wantDesc = (typeof e.pitch === 'string') && ss.ssValidatePitch(e.pitch).ok;
    assert(Object.prototype.hasOwnProperty.call(patch, 'description') === wantDesc,
      'description presence mismatch (want ' + wantDesc + ') for pitch ' + JSON.stringify(e.pitch));
    if (wantDesc) {
      assert(patch.description === e.pitch,
        'description value mismatch: ' + JSON.stringify(patch.description));
    }

    // title_id: links[0] wins, else non-empty trimmed string title_id, else omitted.
    const links = ss.ssBuildTitleLinks(e.selectedTitles);
    if (links.length) {
      assert(patch.title_id === links[0].title_id,
        'title_id should equal primary link ' + links[0].title_id + ', got ' + JSON.stringify(patch.title_id));
    } else if (typeof e.title_id === 'string' && e.title_id.trim() !== '') {
      assert(patch.title_id === e.title_id,
        'title_id should equal direct title_id ' + JSON.stringify(e.title_id) + ', got ' + JSON.stringify(patch.title_id));
    } else {
      assert(!Object.prototype.hasOwnProperty.call(patch, 'title_id'),
        'title_id should be omitted, got ' + JSON.stringify(patch.title_id));
    }

    // meta.vibes present IFF Array.isArray(vibes).
    const wantVibes = Array.isArray(e.vibes);
    const haveVibes = !!(patch.meta && Object.prototype.hasOwnProperty.call(patch.meta, 'vibes'));
    assert(haveVibes === wantVibes,
      'meta.vibes presence mismatch (want ' + wantVibes + ')');
    if (wantVibes) {
      assert(deepEqual(patch.meta.vibes, e.vibes),
        'meta.vibes value mismatch: ' + JSON.stringify(patch.meta.vibes));
    }

    // meta.cover_time present IFF coverTime is finite (incl 0).
    const wantCover = coverTimeIsFinite(e.coverTime);
    const haveCover = !!(patch.meta && Object.prototype.hasOwnProperty.call(patch.meta, 'cover_time'));
    assert(haveCover === wantCover,
      'meta.cover_time presence mismatch (want ' + wantCover + ') for coverTime ' + JSON.stringify(e.coverTime));
    if (wantCover) {
      assert(patch.meta.cover_time === Number(e.coverTime),
        'meta.cover_time value mismatch: ' + JSON.stringify(patch.meta.cover_time));
    }

    // thumbnail_url precedence: explicit string thumbnailUrl else coverUrl;
    // else built when muxPlaybackId non-empty AND coverTime finite; else absent.
    const explicitUrl = (typeof e.thumbnailUrl === 'string') ? e.thumbnailUrl
                      : (typeof e.coverUrl === 'string') ? e.coverUrl
                      : null;
    if (explicitUrl !== null) {
      assert(patch.thumbnail_url === explicitUrl,
        'thumbnail_url should equal explicit url ' + JSON.stringify(explicitUrl) + ', got ' + JSON.stringify(patch.thumbnail_url));
    } else if (e.muxPlaybackId !== undefined && e.muxPlaybackId !== null &&
               String(e.muxPlaybackId) !== '' && wantCover) {
      assert(patch.thumbnail_url === ss.ssCoverThumbUrl(e.muxPlaybackId, Number(e.coverTime)),
        'thumbnail_url should be built from playback id + cover time, got ' + JSON.stringify(patch.thumbnail_url));
    } else {
      assert(!Object.prototype.hasOwnProperty.call(patch, 'thumbnail_url'),
        'thumbnail_url should be omitted, got ' + JSON.stringify(patch.thumbnail_url));
    }

    return true;
  }), { numRuns: ITER });

  // ── Explicit example from the task ──
  const ex = ss.ssBuildEditPatch({
    pitch: 'hi', selectedTitles: [{ id: 'a' }], vibes: ['x'], coverTime: 5,
    muxPlaybackId: 'pb', mux_asset_id: 'NOPE', url: 'NOPE', mux_playback_id: 'NOPE',
  });
  assert(deepEqual(ex, {
    description: 'hi', title_id: 'a', meta: { vibes: ['x'], cover_time: 5 },
    thumbnail_url: 'https://image.mux.com/pb/thumbnail.jpg?time=5',
  }), 'explicit example patch mismatch: ' + JSON.stringify(ex));
  for (const fk of FORBIDDEN) {
    assert(!Object.prototype.hasOwnProperty.call(ex, fk), 'forbidden key leaked in example: ' + fk);
  }

  // ── Defensive cases ──
  assert(deepEqual(ss.ssBuildEditPatch({}), {}), 'ssBuildEditPatch({}) must deep-equal {}');
  assert(deepEqual(ss.ssBuildEditPatch(null), {}), 'ssBuildEditPatch(null) must deep-equal {}');
  assert(deepEqual(ss.ssBuildEditPatch(undefined), {}), 'ssBuildEditPatch(undefined) must deep-equal {}');

  // Over-max pitch (281 chars) → no description.
  const overMax = ss.ssBuildEditPatch({ pitch: 'a'.repeat(281) });
  assert(!Object.prototype.hasOwnProperty.call(overMax, 'description'),
    'over-max pitch must not produce a description, got ' + JSON.stringify(overMax));

  // coverTime 0 IS a valid cover time (boundary).
  const zeroCover = ss.ssBuildEditPatch({ coverTime: 0 });
  assert(zeroCover.meta && zeroCover.meta.cover_time === 0,
    'coverTime 0 must produce meta.cover_time === 0, got ' + JSON.stringify(zeroCover));

  console.log('  \u2713 Property 10');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 10\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
