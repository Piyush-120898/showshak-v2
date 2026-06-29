/* ═══════════════════════════════════════════════════════════════
   tests/prop-consent-gate.test.js — Node property test for the post-login
   consent-gate decision `ssConsentGateDecision(state)` in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-consent-gate.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper under test is PURE.

   CONTEXT (consent-gate-funnel-bypass): the DPDP affirmative-consent + 18+ gate
   was only wired into the landing onboarding, so the guest-first signup funnel
   (in-app OAuth/email sheet + post-login onboarding) created accounts without
   recording consent. The fix routes EVERY auth path through one post-login
   chokepoint whose decision is this pure function. The invariant: an
   authenticated subject without a recorded consent is gated (fail-closed),
   guests are never gated (browse-before-signup preserved), and an
   already-consented subject is never re-prompted (idempotency).

   Properties:
     1  Truth table — gate iff (authenticated === true AND consentStamped !== true).
     2  Guests never gated (authenticated !== true ⇒ false).
     3  Idempotency — already-consented (authenticated AND consentStamped===true) ⇒ false.
     4  Fail-closed — authenticated with any non-true consentStamped ⇒ true (gate).
     5  Totality / defensiveness — never throws, always a boolean; garbage ⇒ false.
     6  Purity — does not mutate the input state.
═══════════════════════════════════════════════════════════════ */
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

let failed = 0;
function prop(name, fn) {
  try { fn(); console.log('  \u2713 ' + name); }
  catch (e) { failed++; console.log('  \u2717 ' + name + '\n      ' + e.message); }
}

console.log('Feature: consent-gate-funnel-bypass — post-login consent-gate decision property test\n');

assert(typeof ss.ssConsentGateDecision === 'function', 'ssConsentGateDecision is not exported');

const bool = () => fc.boolean();
// Anything-but-strict-true, to exercise the fail-closed branch.
const notTrue = () => fc.constantFrom(false, undefined, null, 0, 1, '', 'true', NaN, 'yes');
const garbage = () => fc.oneof(
  fc.constantFrom(undefined, null, NaN, Infinity, -Infinity, 0, 1, -1, '', '0', 'x', true, false),
  fc.integer(), fc.double(), fc.string(),
  fc.array(fc.anything(), { maxLength: 5 }), fc.object(), fc.anything()
);

// Property 1: Truth table — gate iff (authenticated === true AND consentStamped !== true).
prop('Property 1: truth table', () => {
  fc.assert(fc.property(fc.anything(), fc.anything(), (authenticated, consentStamped) => {
    const out = ss.ssConsentGateDecision({ authenticated, consentStamped });
    const expected = (authenticated === true) && (consentStamped !== true);
    assert(out === expected,
      `expected ${expected} for {authenticated:${show(authenticated)},consentStamped:${show(consentStamped)}}, got ${show(out)}`);
    return true;
  }), { numRuns: ITER });
});

// Property 2: Guests are never gated (authenticated !== true).
prop('Property 2: guests never gated', () => {
  fc.assert(fc.property(garbage(), (consentStamped) => {
    // authenticated absent / falsey / non-true ⇒ never gate (gate only at/after auth).
    assert(ss.ssConsentGateDecision({ authenticated: false, consentStamped }) === false,
      'authenticated:false must never gate');
    assert(ss.ssConsentGateDecision({ consentStamped }) === false,
      'missing authenticated must never gate');
    return true;
  }), { numRuns: ITER });
});

// Property 3: Idempotency — an already-consented authenticated subject is admitted.
prop('Property 3: idempotency (already consented ⇒ no gate)', () => {
  assert(ss.ssConsentGateDecision({ authenticated: true, consentStamped: true }) === false,
    'authenticated + consentStamped:true must NOT re-prompt');
});

// Property 4: Fail-closed — authenticated with any non-true consent stamp ⇒ gate.
prop('Property 4: fail-closed (authenticated + not-true stamp ⇒ gate)', () => {
  fc.assert(fc.property(notTrue(), (consentStamped) => {
    assert(ss.ssConsentGateDecision({ authenticated: true, consentStamped }) === true,
      `authenticated + consentStamped:${show(consentStamped)} must gate (fail-closed)`);
    return true;
  }), { numRuns: ITER });
});

// Property 5: Totality / defensiveness — never throws, always boolean; garbage ⇒ false.
prop('Property 5: total and defensive', () => {
  fc.assert(fc.property(garbage(), (state) => {
    let out;
    try { out = ss.ssConsentGateDecision(state); }
    catch (e) { throw new Error(`threw on ${show(state)}: ${e.message}`); }
    assert(typeof out === 'boolean', `must return boolean, got ${show(out)}`);
    return true;
  }), { numRuns: ITER });
  assert(ss.ssConsentGateDecision(null) === false, 'null → false');
  assert(ss.ssConsentGateDecision(undefined) === false, 'undefined → false');
  assert(ss.ssConsentGateDecision('nope') === false, 'string → false');
  assert(ss.ssConsentGateDecision(42) === false, 'number → false');
});

// Property 6: Purity — the input state object is not mutated.
prop('Property 6: pure (no mutation)', () => {
  fc.assert(fc.property(fc.anything(), fc.anything(), (authenticated, consentStamped) => {
    const state = { authenticated, consentStamped };
    const before = JSON.stringify({ a: authenticated === undefined ? '∅' : authenticated,
                                    c: consentStamped === undefined ? '∅' : consentStamped });
    ss.ssConsentGateDecision(state);
    const after = JSON.stringify({ a: state.authenticated === undefined ? '∅' : state.authenticated,
                                   c: state.consentStamped === undefined ? '∅' : state.consentStamped });
    assert(before === after, 'must not mutate the input state');
    return true;
  }), { numRuns: ITER });
});

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
