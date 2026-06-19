# Implementation Plan: Clip Player Performance

## Overview

This plan upgrades the single shared `Clip_Engine` in `showshak-shared.js` so the vertical
clip player feels TikTok/Reels-class on Indian 4G. It follows the design's 7-phase rollout.
Each phase is independently shippable and reversible, the Feed is never left broken between
tasks, and `node tests/run-all.js` must be green at the end of every phase (Req 10.5, 10.6).

Conventions honored throughout:

- Vanilla JS, no build step. All **pure** decision helpers live in `showshak-shared.js` and are
  exported in **both** the `window.*` block and the `module.exports` block, next to the existing
  `ssMountedPlayerSet` (Req 10.2).
- Property tests are plain Node + fast-check, one property per file under `tests/prop-*.test.js`,
  each `require('./_pbt.js')` and call `installDomStub()` **before** `require('../showshak-shared.js')`,
  run `numRuns: ITER` (≥100), exit non-zero on failure, and are tagged
  `// Feature: clip-player-performance, Property <n>` + `// **Validates: Requirements X.Y**`.
  They are discovered by the existing `node tests/run-all.js`.
- Engine changes apply to **both** hosts (INLINE Feed + FULLSCREEN viewer) through the single
  `ClipEngine`, with no new branching on surface type outside `ssCreateSurface` (Req 10.1), and
  must not regress existing Feed/viewer behavior (Req 10.5).
- The 6 property-test sub-tasks and all manual/founder-run verification are marked optional `*`.
  Core implementation tasks are never optional.

## Tasks

- [ ] 1. Phase 1 — Instrument baseline (Mux Data + Preconnect)
  - [x] 1.1 Enable and label Mux Data on the Video_Surface
    - In `VideoSurface.mount` (`showshak-shared.js`), set `env-key` from `SS_MUX_ENV_KEY` when present, and per-clip `metadata-video-id` / `metadata-video-title` (+ `metadata-viewer-user-id` where available) attributes on the `<mux-player>` element
    - Ensure Mux Data tracking is left enabled (no `disable-tracking` attribute) so startup time and rebuffering are captured per clip
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 1.2 Audit and complete `<head>` Preconnect hints on all feed-bearing pages
    - Audit `showshak-feed.html`, `showshak-discover.html`, `showshak-watchlist.html`, `showshak-profile.html`, and any other feed-bearing page for `preconnect` + `dns-prefetch` to `stream.mux.com` and `image.mux.com`
    - Add any missing hints (notably `dns-prefetch` for `image.mux.com` to mirror `stream.mux.com`), placed in `<head>` before the feed loads clip media; no JS change
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 1.3 Confirm Mux Data dashboard access (founder-run, not agent-executed)
    - Founder confirms per-clip QoE rows appear in the Mux Data dashboard and that dashboard access is available before it is relied on as the scoreboard
    - _Requirements: 8.4_

  - [ ]* 1.4 Capture baseline TTFF / Rebuffer_Ratio (founder-run, not agent-executed)
    - Founder records current Mux Data baseline (Time_To_First_Frame, Rebuffer_Ratio) to compare against the Req 9 targets in Phase 6
    - _Requirements: 9.1, 9.2, 9.4_

  - [x] 1.5 Checkpoint — Ensure all tests pass
    - Run `node tests/run-all.js`; ensure the full suite is green and the Feed is unchanged. Ask the user if questions arise.
    - _Requirements: 10.5, 10.6_

- [ ] 2. Phase 2 — Persistent Audio_Unlock
  - [x] 2.1 Implement `ssResolveSurfaceMuted(unlocked, mutePref)` pure helper
    - Add the audio-resolution rule to `showshak-shared.js`: returns `true` before Audio_Unlock (autoplay policy forces muted), and `Boolean(mutePref)` once unlocked
    - Export in **both** the `window.*` block and the `module.exports` block next to `ssMountedPlayerSet`
    - _Requirements: 1.4, 1.5, 1.8, 10.2_

  - [x]* 2.2 Write property test for the audio-resolution rule
    - File `tests/prop-resolve-muted.test.js`, **Property 1: Audio-resolution rule honors unlock and preference**
    - **Validates: Requirements 1.4, 1.5, 9.5**

  - [x] 2.3 Implement session Audio_Unlock and the unlock-aware activate path
    - Add `_ssAudioUnlocked` (session flag) and idempotent `ssMarkAudioUnlocked()`; bind it into the first-interaction hooks of **both** INLINE and FULLSCREEN hosts (Req 1.1, 2.5)
    - Add `_activatePostUnlock(prevSurface, surface)`: pause prev, play active, without touching the active surface's muted state; on play rejection retry once then fall back to muted play and repaint the Mute_Icon via `onMutedChange` (Req 1.3, 1.4, 1.8)
    - Route `setActive` to `_activatePostUnlock` when `_ssAudioUnlocked` is true, keeping `_ssActivateSurface`/`_ssActivateSurface`-style pre-unlock path for the very first clip; drive the Mute_Icon from `isMuted()`/`onMutedChange` (Req 1.6, 1.7)
    - Applies identically to both hosts through the single engine (Req 10.1)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 2.5, 10.1_

  - [ ]* 2.4 Write unit tests for `_activatePostUnlock`
    - Using a stub surface, assert it calls `pause`/`play` and never `setMuted` on the active surface; assert single retry then muted fallback on rejected play
    - _Requirements: 1.3, 1.4, 1.8_

  - [x] 2.5 Checkpoint — Ensure all tests pass
    - Run `node tests/run-all.js`; ensure audio is continuous on scroll and the Feed is not regressed. Ask the user if questions arise.
    - _Requirements: 9.5, 10.5, 10.6_

- [ ] 3. Phase 3 — Player recycling pool
  - [x] 3.1 Implement `ssPoolPlan(prevAssignment, mountedBand, poolSize)` pure helper
    - Add the recycling decision to `showshak-shared.js`: returns `{ assignment, keep, repoint, release }` honoring the invariants (bound ≤ poolSize, every band clip assigned once, unique slots, in-band clips keep their slot, freed slots == slots reused)
    - Export in **both** the `window.*` and `module.exports` blocks
    - _Requirements: 2.1, 2.2, 2.3, 2.6_

  - [x]* 3.2 Write property test for the pool plan
    - File `tests/prop-pool-plan.test.js`, **Property 5: Pool plan recycles within bound, covers the band, and is stable**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.6, 9.6**

  - [x] 3.3 Re-anchor `ssMountedPlayerSet` exports for this feature
    - Confirm the existing `ssMountedPlayerSet(activeIdx, totalLoaded, maxLive)` helper is exported in **both** the `window.*` and `module.exports` blocks and is the single source of Mounted_Band membership consumed by the pool
    - _Requirements: 2.8_

  - [x]* 3.4 Write property test for the mounted band
    - File `tests/prop-mounted-set.test.js`, **Property 6: Mounted band is bounded, contiguous, and contains the active clip**
    - **Validates: Requirements 2.8**

  - [x] 3.5 Implement `VideoSurface.repoint(clip)` and `GradientSurface` no-op repoint
    - On `VideoSurface`: set the poster first (poster-first paint), swap `playback-id`, reset ended/error state, and re-apply the resolved muted state so Audio_Unlock is preserved (Req 2.2, 2.4, 2.5, 3.2, 3.3)
    - Add a no-op/rebuild `repoint` on `GradientSurface` so the engine never branches on surface type (Req 10.1)
    - _Requirements: 2.2, 2.4, 2.5, 3.2, 3.3, 10.1_

  - [x] 3.6 Replace destroy-and-recreate pruning with `_poolRecycle`
    - Replace `_ssvPruneSurfaces` and the inline prune with `_poolRecycle(activeIdx, host)`: compute band via `ssMountedPlayerSet`, plan via `ssPoolPlan`, then keep reused surfaces, repoint entering clips onto released slots, and never `destroy()` during normal scroll (only on host teardown)
    - `host` selects the INLINE vs FULLSCREEN state arrays/DOM ids; behavior identical across both hosts (Req 2.7)
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 2.7, 9.6_

  - [ ]* 3.7 Write unit tests for `_poolRecycle` and `repoint`
    - With stub surfaces driven by `ssPoolPlan`, assert exactly the planned set is mounted/re-pointed and nothing is destroyed during scroll; assert scroll-back resumes a pooled surface without re-downloading the manifest
    - _Requirements: 2.2, 2.3, 2.4, 2.6_

  - [x] 3.8 Checkpoint — Ensure all tests pass
    - Run `node tests/run-all.js`; verify scroll-back is instant with no reload flash and the Feed is not regressed. Ask the user if questions arise.
    - _Requirements: 9.6, 10.5, 10.6_

- [ ] 4. Phase 4 — Instant-start stack
  - [x] 4.1 Configure low Start_Rendition on the Video_Surface
    - In `VideoSurface.mount`/`repoint`, set `max-auto-resolution` from `ssNetworkPolicy` (default tier in this phase) and seed `initial-bandwidth-estimate-kbps` low (`SS_START_BW_KBPS`) so the first segment is a small/low rendition before ABR climbs
    - _Requirements: 3.1_

  - [x] 4.2 Poster-first paint on mount and recycle
    - Paint the clip's Poster_Image (slotted `<img slot="poster">`) before video frames render on mount/recycle; when `clip.poster` is absent paint the clip's gradient (`clip.bg`) so the slot is never black
    - _Requirements: 3.2, 3.3, 3.5_

  - [x] 4.3 Warm the First_Clip during the Loading_Curtain
    - While the Loading_Curtain is shown, warm the First_Clip's manifest + first segment via the existing `ssWarmClips()` priming; if the First_Clip identity is not yet known, warm as soon as it resolves so landing playback does not wait on a cold fetch
    - _Requirements: 3.4, 7.1, 7.2, 7.3_

  - [ ]* 4.4 Write unit tests for poster-first and missing-poster fallback
    - Assert the poster is set before `playback-id` on mount/recycle, and that a clip without a poster paints the gradient background
    - _Requirements: 3.2, 3.5_

  - [x] 4.5 Checkpoint — Ensure all tests pass
    - Run `node tests/run-all.js`; verify no black/blank first frame and the Feed is not regressed. Ask the user if questions arise.
    - _Requirements: 10.5, 10.6_

- [ ] 5. Phase 5 — Network-aware adaptation + bandwidth discipline
  - [x] 5.1 Implement `ssNetworkTier(effectiveType)` pure helper
    - Add to `showshak-shared.js`: total classifier returning `'slow' | 'medium' | 'fast'`, never throwing, defaulting to `'medium'` for absent/unknown input; export in **both** the `window.*` and `module.exports` blocks
    - _Requirements: 4.1, 4.5_

  - [x]* 5.2 Write property test for network tier classification
    - File `tests/prop-network-tier.test.js`, **Property 2: Network tier classification is total**
    - **Validates: Requirements 4.1, 4.5**

  - [x] 5.3 Implement `ssNetworkPolicy(tier)` pure helper
    - Add to `showshak-shared.js`: maps tier to `{ preloadDepth, maxResolution }` (slow→1/480p, medium→3/720p, fast→5/1080p), unknown tier falls back to the medium row; export in **both** blocks
    - _Requirements: 4.2, 4.3, 4.4, 4.6_

  - [x]* 5.4 Write property test for network policy
    - File `tests/prop-network-policy.test.js`, **Property 3: Network policy is monotonic in tier**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.6**

  - [x] 5.5 Implement `ssPreloadAction(state)` pure helper
    - Add to `showshak-shared.js`: returns `'start'|'pause'|'resume'|'cancel'|'idle'` — `'pause'` when active not ready, `'cancel'` when `inFlight > 1`, `'start'/'resume'` only when active ready, `inFlight === 0`, `warmed < preloadDepth`, else `'idle'`; export in **both** blocks
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x]* 5.6 Write property test for the preload gate
    - File `tests/prop-preload-action.test.js`, **Property 4: Preload gate always prioritizes the active clip**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

  - [x] 5.7 Implement `_warmNext` gated by tier/policy/preload
    - Add `_warmNext(activeIdx, host)`: warm the next clip(s) up to `ssNetworkPolicy(ssNetworkTier(...)).preloadDepth`, gated by `ssPreloadAction(state)`, keeping a single in-flight off-screen prefetch and prioritizing the active clip's requests; wire into both hosts and set the tier-driven `max-auto-resolution` ceiling on the surface
    - _Requirements: 3.4, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4_

  - [ ]* 5.8 Write unit tests for `_warmNext` gating
    - Assert single-in-flight discipline, off-screen preloading pauses while the active clip buffers and resumes when ready, and the active clip is prioritized
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 5.9 Checkpoint — Ensure all tests pass
    - Run `node tests/run-all.js`; verify smooth playback on a throttled connection and no Feed regression. Ask the user if questions arise.
    - _Requirements: 10.5, 10.6_

- [ ] 6. Phase 6 — Measure against the Req 9 targets
  - [ ]* 6.1 Real-device 4G + Mux Data review (founder-run, not agent-executed)
    - Founder runs a real mid-range Android / 4G session and reviews Mux Data against the targets: TTFF < 800ms wifi / < 1500ms 4G, Rebuffer_Ratio < 1%, Scroll_To_Play < 150ms on a pre-warmed clip, audio continuity on scroll, instant scroll-back with no re-download flash
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

## Phase 7 — Decide MP4 (conditional follow-up, out of scope)

Not a coding task in this feature. **Only if** the Phase 6 measurement falls short of the Req 9
targets, a deferred 360p static MP4 add-on is reconsidered as a **separate** decision (it is a
paid add-on that costs storage even when unplayed). Tracked here as a conditional follow-up; no
implementation tasks are scheduled under this spec.

## Notes

- Tasks marked with `*` are optional: the 6 property-test sub-tasks (one per design property) and
  all founder-run/manual verification. Core implementation tasks are never optional.
- Founder-run / external items (not agent-executed): 1.3 confirm Mux Data dashboard access
  (Req 8.4), 1.4 baseline capture, and 6.1 the real-device 4G measurement against the Req 9 targets.
- Property → helper → test-file mapping (design Testing Strategy table):
  P1 `ssResolveSurfaceMuted` → `tests/prop-resolve-muted.test.js`;
  P2 `ssNetworkTier` → `tests/prop-network-tier.test.js`;
  P3 `ssNetworkPolicy` → `tests/prop-network-policy.test.js`;
  P4 `ssPreloadAction` → `tests/prop-preload-action.test.js`;
  P5 `ssPoolPlan` → `tests/prop-pool-plan.test.js`;
  P6 `ssMountedPlayerSet` → `tests/prop-mounted-set.test.js`.
- Every new pure helper is exported in **both** the `window.*` block and the `module.exports`
  block of `showshak-shared.js`, next to `ssMountedPlayerSet`.
- Each phase ends with a checkpoint that runs the full suite (`node tests/run-all.js`); the Feed
  must stay shippable and reversible between phases (Req 10.5, 10.6).
- Engine changes go through the single `ClipEngine` and the `MediaSurfaceContract`, with no new
  branching on surface type outside `ssCreateSurface` (Req 10.1).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "1.3", "1.4"] },
    { "id": 2, "tasks": ["2.3", "2.2"] },
    { "id": 3, "tasks": ["3.1", "2.4"] },
    { "id": 4, "tasks": ["3.3", "3.2"] },
    { "id": 5, "tasks": ["3.5", "3.4"] },
    { "id": 6, "tasks": ["3.6"] },
    { "id": 7, "tasks": ["4.1", "3.7"] },
    { "id": 8, "tasks": ["4.2"] },
    { "id": 9, "tasks": ["4.3", "4.4"] },
    { "id": 10, "tasks": ["5.1"] },
    { "id": 11, "tasks": ["5.3", "5.2"] },
    { "id": 12, "tasks": ["5.5", "5.4"] },
    { "id": 13, "tasks": ["5.7", "5.6"] },
    { "id": 14, "tasks": ["5.8", "6.1"] }
  ]
}
```
