/* ═══════════════════════════════════════════════════════════════
   tests/prop-curator-app-validate.test.js — Node property test for the
   curator-application-approval Application_Validator pure helper
   `ssValidateCuratorApplication(payload)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-curator-app-validate.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (plain object in, { ok, missing } out, no side effects), so the stub never
   affects behaviour — it only lets the module load and populate module.exports.

   CONTRACT under test (design.md "Property 1", Req 1.4, 2.1-2.6):
   ssValidateCuratorApplication(payload) -> { ok, missing } validating these
   stable keys (FIXED ORDER):
     • applicant_info : payload.applicant is an object with a non-empty (trimmed
                        length >= 1) identity string — `name` OR `username`.
     • genres         : Array.isArray(payload.genres) AND 1 <= length <= 6.
     • social_link    : typeof string AND trim().length >= 1.
     • terms          : payload.termsAccepted === true (STRICT boolean).
   The Reference_Clip is OPTIONAL — its presence/absence NEVER affects the result.
   `missing` lists exactly the failing keys (fixed order); ok === (missing.length===0).
   Null/undefined/non-object payload → ok:false with ALL keys missing. PURE:
   never throws, never mutates the input object.

   Feature: curator-application-approval, Property 1
   **Validates: Requirements 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// Stable key order the implementation appends failing keys in.
const KEY_ORDER = ['applicant_info', 'genres', 'social_link', 'terms'];

/* Independent oracle: recompute the documented `missing` list from scratch,
   in the contract's fixed key order, without reaching into module internals. */
function expectedMissing(payload) {
  const p = (payload && typeof payload === 'object') ? payload : null;
  const missing = [];

  const applicant = (p && p.applicant && typeof p.applicant === 'object') ? p.applicant : null;
  const nameOk = !!applicant && typeof applicant.name === 'string' && applicant.name.trim().length >= 1;
  const userOk = !!applicant && typeof applicant.username === 'string' && applicant.username.trim().length >= 1;
  if (!(nameOk || userOk)) missing.push('applicant_info');

  const genresOk = !!p && Array.isArray(p.genres) && p.genres.length >= 1 && p.genres.length <= 6;
  if (!genresOk) missing.push('genres');

  const linkOk = !!p && typeof p.social_link === 'string' && p.social_link.trim().length >= 1;
  if (!linkOk) missing.push('social_link');

  if (!p || p.termsAccepted !== true) missing.push('terms');

  return missing;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

let failed = 0;

console.log('Feature: curator-application-approval — application validator well-formedness property test\n');

// ── Generators ───────────────────────────────────────────────────────────────

// A trimmed-non-empty / whitespace-only / non-string identity value.
function identityValue() {
  return fc.oneof(
    fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim() !== ''), // valid
    fc.constantFrom('', '   ', '\t', '\n', '  \t '),                            // whitespace-only
    fc.constantFrom(0, 1, null, undefined, true, {}, [])                        // non-string
  );
}

// An applicant object with name/username each independently present/absent,
// plus sometimes a non-object applicant.
const applicantValue = fc.oneof(
  { weight: 6, arbitrary: fc.record({ name: identityValue(), username: identityValue() }, { requiredKeys: [] }) },
  { weight: 1, arbitrary: fc.constantFrom(null, undefined, 'nope', 42, [], true) }
);

// genres: arrays of length 0..8 (straddling the 1..6 bound) + non-array values.
const genresValue = fc.oneof(
  fc.array(fc.string(), { maxLength: 8 }),
  fc.constantFrom(null, undefined, 'Thriller', 42, {})
);

// social_link: valid / whitespace-only / empty / non-string.
const socialLinkValue = fc.oneof(
  fc.constantFrom('https://instagram.com/x', 'youtube.com/@x', 't'),            // valid
  fc.constantFrom('', '   ', '\t', '\n'),                                       // whitespace-only
  fc.constantFrom(null, undefined, 42, true, {})                               // non-string
);

// termsAccepted: strict true plus truthy near-misses.
const termsValue = fc.constantFrom(true, false, 'true', 1, 0, null, undefined, 'yes');

// reference_clip: present (various) or absent — MUST never affect the result.
const refClipValue = fc.oneof(
  fc.constantFrom('review-clips/u/1.mp4', ''),
  fc.constantFrom(null, undefined, 42, {})
);

const payloadObj = fc.record({
  applicant: applicantValue,
  genres: genresValue,
  social_link: socialLinkValue,
  termsAccepted: termsValue,
  reference_clip_path: refClipValue,
}, { requiredKeys: [] });   // any subset of keys may be present

// A guaranteed well-formed payload.
const wellFormedObj = fc.record({
  applicant: fc.record({ name: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length >= 1) }),
  genres: fc.array(fc.string(), { minLength: 1, maxLength: 6 }),
  social_link: fc.constantFrom('https://instagram.com/x', 'https://x.com/y'),
  termsAccepted: fc.constant(true),
}, { requiredKeys: ['applicant', 'genres', 'social_link', 'termsAccepted'] });

const payloadArg = fc.oneof(
  { weight: 6, arbitrary: payloadObj },
  { weight: 3, arbitrary: wellFormedObj },
  { weight: 1, arbitrary: fc.constantFrom(null, undefined, 0, '', 'x', 42, true, []) }
);

try {
  fc.assert(fc.property(payloadArg, (payload) => {
    const isObj = payload && typeof payload === 'object';
    const before = isObj ? JSON.parse(JSON.stringify(payload)) : payload;

    // 1) Never throws (calling it inside the property proves this).
    const r = ss.ssValidateCuratorApplication(payload);

    // 2) Well-shaped result.
    assert(r && typeof r === 'object', 'must return an object');
    assert(typeof r.ok === 'boolean', 'ok must be a boolean');
    assert(Array.isArray(r.missing), 'missing must be an array');

    // 3) ok === (missing.length === 0).
    assert(r.ok === (r.missing.length === 0),
      `ok (${r.ok}) must equal missing.length===0 (${r.missing.length === 0})`);

    // 4) missing contains EXACTLY the failing keys, in fixed order.
    const exp = expectedMissing(payload);
    assert(arraysEqual(r.missing, exp),
      `missing ${JSON.stringify(r.missing)} != expected ${JSON.stringify(exp)} for ${JSON.stringify(payload)}`);

    // 5) Every reported key is recognized.
    for (const k of r.missing) {
      assert(KEY_ORDER.indexOf(k) !== -1, `unexpected key in missing: ${k}`);
    }

    // 6) Null/undefined/non-object → ok:false with ALL keys missing.
    if (!isObj) {
      assert(r.ok === false, 'non-object payload must be ok:false');
      assert(arraysEqual(r.missing, KEY_ORDER), 'non-object payload must list ALL keys');
    }

    // 7) Reference clip NEVER changes the result — toggling it leaves ok/missing identical.
    if (isObj) {
      const withClip = Object.assign({}, payload, { reference_clip_path: 'review-clips/u/z.mp4' });
      const withoutClip = Object.assign({}, payload);
      delete withoutClip.reference_clip_path;
      const rc = ss.ssValidateCuratorApplication(withClip);
      const rn = ss.ssValidateCuratorApplication(withoutClip);
      assert(rc.ok === rn.ok && arraysEqual(rc.missing, rn.missing),
        'reference clip must NOT affect the result');
    }

    // 8) PURE: input object must not be mutated.
    if (isObj) {
      assert(deepEqual(payload, before), 'input object must NOT be mutated');
    }

    return true;
  }), { numRuns: ITER });

  // ── Explicit literal cases pinning the contract ──────────────────────────
  const valid = {
    applicant: { name: 'Jane Doe' },
    genres: ['Thriller', 'Drama'],
    social_link: 'https://instagram.com/janedoe',
    termsAccepted: true,
  };

  // Fully well-formed → ok:true, missing empty.
  let res = ss.ssValidateCuratorApplication(valid);
  assert(res.ok === true && res.missing.length === 0, 'fully valid → ok');

  // Well-formed via username instead of name.
  res = ss.ssValidateCuratorApplication({ ...valid, applicant: { username: 'janed' } });
  assert(res.ok === true, 'username identity → ok');

  // Well-formed WITH an optional reference clip.
  res = ss.ssValidateCuratorApplication({ ...valid, reference_clip_path: 'review-clips/u/1.mp4' });
  assert(res.ok === true && res.missing.length === 0, 'valid + reference clip → ok');

  // Null / non-object → all keys missing.
  res = ss.ssValidateCuratorApplication(null);
  assert(res.ok === false && arraysEqual(res.missing, KEY_ORDER), 'null → all keys missing');
  res = ss.ssValidateCuratorApplication(undefined);
  assert(res.ok === false && arraysEqual(res.missing, KEY_ORDER), 'undefined → all keys missing');
  res = ss.ssValidateCuratorApplication('nope');
  assert(res.ok === false && arraysEqual(res.missing, KEY_ORDER), 'string → all keys missing');
  assert(arraysEqual(ss.ssValidateCuratorApplication({}).missing, KEY_ORDER), 'empty object → all keys');

  // Each element broken individually → exactly that key fails.
  assert(arraysEqual(ss.ssValidateCuratorApplication({ ...valid, applicant: { name: '   ' } }).missing,
    ['applicant_info']), 'whitespace name → applicant_info');
  assert(arraysEqual(ss.ssValidateCuratorApplication({ ...valid, applicant: null }).missing,
    ['applicant_info']), 'null applicant → applicant_info');
  assert(arraysEqual(ss.ssValidateCuratorApplication({ ...valid, genres: [] }).missing,
    ['genres']), 'zero genres → genres');
  assert(arraysEqual(ss.ssValidateCuratorApplication({ ...valid, genres: ['a','b','c','d','e','f','g'] }).missing,
    ['genres']), 'seven genres → genres');
  assert(arraysEqual(ss.ssValidateCuratorApplication({ ...valid, genres: 'Thriller' }).missing,
    ['genres']), 'non-array genres → genres');
  assert(arraysEqual(ss.ssValidateCuratorApplication({ ...valid, social_link: '   ' }).missing,
    ['social_link']), 'whitespace social_link → social_link');
  assert(arraysEqual(ss.ssValidateCuratorApplication({ ...valid, social_link: 42 }).missing,
    ['social_link']), 'non-string social_link → social_link');
  assert(arraysEqual(ss.ssValidateCuratorApplication({ ...valid, termsAccepted: 'true' }).missing,
    ['terms']), 'non-strict-true terms → terms');
  assert(arraysEqual(ss.ssValidateCuratorApplication({ ...valid, termsAccepted: 1 }).missing,
    ['terms']), 'truthy-1 terms → terms');

  // Genres boundaries: 1 and 6 are valid.
  assert(ss.ssValidateCuratorApplication({ ...valid, genres: ['a'] }).ok === true, 'genres length 1 → ok');
  assert(ss.ssValidateCuratorApplication({ ...valid, genres: ['a','b','c','d','e','f'] }).ok === true, 'genres length 6 → ok');

  // Non-mutation on the literal valid payload.
  const snapshot = JSON.parse(JSON.stringify(valid));
  ss.ssValidateCuratorApplication(valid);
  assert(deepEqual(valid, snapshot), 'literal valid payload not mutated');

  console.log('  \u2713 Property 1');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 1\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
