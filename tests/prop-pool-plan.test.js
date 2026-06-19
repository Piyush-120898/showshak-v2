/* ═══════════════════════════════════════════════════════════════
   tests/prop-pool-plan.test.js — Node property test for the
   clip-player-performance Player_Pool recycling decision
   `ssPoolPlan(prevAssignment, mountedBand, poolSize)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-pool-plan.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (plain objects/arrays in, a plain plan object out), so the stub never affects
   behaviour — it only lets the module load and populate module.exports.

   Plan semantics (mirrored here): given the current clipIdx→slotId assignment,
   the target mounted band, and the pool size, ssPoolPlan returns
   { assignment, keep, repoint, release } that recycles slots instead of
   destroying/recreating: band clips already mounted keep their slot, leaving
   clips release their slot, and exactly those freed slots (plus never-used
   slot ids) are handed to the entering clips.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let failed = 0;

console.log('Feature: clip-player-performance — pool plan recycling property test\n');

// Feature: clip-player-performance, Property 5: Pool plan recycles within bound, covers the band, and is stable
// **Validates: Requirements 2.1, 2.2, 2.3, 2.6, 9.6**
try {
  // A realistic generator: pick a poolSize, a set of distinct clip indices for
  // the band (size 0..poolSize), and a prevAssignment that maps SOME arbitrary
  // clip indices (possibly overlapping the band, possibly not) to distinct slot
  // ids within [0, poolSize).
  const scenario = fc.integer({ min: 1, max: 6 }).chain((poolSize) => {
    const idxGen = fc.integer({ min: 0, max: 30 });
    // band: distinct indices, length 0..poolSize
    const bandGen = fc.uniqueArray(idxGen, { minLength: 0, maxLength: poolSize });
    // prev clips: distinct indices, length 0..poolSize; each gets a distinct slot.
    const prevClipsGen = fc.uniqueArray(idxGen, { minLength: 0, maxLength: poolSize });
    return fc.record({
      poolSize: fc.constant(poolSize),
      band: bandGen,
      prevClips: prevClipsGen,
    });
  }).map(({ poolSize, band, prevClips }) => {
    // Assign each prev clip a distinct slot id in [0, poolSize).
    const prevAssignment = {};
    prevClips.forEach((c, i) => { prevAssignment[c] = i % poolSize; });
    // Ensure prev slot ids are distinct (slice to poolSize already guarantees it
    // when prevClips.length ≤ poolSize, which it is).
    return { poolSize, band, prevAssignment };
  });

  fc.assert(fc.property(scenario, ({ poolSize, band, prevAssignment }) => {
    const plan = ss.ssPoolPlan(prevAssignment, band, poolSize);
    assert(plan && typeof plan === 'object', 'plan must be an object');
    const { assignment, keep, repoint, release } = plan;
    assert(assignment && typeof assignment === 'object', 'assignment must be an object');
    assert(Array.isArray(keep) && Array.isArray(repoint) && Array.isArray(release),
      'keep/repoint/release must be arrays');

    const bandSet = new Set(band);
    const assignedClips = Object.keys(assignment).map(Number);

    // (a) bound: at most poolSize entries.
    assert(assignedClips.length <= poolSize,
      `assignment exceeds poolSize: ${assignedClips.length} > ${poolSize}`);

    // (b) covers the band exactly once: every band clip is assigned; nothing extra.
    for (const c of band) {
      assert(Object.prototype.hasOwnProperty.call(assignment, c),
        `band clip ${c} missing from assignment`);
    }
    assert(assignedClips.length === bandSet.size,
      `assignment has clips outside the band: assigned ${assignedClips.length} vs band ${bandSet.size}`);
    for (const c of assignedClips) {
      assert(bandSet.has(c), `assignment contains non-band clip ${c}`);
    }

    // (c) no slot shared by two clips.
    const slotsUsed = assignedClips.map((c) => assignment[c]);
    assert(new Set(slotsUsed).size === slotsUsed.length,
      `a slot is shared by two clips: ${JSON.stringify(slotsUsed)}`);
    // All slot ids are within [0, poolSize).
    for (const sl of slotsUsed) {
      assert(Number.isInteger(sl) && sl >= 0 && sl < poolSize,
        `slot id out of range: ${sl} (poolSize ${poolSize})`);
    }

    // (d) stability: a clip in BOTH prev and band keeps its original slot.
    for (const c of band) {
      if (Object.prototype.hasOwnProperty.call(prevAssignment, c)) {
        assert(assignment[c] === prevAssignment[c],
          `stability broken: clip ${c} moved slot ${prevAssignment[c]} → ${assignment[c]}`);
        assert(keep.includes(c), `clip ${c} should be in keep`);
      }
    }

    // keep = exactly the band clips that were previously assigned.
    for (const c of keep) {
      assert(bandSet.has(c) && Object.prototype.hasOwnProperty.call(prevAssignment, c),
        `keep contains a clip that is not a re-used band clip: ${c}`);
    }

    // release = exactly the prev clips no longer in band.
    const expectedRelease = Object.keys(prevAssignment).map(Number).filter((c) => !bandSet.has(c));
    assert(release.slice().sort((a, b) => a - b).join(',') ===
           expectedRelease.slice().sort((a, b) => a - b).join(','),
      `release mismatch: got ${JSON.stringify(release)} expected ${JSON.stringify(expectedRelease)}`);

    // repoint = exactly the band clips that were NOT previously assigned.
    const expectedRepoint = band.filter((c) => !Object.prototype.hasOwnProperty.call(prevAssignment, c));
    const repointClips = repoint.map((r) => r.clipIdx);
    assert(repointClips.slice().sort((a, b) => a - b).join(',') ===
           expectedRepoint.slice().sort((a, b) => a - b).join(','),
      `repoint clips mismatch: got ${JSON.stringify(repointClips)} expected ${JSON.stringify(expectedRepoint)}`);

    // keep ∪ repoint covers the band; keep ∩ repoint = ∅.
    assert(keep.length + repoint.length === bandSet.size,
      `keep+repoint must cover the band: ${keep.length}+${repoint.length} vs ${bandSet.size}`);

    // Every repoint slot is a real free slot (not used by a kept clip).
    const keptSlots = new Set(keep.map((c) => assignment[c]));
    for (const r of repoint) {
      assert(!keptSlots.has(r.slotId),
        `repoint reused a kept clip's slot: ${r.slotId}`);
    }

    return true;
  }), { numRuns: ITER });

  // ── Explicit example: scroll forward by one (band [0,1,2,3] → [1,2,3,4]) ──
  const prev = { 0: 0, 1: 1, 2: 2, 3: 3 };
  const plan = ss.ssPoolPlan(prev, [1, 2, 3, 4], 4);
  // 1,2,3 keep their slots; 0 releases slot 0; 4 enters on the freed slot 0.
  assert(plan.assignment[1] === 1 && plan.assignment[2] === 2 && plan.assignment[3] === 3,
    `kept clips must keep slots: ${JSON.stringify(plan.assignment)}`);
  assert(plan.release.length === 1 && plan.release[0] === 0, `0 must release: ${JSON.stringify(plan.release)}`);
  assert(plan.repoint.length === 1 && plan.repoint[0].clipIdx === 4 && plan.repoint[0].slotId === 0,
    `4 must enter on freed slot 0: ${JSON.stringify(plan.repoint)}`);

  // ── Empty band → empty assignment, everything released ──
  const planEmpty = ss.ssPoolPlan({ 5: 0, 6: 1 }, [], 4);
  assert(Object.keys(planEmpty.assignment).length === 0, 'empty band → empty assignment');
  assert(planEmpty.release.slice().sort().join(',') === '5,6', 'empty band releases all prev');

  console.log('  \u2713 Property 5');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 5\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
