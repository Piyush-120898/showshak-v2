# ShowShak Security Launch Gate

Do not expand the public beta until every blocking item below passes. The live
browser is `showshak-web`; this repository owns migrations and Edge Functions.
Migration `0041_security_boundary.sql` was applied to the pre-launch production
project and structurally verified on 2026-07-20.

## Deployment record — 2026-07-20

- Read-only schema preflight passed; all collision counts were zero.
- Migration history was reconciled through `0041`; the final dry run reported
  the remote database was up to date.
- The `0041` structural postflight passed every object, trigger, RLS, grant,
  backfill, and Storage bucket check.
- All six hardened Edge Functions deployed with the required JWT modes and
  passed missing-auth/signature, invalid-payload, and CORS smoke tests.
- Frontend commit `9686e2d` deployed through GitHub/Cloudflare with service
  worker `v101` and feed metadata cache version `2`.
- Two independent public live-boundary smoke passes succeeded.

Authenticated exploit/flow checks, founder AAL2 verification, device/PWA
canaries, and the Cloudflare WAF/monitoring work below remain blocking before
expanding the beta.

## 1. Preflight

- Review migrations `0039`, `0040`, and `0041` independently. Do not run a bulk
  migration push until the founder-owned `0039`/`0040` changes are approved.
- Check for case-insensitive handle collisions before creating the unique index:
  `select lower(username), count(*) from users group by 1 having count(*) > 1;`
- Check duplicate non-null Mux identifiers and resolve them before the asset-map
  backfill: `mux_upload_id` and `mux_asset_id`.
- Verify `avatars` is public with a 5 MiB JPEG/PNG/WebP limit and `review-clips`
  is private with a 300 MiB MP4/WebM/QuickTime limit after staging apply.
- Take a Supabase database backup and record the restore point.

## 2. Staging Apply

- Apply `supabase/migrations/0041_security_boundary.sql` to staging only.
- Configure Edge secrets: `APP_ENV=production`, exact comma-separated
  `APP_ORIGIN`, a random `RATE_SALT`, `MUX_WEBHOOK_SECRET`, Mux credentials,
  TMDB credentials, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
- Leave `ALLOW_ANY_CORS` unset in production. Enable `TRUST_PROXY_XFF` only when
  the function is behind a proxy that overwrites, rather than appends, XFF.
- Deploy the updated upload, delete, Mux webhook, takedown, TMDB, and
  `submit-feedback` functions. Public webhook/legal/guest-feedback endpoints
  need the repository's internal signature/origin/rate checks enabled.

## 3. Mandatory Exploit Tests

- A normal/AAL1 user cannot set `role`, `verified`, `is_admin`, lifecycle fields,
  `is_guest`, Mux identifiers, counters, or publish a clip directly as live.
- A normal user cannot read private `users` columns, another user's own-profile
  RPC, admin aggregates, raw complaints, feedback, rate policies, or asset maps.
- Public profile fields and nested creator projections still load in Feed,
  Discover, Profile, Watchlist, Stack, and Upload.
- AAL1 admin calls fail; the founder's AAL2 session can review applications and
  traction. Enroll and recovery-test founder MFA before enabling the gate.
- Unknown profile keys, forged consent metadata, duplicate-case handles,
  oversized fields, direct limiter calls, malformed webhook signatures,
  non-finite timestamps, foreign Mux deletion, and rate-limit races all fail.
- A fire insert/delete and view insert still update their cached counters, while
  a direct browser counter update fails. View, Watch-It, and share event inserts
  all pass shape checks without cross-table trigger field errors.
- Missing curator terms, a foreign review-clip path, an oversized avatar, a
  non-image avatar, an oversized review clip, and a non-video review upload fail.
- Upload draft, edit, discard, trim, publish, webhook retry, over-duration
  rejection, delete, onboarding, avatar removal, region, handle, feedback, and
  takedown flows all succeed through their approved boundaries.

## 4. Cloudflare Layer

- Add managed WAF rules and bot protection for the app and any proxied API
  routes. Rate-limit feedback, TMDB, upload/delete, and auth bursts by IP; keep
  takedown limits conservative so legal intake remains available.
- Do not treat CORS as authorization. The Supabase project hostname bypasses the
  app's Cloudflare zone; database RLS/triggers and Edge checks remain mandatory.
- Monitor 401/403/413/429/5xx rates, webhook retries, rejected uploads, limiter
  failures, complaint fallback responses, and feedback fallback responses.

## 5. Performance Canary

- Verify Feed cold/warm launch, offline shells, and service-worker `v101` on
  iPhone Safari/PWA, Android Chrome/PWA, and desktop Chrome.
- Confirm no more than two live media players, native HLS behavior, bounded
  loading fallback, readiness-led splash timing, and segment caching off by
  default. Enable segment caching only after persistent byte accounting exists.
- Expand traffic gradually and compare p50/p95 startup, first-frame, API error,
  and playback-stall metrics before and after each rollout step.
