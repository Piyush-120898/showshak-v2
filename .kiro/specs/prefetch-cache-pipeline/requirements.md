# Requirements Document

## Introduction

ShowShak is a vanilla HTML/CSS/JS PWA (no build step, no framework, no bundler) with
separate HTML pages — Feed, Discover, Watchlist, Profile — backed by Supabase, Mux
(HLS via `<mux-player>`), and TMDB. Today the data layer is already A-grade (no
`SELECT *`, no N+1, proper partial/creator/title indexes, server-side pooling), so
this feature is **not** about database query optimization. The visible pain is on the
client: navigating to Discover or Watchlist paints black gradient frames first, then
data and poster images trickle in after the page mounts, because each page loads its
clip list and posters only after it boots. Profile already feels instant because the
Feed prewarms it during idle (`ssPrewarmProfile`); Discover and Watchlist have a
page-data cache (`ssReadPageCache` / `ssWritePageCache`) but nothing prewarms their
DATA or POSTERS ahead of navigation.

This feature establishes a **prefetch + cache pipeline** built to current (2026)
industry standards so that navigating between pages — and advancing between clips —
feels instant. The core principle mirrors the existing Feed look-ahead discipline:
warm the next thing during idle, paint instantly from cache, then revalidate; and let
nothing prefetched ever starve or destabilize what the user is actively looking at.

The work is **phased so it can ship safely and incrementally**:

- **Phase 1** — Prewarm Discover and Watchlist page DATA and the first posters from
  the Feed during idle, so those tabs paint instantly (the founder's main visible
  pain). Shippable on its own.
- **Phase 2** — A generic cross-page prewarm helper plus storage tiering: move
  structured page data off synchronous `localStorage` into IndexedDB, keep
  URL-addressable resources (posters) in the Service_Worker Cache_Storage with
  stale-while-revalidate, and keep `localStorage` only for tiny flags.
- **Phase 3** — Clip HLS segment-byte prefetch within the existing player cap, the
  opt-in Service_Worker Segment_Cache turned on and device-verified with a bounded
  back-buffer, and an Android-only progressive enhancement (Speculation Rules) plus
  cross-document View_Transitions, with iOS falling back to manual prewarm.

Several decisions are **locked and out of scope to relitigate**: keep `<mux-player>`
(no player swap, no raw-hls.js rewrite, no MP4, no CDN swap); keep ONE player-level
behaviour for iOS and Android; keep the recycled player pool; and keep v39's
`SS_MAX_LIVE_PLAYERS = 2` concurrent-player cap (raised from 4 to fix an iOS
native-HLS decoder-contention stall). Clip prefetch may warm bytes/segments only and
MUST NOT mount additional players. The Feed must never break: every part of this
feature is behind a kill switch and degrades to today's behaviour on any error,
mirroring the existing `ss_ff_ranker` / `ss_ff_segcache` flag pattern. Any prefetched
or cached data must carry public signals only — never private engagement totals
("the scoreboard"). The implementation stays vanilla JS with the hand-rolled Service_Worker
(no Workbox, no bundler), and any new pure logic is dual-exported for Node and covered
by fast-check property tests, consistent with the codebase.

Two cross-cutting rules govern every requirement. First, **graceful degradation**: a
cache miss, quota-exceeded, eviction, slow or unknown network, unsupported browser
API, or any thrown error MUST fall back to today's load-after-mount behaviour — never
a thrown error and never a broken page or clip. Second, **bounded footprint**: every
cache is bounded (by entry count, byte ceiling, or TTL) and the iOS origin storage
quota (~50 MB, eviction-prone) is respected, while Android is allowed a richer (deeper)
prefetch budget.

## Glossary

- **Pipeline**: The prefetch + cache subsystem defined by this feature, spanning the
  pure helpers in `showshak-shared.js`, the page bootstraps, and the Service_Worker
  (`sw.js`).
- **Feed**: The vertical short-clip surface (`showshak-feed.html`) where prewarming of
  other pages is initiated during idle time.
- **Discover**: The Discover page (`showshak-discover.html`) showing a grid of clips.
- **Watchlist**: The Watchlist page (`showshak-watchlist.html`) showing a grid of clips.
- **Profile**: The Profile page (`showshak-profile.html`), already prewarmed today by
  `ssPrewarmProfile`.
- **Target_Page**: A page eligible for prewarming from the Feed; for this feature the
  Target_Pages are Discover and Watchlist.
- **Page_Data**: The structured JSON clip list and metadata a Target_Page renders
  (ids, captions, poster URLs, linked titles, public signals).
- **Poster**: A URL-addressable thumbnail image rendered for a Clip before video plays.
- **Clip**: One curator's short (≤90s) vertical video identified by a Mux
  `playback_id`, plus its metadata.
- **Active_Clip**: The Clip currently visible and playing; it always has the highest
  buffering priority.
- **Player_Pool**: The bounded set of mounted `<mux-player>` elements recycled by
  swapping `playback-id` rather than destroyed and recreated.
- **Player_Cap**: The tunable maximum number of concurrently mounted players,
  currently `SS_MAX_LIVE_PLAYERS = 2` (v39).
- **HLS_Segment**: A Mux HLS initialization or media segment (the actual video bytes),
  distinct from the `.m3u8` playlist.
- **Segment_Cache**: The dedicated, version-independent Service_Worker Cache_Storage
  bucket that stores HLS_Segments and serves HTTP 206 range responses.
- **Back_Buffer**: Already-played media bytes retained behind the playback position.
- **Storage_Tier**: One of the three persistence mediums the Pipeline uses —
  Cache_Storage (URL-addressable resources), IndexedDB (structured Page_Data), and
  localStorage (tiny flags only).
- **Cache_Storage**: The Service_Worker-owned Cache API used for the app shell, HTML,
  CSS/JS, Posters, and HLS_Segments.
- **IndexedDB**: The asynchronous structured store used for Page_Data, replacing the
  synchronous `localStorage` page cache.
- **Service_Worker**: The hand-rolled `sw.js`, which applies per-resource caching
  strategies and owns the Segment_Cache.
- **Stale_While_Revalidate**: A caching strategy that serves the cached copy
  immediately and refreshes it in the background for the next load.
- **Cache_First**: A caching strategy that serves the cached copy and only fetches on
  a miss.
- **Cache_Then_Revalidate**: The page-level pattern of painting from cache, then
  re-querying and re-rendering only if the data changed.
- **Cross_Page_Prewarm**: Warming a Target_Page's Page_Data and Posters from the Feed
  during Idle_Time, ahead of navigation.
- **Idle_Time**: A period after first paint when the main thread is free, detected via
  `requestIdleCallback` (or a `setTimeout` fallback), used to schedule prewarming off
  the critical path.
- **Network_Tier**: The classification of the connection (`slow` / `medium` / `fast`)
  derived from `navigator.connection.effectiveType`, used to scale prefetch depth.
- **Device_Profile**: The classification of the running platform as `android` or
  `ios`, used to grant Android a richer prefetch budget while keeping iOS lean.
- **Byte_Budget**: The per-session ceiling on non-active prefetch bytes
  (`SS_SESSION_BYTE_BUDGET`, ~150 MB), enforced by the Circuit_Breaker.
- **Circuit_Breaker**: The session guard that stops further prefetch once the
  Byte_Budget is reached.
- **Kill_Switch**: A `localStorage` flag (`ss_ff_<name>`) that disables a Pipeline
  feature on-device without a redeploy, mirroring `ss_ff_ranker` / `ss_ff_segcache`.
- **Public_Signal**: A signal safe to expose publicly (e.g. follower count, public
  fire/like display where already public). Excludes private engagement totals.
- **Scoreboard**: Private engagement data — fires-received totals and watch-it tap
  counts — that MUST NOT appear in any prefetched or cached payload.
- **Speculation_Rules**: The Chrome/Android Speculation Rules API used to
  prerender/prefetch the next likely page; unsupported on iOS Safari.
- **View_Transitions**: The cross-document View Transitions API (Chrome 126+, Safari
  18.2+) used to animate page navigations, applied as a progressive enhancement.
- **Tunable_Constant**: A named, dual-exported constant (e.g. prefetch depth, poster
  count, byte ceiling, TTL) that governs a magnitude without changing control logic.

## Requirements

### Requirement 1: Prewarm Discover and Watchlist data from the Feed (Phase 1)

**User Story:** As a viewer browsing the Feed, I want Discover and Watchlist data to
be warmed ahead of time, so that opening those tabs paints content instantly instead
of black gradient frames.

#### Acceptance Criteria

1. WHILE the Feed is loaded and Idle_Time is available, THE Pipeline SHALL fetch the Discover Page_Data and the Watchlist Page_Data and store each in the Page_Data cache.
2. THE Pipeline SHALL schedule Cross_Page_Prewarm off the first-paint critical path using `requestIdleCallback`, and WHERE `requestIdleCallback` is unavailable, THE Pipeline SHALL fall back to a deferred `setTimeout`.
3. WHEN Cross_Page_Prewarm for a Target_Page has already completed during the current Feed session, THE Pipeline SHALL skip re-prewarming that Target_Page.
4. WHEN a viewer navigates to a Target_Page whose Page_Data is present in cache, THE Target_Page SHALL render from the cached Page_Data on first paint and then revalidate against the database, re-rendering only if the Page_Data changed.
5. IF Cross_Page_Prewarm fails for any reason, THEN THE Pipeline SHALL leave the Target_Page's existing load-after-mount behaviour unchanged.

### Requirement 2: Prewarm Discover and Watchlist posters from the Feed (Phase 1)

**User Story:** As a viewer browsing the Feed, I want the first posters of Discover
and Watchlist decoded ahead of time, so that those grids show real thumbnails
immediately instead of empty frames.

#### Acceptance Criteria

1. WHEN Cross_Page_Prewarm fetches a Target_Page's Page_Data, THE Pipeline SHALL decode the first `SS_PREWARM_POSTER_COUNT` Posters of that Page_Data into the browser image cache.
2. THE Pipeline SHALL set `SS_PREWARM_POSTER_COUNT` to a Tunable_Constant in the range 12 to 15 inclusive.
3. WHEN a Target_Page renders from cached Page_Data, THE Target_Page SHALL display the prewarmed Posters without issuing a new network request for those Posters.
4. WHERE a Target_Page's Page_Data contains fewer Clips than `SS_PREWARM_POSTER_COUNT`, THE Pipeline SHALL decode only the Posters that exist.
5. IF a Poster decode fails, THEN THE Pipeline SHALL continue decoding the remaining Posters and SHALL NOT surface an error.
6. WHERE a Target_Page's Page_Data contains more Clips than `SS_PREWARM_POSTER_COUNT`, THE Pipeline SHALL decode at most `SS_PREWARM_POSTER_COUNT` Posters and SHALL NOT decode additional Posters.

### Requirement 3: Generic cross-page prewarm helper (Phase 2)

**User Story:** As a developer, I want a single reusable prewarm helper, so that any
page can be warmed from another with consistent, tested behaviour rather than
bespoke per-page code.

#### Acceptance Criteria

1. THE Pipeline SHALL provide one Cross_Page_Prewarm helper that accepts a Target_Page identifier and warms that Target_Page's Page_Data and Posters.
2. THE Cross_Page_Prewarm helper SHALL be invoked for both Discover and Watchlist using the same code path.
3. WHEN the Cross_Page_Prewarm helper is invoked for a Target_Page that is the current page, THE Pipeline SHALL skip prewarming that Target_Page.
4. THE pure decision logic of the Cross_Page_Prewarm helper SHALL be dual-exported for Node and covered by fast-check property tests.
5. WHEN the Cross_Page_Prewarm helper is invoked for a Target_Page that is not the current page, THE Pipeline SHALL warm that Target_Page's Page_Data and Posters.

### Requirement 4: Storage tiering across Cache_Storage, IndexedDB, and localStorage (Phase 2)

**User Story:** As a viewer, I want page data cached without main-thread jank or
quota fragility, so that navigation stays smooth and reliable on both Android and iOS.

#### Acceptance Criteria

1. THE Pipeline SHALL store structured Page_Data in IndexedDB rather than `localStorage`.
2. THE Pipeline SHALL store URL-addressable resources (the app shell, CSS, JS, Posters, and HLS_Segments) in Cache_Storage.
3. THE Pipeline SHALL restrict `localStorage` use to small flags and keys (Kill_Switch flags, last-user id, and small cache metadata).
4. WHEN reading Page_Data for a Cache_Then_Revalidate paint, THE Pipeline SHALL read asynchronously from IndexedDB without blocking the main thread.
5. IF IndexedDB is unavailable or a read or write fails, THEN THE Pipeline SHALL fall back to the existing `localStorage` Page_Data cache.
6. WHEN stored Page_Data exceeds its bound, THE Pipeline SHALL retain at most `SS_PAGE_CACHE_MAX` Clips per Target_Page.

### Requirement 5: Service_Worker per-resource caching strategies (Phase 2)

**User Story:** As a viewer, I want the right caching strategy for each resource type,
so that the app shell loads instantly, pages stay fresh, and posters paint from cache.

#### Acceptance Criteria

1. THE Service_Worker SHALL serve the app shell (CSS, JS, icons, manifest) using Cache_First.
2. THE Service_Worker SHALL serve HTML navigations using Stale_While_Revalidate.
3. WHEN a Poster request is received, THE Service_Worker SHALL serve the Poster using Stale_While_Revalidate.
4. THE Service_Worker SHALL apply these strategies using its existing hand-rolled strategy patterns without introducing a third-party caching library or a build step.
5. IF a Service_Worker cache read fails, THEN THE Service_Worker SHALL fetch the resource from the network.
6. IF an app shell Cache_Storage write fails WHILE Cache_Storage reads succeed, THEN THE Service_Worker SHALL continue serving the app shell from the read-only Cache_Storage using Cache_First.

### Requirement 6: Clip segment-byte prefetch within the player cap (Phase 3)

**User Story:** As a viewer swiping the Feed, I want the next clip's first bytes warmed
ahead, so that the next clip starts instantly without the system mounting extra players.

#### Acceptance Criteria

1. WHILE the Active_Clip's buffer is satisfied and the Circuit_Breaker is closed, THE Pipeline SHALL prefetch upcoming Clips' HLS_Segment bytes ahead of the Active_Clip.
2. THE Pipeline SHALL warm HLS_Segment bytes only and SHALL NOT mount players beyond the Player_Cap of `SS_MAX_LIVE_PLAYERS`.
3. THE Pipeline SHALL limit prefetch depth to `SS_PREFETCH_DEPTH` Clips for the current Network_Tier.
4. WHEN cumulative non-active prefetch reaches the Byte_Budget, THE Circuit_Breaker SHALL open and THE Pipeline SHALL stop further segment prefetch for the session.
5. IF a segment prefetch fails, THEN THE Pipeline SHALL fall back to the player's own fetch for that Clip.

### Requirement 7: Device-verified Service_Worker Segment_Cache with bounded back-buffer (Phase 3)

**User Story:** As a viewer scrolling back to a recently seen clip, I want it served
from cache without re-downloading, while memory stays bounded so the app never bloats.

#### Acceptance Criteria

1. WHERE the Segment_Cache Kill_Switch (`ss_ff_segcache`) is set to `on`, THE Service_Worker SHALL intercept Mux HLS_Segment requests and serve them from the Segment_Cache.
2. WHEN a ranged HLS_Segment request hits the Segment_Cache, THE Service_Worker SHALL serve an HTTP 206 partial response sliced from the cached full segment.
3. IF a cached segment cannot satisfy a requested range, THEN THE Service_Worker SHALL bypass the Segment_Cache and fetch the request from the network.
4. WHEN the Segment_Cache exceeds `SS_SEG_CACHE_CEILING` bytes or a Clip falls outside the `SS_SEG_CACHE_WINDOW`, THE Service_Worker SHALL evict segments per the property-tested eviction plan.
5. THE Pipeline SHALL cap the player Back_Buffer to a Tunable_Constant so retained media bytes remain bounded.
6. WHERE the Segment_Cache Kill_Switch is set to `off`, THE Service_Worker SHALL NOT intercept Mux requests and SHALL deliver Mux exactly as today.
7. WHERE the Segment_Cache Kill_Switch is set to `on` AND a requested HLS_Segment is not present in the Segment_Cache, THE Service_Worker SHALL intercept the request and fetch the requested HLS_Segment from the network.

### Requirement 8: Android-deeper progressive enhancement, iOS lean fallback (Phase 3)

**User Story:** As an Android viewer, I want the next likely page prerendered for
truly instant navigation, while iOS viewers keep a correct, lean experience that
respects platform storage limits.

#### Acceptance Criteria

1. WHERE the Device_Profile is `android` and Speculation_Rules are supported, THE Pipeline SHALL register a Speculation_Rules entry to prefetch or prerender the next likely page.
2. WHERE the Device_Profile is `ios` or Speculation_Rules are unsupported, THE Pipeline SHALL fall back to manual Cross_Page_Prewarm.
3. WHERE the Device_Profile is `android` and the Network_Tier is `fast`, THE Pipeline SHALL apply the deeper segment prefetch depth defined for the fast tier.
4. WHILE the Device_Profile is `ios`, THE Pipeline SHALL keep total Pipeline storage within the iOS origin quota of `SS_IOS_STORAGE_BUDGET` and SHALL NOT assume cached resources persist across sessions.
5. WHERE the Device_Profile is `android`, THE Pipeline SHALL permit a prefetch byte budget no smaller than the iOS budget.
6. IF Speculation_Rules registration fails WHERE the Device_Profile is `android` and Speculation_Rules are supported, THEN THE Pipeline SHALL fall back to manual Cross_Page_Prewarm.
7. WHEN total Pipeline storage on an `ios` Device_Profile exceeds `SS_IOS_STORAGE_BUDGET`, THE Pipeline SHALL evict existing cached resources to return total Pipeline storage within `SS_IOS_STORAGE_BUDGET`.

### Requirement 9: View Transitions polish (Phase 3)

**User Story:** As a viewer, I want app-like page transitions where supported, so that
navigation feels polished, without breaking navigation on browsers that lack support.

#### Acceptance Criteria

1. WHERE cross-document View_Transitions are supported, THE Pipeline SHALL enable a View_Transition for navigations between ShowShak pages.
2. WHERE View_Transitions are unsupported, THE Pipeline SHALL perform a standard navigation with no visual regression.
3. IF a View_Transition fails to start, THEN THE Pipeline SHALL complete the navigation without the transition.
4. WHERE cross-document View_Transitions are supported, THE Pipeline SHALL allow a standard navigation to complete without requiring a View_Transition.

### Requirement 10: Kill switches and graceful fallback (cross-cutting)

**User Story:** As an operator, I want every part of the Pipeline behind a kill switch
with a fallback to today's behaviour, so that the Feed never breaks and I can disable
a feature on-device without a redeploy.

#### Acceptance Criteria

1. THE Pipeline SHALL gate each independently shippable capability (Cross_Page_Prewarm, IndexedDB Page_Data, Poster Stale_While_Revalidate, segment prefetch, Segment_Cache, Speculation_Rules, View_Transitions) behind its own Kill_Switch flag.
2. WHERE a capability's Kill_Switch is set to `off`, THE Pipeline SHALL fall back to today's behaviour for that capability.
3. IF any Pipeline operation throws, THEN THE Pipeline SHALL catch the error and degrade to today's load-after-mount behaviour.
4. THE Pipeline SHALL keep the Feed functional whether every Kill_Switch is on or off.
5. IF any Kill_Switch flag is absent or storage is unreadable, THEN THE Pipeline SHALL use the documented default state for ALL capabilities rather than mixing present flags with defaulted ones.
6. IF the Pipeline's primary error-handling path itself fails, THEN THE Pipeline SHALL apply a higher-level safety net that degrades to today's load-after-mount behaviour.

### Requirement 11: Scoreboard safety (cross-cutting)

**User Story:** As the product owner, I want prefetched and cached data to carry public
signals only, so that private engagement totals are never exposed through a cache.

#### Acceptance Criteria

1. THE Pipeline SHALL include only Public_Signals in any prefetched or cached Page_Data payload.
2. THE Pipeline SHALL exclude fires-received totals and watch-it tap counts from every prefetched or cached payload.
3. IF a source record contains Scoreboard fields, THEN THE Pipeline SHALL omit those fields before writing the payload to any Storage_Tier.
4. WHEN a source record contains both Public_Signals and Scoreboard fields, THE Pipeline SHALL prefetch that source record and write only its Public_Signals rather than skipping the source record.

### Requirement 12: Preserve locked player decisions (cross-cutting)

**User Story:** As the engineering owner, I want the locked player decisions preserved,
so that this feature cannot reintroduce the iOS decoder-contention stall fixed in v39.

#### Acceptance Criteria

1. THE Pipeline SHALL keep the concurrent Player_Cap at `SS_MAX_LIVE_PLAYERS` and SHALL NOT increase the number of concurrently mounted players.
2. THE Pipeline SHALL apply ONE player-level behaviour to both iOS and Android.
3. THE Pipeline SHALL keep the recycled Player_Pool, using `<mux-player>` with no player swap, no raw-hls.js rewrite, no MP4, and no CDN swap.
4. THE Pipeline SHALL keep every media cache bounded and SHALL NOT introduce an unbounded memory cache.

### Requirement 13: No build step and tested pure logic (cross-cutting)

**User Story:** As a developer, I want the Pipeline to stay vanilla and tested, so that
it fits the existing no-build PWA and keeps the property-test suite green.

#### Acceptance Criteria

1. THE Pipeline SHALL be implemented in vanilla HTML, CSS, and JavaScript with no bundler and no build step.
2. THE Pipeline SHALL extend the existing hand-rolled Service_Worker strategy patterns and SHALL NOT introduce Workbox or another caching framework.
3. THE Pipeline SHALL dual-export every new pure helper for both the browser and Node.
4. THE Pipeline SHALL cover every new pure helper with fast-check property tests runnable via `node tests/run-all.js`.
5. WHEN the property-test suite is run, THE existing tests SHALL continue to pass alongside the new tests.

### Requirement 14: Phased, independently shippable delivery (cross-cutting)

**User Story:** As the team, I want each phase to ship on its own, so that we deliver
the founder's main visible win first and add depth safely.

#### Acceptance Criteria

1. THE Pipeline SHALL deliver Phase 1 (Discover and Watchlist data and Poster prewarm) as a standalone increment that requires no later phase to function.
2. WHEN only Phase 1 is deployed, THE Pipeline SHALL keep Discover and Watchlist correct and SHALL improve their perceived load with no regression to the Feed.
3. THE Pipeline SHALL deliver Phase 2 (generic prewarm helper, storage tiering, Poster Stale_While_Revalidate) and Phase 3 (segment prefetch, device-verified Segment_Cache, Android-deeper, View_Transitions) as separately deployable increments.
4. WHILE any later phase is undeployed, THE earlier phases SHALL remain fully functional.
