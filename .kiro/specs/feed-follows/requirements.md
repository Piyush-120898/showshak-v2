# Requirements Document

## Introduction

ShowShak's feed is currently flat newest-first. The only feed query,
`ssLoadClips(limit, offset)` in `showshak-shared.js`, selects `content` rows
where `status = 'live'` and `deleted_at is null`, orders by `created_at`
descending, and paginates with `.range()`. It is completely follow-unaware even
though a real follow graph already exists: the `follows` table, the
`ssHydrateFollowing` / `ssGetFollowing` / `ssIsFollowing` helpers in
`showshak-shared.js`, and real per-clip `fires_count` and `views_count` columns
on the `content` table. The trust loop that ShowShak is built on — a user
follows a curator they trust, then watches what that curator recommends — is
built but unused by the feed. Wiring follows into feed ordering is the product's
single biggest cold-start and retention lever.

This feature replaces flat ordering with a tiered, trust-weighted ordering while
keeping the feed a simple pull-on-read at beta scale (roughly 500 or fewer live
clips). The desired ordering is five tiers, highest priority first:

1. New clips from curators the user follows (followed and recent).
2. Other new clips (recent, from curators the user does not follow).
3. Most-viewed or most-fired clips from curators the user follows (their older
   popular content).
4. Most-fired and most-viewed clips across the whole platform (global popular).
5. Everything else, randomized.

The core of the work is a pure, dual-exported, fast-check property-tested ranking
function that takes a bounded candidate set of live clips with their public
signals and produces a de-duplicated, ordered list. `ssLoadClips` then paginates
that ranked list and hydrates full rows per page. There is no fan-out-on-write or
precompute; that is a future scale upgrade and is explicitly out of scope.

Four design decisions raised with the founder are captured as hard requirements:
de-duplication so every clip appears exactly once at its highest-priority tier;
seen-state folded into freshness so returning users do not see the same clips on
top every session; scoreboard safety so ranking uses only public signals (per-clip
fires, views, recency) and never private curator metrics; and empty-follow
degradation so guests and brand-new users get a feed equivalent to today's
behavior rather than an empty or broken feed.

This feature honors ShowShak's sacred product rules: creator-first (show title
hidden until the Watch It sheet), Fire is the like, Watch It stays frictionless
and private, and — most relevant here — HIDE THE SCOREBOARD: public surfaces
expose only per-clip fires and views, creator, and follower/clip counts, never
fires-received totals or Watch-It taps, with privacy enforced by RLS.

## Glossary

- **Feed**: The ordered list of live clips presented on the main feed surface,
  produced by `ssLoadClips` and rendered in `showshak-feed.html`.
- **Clip**: A row in the `content` table representing one curator recommendation
  video. A clip is feed-eligible only when `status = 'live'` and `deleted_at` is
  null.
- **Curator**: A user (`users.role = 'curator'`) who authored a clip via
  `content.creator_id`.
- **Viewer**: The person reading the feed, whether a signed-in user or a guest.
- **Guest**: A viewer who is not signed in (no `ssCurrentUser`) and therefore
  follows nobody.
- **Follow_Graph**: The set of (follower, creator) relationships in the `follows`
  table where `deleted_at` is null, exposed in the app via `ssGetFollowing` /
  `ssIsFollowing`.
- **Followed_Curator**: A Curator the Viewer follows according to the
  Follow_Graph.
- **Public_Signals**: The per-clip ranking inputs that are publicly visible:
  `content.fires_count`, `content.views_count`, and `content.created_at`
  (recency). These are the only permitted ranking inputs.
- **Private_Metrics**: Curator-private engagement totals — fires-received totals,
  Watch-It taps (`watch_events` / `content.watch_it_count`), reach, and any
  `analytics_daily` figure — that are RLS-gated to the owning Curator. These MUST
  NOT be ranking inputs and MUST NOT be exposed on any public surface.
- **Recency**: How new a clip is, derived from `content.created_at`.
- **Recency_Window**: The 14 days (1,209,600 seconds) immediately preceding the
  ranking reference time (the time at which the Ranker is invoked). A Clip is
  "recent" when its `created_at` falls within the Recency_Window and "older" when
  it falls outside it.
- **Seen_State**: Whether the Viewer has already viewed a given clip, derived from
  the Viewer's view history (`watch_history` / `view_events`) where available.
- **Tier**: One of the five priority bands (Tier 1 highest, Tier 5 lowest) that
  define feed ordering.
- **Candidate_Set**: The bounded set of feed-eligible clips, each carrying `id`,
  `creator_id`, `created_at`, `fires_count`, and `views_count`, fetched in one
  cheap query and passed to the Ranker.
- **Ranker**: The pure, dual-exported (`window.*` and `module.exports`),
  fast-check property-tested function that maps a Candidate_Set plus the Viewer's
  Follow_Graph, Seen_State, and an explicit seed to a de-duplicated, fully ordered
  list of clip ids.
- **Ranked_List**: The complete ordered, de-duplicated list of clip ids the Ranker
  returns for a given Candidate_Set, Viewer, and seed.
- **Page**: A contiguous slice of the Ranked_List returned for a given `limit` and
  `offset`, whose ids are then hydrated into full clip rows.
- **Fallback_Feed**: The current flat newest-first ordering (live clips,
  `deleted_at` null, `created_at` descending) used as a safe degradation path.

## Requirements

### Requirement 1: Five-tier feed ordering

**User Story:** As a Viewer, I want the feed ordered by how much I am likely to
trust and want each clip, so that recommendations from curators I follow and fresh
or popular clips surface before filler.

#### Acceptance Criteria

1. THE Ranker SHALL assign each Clip in the Candidate_Set to exactly one Tier using
   the priority order: Tier 1 — recent Clips from Followed_Curators; Tier 2 — recent
   Clips from curators the Viewer does not follow; Tier 3 — older Clips from
   Followed_Curators; Tier 4 — older Clips across the platform; Tier 5 — all
   remaining Clips, where a Clip is "recent" when its `created_at` falls within the
   Recency_Window and "older" when its `created_at` falls outside the Recency_Window.
2. THE Ranker SHALL order the Ranked_List so that every Tier 1 Clip precedes every
   Tier 2 Clip, every Tier 2 Clip precedes every Tier 3 Clip, every Tier 3 Clip
   precedes every Tier 4 Clip, and every Tier 4 Clip precedes every Tier 5 Clip.
3. WITHIN Tiers 1 and 2, THE Ranker SHALL order Clips by Recency, most recent first,
   and WHERE two Clips share the same `created_at`, THE Ranker SHALL order them by
   ascending clip `id`.
4. WITHIN Tiers 3 and 4, THE Ranker SHALL order Clips by a popularity score computed
   from Public_Signals only (`fires_count`, `views_count`), highest first, and WHERE
   two Clips have an equal popularity score, THE Ranker SHALL order them by ascending
   clip `id`.
5. WITHIN Tier 5, THE Ranker SHALL produce a randomized permutation of the remaining
   Clips that contains each remaining Clip exactly once.
6. THE Ranker SHALL treat the Recency_Window as the 14 days (1,209,600 seconds)
   immediately preceding the ranking reference time, where the ranking reference time
   is the time at which the Ranker is invoked.

### Requirement 2: Exactly-once de-duplication across tiers

**User Story:** As a Viewer, I want each clip to appear only once in the feed, so
that the same recommendation never repeats as I scroll.

#### Acceptance Criteria

1. THE Ranker SHALL include each distinct feed-eligible clip id from the
   Candidate_Set in the Ranked_List exactly once, even when that same clip id is
   present more than once in the Candidate_Set.
2. WHERE a Clip qualifies for more than one Tier, THE Ranker SHALL place that Clip
   only in its highest-priority Tier.
3. THE set of clip ids in the Ranked_List SHALL equal the set of distinct
   feed-eligible clip ids in the Candidate_Set, containing every such id and no id
   that is absent from the Candidate_Set, so that the Ranked_List is a de-duplicated
   permutation of the eligible input id set.
4. THE Ranked_List SHALL contain no duplicate clip id.

### Requirement 3: Ranking inputs limited to public signals and recency

**User Story:** As the founder, I want feed ranking to use only public engagement
signals and recency, so that the hidden scoreboard stays hidden and ranking can
never leak private curator metrics.

#### Acceptance Criteria

1. THE Ranker SHALL compute Tier assignment and within-Tier ordering using only
   Public_Signals (`fires_count`, `views_count`, `created_at`), Seen_State, and the
   Follow_Graph, and SHALL use no other field as a ranking input.
2. THE Ranker SHALL NOT read, receive, or compute any Private_Metric (fires-received
   totals, Watch-It taps, reach, `analytics_daily` figures) as a ranking input.
3. THE Candidate_Set query SHALL select only `id`, `creator_id`, `created_at`,
   `fires_count`, and `views_count` from `content` as ranking signals, and SHALL
   request no other `content` column as a ranking signal.
4. No Private_Metric value SHALL appear in any field of any Clip returned in a Page
   as a result of ranking.
5. IF a Private_Metric field is present in the Ranker's input, THEN THE Ranker SHALL
   exclude it from ranking and SHALL produce the same Ranked_List as when that field
   is absent.

### Requirement 4: Seen-state folded into freshness

**User Story:** As a returning Viewer, I want clips I have already seen to sink
below fresh ones, so that reopening the feed each day does not show me the same
clips on top every session.

#### Acceptance Criteria

1. WHERE Seen_State is available and non-empty for the Viewer, THE Ranker SHALL
   partition each Tier into an unseen sub-block followed by a seen sub-block, placing
   every Clip the Viewer has not seen ahead of every Clip the Viewer has already seen
   within that same Tier.
2. WHERE Seen_State is available, THE Ranker SHALL order the Clips within the unseen
   sub-block and within the seen sub-block of each Tier by that Tier's own primary
   ordering rule (Recency for Tiers 1 and 2, popularity score for Tiers 3 and 4,
   randomized for Tier 5).
3. THE Ranker SHALL apply seen-state ordering only within a Tier and SHALL NOT move
   any Clip from its assigned Tier to a different Tier, and SHALL NOT place any
   already-seen Clip ahead of an unseen Clip within the same Tier.
4. THE Ranker SHALL keep every already-seen Clip in the Ranked_List rather than
   removing it.
5. WHERE Seen_State is unavailable or empty for the Viewer, THE Ranker SHALL order
   each Tier solely by that Tier's primary ordering rule with no seen-state
   partitioning.
6. WHEN the same Candidate_Set and Follow_Graph are ranked across sessions and the
   Viewer's Seen_State has grown, THE Ranker SHALL produce a Ranked_List in which
   each Clip newly added to Seen_State is ordered no higher within its Tier than on
   the prior session.

### Requirement 5: Empty-follow and guest degradation

**User Story:** As a guest or brand-new user who follows nobody, I want a working,
useful feed on first touch, so that my first experience is never empty or broken.

#### Acceptance Criteria

1. WHERE the Viewer's Follow_Graph is empty, THE Ranker SHALL produce a Ranked_List
   composed only of Tier 2 Clips (recent clips from curators the Viewer does not
   follow), Tier 4 Clips (most-fired and most-viewed clips across the platform), and
   Tier 5 Clips (all remaining clips in randomized order), ordered so that every
   Tier 2 Clip precedes every Tier 4 Clip and every Tier 4 Clip precedes every Tier 5
   Clip.
2. WHERE the Viewer is a Guest, THE Ranker SHALL rank using an empty Follow_Graph and
   SHALL return a Ranked_List without raising an error.
3. WHERE the Follow_Graph is empty, THE Ranker SHALL leave Tier 1 and Tier 3 empty
   and SHALL include every Candidate_Set Clip exactly once across Tiers 2, 4, and 5.
4. WHERE the Follow_Graph is empty AND the Candidate_Set contains no Clip, THE Ranker
   SHALL return an empty Ranked_List without raising an error.

### Requirement 6: Stable pagination across the ranked list

**User Story:** As a Viewer scrolling the feed, I want pages to fit together
seamlessly, so that no clip is duplicated or skipped between pages.

#### Acceptance Criteria

1. WHEN the Feed requests a Page with a non-negative integer `offset` and a positive
   integer `limit`, THE System SHALL return the contiguous slice of the Ranked_List
   starting at `offset` and containing at most `limit` clip ids.
2. WHEN consecutive Pages are requested across one Ranked_List, THE System SHALL
   return each Clip in at most one Page and SHALL skip no Clip present in the
   Ranked_List.
3. WHILE a single Ranked_List is being paginated, THE System SHALL preserve the order
   of the Ranked_List across Pages without re-ordering or re-shuffling any Tier
   between Page requests.
4. THE System SHALL fix the Tier 5 randomization using a deterministic seed held
   constant for the duration of a single Ranked_List session, so that repeated Page
   requests over that Ranked_List yield the same Tier 5 order.
5. IF an `offset` is greater than or equal to the length of the Ranked_List, THEN THE
   System SHALL return an empty Page.
6. IF `limit` is zero or negative, or `offset` is negative, THEN THE System SHALL
   return an empty Page without raising an error.

### Requirement 7: Backward-compatibility with an empty follow graph deployment

**User Story:** As the founder, I want a deployment whose follow graph is empty to
behave like today's feed, so that shipping the ranker changes nothing until follows
exist.

#### Acceptance Criteria

1. WHERE no follow relationship exists for any Viewer in the deployment, THE Ranker
   SHALL order the recency-ordered Tiers (Tier 1 and Tier 2) newest-first, equivalent
   to the Fallback_Feed ordering for that recent subset of the Candidate_Set.
2. THE Ranked_List SHALL be newest-first only across its recency-ordered Tiers;
   non-recent Clips fall to the popularity Tier 4 and randomized Tier 5, so the full
   Ranked_List is NOT strictly newest-first across the entire list.
3. THE Feed SHALL continue to expose the existing `ssLoadClips(limit, offset)`
   signature and SHALL return clips whose field set and structure are identical to
   the pre-ranker `ssLoadClips` output.
4. WHEN the follow graph later contains relationships, THE Ranker SHALL apply the
   five-Tier ordering without any change to the `ssLoadClips` signature.

### Requirement 8: Graceful failure to a safe feed

**User Story:** As a Viewer, I want the feed to still work if ranking or its data
fetch fails, so that I never see a broken or empty feed.

#### Acceptance Criteria

1. IF the Candidate_Set query returns an error or does not complete, THEN THE System
   SHALL serve the Fallback_Feed for the requested Page without propagating the error
   to the caller.
2. IF the Ranker raises an error for a given input, THEN THE System SHALL serve the
   Fallback_Feed for the requested Page without propagating the error to the caller.
3. IF the Follow_Graph input is missing, null, or malformed, THEN THE Ranker SHALL
   treat it as an empty Follow_Graph and rank without raising an error.
4. IF the Seen_State input is missing, null, or malformed, THEN THE Ranker SHALL treat
   Seen_State as unavailable and rank without raising an error.
5. IF the Candidate_Set input is missing, null, or malformed, THEN THE Ranker SHALL
   exclude every malformed entry, return a de-duplicated Ranked_List over the
   remaining well-formed Clips, and SHALL NOT raise an error.
6. WHEN serving the Fallback_Feed, THE System SHALL return the contiguous Page slice
   of live (`status = 'live'`), non-deleted (`deleted_at` null) Clips ordered by
   `created_at` descending for the requested `limit` and `offset`.
7. IF the Fallback_Feed query also returns an error or does not complete, THEN THE
   System SHALL return an empty Page without propagating the error to the caller.

### Requirement 9: Only live, non-deleted clips appear

**User Story:** As a Viewer, I want to see only published clips, so that removed or
unpublished recommendations never reach the feed.

#### Acceptance Criteria

1. THE Candidate_Set SHALL contain only Clips whose `status` is exactly equal to the
   value `live` (exact, case-sensitive match) and whose `deleted_at` is null.
2. THE Ranker SHALL exclude from the Ranked_List any Clip whose `status` is present
   and not exactly `live`, or whose `deleted_at` is present and not null, treating
   such a Clip as absent from its input even when the Clip is present in that input.
3. THE Ranked_List SHALL contain no Clip whose `deleted_at` is present and not null
   and no Clip whose `status` is present and not exactly `live`, in any Tier.
4. IF a Clip in the Ranker's input has a `status` that is present but null or not
   exactly `live`, or a `deleted_at` value that is present and non-null or malformed,
   THEN THE Ranker SHALL treat that Clip as not feed-eligible and SHALL exclude it
   from the Ranked_List without raising an error. WHERE a Clip's `status` or
   `deleted_at` field is ABSENT (undefined) — as it is for every Candidate_Set row
   produced by the public-signals-only query of Req 3.3, which pre-filters
   `status = 'live'` and `deleted_at is null` in SQL and does not select those
   columns — THE Ranker SHALL treat the Clip as feed-eligible on that field, so the
   Candidate_Set the query returns is never wrongly emptied by the eligibility filter.
5. WHEN every Clip in the Candidate_Set is excluded by the live and non-deleted
   criteria, THE Ranker SHALL return an empty Ranked_List without raising an error.

### Requirement 10: Pure, testable ranking core

**User Story:** As a developer, I want the ranking logic isolated as a pure,
property-tested function, so that the feed never breaks and ordering correctness is
verifiable in isolation.

#### Acceptance Criteria

1. THE Ranker SHALL be a pure function such that, given identical inputs (the
   Candidate_Set, Follow_Graph, Seen_State, and the explicitly passed seed value), it
   SHALL return an identical Ranked_List, and it SHALL produce no side effects: it
   SHALL NOT mutate any input argument, SHALL NOT perform any I/O, and SHALL NOT read
   or write any external, global, or ambient state.
2. THE Ranker SHALL receive the randomization source used for Tier 5 ordering as an
   explicit seed (or seeded rng) input parameter, so that for a fixed seed the Tier 5
   ordering is deterministic and the function remains pure (same inputs including seed
   produce the same Ranked_List).
3. THE Ranker SHALL be dual-exported on `window.*` and via `module.exports` so that
   it is callable in the browser and under Node.
4. THE Ranker SHALL be covered by fast-check property tests run via
   `node tests/run-all.js`, with each property exercised over at least 100 generated
   cases, including properties for exactly-once de-duplication, tier-priority
   ordering, public-signals-only ranking inputs, seen-state de-prioritization, and
   empty-follow degradation.
5. THE Ranker SHALL be built and its full fast-check property suite SHALL pass via
   `node tests/run-all.js` with zero failures before `ssLoadClips` is changed to call
   it, and at every checkpoint `ssLoadClips` SHALL continue to return feed-shaped
   clips matching the pre-change response shape.
