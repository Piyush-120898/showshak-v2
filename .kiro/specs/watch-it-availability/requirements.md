# Requirements Document

## Introduction

ShowShak needs real, region-aware "Watch It" streaming availability without ever
calling TMDB from the browser. TMDB is ISP/DNS-blocked in India, so end users must
read only cached data from Supabase (Mumbai region). This feature introduces a
cache-first architecture: a local Node ingest script — the only component that
touches TMDB — links titles to TMDB, fetches region-aware streaming providers, and
writes them into `titles.providers`. The ShowShak frontend then reads that cache to
build the Watch It sheet, cross-references the signed-in user's subscriptions, and
falls back gracefully when no providers exist for the user's region. No TMDB key or
TMDB network call ever exists in frontend code, the repository, or any India-egress
path.

## Glossary

- **Title**: A row in the Supabase `titles` table representing one show or movie,
  identified by `id` and optionally linked to TMDB via `tmdb_id`.
- **Watch_Providers**: The streaming (flatrate) services that offer a Title for
  subscription viewing in a given Region, as returned by TMDB `watch/providers`.
  Rent and buy offers are excluded.
- **Region**: A two-letter region code (e.g. `IN`) that scopes Watch_Providers
  availability. The signed-in user's Region is `users.region`; the default Region is
  `IN`.
- **Ingest_Script**: A local Node script (`data/ingest-tmdb.js`) run manually by the
  founder on a TMDB-reachable network (VPN/Cloudflare DNS). It is the only component
  permitted to call TMDB.
- **Provider_Cache**: The `titles.providers` JSONB column, keyed by Region, holding
  the cached Watch_Providers for each Title, alongside `titles.cached_at`.
- **In_Your_Plan**: The state of a provider in the Watch It sheet that matches a
  platform the signed-in user holds in `user_subscriptions`, marked "✓ In your plan"
  and ordered ahead of other providers.
- **Fallback_Chain**: The ordered resolution the Watch It sheet uses when a Title has
  no Watch_Providers for the user's Region: (a) the curator's chosen platform
  (`content.platform_id`), then (b) a neutral "not available in your region" message.
- **Platform_Catalog**: The Supabase `platforms` table (name, color, abbr) used to
  style provider entries consistently in the Watch It sheet.
- **Provider_Cache_Entry**: A single object inside Provider_Cache of the shape
  `{ provider_name, provider_id, logo_path, type: "flatrate" }`.

## Requirements

### Requirement 1: Title linking via local ingest

**User Story:** As the founder, I want the Ingest_Script to link unlinked Titles to
TMDB by name and year, so that the catalog can be enriched with real streaming data
from a TMDB-reachable network.

#### Acceptance Criteria

1. THE Ingest_Script SHALL read the TMDB API key from a local environment file
   (`.env`) that is excluded from version control.
2. WHEN the Ingest_Script runs, THE Ingest_Script SHALL select every Title in the
   `titles` table where `tmdb_id` is null and `deleted_at` is null.
3. WHEN the Ingest_Script processes a Title lacking a `tmdb_id`, THE Ingest_Script
   SHALL search TMDB by the Title `name` and `year`, select the highest-ranked
   matching result, and write its TMDB identifier to `titles.tmdb_id`.
4. IF a Title already has a non-null `tmdb_id` and the forced-relink option is not
   set, THEN THE Ingest_Script SHALL skip TMDB linking for that Title.
5. WHERE the forced-relink option is set, THE Ingest_Script SHALL re-link Titles that
   already have a `tmdb_id`.
6. IF a TMDB search for a Title returns no matching result, THEN THE Ingest_Script
   SHALL leave `titles.tmdb_id` unchanged and record that Title as unmatched.

### Requirement 2: Region-aware provider caching

**User Story:** As the founder, I want the Ingest_Script to cache region-aware
streaming providers per Title, so that the app can show real Watch It availability
without calling TMDB.

#### Acceptance Criteria

1. WHEN the Ingest_Script has a Title linked to a `tmdb_id`, THE Ingest_Script SHALL
   fetch Watch_Providers for that Title from the TMDB `watch/providers` endpoint.
2. THE Ingest_Script SHALL include only flatrate (streaming subscription) offers in
   the Provider_Cache and SHALL exclude rent and buy offers.
3. WHEN the Ingest_Script writes Watch_Providers, THE Ingest_Script SHALL store them
   in `titles.providers` as a JSONB object keyed by Region, where each Region maps to
   an array of Provider_Cache_Entry objects of the shape
   `{ provider_name, provider_id, logo_path, type: "flatrate" }`.
4. WHEN the Ingest_Script updates `titles.providers` for a Title, THE Ingest_Script
   SHALL set `titles.cached_at` to the time of the update.

### Requirement 3: Privileged, resilient, observable ingest

**User Story:** As the founder, I want the Ingest_Script to write to Supabase using a
privileged key without crashing on individual failures, so that ingestion is secure,
reliable, and auditable.

#### Acceptance Criteria

1. THE Ingest_Script SHALL authenticate writes to Supabase using a service role key
   read from the local environment file.
2. THE Ingest_Script SHALL exclude both the TMDB API key and the Supabase service
   role key from version control and from any frontend code.
3. IF processing a single Title raises an error, THEN THE Ingest_Script SHALL record
   that Title as failed and continue processing the remaining Titles.
4. WHEN the Ingest_Script completes a run, THE Ingest_Script SHALL log a summary
   containing the count of matched Titles, unmatched Titles, and updated Titles.

### Requirement 4: Frontend reads cached region providers

**User Story:** As a viewer, I want the Watch It sheet to reflect real streaming
availability for my Region, so that I see where I can actually stream a Title.

#### Acceptance Criteria

1. WHEN `ssLoadClips()` loads a clip, THE Frontend SHALL include the linked Title's
   Provider_Cache (`titles.providers`) and `cached_at` in the clip data.
2. WHEN `ssClipsForFeed()` builds a clip, THE Frontend SHALL construct the clip's
   `platforms[]` from the Provider_Cache entries for the current user's Region instead
   of the single hardcoded mock platform.
3. THE Frontend SHALL read streaming availability only from Supabase cached data and
   SHALL NOT issue any TMDB request from the browser.

### Requirement 5: Subscription cross-reference and ordering

**User Story:** As a signed-in viewer, I want platforms I already subscribe to marked
and listed first, so that I can choose where to watch within my existing plans.

#### Acceptance Criteria

1. WHEN `ssOpenSheet()` displays a clip for a signed-in user, THE Frontend SHALL
   display the Watch_Providers for the user's Region.
2. WHEN a displayed provider matches a platform in the user's `user_subscriptions`,
   THE Frontend SHALL mark that provider "✓ In your plan" and set its `included`
   flag to true.
3. WHEN the Watch It sheet lists providers for a signed-in user, THE Frontend SHALL
   order In_Your_Plan providers before providers the user does not hold.

### Requirement 6: Fallback chain for missing regional availability

**User Story:** As a viewer in a Region with no cached providers for a Title, I want
a sensible fallback, so that the sheet never shows an error or an empty list.

#### Acceptance Criteria

1. IF a Title has no Watch_Providers for the user's Region, THEN THE Frontend SHALL
   display the curator's chosen platform (`content.platform_id`) as a single option.
2. IF a Title has no Watch_Providers for the user's Region and no curator-chosen
   platform is available, THEN THE Frontend SHALL display the message "Not available
   to stream in your region".
3. WHILE the Fallback_Chain is active, THE Frontend SHALL render the Watch It sheet
   without raising an error and without showing an empty option list.

### Requirement 7: Watch It action and deep link

**User Story:** As a viewer, I want selecting a provider to route me to that platform,
so that I can go watch the Title.

#### Acceptance Criteria

1. WHEN a user selects a provider in the Watch It sheet, THE Frontend SHALL route the
   user to that platform using a public universal-link URL pattern.
2. THE Frontend SHALL preserve the existing `ssHandleWatchNow` behavior for provider
   selection.

### Requirement 8: Guest, logged-out, and offline degradation

**User Story:** As a guest or offline viewer, I want the Watch It sheet to still show
cached availability, so that the experience degrades gracefully without errors.

#### Acceptance Criteria

1. WHEN a guest or logged-out user opens the Watch It sheet, THE Frontend SHALL
   display the Region's Watch_Providers cached on the clip.
2. WHERE no `user_subscriptions` data is available, THE Frontend SHALL omit the
   In_Your_Plan marking and render every provider as a standard option.
3. IF subscription data cannot be retrieved, THEN THE Frontend SHALL render the Watch
   It sheet without raising an error.

### Requirement 9: Region source resolution

**User Story:** As a viewer, I want availability scoped to my Region, so that the
providers shown are relevant to where I am.

#### Acceptance Criteria

1. WHEN resolving the Region for a signed-in user, THE Frontend SHALL use
   `users.region`.
2. IF the Region is unknown or the user is a guest, THEN THE Frontend SHALL use `IN`
   as the default Region.

### Requirement 10: No regression of existing behavior

**User Story:** As a user, I want all existing ShowShak behavior to keep working, so
that the Watch It changes do not break the rest of the app.

#### Acceptance Criteria

1. THE Frontend SHALL continue rendering clips on the feed, discover, watchlist, and
   profile surfaces and in the unified clip viewer.
2. THE Frontend SHALL preserve the existing save, fire, and follow actions.
3. THE Frontend SHALL reveal a clip's Title only within the Watch It sheet and SHALL
   keep the Title hidden on the clip surface.

### Requirement 11: Provider-to-catalog identity mapping

**User Story:** As a viewer, I want providers styled consistently, so that the Watch
It sheet looks coherent regardless of the data source.

#### Acceptance Criteria

1. WHEN a Watch_Provider matches an entry in the Platform_Catalog, THE Frontend SHALL
   style that provider using the matched catalog `name`, `color`, and `abbr`.
2. IF a Watch_Provider has no matching Platform_Catalog entry, THEN THE Frontend SHALL
   display that provider using neutral default styling.

## Out of Scope

The following are explicitly excluded from this feature:

1. A Cloudflare Worker proxy for TMDB access.
2. Curator selection of the Title at upload time.
3. Rent and buy providers (only flatrate streaming is cached and shown).
4. Poster and synopsis enrichment from `image.tmdb.org`.
5. Paid Watch It attribution / affiliate routing (deferred; universal links only).
