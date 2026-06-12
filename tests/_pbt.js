/* ═══════════════════════════════════════════════════════════════
   tests/_pbt.js — shared property-based-test (PBT) conventions + helpers
   for the curator-upload-v2 feature. NOT a test file (no `.test.js`
   suffix) so the runner never executes it directly; property tests
   `require('./_pbt.js')`.

   ── Conventions every curator-upload-v2 property test MUST follow ──
   1. Library: `fast-check` (dev dependency only — production code in
      showshak-shared.js stays dependency-free and unbundled, no build step).
   2. Iterations: run at least ITER (>= 100) generated cases per property
      via `{ numRuns: ITER }`.
   3. One design property per test file (Properties 1–10 → ten files:
      tests/prop-*.test.js).
   4. Tag each property test with a comment of the EXACT form:
        // Feature: curator-upload-v2, Property <n>
      (optionally followed by the property text), plus the
        // **Validates: Requirements X.Y**
      requirement-link line.
   5. Plain-Node runner: exit non-zero on failure (call process.exit(1)).
   6. showshak-shared.js runs DOM setup at load, so install the DOM/window
      stub via installDomStub() BEFORE requiring it. The pure helpers under
      test take numbers/plain objects, so the stub never affects behaviour —
      it only lets the module load and populate module.exports.

   Example skeleton for a property test file:

     'use strict';
     const { ITER, installDomStub } = require('./_pbt.js');
     installDomStub();
     const fc = require('fast-check');
     const ss = require('../showshak-shared.js');

     // Feature: curator-upload-v2, Property 1
     // **Validates: Requirements 5.1, 5.2, 5.3, 10.5**
     let failed = 0;
     try {
       fc.assert(fc.property(fc.string(), (p) => {
         // ...assertions on ss.ssValidatePitch(p)...
       }), { numRuns: ITER });
       console.log('  \u2713 Property 1');
     } catch (e) { failed++; console.log('  \u2717 Property 1\n      ' + e.message); }
     process.exit(failed ? 1 : 0);
═══════════════════════════════════════════════════════════════ */
'use strict';

/* Minimum generated cases per property (design says >= 100; existing
   example-based tests use 200 — match or exceed 100). */
const ITER = 200;

const noop = () => {};

function elementStub(tag) {
  return {
    tagName: tag ? String(tag).toUpperCase() : 'DIV',
    style: {}, dataset: {},
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    setAttribute: noop, getAttribute: () => null, removeAttribute: noop,
    appendChild: noop, removeChild: noop, remove: noop, insertBefore: noop,
    addEventListener: noop, removeEventListener: noop,
    querySelector: () => elementStub(), querySelectorAll: () => [],
    insertAdjacentHTML: noop, append: noop, prepend: noop,
    focus: noop, blur: noop, click: noop,
    play: () => Promise.resolve(), pause: noop,
  };
}

/* Install a minimal DOM/window stub so showshak-shared.js can load in Node.
   Idempotent: safe to call more than once. */
function installDomStub() {
  function safeGlobal(k, v) { try { global[k] = v; } catch (e) {} }

  global.window = {
    addEventListener: noop, removeEventListener: noop,
    location: { pathname: '/' }, navigator: { userAgent: '' },
    matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
    requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  };
  global.document = {
    body: elementStub(), head: elementStub(), documentElement: elementStub(),
    addEventListener: noop, removeEventListener: noop,
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    createElement: (tag) => elementStub(tag), createElementNS: (ns, tag) => elementStub(tag),
  };
  safeGlobal('localStorage', global.window.localStorage);
  safeGlobal('sessionStorage', global.window.sessionStorage);
  global.performance = { now: () => Date.now() };
  global.requestAnimationFrame = () => 0;
  global.cancelAnimationFrame = noop;
  global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  global.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return []; } };
}

module.exports = { ITER, installDomStub, elementStub };
