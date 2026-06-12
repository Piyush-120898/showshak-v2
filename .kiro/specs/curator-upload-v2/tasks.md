# Implementation Plan: Curator Upload v2

## Overview

This plan turns the existing five-step upload prototype (`showshak-upload.html`) into a real
publishing pipeline that links clips to real `titles`, supports multiple titles per clip,
auto-derives genres, enforces duration/size limits, relaxes pitch rules, adds client-side trim
and cover selection, drafts, and edit-after-post — all additive and RLS-safe.

The work is sequenced **DB-first**: schema (migration 0017) and the TMDB ingest enhancement come
first because they unblock auto-genres; then the pure helpers in `showshak-shared.js` with their
property tests (they encode all the input-driven logic and unblock both the UI and the Edge
Functions); then the Edge Function changes; then the `showshak-upload.html` UI rewrite that wires
everything together; then drafts and edit-after-post; then the multi-title Watch It sheet; and
finally verification.

Conventions honored from the project:
- No build step. UI is vanilla JS in `showshak-upload.html`; pure logic lives in
  `showshak-shared.js` and is exported under the existing `module.exports` block for Node tests.
- Migrations are applied **manually by the founder** in the Supabase SQL editor and then verified
  with the re-runnable service-role script `data/_verify_upload_v2.js`. Tasks that depend on a new
  migration call this out explicitly.
- Property tests are plain-Node + `fast-check`, ≥100 iterations, one design property per test,
  tagged `Feature: curator-upload-v2, Property <n>`. Edge Function tests use Deno.
- The browser never calls TMDB; genre data reaches titles only via `data/ingest-tmdb.js`.

## Tasks

- [x] 1. Database schema and TMDB ingest (DB-first foundation)
  - [x] 1.1 Create migration `0017_sync_content_genres.sql`
    - Add `supabase/migrations/0017_sync_content_genres.sql` following `supabase/SCHEMA_CHANGE_PROCESS.md`.
    - Define `public.sync_content_genres(p_content_id uuid)` as `SECURITY DEFINER` with a locked `search_path`, granted `EXECUTE` to `authenticated`, mirroring the `find_or_create_title` (0016) security posture.
    - Function body: gather genre names from each linked title's `meta->'genres'` (jsonb array) for the clip's `content_titles`; resolve each name to `genres.id` case-insensitively, creating the genre row if missing; `DELETE` existing `content_genres` for the clip and `INSERT` the de-duplicated union.
    - Add an `AFTER INSERT OR DELETE ... FOR EACH STATEMENT` trigger on `content_titles` that calls the function; use `create or replace` and `drop trigger if exists` so the migration is idempotent.
    - Note for the founder: this migration must be applied manually in the Supabase SQL editor before tasks that rely on auto-genres can be verified.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 6.5, 6.6, 10.4_

  - [x] 1.2 Enhance `data/ingest-tmdb.js` to store genre names on titles
    - Extend the title-write step so the `meta` patch becomes `{ ...(t.meta||{}), media_type: mediaType, genres: genreNamesFromTmdb }` (additive jsonb array of TMDB genre names; no new column).
    - Map the TMDB genre ids/objects on the fetched record to their display names before writing.
    - Keep the cache-first behavior and confirm the browser is never involved (server-only secrets).
    - _Requirements: 3.1, 3.2, 6.7_

  - [x] 1.3 Extend `data/_verify_upload_v2.js` to cover migration 0017
    - Add re-runnable service-role assertions that `sync_content_genres` and the `content_titles` trigger exist.
    - Assert that inserting `content_titles` rows for TMDB-backed titles derives the expected de-duplicated `content_genres` union, and that re-linking re-derives idempotently.
    - Note for the founder: run this after applying 0017.
    - _Requirements: 3.1, 3.2, 3.3, 10.4_

- [x] 2. Test harness setup
  - [x] 2.1 Add `fast-check` as a dev dependency for the Node property tests
    - Install `fast-check` scoped to the test runner only (production code stays dependency-free and unbundled); reuse the existing plain-Node runner pattern (`tests/*.test.js`, exit non-zero on failure) and the DOM/window stub established in `tests/pure-helpers.test.js`.
    - Establish the shared property-test conventions: `ITER >= 100`, single property per file, tag comment `Feature: curator-upload-v2, Property <n>`.
    - _Requirements: 6.7_

- [x] 3. Pitch validation helper
  - [x] 3.1 Implement `ssValidatePitch(text)` in `showshak-shared.js`
    - Return `{ ok, length, overMax, inSweetSpot }` with `PITCH_MAX = 280`, no minimum beyond length > 0, and soft `SWEET_MIN/SWEET_MAX` hint flags that never affect `ok`.
    - Export it under the existing `module.exports` block.
    - _Requirements: 5.1, 5.2, 5.3_

  - [x]* 3.2 Write property test for pitch validation
    - **Property 1: Pitch validation honours no-minimum and the 280 maximum**
    - **Validates: Requirements 5.1, 5.2, 5.3, 10.5**
    - New file `tests/prop-pitch.test.js`; generators include empty/whitespace pitches and the 280 boundary.

- [x] 4. Trim helpers
  - [x] 4.1 Implement `ssTrimDuration`, `ssValidateTrim`, `ssIsFullSourceTrim` in `showshak-shared.js`
    - `ssTrimDuration(inSec, outSec)` → `outSec - inSec` (>= 0, NaN-safe).
    - `ssValidateTrim(inSec, outSec, srcDur)` → `{ ok, reason, durationSec }`, requiring `out > in` and `(out - in) <= DURATION_CAP (90)`; finite-safe (never throws, never `ok` on non-finite input).
    - `ssIsFullSourceTrim(inSec, outSec, srcDur)` → true iff `in = 0` and `out = srcDur`.
    - Export all three; reuse a shared `DURATION_CAP` constant.
    - _Requirements: 7.2, 7.3, 7.4, 7.6_

  - [x]* 4.2 Write property test for trim validation
    - **Property 2: Trim validation requires Out > In and a segment within the cap**
    - **Validates: Requirements 7.2, 7.3, 7.4**
    - New file `tests/prop-trim-validate.test.js`; generators include `out <= in`, zero-length, exactly-90 s, and non-finite durations.

  - [x]* 4.3 Write property test for full-source detection
    - **Property 3: Untrimmed selection is detected as the full source**
    - **Validates: Requirements 7.6**
    - New file `tests/prop-trim-fullsource.test.js`.

- [x] 5. Media-file validation helper
  - [x] 5.1 Implement `ssValidateMediaFile(sizeBytes, durationSec)` in `showshak-shared.js`
    - Return `{ ok, reason }` with `ok` iff `durationSec <= 90` and `sizeBytes <= FILE_SIZE_CAP (~300 MB)`; the failure reason states which cap was exceeded.
    - Reuse the shared `DURATION_CAP`; define `FILE_SIZE_CAP`. Export it.
    - _Requirements: 4.1, 4.2, 4.3, 4.7_

  - [x]* 5.2 Write property test for media-file validation
    - **Property 4: Media-file validation gates on both duration and size**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.5, 4.7**
    - New file `tests/prop-media-file.test.js`.

- [x] 6. Genre-union helper
  - [x] 6.1 Implement `ssGenreUnion(titlesGenreLists)` in `showshak-shared.js`
    - Return a de-duplicated, first-seen-order-stable array of genre names; empty/missing lists contribute nothing and never throw; idempotent for an already-unioned input. Export it.
    - _Requirements: 3.1, 3.2, 3.3_

  - [x]* 6.2 Write property test for genre union
    - **Property 5: Genre derivation is the de-duplicated, order-stable, empty-safe union**
    - **Validates: Requirements 3.1, 3.2, 3.3, 10.4**
    - New file `tests/prop-genre-union.test.js`; generators include titles with empty/missing `meta.genres`.

- [x] 7. Title-linking and publish-gating helpers
  - [x] 7.1 Implement `ssBuildTitleLinks(selectedTitles)` and `ssCanPublish(draft)` in `showshak-shared.js`
    - `ssBuildTitleLinks` produces one `content_titles` row per distinct selected title with `sort_no` `0..n-1` (primary at `sort_no 0`, matching `content.title_id`).
    - `ssCanPublish(draft)` is true iff at least one title is linked; when true, the publish row's `title_id` is non-null (the `sort_no 0` title). Export both.
    - _Requirements: 1.2, 1.5, 2.2, 2.3_

  - [x]* 7.2 Write property test for title linking and publish gating
    - **Property 7: Title linking produces one ordered row per selected title and gates publish**
    - **Validates: Requirements 1.2, 1.5, 2.2, 2.3**
    - New file `tests/prop-title-links.test.js`.

- [x] 8. Cover thumbnail helpers
  - [x] 8.1 Implement `ssCoverThumbUrl(playbackId, timeSec)` and `ssParseCoverTime(thumbUrl)` in `showshak-shared.js`
    - `ssCoverThumbUrl` builds `image.mux.com/<pid>/thumbnail.jpg?time=<t>`; with no time supplied it returns the default URL with no `time` parameter.
    - `ssParseCoverTime` round-trips: `ssParseCoverTime(ssCoverThumbUrl(pid, t)) === t`. Export both.
    - _Requirements: 8.2, 8.3_

  - [x]* 8.2 Write property test for cover URL round-trip
    - **Property 8: Cover thumbnail URL round-trips with its parser**
    - **Validates: Requirements 8.2, 8.3**
    - New file `tests/prop-cover-url.test.js`; generators include missing cover times.

- [x] 9. Multi-title Watch It resolver
  - [x] 9.1 Implement `ssResolveWatchOptionsForTitles(titles, region, subs)` in `showshak-shared.js`
    - Return exactly one entry per title in order; each entry equals `ssResolveWatchOptions(title, region, subs)` for that title alone, including the curator-platform fallback when a title has no providers for the region. Reuse the existing resolver; export the new function.
    - _Requirements: 1.4, 2.4, 2.5, 6.2_

  - [x]* 9.2 Write property test for multi-title Watch It resolution
    - **Property 6: Multi-title Watch It resolves each title independently**
    - **Validates: Requirements 1.4, 2.4, 2.5, 6.2**
    - New file `tests/prop-watch-multi.test.js`; generators include titles with and without region providers.

- [x] 10. Draft and edit-patch helpers
  - [x] 10.1 Implement `ssDraftToRow`, `ssRowToDraft`, `ssDraftToLinks` in `showshak-shared.js`
    - `ssDraftToRow(draft)` → `content` row patch (`description`, `title_id`, `status`, and `meta` keys `trim`, `vibes`, `cover_time`).
    - `ssDraftToLinks(draft)` → `content_titles` rows; `ssRowToDraft(row, links)` reconstructs the draft state such that `ssRowToDraft(ssDraftToRow(d), ssDraftToLinks(d)) === d`. Export all three.
    - _Requirements: 5.4, 9.1, 9.4_

  - [x]* 10.2 Write property test for draft round-trip
    - **Property 9: Draft state round-trips through persistence**
    - **Validates: Requirements 5.4, 9.1, 9.4**
    - New file `tests/prop-draft-roundtrip.test.js`.

  - [x] 10.3 Implement `ssBuildEditPatch(editInput)` in `showshak-shared.js`
    - Produce a patch containing only Mutable_Metadata keys (`description`, `title_id`, `meta.vibes`, `thumbnail_url` / `meta.cover_time`) and never `mux_asset_id`, `mux_playback_id`, `url`, or any video-bytes field. Reuse `ssValidatePitch` and `ssCoverThumbUrl`. Export it.
    - _Requirements: 10.2, 10.3, 10.5_

  - [x]* 10.4 Write property test for the edit patch
    - **Property 10: Edit patch only ever touches Mutable_Metadata**
    - **Validates: Requirements 10.2, 10.3**
    - New file `tests/prop-edit-patch.test.js`.

- [x] 11. Checkpoint - pure helpers and schema
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Edge Function changes
  - [x] 12.1 Add Basic tier and public playback policy to `mux-upload-url`
    - In `supabase/functions/_shared/mux.ts › createDirectUpload`, set `new_asset_settings.playback_policy: ["public"]` and `new_asset_settings.video_quality: "basic"`; keep `cors_origin`. Leave the auth gate unchanged so guests are still rejected.
    - _Requirements: 4.4, 6.3, 6.4_

  - [x]* 12.2 Write Deno test for `mux-upload-url`
    - Assert a missing/invalid JWT yields 401 and makes no Mux call; assert the direct-upload body requests `video_quality: "basic"` and `playback_policy: ["public"]`.
    - File `supabase/functions/mux-upload-url/index.test.ts`.
    - _Requirements: 4.4, 6.3, 6.4_

  - [x] 12.3 Add duration backstop and cover-time thumbnail to `mux-webhook`
    - On `video.asset.ready`, compute `durationSec` from `asset.duration`; if `> DURATION_CAP (90)`, DELETE the Mux asset and UPDATE the matching `processing` row to `status='removed'`, set `deleted_at`, and merge `meta.rejected_reason='over_duration_cap'`; ACK 200.
    - Otherwise flip to `live` as today, and when `meta.cover_time` is present build `thumbnail_url` as `image.mux.com/<pid>/thumbnail.jpg?time=<cover_time>`; otherwise keep the default thumbnail. Keep idempotency (only touch rows still `processing`).
    - _Requirements: 4.5, 4.6, 8.2_

  - [x]* 12.4 Write Deno test for `mux-webhook`
    - Assert a `video.asset.ready` with `duration > 90` triggers an asset DELETE and a not-live status; assert a within-cap asset flips to `live` and applies `meta.cover_time` to the thumbnail URL; reuse the existing `verify-signature.test.ts` precedent.
    - File `supabase/functions/mux-webhook/index.test.ts`.
    - _Requirements: 4.5, 4.6, 8.2_

- [x] 13. Checkpoint - Edge Functions
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Upload UI rewrite (`showshak-upload.html`)
  - [x] 14.1 Make the step model data-driven and add file-select validation
    - Drive the progress bar from a `TOTAL_STEPS` count; on file pick, read `file.size` and source duration from a hidden `<video>`'s `loadedmetadata` and call `ssValidateMediaFile`; reject over-cap files with the specific limit message and do not proceed to mint.
    - _Requirements: 4.1, 4.2, 4.3, 4.7_

  - [x] 14.2 Add the Trim step and the client-side trim engine
    - Add in/out controls showing the live segment duration via `ssTrimDuration`; block "proceed" using `ssValidateTrim` when `out <= in` or segment > 90 s; treat an untouched selection as the full source via `ssIsFullSourceTrim`.
    - Implement `ssTrimToBlob(file, inSec, outSec, onProgress)` that lazy-loads `ffmpeg.wasm` from a CDN ESM module (only when the curator actually trims) and stream-copies (`-c copy`) the `[in,out]` segment to a Blob. On engine load failure, surface a clear message and allow publishing the untrimmed source only if it already passes the 90 s cap; otherwise block. Store the applied trim in `meta.trim = {in,out,src}`.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 14.3 Add real titles search, multi-select, and create-if-missing
    - Query the `titles` table (public SELECT) for matches; allow selecting multiple titles; "create new" calls `rpc('find_or_create_title', { p_name, p_year })` (0016) producing a `tmdb_id=null`, `meta.source='curator'` row. Require at least one linked title (`ssCanPublish`). Build links with `ssBuildTitleLinks`.
    - _Requirements: 1.1, 1.2, 1.3, 2.2, 2.3_

  - [x] 14.4 Add the Pitch step UI
    - Bind a character counter to `ssValidatePitch`: no minimum, soft sweet-spot hint, and block publish when over 280; store the pitch in `content.description` on publish.
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 14.5 Wire the Vibes step to `meta.vibes`
    - Keep the 1-3 mood selection and persist the selected moods into `meta.vibes` on the draft/publish row.
    - _Requirements: 3.4_

  - [x] 14.6 Add the Cover frame picker step
    - Let the curator scrub the local trimmed video to choose `coverTime` (default `0` when untouched); store it as `meta.cover_time` at insert. Use `ssCoverThumbUrl` for any preview.
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 14.7 Wire Review & Publish end-to-end
    - On publish: confirm `ssCanPublish`; resolve/create titles; invoke `mux-upload-url` (auth-gated); PUT only the trimmed Blob via the existing `ssPutWithProgress`; insert the `content` row (`status='processing'`, `title_id` = primary, `description`, `meta.vibes`, `meta.cover_time`, `meta.trim`, `meta.mux_upload_id`); insert `content_titles` for all links (trigger derives genres). Implement the fail-closed error handling from the design (RPC failure, mint failure, byte-upload failure, insert failure all retain the draft and mint/insert nothing). Keep linked titles hidden in the upload preview.
    - _Requirements: 1.5, 1.6, 2.2, 3.1, 6.1, 6.3, 6.4_

- [x] 15. Checkpoint - upload flow wired
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Drafts UX (`showshak-upload.html`)
  - [x] 16.1 Implement Save draft
    - Persist current selections as a `content` row with `status='draft'` using `ssDraftToRow` / `ssDraftToLinks` (video/Mux fields only if already uploaded). Owner-private via the 0015 policies.
    - _Requirements: 9.1, 9.2, 9.3, 9.7_

  - [x] 16.2 Implement Resume draft (`?draft=<contentId>`)
    - Load the owner's draft row + `content_titles` and hydrate the `draft` object via `ssRowToDraft`, restoring all steps.
    - _Requirements: 9.2, 9.4_

  - [x] 16.3 Implement Discard draft and Publish draft
    - Discard = soft delete (`deleted_at`, an UPDATE) so it no longer appears. Publish = set `status` → `processing` and run the normal Mux finalize subject to the same validation rules.
    - _Requirements: 9.5, 9.6_

- [x] 17. Edit-after-post UX (`showshak-upload.html`)
  - [x] 17.1 Implement edit mode (`?edit=<contentId>`)
    - Hydrate from the owner's published row; allow editing Pitch / linked Titles / vibes / Cover only. Build the UPDATE with `ssBuildEditPatch` (never writes `mux_*`, `url`, or bytes); re-write `content_titles` on title changes so the trigger re-derives genres; apply the pitch rules and keep titles hidden until Watch It. RLS scopes every write to the owner.
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 18. Multi-title Watch It sheet
  - [x] 18.1 Update the Watch It sheet to render one entry per linked title
    - In the feed/Watch It rendering, fetch the clip's linked titles and use `ssResolveWatchOptionsForTitles` to list each title with its own region-aware providers (curator-platform fallback when a title has none). Keep titles hidden on the clip body until Watch It is activated.
    - _Requirements: 1.4, 2.4, 2.5, 6.1, 6.2_

- [x] 19. Verification
  - [x] 19.1 Add in-browser anon RLS checks
    - Add a re-runnable anon-key check (browser context) asserting a non-owner cannot read another curator's draft, cannot insert/delete another curator's `content_titles`, and cannot UPDATE another curator's clip — confirming the 0014/0015 policies hold under the anon/authenticated role.
    - _Requirements: 6.6, 9.3, 10.1_

- [x] 20. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each task references the specific requirement clauses it satisfies for traceability.
- DB-first ordering: migration 0017 and the ingest enhancement land first because auto-genres depends on them; the founder applies 0017 manually in the Supabase SQL editor and verifies with `data/_verify_upload_v2.js`.
- The ten correctness properties map to ten standalone property-based tests (one property per file, `fast-check`, ≥100 iterations, tagged `Feature: curator-upload-v2, Property <n>`); they target the pure helpers in `showshak-shared.js`.
- Edge-Function configuration and side effects are covered by focused Deno integration tests rather than property tests.
- Checkpoints provide incremental validation between the helper/schema layer, the Edge Functions, the wired upload flow, and the full feature.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1"] },
    { "id": 1, "tasks": ["1.3", "3.1"] },
    { "id": 2, "tasks": ["4.1", "3.2"] },
    { "id": 3, "tasks": ["5.1", "4.2", "4.3"] },
    { "id": 4, "tasks": ["6.1", "5.2"] },
    { "id": 5, "tasks": ["7.1", "6.2"] },
    { "id": 6, "tasks": ["8.1", "7.2"] },
    { "id": 7, "tasks": ["9.1", "8.2"] },
    { "id": 8, "tasks": ["10.1", "9.2"] },
    { "id": 9, "tasks": ["10.3", "10.2"] },
    { "id": 10, "tasks": ["10.4", "12.1", "12.3"] },
    { "id": 11, "tasks": ["12.2", "12.4", "14.1", "18.1"] },
    { "id": 12, "tasks": ["14.2"] },
    { "id": 13, "tasks": ["14.3"] },
    { "id": 14, "tasks": ["14.4"] },
    { "id": 15, "tasks": ["14.5"] },
    { "id": 16, "tasks": ["14.6"] },
    { "id": 17, "tasks": ["14.7"] },
    { "id": 18, "tasks": ["16.1"] },
    { "id": 19, "tasks": ["16.2"] },
    { "id": 20, "tasks": ["16.3"] },
    { "id": 21, "tasks": ["17.1"] },
    { "id": 22, "tasks": ["19.1"] }
  ]
}
```
