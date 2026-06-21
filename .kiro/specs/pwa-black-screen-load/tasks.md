# Implementation Plan

## Overview

Bugfix methodology + phased delivery. The exploration / bug-condition step comes FIRST and
is EXPECTED to fail on the unfixed code (that confirms the bug). Preservation is observed on
the unfixed code next. The fix then ships in three independently-shippable, dependency-ordered
phases — **Phase 1 (Instant Paint) is the priority and kills the black screen on its own**;
Phase 2 (View Transitions) and Phase 3 (Prerender + bfcache) are layered on top, strictly in
order. All pure logic lives in `showshak-shared.js` (dual-exported `window.*` + `module.exports`),
each pure helper gets a `tests/prop-*.test.js` fast-check file wired into `tests/run-all.js`,
and `node tests/run-all.js` MUST stay green after every `showshak-shared.js` change. Pure
vanilla HTML/CSS/JS, no build step. There are NO database migrations; founder-run items are
real-device checks only.

## Tasks

### Exploration & Baseline (BEFORE any fix)

- [x] 1. Write bug-condition exploration test (reproduce the held-black bug on UNFIXED code)
  - **Property 1: Bug Condition** - Held-Black First Frame / Reveal Misses Fresh Loads
  - **CRITICAL**: This test MUST FAIL on the unfixed code — failure confirms the bug exists.
    **DO NOT attempt to fix the test or the code when it fails.**
  - **NOTE**: This test encodes the expected first-frame behavior; it will validate the fix
    when it passes after Phase 1 implementation.
  - **GOAL**: Surface counterexamples proving first paint is gated behind JS.
  - **Scoped PBT Approach**: encode the bug condition `isBugCondition(X)` from design —
    `(navType='internal-nav' AND persisted=false)` OR `(navType='cold-launch' AND scriptsWarm=false)`.
    Author `tests/prop-first-frame.test.js` to call the (not-yet-existing) pure resolver
    `ssResolveFirstFrame(state)` and assert `revealBody === true` and exactly one
    `visibleLayer ∈ {splash, skeleton, shell}` for every buggy input; also assert
    `ssShouldRevealBody({type:'pageshow', persisted:false})` returns true.
  - On UNFIXED code the helpers do not exist (and the current reveal path is guarded by
    `e.persisted === true`), so the test throws / counterexamples — held-black document.
  - Wire the new file into `tests/run-all.js` and run `node tests/run-all.js`.
  - **EXPECTED OUTCOME**: Test FAILS (proves the bug: no pure resolver, reveal misses
    `persisted=false`, body held at `opacity:0` over `#0B0B0F`).
  - Document counterexamples (e.g. "internal-nav, persisted=false → no reveal path fires →
    black for the whole supabase-js + showshak-shared.js fetch+parse window").
  - Mark complete when the test is written, wired, run, and the failure is documented.
  - _Files: tests/prop-first-frame.test.js, tests/run-all.js_
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation observation tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Splash-Once / Feed-Cache Instant-Mount / SW Strategies Unchanged
  - **IMPORTANT**: Follow the observation-first methodology — observe behavior on the UNFIXED
    code for non-buggy inputs (`isBugCondition(X) === false`), then assert it is unchanged.
  - Observe on unfixed code: standalone cold-launch shows `#ss-splash` exactly once per
    session; a fresh per-user feed cache instant-mounts poster-first (no spinner) and skips
    revalidation within `SS_FEED_FRESH_MS`; the locked clip-player decisions, sacred product
    rules, and SW caching strategies hold; true bfcache restore (`pageshow.persisted=true`)
    already reveals the body.
  - Confirm the existing suite is green as the baseline: run `node tests/run-all.js` and
    confirm `tests/feed-cache.test.js` and all `tests/prop-*.test.js` pass.
  - Property-based testing recommended: generate random
    `{navType, standalone, splashShownThisSession, haveFeedCache, persisted}` states to
    exercise the preserved decisions across the whole input domain.
  - **EXPECTED OUTCOME**: All preservation observations / existing tests PASS on unfixed code
    (this is the baseline to preserve through every phase).
  - Mark complete when the baseline is recorded and the suite is confirmed green.
  - _Files: tests/feed-cache.test.js, tests/run-all.js_
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

### PHASE 1 — Instant Paint (PRIORITY — kills the black screen; ship alone)

- [x] 3. Write property test for `ssResolveFirstFrame(state)`
  - **Property 1: Bug Condition** - Instant Non-Black First Paint
  - Author / finalize `tests/prop-first-frame.test.js` (fast-check; `installDomStub()` before
    `require('../showshak-shared.js')`; `{ numRuns: ITER }`; tagged
    `// Feature: pwa-black-screen-load, Property 1` + `// **Validates: Requirements 2.1, 2.2, 2.4**`).
  - Over random `{navType, standalone, splashShownThisSession, haveFeedCache, page}`: assert
    exactly one `visibleLayer ∈ {splash, skeleton, shell}` and `revealBody === true` always
    (never a held-black document, no double-skeleton). Include the exact unit rows from design
    (splash only when `standalone && !splashShownThisSession && navType='cold-launch'`).
  - Wire into `tests/run-all.js`. Run `node tests/run-all.js` — fails until task 5 lands.
  - _Files: tests/prop-first-frame.test.js, tests/run-all.js_
  - _Requirements: 2.1, 2.2, 2.4_

- [x] 4. Write property test for `ssShouldRevealBody(evt)`
  - **Property 3: Early Reveal Fires on Fresh Loads** - ssShouldRevealBody
  - Author `tests/prop-reveal-body.test.js` (fast-check; `installDomStub()`; `{ numRuns: ITER }`;
    tagged `// Feature: pwa-black-screen-load, Property 3` + `// **Validates: Requirements 2.1, 2.3**`).
  - Truth table over `{DOMContentLoaded, pageshow×persisted=true/false}`: assert the helper
    returns `true` for every real document-load reveal event, including `pageshow` with
    `persisted=false` (the internal-MPA-nav case).
  - Wire into `tests/run-all.js`. Run `node tests/run-all.js` — fails until task 5 lands.
  - _Files: tests/prop-reveal-body.test.js, tests/run-all.js_
  - _Requirements: 2.1, 2.3_

- [x] 5. Implement Phase 1 — decouple first paint from JavaScript

  - [x] 5.1 Add the Phase 1 pure helpers to `showshak-shared.js` (dual-exported)
    - Add `ssResolveFirstFrame(state)` → `{ visibleLayer: 'splash'|'skeleton'|'shell', revealBody: true }`
      reconciling the three first-frame stories into exactly one (never held-black, no
      double-skeleton).
    - Add `ssShouldRevealBody(evt)` → boolean (true for `DOMContentLoaded` and for `pageshow`
      regardless of `e.persisted`).
    - Dual-export both: `module.exports.ssResolveFirstFrame` / `.ssShouldRevealBody` plus the
      matching `window.*` assignments in the existing `if (typeof window !== 'undefined')` block.
    - _Bug_Condition: isBugCondition(X) = (internal-nav AND persisted=false) OR (cold-launch AND !scriptsWarm)_
    - _Expected_Behavior: ssResolveFirstFrame selects one non-black layer with revealBody=true; first paint independent of DOMContentLoaded / showshak-shared.js_
    - _Files: showshak-shared.js, tests/prop-first-frame.test.js, tests/prop-reveal-body.test.js_
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 5.2 Remove the JS-gated hide and add an always-present static shell to all 6 app pages
    - Delete the static `body{opacity:0}` rule from each page (and the equivalent in feed's
      splash style block) so the body is visible from the first frame.
    - Feed: promote the existing `.feed-skeleton` markup to a static element rendered in the
      HTML (under `#ss-splash`), swapped out by `ClipEngine.mountInline()` as today.
    - Other pages: add a lightweight static placeholder (page-chrome background + a shimmer
      block sized to the primary content region), replaced by each page's existing render.
    - _Bug_Condition: body held at opacity:0 over #0B0B0F with only a JS-gated reveal path_
    - _Expected_Behavior: a meaningful non-black shell is painted on the first frame, before any render-blocking script runs_
    - _Files: showshak-feed.html, showshak-discover.html, showshak-watchlist.html, showshak-profile.html, showshak-settings.html, showshak-stack.html_
    - _Requirements: 2.1, 2.4_

  - [x] 5.3 Defer the render-blocking scripts (preserve execution order) and move page-init off the first-paint path
    - Add `defer` to the four ordered tail scripts on each page so
      `supabase-js → showshak-supabase.js → data/showshak-data.js → showshak-shared.js` still
      execute in document order without blocking first paint; keep `@mux/mux-player@3` as `async`.
    - Make each page-init IIFE (`initFeed()` etc.) run after defer completes — either move it to
      a deferred block or wrap it: `if (document.readyState==='loading') addEventListener('DOMContentLoaded', init); else init();` (the `showshak-stack-page.js` pattern), so it still sees fully-initialized `shared.js` globals.
    - _Bug_Condition: synchronous <script src="…supabase-js@2"> blocks the parser and delays DOMContentLoaded_
    - _Expected_Behavior: non-critical scripts load deferred and no longer block first paint, dependency order preserved_
    - _Files: showshak-feed.html, showshak-discover.html, showshak-watchlist.html, showshak-profile.html, showshak-settings.html, showshak-stack.html_
    - _Requirements: 2.2_

  - [x] 5.4 Wire the early reveal to fire on fresh loads (not just persisted restores)
    - Replace the `persisted`-only `pageshow` logic with an unconditional reveal driven by
      `ssShouldRevealBody(evt)`: reveal on `DOMContentLoaded`, on `pageshow` regardless of
      `e.persisted`, and on `ssNavigate` location-change return paths. Keep `ssPageFadeIn()`
      as a thin wrapper that calls the new reveal so no caller breaks.
    - _Bug_Condition: reveal path guarded by e.persisted === true never fires on internal MPA navigations_
    - _Expected_Behavior: body becomes visible immediately on fresh document loads, independent of e.persisted_
    - _Files: showshak-shared.js_
    - _Requirements: 2.1, 2.3_

  - [x] 5.5 Correct the `sw.js` header comment (comment-only)
    - Change the header bullet from `HTML pages → NETWORK-FIRST …` to accurately describe
      **stale-while-revalidate** for HTML navigations, matching the `return cached || network`
      handler. No code-path change.
    - _Preservation: SW caching strategies unchanged — comment-only edit (Req 3.6)_
    - _Files: sw.js_
    - _Requirements: 2.5, 3.6_

  - [x] 5.6 Regression guard — reconcile static skeleton with `renderFeedSkeleton()` (no double-skeleton)
    - Ensure the JS `renderFeedSkeleton()` path reuses / no-ops when the static skeleton is
      already present, and that the feed-cache instant-mount still mounts poster-first with no
      spinner. Confirm `tests/feed-cache.test.js` stays green.
    - _Preservation: feed-cache instant-mount + SS_FEED_FRESH_MS skip unchanged; no double-skeleton (Req 3.2)_
    - _Files: showshak-shared.js, showshak-feed.html, tests/feed-cache.test.js_
    - _Requirements: 3.2_

  - [x] 5.7 Verify the bug-condition exploration + first-frame/reveal property tests now pass
    - **Property 1: Expected Behavior** - Instant Non-Black First Paint
    - **IMPORTANT**: Re-run the SAME tests from tasks 1, 3, 4 — do NOT write new tests.
    - Run `node tests/run-all.js`.
    - **EXPECTED OUTCOME**: `prop-first-frame` and `prop-reveal-body` PASS (confirms the bug is
      fixed: a coherent non-black first frame, reveal fires on `persisted=false`).
    - _Files: tests/prop-first-frame.test.js, tests/prop-reveal-body.test.js_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 5.8 Verify preservation tests still pass
    - **Property 2: Preservation** - Splash-Once / Feed-Cache / SW Strategies Unchanged
    - **IMPORTANT**: Re-run the SAME baseline from task 2 — do NOT write new tests.
    - Run `node tests/run-all.js`; confirm splash-once, feed-cache instant-mount, and SW
      strategies are unchanged (no regressions).
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 6. Phase 1 checkpoint — keep the suite green
  - Run `node tests/run-all.js`; the full pure-logic suite (existing + `prop-first-frame` +
    `prop-reveal-body`) MUST be green. Ask the user if questions arise.
  - _Requirements: 3.5_

- [~] 7. Phase 1 founder-run real-device verification (FOUNDER-RUN — no migrations)
  - **Founder runs this on the installed PWA on a real device** (mid-tier Android + throttled 4G).
  - Navigate Feed → each page → back, repeatedly, with cold caches. **Pass:** no black screen
    at any point; a non-black shell/skeleton is visible on the very first frame of every
    navigation; `#ss-splash` still shows once per session on cold standalone launch; feed-cache
    return still instant-mounts.
  - **Ship Phase 1 alone and confirm the black screen is dead before starting Phase 2.**
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2_

### PHASE 2 — Cross-Document View Transitions (additive; ship after Phase 1)

- [~] 8. Write property test for `ssNavStrategy(env)`
  - **Property 4: View-Transition Strategy Has No Double-Animation** - ssNavStrategy
  - Author `tests/prop-nav-strategy.test.js` (fast-check; `installDomStub()`; `{ numRuns: ITER }`;
    tagged `// Feature: pwa-black-screen-load, Property 4` + `// **Validates: Requirements 2.1, 3.4**`).
  - 2×2 over `{supportsViewTransition, reducedMotion}`: assert `'view-transition'` IFF
    supported AND NOT reduced-motion; otherwise `'instant'`.
  - Wire into `tests/run-all.js`. Run `node tests/run-all.js` — fails until task 9 lands.
  - _Files: tests/prop-nav-strategy.test.js, tests/run-all.js_
  - _Requirements: 2.1, 3.4_

- [ ] 9. Implement Phase 2 — View Transitions reconciled with `ssNavigate`

  - [~] 9.1 Add `ssNavStrategy({ supportsViewTransition, reducedMotion })` to `showshak-shared.js`
    - Returns `'view-transition' | 'instant'` per Property 4; dual-export (`module.exports.*`
      + `window.*`).
    - _Expected_Behavior: ssNavStrategy returns 'view-transition' only when supported && !reducedMotion_
    - _Files: showshak-shared.js, tests/prop-nav-strategy.test.js_
    - _Requirements: 2.1, 3.4_

  - [~] 9.2 Add the `@view-transition` opt-in + fast transition CSS to the shared CSS file
    - `@view-transition { navigation: auto; }` plus a fast cross-fade tuned to ShowShak's
      motion tokens (target ~120–180ms, `var(--ease-smooth)`), in the global tokens CSS file
      (`showshak-tokens.css` / `showshak-components.css`). Unsupported browsers ignore the
      at-rule → today's instant cut (explicit graceful fallback).
    - _Expected_Behavior: same-origin MPA navigations animate with one fast cross-fade; degrades to instant where unsupported_
    - _Files: showshak-tokens.css (or showshak-components.css)_
    - _Requirements: 2.1_

  - [~] 9.3 Reconcile `ssNavigate()` — exactly one animation (no double-animation)
    - When `ssNavStrategy` is `'view-transition'`: skip the manual `opacity` fade and navigate
      immediately (`window.location.href = url`); the browser owns the animation. When
      `'instant'`: keep today's ~90ms manual fade + redirect (or an instant cut under reduced
      motion). Guarantees exactly one animation runs.
    - _Bug_Condition: a View Transition cross-fades into whatever the incoming page paints — requires the Phase 1 non-black shell_
    - _Expected_Behavior: no double-animation; transition animates into the non-black shell, never into black_
    - _Files: showshak-shared.js_
    - _Requirements: 2.1, 3.4_

  - [~] 9.4 Respect `prefers-reduced-motion`
    - `ssNavStrategy` returns `'instant'` under reduced motion; additionally wrap the transition
      CSS in `@media (prefers-reduced-motion: reduce) { ::view-transition-old(root), ::view-transition-new(root) { animation: none; } }`.
    - _Preservation: reduced-motion / unsupported browser degrades to today's instant behavior (Req 3.4)_
    - _Files: showshak-tokens.css (or showshak-components.css), showshak-shared.js_
    - _Requirements: 3.4_

  - [~] 9.5 Verify the nav-strategy property test passes
    - **Property 4: View-Transition Strategy Has No Double-Animation** - ssNavStrategy
    - **IMPORTANT**: Re-run the SAME test from task 8. Run `node tests/run-all.js`.
    - **EXPECTED OUTCOME**: `prop-nav-strategy` PASSES.
    - _Files: tests/prop-nav-strategy.test.js_
    - _Requirements: 2.1, 3.4_

  - [~] 9.6 Verify preservation tests still pass (no regressions from Phase 2)
    - **Property 2: Preservation** - Non-Buggy Inputs Unchanged
    - Re-run the baseline from task 2 + Phase 1 tests. Run `node tests/run-all.js`.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [~] 10. Phase 2 checkpoint — keep the suite green
  - Run `node tests/run-all.js`; the full suite (incl. `prop-nav-strategy`) MUST be green.
  - _Requirements: 3.5_

- [~] 11. Phase 2 founder-run real-device verification (FOUNDER-RUN — no migrations)
  - **Founder runs this on the installed PWA on a real device.**
  - Same navigations show a single fast cross-fade/slide (no double-animation, no sluggishness);
    unsupported browser / reduced-motion shows an instant cut; the incoming page animates *into*
    the Phase 1 non-black shell (never into black).
  - _Requirements: 2.1, 3.4_

### PHASE 3 — Prerender + bfcache Hardening (instant next-page; ship after Phase 2)

- [~] 12. Write property test for `ssShouldRunSideEffects(prerendering)`
  - **Property 5: Prerender Side-Effects Are Deferred** - ssShouldRunSideEffects
  - Author `tests/prop-prerender-sideeffects.test.js` (fast-check; `installDomStub()`;
    `{ numRuns: ITER }`; tagged `// Feature: pwa-black-screen-load, Property 5` +
    `// **Validates: Requirements 3.1, 3.3, 3.4**`).
  - Over both boolean values: assert the result equals `!prerendering`.
  - Wire into `tests/run-all.js`. Run `node tests/run-all.js` — fails until task 14 lands.
  - _Files: tests/prop-prerender-sideeffects.test.js, tests/run-all.js_
  - _Requirements: 3.1, 3.3, 3.4_

- [~] 13. Write property test for `ssShouldPrerender(req)`
  - **Property 6: Prerender Allow-List Is Bounded** - ssShouldPrerender
  - Author `tests/prop-should-prerender.test.js` (fast-check; `installDomStub()`;
    `{ numRuns: ITER }`; tagged `// Feature: pwa-black-screen-load, Property 6` +
    `// **Validates: Requirements 3.3, 3.4**`).
  - Over random `{targetUrl, allowlist, standalone, sameOrigin}`: assert true ONLY when
    standalone AND same-origin AND target ∈ allow-list; never cross-origin or off-list
    (upload/settings excluded).
  - Wire into `tests/run-all.js`. Run `node tests/run-all.js` — fails until task 14 lands.
  - _Files: tests/prop-should-prerender.test.js, tests/run-all.js_
  - _Requirements: 3.3, 3.4_

- [ ] 14. Implement Phase 3 — Speculation Rules prerender + side-effect deferral + bfcache audit

  - [~] 14.1 Add the Phase 3 pure helpers to `showshak-shared.js` (dual-exported)
    - Add `ssShouldRunSideEffects(prerendering)` → boolean (`!prerendering`) and
      `ssShouldPrerender(req)` → boolean (standalone + same-origin + allow-list membership).
      Dual-export (`module.exports.*` + `window.*`).
    - _Expected_Behavior: side effects deferred while prerendering; prerender bounded to standalone + same-origin + allow-list_
    - _Files: showshak-shared.js, tests/prop-prerender-sideeffects.test.js, tests/prop-should-prerender.test.js_
    - _Requirements: 3.3, 3.4_

  - [~] 14.2 Add Speculation Rules prerender of the bounded next-page set (installed-app only)
    - Add `<script type="speculationrules">` for `/showshak-(feed|discover|watchlist|profile).html`
      with `eagerness: "moderate"`, bounded by `ssShouldPrerender` (Property 6). **Upload and
      Settings are excluded.** Either per app page or a single shared injected block in
      `showshak-shared.js`.
    - _Expected_Behavior: only standalone + same-origin + allow-listed pages are prerendered_
    - _Files: showshak-shared.js (or each app page), showshak-feed.html, showshak-discover.html, showshak-watchlist.html, showshak-profile.html_
    - _Requirements: 3.3, 3.4_

  - [~] 14.3 Defer side-effectful work until activation via `ssOnActivated` / `prerenderingchange`
    - Add an `ssOnActivated(fn)` wrapper gated by `ssShouldRunSideEffects(document.prerendering)`
      that re-runs on `prerenderingchange`. Gate: view/analytics recording (`ssRecordView`, the
      dwell timer, `ssRecordWatch`, `ssRecordShare`) so a prerendered page records no view; Mux
      player init (`VideoSurface.mount` / `ClipEngine.mountInline`) so no `<mux-player>` inits /
      burns bandwidth while prerendering; guest-gate / auth reactions (`ssGuestGate` `getSession()`
      reactions, `_ssAfterLogin`, view-limit prompt) — the pure session read is fine, the
      reactions defer.
    - _Bug_Condition: side effects firing during prerender double-count views / init Mux / fire guest-gate before activation_
    - _Expected_Behavior: view-recording, Mux init, and auth/guest-gate reactions never run before activation_
    - _Preservation: splash-once, clip player, and sacred product rules unchanged (Req 3.1, 3.3, 3.4)_
    - _Files: showshak-shared.js_
    - _Requirements: 3.1, 3.3, 3.4_

  - [~] 14.4 Audit pages to stay bfcache-eligible
    - Avoid `unload` handlers (use `pagehide`/`pageshow`); no lingering connections that block
      caching; confirm the Phase 1 early-reveal `pageshow`/`pagehide` usage stays bfcache-friendly.
    - _Preservation: true bfcache restore (pageshow.persisted=true) keeps revealing the body_
    - _Files: showshak-shared.js, showshak-feed.html, showshak-discover.html, showshak-watchlist.html, showshak-profile.html, showshak-settings.html, showshak-stack.html_
    - _Requirements: 2.3, 3.5_

  - [~] 14.5 Verify the prerender property tests pass
    - **Property 5: Prerender Side-Effects Are Deferred** / **Property 6: Prerender Allow-List Is Bounded**
    - **IMPORTANT**: Re-run the SAME tests from tasks 12, 13. Run `node tests/run-all.js`.
    - **EXPECTED OUTCOME**: `prop-prerender-sideeffects` and `prop-should-prerender` PASS.
    - _Files: tests/prop-prerender-sideeffects.test.js, tests/prop-should-prerender.test.js_
    - _Requirements: 3.3, 3.4_

  - [~] 14.6 Verify preservation tests still pass (no regressions from Phase 3)
    - **Property 2: Preservation** - Non-Buggy Inputs Unchanged
    - Re-run the baseline from task 2 + all prior phase tests. Run `node tests/run-all.js`.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [~] 15. Phase 3 checkpoint — keep the suite green
  - Run `node tests/run-all.js`; the full suite (all six property files + existing tests) MUST
    be green.
  - _Requirements: 3.5_

- [~] 16. Final founder-run real-device verification — all phases (FOUNDER-RUN — no migrations)
  - **Founder runs this on the installed PWA on a real device.**
  - Tapping into Feed/Discover/Watchlist/Profile feels instant (prerendered); verify in
    DevTools/analytics that a prerendered-but-not-visited page records **no** view, inits **no**
    Mux player, and fires **no** guest-gate prompt until activation; verify back/forward stays
    bfcache-instant. Confirm Phase 1 (no black screen) and Phase 2 (single fast transition) still
    hold end-to-end.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.6_

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"], "dependsOn": [] },
    { "wave": 2, "tasks": ["2"], "dependsOn": ["1"] },
    { "wave": 3, "tasks": ["3", "4"], "dependsOn": ["2"] },
    { "wave": 4, "tasks": ["5"], "dependsOn": ["3", "4"] },
    { "wave": 5, "tasks": ["6"], "dependsOn": ["5"] },
    { "wave": 6, "tasks": ["7"], "dependsOn": ["6"] },
    { "wave": 7, "tasks": ["8"], "dependsOn": ["7"] },
    { "wave": 8, "tasks": ["9"], "dependsOn": ["8"] },
    { "wave": 9, "tasks": ["10"], "dependsOn": ["9"] },
    { "wave": 10, "tasks": ["11"], "dependsOn": ["10"] },
    { "wave": 11, "tasks": ["12", "13"], "dependsOn": ["11"] },
    { "wave": 12, "tasks": ["14"], "dependsOn": ["12", "13"] },
    { "wave": 13, "tasks": ["15"], "dependsOn": ["14"] },
    { "wave": 14, "tasks": ["16"], "dependsOn": ["15"] }
  ]
}
```

```
1  (bug-condition exploration — FAILS on unfixed code)
2  (preservation baseline — PASSES on unfixed code)
        │
        ▼
┌─ PHASE 1 (priority — ship alone) ──────────────────────────┐
│ 3 (prop-first-frame)   4 (prop-reveal-body)                 │
│        └────────────┬───────────┘                           │
│                     ▼                                        │
│ 5 ─ 5.1 → 5.2 → 5.3 → 5.4 → 5.5 → 5.6 → 5.7 → 5.8           │
│                     ▼                                        │
│ 6 (checkpoint: suite green) → 7 (founder-run device check)  │
└─────────────────────────────┬──────────────────────────────┘
                              ▼  (Phase 1 shipped & verified)
┌─ PHASE 2 (after Phase 1) ───────────────────────────────────┐
│ 8 (prop-nav-strategy)                                        │
│        ▼                                                     │
│ 9 ─ 9.1 → 9.2 → 9.3 → 9.4 → 9.5 → 9.6                        │
│        ▼                                                     │
│ 10 (checkpoint: suite green) → 11 (founder-run device check) │
└─────────────────────────────┬───────────────────────────────┘
                              ▼  (Phase 2 shipped & verified)
┌─ PHASE 3 (after Phase 2) ───────────────────────────────────┐
│ 12 (prop-prerender-sideeffects)   13 (prop-should-prerender) │
│        └────────────┬───────────────┘                        │
│                     ▼                                        │
│ 14 ─ 14.1 → 14.2 → 14.3 → 14.4 → 14.5 → 14.6                 │
│                     ▼                                        │
│ 15 (checkpoint: suite green) → 16 (final founder-run check)  │
└──────────────────────────────────────────────────────────────┘
```

- Tasks 1 → 2 run first (exploration before baseline).
- Within each phase, the property-test tasks precede implementation; implementation sub-tasks
  are ordered top-to-bottom; the checkpoint and founder-run close the phase.
- Phases are strictly sequential: 7 (Phase 1 shipped) gates Phase 2; 11 (Phase 2 shipped)
  gates Phase 3. Phase 1 is independently shippable and is the priority.

## Notes

- **Bug-condition methodology**: task 1 is the exploration test that MUST fail on the unfixed
  code (no pure resolver; the reveal path is guarded by `e.persisted === true`); it doubles as
  the fix-checking test once Phase 1 lands (task 5.7). Task 2 captures the preservation baseline.
- **Pure logic & tests**: the five pure helpers (`ssResolveFirstFrame`, `ssShouldRevealBody`,
  `ssNavStrategy`, `ssShouldRunSideEffects`, `ssShouldPrerender`) all live in
  `showshak-shared.js`, dual-exported (`window.*` + `module.exports`), each with a
  `tests/prop-*.test.js` fast-check file wired into `tests/run-all.js`. Run
  `node tests/run-all.js` after every `showshak-shared.js` change; the suite must stay green
  (Req 3.5).
- **Declarative parts are founder-verified, not unit-tested**: the static shell markup +
  `body{opacity:0}` removal (Phase 1), the `@view-transition` at-rule + transition CSS
  (Phase 2), and the Speculation Rules JSON (Phase 3) are declarative — they are checked on a
  real device, not by property tests. Only their decisions are pure logic.
- **Preservation set (3.1–3.6)**: splash once/session, feed-cache instant-mount, locked clip
  player, sacred product rules, SW strategies (comment-only change), and a green suite. Explicit
  regression guards: task 5.6 (no double-skeleton, feed-cache test stays green) and tasks 5.8 /
  9.6 / 14.6 (re-run preservation after each phase).
- **Founder-run / real-device verification**: tasks 7, 11, 16 are run by the founder on the
  installed PWA on a real device (mid-tier Android + throttled network). There are **NO database
  migrations** for this fix.
- **`sw.js`** change is comment-only (task 5.5): correct the stale "network-first" header to
  "stale-while-revalidate"; no code path changes (Req 2.5, 3.6).
