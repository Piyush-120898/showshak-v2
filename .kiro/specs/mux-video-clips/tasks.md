# Implementation Plan: Mux Video Clips

## Overview

This plan turns the design into incremental, test-driven coding steps for ShowShak Step 3 — real short-form video via Mux behind the existing `MediaSurfaceContract`. It stays vanilla JS / HTML / CSS for the app and Deno TypeScript for the two Supabase Edge Functions, with zero frameworks and zero build tools.

Sequencing builds from the data layer outward: additive DB migration → loader Mux fields → `VideoSurface` primitive → CDN include → Edge Functions → preloader pager → real `publish()`. Pure helpers (progress/seek/mute math, signature verification, loader filter/map, factory selection, window-decision math) are extracted as testable units and exercised by Node/Deno property tests (≥100 iterations each), mirroring the existing `data/_verify.js` precedent. UI and integration behavior is covered by a manual verification checklist consistent with the project's manual-in-browser posture.

Founder-only deploy/setup actions (Edge Function deploy, `supabase secrets set`, Mux dashboard webhook config, Mux account) are listed as clearly-marked **MANUAL (founder-only)** tasks — they are not coding tasks and are not executed by the agent.

## Tasks

- [x] 1. Additive DB migration 0012 (content insert RLS + Mux conventions)
  - Create `supabase/migrations/0012_content_insert_and_mux.sql` (additive only, applied directly per `supabase/SCHEMA_CHANGE_PROCESS.md`)
  - `grant insert on table public.content to authenticated;` and `alter table public.content enable row level security;`
  - `create policy content_insert_own on public.content for insert with check (creator_id = auth.uid());` (drop-if-exists first)
  - Document the `mux_upload_id` storage convention in `content.meta jsonb` (matched via `meta->>'mux_upload_id'`) — no new column needed
  - Document the demo/seed tagging convention (`meta.seed = true`) so `RESET_demo_data.sql` continues to wipe demo rows; note the `draft|processing|live|removed` lifecycle is app/Edge-Function-enforced (CHECK constraint deferred as risky/staged)
  - _Requirements: 2.4, 2.5, 2.6, 11.3_

- [x] 2. Clip loader carries Mux fields
  - [x] 2.1 Add Mux columns to `ssLoadClips` select and row→clip mapping
    - In `showshak-shared.js`, extend the `.select(...)` to include `mux_playback_id, url, thumbnail_url, duration_sec`
    - Map `muxPlaybackId` from `row.mux_playback_id || null`, `poster` from `row.thumbnail_url || null`, plus `url` and `durationSec`
    - Keep the existing `.eq("status","live").is("deleted_at",null)` filter unchanged
    - Add an optional `offset` parameter to `ssLoadClips` and switch `.limit(n)` → `.range(offset, offset + n - 1)` (offset defaults to 0 so existing callers keep working)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 9.1_

  - [x] 2.2 Extract a pure loader filter/map helper
    - Add a pure `ssMapContentRowsToClips(rows)` (or equivalent) that takes plain row objects and applies the live/non-deleted filter and the row→clip Mux mapping, with no Supabase/DOM dependency, so it is Node-testable
    - Have `ssLoadClips` delegate its filter/projection to this helper
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 2.3 Carry Mux fields through feed/discover projections
    - In `ssClipsForFeed` and `ssClipsForDiscover`, add `muxPlaybackId: c.muxPlaybackId` and `poster: c.poster` to each re-shaped object so the field survives into `mountInline`
    - _Requirements: 4.2, 10.3_

  - [x]* 2.4 Write property test for loader filter + mapping (Node)
    - **Property 1: Feed loader returns only live, non-deleted clips**
    - **Property 2: Loader maps Mux fields from the correct columns**
    - **Validates: Requirements 2.3, 4.2, 4.3, 4.4, 12.3**
    - Generator-driven, ≥100 iterations over arbitrary `status`/`deleted_at`/`mux_playback_id`/`thumbnail_url` rows; run with `node`, no framework
    - Tag: `Feature: mux-video-clips, Property 1` and `Feature: mux-video-clips, Property 2`

- [x] 3. VideoSurface primitive + pure surface helpers
  - [x] 3.1 Extract pure progress/seek/mute helpers
    - In `showshak-shared.js`, add pure helpers usable without a DOM: `ssClipProgress(currentTime, duration)` (clamp to [0,1], handle 0/undefined/non-finite), `ssSeekToTime(fraction, duration)` (clamp fraction, return target time), and a mute round-trip helper operating on a stub media object `{currentTime, duration, muted}`
    - _Requirements: 5.4, 5.5, 6.4, 6.5_

  - [x] 3.2 Implement VideoSurface over the full MediaSurfaceContract
    - In `showshak-shared.js`, implement `VideoSurface(clip, opts)` wrapping `<mux-player>`: `mount` (create element, set `playback-id`/`stream-type`/`playsinline`/`muted`, poster or gradient background, append, return node), `play`, `pause`, `setMuted`, `isMuted`, `getProgress` (uses 3.1 helper), `seek` (uses 3.1 helper), `onTimeupdate`, `onEnded`, `destroy` (remove listeners + detach node)
    - Loading state: set `poster` to the clip's Mux image-CDN thumbnail when present, else paint `clip.bg` as the mount-point background
    - Player `error` → keep poster visible and synthesize an `ended` after a short grace so the engine advances
    - _Requirements: 5.1, 5.4, 5.5, 5.6, 5.7, 5.8, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 12.4_

  - [x] 3.3 Wire VideoSurface into ssCreateSurface
    - Implement the existing `ssCreateSurface(clip, opts)` branch to return `VideoSurface(clip, opts)` when `clip.muxPlaybackId` is truthy, else `GradientSurface(clip, opts)`; engine stays contract-only with no new branching
    - _Requirements: 5.2, 5.3, 5.9, 10.1, 10.2, 10.3_

  - [x]* 3.4 Write property tests for surface math + factory (Node)
    - **Property 3: Surface factory selects video iff a playback id is present**
    - **Property 4: getProgress is always a fraction in [0,1]**
    - **Property 5: seek and getProgress round-trip**
    - **Property 6: Muted state round-trips through the player**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 6.4, 6.5, 10.1**
    - ≥100 iterations each over a stubbed media object `{currentTime, duration, muted}` and plain clip objects; run with `node`, no framework
    - Tags: `Feature: mux-video-clips, Property 3..6`

- [x] 4. Load mux-player via CDN on feed-bearing pages
  - Add `<script src="https://cdn.jsdelivr.net/npm/@mux/mux-player"></script>` (version-pinned for production) alongside existing CDN includes on `showshak-feed.html`, `showshak-discover.html`, `showshak-watchlist.html`, and `showshak-profile.html` (any page that can open the fullscreen clip viewer)
  - _Requirements: 6.1_

- [x] 5. Checkpoint - loader + surface render real video
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Supabase Edge Functions (Deno)
  - [x] 6.1 Create shared function helpers
    - Create `supabase/functions/_shared/cors.ts` (CORS headers allowing the app origin) and `supabase/functions/_shared/mux.ts` (Mux REST Basic-auth helpers reading credentials from function secrets)
    - _Requirements: 1.2_

  - [ ] 6.2 Implement mux-upload-url function (auth-gated mint)
    - Create `supabase/functions/mux-upload-url/index.ts`: handle OPTIONS/CORS; resolve the caller via a Supabase client bound to the `Authorization` bearer token; return `401` and mint nothing when there is no authenticated user
    - Mint via Mux `POST /video/uploads` using Basic auth from `MUX_TOKEN_ID`/`MUX_TOKEN_SECRET` (read only from function secrets); body sets `new_asset_settings.playback_policy=["public"]` and `cors_origin=APP_ORIGIN`
    - Return only `{ uploadUrl, uploadId }`; never serialize the Mux secret
    - _Requirements: 1.1, 1.2, 1.3, 11.3_

  - [x] 6.3 Extract verifyMuxSignature pure helper
    - In `supabase/functions/_shared/mux.ts` (or a dedicated module), implement `verifyMuxSignature(raw, header, secret)` as a pure async function: parse `t`/`v1`, reject stale timestamps (5-min tolerance), recompute `HMAC-SHA256(secret, "<ts>.<raw>")` via `crypto.subtle`, constant-time compare; importable by the test harness
    - _Requirements: 3.3_

  - [x] 6.4 Implement mux-webhook function (verify + idempotent flip)
    - Create `supabase/functions/mux-webhook/index.ts`: read the raw body, call `verifyMuxSignature`; on failure return `401` and modify nothing
    - Handle only `type === "video.asset.ready"`; resolve the content row by `meta->>'mux_upload_id'` (fallback `mux_asset_id`); if no match return `200` and modify nothing
    - Idempotent flip with a service-role client: `update({status:'live', mux_asset_id, mux_playback_id, thumbnail_url, duration_sec})` guarded by `.eq('status','processing')` so duplicate ready events leave a live row unchanged; return `200` with updated count
    - Service-role key stays server-side only
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6_

  - [x]* 6.5 Write property tests for webhook helpers (Deno)
    - **Property 7: Webhook signature verification accepts only authentic events**
    - **Property 8: Webhook status flip is idempotent** (test the pure flip-decision helper over an in-memory row, applying it ≥2 times)
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5**
    - ≥100 iterations each; sign-then-verify round-trips plus mutated body/timestamp/signature failures; run locally with Deno, no framework
    - Tags: `Feature: mux-video-clips, Property 7` and `Feature: mux-video-clips, Property 8`

- [x] 7. Windowed + sliding-window preloader (feed-level pager)
  - [x] 7.1 Extract pure window-decision helpers
    - In `showshak-shared.js`, add pure helpers: `ssShouldFetchNextWindow(activeIdx, windowStart, totalLoaded, inFlight)` (true once `activeIdx >= windowStart + 6` and another page may exist, never more than once per window) and `ssMountedPlayerSet(activeIdx, totalLoaded, maxLive)` (returns the bounded band of indices to keep mounted, size ≤ `SS_MAX_LIVE_PLAYERS`)
    - Define constants `SS_CLIP_WINDOW = 10`, `SS_PRELOAD_AHEAD = 2`, `SS_MAX_LIVE_PLAYERS = 4`
    - _Requirements: 9.1, 9.3, 9.5_

  - [x] 7.2 Add additive append/prune entry points to the engine
    - Extend `ClipEngine`/`mountInline` with an "append clips" entry point that reuses the exact per-clip wiring in the existing `forEach` (DOM frame + surface + progress bar + gestures), and a "prune offscreen surfaces" step that `destroy()`s players outside the mounted band — contract-only, no engine branching on surface type
    - _Requirements: 9.4, 9.5_

  - [x] 7.3 Implement the feed pager and wire it into feed init
    - Add `ssLoadClipWindow(offset)` (calls `ssLoadClips(SS_CLIP_WINDOW, offset)` then `ssClipsForFeed`) and `loadNextWindow()` (guarded by an in-flight flag) near `ssLoadClips`
    - In `showshak-feed.html` init, load the initial window of ~10; set `preload="auto"` for the active clip + look-ahead band and `preload="none"` outside it; use the existing IntersectionObserver active index to trigger `loadNextWindow()` at `windowStart + 6` and to drive prune/re-mount per the mounted band
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x]* 7.4 Write property tests for window math (Node)
    - **Property 9: Next window is fetched exactly once at the threshold**
    - **Property 10: Concurrent mounted players are bounded**
    - **Validates: Requirements 9.3, 9.5**
    - ≥100 iterations each over arbitrary active index / window start / total loaded; run with `node`, no framework
    - Tags: `Feature: mux-video-clips, Property 9` and `Feature: mux-video-clips, Property 10`

- [x] 8. Checkpoint - preloader + edge functions integrated
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Real upload publish() in showshak-upload.html
  - [x] 9.1 Add direct-upload-with-progress helper
    - Implement `ssPutWithProgress(uploadUrl, file, onProgress)` using `XMLHttpRequest` (`upload.onprogress` → `e.loaded / e.total`); resolves on success, rejects on failure; bytes go browser→Mux only
    - Retain `draft.file` alongside `draft.videoUrl` so the file object is available at publish; `upHandleFile` keeps the local `URL.createObjectURL` preview (no upload yet)
    - _Requirements: 1.4, 1.5_

  - [x] 9.2 Implement real publish()
    - Auth guard: require `ssCurrentUser()`; funnel guests to sign-in and mint nothing (Req 11.3)
    - Mint: `POST` to `mux-upload-url` with the curator's access token; on non-OK/unreachable, toast and abort with no row (Req 12.1/12.5)
    - Upload: `ssPutWithProgress(...)` driving the publish progress UI; on failure toast and abort (Req 12.1)
    - Insert: after bytes land, `INSERT` into `content` via `window.ssDB` (anon key + JWT so RLS passes) with `{creator_id, title_id, platform_id, description, status:'processing', meta:{ mux_upload_id, vibes, lang, season, bg }}`; on error toast and do not show success (Req 12.5)
    - _Requirements: 1.4, 1.5, 2.1, 2.5, 11.3, 12.1, 12.5_

  - [x] 9.3 Processing-success UX + My Clips processing badge
    - Show the processing success screen ("processing — goes live automatically once Mux finishes"); render a *Processing* badge for `status='processing'` rows in the profile "My Clips" tab so the curator sees it is still working while the feed continues to exclude it
    - _Requirements: 2.2, 2.3, 12.2_

- [x] 10. Final checkpoint - full pipeline wired
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Manual / integration verification (no code; checklist)
  - [ ]* 11.1 Full upload→process→live pipeline (integration)
    - Upload a real file, watch progress, confirm a `processing` row appears and is excluded from the feed, then confirm the webhook flips it to `live` with a playback id and it appears in the feed
    - _Requirements: 1.4, 1.5, 2.1, 2.3, 3.1, 3.2_

  - [ ]* 11.2 Surface parity + continuous loop (manual-in-browser)
    - Mixed video + gradient feed loops continuously; tap/double-tap, mute toggle, progress bar, and the Fire/Save/Share/Watch It rail behave identically across both surface types; no show title on the clip body; single-tap opens fullscreen
    - _Requirements: 5.9, 8.1, 8.2, 8.3, 8.4, 8.5, 10.2, 10.3, 11.4_

  - [ ]* 11.3 Auth gating (manual-in-browser)
    - Guest cannot reach the upload mint and cannot insert a row; guest can still watch live clips inline; sign-in funnel triggers on gated actions
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ]* 11.4 Poster / fallback (manual-in-browser)
    - A clip with a thumbnail shows the Mux poster; a clip without one shows the gradient loading state; a player that fails to load keeps the poster and the engine advances
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 12.4_

  - [ ]* 11.5 Edge cases (manual-in-browser / integration)
    - Kill network mid-upload (no published state, no orphan row); point at an unreachable function (clean abort, no corruption); forged webhook signature rejected with no change; duplicate ready event is a no-op; removed clip excluded from feed
    - _Requirements: 3.3, 3.4, 3.5, 12.1, 12.3, 12.5_

- [ ] 12. MANUAL (founder-only) — deploy & external setup (no code)
  - [ ]* 12.1 Mux account + dashboard webhook config
    - Create/confirm the Mux account; in the Mux dashboard add the webhook URL (`…/functions/v1/mux-webhook`) and copy its signing secret
    - _Requirements: 3.3_

  - [ ]* 12.2 Deploy Edge Functions
    - `supabase functions deploy mux-upload-url`; `supabase functions deploy mux-webhook --no-verify-jwt`
    - _Requirements: 1.1, 3.1_

  - [ ]* 12.3 Set function secrets
    - `supabase secrets set MUX_TOKEN_ID=... MUX_TOKEN_SECRET=... MUX_WEBHOOK_SECRET=... APP_ORIGIN=https://<app>` (and confirm runtime-injected `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`)
    - _Requirements: 1.2, 3.6_

  - [ ]* 12.4 Apply migration 0012
    - Apply `0012_content_insert_and_mux.sql` directly to the database per `SCHEMA_CHANGE_PROCESS.md` (additive/SAFE)
    - _Requirements: 2.4, 2.5_

## Notes

- Tasks marked with `*` are optional/non-core: property tests, the manual/integration checklist (Section 11), and founder-only deploy/setup (Section 12). Core implementation tasks are never marked optional.
- All app code stays vanilla JS / HTML / CSS; Edge Functions are Deno TypeScript. No frameworks, no build tools, no test framework added to the shipped app — property tests run with `node`/Deno following the `data/_verify.js` precedent.
- Each property test references its design Correctness Property number and is tagged `Feature: mux-video-clips, Property {n}` with ≥100 generated iterations.
- The DB change is additive-direct; no risky/destructive migration is required. The `status` CHECK constraint is intentionally deferred (risky on a populated table) per the schema process doc.
- Section 12 tasks are operational, not coding tasks; they are included for completeness and clearly marked MANUAL (founder-only).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2.1", "3.1", "6.1", "6.3", "7.1"] },
    { "id": 1, "tasks": ["2.2", "2.3", "3.2", "6.2", "6.4"] },
    { "id": 2, "tasks": ["2.4", "3.3", "6.5", "7.2"] },
    { "id": 3, "tasks": ["3.4", "4", "7.3", "9.1"] },
    { "id": 4, "tasks": ["7.4", "9.2"] },
    { "id": 5, "tasks": ["9.3"] },
    { "id": 6, "tasks": ["11.1", "11.2", "11.3", "11.4", "11.5", "12.1", "12.2", "12.3", "12.4"] }
  ]
}
```
