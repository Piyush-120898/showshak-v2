# Bugfix Requirements Document

## Introduction

In the installed ShowShak PWA, navigating Feed → another page → back to Feed shows a **black screen for 5–6 seconds, intermittently**, and pages generally feel slow to open. The defect is a *blocked first paint*: the app shell is held invisible until render-blocking JavaScript finishes fetching, parsing, and executing.

Every app page (`showshak-feed`, `discover`, `watchlist`, `profile`, `settings`, `stack`) ships an inline `<style>` that hides the document (`body{opacity:0}`, over a near-black `#0B0B0F` background). The body is only revealed when `ssPageFadeIn()` sets `opacity:1`, and that runs **only on `DOMContentLoaded`**. `DOMContentLoaded` cannot fire until the render-blocking scripts complete — chiefly the synchronously-loaded `@supabase/supabase-js@2` from jsdelivr, plus `showshak-supabase.js`, `data/showshak-data.js`, and the ~4,900-line `showshak-shared.js`. On mid-range Android / patchy 4G, that fetch+parse window *is* the 5–6 seconds, during which the screen is pure black. The intermittency tracks cold script caches / busy CPU.

The `pageshow` early-reveal path does not rescue the loop: it sets `opacity:1` only when `e.persisted` is `true` (a true back/forward-cache restore). `ssNavigate()` performs a `location.href` change — a *fresh document load*, not a persisted restore — so the early-reveal never fires on the normal feed → page → feed navigation. The cold-open skeleton also cannot help: it renders only when there is **no** feed cache, and it is painted inside `initFeed()` at the end of `<body>`, after the render-blocking scripts; with a cache present, paint still waits on `shared.js` via `ClipEngine.mountInline`.

A minor documentation defect rides along: `sw.js`'s header comment claims HTML navigations are "network-first", but the code performs stale-while-revalidate (`return cached || network`). This is a stale comment, not a root cause, and is in scope only as a correctness fix.

The fix must **decouple first paint from JavaScript** so the app shell appears instantly on every navigation (including internal MPA navigations, not just bfcache restores), while preserving the cold-launch splash, the feed-cache instant-mount, the locked clip-player decisions, the sacred product rules, and a green test suite (`node tests/run-all.js`).

## Bug Analysis

### Bug Condition — `C(X)` (Methodology)

Let an input `X` describe a single app-page document load:

```pascal
FUNCTION isBugCondition(X)
  INPUT: X = {
    page:            one of the app pages (feed/discover/watchlist/profile/settings/stack),
    navType:         'cold-launch' | 'internal-nav' | 'bfcache-restore',
    scriptsWarm:     boolean,   // are the render-blocking scripts hot in SW/HTTP cache?
    persisted:       boolean    // pageshow event's e.persisted
  }
  OUTPUT: boolean

  // The bug triggers whenever first paint is gated behind JS finishing:
  //  - the document is hidden (body opacity:0) by static CSS, AND
  //  - the only reveal path is DOMContentLoaded / ssPageFadeIn (or a persisted-only pageshow),
  //  - so any non-persisted load must wait on the render-blocking scripts to paint.
  RETURN (X.navType = 'internal-nav' AND X.persisted = false)
      OR (X.navType = 'cold-launch'  AND X.scriptsWarm = false)
END FUNCTION
```

`X.navType = 'internal-nav'` with `persisted = false` is exactly the founder's feed → page → feed loop (an `ssNavigate()` `location` change). The black duration scales with how cold/slow the render-blocking scripts are; the worst case is the 5–6s report.

**Property — Fix Checking** (desired behavior for all buggy inputs):

```pascal
// Property: first paint is never gated behind the render-blocking app scripts
FOR ALL X WHERE isBugCondition(X) DO
  shell ← F'(X)                         // the page after the fix
  ASSERT shell.firstPaint_does_not_wait_on(DOMContentLoaded)
  ASSERT shell.firstPaint_does_not_wait_on(supabase_js, showshak_shared_js)
  ASSERT shell.visibleFrame_is_held(no_black_screen)   // skeleton/shell or paint-hold
END FOR
```

**Preservation set — `¬C(X)`** (must behave identically before and after the fix):

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
// Concretely: the standalone cold-launch splash (once per session), the
// per-user feed-cache instant-mount, the clip player, the SW caching
// strategies, the sacred product rules, and every existing property test.
```

Key definitions: **F** = the pages/scripts before the fix; **F'** = after the fix.

### Current Behavior (Defect)

What currently happens when the bug is triggered:

1.1 WHEN an app page loads via an internal MPA navigation (`ssNavigate()` `location` change, `pageshow.persisted = false`) THEN the system keeps `document.body` at `opacity:0` (over `#0B0B0F`) and reveals it only after `DOMContentLoaded` fires, producing a black screen for the entire script fetch+parse+execute window.

1.2 WHEN a page loads THEN the system fetches `@supabase/supabase-js@2` from jsdelivr via a **synchronous** `<script>` (no `defer`/`async`), so first paint is blocked on that network+parse before `DOMContentLoaded` can fire.

1.3 WHEN the page is restored via a real back/forward-cache event THEN the `pageshow` handler reveals the body, but WHEN the page arrives via a fresh document load (the normal feed → page → feed loop) THEN the early-reveal path never fires because it is guarded by `e.persisted === true`.

1.4 WHEN a feed cache exists (the common return-to-Feed case) THEN the cold-open skeleton is skipped, and the held-back placeholder is painted only inside `initFeed()` at the end of `<body>` after the render-blocking scripts, so the visible frame still waits on `showshak-shared.js` (`ClipEngine.mountInline`).

1.5 WHEN a developer reads `sw.js` THEN the header comment states HTML navigations are "network-first", but the `fetch` handler actually performs stale-while-revalidate (`return cached || network`), so the documentation contradicts the code.

### Expected Behavior (Correct)

What should happen instead (each clause corrects the matching defect above):

2.1 WHEN an app page loads via an internal MPA navigation (`persisted = false`) THEN the system SHALL paint a non-black app shell immediately, without waiting on `DOMContentLoaded` or `showshak-shared.js`, so no black screen is shown during script loading.

2.2 WHEN a page loads THEN the system SHALL load the non-critical render-blocking scripts (`@supabase/supabase-js@2` in particular, plus `showshak-supabase.js`, `data/showshak-data.js`, and `showshak-shared.js`) with `defer`/`async` such that they no longer block first paint, while preserving their execution-order dependencies.

2.3 WHEN a page arrives via a fresh document load (not a persisted bfcache restore) THEN the system SHALL run the early-reveal path so the body becomes visible immediately, independent of `e.persisted`.

2.4 WHEN a page loads regardless of whether a feed cache is present THEN the system SHALL keep an always-present skeleton/placeholder (or equivalent paint-hold) in the static HTML so a meaningful frame is held from the very first paint, before any render-blocking script runs.

2.5 WHEN a developer reads `sw.js` THEN the header comment SHALL accurately describe the HTML-navigation strategy as stale-while-revalidate, matching the implemented `fetch` handler.

### Unchanged Behavior (Regression Prevention)

Existing behavior that MUST be preserved (the preservation set `¬C(X)`):

3.1 WHEN the installed app is cold-launched in standalone display mode for the first time in a session THEN the system SHALL CONTINUE TO show the `#ss-splash` branded splash exactly once per session, and SHALL CONTINUE TO suppress it on the website and on internal navigation back to the Feed.

3.2 WHEN a return-to-Feed navigation finds a fresh per-user feed cache THEN the system SHALL CONTINUE TO instant-mount the cached first window (poster-first, no spinner) and SHALL CONTINUE TO skip the revalidation query when the cache is within `SS_FEED_FRESH_MS`.

3.3 WHEN a clip is mounted or played THEN the system SHALL CONTINUE TO honor the locked clip-player decisions (no MP4, no CDN swap, no player swap, no unbounded memory cache) with no change to playback, warming, or the bounded live-player set.

3.4 WHEN any public surface renders THEN the system SHALL CONTINUE TO honor the sacred product rules: creator-first with the title hidden until Watch It, Fire as the like, frictionless and private Watch It, and the hidden scoreboard (public surfaces show only per-clip fires + views, creator, followers/clips — never fires-received totals or Watch-It taps, RLS-enforced).

3.5 WHEN the pure-logic test suite is run (`node tests/run-all.js`) THEN the system SHALL CONTINUE TO pass every existing property and unit test with no regressions.

3.6 WHEN the service worker handles requests THEN the system SHALL CONTINUE TO apply the existing caching strategies unchanged: stale-while-revalidate for HTML navigations and same-origin static assets, cache-first for version-pinned jsdelivr libraries, and no interception of Mux/Supabase/Fonts (the `sw.js` change is comment-only).
