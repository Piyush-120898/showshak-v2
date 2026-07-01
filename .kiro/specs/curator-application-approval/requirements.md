# Requirements Document

## Introduction

**Curator application & approval** replaces ShowShak's instant "Become a Curator" role-flip with a **manual-review application and approval system**, an **admin review console**, and a **two-tier badge system**. Today, completing "Become a Curator" immediately writes `users.role = 'curator'` (via `bcActivate` + `ssBuildOnboardingPatch`) and clip-publish promotes role at the database level — anyone who asks, or anyone who posts, is a curator with zero human review. This feature interposes a review step: submitting an application creates a `curator_application` row with status `pending` and does **not** change the applicant's role; a human admin later approves (which flips role to `curator`) or rejects (which permits resubmission).

The change protects the sacred product rule **curators-not-influencers** — curator status becomes a vetted trust signal, not a self-serve toggle. It preserves **hide-the-scoreboard** (public surfaces show only content signals; the two badges are trust signals, not counts) and keeps privacy **enforced by RLS, not UI**.

Three properties are the spine of this feature and are called out explicitly below:

1. **The security spine.** A `role` flip to `curator` and a `verified` flip to `true` MUST NEVER be performable client-side by a normal user. All privileged mutations (approve, reject, verify) run through admin-only `SECURITY DEFINER` RPCs, gated by an `is_admin` flag on the acting user. RLS denies the underlying tables to ordinary callers. This mirrors the `ss_is_admin()` + SECURITY DEFINER RPC posture established in migration `0029`.
2. **The review-only-clip guarantee.** An application's optional reference clip is REVIEW-ONLY. It MUST NEVER be published to the feed — not at submit time, not after approval, ever. It is stored in a private review location (never the public `content` table, never a public Mux playback id) and is visible only to admins reviewing the application.
3. **Grandfathering.** Every account that already has `role = 'curator'` at the time this feature ships is treated as an already-approved curator. Grandfathered curators never submit an application and never lose publishing ability.

**Phasing** (so the live feed and existing curators never break):
- **Phase 1** — application table + 4-step submit flow + pending state on the profile (NO role flip).
- **Phase 2** — admin console + approve/reject (privileged role flip) + append-only audit.
- **Phase 3** — two-badge system + grandfathering + the RLS publish gate.

New tables, RLS policies, triggers, and RPCs are authored as **additive migrations numbered 0034 and higher** (migration `0030` is RESERVED for DMCA Phase 2; `0001`–`0033` are applied). Migrations are applied manually by the founder in the Supabase SQL editor; the deliverable is the authored SQL.

### Data-layer facts already established (do NOT re-fix)

- **`ss_is_admin()` and the SECURITY DEFINER + locked-`search_path` RPC pattern** already exist (migration `0029`). This feature MAY refine `ss_is_admin()` to read a per-user `is_admin` flag, but the privileged-write posture is reused, not reinvented.
- **The append-only audit pattern** (`moderation_log` with BEFORE UPDATE/DELETE rejection triggers, no FKs so the log outlives what it describes) is established in `0029` and is the template for this feature's audit.
- **`users.role`, `users.verified`, `users.genres`, `users.bio`, `users.avatar_url`** already exist. The "VERIFIED CURATOR" pill already renders in `showshak-profile.html`. `ssResolveMyRole()` resolves the persisted role and the profile page drives its faces (user/owner/public) from that role.
- **Pure logic lives in `showshak-shared.js`**, dual-exported for Node so `fast-check` property tests can import it (`node tests/run-all.js`). New pure helpers (application validation, state machine, badge resolution, admin-authorization decision) belong there.

## Glossary

- **System**: The ShowShak application as a whole, spanning the browser client, the Supabase Postgres backend (tables, RLS, triggers, RPCs), and the private review-media store.
- **Applicant**: A signed-in normal user (persisted `Users_Row.role` equal to `User_Role`) who submits or has submitted a curator application.
- **Admin**: A signed-in user whose `Users_Row.is_admin` flag is `true`; the only actor permitted to approve, reject, or verify.
- **Normal_User**: A signed-in user whose `Users_Row.is_admin` flag is not `true` and whose `Users_Row.role` equals `User_Role`.
- **Guest**: An unauthenticated visitor for whom `auth.uid()` is null.
- **Users_Row**: A row in `public.users`, keyed by `id` equal to the authenticated user id, carrying `role` (`'user' | 'curator'`, default `'user'`), `verified` (boolean), and a new `is_admin` (boolean) flag.
- **Curator_Role**: The value `'curator'` stored in `Users_Row.role`.
- **User_Role**: The value `'user'` stored in `Users_Row.role`.
- **Application_Row**: A row in the new `curator_application` table representing one submitted application, carrying `applicant_id`, `status`, the four steps' captured fields, the social link, an optional private reference-clip pointer, the accepted terms version, and lifecycle timestamps.
- **Application_Status**: The value of `Application_Row.status`, drawn from the closed set `{ 'pending', 'approved', 'rejected' }`.
- **Application_Form**: The 4-step "Become a Curator" client flow (Step 1 applicant/user info; Step 2 curator info incl. genres; Step 3 recommendation profile — a social media link plus an optional reference clip; Step 4 accept the Curator Terms).
- **Social_Link**: The primary recommendation-profile field of Step 3 — a social media URL supplied by the Applicant.
- **Reference_Clip**: The optional Step 3 video supplied for review only; stored in the Review_Media_Store; never published.
- **Review_Media_Store**: A private storage location for the Reference_Clip that is NOT the public `content` table and NOT a public Mux playback id; readable only by an Admin for review.
- **Curator_Terms**: The one-time Curator Terms acceptance surface (`legal/curator-terms.md`), whose accepted version is recorded on the Application_Row.
- **Admin_Console**: A new client page listing applications by status and the curators list, with the Approve, Reject, and Make-Verified actions.
- **Approve_RPC**: An admin-only `SECURITY DEFINER` database function that, for a pending Application_Row, sets the Applicant's `Users_Row.role` to `Curator_Role`, transitions the Application_Row to `approved`, and appends an audit entry — all in one transaction.
- **Reject_RPC**: An admin-only `SECURITY DEFINER` database function that transitions a pending Application_Row to `rejected`, leaves the Applicant's `role` unchanged, and appends an audit entry — all in one transaction.
- **Verify_RPC**: An admin-only `SECURITY DEFINER` database function that sets a curator's `Users_Row.verified` flag and appends an audit entry — all in one transaction.
- **Audit_Log**: A new append-only table recording who performed each approve/reject/verify action and when, modeled on the `moderation_log` pattern from migration `0029` (no `updated_at`/`deleted_at`, BEFORE UPDATE/DELETE rejection triggers, no FKs so it outlives the rows it describes).
- **Badge**: A trust signal rendered on the profile, feed, and clip cards, resolved from `role` and `verified` into exactly one of `{ none, curator, verified }`.
- **Curator_Badge**: The Badge shown for an account whose `role` equals `Curator_Role` and whose `verified` is not `true`.
- **Verified_Badge**: The Badge shown for an account whose `verified` equals `true` (the higher trust tier), overriding the Curator_Badge.
- **Publish_Gate**: The RLS enforcement that permits only an approved curator (`role` equal to `Curator_Role`) to create a live `content` row (clip).
- **Grandfathered_Curator**: An account whose `Users_Row.role` already equals `Curator_Role` at the time this feature ships; treated as already approved and never required to apply.
- **Application_Validator**: The pure helper (in `showshak-shared.js`) that decides whether a submitted application payload is well-formed.
- **State_Machine**: The pure helper (in `showshak-shared.js`) that decides the allowed Application_Status transitions.
- **Badge_Resolver**: The pure helper (in `showshak-shared.js`) that maps `{ role, verified }` to exactly one Badge value.
- **Admin_Authorizer**: The pure helper (in `showshak-shared.js`) that decides whether a given actor is authorized to perform a privileged action, from the actor's `is_admin` flag.

## Requirements

### Requirement 1: Submit a curator application through a 4-step form

**User Story:** As a normal user, I want to apply to become a curator through a guided 4-step form, so that a human can review my taste before I am granted curator status.

#### Acceptance Criteria

1. WHEN the Applicant opens the "Become a Curator" entry point, THE Application_Form SHALL present four ordered steps: Step 1 applicant/user information, Step 2 curator information including genres, Step 3 recommendation profile, and Step 4 Curator_Terms acceptance.
2. THE Application_Form SHALL present in Step 3 a Social_Link field as the primary recommendation-profile input AND a Reference_Clip input marked as optional.
3. WHEN the Applicant submits the completed Application_Form AND the submitted payload is well-formed per the Application_Validator, THE System SHALL create exactly one Application_Row with `applicant_id` equal to `auth.uid()` and `Application_Status` equal to `pending`.
4. IF the Applicant submits the Application_Form while the submitted payload is not well-formed per the Application_Validator, THEN THE Application_Form SHALL display which required inputs are missing or invalid AND SHALL NOT create an Application_Row.
5. WHEN the System creates the pending Application_Row, THE System SHALL leave the Applicant's `Users_Row.role` equal to `User_Role`.
6. WHEN the System creates the pending Application_Row, THE System SHALL record on that Application_Row the accepted Curator_Terms version.

### Requirement 2: Application well-formedness validation

**User Story:** As the founder, I want submitted applications validated to a defined shape, so that the review queue never contains malformed or incomplete applications.

#### Acceptance Criteria

1. THE Application_Validator SHALL classify an application payload as well-formed only WHEN Step 1 applicant information is present, Step 2 includes one to six selected genres, Step 3 includes a non-empty Social_Link after trimming surrounding whitespace, and Step 4 records Curator_Terms acceptance as a strict boolean true.
2. THE Application_Validator SHALL treat the Reference_Clip as optional, classifying a payload with no Reference_Clip as well-formed WHEN every required field is present.
3. IF a Social_Link value is empty after trimming surrounding whitespace, THEN THE Application_Validator SHALL classify the payload as not well-formed AND SHALL identify the Social_Link as the missing input.
4. IF the Curator_Terms acceptance value is anything other than strict boolean true, THEN THE Application_Validator SHALL classify the payload as not well-formed AND SHALL identify Curator_Terms acceptance as the missing input.
5. IF the count of selected genres is zero or exceeds six, THEN THE Application_Validator SHALL classify the payload as not well-formed AND SHALL identify genres as the invalid input.
6. THE Application_Validator SHALL be a pure function exported from `showshak-shared.js` for Node consumption that returns a deterministic result for identical inputs AND does not read the DOM, network, or Supabase.

### Requirement 3: The reference clip is review-only and never published

**User Story:** As the founder, I want the application reference clip to be visible only to reviewers, so that an applicant's raw sample never leaks into the public feed before or after approval.

#### Acceptance Criteria

1. WHEN the Applicant supplies a Reference_Clip, THE System SHALL store the Reference_Clip in the Review_Media_Store AND SHALL NOT create a `content` row for it.
2. THE System SHALL NOT assign the Reference_Clip a public Mux playback id.
3. WHILE an Application_Row references a Reference_Clip, THE System SHALL expose that Reference_Clip on read only to an Admin.
4. WHEN an Application_Row transitions to `approved`, THE System SHALL leave the Reference_Clip in the Review_Media_Store AND SHALL NOT publish the Reference_Clip to the feed.
5. THE System SHALL NOT surface the Reference_Clip to any Guest, Applicant, or Normal_User on any public or applicant-facing surface at any Application_Status.

### Requirement 4: Confirmation after submission

**User Story:** As an applicant, I want a calm confirmation after I submit, so that I know my application was received and when to expect a decision.

#### Acceptance Criteria

1. WHEN the System creates the pending Application_Row, THE Application_Form SHALL display a confirmation card stating that the application was received and that each curator is personally reviewed.
2. THE confirmation card SHALL state an expected review timeframe of approximately 24 hours without asserting a guaranteed outcome.
3. WHEN the confirmation card is displayed, THE Application_Form SHALL NOT indicate that the Applicant's `role` has changed to `Curator_Role`.

### Requirement 5: Applicant retains full normal-user access while pending

**User Story:** As an applicant awaiting review, I want to keep using ShowShak normally, so that applying costs me nothing while I wait.

#### Acceptance Criteria

1. WHILE an Applicant has a pending Application_Row, THE System SHALL permit the Applicant to browse, fire, follow, and save with the same access as any other Normal_User.
2. WHILE an Applicant has a pending Application_Row, THE System SHALL prevent the Applicant from publishing a clip.
3. WHILE an Applicant has a pending Application_Row, THE System SHALL keep the Applicant's `Users_Row.role` equal to `User_Role`.

### Requirement 6: Pending state and status visibility on the profile

**User Story:** As an applicant, I want to see my application status on my profile, so that I know whether I am pending, approved, or rejected.

#### Acceptance Criteria

1. WHILE the Applicant has an Application_Row with `Application_Status` equal to `pending`, THE Profile_Client SHALL display a status panel on the Applicant's normal-user profile stating that the curator application is under review.
2. WHEN the Applicant views their profile, THE Profile_Client SHALL display the Applicant's current Application_Status from the persisted Application_Row.
3. WHEN the Applicant has no Application_Row, THE Profile_Client SHALL present the "Become a Curator" entry point rather than a status panel.
4. WHERE the Applicant has more than one Application_Row over time, THE Profile_Client SHALL display the status of the most recently created Application_Row.

### Requirement 7: Resubmission after rejection

**User Story:** As a rejected applicant, I want to apply again, so that I can address feedback and be reconsidered.

#### Acceptance Criteria

1. WHILE the Applicant's most recent Application_Row has `Application_Status` equal to `rejected`, THE Application_Form SHALL permit the Applicant to submit a new application.
2. WHEN a rejected Applicant submits a new well-formed application, THE System SHALL create a new pending Application_Row AND SHALL leave the prior rejected Application_Row unchanged as a historical record.
3. WHILE the Applicant's most recent Application_Row has `Application_Status` equal to `pending`, THE Application_Form SHALL NOT permit the Applicant to create an additional pending Application_Row.
4. WHILE the Applicant's most recent Application_Row has `Application_Status` equal to `approved`, THE Application_Form SHALL NOT present the "Become a Curator" entry point.

### Requirement 8: Application state machine

**User Story:** As the founder, I want the application to follow a defined state machine, so that invalid status transitions can never occur.

#### Acceptance Criteria

1. THE State_Machine SHALL define the initial Application_Status of a newly created Application_Row as `pending`.
2. WHEN an Application_Row has `Application_Status` equal to `pending`, THE State_Machine SHALL permit a transition to `approved` OR to `rejected`.
3. WHEN an Application_Row has `Application_Status` equal to `approved`, THE State_Machine SHALL permit no further transition of that Application_Row.
4. WHEN an Application_Row has `Application_Status` equal to `rejected`, THE State_Machine SHALL permit no in-place transition of that Application_Row, so that reconsideration proceeds through a new Application_Row.
5. IF a transition other than `pending`-to-`approved` or `pending`-to-`rejected` is requested for an Application_Row, THEN THE State_Machine SHALL classify that transition as not permitted.
6. THE State_Machine SHALL be a pure function exported from `showshak-shared.js` for Node consumption that returns a deterministic result for identical inputs AND does not read the DOM, network, or Supabase.

### Requirement 9: Admin review console listing

**User Story:** As an admin, I want a console that lists applications by status, so that I can review new applications and see a record of rejected ones.

#### Acceptance Criteria

1. WHEN an Admin opens the Admin_Console, THE Admin_Console SHALL list pending Application_Rows in a new/pending group AND rejected Application_Rows in a record group.
2. WHEN the Admin_Console lists an Application_Row, THE Admin_Console SHALL display for that row the Applicant's captured information, the Social_Link, and, WHERE a Reference_Clip exists, the review-only Reference_Clip.
3. WHEN the Admin_Console lists an Application_Row, THE Admin_Console SHALL present an Approve action and a Reject action for a pending Application_Row.
4. THE Admin_Console SHALL present a curators list of accounts whose `role` equals `Curator_Role`, each with a Make-Verified toggle reflecting that account's current `verified` value.

### Requirement 10: Approve action flips role through a privileged RPC

**User Story:** As an admin, I want approving an application to make the applicant a curator, so that they can start publishing clips.

#### Acceptance Criteria

1. WHEN an Admin approves a pending Application_Row, THE Approve_RPC SHALL set the Applicant's `Users_Row.role` to `Curator_Role`, transition the Application_Row to `approved`, and append one Audit_Log entry, all within a single database transaction.
2. IF any part of the Approve_RPC transaction fails, THEN THE Approve_RPC SHALL roll back the entire transaction so that no `role` change persists without its corresponding `approved` status and Audit_Log entry.
3. WHEN an approved Applicant next opens their own profile, THE Profile_Client SHALL render the curator (owner) face with the Curator_Badge, resolved from the persisted `Curator_Role`.
4. IF an Admin requests approval of an Application_Row whose `Application_Status` is not `pending`, THEN THE Approve_RPC SHALL make no `role` change AND SHALL make no status change.
5. THE Approve_RPC SHALL identify the target Applicant from the Application_Row's `applicant_id` AND SHALL modify at most that one Users_Row's `role`.

### Requirement 11: Reject action records the decision without changing role

**User Story:** As an admin, I want rejecting an application to leave the applicant a normal user, so that a declined applicant keeps full access and may reapply.

#### Acceptance Criteria

1. WHEN an Admin rejects a pending Application_Row, THE Reject_RPC SHALL transition the Application_Row to `rejected`, leave the Applicant's `Users_Row.role` equal to `User_Role`, and append one Audit_Log entry, all within a single database transaction.
2. IF any part of the Reject_RPC transaction fails, THEN THE Reject_RPC SHALL roll back the entire transaction so that no status change persists without its corresponding Audit_Log entry.
3. IF an Admin requests rejection of an Application_Row whose `Application_Status` is not `pending`, THEN THE Reject_RPC SHALL make no status change.
4. WHEN an Application_Row is rejected, THE System SHALL retain the rejected Application_Row as a historical record in the Admin_Console record group.

### Requirement 12: Make-Verified toggle sets the higher trust tier

**User Story:** As an admin, I want to mark a curator as verified, so that a higher trust tier is visible on their profile, the feed, and their clip cards.

#### Acceptance Criteria

1. WHEN an Admin activates the Make-Verified toggle for a curator, THE Verify_RPC SHALL set that account's `Users_Row.verified` to `true` and append one Audit_Log entry, within a single database transaction.
2. WHEN an Admin deactivates the Make-Verified toggle for a curator, THE Verify_RPC SHALL set that account's `Users_Row.verified` to `false` and append one Audit_Log entry, within a single database transaction.
3. THE Verify_RPC SHALL modify the `verified` flag only for an account whose `Users_Row.role` equals `Curator_Role`.
4. IF any part of the Verify_RPC transaction fails, THEN THE Verify_RPC SHALL roll back the entire transaction so that no `verified` change persists without its corresponding Audit_Log entry.

### Requirement 13: Privileged mutations are admin-only (the security spine)

**User Story:** As the founder, I want role and verified changes to be impossible for normal users, so that curator status and verification cannot be self-granted.

#### Acceptance Criteria

1. THE System SHALL perform every `role` flip to `Curator_Role` and every `verified` flip driven by this feature exclusively through the Approve_RPC, Reject_RPC, or Verify_RPC, each defined as a `SECURITY DEFINER` function with a locked `search_path` equal to `public`.
2. IF a caller that is not an Admin invokes the Approve_RPC, Reject_RPC, or Verify_RPC, THEN THE System SHALL make no `role` change, make no `verified` change, and make no Application_Status change.
3. IF a Normal_User attempts to update their own `Users_Row.role` or `Users_Row.verified` directly through the data API, THEN THE System SHALL reject the write under RLS so that the targeted values remain unchanged.
4. IF a Normal_User or Guest attempts to read the `curator_application` table or the Audit_Log directly through the data API, THEN THE System SHALL return zero rows under RLS.
5. THE Admin_Authorizer SHALL be a pure function exported from `showshak-shared.js` for Node consumption that decides authorization from the actor's `is_admin` flag AND returns a deterministic result for identical inputs.
6. THE Admin_Authorizer SHALL classify an actor as not authorized WHEN the actor's `is_admin` flag is absent, null, or any value other than strict boolean true.

### Requirement 14: Append-only audit of admin actions

**User Story:** As the founder, I want an immutable record of who approved, rejected, or verified and when, so that curator-status decisions are fully accountable.

#### Acceptance Criteria

1. WHEN the Approve_RPC, Reject_RPC, or Verify_RPC completes its mutation, THE System SHALL append to the Audit_Log one entry recording the action type, the acting Admin's identifier, the affected Applicant or curator identifier, the affected Application_Row identifier where applicable, and the time of the action in UTC.
2. IF any role, database, or service caller attempts to update or delete an Audit_Log row, THEN THE System SHALL reject the attempt at the table level so that the Audit_Log can only grow.
3. THE Audit_Log SHALL have no `updated_at` and no `deleted_at` column, consistent with the append-only `moderation_log` pattern from migration `0029`.
4. THE Audit_Log SHALL reference the affected Applicant, curator, and Application_Row by plain identifier without a foreign key, so that the Audit_Log outlives the rows it describes.
5. WHEN a privileged RPC's transaction rolls back, THE System SHALL persist no Audit_Log entry for that failed action.

### Requirement 15: Two-badge resolution

**User Story:** As a viewer, I want to see whether an account is a curator or a verified curator, so that I can gauge trust at a glance.

#### Acceptance Criteria

1. WHEN an account's `Users_Row.role` equals `Curator_Role` AND `Users_Row.verified` is not `true`, THE Badge_Resolver SHALL resolve the Badge to `curator`.
2. WHEN an account's `Users_Row.verified` equals `true`, THE Badge_Resolver SHALL resolve the Badge to `verified`, overriding the `curator` Badge.
3. WHEN an account's `Users_Row.role` equals `User_Role` AND `Users_Row.verified` is not `true`, THE Badge_Resolver SHALL resolve the Badge to `none`.
4. THE Badge_Resolver SHALL resolve exactly one Badge value from the set `{ none, curator, verified }` for any `{ role, verified }` input.
5. THE Badge_Resolver SHALL be a pure function exported from `showshak-shared.js` for Node consumption that returns a deterministic result for identical inputs AND does not read the DOM, network, or Supabase.

### Requirement 16: Badge rendering respects hide-the-scoreboard

**User Story:** As a viewer, I want badges shown consistently across surfaces without exposing counts, so that trust signals appear without turning the product into a scoreboard.

#### Acceptance Criteria

1. WHEN the Profile_Client renders an account carrying a resolved Curator_Badge or Verified_Badge, THE Profile_Client SHALL display that Badge on the profile.
2. WHEN the feed renders a clip whose curator carries a resolved Curator_Badge or Verified_Badge, THE feed SHALL display that Badge on the clip.
3. WHEN a clip card renders on Discover, Watchlist, or a profile, THE clip card SHALL display the curator's resolved Badge.
4. THE badge-rendering surfaces SHALL display only the resolved Badge value AND SHALL NOT display any follower count, fires-given count, or other social scoreboard signal as part of the Badge.

### Requirement 17: Existing curators are grandfathered

**User Story:** As an existing curator, I want to keep my curator status without reapplying, so that the new review process does not disrupt me.

#### Acceptance Criteria

1. WHEN this feature ships, THE System SHALL treat every account whose `Users_Row.role` already equals `Curator_Role` as an already-approved curator.
2. THE System SHALL NOT require a Grandfathered_Curator to submit an Application_Row.
3. WHILE an account is a Grandfathered_Curator, THE System SHALL permit that account to publish clips under the Publish_Gate.
4. THE System SHALL NOT present the "Become a Curator" entry point to a Grandfathered_Curator.

### Requirement 18: Publish gate enforced in RLS

**User Story:** As the founder, I want only approved curators to publish clips, so that the review step cannot be bypassed by a client that skips the UI.

#### Acceptance Criteria

1. WHEN a caller attempts to create a live `content` row, THE Publish_Gate SHALL permit the write only WHERE the caller's `Users_Row.role` equals `Curator_Role`.
2. IF a caller whose `Users_Row.role` equals `User_Role` attempts to create a live `content` row, THEN THE Publish_Gate SHALL reject the write under RLS.
3. THE Publish_Gate SHALL enforce the `role` check in RLS independently of any client-side UI check, so that the gate holds for direct data-API calls.
4. WHILE an account has a pending or rejected Application_Row and `Users_Row.role` equal to `User_Role`, THE Publish_Gate SHALL reject that account's attempt to create a live `content` row.

### Requirement 19: Additive, phased migrations numbered 0034 and higher

**User Story:** As the founder, I want the database changes authored as additive, re-runnable migrations, so that I can apply them safely by hand without breaking the live schema.

#### Acceptance Criteria

1. THE System SHALL author the `curator_application` table, the Audit_Log table, their RLS policies, their triggers, and the privileged RPCs as additive migrations numbered 0034 or higher.
2. THE migrations SHALL NOT reuse migration number `0030`, which is reserved for DMCA Phase 2.
3. THE migrations SHALL be authored as idempotent SQL that drops-and-recreates its own functions, triggers, and policies, such that re-applying a migration completes without error and yields identical definitions.
4. THE migrations SHALL be additive AND SHALL NOT drop, rename, retype, or remove any existing table or column, adding only new tables, new columns (including `Users_Row.is_admin`), policies, triggers, and functions.
5. THE Phase 1 deliverable SHALL enable the application table, submit flow, and pending state without any `role` flip; THE Phase 2 deliverable SHALL add the Admin_Console, the Approve_RPC and Reject_RPC, and the Audit_Log; THE Phase 3 deliverable SHALL add the two-badge rendering, grandfathering treatment, and the Publish_Gate.

## Non-Goals

- No change to the guest-first auth flow or the sign-up trigger.
- No automated or algorithmic scoring of applications; review is entirely human.
- No public exposure of application contents, reviewer identities, or the Audit_Log to non-admins.
- No email or push notification of application decisions in this feature (applicants learn status from the profile status panel).
- No removal of the existing "VERIFIED CURATOR" pill styling; this feature reuses the existing verified surface.
- No migration of the reserved `0030` slot; DMCA Phase 2 retains it.
- No change to how counts (fires/followers/views) are derived or displayed.
