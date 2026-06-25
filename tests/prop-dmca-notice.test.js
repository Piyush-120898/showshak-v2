/* ═══════════════════════════════════════════════════════════════
   tests/prop-dmca-notice.test.js — Node property test for the
   dmca-moderation-scaffolding DMCA-notice well-formedness pure helper
   `ssDmcaNoticeWellFormed(notice)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-dmca-notice.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE
   (plain object in, { ok, missing } out, no side effects), so the stub never
   affects behaviour — it only lets the module load and populate module.exports.

   CONTRACT under test (design.md "Property 2", Req 3.2/3.4/3.6):
   ssDmcaNoticeWellFormed(notice) -> { ok, missing } validating these stable keys:
     • work_identification : string, trimmed length 1..2000
     • target             : a non-empty `content_id` string OR a `target_url`
                            string trimmed length 1..2000 (one required)
     • complainant_name    : string, trimmed length 1..200
     • complainant_email   : matches /^[^@\s]+@[^@\s]+\.[^@\s]+$/
     • good_faith          : === true (strict boolean)
     • accuracy_authority  : === true (strict boolean)
     • signature           : string, trimmed length 1..200
   `missing` lists exactly the failing element keys (fixed order);
   ok === (missing.length === 0). Null/undefined/non-object notice → ok:false with
   ALL keys in missing. Whitespace-only strings count as empty; over-bound strings
   fail. PURE: never throws, never mutates the input object.

   Feature: dmca-moderation-scaffolding, Property 2
   **Validates: Requirements 3.2, 3.4, 3.6**
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// Stable key order the implementation appends failing keys in.
const KEY_ORDER = [
  'work_identification', 'target', 'complainant_name',
  'complainant_email', 'good_faith', 'accuracy_authority', 'signature',
];

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// mirror of _ssTrimmedLenInBounds: string with trimmed length within [min,max].
function trimmedLenInBounds(v, min, max) {
  if (typeof v !== 'string') return false;
  const len = v.trim().length;
  return len >= min && len <= max;
}

/* Independent oracle: recompute the documented `missing` list from scratch,
   in the contract's fixed key order, without reaching into module internals. */
function expectedMissing(notice) {
  const n = (notice && typeof notice === 'object') ? notice : null;
  const missing = [];

  if (!n || !trimmedLenInBounds(n.work_identification, 1, 2000)) missing.push('work_identification');

  const contentIdOk = !!n && typeof n.content_id === 'string' && n.content_id.trim().length >= 1;
  const targetUrlOk = !!n && trimmedLenInBounds(n.target_url, 1, 2000);
  if (!(contentIdOk || targetUrlOk)) missing.push('target');

  if (!n || !trimmedLenInBounds(n.complainant_name, 1, 200)) missing.push('complainant_name');

  if (!n || typeof n.complainant_email !== 'string' || !EMAIL_RE.test(n.complainant_email)) missing.push('complainant_email');

  if (!n || n.good_faith !== true) missing.push('good_faith');
  if (!n || n.accuracy_authority !== true) missing.push('accuracy_authority');

  if (!n || !trimmedLenInBounds(n.signature, 1, 200)) missing.push('signature');

  return missing;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// Cheap structural deep-equal for the (JSON-serialisable) notice objects we generate.
function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

let failed = 0;

console.log('Feature: dmca-moderation-scaffolding — DMCA notice well-formedness property test\n');

// ── Generators ───────────────────────────────────────────────────────────────

// Bounded text: valid (1..max), whitespace-only (empty after trim), over-bound,
// and non-string values.
function boundedText(max) {
  return fc.oneof(
    fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim() !== ''), // valid
    fc.constantFrom('a', 'x'.repeat(Math.min(max, 50))),                       // valid fixed
    fc.constantFrom('', '   ', '\t', '\n', '  \t '),                            // whitespace-only → empty
    fc.constant('z'.repeat(max + 1)),                                           // over-bound
    fc.constantFrom(0, 1, null, undefined, true, {}, [])                        // non-string
  );
}

// Email values: well-formed and various malformed shapes plus non-strings.
const emailValue = fc.oneof(
  fc.constantFrom(
    'a@b.co', 'user@example.com', 'x.y@sub.domain.org', 'q+tag@mail.io'        // valid
  ),
  fc.constantFrom(
    '', '   ', 'plainaddress', 'no-at-sign', 'a@b', 'a@b.', '@b.co', 'a@.co',
    'a b@c.co', 'a@b c.co', 'a@@b.co', 'a@b.c d'                                // malformed
  ),
  fc.constantFrom(null, undefined, 42, true, {})                               // non-string
);

// Boolean affirmation values: strict true plus near-misses (truthy non-true).
const boolValue = fc.constantFrom(true, false, 'true', 1, 0, null, undefined, 'yes');

// content_id / target_url target fields: present/absent/valid/invalid.
const contentIdValue = fc.oneof(
  fc.constantFrom('clip-123', 'abc', '  c  '),                                  // valid (trim>=1)
  fc.constantFrom('', '   ', null, undefined, 42, true)                         // invalid
);
const targetUrlValue = fc.oneof(
  fc.constantFrom('https://x.io/c/1', 'u'),                                     // valid
  fc.constant('h'.repeat(2001)),                                               // over-bound
  fc.constantFrom('', '   ', null, undefined, 99, {})                          // invalid
);

// A notice object with each field independently present/absent (randomized).
const noticeObj = fc.record({
  work_identification: boundedText(2000),
  content_id: contentIdValue,
  target_url: targetUrlValue,
  complainant_name: boundedText(200),
  complainant_email: emailValue,
  good_faith: boolValue,
  accuracy_authority: boolValue,
  signature: boundedText(200),
}, { requiredKeys: [] });   // any subset of keys may be present

// A guaranteed well-formed notice (with one of the two target forms chosen).
const wellFormedObj = fc.record({
  work_identification: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length >= 1),
  complainant_name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length >= 1),
  complainant_email: fc.constantFrom('a@b.co', 'user@example.com', 'x.y@sub.domain.org'),
  signature: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length >= 1),
  target: fc.oneof(
    fc.record({ content_id: fc.constantFrom('clip-1', 'abc-9') }),
    fc.record({ target_url: fc.constantFrom('https://x.io/1', 'u') })
  ),
}).map((r) => Object.assign({
  work_identification: r.work_identification,
  complainant_name: r.complainant_name,
  complainant_email: r.complainant_email,
  signature: r.signature,
  good_faith: true,
  accuracy_authority: true,
}, r.target));

// The full notice argument: usually an object, sometimes null/undefined/non-object.
const noticeArg = fc.oneof(
  { weight: 6, arbitrary: noticeObj },
  { weight: 3, arbitrary: wellFormedObj },
  { weight: 1, arbitrary: fc.constantFrom(null, undefined, 0, '', 'x', 42, true, []) }
);

try {
  fc.assert(fc.property(noticeArg, (notice) => {
    // Deep-clone the input BEFORE the call to prove non-mutation afterwards.
    const isObj = notice && typeof notice === 'object';
    const before = isObj ? JSON.parse(JSON.stringify(notice)) : notice;

    // 1) Never throws (calling it inside the property already proves this).
    const r = ss.ssDmcaNoticeWellFormed(notice);

    // 2) Always returns a well-shaped result.
    assert(r && typeof r === 'object', 'must return an object');
    assert(typeof r.ok === 'boolean', 'ok must be a boolean');
    assert(Array.isArray(r.missing), 'missing must be an array');

    // 3) ok === (missing.length === 0).
    assert(r.ok === (r.missing.length === 0),
      `ok (${r.ok}) must equal missing.length===0 (${r.missing.length === 0})`);

    // 4) missing contains EXACTLY the failing keys, in the contract's fixed order.
    const exp = expectedMissing(notice);
    assert(arraysEqual(r.missing, exp),
      `missing ${JSON.stringify(r.missing)} != expected ${JSON.stringify(exp)} for ${JSON.stringify(notice)}`);

    // 5) Every reported key is a recognized element key.
    for (const k of r.missing) {
      assert(KEY_ORDER.indexOf(k) !== -1, `unexpected key in missing: ${k}`);
    }

    // 6) Null/undefined/non-object notice → ok:false with ALL keys missing.
    if (!isObj) {
      assert(r.ok === false, 'non-object notice must be ok:false');
      assert(arraysEqual(r.missing, KEY_ORDER), 'non-object notice must list ALL keys');
    }

    // 7) PURE: the input object must not be mutated.
    if (isObj) {
      assert(deepEqual(notice, before), 'input object must NOT be mutated');
    }

    return true;
  }), { numRuns: ITER });

  // ── Explicit literal cases pinning the contract ──────────────────────────
  const valid = {
    work_identification: 'My song "X"',
    content_id: 'clip-42',
    complainant_name: 'Jane Doe',
    complainant_email: 'jane@example.com',
    good_faith: true,
    accuracy_authority: true,
    signature: 'Jane Doe',
  };

  // Fully well-formed (content_id target) → ok:true, missing empty.
  let res = ss.ssDmcaNoticeWellFormed(valid);
  assert(res.ok === true && res.missing.length === 0, 'fully valid (content_id) → ok');

  // Fully well-formed via target_url instead of content_id.
  const validUrl = { ...valid, content_id: undefined, target_url: 'https://showshak.app/c/42' };
  res = ss.ssDmcaNoticeWellFormed(validUrl);
  assert(res.ok === true && res.missing.length === 0, 'fully valid (target_url) → ok');

  // Null / non-object → all keys missing.
  res = ss.ssDmcaNoticeWellFormed(null);
  assert(res.ok === false && arraysEqual(res.missing, KEY_ORDER), 'null → all keys missing');
  res = ss.ssDmcaNoticeWellFormed(undefined);
  assert(res.ok === false && arraysEqual(res.missing, KEY_ORDER), 'undefined → all keys missing');
  res = ss.ssDmcaNoticeWellFormed('nope');
  assert(res.ok === false && arraysEqual(res.missing, KEY_ORDER), 'string → all keys missing');

  // Each element broken individually → exactly that key fails.
  assert(arraysEqual(ss.ssDmcaNoticeWellFormed({ ...valid, work_identification: '   ' }).missing,
    ['work_identification']), 'whitespace work_identification → that key');
  assert(arraysEqual(ss.ssDmcaNoticeWellFormed({ ...valid, work_identification: 'z'.repeat(2001) }).missing,
    ['work_identification']), 'over-bound work_identification → that key');
  // Neither content_id nor target_url → target fails.
  assert(arraysEqual(ss.ssDmcaNoticeWellFormed({ ...valid, content_id: undefined }).missing,
    ['target']), 'no target → target key');
  assert(arraysEqual(ss.ssDmcaNoticeWellFormed({ ...valid, content_id: '   ' }).missing,
    ['target']), 'whitespace content_id, no url → target key');
  assert(arraysEqual(ss.ssDmcaNoticeWellFormed({ ...valid, complainant_name: '' }).missing,
    ['complainant_name']), 'empty name → that key');
  assert(arraysEqual(ss.ssDmcaNoticeWellFormed({ ...valid, complainant_email: 'bad' }).missing,
    ['complainant_email']), 'malformed email → that key');
  assert(arraysEqual(ss.ssDmcaNoticeWellFormed({ ...valid, good_faith: 'true' }).missing,
    ['good_faith']), 'non-strict-true good_faith → that key');
  assert(arraysEqual(ss.ssDmcaNoticeWellFormed({ ...valid, accuracy_authority: 1 }).missing,
    ['accuracy_authority']), 'non-strict-true accuracy_authority → that key');
  assert(arraysEqual(ss.ssDmcaNoticeWellFormed({ ...valid, signature: 'z'.repeat(201) }).missing,
    ['signature']), 'over-bound signature → that key');

  // Empty object → all keys missing, in fixed order.
  assert(arraysEqual(ss.ssDmcaNoticeWellFormed({}).missing, KEY_ORDER), 'empty object → all keys');

  // Non-mutation on the literal valid notice.
  const snapshot = JSON.parse(JSON.stringify(valid));
  ss.ssDmcaNoticeWellFormed(valid);
  assert(deepEqual(valid, snapshot), 'literal valid notice not mutated');

  console.log('  \u2713 Property 2');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 2\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
