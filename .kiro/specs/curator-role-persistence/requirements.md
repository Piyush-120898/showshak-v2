# Requirements Document

## Introduction

**Curator role persistence** fixes a root data-integrity defect in ShowShak: a user's curator status is never written to the database. Today the "Become a Curator" onboarding in `showshak-profile.html` (`bcActivate`) only flips an in-memory JavaScript variable (`face = 'owner'`) and mutates the local `PROFILE` object — it never persists `users.role`, nor the handle, bio, specialties, or photo the user chose during onboarding. Publishing a clip in `showshak-upload.html` inserts a `content` row with `creator_id = auth.uid()` but never promotes the author's role. As a result, verified against the live database, every real human account that has posted live clips (e.g. `gpiyush791` with 4 live clips, `media_mike` with 3, `piyush791`, `simran`) still carries `role = 'user'`; only seeded demo curators carry `role = 'curator'`.

This defect broke the already-shipped `public-curator-profile` feature, which gates eligibility on `role = 'curator'`. A band-aid (resolve as curator if `role = 'curator'` OR the account has live clips) was added, but the founder wants the root cause fixed: curator status must be correctly persisted in the database so it survives reload, is visible to everyone, and satisfies the public profile's role gate directly.

The founder's product model is the social-platform convention "you post, you're a creator": completing onboarding makes someone a curator, and publishing a clip is itself an act of being a curator. Both paths MUST persist `role = 'curator'`. The clip-publish promotion is strongly preferred at the database level (a trigger on `content` insert, mirroring the existing signup trigger in `0003_auth_user_trigger.sql`) so the client can never skip it. A one-time backfill (founder-approved) promotes existing real accounts that already posted clips. Once a user is a curator, their profile is always the curator (owner) face — there is no user-face profile for a curator. The "Preview as user/owner/public" toggle in the profile hero is dev scaffolding and MUST NOT be the source of truth for curator status.

### Data-layer facts already verified (do NOT re-fix)

- **Public reads already work.** `0003` grants `select` on `users` to `anon`/`authenticated` with policy `users_read` (`deleted_at is null`); `0002` grants public reads of live `content`. A guest can already look up a curator by username and read their live clips. **No new read grants or RLS read policies are required.**
- **Self-update is already permitted by RLS.** `users_update_own` (`id = auth.uid()`) and `users_insert_own` (`id = auth.uid()`) exist. A signed-in user CAN update their own `users` row — including `role` — under existing policy. **No new write policy is required for self-promotion.**
- **Migrations are applied manually by the founder** in the Supabase SQL editor. The deliverable for any database change is the **authored** migration SQL; applying it is a founder-run step.

## Glossary

- **System**: The ShowShak application as a whole, spanning the browser client and the Supabase backend.
- **Onboarding_Flow**: The "Become a Curator" client flow in `showshak-profile.html` whose completion handler is the `bcActivate` function.
- **Profile_Client**: The client code in `showshak-profile.html`, including `bcActivate`, `hydrateOwnProfile`, and the face-routing logic.
- **Upload_Client**: The clip-publish client code in `showshak-upload.html` that inserts a `content` row with `creator_id = auth.uid()`.
- **Users_Row**: A row in the `public.users` table, keyed by `id` equal to the authenticated user id, carrying `role` (`'user' | 'curator'`, default `'user'`), `username`, `name`, `bio`, `genres`, `avatar_url`, and `deleted_at`.
- **Content_Row**: A row in the `public.content` table representing a clip, carrying `creator_id`, `status` (`draft | processing | live | removed`), and `deleted_at`.
- **Curator_Role**: The value `'curator'` stored in `Users_Row.role`.
- **User_Role**: The value `'user'` stored in `Users_Row.role`.
- **Acting_User**: The currently authenticated user, identified by `auth.uid()`, whose own `Users_Row` is the only row the client may update under `users_update_own`.
- **Guest**: An unauthenticated visitor for whom `auth.uid()` is null.
- **Promotion_Trigger**: A new database trigger (authored in a new migration, security-definer, mirroring `handle_new_user` in `0003`) that fires on `content` insert and sets the author's `Users_Row.role` to `Curator_Role`.
- **Backfill_Statement**: A one-time, founder-run SQL `UPDATE` that promotes existing `Users_Row` records to `Curator_Role` where the account has at least one qualifying live `Content_Row`.
- **Owner_Face**: The curator's own profile view (`face = 'owner'`), the private curator dashboard for the signed-in curator viewing their own profile.
- **User_Face**: The normal-user own-profile view (`face = 'user'`).
- **Public_Face**: The public curator profile view (`face = 'public'`) shown to anyone viewing a curator other than themselves; owned by the `public-curator-profile` feature.
- **Preview_Toggle**: The "Preview as" user/owner/public switcher in the profile hero (`setFace`), dev scaffolding slated for removal.
- **Public_Curator_Profile_Feature**: The already-shipped `public-curator-profile` spec/feature whose eligibility gate is satisfied once `role` is persisted.

## Requirements

### Requirement 1: Persist curator role and identity on onboarding completion

**User Story:** As a user completing curator onboarding, I want my curator status and chosen identity saved to the database, so that I remain a curator after reload and other people see the real me.

#### Acceptance Criteria

1. WHEN the Acting_User completes the Onboarding_Flow, THE Profile_Client SHALL update the Acting_User's Users_Row in a single update operation that sets `role` to `Curator_Role` together with the provided identity fields.
2. WHEN the Acting_User completes the Onboarding_Flow AND a handle value that is non-empty after trimming surrounding whitespace was entered, THE Profile_Client SHALL persist that handle, excluding any display-only leading `@`, to the Acting_User's Users_Row `username` field.
3. WHEN the Acting_User completes the Onboarding_Flow AND a bio value that is non-empty after trimming surrounding whitespace was entered, THE Profile_Client SHALL persist that bio to the Acting_User's Users_Row `bio` field.
4. WHEN the Acting_User completes the Onboarding_Flow AND one to six specialties/genres were selected, THE Profile_Client SHALL persist those values to the Acting_User's Users_Row `genres` field.
5. WHEN the Acting_User completes the Onboarding_Flow AND a profile photo was chosen, THE Profile_Client SHALL persist that photo reference to the Acting_User's Users_Row `avatar_url` field.
6. WHERE an identity field (handle, bio, genres, or photo) has no provided value at completion of the Onboarding_Flow, THE Profile_Client SHALL leave that Users_Row field unchanged AND SHALL NOT overwrite it with an empty value.
7. THE Profile_Client SHALL scope the Users_Row update to the Acting_User by writing only the row WHERE `id` equals `auth.uid()`.
8. WHEN the Users_Row update completes without a returned error, THE Profile_Client SHALL set the in-memory profile state to the Owner_Face consistent with the persisted Curator_Role.

### Requirement 2: Surface onboarding persistence failures

**User Story:** As a user completing curator onboarding, I want to be told if my curator status failed to save, so that I do not believe I am a curator when the database still says otherwise.

#### Acceptance Criteria

1. IF the Users_Row update during the Onboarding_Flow returns an error, THEN THE Profile_Client SHALL display to the Acting_User an error indication stating that curator activation was not saved, AND SHALL NOT present the persistence as successful, AND SHALL NOT transition the Acting_User's in-memory profile state to the Owner_Face.
2. IF the Users_Row update during the Onboarding_Flow returns an error OR the update call raises an exception, THEN THE Profile_Client SHALL handle that outcome without propagating an unhandled error AND SHALL leave the profile page interactive so the Acting_User can re-attempt the Onboarding_Flow.
3. WHEN the Users_Row update during the Onboarding_Flow completes without a returned error AND without a raised exception, THE Profile_Client SHALL display a success indication confirming the Acting_User's curator activation.

### Requirement 3: Promote role at the database level on clip publish

**User Story:** As the founder, I want anyone who publishes a clip to become a curator in the database automatically, so that the "you post, you're a creator" rule can never be skipped by the client.

#### Acceptance Criteria

1. THE System SHALL provide a Promotion_Trigger authored as a new additive migration that fires AFTER INSERT on the `content` table, FOR EACH inserted row.
2. WHEN a Content_Row is inserted with a `creator_id` whose Users_Row has `role` equal to User_Role, THE Promotion_Trigger SHALL set that Users_Row `role` to Curator_Role.
3. THE Promotion_Trigger SHALL be defined as a security-definer function with `search_path` set to the schema containing `public.users` (i.e. `public`), mirroring the `handle_new_user` pattern in `0003_auth_user_trigger.sql`.
4. WHEN a Content_Row is inserted with a `creator_id` whose Users_Row already has `role` equal to Curator_Role, THE Promotion_Trigger SHALL leave that Users_Row `role` unchanged.
5. THE Promotion_Trigger SHALL NOT set any Users_Row `role` to User_Role.
6. THE Promotion_Trigger migration SHALL be authored as additive SQL that drops-and-recreates its own function and trigger, such that re-applying the migration completes without error and yields identical function and trigger definitions, AND SHALL NOT drop, rename, retype, or constrain any existing table or column.

### Requirement 4: Promotion trigger isolation and stability

**User Story:** As the founder, I want the publish-time promotion to be safe, so that it never demotes a curator, loops, or interferes with the clip insert.

#### Acceptance Criteria

1. WHEN a Content_Row insert triggers the Promotion_Trigger, THE Promotion_Trigger SHALL execute exactly once for that inserted row, perform at most one Users_Row update, and write zero rows to the `content` table.
2. IF a Content_Row is inserted with a `creator_id` that has no matching Users_Row, THEN THE Promotion_Trigger SHALL modify zero Users_Rows AND the Content_Row SHALL be persisted without an aborting error.
3. THE Promotion_Trigger SHALL modify at most one Users_Row — the one whose `id` equals the inserted Content_Row `creator_id` — AND SHALL NOT modify any other Users_Row or any Content_Row.
4. WHEN the Promotion_Trigger runs for an inserted Content_Row, THE Content_Row SHALL be persisted regardless of the promotion outcome.

### Requirement 5: One-time backfill of existing curators

**User Story:** As the founder, I want my existing test accounts that already posted clips to be recognized as curators immediately, so that they work without re-running onboarding.

#### Acceptance Criteria

1. THE System SHALL provide a Backfill_Statement authored as founder-run SQL that sets `role` to Curator_Role for every Users_Row that has at least one Content_Row whose `creator_id` equals that Users_Row `id`, whose `status` equals `live`, and whose `deleted_at` is null.
2. THE Backfill_Statement SHALL leave unchanged any Users_Row that already has `role` equal to Curator_Role.
3. THE Backfill_Statement SHALL NOT set any Users_Row `role` to User_Role.
4. THE Backfill_Statement SHALL set `role` to Curator_Role only for Users_Row whose current `role` equals User_Role, so that re-running the statement produces the same end state as running it once.
5. THE Backfill_Statement SHALL document a reversal statement that sets `role` to User_Role for every Users_Row matching the same selection criteria used by the Backfill_Statement (at least one Content_Row with `creator_id` equal to that Users_Row `id`, `status` equal to `live`, and `deleted_at` null), AND SHALL NOT alter any other Users_Row.
6. THE Backfill_Statement SHALL leave `role` unchanged for any Users_Row that has no Content_Row whose `creator_id` equals that Users_Row `id`, whose `status` equals `live`, and whose `deleted_at` is null.

### Requirement 6: Route a curator's own profile to the owner face

**User Story:** As a curator, I want opening my own profile to always show my curator dashboard, so that I never land on a user-face profile that is no longer mine.

#### Acceptance Criteria

1. WHEN the Acting_User opens their own profile AND their persisted Users_Row `role` (read WHERE `id` equals `auth.uid()`) equals Curator_Role, THE Profile_Client SHALL render the Owner_Face.
2. WHEN the Acting_User opens their own profile AND their persisted Users_Row `role` (read WHERE `id` equals `auth.uid()`) equals User_Role, THE Profile_Client SHALL render the User_Face.
3. WHEN the Acting_User whose persisted Users_Row `role` equals Curator_Role reloads their own profile after completing the Onboarding_Flow, THE Profile_Client SHALL render the Owner_Face from the persisted role.
4. WHILE the Acting_User's persisted Users_Row `role` equals Curator_Role, THE Profile_Client SHALL NOT render the User_Face for the Acting_User's own profile.
5. WHILE the persisted-role read for the Acting_User's own profile has not yet completed, THE Profile_Client SHALL NOT present the User_Face as the resolved own-profile face for a user whose persisted role is not yet known.
6. IF the persisted-role read for the Acting_User's own profile fails, THEN THE Profile_Client SHALL handle the failure without an unhandled error AND SHALL NOT incorrectly render the Owner_Face for a non-curator.

### Requirement 7: Preview toggle must not drive curator state

**User Story:** As the founder, I want the dev preview switcher to never decide who is a curator, so that real behavior is governed by authentication and persisted role only.

#### Acceptance Criteria

1. THE Profile_Client SHALL derive the Acting_User's curator status, for both face routing and role persistence, solely from the persisted Users_Row `role` and SHALL NOT derive it from the Preview_Toggle selection.
2. WHEN the Acting_User changes the Preview_Toggle selection, THE Profile_Client SHALL NOT issue any write to the Acting_User's Users_Row `role`.
3. WHEN the Acting_User changes the Preview_Toggle selection, THE Profile_Client SHALL leave the persisted Users_Row `role` unchanged.
4. WHEN the Acting_User reloads their own profile after changing the Preview_Toggle selection, THE Profile_Client SHALL render the face determined by the persisted Users_Row `role` rather than the prior Preview_Toggle selection.
5. WHILE the active Preview_Toggle selection differs from the face implied by the persisted Users_Row `role`, THE Profile_Client SHALL continue to determine the Acting_User's curator status from the persisted Users_Row `role`.

### Requirement 8: Consistency with the public curator profile feature

**User Story:** As a visitor, I want a real curator's public profile to resolve correctly once role is persisted, so that the public page shows the real curator rather than a fallback identity.

#### Acceptance Criteria

1. WHEN a Guest requests the public profile of an account whose persisted Users_Row `role` equals Curator_Role, THE Public_Curator_Profile_Feature SHALL resolve the account as an eligible curator from that persisted `role`.
2. THE Public_Curator_Profile_Feature SHALL preserve its defense-in-depth eligibility fallback, resolving an account as an eligible curator when its persisted Users_Row `role` equals Curator_Role OR at least one live, non-deleted Content_Row has a `creator_id` equal to that Users_Row `id`, until a separate change revisits this fallback.
3. WHEN a Guest requests the public profile of an account whose persisted Users_Row `role` equals User_Role AND at least one live, non-deleted Content_Row has a `creator_id` equal to that Users_Row `id`, THE Public_Curator_Profile_Feature SHALL resolve the account as an eligible curator via the fallback.

### Requirement 9: Guest and idempotency edge cases

**User Story:** As the founder, I want promotion to apply only to real signed-in authors and only when needed, so that guests are never promoted and repeated actions are safe.

#### Acceptance Criteria

1. IF a clip-publish path executes while the actor is a Guest (`auth.uid()` is null), THEN THE System SHALL NOT change any Users_Row `role` to Curator_Role.
2. WHEN the Acting_User whose persisted Users_Row `role` already equals Curator_Role re-runs the Onboarding_Flow, THE Profile_Client SHALL leave `role` equal to Curator_Role, SHALL NOT demote it to User_Role, AND SHALL NOT surface a persistence error for the unchanged role.
3. IF a client attempts to update a Users_Row whose `id` does not equal `auth.uid()`, THEN THE System SHALL reject the update under the existing `users_update_own` policy AND the targeted Users_Row `role` SHALL remain unchanged.
4. WHEN promotion occurs through either the Promotion_Trigger or the Onboarding_Flow more than once for the same Users_Row, THE System SHALL leave the final `role` equal to Curator_Role with no intermediate demotion to User_Role.

## Non-Goals

- No change to the sign-up trigger's username generation in `0003_auth_user_trigger.sql`.
- No new read grants or RLS read policies; public reads of `users` and live `content` already work.
- No full UI overhaul to remove the Preview_Toggle now; this work only stops it from driving real curator state.
- No analytics changes.
- No new write policy for self-promotion; `users_update_own` already permits the Acting_User to update their own `role`.
