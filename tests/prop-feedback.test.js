/* ═══════════════════════════════════════════════════════════════
   tests/prop-feedback.test.js — property test for the pure support-submission
   builder `ssBuildFeedbackSubmission(kind, message, opts)` in showshak-shared.js.
   Plain Node + fast-check:  node tests/prop-feedback.test.js
   Install the shared DOM/window stub BEFORE requiring shared.js (it runs DOM
   setup on load). The helper under test is PURE, so the stub never affects it.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

const MAX = ss.SS_FEEDBACK_MAX;              // 2000
const KINDS = ss.SS_FEEDBACK_KINDS;          // ['feedback','problem']

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
let failed = 0;

console.log('Feature: support — feedback/problem submission builder\n');

// Property 1 — ok/overMax/payload invariants over trimmed message length + kind.
try {
  const wsChar = fc.constantFrom(' ', '\t', '\n', '\r');
  const ws = fc.array(wsChar, { maxLength: 5 }).map(a => a.join(''));
  const coreChar = fc.constantFrom('a', 'X', '9', '.', 'é', '🎬');
  const lenGen = fc.oneof(
    fc.constantFrom(0, 1, 2, MAX - 1, MAX, MAX + 1, MAX + 50),
    fc.integer({ min: 0, max: 2100 })
  );
  const kindGen = fc.oneof(fc.constantFrom('feedback', 'problem', 'other', '', 'FEEDBACK'), fc.string({ maxLength: 4 }));
  const msgGen = fc.record({ lead: ws, len: lenGen, trail: ws, c: coreChar })
    .map(({ lead, len, trail, c }) => lead + (len > 0 ? c.repeat(len) : '') + trail);

  fc.assert(fc.property(kindGen, msgGen, (kind, message) => {
    const r = ss.ssBuildFeedbackSubmission(kind, message);
    const vlen = message.trim().length;
    const validKind = KINDS.indexOf(String(kind)) !== -1;

    assert(r.length === vlen, 'length must equal trimmed length');
    assert(r.validKind === validKind, 'validKind mismatch');
    assert(r.overMax === (vlen > MAX), 'overMax mismatch');
    assert(r.ok === (validKind && vlen >= 1 && vlen <= MAX), `ok mismatch (validKind=${validKind}, vlen=${vlen})`);

    // Invalid kind can NEVER be ok, regardless of message.
    if (!validKind) assert(r.ok === false, 'invalid kind must never be ok');
    // Empty/whitespace-only message can NEVER be ok, regardless of kind.
    if (vlen === 0) assert(r.ok === false, 'empty message must never be ok');

    // payload mirrors the normalized values.
    assert(r.payload.kind === String(kind), 'payload.kind must be the coerced kind');
    assert(r.payload.message === message.trim(), 'payload.message must be trimmed');
    return true;
  }), { numRuns: ITER });

  console.log('  \u2713 Property 1 (ok / overMax / payload invariants)');
} catch (e) { failed++; console.log('  \u2717 Property 1\n      ' + e.message); }

// Property 2 — email is advisory: it never influences ok, and only a valid-looking
// address survives (else '' and payload.email === null).
try {
  const emailGen = fc.oneof(
    fc.constantFrom('a@b.co', 'x.y@z.io', 'user@sub.domain.in'),   // valid-looking
    fc.constantFrom('', '   ', 'not-an-email', '@no.local', 'no@domain', 'a@b'), // invalid
    fc.string({ maxLength: 20 })
  );
  fc.assert(fc.property(emailGen, fc.string({ maxLength: 60 }), (email, message) => {
    const withEmail = ss.ssBuildFeedbackSubmission('feedback', message, { email });
    const without   = ss.ssBuildFeedbackSubmission('feedback', message);
    // Email must NOT change ok.
    assert(withEmail.ok === without.ok, 'email must never influence ok');
    // Kept email is either '' or a string containing exactly one '@' with a dotted domain.
    if (withEmail.email !== '') {
      assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(withEmail.email), 'kept email must look like an email');
      assert(withEmail.payload.email === withEmail.email, 'payload.email must equal kept email');
    } else {
      assert(withEmail.payload.email === null, 'dropped email → payload.email null');
    }
    return true;
  }), { numRuns: ITER });
  console.log('  \u2713 Property 2 (email advisory, never blocks)');
} catch (e) { failed++; console.log('  \u2717 Property 2\n      ' + e.message); }

// Explicit boundary + junk cases.
try {
  assert(ss.ssBuildFeedbackSubmission('feedback', '').ok === false, 'empty feedback not ok');
  assert(ss.ssBuildFeedbackSubmission('feedback', '   ').ok === false, 'whitespace feedback not ok');
  assert(ss.ssBuildFeedbackSubmission('problem', 'x').ok === true, 'single-char problem ok');
  assert(ss.ssBuildFeedbackSubmission('other', 'hello').ok === false, 'unknown kind not ok');
  assert(ss.ssBuildFeedbackSubmission('feedback', 'x'.repeat(MAX)).ok === true, 'MAX ok');
  assert(ss.ssBuildFeedbackSubmission('feedback', 'x'.repeat(MAX + 1)).ok === false, 'over MAX not ok');
  // junk never throws
  assert(ss.ssBuildFeedbackSubmission(null, null).ok === false, 'null/null not ok, no throw');
  assert(ss.ssBuildFeedbackSubmission(undefined, 123).ok === false, 'undefined/number not ok, no throw');
  assert(ss.ssBuildFeedbackSubmission('feedback', 'hi', 'notanobject').ok === true, 'bad opts ignored');
  console.log('  \u2713 Property 3 (boundaries + junk)');
} catch (e) { failed++; console.log('  \u2717 Property 3\n      ' + e.message); }

console.log('\n' + (failed ? `FAILED: ${failed} propert${failed === 1 ? 'y' : 'ies'}` : 'ALL PASSED'));
process.exitCode = failed ? 1 : 0;
