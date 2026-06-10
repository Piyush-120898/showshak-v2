# Implementation Plan: Unified Clip Player

## Overview

Consolidate the Feed's bespoke inline player and the universal fullscreen viewer
onto a single shared `Clip_Engine` in `showshak-shared.js`. Work is sequenced to
protect the Feed (the highest-risk page): the shared engine primitives are built
and proven against the existing fullscreen viewer FIRST, then the INLINE render
mode is added, and only then is `showshak-feed.html` migrated onto the engine.
The Feed is never left broken between tasks — its bespoke player keeps running
until the migration task swaps it out in one step.

This is a vanilla JS/HTML/CSS project with **no build step and no test harness**.
Per the design's Testing Strategy, verification for every task is the relevant
item(s) from the **manual regression checklist** and the **static "defined
exactly once" review**, run in the browser. No test framework is introduced.

## Tasks

- [x] 1. Build shared engine primitives in `showshak-shared.js` (Feed untouched)
  - [x] 1.1 Add `Media_Surface` contract + `GradientSurface` + `ssCreateSurface` factory
    - Add the `MediaSurfaceContract` doc-contract and implement `GradientSurface(clip, opts)` exactly as designed (rAF timer loop, `DURATION_MS` default 16000, `mount/play/pause/setMuted/isMuted/getProgress/seek/onTimeupdate/onEnded/destroy`).
    - Add `ssCreateSurface(clip, opts)` as the single factory deciding `GradientSurface` today vs `VideoSurface` (future) on `clip.muxPlaybackId`.
    - Engine code must speak only the contract — no gradient-specific branching outside `ssCreateSurface`.
    - _Requirements: 9.1, 9.2, 9.3_
    - _Verify (static review): "Engine code contains no gradient-specific branching; medium decisions live only in `ssCreateSurface`"; (cross-cutting) no console timer leaks after navigating away (surfaces `destroy()`d)._

  - [x] 1.2 Add `Mute_Preference` module
    - Implement `ssGetMutePref()`, `ssSetMutePref(muted)`, `ssOnMuteChange(fn)` backed by `localStorage` key `ss_mute_pref_v1`, with `try/catch` and in-memory `_ssMuteFallback` for private/blocked mode. Default: sound ON.
    - `ssSetMutePref` notifies `_ssMuteListeners`.
    - _Requirements: 5.1, 5.4, 6 (sound), 4.4_
    - _Verify (manual): "Mute toggle persists across a reload and into the fullscreen viewer" once wired in later tasks; module behavior confirmed via console (`ssSetMutePref(true)` then `ssGetMutePref()` round-trips)._

  - [x] 1.3 Add `ssMakeProgressBar(container)` component
    - Build the single `Progress_Bar` factory producing `.ss-progress` > `.ss-progress-fill`, exposing `set(fraction)` (clamped 0..1) and `el`.
    - _Requirements: 2.1, 2.2, 2.3, 1.7_
    - _Verify (manual, after wiring): progress bar advances on the active clip in both modes._

  - [x] 1.4 Add `ssAttachGestures(tapZoneEl, idx, engine)` handler
    - Implement the unified gesture state machine: single tap (deferred 310ms) → `engine.togglePause(idx)`; double tap (gap < 300ms, within 40px) → `engine.fire(idx, x, y)`. Bind `click` and `touchend`.
    - Do NOT yet remove `_ssvAttachDoubleTap` (still referenced); just add the new handler.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
    - _Verify (manual, after wiring): single tap pauses/resumes; double tap fires + burst at tap point._

  - [x] 1.5 Add `ssClipOrdering(clicked, list)` Recommendation_Seam
    - Wrap `_ssvBuildList(clicked, list)` behind `ssClipOrdering` as the single ordering entry point; body delegates to `_ssvBuildList` today.
    - _Requirements: 7.5_
    - _Verify (static review): "Engine ordering goes only through `ssClipOrdering`"; (manual) ordering still starts at tapped clip and contains all clips._

- [ ] 2. Checkpoint - primitives load cleanly
  - Ensure `showshak-shared.js` parses with no console errors on every page and the existing fullscreen viewer still opens unchanged. Ask the user if questions arise.

- [x] 3. Refactor the existing fullscreen viewer onto the primitives
  - [x] 3.1 Make `_ssvClipHTML` mode-aware and host a `Media_Surface` + `Progress_Bar`
    - Add a `mode` parameter (INLINE | FULLSCREEN) selecting the class set; render a surface mount point + `ssMakeProgressBar` container instead of a hardcoded `ssv-bg`. For FULLSCREEN, preserve existing `.ssv-feed` / `.ssv-rail` layout and ids.
    - Keep `_ssvNormalize` as the canonical normalizer; do not render `clip.title` or any counts on the clip body.
    - _Requirements: 1.2, 9.2, 10.1, 10.4, 2.2_
    - _Verify (manual): fullscreen progress bar present and advancing; (cross-cutting) no title/counts shown; (static) title only in Watch It sheet._

  - [x] 3.2 Merge `_ssvToggleFire`/`_ssvFireOn` into `ClipEngine.fire`
    - Create `ClipEngine.fire(idx, x, y)` as the single Fire definition: `ssGuestGuard('fire')`, flip fire state on (idempotent), pulse rail flame, play fire-burst at `(x,y)`, flash Watch It CTA, call `_ssDbFire`. Repoint fullscreen rail flame + double-tap to it. Remove `_ssvToggleFire`/`_ssvFireOn` once unused.
    - _Requirements: 1.3, 3.3, 3.4, 10.2, 10.5, 10.6, 11.5_
    - _Verify (manual): double tap + rail flame fire in fullscreen; guest fire shows signup sheet; signed-user fire persists via `_ssDbFire`. (static) Fire defined exactly once._

  - [x] 3.3 Replace `_ssvAttachDoubleTap` with `ssAttachGestures` in fullscreen
    - Swap the viewer's gesture wiring to `ssAttachGestures`; add `ClipEngine.togglePause(idx)` (single-tap pause/resume of the active surface). Remove `_ssvAttachDoubleTap` once unused.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
    - _Verify (manual): single tap pauses/resumes and double tap fires in fullscreen, identical to intended Feed behavior._

  - [x] 3.4 Add progress bar + sound model to fullscreen playback
    - In the active-clip path, wire `surface.onTimeupdate(p => progressBar.set(p))`; add `ClipEngine.setActive(idx)` applying `resolveMuted(FULLSCREEN)` = `ssGetMutePref()`, pausing the previous surface, playing the active surface with autoplay-rejection → muted-retry. Add a single mute corner control calling `ssSetMutePref` + `ssOnMuteChange` re-apply.
    - Call `surface.destroy()` for every clip in `_ssvTeardownViewer`.
    - _Requirements: 1.6, 1.7, 2.2, 2.3, 4.1, 4.5, 5.2, 5.3_
    - _Verify (manual): fullscreen opens with sound unless previously muted; progress advances; no "tap for sound" prompt; (cross-cutting) no timer leaks after close._

  - [x] 3.5 Wire `ssOpenClip` through `ssClipOrdering`
    - Change `_ssvClips = _ssvBuildList(clicked, list)` to `_ssvClips = ssClipOrdering(clicked, list)`. No-op guard for missing clip preserved.
    - _Requirements: 7.3, 7.4, 7.5_
    - _Verify (manual): fullscreen opens at tapped clip and scrolls through ordered clips (Discover/Watchlist/Profile)._

- [ ] 4. Checkpoint - fullscreen regression from all 4 pages
  - Manually open the fullscreen viewer from Discover, Watchlist, and Profile (and the Feed's current player): opens at tapped clip, sound honors `Mute_Preference`, progress advances, gestures work, Watch It opens shared sheet, swipe/Esc/back close. Ask the user if questions arise.

- [x] 5. Add `ClipEngine.mountInline` (INLINE render mode)
  - [x] 5.1 Implement `mountInline(container, clips, opts)` layout + surfaces
    - Render ordered clips (via `ssClipOrdering`) into `#feed` reusing the existing scroll-snap `clip-column` layout; for each clip create `ssCreateSurface` + `ssMakeProgressBar` and attach `ssAttachGestures`. No-op if `container`/clips absent. First clip uses `_inlineAwaitingGesture = true` forcing muted until first gesture, then applies `ssGetMutePref()`.
    - _Requirements: 1.1, 7.1, 8.1, 8.3, 9.1, 4.2, 4.3, 2.1_
    - _Verify (manual, deferred to Feed migration): clips scroll with scroll-snap; first clip auto-plays muted; sound turns on after first interaction._

  - [x] 5.2 Add INLINE active-clip observer + `setActive` + rails + keyboard nav
    - Generalize `_ssvSetupObserver` (threshold 0.6) to drive `setActive(idx)` for the INLINE host: pause previous surface, apply `resolveMuted(INLINE)`, play active, set progress. Render the mobile per-clip action rail and the fixed desktop `#action-rail`; bring `positionRail` behavior into the engine (position relative to active clip column, update on load + resize). Move `navigateFeed` + keydown (arrows / j / k) into the engine's INLINE keyboard nav.
    - _Requirements: 1.1, 5.2, 11.1, 11.2, 11.3, 11.4, 8.3_
    - _Verify (manual, deferred to Feed migration): mobile rail at mobile width; desktop rail tracks active column on load + resize; arrow/j/k navigation; scroll-snap intact._

- [ ] 6. Checkpoint - INLINE mode renders in isolation
  - Confirm `ClipEngine.mountInline` renders and plays without throwing when invoked, before migrating the Feed page. Ask the user if questions arise.

- [ ] 7. Migrate `showshak-feed.html` onto the engine
  - [ ] 7.1 Replace `buildFeed` with `ClipEngine.mountInline` and keep data load
    - Keep `loadRealClips` / `SSData.feedShows()` / `ssLoadClips` / `ssClipsForFeed` data loading, then call `ClipEngine.mountInline(document.getElementById('feed'), SHOWS)`. Render path now drives the Feed.
    - _Requirements: 8.1, 1.1, 7.1_
    - _Verify (manual): Feed renders through `ClipEngine.mountInline`; first clip auto-plays._

  - [ ] 7.2 Remove the bespoke Feed player functions and page state
    - Delete `buildFeed`, `attachDoubleTap`, `triggerBurst`, `flashCTA`, `syncRail`, `animateRailIn`, `initScrollObserver`, `startProgress`, `stopProgress`, `handleTap`, `toggleMute`, `toggleLit`, `toggleSave`, `positionRail` and the `litState`/`progressTimers`/`isPaused`/`currentClip` page state. (`navigateFeed`/keydown behavior now lives in the engine.)
    - _Requirements: 8.2, 8.3_
    - _Verify (static review): Feed no longer defines those functions as standalone player code; behavior provided by the engine._

  - [ ] 7.3 Remove bespoke Feed markup: mute badge, end card, per-clip progress bars
    - Remove the `muted-badge` "Tap for sound" element; remove the `feed-end` / `feed-end-title` "YOU'VE SEEN IT ALL" card; remove the `prog-wrap-${i}` / `prog-${i}` bars (now produced by the engine's `Progress_Bar`).
    - _Requirements: 4.5, 6.1, 6.2_
    - _Verify (manual): no "Tap for sound" badge anywhere; no "YOU'VE SEEN IT ALL" end card; engine progress bar present instead._

  - [ ] 7.4 Adopt the shared Watch It sheet on the Feed
    - Remove the Feed's bespoke `#watch-sheet` markup and the `data-no-sheet` attribute on `#ss-nav` so the Feed uses the shared sheet injected by `ssInjectChrome` (`SS_WATCH_SHEET_HTML`). Point both inline controls (`mobile-watch-btn` / `rail-watch`) at `ssOpenSheet(clip)`.
    - _Requirements: 1.5, 10.3, 11.6_
    - _Verify (manual): Watch It (mobile + desktop) opens the shared sheet; (static) Feed's bespoke `#watch-sheet` and `data-no-sheet` removed._

- [ ] 8. CSS for progress bar and inline mode
  - [ ] 8.1 Add `.ss-progress` / `.ss-progress-fill` and inline-mode classes
    - Add the progress bar styles to `showshak-components.css` (and any tokens in `showshak-tokens.css`); add any INLINE-mode classes emitted by the mode-aware `_ssvClipHTML`. Ensure existing mobile rail and desktop `#action-rail` styles still apply to the engine-rendered Feed.
    - _Requirements: 2.1, 2.2, 11.3, 11.4_
    - _Verify (manual): progress bar visible/advancing in both modes; mobile + desktop rail styling intact._

- [ ] 9. Resolve single-tap-pause vs tap-to-open-fullscreen on the Feed
  - [ ] 9.1 Add a dedicated expand affordance on inline Feed clips
    - Per design, single tap pauses/resumes inline (gesture model), so opening fullscreen from the Feed uses a dedicated expand control that calls `ssOpenClip(clip, SHOWS)` (begins playback at the tapped clip). Ensure the gesture handler and expand affordance do not conflict.
    - _Requirements: 7.2, 7.3, 3.1, 3.2_
    - _Verify (manual): inline single tap pauses; expand affordance opens fullscreen at that clip and scrolling continues through ordered clips._

- [ ] 10. Final regression and static review pass
  - [ ] 10.1 Run the full manual regression checklist
    - Execute every item in the design's Testing Strategy manual checklist: Feed INLINE section, Fullscreen-from-all-4-pages section, and Cross-cutting section. Fix any failures found.
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.5, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 7.1, 7.3, 7.4, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_
    - _Verify: manual regression checklist passes on Feed (INLINE) and fullscreen from Discover, Watchlist, Profile, Feed._

  - [ ] 10.2 Run the static "defined exactly once" review and confirm no timer leaks
    - Execute the design's static review checklist: Feed no longer defines the retired player functions; Fire/Save/Watch It/sound/progress each defined once in `showshak-shared.js`; no gradient branching outside `ssCreateSurface`; ordering only via `ssClipOrdering`; bespoke `#watch-sheet`/`data-no-sheet` removed. Confirm surfaces `destroy()` leaves no console timer leaks after navigating away.
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 7.5, 8.2, 8.3, 9.2_
    - _Verify: static review checklist passes; no leftover `requestAnimationFrame`/timer leaks in console after navigation._

## Notes

- This feature introduces **no automated test framework**. Verification for every
  task is the relevant manual regression checklist item(s) and/or the static
  "defined exactly once" review from the design's Testing Strategy, run in the
  browser. The design's "Property-test seams" remain future work and are not
  implemented here.
- Sequencing protects the Feed: primitives (Group 1) and the fullscreen refactor
  (Group 3) land and are verified before the INLINE mode (Group 5) and the Feed
  migration (Group 7). The Feed's bespoke player keeps working until task 7.1
  swaps it out, so the Feed is never broken between tasks.
- Checkpoints (tasks 2, 4, 6) gate progression at the riskiest seams.
- Each task references specific sub-requirements for traceability.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5"] },
    { "id": 1, "tasks": ["3.1"] },
    { "id": 2, "tasks": ["3.2", "3.3"] },
    { "id": 3, "tasks": ["3.4", "3.5"] },
    { "id": 4, "tasks": ["5.1"] },
    { "id": 5, "tasks": ["5.2"] },
    { "id": 6, "tasks": ["7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3", "7.4"] },
    { "id": 8, "tasks": ["8.1"] },
    { "id": 9, "tasks": ["9.1"] },
    { "id": 10, "tasks": ["10.1", "10.2"] }
  ]
}
```
