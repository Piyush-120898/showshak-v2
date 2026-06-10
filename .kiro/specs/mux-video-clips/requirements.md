# Requirements Document

## Introduction

ShowShak Step 3 replaces the prototype's mock clip media with real short-form video delivered through Mux, presented in a TikTok/Reels/YouTube-style player that works on the current static PWA and is structured to carry forward to the future native app. This feature covers the full self-serve pipeline — a curator uploads a video directly to Mux from the browser, a content row is created in `processing` state, a Mux webhook flips it to `live` with its playback id, and the feed plays the real video — plus the playback layer: a `VideoSurface` that wraps the `<mux-player>` web component behind the existing `MediaSurfaceContract`, windowed/sliding-window preloading for seamless continuous looping, poster/thumbnail loading states, and graceful fallback to `GradientSurface` for clips without a playback id.

The design honors ShowShak's standing principles: build for today's scale but structure for tomorrow; counts are derived, not source-of-truth; security is enforced in the database via RLS; database changes are additive (applied directly) or risky (staged) per `supabase/SCHEMA_CHANGE_PROCESS.md`; service-role and Mux secrets live only server-side while the frontend carries the anon key only; feed frames autoplay inline with a single tap opening the fullscreen viewer; no show title appears on the clip; and the Fire/Save/Share/Watch It rail remains the constant frame.

## Glossary

- **Curator**: An authenticated user who uploads and publishes video clips.
- **Viewer**: Any visitor (guest or authenticated) who watches clips in the feed.
- **Clip**: A short-form video item rendered in the feed, backed by a row in the `content` table.
- **Content_Row**: A row in the Supabase `content` table holding `mux_asset_id`, `mux_playback_id`, `thumbnail_url`, `url`, `duration_sec`, and `status`.
- **Clip_Status**: The `status` field of a Content_Row, one of `draft`, `processing`, `live`, `removed`.
- **Upload_Function**: The Supabase Edge Function (Deno) that mints a Mux direct-upload URL on request from the browser.
- **Webhook_Function**: The Supabase Edge Function (Deno) that receives Mux `video.asset.ready` events and updates the corresponding Content_Row.
- **Mux_Direct_Upload**: Mux's browser-to-Mux upload mechanism that uses a short-lived signed upload URL minted server-side.
- **Mux_Player**: The `<mux-player>` web component loaded via CDN `<script>` that renders Mux playback.
- **Media_Surface**: The `MediaSurfaceContract` interface (`mount`/`play`/`pause`/`setMuted`/`isMuted`/`getProgress`/`seek`/`onTimeupdate`/`onEnded`/`destroy`) that the Clip_Engine speaks to.
- **Video_Surface**: The Media_Surface implementation that wraps Mux_Player; selected by `ssCreateSurface` when a Clip has a `muxPlaybackId`.
- **Gradient_Surface**: The existing Media_Surface implementation that renders a CSS gradient; the fallback when a Clip has no `muxPlaybackId`.
- **Surface_Factory**: The `ssCreateSurface(clip, opts)` function that selects Video_Surface or Gradient_Surface.
- **Clip_Loader**: The `ssLoadClips` function that queries the `content` table and maps rows to Clip objects.
- **Clip_Window**: A page of approximately 10 Clips loaded together for the feed.
- **Sliding_Window**: The preloading strategy that fetches the next Clip_Window as the Viewer advances within the current Clip_Window.
- **Poster_Image**: The Mux image-CDN thumbnail shown while video is loading; served from a region that is not India-blocked.
- **Mux_Secret**: The Mux token id and secret used to authenticate with the Mux API; stored only in Edge Function secrets.

## Requirements

### Requirement 1: Direct-to-Mux curator upload

**User Story:** As a Curator, I want my selected video file to upload directly to Mux from the browser, so that I can publish a real clip without exposing any Mux credentials.

#### Acceptance Criteria

1. WHEN an authenticated Curator requests an upload at the file step, THE Upload_Function SHALL return a Mux_Direct_Upload URL minted with the Mux_Secret.
2. THE Upload_Function SHALL read the Mux_Secret only from Edge Function secrets and SHALL NOT return the Mux_Secret in any response.
3. IF an unauthenticated request is made to the Upload_Function, THEN THE Upload_Function SHALL reject the request with an authorization error and SHALL NOT mint a Mux_Direct_Upload URL.
4. WHEN the Curator selects a video file, THE Upload_Client SHALL upload the file bytes directly to the Mux_Direct_Upload URL without routing the file bytes through Supabase.
5. WHILE the file upload is in progress, THE Upload_Client SHALL display upload progress to the Curator.

### Requirement 2: Content row creation and status lifecycle

**User Story:** As a Curator, I want my published clip to be recorded with a clear processing state, so that it appears in the feed only when Mux has finished encoding.

#### Acceptance Criteria

1. WHEN a Curator publishes a clip backed by a Mux_Direct_Upload, THE Upload_Client SHALL insert a Content_Row with `status` set to `processing` and with the Mux upload or asset identifier stored on the row.
2. THE Content_Row SHALL transition Clip_Status only along the allowed values `draft`, `processing`, `live`, and `removed`.
3. WHILE a Content_Row has Clip_Status `processing`, THE Clip_Loader SHALL exclude that Content_Row from feed results.
4. THE database changes that support the upload pipeline SHALL be additive per `supabase/SCHEMA_CHANGE_PROCESS.md`, and any risky change SHALL be staged before production.
5. THE insert of a Content_Row SHALL be permitted only for the authenticated Curator who owns the clip, enforced by RLS.
6. WHERE a Content_Row represents demo or seed data, THE Content_Row SHALL be tagged as demo/seed data.

### Requirement 3: Webhook-driven status flip

**User Story:** As a Curator, I want my clip to go live automatically once Mux finishes processing, so that I do not have to manually publish a second time.

#### Acceptance Criteria

1. WHEN the Webhook_Function receives a Mux `video.asset.ready` event, THE Webhook_Function SHALL set the matching Content_Row's Clip_Status to `live` and store the `mux_playback_id`.
2. WHEN the Webhook_Function processes a ready event, THE Webhook_Function SHALL store the `thumbnail_url` and `duration_sec` returned for the asset on the matching Content_Row.
3. THE Webhook_Function SHALL verify the authenticity of each incoming Mux event before modifying any Content_Row.
4. IF the Webhook_Function receives an event that cannot be matched to a Content_Row, THEN THE Webhook_Function SHALL acknowledge the event without modifying any Content_Row.
5. IF the Webhook_Function receives a duplicate ready event for a Content_Row already set to `live`, THEN THE Webhook_Function SHALL leave the Content_Row unchanged.
6. THE Webhook_Function SHALL write to the Content_Row using server-side credentials and SHALL NOT expose those credentials to the frontend.

### Requirement 4: Clip loader exposes Mux fields

**User Story:** As a Viewer, I want clips to carry their Mux playback information, so that the feed can render real video instead of a placeholder.

#### Acceptance Criteria

1. WHEN the Clip_Loader queries the `content` table, THE Clip_Loader SHALL select `mux_playback_id`, `url`, `thumbnail_url`, and `duration_sec` in addition to the existing fields.
2. WHEN the Clip_Loader maps a Content_Row to a Clip, THE Clip_Loader SHALL set `muxPlaybackId` from `mux_playback_id` and SHALL set a poster value from `thumbnail_url`.
3. THE Clip_Loader SHALL continue to return only Content_Rows with Clip_Status `live` and with no deletion marker.
4. IF a live Content_Row has no `mux_playback_id`, THEN THE Clip_Loader SHALL produce a Clip with no `muxPlaybackId` value.

### Requirement 5: VideoSurface behind the MediaSurfaceContract

**User Story:** As a developer, I want video playback wrapped behind the existing Media_Surface contract, so that the Clip_Engine plays real video without branching on surface type.

#### Acceptance Criteria

1. THE Video_Surface SHALL implement every method of the Media_Surface contract: `mount`, `play`, `pause`, `setMuted`, `isMuted`, `getProgress`, `seek`, `onTimeupdate`, `onEnded`, and `destroy`.
2. WHEN a Clip has a `muxPlaybackId`, THE Surface_Factory SHALL return a Video_Surface for that Clip.
3. WHEN a Clip has no `muxPlaybackId`, THE Surface_Factory SHALL return a Gradient_Surface for that Clip.
4. WHEN `getProgress` is called on a Video_Surface, THE Video_Surface SHALL return a number in the range 0 to 1 representing playback position.
5. WHEN `seek` is called on a Video_Surface with a fraction in the range 0 to 1, THE Video_Surface SHALL move playback to the corresponding position.
6. WHEN playback advances, THE Video_Surface SHALL invoke each `onTimeupdate` callback with progress in the range 0 to 1.
7. WHEN playback reaches the end of the Clip, THE Video_Surface SHALL invoke each `onEnded` callback.
8. WHEN `destroy` is called on a Video_Surface, THE Video_Surface SHALL detach its DOM node and remove its media event listeners.
9. THE Clip_Engine SHALL interact with a Video_Surface only through the Media_Surface contract.

### Requirement 6: Mux player integration

**User Story:** As a Viewer, I want clips to play through a real video player, so that I see and hear actual show footage.

#### Acceptance Criteria

1. THE Mux_Player web component SHALL be loaded via a CDN `<script>` on pages that render the feed.
2. WHEN a Video_Surface mounts, THE Video_Surface SHALL create a Mux_Player element configured with the Clip's `muxPlaybackId`.
3. THE Video_Surface SHALL map Media_Surface `play` and `pause` calls to the Mux_Player playback controls.
4. THE Video_Surface SHALL map Media_Surface `setMuted` and `isMuted` calls to the Mux_Player muted state.
5. THE Video_Surface SHALL derive progress from the Mux_Player `timeupdate`, `loadedmetadata`, and `duration` media signals.
6. THE Video_Surface SHALL map the Mux_Player `ended` signal to the Media_Surface `onEnded` callbacks.

### Requirement 7: Poster and loading state

**User Story:** As a Viewer, I want to see the clip's thumbnail while video loads, so that the feed never shows a blank frame.

#### Acceptance Criteria

1. WHILE a Video_Surface video has not yet started rendering frames, THE Video_Surface SHALL display the Clip's Poster_Image.
2. THE Poster_Image SHALL be served from the Mux image CDN.
3. WHEN the Video_Surface video begins rendering frames, THE Video_Surface SHALL replace the Poster_Image with the playing video.
4. IF a Clip has no `thumbnail_url`, THEN THE Video_Surface SHALL display the Clip's gradient background as the loading state.

### Requirement 8: Continuous loop playback

**User Story:** As a Viewer, I want clips to loop continuously, so that the feed keeps playing like TikTok and Reels.

#### Acceptance Criteria

1. WHEN a Clip reaches its end while it is the active feed frame, THE Clip_Engine SHALL begin playback of the next Clip.
2. WHEN the Viewer reaches the end of the loaded Clips and additional Clips are available, THE Clip_Engine SHALL continue playback into the newly available Clips.
3. WHILE a feed frame is the active frame, THE feed frame SHALL autoplay inline.
4. WHEN the Viewer single-taps an inline feed frame, THE feed SHALL open the fullscreen viewer for that Clip.
5. THE Clip frame SHALL NOT display the show title.

### Requirement 9: Windowed and sliding-window preloading

**User Story:** As a Viewer, I want upcoming clips to load before I reach them, so that playback starts instantly when I scroll.

#### Acceptance Criteria

1. WHEN the feed first loads, THE Clip_Loader SHALL load a Clip_Window of approximately 10 Clips.
2. WHILE a Clip_Window is active, THE feed SHALL preload the upcoming Clips in that Clip_Window so they play without waiting on scroll.
3. WHEN the Viewer reaches approximately the sixth Clip of the active Clip_Window, THE feed SHALL fetch the next Clip_Window of approximately 10 Clips.
4. WHEN the next Clip_Window is fetched, THE feed SHALL append the new Clips to the existing Clips so playback continues seamlessly.
5. THE feed SHALL bound the number of concurrently preloaded video elements so that preloading does not load every Clip at once.

### Requirement 10: Graceful fallback for clips without playback id

**User Story:** As a Viewer, I want clips that have no real video yet to still render, so that the feed never breaks.

#### Acceptance Criteria

1. WHEN a Clip has no `muxPlaybackId`, THE Surface_Factory SHALL render that Clip with a Gradient_Surface.
2. THE Gradient_Surface SHALL continue to satisfy the Media_Surface contract so that the Clip_Engine treats it identically to a Video_Surface.
3. WHERE a feed contains both video-backed and gradient-backed Clips, THE feed SHALL render both within the same continuous loop.

### Requirement 11: Guest and authentication gating

**User Story:** As a guest Viewer, I want to watch clips while being prompted to sign in for actions, so that the experience matches the existing funnel.

#### Acceptance Criteria

1. WHERE a Viewer is a guest, THE feed SHALL allow inline playback of live Clips.
2. WHEN a guest Viewer attempts an action gated by the existing funnel, THE feed SHALL prompt sign-in consistent with the existing funnel behavior.
3. IF a Viewer is not authenticated as a Curator, THEN THE upload pipeline SHALL deny minting a Mux_Direct_Upload URL and SHALL deny inserting a Content_Row.
4. WHILE a Viewer watches any Clip, THE Fire, Save, Share, and Watch It rail SHALL remain present as the constant frame.

### Requirement 12: Error and edge handling

**User Story:** As a Curator and Viewer, I want clear handling when uploads fail or clips are removed, so that the app stays stable and predictable.

#### Acceptance Criteria

1. IF a Mux_Direct_Upload fails before completion, THEN THE Upload_Client SHALL report the failure to the Curator and SHALL NOT mark the clip as published.
2. IF a Content_Row remains in Clip_Status `processing` beyond a defined timeout, THEN THE feed SHALL keep excluding that Content_Row and the Curator SHALL be able to see that the clip is still processing.
3. WHEN a Content_Row's Clip_Status is set to `removed`, THE Clip_Loader SHALL exclude that Content_Row from feed results.
4. IF a Mux_Player fails to load video for a live Clip, THEN THE Video_Surface SHALL continue showing the Poster_Image and SHALL allow the Clip_Engine to advance to the next Clip.
5. IF the Upload_Function or Webhook_Function is unreachable, THEN the affected operation SHALL fail without corrupting any existing Content_Row.
