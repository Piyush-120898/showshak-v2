/* ═══════════════════════════════════════════════════════════════
   tests/prop-scoreboard-safe.test.js — Node property test for the
   prefetch-cache-pipeline Scoreboard-safety gate `ssPublicSignalsOnly(record)`
   in showshak-shared.js.

   Plain Node (no framework) + fast-check; run with:
     node tests/prop-scoreboard-safe.test.js
   (auto-discovered by `node tests/run-all.js`).

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (plain object in, plain object out), so the stub never affects behaviour — it
   only lets the module load and populate module.exports.

   TDD NOTE (red-first): `ssPublicSignalsOnly` does NOT exist yet — it lands in
   task 2.4. This file is EXPECTED to be RED until then. The missing function is
   reported as a clean assertion failure (not a crash), so the red result is
   meaningful and the rest of the suite still runs.

   ── PROPERTY 3 — Scoreboard-safe sanitization (HIDE THE SCOREBOARD). ──
   This is the SACRED gate every cached/prefetched payload passes through:
   private engagement totals must NEVER leak into a cache. The contract:
     ssPublicSignalsOnly(record) →
       • a NON-object input (null/undefined/number/string/array) → {} (empty obj)
       • for a plain object, a shallow copy with EVERY Scoreboard (denylist) field
         removed — the canonical private engagement totals:
             fires_received, fires_received_total, watch_taps, watch_it_taps
       • every Public_Signal present is PRESERVED verbatim (e.g. fires_count,
         views_count, follower count, id, caption, posterUrl, muxPlaybackId,
         titleLinks) — and any other non-denylisted field is kept too
       • a record carrying BOTH kinds returns its PUBLIC fields (not an empty /
         skipped result)
       • idempotent: sanitizing an already-sanitized record is a fixpoint
       • total + pure: never throws, never mutates its input.
═══════════════════════════════════════════════════════════════ */
// Feature: prefetch-cache-pipeline, Property 3: Scoreboard-safe sanitization — for
// any source record, ssPublicSignalsOnly(record) returns an object that contains no
// Scoreboard field, preserves every Public_Signal present, returns the public fields
// (not an empty/skipped result) when the record carries both kinds, is idempotent,
// and maps non-object → {}.
// **Validates: Requirements 11.1, 11.2, 11.3, 11.4**
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

/* ── The canonical Scoreboard denylist: private engagement totals that MUST NOT
   appear in any cached/prefetched payload. ─────────────────────────────────── */
const DENYLIST = [
  'fires_received', 'fires_received_total', 'watch_taps', 'watch_it_taps',
];
const DENYSET = new Set(DENYLIST);

/* ── Oracle: faithfully recompute the documented contract without reaching into
   module internals. Non-object → {}; otherwise shallow copy minus denylist. ──── */
function sanitizeOracle(record) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) return {};
  const out = {};
  for (const k of Object.keys(record)) {
    if (!DENYSET.has(k)) out[k] = record[k];
  }
  return out;
}

// Recursively freeze so a pure function CANNOT mutate its input without throwing.
function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.getOwnPropertyNames(o).forEach((k) => {
      try { deepFreeze(o[k]); } catch (e) { /* getter / exotic — ignore */ }
    });
    Object.freeze(o);
  }
  return o;
}
function snapshot(v) { try { return JSON.stringify(v); } catch (e) { return String(v); } }

/* ── Generators ─────────────────────────────────────────────────────────────
   Public_Signal field values (the whitelist of safe-to-cache fields named in the
   design): fires_count, views_count, follower count, id, caption, posterUrl,
   muxPlaybackId, titleLinks. */
const publicKey = fc.constantFrom(
  'id', 'caption', 'posterUrl', 'muxPlaybackId', 'titleLinks',
  'fires_count', 'views_count', 'follower_count', 'followerCount'
);
const publicVal = fc.oneof(
  fc.string(),
  fc.integer({ min: 0, max: 1000000 }),
  fc.boolean(),
  fc.constant(null),
  fc.array(fc.string(), { maxLength: 4 }),
  fc.record({ title: fc.string(), tmdb_id: fc.integer() })
);
const scoreboardVal = fc.integer({ min: 0, max: 1000000 });

// An arbitrary extra key that is guaranteed NOT to be on the denylist (so it
// represents an additional public/neutral field that must be preserved).
const extraNeutralKey = fc.string({ minLength: 1, maxLength: 12 })
  .filter((k) => typeof k === 'string' && k.length > 0 && !DENYSET.has(k));

// A record holding ONLY public/neutral fields (no scoreboard).
const publicOnlyRecord = fc.dictionary(
  fc.oneof(publicKey, extraNeutralKey), publicVal, { maxKeys: 8 }
);

// A record holding ONLY scoreboard fields (every entry on the denylist).
const scoreboardOnlyRecord = fc.uniqueArray(fc.constantFrom(...DENYLIST), { minLength: 1, maxLength: 4 })
  .chain((keys) => fc.tuple(...keys.map(() => scoreboardVal)).map((vals) => {
    const o = {};
    keys.forEach((k, i) => { o[k] = vals[i]; });
    return o;
  }));

// A MIXED record carrying BOTH a non-empty public part and ≥1 scoreboard field.
const mixedRecord = fc.tuple(
  publicOnlyRecord.filter((o) => Object.keys(o).length >= 1),
  scoreboardOnlyRecord
).map(([pub, sb]) => Object.assign({}, pub, sb));

// Non-object inputs that MUST map to {}.
const nonObjectInput = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.integer(),
  fc.double(),
  fc.string(),
  fc.boolean(),
  fc.array(fc.anything(), { maxLength: 4 })   // arrays are not plain records → {}
);

// The full input space, incl. fc.anything() to stress totality.
const anyRecord = fc.oneof(
  publicOnlyRecord, scoreboardOnlyRecord, mixedRecord,
  fc.constant({}), nonObjectInput, fc.anything()
);

let failed = 0;
function prop(name, fn) {
  try { fn(); console.log('  \u2713 ' + name); }
  catch (e) { failed++; console.log('  \u2717 ' + name + '\n      ' + (e && e.message)); }
}

console.log('Feature: prefetch-cache-pipeline — Property 3: Scoreboard-safe sanitization\n');

if (typeof ss.ssPublicSignalsOnly !== 'function') {
  // Red-first: ssPublicSignalsOnly lands in task 2.4. Report a clean assertion
  // failure (not a crash) so the RED result is meaningful.
  failed++;
  console.log('  \u2717 Property 3: Scoreboard-safe sanitization' +
    '\n      ssPublicSignalsOnly is not implemented yet (expected RED until task 2.4)');
} else {
  /* ── (a) No Scoreboard field ever survives; output matches the oracle ──────── */
  prop('Property 3a: output drops every Scoreboard field and matches the contract', () => {
    fc.assert(fc.property(anyRecord, (record) => {
      const out = ss.ssPublicSignalsOnly(record);
      assert(out !== null && typeof out === 'object' && !Array.isArray(out),
        `result must be a plain object, got ${show(out)} for ${show(record)}`);
      // No denylisted field may appear in the output, ever.
      for (const bad of DENYLIST) {
        assert(!Object.prototype.hasOwnProperty.call(out, bad),
          `Scoreboard field "${bad}" leaked into output ${show(out)} for ${show(record)}`);
      }
      // Output equals the documented contract exactly.
      assert(snapshot(out) === snapshot(sanitizeOracle(record)),
        `result ${show(out)} != expected ${show(sanitizeOracle(record))} for ${show(record)}`);
      return true;
    }), { numRuns: ITER });
  });

  /* ── (b) Every Public_Signal present is preserved verbatim ─────────────────── */
  prop('Property 3b: every Public_Signal present is preserved verbatim', () => {
    fc.assert(fc.property(fc.oneof(publicOnlyRecord, mixedRecord), (record) => {
      const out = ss.ssPublicSignalsOnly(record);
      for (const k of Object.keys(record)) {
        if (DENYSET.has(k)) continue;            // scoreboard → must be gone
        assert(Object.prototype.hasOwnProperty.call(out, k),
          `Public_Signal "${k}" was dropped from ${show(out)} (input ${show(record)})`);
        assert(snapshot(out[k]) === snapshot(record[k]),
          `Public_Signal "${k}" changed value: ${show(out[k])} != ${show(record[k])}`);
      }
      return true;
    }), { numRuns: ITER });
  });

  /* ── (c) A record carrying BOTH kinds returns its public fields, not empty ──── */
  prop('Property 3c: mixed record keeps public fields (never skipped/emptied)', () => {
    fc.assert(fc.property(mixedRecord, (record) => {
      const out = ss.ssPublicSignalsOnly(record);
      const expectedPublicKeys = Object.keys(record).filter((k) => !DENYSET.has(k));
      // The mixed record had ≥1 public field by construction; the result must keep them.
      assert(Object.keys(out).length === expectedPublicKeys.length,
        `mixed record should keep ${expectedPublicKeys.length} public field(s), ` +
        `got ${Object.keys(out).length} in ${show(out)} (input ${show(record)})`);
      assert(Object.keys(out).length >= 1,
        `mixed record must NOT be emptied/skipped — got {} for ${show(record)}`);
      // …and still no scoreboard field.
      for (const bad of DENYLIST) {
        assert(!Object.prototype.hasOwnProperty.call(out, bad),
          `Scoreboard field "${bad}" survived a mixed record ${show(out)}`);
      }
      return true;
    }), { numRuns: ITER });
  });

  /* ── (d) Idempotent: sanitizing an already-sanitized record is a fixpoint ───── */
  prop('Property 3d: idempotent (sanitize twice == sanitize once)', () => {
    fc.assert(fc.property(anyRecord, (record) => {
      const once = ss.ssPublicSignalsOnly(record);
      const twice = ss.ssPublicSignalsOnly(once);
      assert(snapshot(twice) === snapshot(once),
        `not idempotent: once=${show(once)} twice=${show(twice)} for ${show(record)}`);
      return true;
    }), { numRuns: ITER });
  });

  /* ── (e) Non-object input → {} ─────────────────────────────────────────────── */
  prop('Property 3e: non-object input → {}', () => {
    fc.assert(fc.property(nonObjectInput, (v) => {
      const out = ss.ssPublicSignalsOnly(v);
      assert(out !== null && typeof out === 'object' && !Array.isArray(out),
        `non-object must yield a plain object, got ${show(out)} for ${show(v)}`);
      assert(Object.keys(out).length === 0,
        `non-object must yield {}, got ${show(out)} for ${show(v)}`);
      return true;
    }), { numRuns: ITER });
    // Explicit literal cases pinning the contract.
    assert(snapshot(ss.ssPublicSignalsOnly(null)) === '{}', 'null → {}');
    assert(snapshot(ss.ssPublicSignalsOnly(undefined)) === '{}', 'undefined → {}');
    assert(snapshot(ss.ssPublicSignalsOnly(42)) === '{}', 'number → {}');
    assert(snapshot(ss.ssPublicSignalsOnly('x')) === '{}', 'string → {}');
    assert(snapshot(ss.ssPublicSignalsOnly([1, 2, 3])) === '{}', 'array → {}');
  });

  /* ── (f) Total + pure: never throws, never mutates its input ───────────────── */
  prop('Property 3f: total (never throws) + pure (no mutation, deterministic)', () => {
    fc.assert(fc.property(anyRecord, (record) => {
      deepFreeze(record);
      const before = snapshot(record);
      const r1 = ss.ssPublicSignalsOnly(record);   // throwing here fails the property
      const r2 = ss.ssPublicSignalsOnly(record);
      assert(r1 !== null && typeof r1 === 'object' && !Array.isArray(r1),
        `result must be a plain object, got ${show(r1)} for ${show(record)}`);
      assert(snapshot(r1) === snapshot(r2),
        `non-deterministic: ${show(r1)} != ${show(r2)} for ${show(record)}`);
      assert(snapshot(record) === before, `input was mutated: ${show(record)}`);
      return true;
    }), { numRuns: ITER });
  });

  /* ── Explicit literal cases pinning the headline behaviour. ─────────────────── */
  prop('Property 3 (literals): scoreboard stripped, public kept, mixed kept', () => {
    // Pure scoreboard → emptied.
    assert(snapshot(ss.ssPublicSignalsOnly({
      fires_received: 9, fires_received_total: 99, watch_taps: 5, watch_it_taps: 7,
    })) === '{}', 'all-scoreboard record → {}');

    // Mixed → only public fields survive.
    const mixed = {
      id: 'clip1', caption: 'hi', posterUrl: 'https://image.mux.com/x/thumb.jpg',
      muxPlaybackId: 'pb1', titleLinks: [{ title: 'Dune' }],
      fires_count: 3, views_count: 10,
      fires_received: 42, fires_received_total: 420, watch_taps: 8, watch_it_taps: 9,
    };
    const out = ss.ssPublicSignalsOnly(mixed);
    assert(out.id === 'clip1' && out.caption === 'hi' && out.muxPlaybackId === 'pb1',
      'public scalar fields preserved');
    assert(out.fires_count === 3 && out.views_count === 10, 'public counts preserved');
    assert(snapshot(out.titleLinks) === snapshot([{ title: 'Dune' }]), 'titleLinks preserved');
    for (const bad of DENYLIST) {
      assert(!Object.prototype.hasOwnProperty.call(out, bad), `${bad} stripped from mixed`);
    }
    assert(Object.keys(out).length === 7, 'exactly the 7 public fields remain');
  });
}

console.log('\n' + (failed ? `FAILED: ${failed} propert${failed === 1 ? 'y' : 'ies'}` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
