# Requirements Document

## Introduction

ShowShak currently maintains two independent clip players: the Feed's bespoke
inline player in `showshak-feed.html` (`buildFeed`, `syncRail`, `toggleLit`,
`toggleMute`, `startProgress`/`stopProgress`, `positionRail`, scroll observer,
fire-burst, per-clip progress bars, mobile rail, the mute-first "Tap for sound"
badge, and the "YOU'VE SEEN IT ALL" end card) and the universal fullscreen
viewer in `showshak-shared.js` (`ssOpenClip`, `ssCloseClip`, `_ssvClipHTML`,
`_ssvBuildList`, `_ssvToggleFire`, `_ssvAttachDoubleTap`, `_ssvAttachSwipe`,
`_ssvSetupObserver`, the shared Watch It sheet, Save/Stacks, Following, and the
DB helpers `_ssDbFire`/`_ssDbFollow`). Fire, Save, and Watch It each have two
implementations, producing duplicated database wiring and a risk of behavioral
drift between the two surfaces.

This feature consolidates both surfaces onto a single shared clip engine in
`showshak-shared.js`. The shared engine powers both the inline Feed frames and
the fullscreen viewer across Feed, Discover, Watchlist, and Profile. Fire, Save,
Watch It, sound, and progress are each defined exactly once. The Feed's existing
vertical-scroll inline-playing layout is preserved, the bespoke Feed player
functions are retired, the engine abstracts the media surface so CSS-gradient
placeholder clips work now and Mux `<video>` elements slot in later, and all
existing product rules, interactions, and database wiring continue to work.

## Glossary

- **Clip_Engine**: The single shared clip player implementation in
  `showshak-shared.js` that renders, plays, and handles interactions for both
  inline Feed frames and the fullscreen viewer.
- **Inline_Feed**: The Feed surface in `showshak-feed.html` that renders clip
  frames in a vertical scroll layout and plays the active clip in place.
- **Fullscreen_Viewer**: The immersive fullscreen clip surface opened via
  `ssOpenClip`, available on Feed, Discover, Watchlist, and Profile.
- **Media_Surface**: The abstraction representing a single clip's visual/audio
  medium; today a CSS-gradient placeholder, later a Mux `<video>` element.
- **Browse_Layer**: The Inline_Feed scrolling experience users browse before
  opening a clip fullscreen.
- **Immersion_Layer**: The Fullscreen_Viewer experience entered by tapping a
  clip in the Browse_Layer.
- **Mute_Preference**: The user's persisted sound on/off state, stored in
  `localStorage`.
- **Watch_It_Sheet**: The shared platform-reveal sheet that is the only surface
  exposing where a show can be watched.
- **Guest_Gate**: The existing behavior that prompts an unauthenticated user to
  sign up before completing Fire, Save, or Follow actions.
- **Progress_Bar**: The per-clip visual indicator of playback position.
- **Recommendation_Seam**: A defined integration point allowing a recommendation
  feed to replace the current `_ssvBuildList` ordering later without further
  engine changes.

## Requirements

### Requirement 1: Single shared clip engine

**User Story:** As a developer, I want one shared clip engine powering both the
inline Feed and the fullscreen viewer, so that playback and interaction behavior
is defined once and cannot drift between surfaces.

#### Acceptance Criteria

1. THE Clip_Engine SHALL render and control clip playback for the Inline_Feed.
2. THE Clip_Engine SHALL render and control clip playback for the Fullscreen_Viewer on the Feed, Discover, Watchlist, and Profile pages.
3. THE Clip_Engine SHALL define the Fire action exactly once.
4. THE Clip_Engine SHALL define the Save action exactly once.
5. THE Clip_Engine SHALL define the Watch It action exactly once.
6. THE Clip_Engine SHALL define sound control exactly once.
7. THE Clip_Engine SHALL define playback progress tracking exactly once.

### Requirement 2: Progress bar everywhere

**User Story:** As a viewer, I want a progress bar on every clip on every
surface, so that I always see playback position.

#### Acceptance Criteria

1. WHILE a clip is playing in the Inline_Feed, THE Clip_Engine SHALL display a Progress_Bar for that clip.
2. WHILE a clip is playing in the Fullscreen_Viewer, THE Clip_Engine SHALL display a Progress_Bar for that clip.
3. WHILE a clip is playing, THE Clip_Engine SHALL advance the Progress_Bar in proportion to elapsed playback position.

### Requirement 3: Tap gesture model

**User Story:** As a viewer, I want consistent tap gestures across surfaces, so
that interaction feels the same everywhere.

#### Acceptance Criteria

1. WHEN a single tap occurs on a playing clip, THE Clip_Engine SHALL pause that clip.
2. WHEN a single tap occurs on a paused clip, THE Clip_Engine SHALL resume that clip.
3. WHEN a double tap occurs on a clip, THE Clip_Engine SHALL register a Fire on that clip.
4. WHEN a double tap registers a Fire, THE Clip_Engine SHALL display a fire-burst animation at the tap location.
5. THE Clip_Engine SHALL apply the single-tap and double-tap behaviors identically in the Inline_Feed and the Fullscreen_Viewer.

### Requirement 4: Sound model

**User Story:** As a viewer, I want sound to behave predictably based on how I
entered a clip, so that immersive playback has audio while passive browsing does
not surprise me.

#### Acceptance Criteria

1. WHEN the Fullscreen_Viewer opens via a tap gesture, THE Clip_Engine SHALL play the clip with sound from the first frame.
2. WHEN the Inline_Feed loads and plays its first clip, THE Clip_Engine SHALL play that clip muted until the first user interaction.
3. WHEN the first user interaction occurs in the Inline_Feed, THE Clip_Engine SHALL unmute subsequent clip playback.
4. WHERE the platform exposes the device hardware silent switch state, THE Clip_Engine SHALL respect that state.
5. THE Clip_Engine SHALL play clips without presenting a "tap for sound" prompt.

### Requirement 5: Mute preference persistence

**User Story:** As a viewer, I want my sound preference to follow me, so that I
do not have to reset it repeatedly.

#### Acceptance Criteria

1. WHEN the user changes the Mute_Preference, THE Clip_Engine SHALL persist the Mute_Preference to localStorage.
2. WHEN playback advances from one clip to another, THE Clip_Engine SHALL apply the persisted Mute_Preference.
3. WHEN the user transitions from the Inline_Feed to the Fullscreen_Viewer, THE Clip_Engine SHALL apply the persisted Mute_Preference.
4. WHEN a page loads, THE Clip_Engine SHALL initialize sound state from the persisted Mute_Preference.

### Requirement 6: Remove end-of-feed card

**User Story:** As a viewer, I want the feed to end without an interruption card,
so that browsing feels continuous.

#### Acceptance Criteria

1. THE Inline_Feed SHALL render clip frames without the "YOU'VE SEEN IT ALL" end-of-feed card.
2. THE Inline_Feed SHALL omit the `feed-end-title` element and its associated end-card markup.

### Requirement 7: Browse layer to immersion layer transition

**User Story:** As a viewer, I want tapping a clip in the feed to open it
fullscreen and let me keep scrolling, so that browsing and immersion feel like
one continuous experience.

#### Acceptance Criteria

1. THE Inline_Feed SHALL retain the existing vertical-scroll inline-playing layout.
2. WHEN a clip in the Inline_Feed is tapped, THE Clip_Engine SHALL open the Fullscreen_Viewer and begin playback.
3. WHEN the Fullscreen_Viewer opens from a tapped clip, THE Clip_Engine SHALL start playback at the tapped clip.
4. WHILE the Fullscreen_Viewer is open, THE Clip_Engine SHALL allow vertical scrolling through the clips produced by `_ssvBuildList`.
5. THE Clip_Engine SHALL expose a Recommendation_Seam that allows the `_ssvBuildList` ordering to be replaced by a recommendation feed without changing engine code.

### Requirement 8: Full consolidation of the Feed player

**User Story:** As a developer, I want the Feed's bespoke player retired and
rebuilt on the shared engine, so that no duplicate player code remains.

#### Acceptance Criteria

1. THE Inline_Feed SHALL drive clip rendering and playback through the Clip_Engine.
2. THE Inline_Feed SHALL NOT retain the bespoke functions `buildFeed`, `syncRail`, `toggleLit`, `toggleMute`, `startProgress`, `stopProgress`, and `positionRail` as independent player implementations.
3. THE Clip_Engine SHALL provide the playback, sound, fire, and progress behavior previously provided by the retired Inline_Feed functions.

### Requirement 9: Media surface abstraction

**User Story:** As a developer, I want the engine decoupled from the rendering
medium, so that placeholder clips work now and real video slots in later.

#### Acceptance Criteria

1. THE Clip_Engine SHALL play clips rendered as CSS-gradient placeholder Media_Surfaces.
2. THE Clip_Engine SHALL interact with the Media_Surface through an abstraction rather than logic hardcoded to CSS gradients.
3. WHERE a clip provides a Mux `<video>` Media_Surface, THE Clip_Engine SHALL control playback through the same Media_Surface abstraction.

### Requirement 10: Preservation of product rules

**User Story:** As a product owner, I want all existing product rules preserved
through the single engine, so that consolidation does not change the product.

#### Acceptance Criteria

1. THE Clip_Engine SHALL render clips without displaying the show title on the clip.
2. THE Clip_Engine SHALL render the Fire control as an SVG flame.
3. THE Clip_Engine SHALL expose platform availability only through the Watch_It_Sheet.
4. THE Clip_Engine SHALL render clips without view counts and without follower counts.
5. WHEN a guest initiates a Fire, Save, or Follow action, THE Clip_Engine SHALL apply the Guest_Gate behavior.
6. WHEN a Fire action is completed, THE Clip_Engine SHALL persist the Fire through the existing database wiring `_ssDbFire`.
7. WHEN a Follow action is completed, THE Clip_Engine SHALL persist the Follow through the existing database wiring `_ssDbFollow`.
8. WHEN a Save action is completed, THE Clip_Engine SHALL persist the Save through the existing database wiring.

### Requirement 11: Regression safety

**User Story:** As a viewer, I want the Feed's existing interactions to keep
working after consolidation, so that nothing I rely on breaks.

#### Acceptance Criteria

1. WHEN keyboard navigation input is received in the Inline_Feed, THE Clip_Engine SHALL navigate between clips.
2. THE Inline_Feed SHALL retain scroll-snap behavior between clips.
3. WHILE viewing on a mobile viewport, THE Clip_Engine SHALL render the mobile action rail.
4. WHILE viewing on a desktop viewport, THE Clip_Engine SHALL position the desktop action rail relative to the active clip column.
5. WHEN a Fire is registered in the Inline_Feed, THE Clip_Engine SHALL play the fire-burst animation.
6. WHEN the Watch It control is activated in the Inline_Feed, THE Clip_Engine SHALL open the Watch_It_Sheet.
