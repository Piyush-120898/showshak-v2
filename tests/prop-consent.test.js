/* ═══════════════════════════════════════════════════════════════
   tests/prop-consent.test.js — Node property tests for the beta-consent-gate
   pure core in showshak-shared.js:
     • ssConsentComplete(consent)        — onboarding consent validator (Req 5)
     • ssCuratorTermsAccepted(acceptance)— curator-terms acceptance validator (Req 9.11)
     • ssPolicyNeedsCounselReview(body)  — counsel-review marker decision (Req 1.4 / 8.3)

   Plain Node (no framework) + fast-check; run with:
     node tests/prop-consent.test.js
   Auto-discovered by tests/run-all.js (it globs tests/*.test.js).

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helpers under test are PURE
   (plain objects / strings in, boolean out), so the stub never affects behaviour —
   it only lets the module load and populate module.exports.

   RED-FIRST: these three functions are not implemented yet (task 1.2 adds them),
   so every property here is EXPECTED TO FAIL until 1.2 drives them green. That is
   the correct state for task 1.1.

   Contracts under test (design.md "Correctness Properties"):
     ssConsentComplete(consent) → true IFF consent is a non-null object AND
       consent.affirmative === true AND consent.age18plus === true AND
       tos_version is a string with trimmed length ≥ 1 AND
       privacy_version is a string with trimmed length ≥ 1; else false. Total,
       never throws, no mutation, deterministic.
     ssCuratorTermsAccepted(acceptance) → true IFF acceptance is a non-null object
       AND acceptance.affirmative === true AND curator_version is a string with
       trimmed length ≥ 1; else false. Total, never throws, no mutation, deterministic.
     ssPolicyNeedsCounselReview(body) → true IFF body is not a non-empty string OR
       body matches /\[[^\]]+\]/; else false. Total, never throws, no mutation.

   Feature: beta-consent-gate, Properties 1-7
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

/* ── Independent oracles: faithfully recompute each documented contract so the
   property assertions never reach into module internals. ─────────────────── */

// ssConsentComplete contract (Req 5.1–5.6).
function complete(c) {
  if (!c || typeof c !== 'object') return false;
  if (c.affirmative !== true) return false;
  if (c.age18plus !== true) return false;
  if (typeof c.tos_version !== 'string' || c.tos_version.trim().length < 1) return false;
  if (typeof c.privacy_version !== 'string' || c.privacy_version.trim().length < 1) return false;
  return true;
}

// ssCuratorTermsAccepted contract (Req 9.11).
function curatorOk(a) {
  if (!a || typeof a !== 'object') return false;
  if (a.affirmative !== true) return false;
  if (typeof a.curator_version !== 'string' || a.curator_version.trim().length < 1) return false;
  return true;
}

// ssPolicyNeedsCounselReview contract (Req 1.4): not a non-empty string → true;
// contains a bracketed [..] token → true; otherwise (non-empty, no token) → false.
function needsReview(body) {
  if (typeof body !== 'string' || body.length === 0) return true;
  return /\[[^\]]+\]/.test(body);
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

// Best-effort structural snapshot for the "input unchanged" check.
function snapshot(v) {
  try { return JSON.stringify(v); } catch (e) { return String(v); }
}

/* ── Generators ─────────────────────────────────────────────────────────── */

// Whitespace padding (incl. empty) used to wrap valid version cores.
const wsPad = fc.constantFrom('', ' ', '  ', '\t', '\n', ' \t\n ');

// A version string whose trimmed length is ≥ 1 (optionally whitespace-padded).
const validVersion = fc.tuple(
  wsPad,
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length >= 1),
  wsPad
).map(([a, b, c]) => a + b + c);

// A version that is invalid: empty/all-whitespace string, missing, or non-string.
const invalidVersion = fc.oneof(
  fc.constantFrom('', '   ', '\t', '\n', '  \t\n  '),
  fc.constantFrom(undefined, null, 0, 1, 1.5, true, false, {}, [])
);

// A flag that is NOT strictly boolean true (incl. truthy non-booleans).
const badFlag = fc.constantFrom(1, 'true', 'false', 0, false, null, undefined, '', {}, [], 1.0);

// A flag drawn from valid (strict true) and invalid pools.
const anyFlag = fc.oneof(fc.constant(true), badFlag);
// A version drawn from valid and invalid pools.
const anyVersion = fc.oneof(validVersion, invalidVersion);

let failed = 0;
function prop(name, fn) {
  try { fn(); console.log('  \u2713 ' + name); }
  catch (e) { failed++; console.log('  \u2717 ' + name + '\n      ' + (e && e.message)); }
}

console.log('Feature: beta-consent-gate — consent + curator core property tests\n');

/* ─────────────────────────────────────────────────────────────────────────
   Property 1: Complete consent is accepted
   ───────────────────────────────────────────────────────────────────────── */
// Feature: beta-consent-gate, Property 1: Complete consent is accepted — for any
// object with affirmative===true, age18plus===true, and non-empty (trimmed) tos &
// privacy version strings, ssConsentComplete returns the strict boolean true.
// **Validates: Requirements 5.1, 2.6**
prop('Property 1: complete consent → true', () => {
  const completeConsent = fc.record({
    affirmative: fc.constant(true),
    age18plus: fc.constant(true),
    tos_version: validVersion,
    privacy_version: validVersion,
  });
  fc.assert(fc.property(completeConsent, (c) => {
    const r = ss.ssConsentComplete(c);
    assert(r === true, `complete consent must be true, got ${JSON.stringify(r)} for ${JSON.stringify(c)}`);
    return true;
  }), { numRuns: ITER });
});

/* ─────────────────────────────────────────────────────────────────────────
   Property 2: Any incomplete consent is rejected
   ───────────────────────────────────────────────────────────────────────── */
// Feature: beta-consent-gate, Property 2: Any incomplete consent is rejected —
// when affirmative is not strictly true (incl. 1/'true'/0/missing), age18plus is
// not strictly true, tos_version/privacy_version is a non-string/empty/all-whitespace,
// or the input is a non-object/null/undefined, ssConsentComplete returns strict false.
// **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 2.5, 2.11, 3.7**
prop('Property 2: incomplete consent → false', () => {
  const mixedConsent = fc.record({
    affirmative: anyFlag,
    age18plus: anyFlag,
    tos_version: anyVersion,
    privacy_version: anyVersion,
  }, { requiredKeys: [] }); // any subset of keys → randomizes missing fields too
  // Keep only genuinely-incomplete inputs (oracle says false), incl. non-objects.
  const incompleteArg = fc.oneof(mixedConsent, fc.anything()).filter((c) => !complete(c));
  fc.assert(fc.property(incompleteArg, (c) => {
    const r = ss.ssConsentComplete(c);
    assert(r === false, `incomplete consent must be false, got ${JSON.stringify(r)} for ${JSON.stringify(c)}`);
    return true;
  }), { numRuns: ITER });

  // Explicit literal cases pinning the contract.
  const base = { affirmative: true, age18plus: true, tos_version: '1.0-beta', privacy_version: '1.0-beta' };
  assert(ss.ssConsentComplete({ ...base, affirmative: 1 }) === false, 'affirmative:1 → false');
  assert(ss.ssConsentComplete({ ...base, affirmative: 'true' }) === false, "affirmative:'true' → false");
  assert(ss.ssConsentComplete({ ...base, affirmative: 0 }) === false, 'affirmative:0 → false');
  assert(ss.ssConsentComplete({ ...base, age18plus: 1 }) === false, 'age18plus:1 → false');
  assert(ss.ssConsentComplete({ ...base, age18plus: undefined }) === false, 'missing age18plus → false');
  assert(ss.ssConsentComplete({ ...base, tos_version: '' }) === false, 'empty tos → false');
  assert(ss.ssConsentComplete({ ...base, tos_version: '   ' }) === false, 'whitespace tos → false');
  assert(ss.ssConsentComplete({ ...base, tos_version: 1 }) === false, 'non-string tos → false');
  assert(ss.ssConsentComplete({ ...base, privacy_version: '' }) === false, 'empty privacy → false');
  assert(ss.ssConsentComplete(null) === false, 'null → false');
  assert(ss.ssConsentComplete(undefined) === false, 'undefined → false');
  assert(ss.ssConsentComplete('x') === false, 'string → false');
  assert(ss.ssConsentComplete(42) === false, 'number → false');
});

/* ─────────────────────────────────────────────────────────────────────────
   Property 3: Validator is total and strictly boolean
   ───────────────────────────────────────────────────────────────────────── */
// Feature: beta-consent-gate, Property 3: ssConsentComplete is total and strictly
// boolean — for any input value of any type it does not throw and returns a value
// that is strictly true or strictly false.
// **Validates: Requirements 5.7**
prop('Property 3: ssConsentComplete total + strictly boolean', () => {
  fc.assert(fc.property(fc.anything(), (v) => {
    const r = ss.ssConsentComplete(v); // throwing here fails the property
    assert(r === true || r === false, `must be strict boolean, got ${JSON.stringify(r)} for ${JSON.stringify(v)}`);
    return true;
  }), { numRuns: ITER });
});

/* ─────────────────────────────────────────────────────────────────────────
   Property 4: Validator is pure (deterministic, non-mutating)
   ───────────────────────────────────────────────────────────────────────── */
// Feature: beta-consent-gate, Property 4: ssConsentComplete is pure — for any input
// it produces no side effects, does not mutate its input, and returns an identical
// output for identical input on every invocation.
// **Validates: Requirements 5.8**
prop('Property 4: ssConsentComplete pure (deterministic + no mutation)', () => {
  const completeConsent = fc.record({
    affirmative: fc.constant(true), age18plus: fc.constant(true),
    tos_version: validVersion, privacy_version: validVersion,
  });
  const mixedConsent = fc.record({
    affirmative: anyFlag, age18plus: anyFlag, tos_version: anyVersion, privacy_version: anyVersion,
  }, { requiredKeys: [] });
  const anyConsent = fc.oneof(completeConsent, mixedConsent, fc.anything());
  fc.assert(fc.property(anyConsent, (c) => {
    deepFreeze(c);
    const before = snapshot(c);
    const r1 = ss.ssConsentComplete(c);
    const r2 = ss.ssConsentComplete(c);
    assert(r1 === r2, `non-deterministic: ${JSON.stringify(r1)} != ${JSON.stringify(r2)}`);
    assert(snapshot(c) === before, 'input was mutated');
    return true;
  }), { numRuns: ITER });
});

/* ─────────────────────────────────────────────────────────────────────────
   Property 5: Counsel-review marker tracks placeholder tokens
   ───────────────────────────────────────────────────────────────────────── */
// Feature: beta-consent-gate, Property 5: ssPolicyNeedsCounselReview tracks placeholder
// tokens — returns true when the body is not a non-empty string OR contains a bracketed
// [..] placeholder token, and false when the body is a non-empty string with no token.
// **Validates: Requirements 1.4, 8.3**
prop('Property 5: ssPolicyNeedsCounselReview tracks [..] tokens', () => {
  // A body guaranteed to contain a bracketed [..] token.
  const tokenBody = fc.tuple(
    fc.string(),
    fc.string({ minLength: 1, maxLength: 12 }).filter((s) => !s.includes(']')),
    fc.string()
  ).map(([a, b, c]) => a + '[' + b + ']' + c);
  // A non-empty body guaranteed to contain NO bracketed token.
  const noTokenBody = fc.string({ minLength: 1, maxLength: 40 }).filter((s) => !/\[[^\]]+\]/.test(s));
  // Non-string / empty bodies plus the open generators.
  const weirdBody = fc.constantFrom('', null, undefined, 0, 1, true, false, {}, [], NaN);
  const anyBody = fc.oneof(tokenBody, noTokenBody, weirdBody, fc.string(), fc.anything());

  fc.assert(fc.property(anyBody, (body) => {
    const r = ss.ssPolicyNeedsCounselReview(body);
    assert(r === true || r === false, `must be strict boolean, got ${JSON.stringify(r)}`);
    assert(r === needsReview(body), `result ${r} != expected ${needsReview(body)} for ${JSON.stringify(body)}`);
    return true;
  }), { numRuns: ITER });

  // Explicit literal cases pinning the contract.
  assert(ss.ssPolicyNeedsCounselReview('') === true, 'empty string → true');
  assert(ss.ssPolicyNeedsCounselReview(null) === true, 'null → true');
  assert(ss.ssPolicyNeedsCounselReview(undefined) === true, 'undefined → true');
  assert(ss.ssPolicyNeedsCounselReview(123) === true, 'non-string → true');
  assert(ss.ssPolicyNeedsCounselReview('Effective date: [EFFECTIVE_DATE]') === true, 'bracketed token → true');
  assert(ss.ssPolicyNeedsCounselReview('Final policy text, no tokens.') === false, 'clean text → false');
});

/* ─────────────────────────────────────────────────────────────────────────
   Property 6: Curator-terms acceptance validity
   ───────────────────────────────────────────────────────────────────────── */
// Feature: beta-consent-gate, Property 6: Curator-terms acceptance validity —
// ssCuratorTermsAccepted returns true iff the input is a non-null object whose
// affirmative is strictly true and whose curator_version is a non-empty (trimmed)
// string; for a broken affirmative (1/'true'/0/missing), a non-string/empty/all-
// whitespace curator_version, and any non-object/null/undefined it returns false.
// **Validates: Requirements 9.11, 9.2, 9.14**
prop('Property 6: curator-terms acceptance validity', () => {
  const validAcceptance = fc.record({
    affirmative: fc.constant(true),
    curator_version: validVersion,
  });
  fc.assert(fc.property(validAcceptance, (a) => {
    const r = ss.ssCuratorTermsAccepted(a);
    assert(r === true, `valid acceptance must be true, got ${JSON.stringify(r)} for ${JSON.stringify(a)}`);
    return true;
  }), { numRuns: ITER });

  const mixedAcceptance = fc.record({
    affirmative: anyFlag,
    curator_version: anyVersion,
  }, { requiredKeys: [] });
  const brokenArg = fc.oneof(mixedAcceptance, fc.anything()).filter((a) => !curatorOk(a));
  fc.assert(fc.property(brokenArg, (a) => {
    const r = ss.ssCuratorTermsAccepted(a);
    assert(r === false, `broken acceptance must be false, got ${JSON.stringify(r)} for ${JSON.stringify(a)}`);
    return true;
  }), { numRuns: ITER });

  // Explicit literal cases pinning the contract.
  assert(ss.ssCuratorTermsAccepted({ affirmative: true, curator_version: '1.0-beta' }) === true, 'valid → true');
  assert(ss.ssCuratorTermsAccepted({ affirmative: true, curator_version: '  1.0  ' }) === true, 'padded version → true');
  assert(ss.ssCuratorTermsAccepted({ affirmative: 1, curator_version: '1.0' }) === false, 'affirmative:1 → false');
  assert(ss.ssCuratorTermsAccepted({ affirmative: 'true', curator_version: '1.0' }) === false, "affirmative:'true' → false");
  assert(ss.ssCuratorTermsAccepted({ affirmative: 0, curator_version: '1.0' }) === false, 'affirmative:0 → false');
  assert(ss.ssCuratorTermsAccepted({ curator_version: '1.0' }) === false, 'missing affirmative → false');
  assert(ss.ssCuratorTermsAccepted({ affirmative: true, curator_version: '' }) === false, 'empty version → false');
  assert(ss.ssCuratorTermsAccepted({ affirmative: true, curator_version: '   ' }) === false, 'whitespace version → false');
  assert(ss.ssCuratorTermsAccepted({ affirmative: true, curator_version: 1 }) === false, 'non-string version → false');
  assert(ss.ssCuratorTermsAccepted(null) === false, 'null → false');
  assert(ss.ssCuratorTermsAccepted('x') === false, 'string → false');
});

/* ─────────────────────────────────────────────────────────────────────────
   Property 7: Curator-terms validator is total, strictly boolean, and pure
   ───────────────────────────────────────────────────────────────────────── */
// Feature: beta-consent-gate, Property 7: ssCuratorTermsAccepted is total, strictly
// boolean, and pure — for any input it does not throw, returns strictly true/false,
// and (deep-frozen, called twice) is deterministic and does not mutate its input.
// **Validates: Requirements 9.11**
prop('Property 7: ssCuratorTermsAccepted total + strictly boolean + pure', () => {
  // Totality + strict boolean.
  fc.assert(fc.property(fc.anything(), (v) => {
    const r = ss.ssCuratorTermsAccepted(v); // throwing here fails the property
    assert(r === true || r === false, `must be strict boolean, got ${JSON.stringify(r)} for ${JSON.stringify(v)}`);
    return true;
  }), { numRuns: ITER });

  // Determinism + no mutation.
  const validAcceptance = fc.record({ affirmative: fc.constant(true), curator_version: validVersion });
  const mixedAcceptance = fc.record({ affirmative: anyFlag, curator_version: anyVersion }, { requiredKeys: [] });
  const anyAcceptance = fc.oneof(validAcceptance, mixedAcceptance, fc.anything());
  fc.assert(fc.property(anyAcceptance, (a) => {
    deepFreeze(a);
    const before = snapshot(a);
    const r1 = ss.ssCuratorTermsAccepted(a);
    const r2 = ss.ssCuratorTermsAccepted(a);
    assert(r1 === r2, `non-deterministic: ${JSON.stringify(r1)} != ${JSON.stringify(r2)}`);
    assert(snapshot(a) === before, 'input was mutated');
    return true;
  }), { numRuns: ITER });
});

console.log('\n' + (failed ? `FAILED: ${failed} propert${failed === 1 ? 'y' : 'ies'}` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
