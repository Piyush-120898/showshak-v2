# PWA Black Screen Load Bugfix Design

## Overview

The installed ShowShak PWA paints a black screen for 5–6 seconds (intermittently) on the
feed → page → feed loop because **first paint is gated behind render-blocking JavaScript**.
Every app page ships `body{opacity:0}` and only reveals the body from `ssPageFadeIn()` on
`DOMContentLoaded`. `DOMContentLoaded` cannot fire until the synchronous
`@supabase/supabase-js@2` fetch + the `showshak-supabase.js` → `data/showshak-data.js` →
`showshak-shared.js` (~4,900 lines) chain finish parsing and executing. During that window
the document is a held-black void. The `pageshow` early-reveal only fires on
`e.persisted === true` (true bfcache restore), so it never rescues an `ssNavigate()`
`location.href` change — which is a fresh document load.

The fix decouples first paint from JavaScript and is delivered in **three isolated,
independently-shippable phases**, sequenced so the Feed never breaks and each phase is
verifiable on a real device:

- **Phase 1 — Instant Paint** (the actual bug kill): a static, always-present app shell in
  each page's HTML paints a meaningful non-black first frame before any render-blocking
  script runs; render-blocking scripts get `defer` (preserving load order); the early
  body-reveal fires on internal MPA navigations; the stale `sw.js` comment is corrected.
  Shippable alone and fully kills the black screen.
- **Phase 2 — Cross-Document View Transitions** (delight layer, additive): opt in to
  same-origin MPA View Transitions, reconciled with `ssNavigate()` so there is no
  double-animation, with explicit graceful fallback and `prefers-reduced-motion` support.
- **Phase 3 — Prerender + bfcache Hardening** (instant next-page): Speculation Rules
  prerender of the likely next pages, guarded against double-counting views/analytics,
  double Mux init, and premature auth/guest-gate side effects via
  `document.prerendering` / `prerenderingchange`; pages audited to stay bfcache-eligible.

Phases must ship **in order**: View Transitions (Phase 2) animate *into* whatever the
incoming page paints on its first frame — if Phase 1 has not yet made that frame a
non-black shell, the transition cross-fades into black and looks worse. Phase 3 prerenders
pages; a prerendered page that still gates paint on JS is invisible work. Phase 1 is the
foundation both later phases stand on.

This is pure vanilla HTML/CSS/JS, **no build step**, deployed to GitHub Pages on `main`.
No database migrations are required. There are **no founder-run items** beyond the
real-device verification checks described per phase.

## Glossary

- **Bug_Condition (C)**: First paint is gated behind the render-blocking app scripts —
  the document is held at `body{opacity:0}` and the only reveal path is `DOMContentLoaded`
  / `ssPageFadeIn()` (or a `persisted`-only `pageshow`), so any non-persisted load shows a
  black screen for the whole script fetch+parse+execute window. Formally, `C(X)` holds when
  `(navType = 'internal-nav' AND persisted = false)` OR `(navType = 'cold-launch' AND
  scriptsWarm = false)`.
- **Property (P)**: For every buggy input, a non-black app shell is painted on the first
  frame, without waiting on `DOMContentLoaded` or `showshak-shared.js`.
- **Preservation (¬C)**: Every input that is not the bug condition behaves identically
  before and after the fix — the once-per-session standalone splash, the feed-cache
  instant-mount + `SS_FEED_FRESH_MS` skip, the locked clip-player decisions, the sacred
  product rules, the existing SW caching strategies (comment-only change), and a green
  `node tests/run-all.js`.
- **App shell**: The static, always-present non-black markup in a page's HTML (skeleton /
  placeholder chrome) that paints on the first frame before scripts run.
- **`ssPageFadeIn()`**: The function in `showshak-shared.js` that today sets `body.opacity`
  to `0` then `1` on `DOMContentLoaded` — the JS-gated reveal at the heart of the bug.
- **`ssNavigate(url)`**: The function in `showshak-shared.js` that fades the body out
  (`opacity:0`, 0.1s) then sets `window.location.href` after ~90ms — an internal MPA
  navigation that produces a *fresh document load*, not a bfcache restore.
- **`#ss-splash`**: The branded splash overlay (feed page) shown once per session on an
  installed-app cold launch in standalone display mode.
- **Feed skeleton (`.feed-skeleton`)**: The shimmer placeholder painted into `#feed` by
  `renderFeedSkeleton()` only on a cold open (no feed cache).
- **View Transition**: The cross-document `@view-transition { navigation: auto }` browser
  capability that animates between same-origin MPA documents.
- **`document.prerendering` / `prerenderingchange`**: The platform signals that tell a page
  it is being prerendered (not yet activated/visible) so it can defer side-effectful work.

## Bug Details

### Bug Condition

The bug manifests when an app page is loaded by any path other than a true bfcache restore
while the render-blocking scripts are not already warm — chiefly the founder's
feed → page → feed loop, where `ssNavigate()` performs a `location.href` change (a fresh
document load with `pageshow.persisted = false`). The body is held at `opacity:0` over
`#0B0B0F`, and the only reveal path (`ssPageFadeIn()` on `DOMContentLoaded`, or a
`persisted`-only `pageshow`) cannot run until the synchronous `@supabase/supabase-js@2`
download + the `supabase → data → shared` chain finish parsing and executing. That window
*is* the black screen; its duration scales with how cold/slow the scripts are.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X = {
    page:        one of feed | discover | watchlist | profile | settings | stack,
    navType:     'cold-launch' | 'internal-nav' | 'bfcache-restore',
    scriptsWarm: boolean,   // render-blocking scripts hot in SW/HTTP cache?
    persisted:   boolean    // pageshow event's e.persisted
  }
  OUTPUT: boolean

  // The bug triggers whenever first paint is gated behind JS finishing:
  //  - document is hidden (body opacity:0) by static CSS, AND
  //  - the only reveal path is DOMContentLoaded / ssPageFadeIn (or persisted-only pageshow),
  //  - so any non-persisted load must wait on the render-blocking scripts to paint.
  RETURN (X.navType = 'internal-nav' AND X.persisted = false)
      OR (X.navType = 'cold-launch'  AND X.scriptsWarm = false)
END FUNCTION
```

### Examples

- **Feed → Profile → Feed on mid-range Android / 4G** (`navType='internal-nav'`,
  `persisted=false`, `scriptsWarm=false`): expected — Feed paints its shell instantly;
  actual — black screen for 5–6s while `supabase-js` + `shared.js` load, then the feed
  snaps in.
- **Cold launch of the installed app with a cold script cache** (`navType='cold-launch'`,
  `scriptsWarm=false`): expected — `#ss-splash` shows immediately and a shell is behind it;
  actual — splash shows (it self-reveals the body), but on pages without the splash the body
  stays black until scripts finish.
- **Discover → Watchlist** (`internal-nav`, `persisted=false`): expected — Watchlist chrome
  paints at once; actual — black until scripts execute and `DOMContentLoaded` fires.
- **Swipe back to a previously-visited page** (`navType='bfcache-restore'`,
  `persisted=true`): **not a bug** — the existing `pageshow` handler reveals the body. This
  edge case must stay working (preservation).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors (the preservation set `¬C(X)`):**
- The standalone cold-launch `#ss-splash` still shows exactly once per session (Req 3.1).
- The per-user feed-cache instant-mount still mounts the cached first window poster-first
  with no spinner, and still skips revalidation within `SS_FEED_FRESH_MS` (Req 3.2).
- The locked clip-player decisions are untouched: no MP4, no CDN swap, no player swap, no
  unbounded memory cache; playback, warming, and the bounded live-player set are unchanged
  (Req 3.3).
- The sacred product rules hold: creator-first / title hidden until Watch It, Fire as the
  like, frictionless private Watch It, hidden scoreboard (RLS-enforced) (Req 3.4).
- The pure-logic suite (`node tests/run-all.js`) passes with no regressions (Req 3.5).
- The SW caching strategies are unchanged — stale-while-revalidate for HTML + same-origin
  static assets, cache-first for version-pinned jsdelivr libs, no interception of
  Mux/Supabase/Fonts. Only the `sw.js` header comment changes (Req 3.6).

**Scope:**
All inputs where `isBugCondition(X)` is false must be completely unaffected. This includes:
- True bfcache restores (`pageshow.persisted = true`).
- The cold-launch splash path on standalone first-open.
- The feed-cache instant-mount path.
- All clip mount/playback, save/fire/follow, and Watch It interactions.

The actual correct first-paint behavior is defined in **Correctness Properties** (Property 1).
This section enumerates what must NOT change.

## Hypothesized Root Cause

Based on the defect analysis, the black screen has three reinforcing causes:

1. **JS-gated reveal (primary)**: `body{opacity:0}` (static CSS) + `ssPageFadeIn()` on
   `DOMContentLoaded` means nothing visible paints until the render-blocking scripts finish.
   The body is literally transparent over `#0B0B0F` for the whole script window.

2. **Synchronous render-blocking scripts**: `<script src="…supabase-js@2">` has no
   `defer`/`async`, so it blocks the parser and delays `DOMContentLoaded`. The
   `supabase → data → shared` chain compounds it.

3. **Reveal path misses internal navigations**: the early-reveal `pageshow` handler is
   guarded by `e.persisted === true`, so the normal `ssNavigate()` fresh-document load (the
   founder's loop) never triggers it; only the `DOMContentLoaded` path remains, which is the
   slow one.

A fourth, non-causal item rides along: the `sw.js` header comment says HTML navigations are
"network-first" while the code does stale-while-revalidate — a documentation defect only.

The fix removes cause 1 by painting a static shell on the first frame (so paint no longer
depends on the reveal at all), removes cause 2 by deferring the scripts, and removes cause 3
by making the early reveal fire on fresh loads too.

## Correctness Properties

Property 1: Bug Condition — Instant Non-Black First Paint

_For any_ input where the bug condition holds (`isBugCondition` returns true), the fixed
pages SHALL paint a non-black app shell on the first frame, decoupled from
`DOMContentLoaded` and `showshak-shared.js`. The pure resolver `ssResolveFirstFrame(state)`
SHALL, for every such input, select exactly one coherent first-frame layer
(`splash` | `skeleton` | `shell`) and SHALL never resolve to a held-black document
(`revealBody` is always true; no double-skeleton).

**Validates: Requirements 2.1, 2.2, 2.4**

Property 2: Preservation — Non-Buggy Inputs Unchanged

_For any_ input where the bug condition does NOT hold (`isBugCondition` returns false), the
fixed code SHALL produce the same observable result as the original: the standalone splash
fires exactly once per session, the feed-cache instant-mount + `SS_FEED_FRESH_MS` skip are
unchanged, the clip player and sacred product rules are unchanged, and the SW caching
strategies are unchanged (comment-only edit).

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6**

Property 3: Early Reveal Fires on Fresh Loads — `ssShouldRevealBody(evt)`

_For any_ document-load reveal event (`DOMContentLoaded`, or `pageshow` with `persisted`
true OR false), `ssShouldRevealBody(evt)` SHALL return true, so the body is revealed on
internal MPA navigations and not only on persisted bfcache restores.

**Validates: Requirements 2.1, 2.3**

Property 4: View-Transition Strategy Has No Double-Animation — `ssNavStrategy(env)`

_For any_ environment `{ supportsViewTransition, reducedMotion }`, `ssNavStrategy` SHALL
return `'view-transition'` only when View Transitions are supported AND reduced motion is
NOT requested; otherwise it SHALL return `'instant'`. When the result is `'view-transition'`
the caller SHALL skip the manual `ssNavigate` opacity fade (no double-animation); when
`'instant'` the behavior SHALL degrade to today's instant cut.

**Validates: Requirements 2.1, 3.4**

Property 5: Prerender Side-Effects Are Deferred — `ssShouldRunSideEffects(prerendering)`

_For any_ boolean `prerendering` value, `ssShouldRunSideEffects` SHALL return `false` while
the document is prerendering and `true` once it is not, so view-recording, Mux player init,
and auth/guest-gate side effects never run before activation.

**Validates: Requirements 3.1, 3.3, 3.4**

Property 6: Prerender Allow-List Is Bounded — `ssShouldPrerender(req)`

_For any_ request `{ targetUrl, allowlist, standalone, sameOrigin }`, `ssShouldPrerender`
SHALL return true only when the app is standalone AND the target is same-origin AND the
target is a member of the bounded allow-list; it SHALL never authorize prerendering a
cross-origin URL or a page outside the allow-list (e.g. upload/settings excluded).

**Validates: Requirements 3.3, 3.4**

> Properties 1–2 are the mandatory Bug-Condition / Preservation pair. Properties 3–6 cover
> the pure logic introduced by the fix (see Fix Implementation). Phase 2's transition CSS
> itself is declarative and not unit-testable; only its strategy decision (Property 4) is
> pure logic. Phase 1's shell markup and Phase 3's Speculation Rules JSON are likewise
> declarative; their *decisions* are the pure, property-tested parts.

## Fix Implementation

All pure logic introduced by any phase is added to `showshak-shared.js` and
**dual-exported** (`window.*` for the browser + `module.exports` for Node tests), matching
the existing pattern at the bottom of the file. Each pure helper gets a `tests/prop-*.test.js`
fast-check file wired into `tests/run-all.js`.

### Phase 1 — Instant Paint (ship first; fully kills the black screen)

**Goal:** A meaningful non-black frame is painted on the FIRST paint of every app page,
before any render-blocking script runs, with exactly one coherent first-frame story.

**Files changed (all 6 app pages + shared + sw):**
`showshak-feed.html`, `showshak-discover.html`, `showshak-watchlist.html`,
`showshak-profile.html`, `showshak-settings.html`, `showshak-stack.html`,
`showshak-shared.js`, `sw.js`.

**Changes:**

1. **Remove the JS-gated hide.** Delete the static `body{opacity:0}` rule from each page
   (`<style>body{opacity:0}</style>` on discover/watchlist/profile/settings/stack, and the
   equivalent in feed's splash style block). The body is visible from the first frame; the
   shell below provides the non-black content.

2. **Always-present static shell.** Add a static, no-JS skeleton/placeholder element to each
   page's HTML so the first paint is meaningful chrome, not a void:
   - **Feed**: the existing `.feed-skeleton` markup is promoted to a static element rendered
     in the HTML (not only injected by `renderFeedSkeleton()` on cold open). It sits under
     `#ss-splash` and is swapped out by `ClipEngine.mountInline()` exactly as today. There is
     **no double-skeleton**: the JS `renderFeedSkeleton()` path is reconciled to reuse /
     no-op when the static skeleton is already present.
   - **Other pages**: a lightweight static placeholder (page chrome background + a shimmer
     block sized to the page's primary content region) painted before scripts run, replaced
     by each page's existing render.

3. **Reconcile the three first-frame stories into one** via a pure resolver,
   `ssResolveFirstFrame(state)` (see Cross-Cutting). The first frame is exactly one of:
   `splash` (standalone cold-launch, once per session), `skeleton` (feed cold open, no
   cache), or `shell` (everything else). No flash, no double-skeleton. `#ss-splash` keeps
   its own `body.opacity='1'` self-reveal (it covers the shell) and its once-per-session
   `sessionStorage` guard — unchanged (Req 3.1).

4. **Defer the render-blocking scripts, preserving order.** `defer` runs scripts in document
   order, after parsing, before `DOMContentLoaded` — so the existing dependency chain is
   preserved without blocking first paint. Change each page's tail scripts to:
   ```html
   <script defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   <script async src="https://cdn.jsdelivr.net/npm/@mux/mux-player@3"></script>
   <script defer src="showshak-supabase.js"></script>
   <script defer src="data/showshak-data.js"></script>
   <script defer src="showshak-shared.js"></script>
   ```
   - `defer` on the four ordered scripts guarantees `supabase-js → showshak-supabase.js →
     data/showshak-data.js → showshak-shared.js` still execute in that order (defer preserves
     document order). `@mux/mux-player` stays `async` (already is) — it is order-independent
     (the player upgrades whenever it loads; `VideoSurface` already guards the pre-upgrade
     window).
   - **`initFeed()` and the other page IIFEs**: today they are inline `<script>` tags at the
     end of `<body>` that depend on `shared.js` globals (`SSData`, `ClipEngine`, `ssReadFeedCache`,
     …). An inline classic script runs *before* deferred scripts. To keep the dependency
     correct once `shared.js` is deferred, the page-init IIFEs must run after defer completes.
     Two equivalent options, choose per page:
     - (a) Add `defer` to the page-init script by moving it to an external-style deferred
       block, **or**
     - (b) Wrap the IIFE body so it runs on `DOMContentLoaded` (which, with `defer`, fires
       only after all deferred scripts have executed): `if (document.readyState === 'loading')
       document.addEventListener('DOMContentLoaded', initFeed); else initFeed();` — the same
       pattern already used by `showshak-stack-page.js`.
     Either way the IIFE still sees fully-initialized `shared.js` globals. Crucially, because
     the static shell already painted, `initFeed()` no longer sits on the first-paint critical
     path — it runs after a non-black frame is on screen.

5. **Early reveal on fresh loads (not just persisted restores).** Replace the
   `ssPageFadeIn()` + `persisted`-only `pageshow` logic with an unconditional reveal driven
   by the pure `ssShouldRevealBody(evt)` (Property 3):
   - Reveal the body on `DOMContentLoaded`, on `pageshow` regardless of `e.persisted`, and on
     `ssNavigate` location-change return paths. With the static shell + removed
     `body{opacity:0}`, the body is already visible; this guard remains as a belt-and-braces
     reveal for any residual transition state and to correctly cover the internal-nav case
     (Req 2.3). `ssPageFadeIn()` is kept as a thin wrapper that calls the new reveal so no
     caller breaks.

6. **Correct the `sw.js` header comment (comment-only).** Change the header bullet from
   `HTML pages → NETWORK-FIRST …` to accurately describe **stale-while-revalidate** for HTML
   navigations, matching the implemented `fetch` handler (`return cached || network`). No
   code path changes (Req 2.5, 3.6).

**Why Phase 1 is highest-value / lowest-risk:** it is the actual bug kill, touches only
markup/attributes/one comment + a small reveal helper, ships alone, and leaves every
preserved behavior intact.

### Phase 2 — Cross-Document View Transitions (additive delight)

**Goal:** Same-origin MPA navigations animate with a tuned, fast cross-fade / directional
slide, degrading gracefully where unsupported.

**Files changed:** a shared CSS file (e.g. `showshak-tokens.css` or `showshak-components.css`
— wherever the global tokens live) for the at-rule + transition CSS; `showshak-shared.js`
for the `ssNavigate` reconciliation + `ssNavStrategy`.

**Changes:**

1. **Opt in to cross-document View Transitions** with the CSS at-rule (no JS needed for the
   opt-in):
   ```css
   @view-transition { navigation: auto; }
   ```
   Supported on Chrome/Edge 126+ and Safari 18.2+. **Graceful fallback (explicit):** on
   browsers without support, the at-rule is simply ignored and navigation is today's
   instant cut — identical to current behavior. No feature detection is required for
   correctness; the app is fully functional either way.

2. **Define fast transition CSS** consistent with ShowShak's motion tokens
   (`--ease-spring` / `--ease-smooth`) and the existing `ssNavigate` feel. Keep it FAST —
   the nav handoff was deliberately cut to ~90ms; the transition duration must stay in the
   same snappy band (target ~120–180ms cross-fade, optional short directional slide) and
   must not reintroduce sluggishness:
   ```css
   ::view-transition-old(root),
   ::view-transition-new(root) { animation-duration: 160ms; animation-timing-function: var(--ease-smooth); }
   ```

3. **Reconcile with `ssNavigate()` — no double-animation.** Today `ssNavigate` sets
   `body.opacity = 0` then changes `location` after 90ms. When a View Transition will run,
   that manual fade would double up (fade-out + transition). Drive the decision with the
   pure `ssNavStrategy({ supportsViewTransition, reducedMotion })` (Property 4):
   - `'view-transition'`: **skip** the manual opacity fade and navigate immediately
     (`window.location.href = url`); the browser owns the animation. No 90ms manual hold.
   - `'instant'`: keep today's behavior exactly (the manual ~90ms fade + redirect, or an
     instant cut under reduced motion).
   This guarantees exactly one animation runs.

4. **Respect `prefers-reduced-motion`.** `ssNavStrategy` returns `'instant'` whenever
   reduced motion is requested, and the transition CSS is additionally wrapped:
   ```css
   @media (prefers-reduced-motion: reduce) {
     ::view-transition-old(root), ::view-transition-new(root) { animation: none; }
   }
   ```

### Phase 3 — Prerender + bfcache Hardening (instant next-page)

**Goal:** The likely next page is already rendered when the user taps, while avoiding the
real prerender hazards.

**Files changed:** each app page (Speculation Rules `<script type="speculationrules">` JSON,
bounded by the allow-list) — or a single shared injected block in `showshak-shared.js`;
`showshak-shared.js` for `ssShouldRunSideEffects` / `ssShouldPrerender` and the
`prerenderingchange` deferral wrapper.

**Changes:**

1. **Speculation Rules prerender/prefetch** of the bounded next-page set
   (Feed / Discover / Watchlist / Profile), installed-app only:
   ```html
   <script type="speculationrules">
   { "prerender": [ { "where": { "href_matches": "/showshak-(feed|discover|watchlist|profile).html" },
                      "eagerness": "moderate" } ] }
   </script>
   ```
   The set is bounded by `ssShouldPrerender(req)` (Property 6): same-origin + standalone +
   allow-list membership only. **Upload and Settings are excluded** (side-effect-heavy /
   rarely the next tap).

2. **Defer side-effectful work until activation.** Wrap every side effect that must not run
   during prerender behind `ssShouldRunSideEffects(document.prerendering)` (Property 5),
   and re-run on activation:
   ```js
   function ssOnActivated(fn) {
     if (ssShouldRunSideEffects(document.prerendering)) return fn();
     document.addEventListener('prerenderingchange', function once() {
       document.removeEventListener('prerenderingchange', once); fn();
     });
   }
   ```
   Specifically guarded:
   - **View / analytics recording** (`ssRecordView`, the dwell timer, `ssRecordWatch`,
     `ssRecordShare`) — must NOT double-count a view that was merely prerendered. Gate the
     dwell-timer start and `ssRecordView` behind `ssOnActivated`.
   - **Mux player init** (`VideoSurface.mount` / `ClipEngine.mountInline`) — must NOT init a
     `<mux-player>` or burn Mux bandwidth while prerendering. Defer mount until activation.
   - **Guest-gate / auth side effects** (the `ssGuestGate` IIFE's `getSession()` reactions,
     `_ssAfterLogin`, view-limit prompt) — must NOT fire during prerender. The pure session
     *read* is fine; the *reactions* (sheets, prompts, hydration) defer to activation.

3. **Keep pages bfcache-eligible.** Audit for and avoid bfcache blockers: no `unload`
   handlers (use `pagehide`/`pageshow`), no lingering open connections that block caching.
   Confirm the existing `pageshow`/`pagehide` usage stays bfcache-friendly. The early-reveal
   already handles `pageshow.persisted` correctly after Phase 1.

## Cross-Cutting Design — Pure Logic & Tests

All pure logic lives in `showshak-shared.js`, dual-exported, with one `tests/prop-*.test.js`
per helper (fast-check, `installDomStub()` before `require`, `{ numRuns: ITER }`, tagged
`// Feature: pwa-black-screen-load, Property <n>` + `// **Validates: Requirements X.Y**`),
all wired into `tests/run-all.js`.

| Phase | Pure helper | Property | Test file |
|-------|-------------|----------|-----------|
| 1 | `ssResolveFirstFrame(state)` → `{ visibleLayer, revealBody }` | Property 1 | `tests/prop-first-frame.test.js` |
| 1 | `ssShouldRevealBody(evt)` → boolean | Property 3 | `tests/prop-reveal-body.test.js` |
| 2 | `ssNavStrategy(env)` → `'view-transition' \| 'instant'` | Property 4 | `tests/prop-nav-strategy.test.js` |
| 3 | `ssShouldRunSideEffects(prerendering)` → boolean | Property 5 | `tests/prop-prerender-sideeffects.test.js` |
| 3 | `ssShouldPrerender(req)` → boolean | Property 6 | `tests/prop-should-prerender.test.js` |

**Honest note on what is NOT pure logic:** Phase 1's static shell markup and the
`body{opacity:0}` removal, Phase 2's `@view-transition` at-rule + transition CSS, and
Phase 3's Speculation Rules JSON are all **declarative** — they are verified on a real
device, not by property tests. Only the *decisions* around them
(`ssResolveFirstFrame`, `ssShouldRevealBody`, `ssNavStrategy`, `ssShouldRunSideEffects`,
`ssShouldPrerender`) are pure logic and are property-tested. We do not invent tests for the
declarative parts.

`module.exports` additions (matching the existing block):
```js
module.exports.ssResolveFirstFrame    = ssResolveFirstFrame;
module.exports.ssShouldRevealBody     = ssShouldRevealBody;
module.exports.ssNavStrategy          = ssNavStrategy;
module.exports.ssShouldRunSideEffects = ssShouldRunSideEffects;
module.exports.ssShouldPrerender      = ssShouldPrerender;
```
with the matching `window.*` assignments in the existing `if (typeof window !== 'undefined')`
block.

## Testing Strategy

### Validation Approach

Two phases: first surface counterexamples that demonstrate the bug on the UNFIXED code,
then verify the fix works and preserves existing behavior. Pure logic is covered by
property tests; first-paint/animation/prerender behavior is covered by real-device checks
(the founder runs these).

### Exploratory Bug Condition Checking

**Goal:** Surface counterexamples that demonstrate the black screen BEFORE implementing the
fix, and confirm/refute the root-cause hypothesis (JS-gated paint). If refuted, re-hypothesize.

**Test Plan:** On the UNFIXED code, throttle to mid-tier mobile + slow 4G (DevTools or a real
device) and navigate the founder's loop. Observe the held-black document and confirm it
tracks the script fetch+parse window.

**Test Cases:**
1. **Feed → Profile → Feed (cold scripts)**: black screen for seconds on return (will
   reproduce on unfixed code).
2. **Discover → Watchlist (slow 4G)**: black until `DOMContentLoaded` (will reproduce).
3. **Cold launch, non-splash page** (e.g. direct to Profile in standalone): body black until
   scripts finish (will reproduce).
4. **Edge — true bfcache back-swipe**: body reveals via `pageshow.persisted` — should NOT be
   black (confirms `C(X)` excludes this case).

**Expected Counterexamples:** the document stays at `opacity:0` over `#0B0B0F` for the whole
script window; `DOMContentLoaded` timing in the Performance panel lines up with the
black-screen duration; confirms cause = JS-gated paint + sync scripts + persisted-only reveal.

### Fix Checking

**Goal:** For all inputs where the bug condition holds, the fixed pages paint a non-black
shell on first frame.

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  frame := ssResolveFirstFrame(stateOf(X))
  ASSERT frame.revealBody = true                 // never held black
  ASSERT frame.visibleLayer IN { 'splash','skeleton','shell' }   // exactly one
  ASSERT firstPaint_does_not_wait_on(DOMContentLoaded, supabase_js, showshak_shared_js)
END FOR
```
Pure part: `ssResolveFirstFrame` + `ssShouldRevealBody` property tests (Properties 1, 3).
Real-device part: the founder confirms an instant non-black shell on the loop (below).

### Preservation Checking

**Goal:** For all inputs where the bug condition does NOT hold, the fixed code produces the
same result as the original.

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```
**Why property-based:** generating many `{ navType, standalone, splashShownThisSession,
haveFeedCache, persisted }` states exercises the splash-once / feed-cache / reveal decisions
across the whole input domain and catches edge cases manual tests miss.

**Test Plan:** Observe the preserved behaviors on UNFIXED code first (splash once per session,
feed-cache instant mount, SW strategies), then assert they are byte-for-byte unchanged after
the fix via the property tests + the full suite.

**Test Cases:**
1. **Splash once per session** (Req 3.1): `ssResolveFirstFrame` returns `splash` only when
   `standalone && !splashShownThisSession && navType='cold-launch'`; never twice.
2. **Feed-cache instant mount + fresh skip** (Req 3.2): unchanged — `feed-cache.test.js`
   stays green; the static skeleton is reconciled (no double-skeleton) so the cache path
   still mounts poster-first with no spinner.
3. **SW strategies unchanged** (Req 3.6): `sw.js` diff is comment-only; cache-first / SWR /
   no-intercept branches untouched.
4. **Reduced motion / unsupported browser** (Phase 2): `ssNavStrategy` returns `'instant'`
   → today's behavior preserved.

### Unit Tests

- `ssResolveFirstFrame` exact rows (splash / skeleton / shell selection; `revealBody`
  always true).
- `ssShouldRevealBody` truth table over `{DOMContentLoaded, pageshow×persisted}`.
- `ssNavStrategy` 2×2 over `{supportsViewTransition, reducedMotion}`.
- `ssShouldRunSideEffects` both boolean values; `ssShouldPrerender` allow-list membership +
  cross-origin / non-standalone rejection.

### Property-Based Tests

- **Property 1** (`prop-first-frame`): over random `{navType, standalone,
  splashShownThisSession, haveFeedCache, page}`, exactly one `visibleLayer` and
  `revealBody === true` always.
- **Property 3** (`prop-reveal-body`): over random reveal events, always reveals on real
  loads (incl. `persisted=false`).
- **Property 4** (`prop-nav-strategy`): `'view-transition'` iff supported && !reducedMotion;
  else `'instant'`.
- **Property 5** (`prop-prerender-sideeffects`): equals `!prerendering`.
- **Property 6** (`prop-should-prerender`): true only for standalone + same-origin +
  allow-listed; never cross-origin / off-list.

### Integration Tests (real-device checks — founder-run)

Per phase, on the installed PWA on a real device (mid-tier Android + throttled network):

- **Phase 1**: Feed → each page → back, repeatedly, with cold caches. **Pass:** no black
  screen at any point; a non-black shell/skeleton is visible on the very first frame of
  every navigation; splash still shows once per session on cold standalone launch; feed-cache
  return still instant-mounts. Ship Phase 1 alone and confirm the bug is dead before starting
  Phase 2.
- **Phase 2**: same navigations show a single fast cross-fade/slide (no double-animation, no
  sluggishness); unsupported browser / reduced-motion shows an instant cut; the incoming page
  animates *into* the non-black shell (never into black).
- **Phase 3**: tapping into Feed/Discover/Watchlist/Profile feels instant (prerendered);
  verify in DevTools/analytics that a prerendered-but-not-visited page records **no** view,
  inits **no** Mux player, and fires **no** guest-gate prompt until activation; verify
  back/forward stays bfcache-instant.

### Founder-Run Items

None beyond the per-phase real-device verification above. No database migrations are needed
for this fix.
