# Requirements Document

## Introduction

ShowShak is a movie/TV discovery app where curators post short, title-hidden video clips that make viewers feel something, and a "Watch It" button routes viewers to the streaming service that carries the title. The data model is Curator → Clip → Title.

The current curator upload flow (`showshak-upload.html`) is a five-step prototype that links each clip to a **mock** catalog. At publish time it inserts a `content` row with `status='processing'` but with `title_id=null` and `platform_id=null`, and it never writes `content_genres` or `content_moods`. The consequences are concrete: uploaded clips have no real title, so "Watch It" is broken on them, and they have no genres, so Discover cannot surface them.

Curator Upload v2 fixes this by linking clips to **real** rows in the `titles` table, supporting **multiple** titles per clip, **auto-deriving genres** from TMDB-backed titles, enforcing **duration and file-size limits** before and after the Mux upload, and **relaxing the pitch length rules** (no minimum, soft maximum). It preserves ShowShak's core behavior: the title stays hidden on the clip body and is revealed only at the Watch It moment, uploads remain authentication-gated, and all schema changes are additive and RLS-safe.

This document covers the **core v2 scope only**. Out-of-scope items are listed in the "Deferred / Future" section and have no requirements here.

## Open Decisions

The following decision is unresolved and must be confirmed before or during design. It is surfaced here so the maximum can be set deliberately rather than assumed.

- **OPEN DECISION — Pitch maximum length.** V2 removes the pitch *minimum* (one-liners are allowed). A *maximum* cap is still required, with a soft "sweet-spot" hint shown to the curator. The exact maximum value is not yet decided. **Suggested value: ~280 characters.** Requirement 5 is written against a placeholder `{PITCH_MAX}` and a sweet-spot hint range; both must be replaced with confirmed values. The unit (characters vs words) is also part of this decision — the suggestion above assumes characters.

## Glossary

- **System**: The ShowShak Curator Upload v2 feature as a whole, spanning the browser upload UI, the Supabase Postgres database (with RLS), the Mux video pipeline, and the related Edge Functions.
- **Upload_UI**: The browser-side curator upload flow (`showshak-upload.html`) running on GitHub Pages and using the Supabase anon key.
- **Mux_Upload_Function**: The `mux-upload-url` Supabase Edge Function that mints a Mux direct-upload URL for an authenticated curator using the server-only Mux secret.
- **Mux_Webhook**: The `mux-webhook` Supabase Edge Function that receives Mux asset events and, using the service role, flips a clip's status from `processing` to `live`.
- **Curator**: An authenticated ShowShak user (`users.role = 'curator'`) who posts clips.
- **Guest**: A user who is not authenticated.
- **Clip**: A row in the `content` table representing one curator video recommendation.
- **Title**: A row in the `titles` table representing one movie/show, optionally backed by TMDB (`titles.tmdb_id`).
- **TMDB_Backed_Title**: A Title whose `tmdb_id` is set, meaning genre and provider data can be enriched by the existing TMDB ingest script.
- **Platform**: A row in the `platforms` table representing a streaming service (e.g., Netflix, Prime).
- **Content_Titles**: A new many-to-many join table linking one Clip to one or more Titles, mirroring `content_genres`.
- **Content_Genres**: The existing many-to-many join table linking a Clip to genre rows.
- **Providers**: The region-aware where-to-watch data stored in `titles.providers` (JSONB), populated by the TMDB ingest script.
- **Watch_It**: The viewer action and UI that reveals a clip's linked Title(s) and routes the viewer to the streaming Platform(s) carrying them.
- **TMDB_Ingest_Script**: The existing local cache-first script (`data/ingest-tmdb.js`) that enriches `titles` rows with genres and region-aware providers. The browser never calls TMDB directly (TMDB is India-blocked).
- **Duration_Cap**: The hard maximum clip length of 90 seconds.
- **File_Size_Cap**: The maximum upload file size of approximately 300 MB.
- **Pitch**: The curator's written caption stored in `content.description`.
- **Trim**: The Curator action of choosing an In_Point and Out_Point so that only the selected segment of the source video becomes the Clip.
- **In_Point**: The Curator-chosen start time, measured from the beginning of the source video, of the segment to keep.
- **Out_Point**: The Curator-chosen end time, measured from the beginning of the source video, of the segment to keep.
- **Trimmed_Segment**: The portion of the source video between the In_Point and the Out_Point that is uploaded as the Clip.
- **Cover**: The single frame used as the Clip's poster image in the feed and on the curator profile. For a video Clip the Cover is a timestamp into the Clip rendered as a Mux on-demand thumbnail (`image.mux.com/<playbackId>/thumbnail.jpg?time=N`) and stored on the Clip (e.g., `content.thumbnail_url` and/or a cover timestamp in `content.meta`).
- **Default_Cover**: The Cover the System applies automatically when the Curator does not pick one.
- **Draft**: An in-progress, unpublished upload owned by a single Curator that stores the Curator's selections (video, Trim points, linked Title(s), Pitch, vibes/moods, Cover) so the upload can be finished later. Storage mechanism is left to design.
- **Mutable_Metadata**: The fields of a published Clip that the owning Curator may change after posting: Pitch, linked Title(s), vibes/moods, and Cover.
- **Immutable_Asset**: The uploaded video bytes and the resulting Mux asset of a published Clip, which cannot be swapped or replaced after posting.

## Requirements

### Requirement 1: Link Clips to Real Titles

**User Story:** As a curator, I want to link my clip to a real title from the ShowShak title database, so that the Watch It button routes viewers to the correct streaming service.

#### Acceptance Criteria

1. WHEN a Curator searches for a title in the Upload_UI, THE System SHALL query the `titles` table and present matching Title rows.
2. WHEN a Curator selects an existing Title, THE System SHALL associate the selected Title's `id` with the Clip being created.
3. WHEN a Curator chooses a title that does not yet exist in the `titles` table, THE System SHALL create a new `titles` row and associate the new Title's `id` with the Clip.
4. WHERE a linked Title has no Providers data yet, THE System SHALL display the Curator-selected Platform at the Watch It moment so that Watch It remains usable.
5. WHEN a Curator publishes a Clip, THE System SHALL insert the `content` row with a non-null linkage to at least one Title.
6. IF title creation or association fails, THEN THE System SHALL retain the Curator's draft selections and display a failure message without minting or finalizing the Clip.

### Requirement 2: Multiple Titles Per Clip

**User Story:** As a curator, I want to link several titles to one clip, so that I can post recommendations such as "3 films like X".

#### Acceptance Criteria

1. THE System SHALL provide a `content_titles` many-to-many table that links one Clip to one or more Titles, mirroring the structure of `content_genres`.
2. WHEN a Curator selects more than one Title for a Clip, THE System SHALL record one `content_titles` row per selected Title.
3. THE System SHALL require at least one linked Title before a Clip can be published.
4. WHEN a viewer opens Watch_It for a Clip, THE System SHALL list each linked Title with that Title's own region-aware Providers.
5. WHERE a linked Title within a multi-title Clip has no Providers data yet, THE System SHALL display the Curator-selected Platform for that Title at the Watch It moment.
6. THE `content_titles` table SHALL be additive to the existing schema and SHALL enforce Row-Level Security consistent with the existing content join tables.

### Requirement 3: Auto-Generate Genres From Linked Titles

**User Story:** As a curator, I want my clip's genres filled in automatically from the title I link, so that my clip is discoverable without extra effort.

#### Acceptance Criteria

1. WHEN a Curator links a TMDB_Backed_Title to a Clip, THE System SHALL write the Title's genres into `content_genres` for that Clip.
2. WHEN a Clip is linked to multiple TMDB_Backed_Titles, THE System SHALL write the union of those Titles' genres into `content_genres` for that Clip without duplicate genre rows.
3. WHERE a linked Title has no genre data available, THE System SHALL publish the Clip without blocking on genre data.
4. WHEN genres are auto-written for a Clip, THE System SHALL require no additional Curator input for genre assignment.

### Requirement 4: Duration and File-Size Validation

**User Story:** As a curator, I want clear limits on clip length and file size enforced before upload, so that I am not surprised by a rejected or wasted upload.

#### Acceptance Criteria

1. WHEN a Curator selects a video file, THE Upload_UI SHALL read the file's duration and size before requesting a Mux upload URL.
2. IF the selected video's duration exceeds the Duration_Cap of 90 seconds, THEN THE Upload_UI SHALL reject the file with a message stating the 90-second limit and SHALL NOT request a Mux upload URL.
3. IF the selected video's file size exceeds the File_Size_Cap of approximately 300 MB, THEN THE Upload_UI SHALL reject the file with a message stating the size limit and SHALL NOT request a Mux upload URL.
4. WHEN the Mux_Upload_Function mints a direct upload, THE System SHALL request the Mux "Basic" quality tier and a public playback policy.
5. WHEN the Mux_Webhook receives an asset-ready event, THE Mux_Webhook SHALL compare the Mux-reported duration against the Duration_Cap.
6. IF the Mux-reported duration exceeds the Duration_Cap, THEN THE Mux_Webhook SHALL reject the Clip by deleting the Mux asset and marking the Clip as not live.
7. WHEN a file passes both the duration and size checks, THE Upload_UI SHALL allow the Curator to proceed to mint the Mux upload.

### Requirement 5: Pitch Length Rules

**User Story:** As a curator, I want to write a pitch of any length up to a cap, so that I can post a one-liner or a longer story as the moment calls for.

#### Acceptance Criteria

1. THE System SHALL accept a Pitch of any length greater than zero, with no minimum-length requirement.
2. WHILE a Curator edits the Pitch, THE Upload_UI SHALL display a soft sweet-spot hint indicating a recommended length range without blocking publication outside that range. *(Sweet-spot range pending the Open Decision.)*
3. IF the Pitch length exceeds `{PITCH_MAX}`, THEN THE Upload_UI SHALL prevent publication and indicate that the Pitch is over the maximum. *(`{PITCH_MAX}` pending the Open Decision; suggested ~280 characters.)*
4. WHEN a Curator publishes a Clip with a non-empty Pitch within the maximum, THE System SHALL store the Pitch in `content.description`.

### Requirement 6: Preserve Core ShowShak Behavior

**User Story:** As a viewer and as the ShowShak product, I want the core upload guarantees preserved, so that the title-hidden experience, authentication gating, and data safety remain intact.

#### Acceptance Criteria

1. WHEN a Clip is displayed in the feed or on a clip body, THE System SHALL keep the linked Title(s) hidden until the viewer activates Watch_It.
2. WHEN a viewer activates Watch_It, THE System SHALL reveal the linked Title(s) and the routing Platform(s).
3. IF a Guest attempts to upload a Clip, THEN THE System SHALL deny the upload and SHALL NOT mint a Mux upload URL or insert a `content` row.
4. WHEN the Mux_Upload_Function is invoked, THE Mux_Upload_Function SHALL confirm the caller is an authenticated Curator before minting a Mux upload URL.
5. THE System SHALL implement all v2 schema changes as additive changes that preserve existing tables and columns.
6. THE System SHALL enforce Row-Level Security on all new and modified tables so that the browser anon key cannot bypass access controls.
7. THE System SHALL keep all secrets (Mux token, service-role key) confined to Edge Functions and scripts and SHALL NOT expose them to the browser.

### Requirement 7: Clip Trim

**User Story:** As a curator, I want to set an in-point and out-point to trim my selected video to the exact moment, so that I can share only the part that lands and stay within the 90-second limit.

#### Acceptance Criteria

1. WHEN a Curator has selected a video in the Upload_UI, THE Upload_UI SHALL allow the Curator to set an In_Point and an Out_Point on that video.
2. THE Upload_UI SHALL require that the Out_Point is greater than the In_Point.
3. WHILE a Curator adjusts the In_Point or Out_Point, THE Upload_UI SHALL display the resulting Trimmed_Segment duration.
4. IF the Trimmed_Segment duration exceeds the Duration_Cap of 90 seconds, THEN THE Upload_UI SHALL prevent the Curator from proceeding and SHALL indicate that the trimmed selection is over the 90-second limit, consistent with Requirement 4.
5. WHEN a Curator proceeds with a Trimmed_Segment within the Duration_Cap, THE System SHALL upload only the Trimmed_Segment as the Clip so that the published Clip contains only the segment between the In_Point and the Out_Point.
6. WHERE a Curator does not adjust the In_Point or Out_Point, THE System SHALL treat the full source video as the Trimmed_Segment, subject to the same Duration_Cap validation.

### Requirement 8: Cover / Thumbnail Selection

**User Story:** As a curator, I want to choose the cover frame for my clip, so that the poster shown in the feed and on my profile is the moment I want viewers to see.

#### Acceptance Criteria

1. WHEN a Curator's video Clip is available for cover selection, THE Upload_UI SHALL allow the Curator to choose a Cover as a timestamp into the Clip.
2. WHEN a Curator selects a Cover timestamp, THE System SHALL store the Cover on the Clip as a Mux on-demand thumbnail reference (`image.mux.com/<playbackId>/thumbnail.jpg?time=N`) in `content.thumbnail_url` and/or a cover timestamp in `content.meta`.
3. WHERE a Curator does not choose a Cover, THE System SHALL apply a Default_Cover to the Clip.
4. WHEN a Clip is displayed in the feed or on a curator profile, THE System SHALL render the Clip's stored Cover as the poster image.

### Requirement 9: Drafts

**User Story:** As a curator, I want to save an in-progress upload and finish it later, so that I do not lose my work when I cannot complete an upload in one session.

#### Acceptance Criteria

1. WHEN a Curator saves an in-progress upload, THE System SHALL persist the Draft with the Curator's current selections, including the selected video, Trim points, linked Title(s), Pitch, vibes/moods, and Cover.
2. THE System SHALL persist a Draft across sessions for the Curator who owns it.
3. THE System SHALL make each Draft private to its owning Curator and SHALL enforce Row-Level Security so that no other user can read or modify the Draft.
4. WHEN a Curator resumes a Draft, THE System SHALL restore the Curator's prior selections from that Draft into the Upload_UI.
5. WHEN a Curator publishes a Draft, THE System SHALL convert the Draft into a live Clip subject to the same validation rules as a new upload.
6. WHEN a Curator discards a Draft, THE System SHALL remove the Draft so that it no longer appears for the Curator.
7. THE System SHALL implement Draft storage as an additive, Row-Level-Security-safe schema change that preserves existing tables and columns.

### Requirement 10: Edit After Post

**User Story:** As a curator, I want to edit my clip's pitch, linked titles, vibes, and cover after publishing, so that I can correct or improve a clip without re-uploading the video.

#### Acceptance Criteria

1. THE System SHALL allow only the owning Curator to edit a published Clip and SHALL enforce Row-Level Security so that no other user can edit the Clip.
2. WHEN a Curator edits a published Clip, THE System SHALL allow changes to the Clip's Mutable_Metadata: Pitch, linked Title(s), vibes/moods, and Cover.
3. THE System SHALL treat the Immutable_Asset of a published Clip as unchangeable and SHALL NOT allow the uploaded video bytes or Mux asset to be swapped.
4. WHEN a Curator edits the linked Title(s) of a published Clip, THE System SHALL update `content_titles` to reflect the new Title linkage and SHALL re-derive the Clip's auto-generated genres consistent with Requirement 3.
5. WHEN a Curator edits the Pitch of a published Clip, THE System SHALL apply the same Pitch length rules defined in Requirement 5, including no minimum length and the maximum cap.
6. WHEN a Curator edits a published Clip, THE System SHALL keep the linked Title(s) hidden until the viewer activates Watch_It, consistent with Requirement 6.

## Deferred / Future

The following items are explicitly **out of scope** for Curator Upload v2. No requirements are written for them in this document. They are recorded here so they are not lost.

- **Image posts** — `media_type` support, Supabase Storage for images, and an `ImageSurface` for non-video posts.
- **Resumable upload** — chunked/resumable upload via Mux UpChunk.
- **Rights/guidelines acknowledgment** — a content-rights or community-guidelines acknowledgment step (ties into future moderation work).
- **Auto-captions** — automatically generated captions for accessibility.
