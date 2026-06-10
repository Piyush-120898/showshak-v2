# Design Document

## Overview

ShowShak runs two independent clip players. The Feed (`showshak-feed.html`)
ships a bespoke inline player — `buildFeed`, `attachDoubleTap`, `triggerBurst`,
`flashCTA`, `syncRail`, `initScrollObserver`, `startProgress`/`stopProgress`,
`handleTap`, `toggleMute`, `toggleLit`, `toggleSave`, `navigateFeed`,
`positionRail`, plus the `muted-badge` "Tap for sound" prompt, per-clip
`prog-wrap-${i}`/`prog-${i}` progress bars, and the `feed-end` /
`feed-end-title` "YOU'VE SEEN IT ALL" card. The universal fullscreen viewer
(`showshak-shared.js`) ships a second player — `ssOpenClip`, `_ssvBuildList`,
`_ssvClipHTML`, `_ssvSetupObserver`, `_ssvAttachDoubleTap`/`_ssvFireOn`,
`_ssvAttachSwipe`, `_ssvToggleFire`, `ssCloseClip`/`_ssvTeardownViewer`,
`_ssvKeydown` — with the shared Watch It sheet (`ssOpenSheet`), Save/Stacks,
Following, and DB helpers `_ssDbFire`/`_ssDbFollow`.

Fire, Save, and Watch It exist twice, with two sets of DOM ids, two observers,
two gesture models, and two progress strategies (the viewer has no progress bar
at all; the Feed has no double-tap-with-burst gesture state machine shared with
the viewer, and no sound that survives navigation).

This design consolidates both surfaces onto a **single shared clip engine**
(`Clip_Engine`) that lives in `showshak-shared.js`, built **on top of the
existing universal viewer** as its foundation. The engine renders in two modes —
**INLINE** (the Feed's vertical scroll-snap frames) and **FULLSCREEN** (the
immersion layer opened by `ssOpenClip`) — from one rendering path, one gesture
handler, one progress component, one sound model, one action rail, one guest
gate, and one set of DB wiring. The Feed's bespoke player is retired and rebuilt
on the engine. A **`Media_Surface`** abstraction decouples the engine from the
rendering medium so today's CSS-gradient placeholders work now and a future Mux
`<video>` slots in behind the same interface with no engine branching.

This is predominantly a **refactor**: most behavior already exists in
`showshak-shared.js`'s viewer and `showshak-feed.html`'s player. The new code is
the `Media_Surface` interface + `GradientSurface`, the `Mute_Preference` module,
the unified `Progress_Bar` and `Gesture_Handler`, the INLINE render mode, and
the `Recommendation_Seam` indirection. Everything else is moved, merged, or
deleted.

## Goals and Non-Goals

**Goals**
- One engine in `showshak-shared.js` powering INLINE and FULLSCREEN.
- Fire, Save, Watch It, sound, and progress each defined exactly once.
- Media medium behind a `Media_Surface` interface (`GradientSurface` now,
  `VideoSurface` seam later).
- Preserve every product rule and interaction listed in Requirements 10–11.

**Non-Goals**
- Building `VideoSurface` / wiring real Mux playback (only the seam is designed).
- Building a recommendation backend (only the `Recommendation_Seam` is exposed).
- Changing the visual design of clips, rail, or sheet.
- Changing the Supabase schema or the DB helpers' internals.

---

## Architecture

```
                        ┌──────────────────────────────────────────────┐
                        │            Clip_Engine  (showshak-shared.js)  │
                        │                                               │
   showshak-feed.html   │   ClipEngine.mountInline(container, clips)    │
   (INLINE host)  ──────┼──▶ ┌────────────────────────────────────────┐│
                        │    │  Render path  (_ssvClipHTML, mode-aware) ││
   ssOpenClip(...)      │    │  Gesture_Handler (single=pause/dbl=fire) ││
   from Feed/Discover/  │    │  Progress_Bar    (one component)         ││
   Watchlist/Profile ───┼──▶ │  Sound model     (Mute_Preference)       ││
   (FULLSCREEN host)    │    │  Action rail     (Fire/Save/Share/Watch) ││
                        │    │  Guest gate      (ssGuestGuard)          ││
                        │    │  Active-clip observer (IntersectionObs)  ││
                        │    │  Recommendation_Seam (ssClipOrdering)    ││
                        │    └───────────────┬────────────────────────┘│
                        │                    │ talks ONLY to interface  │
                        │            ┌────────▼─────────┐                │
                        │            │  Media_Surface   │  (abstraction) │
                        │            └───┬──────────┬───┘                │
                        │        ┌───────▼──┐   ┌───▼─────────────────┐  │
                        │        │Gradient  │   │VideoSurface (future)│  │
                        │        │Surface   │   │ wraps Mux <video>   │  │
                        │        │(timer)   │   └─────────────────────┘  │
                        │        └──────────┘                           │
                        └───────────────────────────────────────────────┘
                                         │ fire-and-forget
                              _ssDbFire / _ssDbFollow / Stacks (DB wiring)
```

### Render modes from one engine

The engine renders the **same clip model** into two host containers. Mode is a
parameter, not a branch in playback logic.

| Concern | INLINE mode | FULLSCREEN mode |
|---|---|---|
| Host container | `#feed` in `showshak-feed.html` | `#ssv-feed` in the injected `#ss-clip-viewer` |
| Layout | existing vertical scroll-snap, `clip-column`, mobile per-clip rail + fixed desktop `#action-rail` (`positionRail`) | existing `.ssv-feed` scroll-snap column, `.ssv-rail` |
| Entry sound | first clip muted until first gesture (browser autoplay policy) | opens with sound (gesture-initiated), per `Mute_Preference` |
| Back/close | n/a (page-level) | swipe-right / Esc / back button (`ssCloseClip`) |
| Opened by | page load (`ClipEngine.mountInline`) | `ssOpenClip(clipOrId, list)` |

Shared by **both** modes (defined once): the clip render template, the
`Gesture_Handler` (single-tap pause/resume + double-tap fire+burst), the
`Progress_Bar`, the `Mute_Preference` sound model, the action rail
(Fire/Save/Share/Watch It), the `IntersectionObserver` active-clip tracking,
the guest gate, and the DB wiring.

### Media_Surface abstraction

The engine never references "gradient" or "video". It calls an interface. Each
clip owns one `Media_Surface` instance.

```javascript
/**
 * Media_Surface — the contract the Clip_Engine speaks to.
 * Implementations: GradientSurface (now), VideoSurface (future, Mux <video>).
 * The engine NEVER branches on surface type; it only calls these methods
 * and subscribes to these callbacks.
 */
const MediaSurfaceContract = {
  mount(containerEl) {},      // build & attach the medium's DOM node
  play() {},                  // start/resume playback (returns Promise)
  pause() {},                 // pause playback
  setMuted(isMuted) {},       // audio on/off (no-op audio for gradient)
  isMuted() {},               // -> boolean
  getProgress() {},           // -> number in [0,1]
  seek(fraction) {},          // jump to fraction in [0,1]
  onTimeupdate(cb) {},        // cb(progress:0..1) fired as playback advances
  onEnded(cb) {},             // cb() fired when the clip reaches its end
  destroy() {},               // stop timers/listeners, detach DOM
};
```

`GradientSurface` (now) — wraps the existing `clip-bg` / `ssv-bg` gradient
`<div>` and drives progress from a timer, exactly like the Feed's current
`startProgress` 40ms tick. It models a fixed synthetic duration so
`getProgress()` and `onTimeupdate` behave like real media.

```javascript
function GradientSurface(clip, opts) {
  const DURATION_MS = (opts && opts.durationMs) || 16000; // ~ Feed 40ms*0.25%
  let el = null, raf = null, startedAt = 0, elapsedBase = 0;
  let muted = true, ended = false;
  const onTick = [], onEnd = [];

  function loop(now) {
    const elapsed = elapsedBase + (now - startedAt);
    const p = Math.max(0, Math.min(1, elapsed / DURATION_MS));
    onTick.forEach(cb => cb(p));
    if (p >= 1) { ended = true; onEnd.forEach(cb => cb()); return; }
    raf = requestAnimationFrame(loop);
  }
  return {
    mount(container) {
      el = document.createElement('div');
      el.className = (opts && opts.bgClass) || 'clip-bg';
      el.style.background = clip.bg;
      container.appendChild(el);
      return el;
    },
    play() {
      if (ended) return Promise.resolve();
      startedAt = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
      return Promise.resolve();           // mirrors video.play() Promise
    },
    pause() {
      cancelAnimationFrame(raf);
      elapsedBase += performance.now() - startedAt;
    },
    setMuted(m) { muted = !!m; },          // gradient has no audio track
    isMuted() { return muted; },
    getProgress() {
      return Math.max(0, Math.min(1, elapsedBase / DURATION_MS));
    },
    seek(f) { elapsedBase = Math.max(0, Math.min(1, f)) * DURATION_MS; },
    onTimeupdate(cb) { onTick.push(cb); },
    onEnded(cb) { onEnd.push(cb); },
    destroy() { cancelAnimationFrame(raf); el && el.remove(); el = null; },
  };
}
```

`VideoSurface` (future seam — designed, not built) — wraps a Mux `<video>`:
`play()`→`video.play()`, `pause()`→`video.pause()`, `setMuted`→`video.muted`,
`getProgress`→`video.currentTime/video.duration`, `onTimeupdate`→`timeupdate`
event, `onEnded`→`ended` event. Because the engine only speaks
`MediaSurfaceContract`, adding `VideoSurface` requires **zero** engine changes —
only a factory switch:

```javascript
// Single factory. The ONLY place that decides which surface a clip gets.
function ssCreateSurface(clip, opts) {
  return clip.muxPlaybackId
    ? VideoSurface(clip, opts)     // future
    : GradientSurface(clip, opts); // today
}
```

### Sound model (`Mute_Preference`)

A shared, persisted muted-state module backed by `localStorage` (distinct from
the Stacks/Following `sessionStorage` so the sound choice survives tab close).

```javascript
const SS_MUTE_KEY = 'ss_mute_pref_v1';
const _ssMuteListeners = [];

function ssGetMutePref() {
  try { return JSON.parse(localStorage.getItem(SS_MUTE_KEY)) === true; }
  catch { return false; }            // default: sound ON
}
function ssSetMutePref(muted) {
  try { localStorage.setItem(SS_MUTE_KEY, JSON.stringify(!!muted)); }
  catch (e) { _ssMuteFallback = !!muted; } // private mode -> in-memory
  _ssMuteListeners.forEach(fn => { try { fn(!!muted); } catch {} });
}
function ssOnMuteChange(fn) { if (typeof fn === 'function') _ssMuteListeners.push(fn); }
```

Entry rules layered on top of the persisted preference:

- **FULLSCREEN open** is always user-gesture-initiated, so autoplay-with-audio
  is permitted. The engine applies `ssGetMutePref()` (default OFF → sound from
  the first frame, Req 4.1). If the user explicitly muted, that persists and is
  honored (Req 5.3 — "no surprise" wins over a blanket unmute).
- **INLINE first clip** plays with a transient `_inlineAwaitingGesture = true`
  flag forcing `surface.setMuted(true)` regardless of preference, to satisfy
  browser muted-autoplay policy (Req 4.2). The first user interaction (tap,
  scroll, or key) clears the flag and applies `ssGetMutePref()` to the active
  surface (Req 4.3). Thereafter every newly-activated surface reads
  `ssGetMutePref()` (Req 5.2).
- **Mute toggle**: a single mute control (corner icon) shared by both modes
  calls `ssSetMutePref(...)`; `ssOnMuteChange` re-applies it to the active
  surface live. This replaces the deleted "Tap for sound" badge — there is **no
  "tap for sound" prompt** (Req 4.5).
- **Hardware silent switch**: respected only where the browser exposes it (e.g.
  a future `VideoSurface` honoring the platform's media session / muted state).
  No JS workaround is engineered where the platform hides it (Req 4.4).

### Progress bar (one component)

One `Progress_Bar` factory, driven by `Media_Surface` progress, used in both
modes. It replaces the Feed's `prog-wrap-${i}`/`prog-${i}` pair and **adds** a
progress bar to FULLSCREEN, which currently has none.

```javascript
function ssMakeProgressBar(container) {
  const wrap = document.createElement('div');
  wrap.className = 'ss-progress';
  const fill = document.createElement('div');
  fill.className = 'ss-progress-fill';
  fill.style.width = '0%';
  wrap.appendChild(fill);
  container.appendChild(wrap);
  return {
    set(fraction) { fill.style.width = (Math.max(0, Math.min(1, fraction)) * 100) + '%'; },
    el: wrap,
  };
}
// Wiring (same in both modes):
//   surface.onTimeupdate(p => progressBar.set(p));
```

### Gesture model (one handler)

The Feed has single-tap pause (`handleTap`) and a separate click-based
double-tap fire (`attachDoubleTap`); the viewer has only double-tap/dblclick
fire (`_ssvAttachDoubleTap` → `_ssvFireOn`) with no single-tap pause. The engine
**converges** them into one `Gesture_Handler` used by both modes: single tap →
pause/resume the active surface; double tap → register Fire + burst at the tap
point.

```javascript
function ssAttachGestures(tapZoneEl, idx, engine) {
  let lastTap = 0, timer = null, lastX = 0, lastY = 0;
  function onTap(x, y) {
    const now = Date.now(), gap = now - lastTap;
    const near = Math.abs(x - lastX) < 40 && Math.abs(y - lastY) < 40;
    lastTap = now; lastX = x; lastY = y;
    if (gap > 0 && gap < 300 && near) {       // DOUBLE -> fire + burst
      clearTimeout(timer);
      engine.fire(idx, x, y);                 // guest-gated inside engine.fire
    } else {                                   // maybe SINGLE -> defer
      timer = setTimeout(() => engine.togglePause(idx), 310);
    }
  }
  tapZoneEl.addEventListener('click', e => onTap(e.clientX, e.clientY));
  tapZoneEl.addEventListener('touchend', e => {
    const t = e.changedTouches[0]; if (t) onTap(t.clientX, t.clientY);
  }, { passive: true });
}
```

`engine.fire(idx, x, y)` is the single Fire definition: it runs the guest gate
(`ssGuestGuard('fire')`), flips fire state on, pulses the rail flame, plays the
fire-burst at `(x,y)`, flashes the Watch It CTA, and calls `_ssDbFire`. This
unifies the Feed's `toggleLit`+`triggerBurst`+`flashCTA` and the viewer's
`_ssvFireOn`+`_ssvToggleFire`.

### Recommendation_Seam

`_ssvBuildList` (start clip + genre-related + rest) stays as today's ordering,
but the engine calls it **only** through one indirection so a recommendation
feed can replace it later with no engine edits (Req 7.5).

```javascript
// The ONLY ordering entry point the engine uses. Swap its body later
// (e.g. fetch a recommendation feed) without touching engine internals.
function ssClipOrdering(clicked, list) {
  return _ssvBuildList(clicked, list);   // today: genre-segment ordering
}
```

`ssOpenClip` changes its one line `_ssvClips = _ssvBuildList(clicked, list)` to
`_ssvClips = ssClipOrdering(clicked, list)`.

---

## Components and Interfaces

### Public engine API (added to `showshak-shared.js`)

```javascript
const ClipEngine = {
  // INLINE: rebuild the Feed on the engine. Renders `clips` into `container`
  // (#feed) using the existing scroll-snap layout, mobile + desktop rails.
  mountInline(container, clips, opts) {},

  // FULLSCREEN: unchanged entry point, now backed by the shared engine.
  // (ssOpenClip remains the global function pages already call.)
  openFullscreen(clipOrId, list) {},   // === ssOpenClip

  // Shared operations (one definition each):
  fire(idx, x, y) {},        // double-tap / rail flame  (guest-gated, _ssDbFire)
  togglePause(idx) {},       // single tap
  toggleSave(idx, btnEl) {}, // rail Save                (guest-gated, Stacks DB)
  share(idx) {},             // rail Share               (ssShare)
  watchIt(idx) {},           // Watch It                 (ssOpenSheet)
  setActive(idx) {},         // observer -> apply Mute_Preference, progress
};
```

### Reused / refactored existing functions

| Function (current) | Disposition |
|---|---|
| `_ssvBuildList` | **Reused**, now reached via `ssClipOrdering` seam |
| `_ssvNormalize` | **Reused** as the canonical clip normalizer for both modes |
| `_ssvClipHTML` | **Refactored** to be mode-aware (INLINE vs FULLSCREEN class set) and to host a `Media_Surface` node + `Progress_Bar` instead of a hardcoded `ssv-bg` |
| `_ssvSetupObserver` | **Reused/generalized** to drive `setActive(idx)` for both hosts |
| `_ssvToggleFire` / `_ssvFireOn` | **Merged** into `ClipEngine.fire` |
| `_ssvAttachDoubleTap` | **Replaced** by `ssAttachGestures` (adds single-tap pause) |
| `_ssvAttachSwipe`, `ssCloseClip`, `_ssvTeardownViewer`, `_ssvOnPopState`, `_ssvKeydown` | **Reused** (FULLSCREEN only) |
| `ssOpenSheet` / `ssCloseSheet` | **Reused** as the single Watch It surface for both modes |
| `_ssDbFire` / `_ssDbFollow` / Stacks wiring | **Reused unchanged** |
| `ssGuestGuard` | **Reused unchanged** |

### Removed from `showshak-feed.html`

- Player functions: `buildFeed`, `attachDoubleTap`, `triggerBurst`, `flashCTA`,
  `syncRail`, `animateRailIn`, `initScrollObserver`, `startProgress`,
  `stopProgress`, `handleTap`, `toggleMute`, `toggleLit`, `toggleSave`,
  `positionRail`, and the `litState`/`progressTimers`/`isPaused`/`currentClip`
  page state (Req 8.2). `navigateFeed` + the keydown handler move into the
  engine's INLINE keyboard nav (Req 11.1).
- Markup: the `muted-badge` "Tap for sound" element (Req 4.5); the `feed-end` /
  `feed-end-title` "YOU'VE SEEN IT ALL" card (Req 6.1, 6.2); the bespoke
  per-clip `prog-wrap-${i}`/`prog-${i}` bars (now produced by the engine's
  `Progress_Bar`).
- The Feed's bespoke `#watch-sheet` markup and the `data-no-sheet` attribute on
  `#ss-nav` — see decision below.

The Feed page shrinks to: load data (`loadRealClips` via `SSData.feedShows()` /
`ssLoadClips` / `ssClipsForFeed`), then `ClipEngine.mountInline(document
.getElementById('feed'), SHOWS)`. The desktop `#action-rail` / `#nav-arrows`
markup and the feed CSS layout stay; the engine drives them.

### Decision: Feed adopts the shared Watch It sheet

**The Feed drops its bespoke `#watch-sheet` and uses the shared sheet** injected
by `ssInjectChrome` (`SS_WATCH_SHEET_HTML`), and the `data-no-sheet` attribute on
`#ss-nav` is removed.

Rationale: Requirement 1.5 mandates Watch It is defined exactly once, and 10.3
mandates platform availability is exposed only through the `Watch_It_Sheet`. The
shared `ssOpenSheet`/`ssCloseSheet` already render an identical sheet and are the
sole platform reveal on every other page. The `data-no-sheet` flag exists only to
prevent a **duplicate `#watch-sheet` id** when the Feed carried its own copy.
Once the Feed renders through the single engine and calls the shared
`ssOpenSheet`, its private sheet is redundant and would re-introduce exactly the
duplication this feature removes. Keeping a Feed-only sheet would violate Req 1.5
and risk drift. Both inline (`mobile-watch-btn` / `rail-watch`) and fullscreen
Watch It controls therefore call `ssOpenSheet(clip)` (Req 11.6).

---

## Data Models

### Canonical clip model

`_ssvNormalize(raw)` is the single normalizer for both modes, producing:
`{ id, title, bg, caption, genre[], lang, year, season, creator{name,letter,bg},
fires, platLabel, platColor, platAbbr, platRgb, platforms[] }`. `title` is
carried but **never rendered on the clip body** — it is revealed only in the
Watch It sheet (Req 10.1, 10.3). No view/follower counts are part of the model
or render (Req 10.4).

### Active clip & surface lifecycle

```
load / open
  └─ ssClipOrdering(clicked, list) ──▶ ordered clip array
        └─ for each clip: render template + ssCreateSurface(clip) + Progress_Bar
              └─ IntersectionObserver(threshold 0.6) ──▶ ClipEngine.setActive(idx)
                    ├─ previous active surface.pause()
                    ├─ active surface.setMuted( resolveMuted(mode) )
                    ├─ active surface.play()  (catch autoplay rejection -> muted retry)
                    └─ active surface.onTimeupdate(p => progressBar.set(p))
```

`resolveMuted(mode)`:
- INLINE while `_inlineAwaitingGesture` → `true`.
- otherwise → `ssGetMutePref()`.
- FULLSCREEN → `ssGetMutePref()` (gesture-initiated open permits audio).

### Mute preference flow

```
page load ──▶ ssGetMutePref() seeds initial muted state           (Req 5.4)
INLINE first clip ──▶ forced muted until first gesture            (Req 4.2)
first gesture ──▶ clear flag, apply ssGetMutePref() to active     (Req 4.3)
advance clip ──▶ setActive applies ssGetMutePref()                (Req 5.2)
mute toggle ──▶ ssSetMutePref(x) ──▶ localStorage + ssOnMuteChange (Req 5.1)
open fullscreen ──▶ apply ssGetMutePref()                          (Req 5.3)
```

### DB & social wiring (unchanged)

`ClipEngine.fire` → `_ssDbFire(clip.id, on)` (skips non-uuid mock ids, no-ops for
guests). Save → `ssToggleSave(clip, btn)` → Stacks + `_ssDbCreateStack`/clip
wiring. Follow buttons → `ssWireFollowButtons`/`ssToggleFollow` → `_ssDbFollow`.
All are fire-and-forget with internal `try/catch` (Req 10.6, 10.7, 10.8).

---

## Error Handling

- **`localStorage` unavailable** (private mode / blocked): `ssGetMutePref` /
  `ssSetMutePref` wrap access in `try/catch` and fall back to an in-memory
  `_ssMuteFallback`. Sound still toggles for the session; it just does not
  persist across reloads.
- **Autoplay rejection**: `surface.play()` returns a Promise. On rejection
  (browser blocks audio autoplay), the engine retries with
  `surface.setMuted(true); surface.play()`. This keeps `GradientSurface`
  trivially safe and makes the future `VideoSurface` robust without engine
  changes.
- **Missing host container / clip**: `mountInline` and `openFullscreen` no-op if
  `container`/clip is absent (mirrors existing `ssOpenClip` guard
  `if (!clicked) return;`).
- **Surface teardown**: `setActive` pauses the previous surface; mode teardown
  (`_ssvTeardownViewer`, INLINE unmount) calls `surface.destroy()` on every clip
  to cancel timers/`requestAnimationFrame` and disconnect the observer — closing
  the timer leak the Feed's `progressTimers` could otherwise leave behind.
- **DB writes**: already isolated in `_ssDbFire`/`_ssDbFollow` `try/catch`; a
  failed write never breaks the UI.
- **Guest actions**: `ssGuestGuard` blocks Fire/Save/Follow for guests and shows
  the signup sheet before any DB write is attempted (Req 10.5).
- **Mock vs real clips**: `_ssDbFire` already gates on a uuid regex; mock
  integer-id clips no-op safely so the prototype keeps working.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all
valid executions of a system — a formal statement about what the system should
do. Properties bridge human-readable specifications and machine-verifiable
correctness guarantees.*

### Property 1: Mute preference round-trips and is applied everywhere

*For any* boolean preference value `m`, calling `ssSetMutePref(m)` and then
reading `ssGetMutePref()` returns `m`; and on every subsequent surface
activation (clip advance, page init, or inline→fullscreen transition) the
active `Media_Surface`'s `isMuted()` equals the persisted preference (subject
to the inline first-clip forced-mute rule before the first gesture).

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 2: Single tap is an involution on play state

*For any* clip in any mode, applying two single taps returns the clip to its
original play/paused state, and a single tap always flips it (playing→paused,
paused→playing).

**Validates: Requirements 3.1, 3.2, 3.5**

### Property 3: Double tap registers a fire and a burst in both modes

*For any* clip in either INLINE or FULLSCREEN mode, a double tap sets the clip's
fire state to on (idempotent if already fired) and triggers a fire-burst at the
tap location.

**Validates: Requirements 3.3, 3.4, 3.5, 11.5**

### Property 4: Progress is monotonic and proportional to elapsed playback

*For any* elapsed playback time `t` within a clip's duration `d`, the
`Media_Surface` progress equals `clamp(t/d, 0, 1)` and never decreases while
playback advances; the `Progress_Bar` fill width is set to that fraction.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 5: Clip ordering starts at the tapped clip and preserves all clips

*For any* clicked clip and any list, `ssClipOrdering(clicked, list)` returns the
clicked clip first and contains every distinct clip from the list exactly once
(genre-related clips ordered before unrelated ones).

**Validates: Requirements 7.3, 7.4, 7.5**

### Property 6: Engine controls every surface through the same contract

*For any* sequence of engine commands (`play`, `pause`, `setMuted`, `seek`) and
any `Media_Surface` implementation conforming to the contract, the engine
produces identical observable state transitions — it never branches on whether
the surface is a `GradientSurface` or a `VideoSurface`.

**Validates: Requirements 9.1, 9.2, 9.3**

### Property 7: Guest actions are gated before any persistence

*For any* gated action (Fire, Save, or Follow) initiated while the user is a
guest, the engine blocks the action via `ssGuestGuard` and does not invoke the
corresponding DB wiring (`_ssDbFire` / `_ssDbFollow` / Stacks write).

**Validates: Requirements 10.5**

### Property 8: Rendered clips never expose title or counts

*For any* clip, the rendered INLINE or FULLSCREEN clip body contains neither the
show title nor any view-count or follower-count text (the title appears only in
the Watch It sheet).

**Validates: Requirements 10.1, 10.3, 10.4**

---

## Testing Strategy

This is a vanilla JS/HTML/CSS project with **no build step and no test
harness**. The primary strategy is a structured **manual regression checklist**
run in the browser across the Feed and every page that opens the viewer, plus
**static code review** for the "defined exactly once" requirements. The pure
functions identified below are the seams where automated property tests can be
added later if a lightweight runner (e.g. a single `<script>`-loaded test page
with `fast-check`) is introduced — no such runner is added by this feature.

### Manual regression checklist

**Feed — INLINE (`showshak-feed.html`)**
- [ ] Feed renders through `ClipEngine.mountInline`; clips scroll with
  scroll-snap; first clip auto-plays (Req 7.1, 8.1).
- [ ] First clip is muted on load; sound turns on after the first tap/scroll;
  no "Tap for sound" badge anywhere (Req 4.2, 4.3, 4.5).
- [ ] Mute toggle persists across a reload and into the fullscreen viewer
  (Req 5.1, 5.3, 5.4).
- [ ] Single tap pauses; tapping again resumes; pause icon shows (Req 3.1, 3.2).
- [ ] Double tap fires the clip + burst at the tap point + flame pulse + Watch
  It flash (Req 3.3, 3.4, 11.5).
- [ ] Progress bar advances on the active clip and resets/advances correctly on
  clip change (Req 2.1, 2.3).
- [ ] Mobile rail shows at mobile width; desktop `#action-rail` tracks the clip
  column on load and on resize (`positionRail`) (Req 11.3, 11.4).
- [ ] Arrow keys / j / k navigate between clips (Req 11.1); scroll-snap intact
  (Req 11.2).
- [ ] Watch It (mobile + desktop) opens the **shared** sheet (Req 10.3, 11.6).
- [ ] No "YOU'VE SEEN IT ALL" end card (Req 6.1, 6.2).
- [ ] Fire/Save/Follow as a guest shows the signup sheet (Req 10.5); as a signed
  user, fire persists (real clips) via `_ssDbFire` (Req 10.6).

**Fullscreen viewer — from Feed, Discover, Watchlist, Profile**
- [ ] `ssOpenClip` opens at the tapped clip; scroll moves through ordered clips
  (Req 1.2, 7.3, 7.4).
- [ ] Opens with sound (unless previously muted) — honors `Mute_Preference`
  (Req 4.1, 5.3).
- [ ] Progress bar now present and advancing in fullscreen (Req 2.2).
- [ ] Single tap pauses/resumes; double tap fires + burst (Req 3.1–3.4).
- [ ] Watch It opens the shared sheet; title revealed only there (Req 10.3).
- [ ] Swipe-right / Esc / back button close the viewer (`ssCloseClip`).
- [ ] Save/Follow stay in sync with the underlying page after close.

**Cross-cutting**
- [ ] No clip shows the title or any counts in either mode (Req 10.1, 10.4).
- [ ] Fire control is the SVG flame in both rails (Req 10.2).
- [ ] No console timer leaks after navigating away (surfaces `destroy()`d).

### Static review checklist ("defined exactly once")

- [ ] Feed no longer defines `buildFeed`/`syncRail`/`toggleLit`/`toggleMute`/
  `startProgress`/`stopProgress`/`positionRail` as standalone player code
  (Req 8.2); behavior provided by the engine (Req 8.3).
- [ ] Fire, Save, Watch It, sound, and progress each have a single definition in
  `showshak-shared.js` (Req 1.3–1.7).
- [ ] Engine code contains no gradient-specific branching; medium decisions live
  only in `ssCreateSurface` (Req 9.2).
- [ ] Engine ordering goes only through `ssClipOrdering` (Req 7.5).
- [ ] Feed's bespoke `#watch-sheet` and `data-no-sheet` removed; shared sheet
  used (Req 1.5).

### Property-test seams (future, if a runner is added)

Pure/near-pure functions suitable for property tests, mapped to the properties
above (≥100 iterations each, tagged `Feature: unified-clip-player, Property N`):
- `ssGetMutePref`/`ssSetMutePref` round-trip → Property 1.
- `ssAttachGestures` tap state machine (single-tap involution) → Property 2.
- `GradientSurface.getProgress` proportionality/monotonicity → Property 4.
- `ssClipOrdering`/`_ssvBuildList` ordering invariants → Property 5.
- A `MediaSurfaceContract` conformance harness run against both
  `GradientSurface` and a stub `VideoSurface` → Property 6.
- `_ssvClipHTML` output never contains `clip.title` or count text → Property 8.
