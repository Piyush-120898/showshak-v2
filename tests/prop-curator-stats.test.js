/* ═══════════════════════════════════════════════════════════════
   tests/prop-curator-stats.test.js — Node property test for the
   public-curator-profile stats clamp in
   `ssResolveCuratorViewModel(usersRow, contentRows, followerCount)`
   in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-curator-stats.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The resolver under test is PURE
   (takes plain objects/arrays/values, returns a plain view-model object), so the
   stub never affects behaviour — it only lets the module load and populate
   module.exports.

   Stats semantics under test (mirrored by this test's oracle):
     stats.followers = Math.floor(followerCount) ONLY when followerCount is a
       finite Number >= 0; otherwise 0. So negatives, NaN, ±Infinity, non-numeric
       strings, null, undefined, objects → 0; fractional like 3.9 → 3.
     stats.clips = result.clips.length (the resolved clip array length), which is
       0 for an empty contentRows array (and for all-non-live rows).
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// Safe stringifier for diagnostics: fast-check's fc.object() can generate objects
// whose `toString`/`valueOf` is a non-function primitive (e.g. { toString: "" }),
// which makes a bare String(v) throw "Cannot convert object to primitive value"
// even when the assertion itself passes. Never let a diagnostic crash the test.
function show(v) {
  try {
    if (v !== null && typeof v === 'object') return JSON.stringify(v);
    return String(v);
  } catch (_) {
    return Object.prototype.toString.call(v);
  }
}

// Oracle for the expected clamped follower value.
function expectedFollowers(followerCount) {
  if (typeof followerCount === 'number' && isFinite(followerCount) && followerCount >= 0) {
    return Math.floor(followerCount);
  }
  return 0;
}

let failed = 0;

console.log('Feature: public-curator-profile — curator stats clamp property test\n');

// Feature: public-curator-profile, Property 5: Stats are non-negative integers and clip count matches the clip array
// **Validates: Requirements 4.1, 4.2, 4.3, 8.4, 10.3**
try {
  const curatorRow = { role: 'curator', username: 'x' };

  // A simple content-row generator: rows vary by `status` (live vs non-live) and
  // `deleted_at` so the resolved clip count varies. ssMapContentRowsToClips keeps
  // only { status:'live', deleted_at == null } rows.
  const rowGen = fc.record({
    id: fc.integer({ min: 1, max: 1e9 }),
    status: fc.constantFrom('live', 'draft', 'processing', 'live', 'failed'),
    deleted_at: fc.oneof(fc.constant(null), fc.constant('2024-01-01T00:00:00Z')),
  });

  // Arbitrary arrays of rows (including the empty array).
  const rowsGen = fc.array(rowGen, { minLength: 0, maxLength: 30 });

  // Wide mix of followerCount inputs: integers (incl. negatives), doubles
  // (fractionals/negatives), special numbers, strings, null, undefined, objects.
  const followerGen = fc.oneof(
    fc.integer(),
    fc.double(),
    fc.constantFrom(NaN, Infinity, -Infinity),
    fc.string(),
    fc.constant(null),
    fc.constant(undefined),
    fc.object()
  );

  fc.assert(fc.property(rowsGen, followerGen, (rows, followerCount) => {
    const result = ss.ssResolveCuratorViewModel(curatorRow, rows, followerCount);

    // followers is always a non-negative integer.
    assert(Number.isInteger(result.stats.followers) && result.stats.followers >= 0,
      `followers must be a non-negative integer: got ${result.stats.followers} for input ${show(followerCount)}`);

    // followers matches the clamp oracle exactly.
    const exp = expectedFollowers(followerCount);
    assert(result.stats.followers === exp,
      `followers clamp mismatch for ${show(followerCount)}: got ${result.stats.followers} expected ${exp}`);

    // clips count equals the resolved clip array length.
    assert(result.stats.clips === result.clips.length,
      `stats.clips must equal clips.length: got ${result.stats.clips} vs ${result.clips.length}`);

    // An empty rows array always yields zero clips.
    if (rows.length === 0) {
      assert(result.stats.clips === 0,
        `empty rows must yield stats.clips === 0: got ${result.stats.clips}`);
    }

    return true;
  }), { numRuns: ITER });

  // ── Explicit follower clamp examples (exact expected outputs) ──
  const examples = [
    [3.9, 3],
    [-5, 0],
    [NaN, 0],
    [Infinity, 0],
    ['7', 0],
    [null, 0],
    [0, 0],
    [1000000, 1000000],
  ];
  for (const [input, want] of examples) {
    const r = ss.ssResolveCuratorViewModel(curatorRow, [], input);
    assert(r.stats.followers === want,
      `example followers mismatch for ${show(input)}: got ${r.stats.followers} expected ${want}`);
    assert(Number.isInteger(r.stats.followers) && r.stats.followers >= 0,
      `example followers must be non-negative integer for ${show(input)}: got ${r.stats.followers}`);
  }

  // ── Empty rows array → clips count 0 (explicit) ──
  const empty = ss.ssResolveCuratorViewModel(curatorRow, [], 0);
  assert(empty.stats.clips === 0, `empty rows must give clips 0: got ${empty.stats.clips}`);
  assert(empty.clips.length === 0, `empty rows must give clips array length 0: got ${empty.clips.length}`);

  // ── clip count tracks the live, non-deleted rows ──
  const mixed = [
    { id: 1, status: 'live', deleted_at: null },
    { id: 2, status: 'draft', deleted_at: null },
    { id: 3, status: 'live', deleted_at: '2024-01-01' },
    { id: 4, status: 'live', deleted_at: null },
  ];
  const mixedR = ss.ssResolveCuratorViewModel(curatorRow, mixed, 12.7);
  assert(mixedR.stats.clips === 2, `expected 2 live clips: got ${mixedR.stats.clips}`);
  assert(mixedR.stats.clips === mixedR.clips.length, 'mixed: stats.clips must equal clips.length');
  assert(mixedR.stats.followers === 12, `mixed followers clamp: got ${mixedR.stats.followers} expected 12`);

  console.log('  \u2713 Property 5');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 5\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
