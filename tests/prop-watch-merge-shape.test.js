/* ═══════════════════════════════════════════════════════════════
   tests/prop-watch-merge-shape.test.js — RED-FIRST property test for the
   REDESIGNED Watch It resolver `ssResolveWatchOptions`. Encodes the TARGET
   option-shape parity: every Watch_Option (especially a curator-declared one)
   has EXACTLY the field set { name, color, label, sub, included, platform_id }
   with the same value rules as a TMDB-sourced option (catalog-derived
   name/color/label/platform_id, neutral colour default when no catalog colour),
   so the merged list is shape-identical regardless of source. EXPECTED RED
   until the merge lands.

   Plain Node + fast-check. installDomStub() before requiring shared.js.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

// Feature: watch-it-curator-availability, Property 4: Curator-declared options share the TMDB option shape and fields
// **Validates: Requirements 5.1, 5.3**

const NEUTRAL_COLOR = 'var(--ss-neutral, #2a2a2a)';
const OPTION_KEYS = ['color', 'included', 'label', 'name', 'platform_id', 'sub'];
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/* The value rules a declared platform maps to (mirrors the TMDB-sourced rules). */
function declaredOption(d, subs) {
  const included = !!(d && d.platform_id && subs.has(d.platform_id));
  return {
    name:        d.name,
    color:       d.color ? d.color : NEUTRAL_COLOR,
    label:       d.abbr || (d.name ? String(d.name).charAt(0) : '\u25B6'),
    sub:         included ? 'In your plan' : 'Available to stream',
    included:    included,
    platform_id: d.platform_id || null,
  };
}

/* ── Generators ──────────────────────────────────────────────── */
// Declared platforms with UNIQUE platform_ids (all present) → no dedup, so each
// option maps 1:1 back to its declared source for exact value verification.
const platformId = fc.constantFrom('p1', 'p2', 'p3', 'p4');
const declaredEntry = (id) => fc.record({
  platform_id: fc.constant(id),
  name:        fc.constantFrom('Netflix', 'Prime Video', 'Curator Pick', 'Founder Plat', 'Hotstar'),
  color:       fc.option(fc.constantFrom('#ff0080', '#22cc88', '#e50914'), { nil: undefined }),
  abbr:        fc.option(fc.constantFrom('C', 'F', 'N', 'P'), { nil: undefined }),
});
const uniqueDeclaredList = fc.uniqueArray(platformId, { maxLength: 4 })
  .chain((ids) => (ids.length === 0 ? fc.constant([]) : fc.tuple(...ids.map((id) => declaredEntry(id)))));

const subsGen = fc.uniqueArray(platformId, { maxLength: 4 }).map((a) => new Set(a));

let failed = 0;
console.log('Feature: watch-it-curator-availability — Property 4 (option-shape parity)\n');

try {
  fc.assert(fc.property(uniqueDeclaredList, subsGen, (declared, subs) => {
    // declared-only clip → every resolved option is curator-declared-sourced.
    const clip = { providers: {}, declaredPlatforms: { IN: declared } };
    const res  = ss.ssResolveWatchOptions(clip, 'IN', subs);

    assert(res && Array.isArray(res.options), 'result.options must be an array');
    assert(res.options.length === declared.length,
      `unique declared ids → one option each (got ${res.options.length}, expected ${declared.length})`);

    res.options.forEach((opt) => {
      // EXACTLY the six fields, no more no less.
      assert(deepEqual(Object.keys(opt).sort(), OPTION_KEYS),
        `option must have exactly ${JSON.stringify(OPTION_KEYS)}, got ${JSON.stringify(Object.keys(opt).sort())}`);

      // Value rules: match against the declared source with this platform_id.
      const src = declared.find((d) => (d.platform_id || null) === opt.platform_id);
      assert(src, `every option must map back to a declared source (platform_id ${opt.platform_id})`);
      assert(deepEqual(opt, declaredOption(src, subs)),
        `declared option value rules mismatch: got ${JSON.stringify(opt)} expected ${JSON.stringify(declaredOption(src, subs))}`);
    });

    return true;
  }), { numRuns: ITER });

  // ── Explicit example: declared platform with no colour → neutral default + first-letter label ──
  {
    const res = ss.ssResolveWatchOptions(
      { providers: {}, declaredPlatforms: { IN: [{ platform_id: 'p1', name: 'Curator Pick' }] } }, 'IN', new Set());
    assert(res.options.length === 1, 'one declared option');
    const o = res.options[0];
    assert(deepEqual(Object.keys(o).sort(), OPTION_KEYS), 'shape parity for declared option');
    assert(o.color === NEUTRAL_COLOR, 'no colour → neutral default');
    assert(o.label === 'C', 'no abbr → first letter of name');
    assert(o.platform_id === 'p1' && o.name === 'Curator Pick', 'name/platform_id from catalog entry');
  }

  console.log('  \u2713 Property 4');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 4\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
