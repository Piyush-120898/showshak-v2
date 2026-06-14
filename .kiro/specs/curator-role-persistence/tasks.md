# Implementation Plan: Curator Role Persistence

## Overview

This plan persists a user's curator status to `public.users.role` along the two paths
that should make someone a curator: completing onboarding (client write) and publishing a
clip (DB trigger), plus a one-time backfill for accounts that already posted.

Sequencing puts the pure, property-tested unit first (`ssBuildOnboardingPatch` in
`showshak-shared.js`), then the impure `bcActivate()` rewrite that consumes it, then the
routing hardening, then the authored SQL artifacts.

Conventions (ShowShak): pure HTML/CSS/vanilla JS, no build step. Pure logic lives in
`showshak-shared.js` and is exported via the consolidated `module.exports` block for Node
tests. Profile orchestration logic stays inline in `showshak-profile.html`. Tests are
plain Node + fast-check under `tests/`, named `prop-*.test.js`, and `require('./_pbt.js')`
then call `installDomStub()` **before** requiring `showshak-shared.js`.

**Migration model:** migrations are authored as SQL files by the coding agent but
**APPLIED MANUALLY by the founder** in the Supabase SQL editor. Authoring the SQL is an
agent coding task; applying/running/verifying it is a clearly-marked **FOUNDER-RUN** task.

## Tasks

- [x] 1. Add the pure onboarding patch builder to shared logic
  - [x] 1.1 Implement `ssBuildOnboardingPatch(input)` in `showshak-shared.js`
    - Add the pure helper near `ssBuildEditPatch` (no DOM, no network, never throws)
    - Contract: `input = { handle?, bio?, genres?, avatarUrl? }` → allowlisted patch
    - `patch.role` is **always** `'curator'` for every input (including `{}`/null/undefined)
    - Include `username` only when `handle.trim()` (with a single leading `@` stripped) is non-empty; store the trimmed, `@`-free value
    - Include `bio` only when `bio.trim()` is non-empty; store the trimmed value
    - Include `genres` only when it is an array of length 1–6; store a copy
    - Include `avatar_url` only when `avatarUrl` is a non-empty string
    - Never emit a key with an empty/blank value (no overwrite-with-empty)
    - Patch keys are confined to the allowlist `{role, username, bio, genres, avatar_url}`
    - Expose on `window.ssBuildOnboardingPatch` and add to the consolidated `module.exports` block (alongside `ssBuildEditPatch`)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 7.2, 7.3, 9.2_

  - [x]* 1.2 Write property tests for `ssBuildOnboardingPatch`
    - New file `tests/prop-onboarding-patch.test.js`; `require('./_pbt.js')`, `installDomStub()`, then `require('../showshak-shared.js')`; `{ numRuns: ITER }` (≥100)
    - Generators: optional/blank/whitespace `handle` and `bio`; handles with and without a leading `@`; genre arrays of length 0–8 (exercise the 1–6 bound); `avatarUrl` from non-empty strings, `''`, `null`, `undefined`
    - Include 2–3 concrete examples (all fields, bio-only, nothing-entered)
    - **Property 1: Onboarding patch always persists the curator role** (`// Feature: curator-role-persistence, Property 1: ...`) — **Validates: Requirements 1.1, 9.2**
    - **Property 2: Onboarding patch omits empty identity fields and never overwrites with blanks** — **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6**
    - **Property 3: Onboarding patch keys are confined to the self-update allowlist** — **Validates: Requirements 1.1, 7.2, 7.3**
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 7.2, 7.3, 9.2_

- [ ] 2. Checkpoint — pure helper is green
  - Run `npm test` and ensure all tests pass (including the new `prop-onboarding-patch` file). Ask the user if questions arise.

- [x] 3. Persist role + identity on onboarding completion — rewrite `bcActivate()`
  - [x] 3.1 Rewrite `bcActivate()` in `showshak-profile.html` to be `async` and persist before flipping the face
    - Collect handle, bio, genres, and chosen photo from the onboarding fields
    - When a new data-URL photo was chosen, upload it to the `avatars` Storage bucket mirroring `saveEditProfile()` (same path/contentType); on upload error surface it and leave `avatarUrl` undefined (do NOT block role persistence — R1.6)
    - Build the patch via `ssBuildOnboardingPatch({ handle, bio, genres, avatarUrl })`
    - Persist with `window.ssDB.from('users').update(patch).eq('id', user.id)` — scope strictly to `auth.uid()` (R1.7, R9.3)
    - Wrap in `try/catch`: on a returned `error` or thrown exception, `console.error`, show a failure toast ("Couldn't activate curator — please try again"), keep the modal open, do NOT set `face = 'owner'`, and return — leaving the page interactive for a re-attempt (R2.1, R2.2)
    - On success only: apply identity to in-memory `PROFILE`, `closeBecomeCurator()`, set `face = 'owner'` + `activeTab = 'create'`, re-render, and show the welcome success toast (R1.8, R2.3)
    - Re-running onboarding while already a curator sends `role: 'curator'` again — a DB no-op, no demotion, no error surfaced (R9.2, R9.4)
    - Preserve the no-backend demo fallback (no `user`/`ssDB`) so the prototype keeps working
    - `bcActivate` is the ONLY role-writing client path; the Preview toggle/`setFace` issue no `users` write (R7.2, R7.3)
    - _Requirements: 1.1, 1.7, 1.8, 2.1, 2.2, 2.3, 7.2, 7.3, 9.2, 9.3, 9.4_

- [x] 4. Harden own-profile routing by persisted role
  - [x] 4.1 Confirm/harden `hydrateOwnProfile()` + boot sequence in `showshak-profile.html`
    - Confirm the persisted `role` read (`select … role … where id = auth.uid()`) is the single source of truth for the own-profile face: `'curator'` → owner face, `'user'` → user face (R6.1, R6.2, R7.1)
    - Ensure the boot IIFE `await`s `hydrateOwnProfile()` before the first `renderAll()` so no resolved user-face flashes before the role read completes for a known signed-in user (R6.5)
    - Confirm reload after onboarding lands on the owner face purely from persisted `role` (R6.3) and a curator never renders the user face (R6.4)
    - Keep the role read inside `try/catch`; on failure keep the existing demo fallback and never promote a non-curator to the owner face (owner face set only inside the `role === 'curator'` branch) (R6.6)
    - Confirm the Preview toggle/`setFace` only re-renders and never writes role, so a reload reflects persisted `role`, not the prior toggle selection (R7.4, R7.5)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.4, 7.5_

- [x] 5. Author the publish-time promotion migration
  - [x] 5.1 Create `supabase/migrations/0020_promote_curator_on_post.sql`
    - Author the full `security definer` function `public.promote_curator_on_post()` with `set search_path = public`, mirroring the `handle_new_user` pattern in `0003` (R3.3)
    - `update public.users set role = 'curator' where id = new.creator_id and role is distinct from 'curator'` — promotes the author, no-op for existing curators, never sets `'user'` (R3.2, R3.4, R3.5)
    - `return new` so the content insert always persists even when no author row matches (R4.2, R4.4, R9.1)
    - `drop trigger if exists on_content_promote_curator on public.content;` then `create trigger … after insert on public.content for each row execute function public.promote_curator_on_post();` (R3.1, R4.1, R4.3)
    - Use `create or replace function` + `drop trigger if exists` so re-applying yields identical definitions and drops/renames/retypes/constrains nothing (R3.6); end with `notify pgrst, 'reload schema';`
    - **NOTE:** authoring this file is the agent task; **applying it is a FOUNDER-RUN step** (see task 8)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 9.1_

- [x] 6. Author the one-time backfill + reversal SQL
  - [x] 6.1 Append the idempotent backfill and documented reversal to `supabase/migrations/0020_promote_curator_on_post.sql` as a commented, run-once block
    - Backfill: `update public.users u set role = 'curator' where u.role = 'user' and exists (select 1 from public.content c where c.creator_id = u.id and c.status = 'live' and c.deleted_at is null)` — selection is the account's own live, non-deleted clip; `role = 'user'` guard makes it idempotent and leaves curators untouched; only ever sets `'curator'` (R5.1, R5.2, R5.3, R5.4, R5.6, R9.4)
    - Reversal (documented, run only to undo): same selection but `set role = 'user' where u.role = 'curator' and exists (… same live, non-deleted clip …)`, altering no other row (R5.5)
    - **NOTE:** authoring this SQL is the agent task; **running the backfill/reversal is a FOUNDER-RUN step** (see task 8)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 9.4_

  - [ ]* 6.2 Add an anon-key integration check for public-profile consistency
    - New Node script under `data/` (mirroring the existing `_verify*.js` verifiers), anon key only, reading `users`/`content` via the already-granted public read path (no new grant/policy)
    - Assert that an account whose persisted `role = 'curator'` resolves as an eligible curator on its public profile by username directly from persisted `role`, not merely via the live-clip fallback
    - _Requirements: 8.1, 8.2, 8.3_

- [ ] 7. Checkpoint — all code + authored SQL complete
  - Run `npm test` and ensure all tests pass; confirm `0020_promote_curator_on_post.sql` and the backfill/reversal block are authored. Ask the user if questions arise.

---

## FOUNDER-RUN tasks (NOT for the coding agent)

> The following are **manual founder steps** performed in the Supabase SQL editor and the
> browser. The coding agent MUST NOT attempt to apply migrations, run SQL, or run the app
> end-to-end. These are listed for the founder's checklist and are intentionally excluded
> from the Task Dependency Graph.

- [ ] 8. FOUNDER-RUN — apply, backfill, and verify
  - **8.1 Apply the migration:** paste `0020_promote_curator_on_post.sql` into the Supabase SQL editor and run it.
  - **8.2 Run the backfill:** execute the commented run-once backfill `UPDATE`.
  - **8.3 SQL-verify the trigger (R3, R4, R9.1):**
    - Insert a `content` row for a `role = 'user'` account → that author becomes `'curator'`; no other `users` row changed.
    - Insert another clip for that (now curator) account → role stays `'curator'` (no-op, R3.4).
    - Insert with a `creator_id` having no `users` row (service-role) → insert persists, zero `users` updates (R4.2).
    - Confirm no path ever sets `'user'` (R3.5).
    - Re-run the whole `0020` file → completes without error; `pg_get_functiondef`/`pg_get_triggerdef` unchanged (R3.6).
  - **8.4 SQL-verify the backfill (R5):**
    - After backfill, every account with a live, non-deleted clip and `role = 'user'` is now `'curator'`; accounts with no qualifying clip are unchanged (R5.1, R5.6).
    - Re-run the backfill → zero rows changed (idempotent, R5.4); existing curators untouched (R5.2).
    - Run the documented reversal → matching accounts return to `'user'`, no other row altered (R5.5).
  - **8.5 In-browser verify (R1, R2, R6):**
    - Complete curator onboarding → role persists and survives a reload (own profile lands on the owner face from persisted role).
    - Force an update error (e.g. offline) → failure toast shown, modal stays open, no face flip.
    - Confirm a curator account always lands on the owner profile and the Preview toggle never changes persisted role across reloads.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Each task references specific requirement sub-clauses for traceability.
- Property tests (task 1.2) validate the universal behavior of the pure patch builder; the trigger/backfill are declarative SQL with no Node-testable surface and are verified by the FOUNDER-RUN SQL checks (task 8).
- Sequencing lands the pure, testable `ssBuildOnboardingPatch` before the `bcActivate()` rewrite that consumes it.
- Authoring SQL files is a coding task (tasks 5, 6); applying/running/verifying SQL is a FOUNDER-RUN task (task 8) per ShowShak's manual migration model.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "5.1"] },
    { "id": 1, "tasks": ["1.2", "3.1", "6.1", "6.2"] },
    { "id": 2, "tasks": ["4.1"] }
  ]
}
```
