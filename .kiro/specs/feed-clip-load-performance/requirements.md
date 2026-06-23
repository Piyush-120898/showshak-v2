# Requirements Document

## Introduction

The ShowShak feed is the product: a vertical short-clip streaming-discovery feed
where curators post ≤90s clips, viewers swipe, and tap **Watch It** to learn the
title and where it streams. For that feed to feel "A-grade" (TikTok/Instagram-feel),
clip-load latency must feel instant — the next clip is already there the moment a
viewer swipes, scroll-back never re-downloads, and the cold open never clears the
splash onto a buffering clip. Today it does not reach that bar: the "warm" step
fetches only the tiny `.m3u8` manifest (and as an opaque `no-cors` response that is
generally not reused), so a swipe starts the next clip's bytes cold; all mounted
players use `preload="auto"` and contend with the active clip on a constrained
mobile link; there is no persistent segment cache, so scroll-back re-downloads; and
the first-ever cold open blocks on the Supabase (Mumbai) query.

This feature establishes a clip-load and caching pipeline built on one principle:
**the active clip always wins the pipe, and everything else is prefetched only with
spare, bounded bandwidth.** It introduces a preload priority ladder (active full,
next 1–2 first-segment, rest none), progressive deepening that uses the spare pipe
once the active clip is satisfied (bounded by network tier, a per-session prefetch
byte budget, and a dwell signal), a service-worker-owned range-aware (HTTP 206)
byte-bounded LRU segment cache that both the hls.js and iOS native-HLS paths reuse,
a cold-start splash lane that turns the brand beat into productive buffering with a
readiness-gated lift, a delivered-resolution cap, an expanded rolling metadata
window, and instrumentation plus a budget circuit breaker so a bug cannot burn the
free Mux delivery budget. Every magnitude (prefetch depth, byte budget, LRU window
and ceiling, resolution cap, splash floor and ceiling) is a tunable constant.

Two cross-cutting rules govern every requirement. First, **graceful degradation from
day one**: the pipeline must feel great with as few as one curator, a handful of
clips, and a few users; nothing may assume a large catalog or many users; all
windows and prefetch clamp to whatever clips exist, and the core win (active clip
instant-start plus next-1 ready) must hold with as few as two clips. Second,
**fail-soft everywhere**: a cache miss, quota-exceeded, range-not-honored, slow or
unknown network, player-upgrade race, or Mux/CDN error must degrade to "fetch from
network / today's behaviour" — never a thrown error, never a black or dead clip,
never a stuck splash.

This feature **depends on** the existing engine in `showshak-shared.js` (Clip_Engine,
player pool, surfaces, warming, feed metadata cache) and `sw.js`. The locked player
decisions are preserved and **out of scope to relitigate**: keep `<mux-player>` (no
player swap, no raw-hls.js rewrite, no MP4, no CDN swap), keep a bounded live-player
pool (~4 mounted), and keep no unbounded memory cache. Refreshing or replacing the
player and changing Mux encoding settings are out of scope.

## Glossary

- **Feed**: The vertical short-clip discovery surface rendered by
  `showshak-feed.html`, driven by the pure core in `showshak-shared.js`.
- **Clip**: One curator's short (≤90s) vertical video, identified by a Mux
  `playback_id`, plus its metadata (caption, poster URL, linked title).
- **Active_Clip**: The Clip currently visible and playing in the Feed. The
  Active_Clip always has the highest buffering priority and wins the network pipe.
- **Clip_Index**: The integer position of a Clip in the ordered Feed; the
  Active_Clip's index is the reference point for all distance-based decisions.
- **Player_Pool**: The bounded set of mounted `<mux-player>` elements (~4) kept in
  an LRU band around the Active_Clip, re-pointed by swapping `playback-id` rather
  than destroyed and recreated.
- **Player_Pool_Size**: The tunable maximum number of mounted players in the
  Player_Pool (default ~4).
- **Preload_Tier**: The per-position buffering policy assigned to a Clip relative to
  the Active_Clip, expressed as a `<mux-player>` `preload` value of `none`,
  `metadata`, or `auto`.
- **Prefetch_Ladder**: The pure mapping from a Clip's distance-from-active and the
  current Network_Tier to a Preload_Tier (active → full/`auto`; next 1–2 →
  first-segment; all others → `none`).
- **Prefetch_Depth**: The tunable number of clips ahead of the Active_Clip eligible
  for prefetch at a given Network_Tier.
- **First_Segment**: The HLS initialization segment plus the first media segment of
  a Clip — the minimum bytes required to render the Clip's first frame.
- **Progressive_Deepening**: The behavior of using spare bandwidth, after the
  Active_Clip's buffer is satisfied, to deepen prefetch of upcoming clips (next-1
  fully, next-2..4 first-segment), bounded by Network_Tier, Session_Byte_Budget, and
  Dwell_Signal.
- **Dwell_Signal**: A measurable signal that the viewer has watched enough of the
  Active_Clip to suggest they will continue, used to gate aggressive
  Progressive_Deepening.
- **Dwell_Threshold**: The tunable minimum Dwell_Signal value (default 0.5 on a
  0.0–1.0 scale) at or above which aggressive Progressive_Deepening is permitted.
- **Buffer_Satisfied_Threshold**: The tunable buffered-ahead duration of the
  Active_Clip (default 5 s) at or above which its buffer is considered "satisfied",
  allowing spare bandwidth to be spent on Progressive_Deepening.
- **Network_Tier**: The classification of the connection derived from
  `navigator.connection.effectiveType` into `slow`, `medium`, or `fast`, each mapping
  to a Prefetch_Depth and a Resolution_Cap. Unknown connections classify as `medium`.
- **Session_Byte_Budget**: The tunable per-session ceiling, in bytes, on total
  prefetch (non-active) downloads. The Active_Clip's own playback is never charged
  against this budget.
- **Circuit_Breaker**: The mechanism that, when the Session_Byte_Budget is exceeded,
  falls back to active-only buffering for the remainder of the session.
- **Segment_Cache**: The service-worker-owned persistent store (Cache Storage /
  IndexedDB) of HLS init and media segments, range-request aware (HTTP 206), keyed by
  `playback_id` plus segment URI.
- **Segment_Cache_Window**: The set of clips whose segments the Segment_Cache retains
  — N clips behind plus N clips ahead of the Active_Clip (e.g. ~5 + 5), clamped to
  the clips that exist.
- **Segment_Cache_Ceiling**: The tunable maximum total bytes the Segment_Cache may
  hold (e.g. ~150–250 MB). Eviction is by total bytes (LRU), not by clip count.
- **Cold_Start_Lane**: The launch-time path that, during the brand splash, prefetches
  clip-1's First_Segment so clip-1 can play before the splash lifts.
- **Splash_Floor**: The tunable minimum duration the brand splash is shown (the brand
  beat).
- **Splash_Ceiling**: The tunable hard maximum duration the brand splash may be shown,
  after which it lifts regardless of clip readiness so it can never be sticky.
- **Splash_Lift_Decision**: The pure decision of whether to lift the splash given
  `{Splash_Floor elapsed, clip-1 ready, Splash_Ceiling reached}`.
- **Resolution_Cap**: The tunable maximum delivered rendition for vertical phone
  clips (e.g. 720p; 480p on the slow Network_Tier), applied via the existing per-tier
  `setMaxResolution`.
- **Metadata_Cache**: The per-user stale-while-revalidate clip-metadata cache in
  localStorage (ids, captions, poster URL, `playback_id`), holding metadata only —
  never video bytes.
- **Metadata_Window**: The tunable number of clips retained in the Metadata_Cache
  (growing from ~10 to ~30).
- **QoE_Instrumentation**: The Mux Data quality-of-experience reporting (time to
  first frame, rebuffer ratio), segmented by Network_Tier.
- **TTFF**: Time To First Frame — the elapsed time from a swipe (or cold open) to the
  first rendered frame of the target Clip.
- **Rebuffer_Ratio**: Stall time divided by watch time for a Clip.

## Requirements

### Requirement 1: Preload priority ladder (active always wins)

**User Story:** As a viewer, I want the clip I am watching to never stall because the
app is busy loading other clips, so that playback stays smooth on a mobile link.

#### Acceptance Criteria

1. THE Prefetch_Ladder SHALL assign exactly one Clip — the Active_Clip — a
   Preload_Tier of `auto`, and SHALL give the Active_Clip the highest buffering
   priority on the network pipe.
2. WHEN the Active_Clip and Network_Tier are known, THE Prefetch_Ladder SHALL assign
   every Clip at distance 1..Prefetch_Depth ahead of the Active_Clip a Preload_Tier
   of `metadata` (prefetching at most its First_Segment).
3. THE Prefetch_Ladder SHALL assign a Preload_Tier of `none` to every Clip whose
   distance ahead of the Active_Clip exceeds the Network_Tier's Prefetch_Depth and to
   every Clip positioned behind the Active_Clip.
4. WHILE the Active_Clip's buffer is not yet satisfied, THE Prefetch_Ladder SHALL NOT
   assign any non-active Clip a Preload_Tier of `auto`.
5. WHERE the Network_Tier is `slow`, THE Prefetch_Depth SHALL be 1; WHERE the
   Network_Tier is `medium` or `fast`, THE Prefetch_Depth SHALL be 2 (each a tunable
   default), so that fewer upcoming clips are prefetched on `slow` than on `fast`.
6. THE Prefetch_Ladder SHALL be a total, deterministic, side-effect-free pure
   function mapping `{distance-from-active, Network_Tier}` to exactly one Preload_Tier
   in `{none, metadata, auto}`, returning identical output for identical inputs.

### Requirement 2: Progressive deepening with spare bandwidth

**User Story:** As a viewer, I want the next few clips to be ready by the time I swipe
to them, so that swiping feels instant without my current clip ever stalling.

#### Acceptance Criteria

1. WHILE the Active_Clip's buffered-ahead duration is at least the
   Buffer_Satisfied_Threshold (default 5 s), THE System SHALL allow
   Progressive_Deepening to use spare bandwidth (bandwidth beyond that needed to hold
   the threshold) to deepen prefetch of upcoming clips.
2. WHEN Progressive_Deepening is active, THE System SHALL deepen the Clip at distance
   +1 toward a full buffer (all downloadable segments) before deepening any Clip at
   distance +2 through +4 beyond its First_Segment.
3. THE Progressive_Deepening decision SHALL deepen a given upcoming Clip (distance
   1..4) only WHEN the Network_Tier permits that distance, the Session_Byte_Budget
   remaining exceeds the next segment's size, AND the Dwell_Signal is at least the
   Dwell_Threshold (default 0.5 on a 0.0–1.0 scale).
4. IF deepening an upcoming Clip would consume bandwidth the Active_Clip needs to
   hold its buffer, THEN THE System SHALL prioritize the Active_Clip and defer (not
   discard) the deepening, resuming it when spare bandwidth returns.
5. THE Progressive_Deepening decision SHALL be a total, deterministic, side-effect-free
   pure function of `{Active_Clip buffer satisfied, distance-from-active,
   Network_Tier, Session_Byte_Budget remaining, Dwell_Signal}`.

### Requirement 3: Session prefetch byte budget and circuit breaker

**User Story:** As the founder, I want a hard ceiling on prefetch bytes per session, so
that a bug cannot burn the free Mux delivery budget.

#### Acceptance Criteria

1. THE System SHALL maintain a single per-session running total of bytes prefetched
   for non-active clips, incrementing it as each prefetch download (full or partial)
   completes.
2. THE System SHALL NOT charge the Active_Clip's own playback bytes against the
   Session_Byte_Budget, including across clip transitions (bytes prefetched for a clip
   that later becomes active are neither retroactively credited nor re-charged).
3. IF the cumulative prefetch total reaches or exceeds the Session_Byte_Budget, THEN
   THE Circuit_Breaker SHALL engage and fall back to active-only buffering
   (Preload_Tier `none` for all non-active clips, no Progressive_Deepening) for the
   remainder of the session.
4. WHILE the Circuit_Breaker is engaged, THE System SHALL continue to play the
   Active_Clip by fetching from the network.
5. WHEN a new session begins (a Feed load at app launch), THE System SHALL reset the
   prefetch total to zero and disengage the Circuit_Breaker.
6. THE Circuit_Breaker SHALL remain engaged until a new session begins and SHALL NOT
   auto-reset within a session.
7. THE Session_Byte_Budget SHALL be a tunable constant (a whole number of bytes
   greater than zero).

### Requirement 4: Service-worker segment cache (range-aware, byte-bounded LRU)

**User Story:** As a viewer, I want a clip I recently saw to play instantly when I
scroll back, so that revisiting clips never re-downloads video.

#### Acceptance Criteria

1. WHEN a Mux segment request is served by the Segment_Cache and the segment is
   present, THE Segment_Cache SHALL return it from cache without a network request.
2. WHEN a Mux segment request misses the Segment_Cache, THE Segment_Cache SHALL fetch
   the segment from the network, store it, and return it.
3. WHEN a request carries an HTTP Range header and the requested range is satisfiable
   from the stored bytes, THE Segment_Cache SHALL return an HTTP 206 partial response;
   an unsatisfiable range SHALL fall through to the network (see Requirement 10).
4. THE Segment_Cache SHALL key each stored segment by its `playback_id` and segment
   URI, and SHALL serve BOTH the hls.js path and the iOS native-HLS path through the
   same store.
5. THE Segment_Cache_Window (default 5 behind + 5 ahead, each side tunable 1..20)
   SHALL define eviction eligibility: segments for clips outside the window are
   evicted before in-window segments.
6. WHEN the total bytes stored exceed the Segment_Cache_Ceiling (default 200 MB,
   tunable 50–500 MB), THE Segment_Cache SHALL evict least-recently-used segments by
   total bytes until the stored bytes are within the Segment_Cache_Ceiling.
7. WHEN a First_Segment prefetched by the Cold_Start_Lane or Prefetch_Ladder
   (matching `playback_id` + segment URI) is later requested by a player, THE
   Segment_Cache SHALL serve the stored bytes and issue no additional network request.
8. THE Segment_Cache eviction-by-bytes decision SHALL be a pure function of
   `{stored segments with sizes and last-use order, Segment_Cache_Ceiling,
   Segment_Cache_Window relative to the Active_Clip}`.
9. THE Segment_Cache_Window and Segment_Cache_Ceiling SHALL each be tunable constants.

### Requirement 5: Cold-start splash lane with readiness-gated lift

**User Story:** As a viewer opening the app, I want the splash to clear onto a clip
that actually plays, so that the first thing I see is video, not buffering.

#### Acceptance Criteria

1. WHERE the Metadata_Cache holds a clip-1 entry for a returning user, THE
   Cold_Start_Lane SHALL read clip-1's `playback_id` and poster via a synchronous
   Metadata_Cache read and SHALL begin prefetching clip-1's First_Segment within
   100 ms of launch.
2. WHERE no Metadata_Cache entry exists for a first-ever user, THE Cold_Start_Lane
   SHALL begin prefetching clip-1's First_Segment within 100 ms of the clip-metadata
   query returning.
3. WHEN the Splash_Floor has elapsed AND clip-1 is ready, THE Splash_Lift_Decision
   SHALL lift the splash, where "clip-1 is ready" means clip-1 can play — its
   First_Segment is buffered such that the first frame renders without an immediate
   stall (can-play).
4. WHEN the Splash_Ceiling is reached, THE Splash_Lift_Decision SHALL lift the splash
   regardless of whether clip-1 is ready, and the Splash_Ceiling SHALL take precedence
   over all other inputs so the splash can never remain shown past the Splash_Ceiling.
5. THE Splash_Lift_Decision SHALL be a total, deterministic, side-effect-free pure
   function of the booleans `{Splash_Floor elapsed, clip-1 ready, Splash_Ceiling
   reached}` that returns lift when `Splash_Ceiling reached` OR (`Splash_Floor
   elapsed` AND `clip-1 ready`), returns hold otherwise, is defined for every input
   combination, and never blocks.
6. IF the clip-metadata query fails or clip-1's First_Segment cannot be prefetched,
   THEN THE Cold_Start_Lane SHALL keep `clip-1 ready` false and THE Splash_Lift_Decision
   SHALL lift the splash when the Splash_Ceiling is reached.
7. THE Splash_Floor and Splash_Ceiling SHALL each be tunable constants in
   milliseconds, with Splash_Ceiling greater than or equal to Splash_Floor.

### Requirement 6: Delivered resolution cap

**User Story:** As a viewer on an Indian mobile network, I want clips to start fast and
rarely rebuffer, so that the feed feels smooth without wasting my data.

#### Acceptance Criteria

1. WHEN a Clip is assigned to a `<mux-player>` for playback or prefetch, THE System
   SHALL cap its delivered rendition at the Resolution_Cap for the current
   Network_Tier via the existing per-tier `setMaxResolution`.
2. WHERE the Network_Tier is `slow`, THE Resolution_Cap SHALL be 480p.
3. WHERE the Network_Tier is `medium` or `fast`, THE Resolution_Cap SHALL be 720p.
4. IF the Network_Tier cannot be determined, THEN THE System SHALL apply the `medium`
   Resolution_Cap (720p).
5. THE Resolution_Cap SHALL be a tunable constant per Network_Tier, with the per-tier
   values non-decreasing from `slow` to `medium` to `fast`.

### Requirement 7: Expanded metadata window

**User Story:** As a viewer, I want to scroll back through recently-seen clips without
waiting, so that revisiting the feed feels instant on the data side.

#### Acceptance Criteria

1. THE Metadata_Cache SHALL retain up to Metadata_Window clips, with Metadata_Window
   set to ~30.
2. WHEN a viewer scrolls back to a Clip within the Metadata_Window, THE System SHALL
   render that Clip's metadata from the Metadata_Cache without a database round-trip.
3. THE Metadata_Cache SHALL store clip metadata only and SHALL NOT store video bytes.
4. THE Metadata_Window SHALL be a tunable constant.

### Requirement 8: Instrumentation and quality measurement

**User Story:** As the founder, I want to measure clip-load quality by network tier, so
that I can verify the pipeline meets its targets and dial the tunables.

#### Acceptance Criteria

1. THE QoE_Instrumentation SHALL report TTFF and Rebuffer_Ratio segmented by
   Network_Tier.
2. THE System SHALL label each reported view with its clip identifier and title so
   that quality can be attributed per Clip.
3. THE System SHALL record prefetch bytes consumed against the Session_Byte_Budget so
   that consumption can be observed.

### Requirement 9: Graceful degradation at minimal scale

**User Story:** As an early viewer with only a few clips available, I want the feed to
feel just as instant, so that the experience does not depend on a large catalog.

#### Acceptance Criteria

1. THE Prefetch_Ladder, Segment_Cache_Window, and Metadata_Window SHALL each clamp to
   the number of clips that actually exist.
2. WHERE only two clips exist, THE System SHALL still start the Active_Clip instantly
   and make the next Clip ready.
3. WHERE only one clip exists, THE System SHALL play the Active_Clip and SHALL NOT
   attempt to prefetch a non-existent next Clip.
4. THE System SHALL NOT require a minimum catalog size or user count for the
   clip-load pipeline to function.

### Requirement 10: Fail-soft fallback on every error path

**User Story:** As a viewer, I want a clip to always either play or move on, so that I
never see a black clip, an error, or a stuck splash.

#### Acceptance Criteria

1. IF a Segment_Cache lookup misses, THEN THE System SHALL fetch the segment from the
   network without raising an error.
2. IF storing a segment fails because storage quota is exceeded, THEN THE System SHALL
   continue playback from the network and SHALL evict or skip caching rather than
   raising an error.
3. IF the Segment_Cache cannot honor a Range request for an asset, THEN THE System
   SHALL bypass the Segment_Cache for that asset and fetch it from the network.
4. IF the Network_Tier cannot be determined, THEN THE System SHALL classify the
   connection as `medium`.
5. IF a Clip encounters a Mux or CDN error, THEN THE System SHALL keep the poster
   visible and advance the Feed rather than displaying a black or dead clip.
6. IF the player upgrade races with playback start, THEN THE System SHALL paint the
   poster first and re-assert playback when the player can play.
7. IF any prefetch or caching step fails, THEN THE System SHALL degrade to the
   network-fetch behaviour without interrupting the Active_Clip.

### Requirement 11: Tunable configuration

**User Story:** As the founder, I want every prefetch and cache magnitude to be a
config constant, so that I can dial generosity up or down without a rewrite.

#### Acceptance Criteria

1. THE System SHALL expose Prefetch_Depth, Session_Byte_Budget, Segment_Cache_Window,
   Segment_Cache_Ceiling, Resolution_Cap, Splash_Floor, Splash_Ceiling,
   Metadata_Window, Buffer_Satisfied_Threshold, and Dwell_Threshold as named tunable
   constants.
2. WHEN a tunable constant is changed, THE System SHALL apply the new value without
   requiring changes to the pipeline's control logic.
3. THE pure decision functions (Prefetch_Ladder, Progressive_Deepening,
   Splash_Lift_Decision, and Segment_Cache eviction) SHALL accept the relevant tunable
   constants as inputs rather than hard-coding their magnitudes.

### Requirement 12: Sacred product rules and locked decisions preserved

**User Story:** As the founder, I want the clip-load work to preserve ShowShak's
product rules and locked technical decisions, so that performance never costs us the
product's identity.

#### Acceptance Criteria

1. THE System SHALL keep a Clip's title hidden until the viewer taps Watch It.
2. THE System SHALL NOT expose engagement scoreboards (fires-received totals or
   Watch-It tap counts) on any public surface as part of the clip-load pipeline.
3. THE System SHALL keep only the Active_Clip audible.
4. THE System SHALL continue to use `<mux-player>` and SHALL NOT swap the player,
   rewrite to raw hls.js, switch to MP4, or change the CDN.
5. THE System SHALL keep the Player_Pool bounded to at most Player_Pool_Size mounted
   players.
6. THE System SHALL NOT introduce an unbounded in-memory video cache.
