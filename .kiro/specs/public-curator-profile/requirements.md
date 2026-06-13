# Requirements Document

## Introduction

The **public curator profile** is the page any visitor — a logged-out guest, a normal signed-in user, or another curator — sees when they search for a curator and open that curator's profile at `showshak-profile.html?face=public&curator=<username>`. The founder's framing is exact: *"the public profile is just a copy of the curator's OWN profile WITHOUT the analytics — we just need to connect them together so when any user searches and opens the profile they get the whole picture of that curator."*

Today the public view is a dead end: it is hydrated **only** from a `sessionStorage` object (`ss_view_curator_v1`) that Discover stashes from **hardcoded mock data**, and the existing real-user fetch (`hydrateOwnProfile()`) explicitly bails when `?curator=` is present (`if (_params.get('curator')) return;`). The result is that a visitor sees a mock name/letter/color (not the curator's real, updated name), no real profile photo (`PROFILE.photo` is forced to `null`), and the `MOCK_CLIPS` wall instead of the curator's real uploaded clips, with follower/clip counts approximated from mock fields.

This feature connects the public profile to the **real backend data** for the specific curator being viewed: the `users` row (looked up by `username`), that curator's live clips from the `content` table (by `creator_id`), real follower and clip counts, and any public shared stacks — while **strictly preserving** ShowShak's "hide the scoreboard" philosophy (the public profile never shows the private analytics cockpit of fires-received, Watch-Its, or reach) and ShowShak's fail-soft convention (the page never goes blank or breaks).

This work reuses existing building blocks (`ssMapContentRowsToClips`, the `hydrateOwnProfile()` fetch pattern, `ssOpenClip`, `ssOpenCurator`) and requires **no new database migrations or RLS changes** — the necessary public reads of `users`, `content`, `follows`, and public `stacks` are already granted (see Assumptions).

## Glossary

- **Public_Curator_Profile**: The `showshak-profile.html` page rendered in the `public` face when a `?curator=<username>` query parameter is present. The trust surface shown to anyone viewing a curator other than themselves.
- **Curator_Hydrator**: The client-side logic that, given a `username`, fetches the curator's real `users` row and real `content` clips from the backend and populates the page state (`PROFILE`, the clips cache) for the Public_Curator_Profile.
- **Viewed_Curator**: The specific curator whose profile is being viewed, identified by the `?curator=<username>` parameter and resolved to a `users` row with `role = 'curator'`.
- **Visitor**: Whoever is viewing the Public_Curator_Profile — a logged-out guest, a normal signed-in user, or a signed-in curator viewing someone else.
- **Users_Row**: A row in the `users` table containing `username`, `name`, `avatar_url`, `bio`, `verified`, `role`, and `genres`.
- **Real_Clip**: A row in the `content` table with `creator_id = Viewed_Curator.id`, `status = 'live'`, and `deleted_at IS NULL`, mapped to the page's clip shape by the existing `ssMapContentRowsToClips` helper.
- **Clip_Grid**: The primary grid on the profile (the "Clips" tab) that renders the Viewed_Curator's clips.
- **Hero_Wall**: The cinematic gradient backdrop at the top of the profile, built from the background gradients of the rendered clips.
- **Public_Stats_Bar**: The credentials bar on the Public_Curator_Profile. Per the existing metrics rule it shows only Followers and Clips.
- **Public_Shared_Stack**: A row in the `stacks` table belonging to the Viewed_Curator with `visibility = 'public'`.
- **Analytics_Cockpit**: The owner-only private panel showing Fires received, Watch-Its, and Reach. Sourced from owner-scoped analytics and never shown on the Public_Curator_Profile.
- **Clip_Viewer**: The shared full-screen clip player opened via the existing `ssOpenClip` function.
- **Backend**: The Supabase Postgres database accessed through `window.ssDB`.
- **Fail_Soft**: ShowShak's resilience convention — when the Backend is unavailable, errors, or returns no data, the page must still render without going blank or breaking.

## Requirements

### Requirement 1: Look up the Viewed Curator by username

**User Story:** As a Visitor, I want the profile I opened to resolve to the real curator I searched for, so that I see that specific person's actual profile rather than placeholder data.

#### Acceptance Criteria

1. WHEN the Public_Curator_Profile loads with a `?curator=<username>` parameter, THE Curator_Hydrator SHALL URL-decode the value, trim surrounding whitespace, and query the Backend for the Users_Row WHERE `username` exactly matches (case-sensitive) the resulting value AND `deleted_at IS NULL`.
2. WHEN the Users_Row query returns exactly one matching row, THE Curator_Hydrator SHALL designate that row as the Viewed_Curator and use its `id` for all subsequent clip and follower queries.
3. WHERE the decoded-and-trimmed `?curator=<username>` value carries exactly one leading `@`, THE Curator_Hydrator SHALL strip that single leading `@` (after decoding and trimming, before querying) so the lookup matches the stored `username`.
4. IF the Backend query for the Users_Row returns no row, THEN THE Curator_Hydrator SHALL treat the Viewed_Curator as not found and apply the not-found behavior defined in Requirement 8.
5. IF the matched Users_Row has a `role` other than `curator`, THEN THE Curator_Hydrator SHALL treat the Viewed_Curator as not found and apply the not-found behavior defined in Requirement 8.
6. IF the `?curator` parameter is absent, empty, or consists only of whitespace and/or a leading `@` after decoding, THEN THE Curator_Hydrator SHALL treat the Viewed_Curator as not found per Requirement 8 without issuing the Users_Row query.

### Requirement 2: Render the Viewed Curator's real identity

**User Story:** As a Visitor, I want the curator's real name, handle, photo, bio, badge, and taste tags, so that I get the whole picture of who they are.

#### Acceptance Criteria

1. WHEN the Viewed_Curator is resolved AND the Users_Row `name` field is a non-empty value, THE Curator_Hydrator SHALL set the displayed name from the Users_Row `name` field.
2. WHEN the Viewed_Curator is resolved, THE Curator_Hydrator SHALL set the displayed handle to `@` followed by the Users_Row `username` field.
3. WHEN the Viewed_Curator is resolved AND the Users_Row `avatar_url` field is a non-empty value, THE Public_Curator_Profile SHALL render the avatar from the `avatar_url` image.
4. IF the Users_Row `avatar_url` field is empty or null, THEN THE Public_Curator_Profile SHALL render a letter monogram derived from the first character of the Users_Row `name` field, or from the first character of the `username` field when `name` is empty or null.
5. WHEN the Viewed_Curator is resolved AND the Users_Row `bio` field is a non-empty value, THE Curator_Hydrator SHALL set the displayed bio from the Users_Row `bio` field.
6. WHEN the Viewed_Curator is resolved AND the Users_Row `verified` field is true, THE Public_Curator_Profile SHALL display the verified badge.
7. WHEN the Viewed_Curator is resolved AND the Users_Row `genres` field contains one or more values, THE Public_Curator_Profile SHALL display those values as the curator's taste tags.
8. IF the Users_Row `name` field is empty or null, THEN THE Public_Curator_Profile SHALL display the `username` as the name and SHALL NOT display any mock or placeholder name.
9. IF the Users_Row `bio` field is empty or null, THEN THE Public_Curator_Profile SHALL render no bio text and SHALL NOT display any mock or placeholder bio.
10. IF the Users_Row `genres` field is empty or null, THEN THE Public_Curator_Profile SHALL render no taste tags and SHALL NOT display any mock or placeholder tags.

### Requirement 3: Render the Viewed Curator's real clips

**User Story:** As a Visitor, I want to see the clips this curator has actually posted, so that I can judge their taste from their real work.

#### Acceptance Criteria

1. WHEN the Viewed_Curator is resolved, THE Curator_Hydrator SHALL query the Backend for up to 200 `content` rows WHERE `creator_id` equals the Viewed_Curator `id`, `status` equals `live`, AND `deleted_at IS NULL`, ordered by creation time with the most recently created row first.
2. WHEN the clip query returns one or more rows, THE Curator_Hydrator SHALL map every returned row to a Real_Clip using the existing `ssMapContentRowsToClips` helper, preserving the most-recent-first order.
3. WHEN one or more Real_Clips are available, THE Clip_Grid SHALL render every Real_Clip in the most-recent-first order without truncation.
4. WHEN one or more Real_Clips are available, THE Hero_Wall SHALL be built from the background gradients of the first 5 Real_Clips in the most-recent-first order, or from all Real_Clips when fewer than 5 are available.
5. WHILE the Viewed_Curator is resolved, THE Public_Curator_Profile SHALL exclude every `MOCK_CLIPS` entry from the Clip_Grid and the Hero_Wall.

### Requirement 4: Show only real public stats

**User Story:** As a Visitor, I want to see how many followers the curator has and how many clips they have posted, so that I understand their standing and output without a vanity scoreboard.

#### Acceptance Criteria

1. WHEN the Viewed_Curator is resolved, THE Public_Stats_Bar SHALL display exactly two metrics — a Followers count and a Clips count — each rendered as a non-negative integer (minimum value 0) accompanied by its text label.
2. WHEN the Viewed_Curator is resolved, THE Curator_Hydrator SHALL set the Followers count from the count of `follows` rows WHERE `creator_id` equals the Viewed_Curator `id` AND `deleted_at IS NULL`, yielding 0 when no such rows exist.
3. WHEN the Viewed_Curator is resolved, THE Curator_Hydrator SHALL set the Clips count to the number of Real_Clips rendered in the Clip_Grid, yielding 0 when no Real_Clips are rendered.
4. THE Public_Stats_Bar SHALL NOT display a fires-received count, a Watch-It count, a fires-given count, a reach count, or any metric other than the Followers count and the Clips count.

### Requirement 5: Show the Viewed Curator's public shared stacks

**User Story:** As a Visitor, I want to see the collections this curator has chosen to share publicly, so that I can explore their curated picks.

#### Acceptance Criteria

1. WHEN the Viewed_Curator is resolved, THE Curator_Hydrator SHALL query the Backend for `stacks` rows WHERE `user_id` equals the Viewed_Curator `id` AND `visibility` equals `public` AND `deleted_at IS NULL`, ordered by `sort_no` ascending and then `created_at` descending, returning at most 50 rows as the Public_Shared_Stacks.
2. WHEN the public stacks query returns one or more Public_Shared_Stacks, THE Public_Curator_Profile SHALL render each returned Public_Shared_Stack in the Shared Stacks shelf in the queried order, displaying each stack's `name`.
3. WHEN the public stacks query returns zero Public_Shared_Stacks, THE Public_Curator_Profile SHALL render the existing empty state for shared stacks with no stack cards displayed.
4. THE Public_Curator_Profile SHALL NOT display any stack belonging to the Viewed_Curator whose `visibility` equals `private` or `friends`.

### Requirement 6: Preserve the hide-the-scoreboard philosophy

**User Story:** As the founder, I want the public profile to never expose a curator's private analytics, so that ShowShak's core anti-popularity-contest philosophy is preserved.

#### Acceptance Criteria

1. WHILE the Public_Curator_Profile is displayed, THE Public_Curator_Profile SHALL keep the Analytics_Cockpit (the fires-received, Watch-Its, and reach panel) hidden such that no fires-received, Watch-It, or reach value is present in the rendered output or DOM.
2. WHILE the Public_Curator_Profile is displayed, THE Public_Curator_Profile SHALL keep all analytics charts hidden such that no analytics chart element is present in the rendered output or DOM.
3. WHILE the Public_Curator_Profile is displayed, THE Public_Curator_Profile SHALL keep the "Preview as" developer face switcher hidden such that no "Preview as" control is present in the rendered output or DOM.
4. WHILE the Public_Curator_Profile is rendering or displaying a Viewed_Curator, THE Public_Curator_Profile SHALL issue zero Backend requests for owner-scoped analytics data, where owner-scoped analytics data is any fires-received, Watch-It, or reach metric.
5. WHEN the Clip_Grid renders the Viewed_Curator's Real_Clips, THE Clip_Grid SHALL render each per-clip card with no fires-received count, no view count, no Watch-It count, and no reach count present in the card.
6. WHEN the Visitor switches between any tabs on the Public_Curator_Profile, THE Public_Curator_Profile SHALL keep the Analytics_Cockpit, all analytics charts, and the "Preview as" developer face switcher hidden.

### Requirement 7: Use real data exclusively when the curator is found

**User Story:** As a Visitor, I want the profile to show only the curator's real data once it loads, so that mock content is never mixed with real content.

#### Acceptance Criteria

1. WHEN the Viewed_Curator is resolved, THE Curator_Hydrator SHALL populate the Public_Curator_Profile identity fields, the Clip_Grid, the Public_Stats_Bar counts, and the Shared Stacks shelf exclusively from the Backend Users_Row, Real_Clips, the real follower count, and Public_Shared_Stacks.
2. WHEN the Viewed_Curator is resolved, THE Public_Curator_Profile SHALL NOT read the `ss_view_curator_v1` mock-derived stash as a source for identity, clips, follower count, or clip count.
3. WHEN the Viewed_Curator is resolved, THE Public_Curator_Profile SHALL exclude `MOCK_CLIPS` and `MOCK_COLLECTIONS` from the Clip_Grid, the Hero_Wall, the Shared Stacks shelf, and the Public_Stats_Bar counts.
4. IF the `ss_view_curator_v1` stash is present when the Viewed_Curator is resolved, THEN THE Public_Curator_Profile SHALL render the Backend Users_Row and Real_Clips values in place of the stash values without throwing an unhandled error.

### Requirement 8: Handle a curator that is not found or is not a curator

**User Story:** As a Visitor who opens a profile that does not resolve to a curator, I want a clear, non-broken page, so that I understand the curator is unavailable rather than seeing fake data.

#### Acceptance Criteria

1. WHEN the Curator_Hydrator treats the Viewed_Curator as not found per Requirement 1 (no matching Users_Row, or a matched Users_Row whose `role` is not `curator`), THE Public_Curator_Profile SHALL display a not-found state that includes the requested username with any leading `@` removed.
2. WHILE the not-found state is displayed, THE Public_Curator_Profile SHALL show a message indicating that the requested curator is unavailable.
3. WHILE the not-found state is displayed, THE Public_Curator_Profile SHALL render an empty Clip_Grid that contains zero clip cards and excludes `MOCK_CLIPS`.
4. WHILE the not-found state is displayed, THE Public_Stats_Bar SHALL display a Followers count of exactly 0 and a Clips count of exactly 0.
5. WHILE the not-found state is displayed, THE Public_Curator_Profile SHALL keep the Analytics_Cockpit and the "Preview as" developer switcher hidden.
6. WHILE the not-found state is displayed, THE Public_Curator_Profile SHALL render without throwing an unhandled error.

### Requirement 9: Fail soft when the Backend is unavailable

**User Story:** As a Visitor on a flaky connection, I want the profile page to stay usable, so that the app never shows a blank or broken screen.

#### Acceptance Criteria

1. IF `window.ssDB` is unavailable when the Public_Curator_Profile loads with a `?curator=<username>` parameter, THEN THE Public_Curator_Profile SHALL render the not-found state defined in Requirement 8 for the requested username without throwing an unhandled error.
2. IF the Users_Row query fails with a Backend error, THEN THE Curator_Hydrator SHALL apply the not-found behavior defined in Requirement 8 without throwing an unhandled error.
3. IF the Real_Clip query fails with a Backend error, THEN THE Clip_Grid SHALL render an empty clips state without `MOCK_CLIPS` and without throwing an unhandled error.
4. IF the Real_Clip query fails with a Backend error, THEN THE Hero_Wall SHALL render a default brand backdrop without `MOCK_CLIPS` gradients AND THE Public_Stats_Bar SHALL display a Clips count of 0.
5. IF the follower-count query fails with a Backend error, THEN THE Public_Stats_Bar SHALL display a Followers count of 0 AND THE Public_Curator_Profile SHALL continue rendering the Viewed_Curator's identity and rendered Real_Clips.
6. IF the public-stacks query fails with a Backend error, THEN THE Public_Curator_Profile SHALL render the empty shared-stacks state defined in Requirement 5 without throwing an unhandled error.

### Requirement 10: Handle a curator with zero live clips

**User Story:** As a Visitor opening a curator who has not posted any live clips, I want a clean empty state, so that I am not misled by a wall of fake clips.

#### Acceptance Criteria

1. WHEN the Viewed_Curator is resolved AND the Real_Clip query returns zero rows, THE Clip_Grid SHALL render zero clip cards and display an empty-clips message indicating the curator has not posted any clips, without including any `MOCK_CLIPS`.
2. WHEN the Viewed_Curator is resolved AND the Real_Clip query returns zero rows, THE Hero_Wall SHALL render a single default brand backdrop and SHALL NOT render any gradient tiles derived from `MOCK_CLIPS` or from clip data.
3. WHEN the Viewed_Curator is resolved AND the Real_Clip query returns zero rows, THE Public_Stats_Bar SHALL display a Clips count of exactly 0.

### Requirement 11: Open the shared clip viewer from a real clip

**User Story:** As a Visitor, I want to tap a clip on the curator's profile and watch it, so that I can experience their recommendations directly.

#### Acceptance Criteria

1. WHEN a Visitor taps a Real_Clip in the Clip_Grid, THE Public_Curator_Profile SHALL open the Clip_Viewer positioned at the tapped Real_Clip via the existing `ssOpenClip` function.
2. WHEN the Clip_Viewer opens from the Public_Curator_Profile, THE Public_Curator_Profile SHALL pass the rendered Real_Clips, in the same order they appear in the Clip_Grid, as the viewer's clip array.
3. WHEN the Clip_Viewer opens from the Public_Curator_Profile, THE Public_Curator_Profile SHALL pass only Real_Clips and SHALL NOT include `MOCK_CLIPS` in the viewer's clip array.
4. IF opening the Clip_Viewer via `ssOpenClip` fails or `ssOpenClip` is unavailable when a Real_Clip is tapped, THEN THE Public_Curator_Profile SHALL remain on the profile without opening the Clip_Viewer and without throwing an unhandled error.

### Requirement 12: Serve all Visitor types

**User Story:** As any kind of Visitor, I want the public profile to work whether I am logged out or signed in, so that everyone gets the same complete picture of the curator.

#### Acceptance Criteria

1. WHEN a logged-out guest opens the Public_Curator_Profile with a `?curator=<username>` parameter, THE Curator_Hydrator SHALL fetch and render the Viewed_Curator's identity per Requirement 2, the Viewed_Curator's Real_Clips per Requirement 3, and the Followers and Clips counts per Requirement 4.
2. WHEN a signed-in user or a signed-in curator opens the Public_Curator_Profile with a `?curator=<username>` parameter for a Viewed_Curator whose `id` differs from the Visitor's own `id`, THE Curator_Hydrator SHALL fetch and render the Viewed_Curator's identity per Requirement 2, the Viewed_Curator's Real_Clips per Requirement 3, and the Followers and Clips counts per Requirement 4.
3. WHEN the Public_Curator_Profile loads with a `?curator=<username>` parameter, THE Curator_Hydrator SHALL execute the same Users_Row, Real_Clip, and follower-count queries for the Viewed_Curator regardless of whether the Visitor is authenticated.
4. WHILE the Public_Curator_Profile is displayed with a `?curator=<username>` parameter, THE Public_Curator_Profile SHALL render only the Viewed_Curator's identity, clips, and counts.
5. WHILE the Public_Curator_Profile is displayed with a `?curator=<username>` parameter, THE Public_Curator_Profile SHALL NOT substitute, merge, or render the Visitor's own profile identity, clips, or counts.

### Requirement 13: Reflect real follow state on the public Follow control

**User Story:** As a signed-in Visitor, I want the Follow button on a curator's public profile to reflect whether I already follow them, so that the control is accurate.

#### Acceptance Criteria

1. WHEN the Public_Curator_Profile renders for a signed-in Visitor, THE Public_Curator_Profile SHALL display the Follow control in a following state if a `follows` row exists WHERE `follower_id` equals the Visitor's `id` AND `creator_id` equals the Viewed_Curator's `id` AND `deleted_at IS NULL`, and in a not-following state otherwise.
2. WHEN a signed-in Visitor activates the Follow control while it is in the not-following state, THE Public_Curator_Profile SHALL create the follow relationship for the Viewed_Curator using the existing follow handling.
3. WHEN a signed-in Visitor activates the Follow control while it is in the following state, THE Public_Curator_Profile SHALL remove the follow relationship for the Viewed_Curator using the existing follow handling.
4. WHEN the follow relationship is created or removed, THE Public_Curator_Profile SHALL update the Follow control to reflect the resulting following or not-following state within 1 second.
5. IF the follow create or remove action fails with a Backend error, THEN THE Public_Curator_Profile SHALL keep the Follow control in its prior state and indicate the action did not complete, without throwing an unhandled error.
6. WHERE the Viewed_Curator was resolved by username only, THE Public_Curator_Profile SHALL associate the follow create and remove actions with the Viewed_Curator's resolved real `id` and `username` from the Users_Row.

### Requirement 14: Require no new database migrations or RLS changes

**User Story:** As the founder, I want this feature to ship without new SQL, so that the data layer stays stable and the change is confined to the client.

#### Acceptance Criteria

1. THE Curator_Hydrator SHALL read the Viewed_Curator data using only `SELECT` queries against the `users`, `content`, `follows`, and `stacks` tables that rely on the public read access already granted by the existing migrations and RLS policies named in the Assumptions section.
2. THE Public_Curator_Profile feature SHALL be implemented entirely in client-side code and SHALL NOT add, modify, or remove any database migration file, table grant, or RLS policy.
3. IF an implementation step finds that a required public `SELECT` on the `users`, `content`, `follows`, or `stacks` tables is not already granted, THEN THE implementation SHALL stop that step, report the specific missing table and grant to the founder, and SHALL NOT author or apply any new migration or RLS SQL within this feature.
4. THE Curator_Hydrator SHALL NOT issue any `INSERT`, `UPDATE`, or `DELETE` against the `users`, `content`, or `stacks` tables when rendering a Viewed_Curator, except for the existing owner-scoped follow write already defined in Requirement 13.

## Assumptions

- The required Backend grants and RLS policies already exist and need no change:
  - `users` — public `SELECT` granted in `0003_auth_user_trigger.sql`; RLS policy `users_read` allows reading any row where `deleted_at IS NULL` (covers identity lookup by username).
  - `content` — public `SELECT` granted in `0002_grant_public_reads.sql`; RLS limits reads to `status = 'live'` (covers Real_Clips).
  - `follows` — readable per `0006_social_access.sql` policy `follows_read` (covers follower counts); follow writes are owner-scoped to the acting Visitor.
  - `stacks` / `stack_items` — public stacks readable per the `0001`/`0006` policies (covers Public_Shared_Stacks).
- Search/Discover may carry only a `username` (not the curator's `id`); the lookup therefore starts from `username` and resolves the `id` from the fetched Users_Row.
- The existing `ssMapContentRowsToClips` helper already filters to `status = 'live'` and `deleted_at IS NULL` and produces the clip shape the grid and Hero_Wall consume.
- This feature does not change the owner's own-profile behavior, the Analytics_Cockpit, or the upload flow.
