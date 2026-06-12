# Requirements Document

## Introduction

ShowShak's curator profile shows a private "cockpit" (Fires · Watch Its · Reach, plus a
weekly trend) that today renders zeros for real accounts, because no engagement events are
captured and nothing reads real numbers. This feature makes the cockpit numbers real for the
first ~15 curators by (1) capturing the engagement events that are already modelled in the
database but never written, and (2) surfacing owner-scoped aggregates of those events in the
cockpit and in per-clip stats.

This is grounded in the existing schema (migration `0001_initial_schema.sql`). The event
tables `watch_events`, `view_events`, `share_events` already exist; `content_fires` already
captures Fires and is kept in sync by the `sync_fires_count` trigger. This feature is
**additive**: new API grants, new Row-Level-Security (RLS) policies, and owner-scoped
aggregate read functions. It introduces **no new event tables** and changes no existing data.

Working principles carried in from the architecture (treated as hard constraints below):

- **Events are the source of truth; counts are caches.** `content.*_count` columns and
  `analytics_daily` are derived caches, never authoritative.
- **Security lives in the database (RLS).** A curator may read only their own analytics. Raw
  per-user event rows and "fires given" stay private; the public sees only aggregate fire
  counts already shown on clips.
- **Guest-first.** Guests can view, watch, and share, so view/watch/share events accept a null
  `user_id` (anonymous events count toward reach but are not tied to a person).
- **No build step.** The browser uses the Supabase anon key; migrations are applied manually
  by the founder.
- **Build for today, structure for tomorrow.** At a few hundred clips / few thousand users,
  v1 derives metrics by aggregating event rows on read; the `analytics_daily` rollup is the
  documented scale path (deferred).

## Glossary

- **Clip**: a `content` row — a curator's recommendation video.
- **Curator**: a `users` row with `role = 'curator'`; the owner of Clips.
- **Viewer**: any person watching the feed — a signed-in user or an anonymous Guest.
- **Guest**: an unauthenticated Viewer; produces events with `user_id = null`.
- **Fire**: the 🔥 reaction, stored as a `content_fires` row (existing; capture already works).
- **View_Event**: a `view_events` row recording that a Clip was viewed.
- **Watch_Event**: a `watch_events` row recording a "Watch It" tap (the money metric).
- **Share_Event**: a `share_events` row recording a share action.
- **Engagement_Event**: a View_Event, Watch_Event, or Share_Event.
- **Self_Activity**: a View_Event or Share_Event whose `user_id` equals the `creator_id` of
  the Clip it belongs to (the owning Curator acting on their own Clip). Self_Activity is
  counted at most once per Clip per metric in aggregates, regardless of how many such rows
  exist.
- **Reach**: the aggregate count of View_Events for a Curator's Clips over a stated window,
  computed as the number of View_Events by Viewers who are not the Clip's owning Curator
  (each such view counted separately) plus one per Clip if the owning Curator viewed that Clip
  at least once. Repeated self-views of an owned Clip never inflate Reach beyond one per Clip.
- **Fires_Received**: the number of Fires across a Curator's own Clips.
- **Event_Recorder**: the client-side (vanilla JS) component that writes Engagement_Events
  fire-and-forget from the browser using the anon key.
- **Analytics_Reader**: the database-side, owner-scoped aggregate function(s)
  (`SECURITY DEFINER`) that return totals and per-day/per-Clip counts for the calling Curator's
  Clips only — never raw event rows.
- **Cockpit**: the private analytics panel on a Curator's own profile (`#cockpit` /
  `#panel-analytics` in `showshak-profile.html`), visible only to the owning Curator.
- **Weekly_Trend**: per-day Engagement_Event counts for the last 7 calendar days.
- **Rollup**: the `analytics_daily` table — a nightly aggregation cache (deferred; not built
  in v1).
- **Analytics_DB**: the ShowShak Postgres database (Supabase) with its grants, RLS policies,
  and Analytics_Reader functions.

## Requirements

### Requirement 1: Capture clip views

**User Story:** As a Curator, I want each view of my Clips recorded, so that Reach and view
counts reflect real audience size.

#### Acceptance Criteria

1. WHEN a Viewer views a Clip per the existing view model, THE Event_Recorder SHALL insert one
   View_Event into `view_events` with the Clip's `content_id` and `created_at = now()`.
2. WHERE the Viewer is a Guest, THE Event_Recorder SHALL insert the View_Event with
   `user_id = null`.
3. WHERE the Viewer is signed in, THE Event_Recorder SHALL insert the View_Event with
   `user_id` equal to the signed-in user's id.
4. IF inserting a View_Event fails, THEN THE Event_Recorder SHALL allow Clip playback to
   continue without surfacing an error to the Viewer.
5. WHILE a Viewer remains on the same Clip within a single playback session, THE
   Event_Recorder SHALL record at most one View_Event for that Clip in that session.
6. WHERE a Clip's id is not a persisted `content` row (a mock/prototype clip), THE
   Event_Recorder SHALL skip the View_Event insert.
7. WHEN the Analytics_Reader aggregates View_Events for a Clip, THE Analytics_Reader SHALL
   count every View_Event whose `user_id` differs from the Clip's `creator_id` separately,
   including multiple View_Events by the same non-owning Viewer.
8. WHERE one or more View_Events for a Clip are Self_Activity (the View_Event's `user_id`
   equals the Clip's `creator_id`), THE Analytics_Reader SHALL count those self-views as
   exactly one toward that Clip's Reach.
9. WHERE a Clip has no Self_Activity View_Event, THE Analytics_Reader SHALL add zero
   self-view contribution to that Clip's Reach.

### Requirement 2: Capture Watch It taps

**User Story:** As a Curator, I want each Watch It tap on my Clips recorded, so that I can see
how many viewers I send to streaming platforms.

#### Acceptance Criteria

1. WHEN a Viewer taps Watch It on a Clip, THE Event_Recorder SHALL insert one Watch_Event into
   `watch_events` with the Clip's `content_id` and `created_at = now()`.
2. WHERE the Watch It selection resolves a `title_id`, `platform_id`, or `region`, THE
   Event_Recorder SHALL include those values on the Watch_Event.
3. WHERE the Viewer is a Guest, THE Event_Recorder SHALL insert the Watch_Event with
   `user_id = null`.
4. WHERE the Viewer is signed in, THE Event_Recorder SHALL insert the Watch_Event with
   `user_id` equal to the signed-in user's id.
5. IF inserting a Watch_Event fails, THEN THE Event_Recorder SHALL complete the Watch It
   navigation to the streaming platform without surfacing an error to the Viewer.
6. WHERE a Clip's id is not a persisted `content` row, THE Event_Recorder SHALL skip the
   Watch_Event insert.
7. WHEN a Viewer taps Watch It on a Clip, THE Event_Recorder SHALL record one Watch_Event per
   tap with no per-session de-duplication and no self-collapse, so that repeated taps by the
   same Viewer each produce a distinct counted Watch_Event.
8. THE Analytics_Reader SHALL count every Watch_Event for a Clip separately per Viewer and
   per tap, including taps by the Clip's owning Curator and repeated taps by the same Viewer.
9. THE Analytics_DB SHALL associate each Watch_Event with both the Viewer (the Watch_Event's
   `user_id`, null for a Guest) and the Clip's owning Curator, where the owning Curator is
   derived from the Watch_Event's `content_id` through `content.creator_id` without requiring
   `creator_id` to be denormalized onto the Watch_Event.

### Requirement 3: Capture shares

**User Story:** As a Curator, I want each share of my Clips recorded, so that I can see how
often my recommendations get passed around.

#### Acceptance Criteria

1. WHEN a Viewer completes a share action on a Clip, THE Event_Recorder SHALL insert one
   Share_Event into `share_events` with the Clip's `content_id` and `created_at = now()`.
2. WHERE the Viewer is a Guest, THE Event_Recorder SHALL insert the Share_Event with
   `user_id = null`.
3. WHERE the Viewer is signed in, THE Event_Recorder SHALL insert the Share_Event with
   `user_id` equal to the signed-in user's id.
4. IF inserting a Share_Event fails, THEN THE Event_Recorder SHALL complete the share action
   without surfacing an error to the Viewer.
5. WHERE a Clip's id is not a persisted `content` row, THE Event_Recorder SHALL skip the
   Share_Event insert.
6. WHEN the Analytics_Reader aggregates Share_Events for a Clip, THE Analytics_Reader SHALL
   count every Share_Event whose `user_id` differs from the Clip's `creator_id` separately,
   including multiple Share_Events by the same non-owning Viewer.
7. WHERE one or more Share_Events for a Clip are Self_Activity (the Share_Event's `user_id`
   equals the Clip's `creator_id`), THE Analytics_Reader SHALL count those self-shares as
   exactly one toward that Clip's Share_Event total.

### Requirement 4: Read Fires from existing capture

**User Story:** As a Curator, I want Fires received counted from the existing fire data, so
that analytics does not duplicate or re-implement fire capture.

#### Acceptance Criteria

1. THE Analytics_Reader SHALL derive Fires_Received for a Curator from the existing
   `content_fires` rows belonging to that Curator's Clips.
2. THE Event_Recorder SHALL NOT write `content_fires` rows for analytics purposes, since Fire
   capture and the `sync_fires_count` trigger already exist.
3. WHERE a Clip-level Fire total is needed, THE Analytics_Reader SHALL use the existing cached
   `content.fires_count` value for that Clip.
4. THE Analytics_Reader SHALL count at most one Fire per user per Clip, consistent with the
   existing one-row-per-user `content_fires` behaviour, including a Curator firing their own
   Clip which SHALL count as exactly one Fire.

### Requirement 5: Grant insert access to Engagement_Events with anti-spoofing checks

**User Story:** As the founder, I want event inserts allowed safely from the browser, so that
Guests and signed-in users can generate analytics without being able to forge another person's
events.

#### Acceptance Criteria

1. THE Analytics_DB SHALL grant `insert` on `view_events`, `watch_events`, and `share_events`
   to the `anon` and `authenticated` API roles.
2. WHERE the inserting Viewer is signed in, THE Analytics_DB SHALL accept an Engagement_Event
   only when its `user_id` equals `auth.uid()`.
3. WHERE the inserting Viewer is a Guest, THE Analytics_DB SHALL accept an Engagement_Event
   only when its `user_id` is null.
4. IF an Engagement_Event insert sets `user_id` to a value that is neither `auth.uid()` nor
   null, THEN THE Analytics_DB SHALL reject the insert.
5. THE Analytics_DB SHALL apply these insert rules to `view_events`, `watch_events`, and
   `share_events` through RLS `with check` policies, leaving existing tables and data
   unchanged.

### Requirement 6: Protect raw event rows from reads

**User Story:** As a Viewer, I want assurance that nobody can read who watched, shared, or
fired what, so that my activity stays private.

#### Acceptance Criteria

1. THE Analytics_DB SHALL NOT grant `select` on `view_events`, `watch_events`, or
   `share_events` to the `anon` or `authenticated` API roles.
2. THE Analytics_DB SHALL keep raw `content_fires` rows readable only by their owning user
   (`user_id = auth.uid()`), preserving the existing private "fires given" behaviour.
3. WHEN any party other than through the owner-scoped Analytics_Reader attempts to read raw
   Engagement_Event rows, THE Analytics_DB SHALL return no rows.
4. THE Analytics_DB SHALL continue to expose public Fire counts only through the existing
   `content.fires_count` cache, never through reading individual Fire rows.

### Requirement 7: Provide owner-scoped aggregate reads

**User Story:** As a Curator, I want a safe way to read totals for my own Clips, so that the
Cockpit can show real numbers without exposing raw events.

#### Acceptance Criteria

1. THE Analytics_Reader SHALL return aggregate counts only for Clips whose `creator_id` equals
   `auth.uid()` of the calling Curator.
2. WHEN a Curator requests their analytics, THE Analytics_Reader SHALL return totals for
   Fires_Received, Watch_Event count, View_Event count (Reach), and Share_Event count across
   that Curator's Clips.
3. THE Analytics_Reader SHALL return only aggregated values and SHALL NOT return raw
   Engagement_Event rows or any other user's identity.
4. IF a caller requests analytics for Clips they do not own, THEN THE Analytics_Reader SHALL
   exclude those Clips from the result.
5. THE Analytics_DB SHALL implement the Analytics_Reader as `SECURITY DEFINER` function(s) with
   a locked `search_path`, granted to the `authenticated` role, mirroring the existing
   `sync_fires_count` / `find_or_create_title` security posture.
6. WHEN the owner-scoped Analytics_Reader aggregates View_Events and Share_Events, THE
   Analytics_Reader SHALL apply the Self_Activity collapse at read time by comparing each
   event's `user_id` against the Clip's `creator_id`, counting all of the owning Curator's own
   View_Events as one and all of the owning Curator's own Share_Events as one per Clip, while
   every raw event row remains inserted.
7. WHEN the owner-scoped Analytics_Reader aggregates Watch_Events, THE Analytics_Reader SHALL
   count every Watch_Event with no self-collapse, and WHEN it aggregates Fires it SHALL count
   at most one Fire per user per Clip.

### Requirement 8: Show real Cockpit metrics

**User Story:** As a signed-in Curator viewing my own profile, I want the Cockpit to show my
real impact, so that I can understand how my recommendations perform.

#### Acceptance Criteria

1. WHILE a signed-in Curator views their own profile, THE Cockpit SHALL display Fires_Received
   as the sum of Fires across that Curator's Clips.
2. WHILE a signed-in Curator views their own profile, THE Cockpit SHALL display the Watch_Event
   count, the View_Event count as Reach, and the Share_Event count across that Curator's Clips.
3. WHILE a signed-in Curator views their own profile, THE Cockpit SHALL display that Curator's
   follower count as the number of `follows` rows whose `creator_id` is the Curator.
4. WHERE a Curator has no recorded Engagement_Events, THE Cockpit SHALL display a count of zero
   for the affected metrics.
5. IF the analytics read fails, THEN THE Cockpit SHALL display the affected metrics as zero
   without blocking the rest of the profile from rendering.

### Requirement 9: Show the weekly trend

**User Story:** As a Curator, I want a 7-day trend of my engagement, so that I can see momentum
over the past week.

#### Acceptance Criteria

1. WHEN a signed-in Curator views their own profile, THE Analytics_Reader SHALL return per-day
   Engagement_Event counts for that Curator's Clips for the last 7 calendar days.
2. THE Cockpit SHALL render the returned per-day counts as the Weekly_Trend, with one data
   point per day for each of the 7 days.
3. WHERE a day in the 7-day window has no Engagement_Events, THE Cockpit SHALL render that day
   with a count of zero rather than omitting the day.
4. THE Analytics_Reader SHALL scope the Weekly_Trend to Clips whose `creator_id` equals the
   calling Curator's `auth.uid()`.
5. WHEN the Analytics_Reader computes per-day Weekly_Trend counts, THE Analytics_Reader SHALL
   apply the same counting rules as the totals: View_Events and Share_Events by the owning
   Curator collapse to one per Clip (Self_Activity), Watch_Events count every tap, and Fires
   count at most one per user per Clip.

### Requirement 10: Show per-clip stats

**User Story:** As a Curator, I want stats for each of my Clips, so that I can tell which
recommendations resonate.

#### Acceptance Criteria

1. WHEN a signed-in Curator requests per-Clip stats, THE Analytics_Reader SHALL return, for
   each of that Curator's Clips, the Clip's Fire count, View_Event count, and Watch_Event count.
2. THE Analytics_Reader SHALL include only Clips whose `creator_id` equals the calling
   Curator's `auth.uid()` in the per-Clip stats result.
3. WHERE a Clip has no recorded Engagement_Events, THE Analytics_Reader SHALL return zero for
   that Clip's affected counts.
4. WHEN the Analytics_Reader computes per-Clip stats, THE Analytics_Reader SHALL apply the
   same counting rules as the totals: the Clip's owning Curator's own View_Events collapse to
   one and own Share_Events collapse to one (Self_Activity), Watch_Events count every tap, and
   the Fire count is at most one per user per Clip.

### Requirement 11: Enforce analytics privacy and ownership

**User Story:** As a Curator, I want my analytics visible only to me, so that competitors and
the public never see my private numbers.

#### Acceptance Criteria

1. IF a Curator requests another Curator's analytics, THEN THE Analytics_DB SHALL return no
   data for the Clips they do not own.
2. WHILE a Viewer views a Curator's public profile, THE Cockpit SHALL remain hidden.
3. WHILE a non-owner views a profile, THE profile SHALL expose only the public surface
   (followers and Clip count) and SHALL NOT expose Fires_Received, Watch_Event counts, Reach,
   or the Weekly_Trend.
4. THE Analytics_DB SHALL never expose a user's "fires given" count to any party.

### Requirement 12: Use on-read aggregation for v1 and defer the rollup

**User Story:** As the founder, I want v1 to derive metrics directly from event rows, so that
the Cockpit is accurate at current scale without building a scheduled job yet.

#### Acceptance Criteria

1. THE Analytics_Reader SHALL compute all v1 Cockpit and per-Clip metrics by aggregating
   `content_fires`, `view_events`, `watch_events`, and `share_events` rows on read.
2. THE Analytics_DB SHALL treat `analytics_daily` and the `content.*_count` columns as caches
   and SHALL NOT use them as the authoritative source for v1 analytics reads.
3. THE feature SHALL NOT implement the nightly `analytics_daily` Rollup job in v1; the Rollup
   SHALL be documented as the scale path for a future increment.
4. THE Event_Recorder SHALL insert a raw event row for every captured action (subject to the
   existing per-session view de-duplication and mock-clip skip), and THE Analytics_Reader
   SHALL be the sole component that applies the Self_Activity collapse and per-user Fire
   counting at read time, so that no counting rule discards or mutates raw rows.

### Requirement 13: Keep analytics non-blocking and reads bounded

**User Story:** As a Viewer and as a Curator, I want analytics to never slow down or break the
experience, so that capture and reads stay invisible and fast.

#### Acceptance Criteria

1. THE Event_Recorder SHALL write every Engagement_Event fire-and-forget, without awaiting the
   write before continuing the Viewer's action.
2. IF any Engagement_Event write fails, THEN THE Event_Recorder SHALL fail silently to the
   Viewer and SHALL NOT block playback, the Watch It navigation, or the share action.
3. THE Analytics_Reader SHALL execute reads using the existing indexes on `view_events` and
   `watch_events` (`content_id`, `created_at`) and the `content (creator_id, created_at)`
   index.
4. THE Analytics_Reader SHALL bound the Weekly_Trend query to the last 7 calendar days.
```
