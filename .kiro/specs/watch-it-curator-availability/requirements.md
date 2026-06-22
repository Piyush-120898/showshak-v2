# Requirements Document

## Introduction

ShowShak's "Watch It" sheet is the product's climax: the moment a viewer learns
the title behind a clip and where it streams. Today that sheet treats TMDB's
cached watch-provider data as the authority. A curator linked a movie via TMDB
and published a clip; on the live clip, tapping "Watch It" showed "Not available
to stream in your region" even though the movie was on Prime Video in India —
TMDB's provider data for the region was simply stale and incomplete. A false
"not available" at the climax is a direct trust-breaker.

The root cause is two-fold. First, the resolver `ssResolveWatchOptions` only
falls back to a curator-declared platform when the region's TMDB provider list
is **completely empty**, so partial or wrong TMDB data (missing the real
platform) can never be corrected by a human. Second, the TMDB-linked upload path
never asks the curator where the title streams — only the "can't find it /
manual" path captures platforms — so even when TMDB is empty there is often no
curator declaration to fall back to, and the sheet dead-ends.

This feature establishes a single principle: **TMDB is a hint, the curator is
the authority.** The upload flow gains a "confirm availability" step that always
lets a curator add or correct the platforms a title streams on (per linked
title), those declarations are stored per (clip, title) so they never clobber
shared TMDB data or change availability for other curators' clips, and the
resolver **merges** TMDB providers with curator-declared platforms (de-duplicated)
rather than using the curator only as an all-or-nothing fallback. Watch It
behavior — branding, deep links, "In your plan" marking — is unchanged; the
options are simply more correct.

This feature **depends on** the verified India platform catalog that already
shipped in migration 0027; refreshing that catalog is out of scope here.

## Glossary

- **Curator**: A signed-in user who uploads a clip and links one or more Titles
  to it. The Curator is the human authority on where a Title streams.
- **Title**: A row in the `titles` table representing one show or movie,
  optionally linked to TMDB via `tmdb_id`, carrying region-keyed `providers`.
- **Clip**: A row in the `content` table; a curator's short video that links to
  one or more Titles via the `content_titles` join table.
- **Region**: A two-letter region code (e.g. `IN`) that scopes availability. The
  signed-in user's Region is `users.region`; the default Region is `IN`.
- **Platform_Catalog**: The `platforms` table (fields `id`, `name`, `color`,
  `abbr`, `active`, `region`), refreshed to the verified India set in migration
  0027. Every selectable platform comes from this catalog.
- **TMDB_Providers**: The region-keyed streaming (flatrate) providers cached on a
  Title in `titles.providers`, populated by the `tmdb-providers` edge function.
  Treated as a hint, not authority.
- **Curator_Declared_Platforms**: The set of Platform_Catalog platforms a Curator
  declares a Title streams on, stored per (Clip, Title) pair — distinct from the
  shared `titles.providers`.
- **Confirm_Availability_Step**: The upload-flow step, shown after a Curator
  selects a Title (TMDB-linked or manual), that displays where the Title streams
  in the Curator's Region and lets the Curator add or correct
  Curator_Declared_Platforms for that Title.
- **Watch_It_Resolver**: The pure functions `ssResolveWatchOptions(clip, region,
  subscribedPlatformIds)` and its multi-title wrapper
  `ssResolveWatchOptionsForTitles(titles, region, subs)` in `showshak-shared.js`,
  which turn a Title's availability data into Watch It options. Dual-exported and
  property-tested.
- **Watch_Option**: A single entry the Watch_It_Resolver returns for the Watch It
  sheet, shaped `{ name, color, label, sub, included, platform_id }`.
- **In_Your_Plan**: The state of a Watch_Option whose `platform_id` matches a
  platform the signed-in user holds in `user_subscriptions`, marked "In your
  plan", flagged `included: true`, and ordered ahead of other options.
- **Watch_It_Action**: The behavior of `ssPlatformWatchUrl(platform, titleName)`
  that opens the chosen platform's app or website when a viewer taps a
  Watch_Option.
- **Edit_Flow**: The existing curator flow for changing a published Clip's linked
  Titles and details after posting.
- **Merged_Availability**: The de-duplicated union, per (Clip, Title) and Region,
  of TMDB_Providers and Curator_Declared_Platforms that the Watch_It_Resolver
  turns into Watch_Options.

## Requirements

### Requirement 1: Curator is the availability authority

**User Story:** As a Curator, I want the platforms I declare a Title streams on to
always appear in Watch It, so that a viewer is never falsely told a Title is not
available when I know where it streams.

#### Acceptance Criteria

1. WHERE a Clip has at least one Curator_Declared_Platform for a Title in the
   viewer's Region, THE Watch_It_Resolver SHALL include each Curator_Declared_Platform
   as a Watch_Option.
2. IF a Title has Curator_Declared_Platforms for the viewer's Region, THEN THE
   Watch_It_Resolver SHALL return a non-empty option list and SHALL set `message`
   to null.
3. THE Watch_It_Resolver SHALL return the "Not available to stream in your region"
   message only WHEN both the TMDB_Providers and the Curator_Declared_Platforms are
   empty for the viewer's Region.

### Requirement 2: Confirm-availability step at upload

**User Story:** As a Curator, I want to see and confirm where a Title streams right
after I select it, so that I can correct stale or missing availability before I
publish.

#### Acceptance Criteria

1. WHEN a Curator selects a Title during upload, THE Confirm_Availability_Step SHALL
   resolve and display the platforms the Title streams on in the Curator's Region.
2. IF availability for the selected Title cannot be confirmed for the Curator's
   Region, THEN THE Confirm_Availability_Step SHALL display a message that
   availability could not be confirmed.
3. THE Confirm_Availability_Step SHALL allow the Curator to add one or more
   Curator_Declared_Platforms for the selected Title regardless of whether
   availability was already found.
4. THE Confirm_Availability_Step SHALL allow the Curator to remove a
   Curator_Declared_Platform previously added for the selected Title.
5. WHERE a Clip links multiple Titles, THE Confirm_Availability_Step SHALL present
   availability confirmation and platform editing for each linked Title
   independently.
6. THE Confirm_Availability_Step SHALL offer only platforms drawn from the
   active Platform_Catalog as Curator_Declared_Platform choices.

### Requirement 3: Per-(clip, title) storage of curator declarations

**User Story:** As the founder, I want curator-declared platforms stored per (Clip,
Title), so that one curator's claim never changes availability for other curators'
clips and the TMDB refresh never clobbers human edits.

#### Acceptance Criteria

1. WHEN a Curator declares platforms for a Title on a Clip, THE System SHALL store
   the Curator_Declared_Platforms associated with that specific (Clip, Title) pair.
2. THE System SHALL store Curator_Declared_Platforms separately from the shared
   `titles.providers` field.
3. WHEN the TMDB provider refresh updates `titles.providers` for a Title, THE System
   SHALL leave every Clip's Curator_Declared_Platforms for that Title unchanged.
4. WHEN two different Clips link the same Title, THE System SHALL keep each Clip's
   Curator_Declared_Platforms independent of the other Clip's declarations.
5. WHERE a Curator declares platforms, THE System SHALL persist each platform by its
   Platform_Catalog identifier.

### Requirement 4: Merge resolver (union and de-duplication)

**User Story:** As a viewer, I want Watch It to show the union of TMDB-cached and
curator-declared platforms, so that partial or wrong TMDB data is corrected, not
just empty TMDB data.

#### Acceptance Criteria

1. WHEN resolving Watch_Options for a Title in a Region, THE Watch_It_Resolver SHALL
   produce Merged_Availability as the union of the TMDB_Providers for that Region and
   the Curator_Declared_Platforms for that (Clip, Title) and Region.
2. WHEN a platform appears in both the TMDB_Providers and the Curator_Declared_Platforms
   for the same Region, THE Watch_It_Resolver SHALL include that platform as exactly
   one Watch_Option.
3. WHEN TMDB_Providers contain platforms that the Curator_Declared_Platforms omit,
   THE Watch_It_Resolver SHALL retain those TMDB-sourced platforms as Watch_Options.
4. WHEN the Curator_Declared_Platforms contain a platform absent from the
   TMDB_Providers, THE Watch_It_Resolver SHALL add that platform as a Watch_Option.
5. THE `ssResolveWatchOptionsForTitles` wrapper SHALL apply the same
   Merged_Availability resolution to each linked Title independently and return one
   section per Title in input order.
6. IF a Clip, Region, TMDB_Providers entry, or Curator_Declared_Platforms entry is
   missing, null, or malformed, THEN THE Watch_It_Resolver SHALL resolve without
   raising an error.

### Requirement 5: Watch It parity for curator-declared platforms

**User Story:** As a viewer, I want a curator-added platform to open exactly like a
TMDB-sourced one, so that tapping it behaves identically.

#### Acceptance Criteria

1. WHEN the Watch_It_Resolver emits a Watch_Option from a Curator_Declared_Platform,
   THE Watch_It_Resolver SHALL populate the option's `name`, `color`, `label`, and
   `platform_id` from the matching Platform_Catalog entry.
2. WHEN a viewer taps a Watch_Option sourced from a Curator_Declared_Platform, THE
   Watch_It_Action SHALL open the platform using the same `ssPlatformWatchUrl`
   resolution applied to a TMDB-sourced Watch_Option.
3. THE Watch_It_Resolver SHALL produce Watch_Options from Curator_Declared_Platforms
   with the same field shape it produces for TMDB-sourced Watch_Options.

### Requirement 6: Subscription marking for curator-declared platforms

**User Story:** As a signed-in viewer, I want platforms I subscribe to marked "In
your plan" even when a curator declared them, so that my plan filtering stays
correct.

#### Acceptance Criteria

1. WHEN a Watch_Option sourced from a Curator_Declared_Platform has a `platform_id`
   that matches a platform in the viewer's `user_subscriptions`, THE Watch_It_Resolver
   SHALL mark that option In_Your_Plan and set its `included` flag to true.
2. WHEN the Watch It sheet lists Watch_Options for a signed-in viewer, THE
   Watch_It_Resolver SHALL order In_Your_Plan options before options the viewer does
   not hold, regardless of whether each option is TMDB-sourced or curator-declared.
3. WHERE subscription data is unavailable, THE Watch_It_Resolver SHALL render every
   Watch_Option as a standard option without In_Your_Plan marking.

### Requirement 7: Region-aware resolution

**User Story:** As a viewer, I want curator-declared availability scoped to my
Region, so that the platforms shown are relevant to where I watch.

#### Acceptance Criteria

1. WHEN resolving Watch_Options, THE Watch_It_Resolver SHALL select TMDB_Providers
   and Curator_Declared_Platforms for the viewer's Region.
2. IF the viewer's Region is unknown or the viewer is a guest, THEN THE
   Watch_It_Resolver SHALL use `IN` as the default Region.

### Requirement 8: Edit availability after posting

**User Story:** As a Curator, I want to fix a published Clip's availability later, so
that I can correct a Title's streaming platforms without re-uploading.

#### Acceptance Criteria

1. WHEN a Curator opens the Edit_Flow for a published Clip, THE Edit_Flow SHALL
   display the current Curator_Declared_Platforms for each linked Title.
2. THE Edit_Flow SHALL allow the Curator to add or remove Curator_Declared_Platforms
   for each linked Title on a Clip the Curator owns.
3. WHEN a Curator saves edited Curator_Declared_Platforms, THE System SHALL persist
   the change against that (Clip, Title) pair so that subsequent Watch It resolutions
   reflect the change.

### Requirement 9: Title-reveal and creator-first rules preserved

**User Story:** As a viewer, I want the title to stay hidden until the Watch It
reveal, so that the creator-first experience is preserved.

#### Acceptance Criteria

1. THE System SHALL keep a Clip's Title hidden on the Clip surface and SHALL reveal
   the Title only within the Watch It sheet.
2. WHILE a Curator uses the Confirm_Availability_Step, THE System SHALL confine all
   Title and platform display to the upload flow.
3. THE System SHALL continue to present the Watch It sheet without exposing
   engagement scoreboards to the viewer.
