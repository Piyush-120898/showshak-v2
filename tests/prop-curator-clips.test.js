/* ═══════════════════════════════════════════════════════════════
   tests/prop-curator-clips.test.js — Node property test for the
   public-curator-profile clip-resolution seam in showshak-shared.js.

   Function under test: ssResolveCuratorViewModel(curatorRow, contentRows, 0)
   with curatorRow = { role:'curator', username:'x' }. Its `.clips` MUST be
   exactly what the already-tested pure mapper ssMapContentRowsToClips(rows)
   produces — the resolver never invents clips, never injects MOCK constants,
   never includes non-live/deleted rows, and preserves input order.

   ssMapContentRowsToClips row filter (the contract this test pins):
     row && row.status === 'live' && row.deleted_at == null
   Surviving rows are projected with `id` carried straight through (clip.id = row.id),
   so the sequence of output ids is exactly the sequence of qualifying input ids.

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helpers under test are PURE
   (plain objects in, plain object out) so the stub never affects behaviour — it
   only lets the module load and populate module.exports.

   Plain Node (no framework) + fast-check; run with:
     node tests/prop-curator-clips.test.js
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: public-curator-profile — curator clips resolution property test\n');

// Feature: public-curator-profile, Property 4: Clips come only from real rows, MOCK-free and order-preserving
// **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 7.3, 10.1, 11.3, 12.4**
try {
  // A fixed curator row — identity is irrelevant to this property; only the
  // clip projection is under test.
  const CURATOR = { role: 'curator', username: 'x' };

  // uuid-like content id generator (real content ids are uuids).
  const HEX = '0123456789abcdef'.split('');
  const hexBlock = (n) => fc.array(fc.constantFrom(...HEX), { minLength: n, maxLength: n }).map(a => a.join(''));
  const uuidGen = fc.tuple(hexBlock(8), hexBlock(4), hexBlock(4), hexBlock(4), hexBlock(12))
    .map(parts => parts.join('-'));

  // Ids shaped like the legacy MOCK_CLIPS ids ('1','2','3'): these are still
  // REAL rows when status==='live' — the point is the resolver's output equals
  // the mapper's, so no SEPARATELY-injected MOCK constant ever appears.
  const idGen = fc.oneof(uuidGen, fc.constantFrom('1', '2', '3'));

  const tsGen = fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') })
    .map(d => d.toISOString());

  // A single content-row-like object with the realistic fields the mapper reads.
  const rowGen = fc.record({
    id: idGen,
    status: fc.constantFrom('live', 'processing', 'draft', 'removed'),
    deleted_at: fc.option(tsGen, { nil: null }),
    mux_playback_id: fc.option(uuidGen, { nil: null }),
    description: fc.string({ maxLength: 40 }),
    fires_count: fc.nat({ max: 99999 }),
    created_at: tsGen,
    thumbnail_url: fc.option(fc.webUrl(), { nil: null }),
    duration_sec: fc.option(fc.nat({ max: 600 }), { nil: null }),
    url: fc.option(fc.webUrl(), { nil: null }),
    meta: fc.option(fc.record({
      vibes: fc.option(fc.array(fc.string({ maxLength: 8 }), { maxLength: 4 }), { nil: undefined }),
      lang: fc.option(fc.string({ maxLength: 4 }), { nil: undefined }),
    }), { nil: undefined }),
    creator: fc.option(fc.record({
      username: fc.string({ minLength: 1, maxLength: 12 }),
      name: fc.option(fc.string({ maxLength: 20 }), { nil: undefined }),
      avatar_url: fc.option(fc.webUrl(), { nil: null }),
    }), { nil: undefined }),
    title: fc.option(fc.record({
      name: fc.string({ maxLength: 20 }),
      year: fc.option(fc.integer({ min: 1950, max: 2025 }), { nil: undefined }),
    }), { nil: undefined }),
    platform: fc.option(fc.record({
      id: fc.nat({ max: 50 }),
      name: fc.string({ minLength: 1, maxLength: 10 }),
      color: fc.constantFrom('#EA3B32', '#1DB954', '#E50914'),
      abbr: fc.string({ minLength: 1, maxLength: 3 }),
    }), { nil: undefined }),
  });

  // Arrays mixing live/non-live and deleted/non-deleted rows in random order.
  const rowsGen = fc.array(rowGen, { maxLength: 30 });

  fc.assert(fc.property(rowsGen, (rows) => {
    const vm = ss.ssResolveCuratorViewModel(CURATOR, rows, 0);
    const mapped = ss.ssMapContentRowsToClips(rows);

    // ── Core: resolver clips deep-equal the mapper output ──────────────
    assert(Array.isArray(vm.clips), 'vm.clips must be an array');
    assert(vm.clips.length === mapped.length,
      `clip length mismatch: resolver ${vm.clips.length} vs mapper ${mapped.length}`);
    assert(JSON.stringify(vm.clips) === JSON.stringify(mapped),
      'resolver clips must deep-equal ssMapContentRowsToClips(rows)');

    // Element-wise id comparison (order-preserving, same ids in same positions).
    for (let i = 0; i < mapped.length; i++) {
      assert(vm.clips[i].id === mapped[i].id,
        `clip id mismatch at ${i}: ${vm.clips[i].id} vs ${mapped[i].id}`);
    }

    // ── Every output clip id traces to a live, non-deleted input row ───
    // (resolver never invents clips, never includes non-live/deleted rows).
    const qualifying = rows.filter(r => r && r.status === 'live' && r.deleted_at == null);
    const qualifyingIds = qualifying.map(r => r.id);
    assert(vm.clips.length === qualifyingIds.length,
      `clip count ${vm.clips.length} must equal qualifying row count ${qualifyingIds.length}`);
    for (let i = 0; i < vm.clips.length; i++) {
      // Order preserved: output id sequence === qualifying input id sequence.
      assert(vm.clips[i].id === qualifyingIds[i],
        `order/id mismatch at ${i}: output ${vm.clips[i].id} vs qualifying ${qualifyingIds[i]}`);
    }

    // ── MOCK-free: no clip exists whose source row was NOT live/non-deleted.
    // Since output === mapper(rows), any non-qualifying row (including ones with
    // MOCK-shaped ids '1','2','3' but status!='live') must be absent.
    const rejected = rows.filter(r => !(r && r.status === 'live' && r.deleted_at == null));
    for (const rej of rejected) {
      // A rejected row's id only counts as "leaked" if no qualifying row shares it.
      const sharedWithQualifying = qualifyingIds.indexOf(rej.id) !== -1;
      if (!sharedWithQualifying) {
        assert(vm.clips.findIndex(c => c.id === rej.id) === -1,
          `rejected (non-live/deleted) row id ${rej.id} must not appear in clips`);
      }
    }

    // ── stats.clips === clips.length ──────────────────────────────────
    assert(vm.stats.clips === vm.clips.length,
      `stats.clips ${vm.stats.clips} must equal clips.length ${vm.clips.length}`);

    // ── Hero_Wall source is the first min(5, n) of the same array (Req 3.4).
    const wall = vm.clips.slice(0, Math.min(5, vm.clips.length));
    assert(wall.length === Math.min(5, vm.clips.length),
      'wall slice must be min(5, n)');
    for (let i = 0; i < wall.length; i++) {
      assert(wall[i].id === vm.clips[i].id, `wall slice id mismatch at ${i}`);
    }

    return true;
  }), { numRuns: ITER });

  // ── MOCK-shaped-but-live rows ARE real clips (key MOCK-free assertion) ──
  // Rows whose ids look like MOCK_CLIPS ids (1,2,3) but with status:'live' are
  // still REAL rows; they survive because output === mapper(rows).
  const mockShapedLive = [
    { id: '1', status: 'live', deleted_at: null, created_at: '2024-03-01T00:00:00.000Z' },
    { id: '2', status: 'live', deleted_at: null, created_at: '2024-02-01T00:00:00.000Z' },
    { id: '3', status: 'live', deleted_at: null, created_at: '2024-01-01T00:00:00.000Z' },
  ];
  const vmMock = ss.ssResolveCuratorViewModel({ role: 'curator', username: 'x' }, mockShapedLive, 0);
  assert(JSON.stringify(vmMock.clips) === JSON.stringify(ss.ssMapContentRowsToClips(mockShapedLive)),
    'MOCK-shaped live rows must resolve exactly as the mapper output');
  assert(vmMock.clips.length === 3, 'three MOCK-shaped live rows yield three real clips');
  assert(vmMock.clips.map(c => c.id).join(',') === '1,2,3',
    'MOCK-shaped live row ids are preserved in order');
  assert(vmMock.stats.clips === 3, 'stats.clips must be 3 for three live rows');

  // ── Empty rows array → clips [] and stats.clips 0 ──────────────────
  const vmEmpty = ss.ssResolveCuratorViewModel({ role: 'curator', username: 'x' }, [], 0);
  assert(Array.isArray(vmEmpty.clips) && vmEmpty.clips.length === 0,
    'empty rows must yield clips []');
  assert(vmEmpty.stats.clips === 0, 'empty rows must yield stats.clips 0');

  // ── All-non-live rows → clips [] and stats.clips 0 ─────────────────
  const allNonLive = [
    { id: 'a', status: 'processing', deleted_at: null, created_at: '2024-01-01T00:00:00.000Z' },
    { id: 'b', status: 'draft', deleted_at: null, created_at: '2024-01-01T00:00:00.000Z' },
    { id: 'c', status: 'live', deleted_at: '2024-06-01T00:00:00.000Z', created_at: '2024-01-01T00:00:00.000Z' },
    { id: 'd', status: 'removed', deleted_at: null, created_at: '2024-01-01T00:00:00.000Z' },
  ];
  const vmNonLive = ss.ssResolveCuratorViewModel({ role: 'curator', username: 'x' }, allNonLive, 0);
  assert(Array.isArray(vmNonLive.clips) && vmNonLive.clips.length === 0,
    'all-non-live rows must yield clips []');
  assert(vmNonLive.stats.clips === 0, 'all-non-live rows must yield stats.clips 0');

  console.log('  \u2713 Property 4');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 4\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
