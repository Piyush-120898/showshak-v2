# Requirements Document

## Introduction

This feature makes the ShowShak vertical clip player "A-grade" — seamless, TikTok/Reels-class smoothness. The clip player is the core of the product, and everything depends on it. One shared Clip_Engine in `showshak-shared.js` powers both the inline Feed (`mountInline`) and the fullscreen viewer, and that single engine must deliver instant first frames, gap-free scroll-to-play, uninterrupted audio on scroll, and instant scroll-back with zero re-download — all on the hardest realistic target.

Video is delivered by Mux (HLS via the `<mux-player>` web component, public playback IDs) on the pay-as-you-go plan. The frontend is vanilla HTML/CSS/JS with no build step; all pure decision logic (player-pool decisions, preload/window math, network tiers, audio-resolution rules) lives in `showshak-shared.js` and is exported via `module.exports` for Node + fast-check property tests (run: `node tests/run-all.js`).

This feature changes four player behaviors that currently cause perceptible problems and adds the levers needed to hit measurable smoothness targets:

1. A persistent audio-unlock model that stops audio from dropping when scrolling between clips.
2. A fixed recycling pool of mounted players that replaces the current destroy-and-recreate behavior, fixing scroll-back reloads and micro-jank while preserving the audio-unlock state.
3. A stacked instant-first-frame strategy (low start rendition, poster-first, next-clip warming).
4. Network-aware adaptation and bandwidth discipline so the active clip always wins the network pipe.

Supporting work includes DNS/TLS preconnect to Mux domains, pre-warming the very first clip during the loading curtain, and enabling Mux Data QoE instrumentation as the objective scoreboard that verifies the performance targets.

### Launch-market worst case (the design target for all performance bounds)

All performance targets in this document are defined against a mid-range Android phone on Indian 4G (patchy mobile data). The system is built for the hardest realistic user.

### Non-Goals (explicitly out of scope)

- MP4 static renditions are deferred. Free HLS levers are applied first; a 360p MP4 add-on is reconsidered only if a real 4G test still falls short, and it is a paid add-on that costs storage even when unplayed.
- No second CDN or cache vendor is introduced (Mux already provides CDN delivery).
- No player-library swap (`<mux-player>` stays).
- Full service-worker segment caching is the later PWA layer, not part of this feature.
- Native-grade perfection beyond what a browser allows is reserved for the future native app.

### Phasing intent (context for task sequencing)

Each phase is independently shippable and reversible, and the Feed must never be left broken between phases: instrument baseline → audio-unlock → recycling pool → instant-start stack → network-aware + bandwidth discipline → measure against targets → decide on MP4.

## Glossary

- **Clip_Engine**: The single shared engine in `showshak-shared.js` that drives both the inline Feed and the fullscreen viewer through the Media_Surface contract, without branching on surface type outside `ssCreateSurface`.
- **Inline_Feed**: The feed playback host mounted via `mountInline` (the `#feed` scroll-snap rail).
- **Fullscreen_Viewer**: The full-screen clip player host opened via `ssOpenClip`.
- **Media_Surface**: The `MediaSurfaceContract` interface (`mount`, `play`, `pause`, `setMuted`, `isMuted`, `getProgress`, `seek`, `onTimeupdate`, `onEnded`, `preload`, `destroy`) the Clip_Engine speaks to.
- **Video_Surface**: The Media_Surface implementation that wraps a `<mux-player>` element; selected by `ssCreateSurface` when a Clip has a `muxPlaybackId`.
- **Surface**: A live Media_Surface instance (Video_Surface or Gradient_Surface) bound to a clip slot.
- **Player_Pool**: The fixed-size set of mounted `<mux-player>`-backed Surfaces that the Clip_Engine recycles and re-points to clips as the Viewer scrolls, rather than destroying and recreating per clip.
- **Pool_Size**: The number of Surfaces kept mounted by the Player_Pool, governed by `SS_MAX_LIVE_PLAYERS` (currently 4).
- **Mounted_Band**: The contiguous set of clip indices around the active clip whose Surfaces are kept mounted, computed by `ssMountedPlayerSet`.
- **Active_Clip**: The clip currently occupying the viewport and playing.
- **Audio_Unlock**: The one-time enabling of unmuted audio playback, granted by the browser during the first user gesture, after which mounted Surfaces may play unmuted without re-triggering the autoplay policy.
- **Mute_Preference**: The persisted user intent for sound on or off, read via `ssGetMutePref`.
- **Surface_Muted_State**: The real muted state of a Surface's underlying media element, reported via `isMuted()` / `onMutedChange`.
- **Mute_Icon**: The on-screen control that reflects the Surface_Muted_State of the active clip.
- **Start_Rendition**: The initial HLS quality level chosen for the first frame before adaptive bitrate (ABR) climbs to higher quality.
- **Poster_Image**: The Mux image-CDN thumbnail painted on a clip slot before video frames render.
- **Warming**: Eagerly fetching a clip's HLS manifest and first segment before it becomes active.
- **Network_Tier**: A classification of the current connection derived from the Network Information API (`navigator.connection.effectiveType`).
- **Preload_Depth**: The number of off-screen clips ahead of the Active_Clip that the system warms.
- **Preconnect**: `dns-prefetch` and `preconnect` resource hints in the document `<head>` for Mux CDN and image domains.
- **First_Clip**: The first clip presented when the Viewer lands on a feed-bearing page.
- **Loading_Curtain**: The loading/onboarding screen shown before the feed is interactive.
- **Mux_Data**: Mux's QoE analytics that captures startup time and rebuffering as the objective scoreboard.
- **Time_To_First_Frame**: The elapsed time from a clip becoming active to its first rendered video frame.
- **Scroll_To_Play**: The elapsed time from a scroll gesture settling on a clip to that clip beginning playback.
- **Rebuffer_Ratio**: The fraction of playback time spent rebuffering, as reported by Mux_Data.

## Requirements

### Requirement 1: Persistent audio-unlock model

**User Story:** As a Viewer, I want sound to keep playing as I scroll between clips, so that the audio never cuts out mid-session.

#### Acceptance Criteria

1. WHEN the Viewer performs the first user gesture on a feed-bearing page, THE Clip_Engine SHALL perform Audio_Unlock once for the session.
2. WHILE Audio_Unlock has been granted, THE Clip_Engine SHALL keep every Surface in the Mounted_Band in an unmuted-but-paused state except the Active_Clip.
3. WHEN the Active_Clip changes due to a scroll, THE Clip_Engine SHALL pause the previously Active_Clip Surface and play the newly Active_Clip Surface without changing that Surface's muted state.
4. WHILE Audio_Unlock has been granted and the Mute_Preference is sound-on, THE Clip_Engine SHALL activate a newly Active_Clip without performing a muted-then-unmuted transition on that Surface.
5. THE Clip_Engine SHALL treat the persisted Mute_Preference as the Viewer's intent for sound on or off.
6. THE Mute_Icon SHALL reflect the Surface_Muted_State of the Active_Clip as reported by `isMuted()` and `onMutedChange`.
7. WHEN the underlying media element of the Active_Clip emits a muted-state change, THE Clip_Engine SHALL update the Mute_Icon to match the new Surface_Muted_State.
8. IF the browser forces muted playback for a Surface despite a sound-on Mute_Preference, THEN THE Clip_Engine SHALL keep that Surface playing and SHALL reflect the muted state in the Mute_Icon.

### Requirement 2: Player recycling pool

**User Story:** As a Viewer, I want scrolling back to a previous clip to be instant with no reload flash, so that the feed feels seamless in both directions.

#### Acceptance Criteria

1. THE Clip_Engine SHALL keep a Player_Pool of at most `SS_MAX_LIVE_PLAYERS` mounted Surfaces.
2. WHEN the Active_Clip changes, THE Clip_Engine SHALL recycle and re-point existing pooled Surfaces to the clips in the new Mounted_Band rather than destroying and recreating a Surface for every clip.
3. WHILE a clip index remains within the Mounted_Band across consecutive Active_Clip changes, THE Clip_Engine SHALL keep that clip's Surface mounted.
4. WHEN the Viewer scrolls back to a clip whose Surface is still in the Player_Pool, THE Clip_Engine SHALL resume that Surface without re-downloading its manifest.
5. THE Player_Pool SHALL preserve the Audio_Unlock state across recycling so that recycled Surfaces play unmuted without re-triggering the autoplay policy.
6. WHEN a clip leaves the Mounted_Band, THE Clip_Engine SHALL release its pooled Surface for reuse by a clip entering the Mounted_Band.
7. THE Player_Pool SHALL apply identically to the Inline_Feed and the Fullscreen_Viewer through the single Clip_Engine, without branching on surface type outside `ssCreateSurface`.
8. THE Mounted_Band membership for a given Active_Clip and loaded-clip count SHALL be computed by a pure helper exported for Node tests.

### Requirement 3: Instant first frame

**User Story:** As a Viewer, I want the very first frame of each clip to appear almost immediately, so that the feed never shows a black or blank frame.

#### Acceptance Criteria

1. WHEN a Video_Surface begins playback of a clip, THE Video_Surface SHALL request a low Start_Rendition so that the first frame renders quickly before ABR climbs.
2. WHEN a Surface mounts or is recycled onto a clip, THE Surface SHALL paint the clip's Poster_Image before video frames render so that the slot is never black.
3. WHEN the Viewer scrolls back to a clip served by a recycled Surface, THE Surface SHALL present the Poster_Image or rendered frame instantly without a black frame.
4. WHILE the Active_Clip is playing, THE Clip_Engine SHALL warm the next clip's manifest and first segment so that it can begin playback when it becomes active.
5. IF a clip has no Poster_Image, THEN THE Surface SHALL paint the clip's gradient background as the loading state.

### Requirement 4: Network-aware adaptation

**User Story:** As a Viewer on a slow connection, I want the player to adapt how much it preloads and how high it resolves, so that playback stays smooth instead of stalling.

#### Acceptance Criteria

1. THE Clip_Engine SHALL derive the current Network_Tier from `navigator.connection.effectiveType` when the Network Information API is available.
2. WHERE the Network_Tier indicates a slow connection, THE Clip_Engine SHALL reduce Preload_Depth to one clip ahead.
3. WHERE the Network_Tier indicates a slow connection, THE Clip_Engine SHALL cap the resolution at a lower ceiling.
4. WHERE the Network_Tier indicates a fast connection, THE Clip_Engine SHALL increase Preload_Depth above one clip ahead.
5. IF the Network Information API is unavailable, THEN THE Clip_Engine SHALL apply a default Network_Tier without error.
6. THE mapping from Network_Tier to Preload_Depth and resolution ceiling SHALL be a pure decision helper exported for Node tests.

### Requirement 5: Bandwidth discipline

**User Story:** As a Viewer, I want the clip I am watching to always get priority on the network, so that off-screen preloading never makes the current clip stutter.

#### Acceptance Criteria

1. THE Clip_Engine SHALL run at most one off-screen low-resolution prefetch at a time.
2. WHILE the Active_Clip is still buffering, THE Clip_Engine SHALL pause off-screen preloading.
3. WHEN the Active_Clip has buffered enough to play without rebuffering, THE Clip_Engine SHALL resume off-screen preloading within the current Preload_Depth.
4. THE Clip_Engine SHALL prioritize the Active_Clip's network requests over any off-screen preloading.
5. THE decision of whether to start, pause, or resume off-screen preloading SHALL be a pure decision helper exported for Node tests.

### Requirement 6: Preconnect to Mux domains

**User Story:** As a Viewer, I want DNS and TLS to Mux to be paid before the first clip loads, so that the first frame is not delayed by connection setup.

#### Acceptance Criteria

1. THE feed-bearing pages SHALL include `dns-prefetch` resource hints for the Mux CDN and Mux image domains in the document `<head>`.
2. THE feed-bearing pages SHALL include `preconnect` resource hints for the Mux CDN and Mux image domains in the document `<head>`.
3. THE Preconnect hints SHALL be present before the feed begins loading clip media.

### Requirement 7: First-clip priority

**User Story:** As a Viewer, I want the feed to already be playing the instant I land, so that the first impression is immediate.

#### Acceptance Criteria

1. WHILE the Loading_Curtain is displayed, THE Clip_Engine SHALL warm the First_Clip's manifest and first segment.
2. WHEN the Viewer lands on the feed after the Loading_Curtain, THE Clip_Engine SHALL begin playback of the First_Clip without waiting on a cold manifest fetch.
3. IF the First_Clip's identity is not yet known when the Loading_Curtain is displayed, THEN THE Clip_Engine SHALL warm the First_Clip as soon as its identity is resolved.

### Requirement 8: QoE instrumentation

**User Story:** As the team, I want objective playback-quality metrics captured, so that I can verify the player meets its performance targets.

#### Acceptance Criteria

1. THE feed-bearing pages SHALL enable Mux_Data QoE capture for clip playback.
2. THE Mux_Data capture SHALL include startup time and rebuffering metrics.
3. THE Mux_Data capture SHALL attribute playback metrics to individual clips so that per-clip QoE can be reviewed.
4. WHERE Mux_Data dashboard access requires confirmation, THE team SHALL confirm dashboard access before relying on it as the scoreboard.

### Requirement 9: Measurable performance targets

**User Story:** As the team, I want concrete, testable performance bounds, so that "A-grade smoothness" has an objective definition of done.

#### Acceptance Criteria

1. WHILE the Viewer is on wifi, THE Clip_Engine SHALL achieve a Time_To_First_Frame below 800 milliseconds as measured by Mux_Data.
2. WHILE the Viewer is on 4G, THE Clip_Engine SHALL achieve a Time_To_First_Frame below 1500 milliseconds as measured by Mux_Data.
3. WHEN a scroll gesture settles on a pre-warmed clip, THE Clip_Engine SHALL begin Scroll_To_Play of that clip within 150 milliseconds.
4. THE Clip_Engine SHALL keep the Rebuffer_Ratio below 1 percent as measured by Mux_Data.
5. WHEN the Active_Clip changes due to a scroll, THE Clip_Engine SHALL keep audio continuous so that sound does not drop during the transition.
6. WHEN the Viewer scrolls back to a previously viewed clip, THE Clip_Engine SHALL present that clip instantly with no re-download flash.

### Requirement 10: Single-engine and no-regression constraints

**User Story:** As a developer, I want all performance work to live in the shared engine and pure helpers, so that the Feed and viewer stay consistent and existing behavior never regresses.

#### Acceptance Criteria

1. THE Clip_Engine SHALL drive both the Inline_Feed and the Fullscreen_Viewer without branching on surface type outside `ssCreateSurface`.
2. THE pure decision logic for pool membership, preload and window math, Network_Tier mapping, and audio-resolution rules SHALL reside in `showshak-shared.js` and SHALL be exported via `module.exports` for Node tests.
3. THE pure decision helpers SHALL be covered by fast-check property tests running at least 100 iterations, with one property per test file, each tagged with its feature and property identifier.
4. THE Surfaces driven by the Clip_Engine SHALL satisfy the existing Media_Surface contract.
5. THE changes SHALL preserve existing Inline_Feed behavior so that the Feed is never left in a broken state across the phased rollout.
6. WHERE a change is introduced in a phase, THE change SHALL be independently shippable and reversible.
