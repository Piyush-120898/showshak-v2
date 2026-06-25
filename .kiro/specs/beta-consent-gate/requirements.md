# Requirements Document

## Introduction

ShowShak is preparing an **open beta in India** (18+ only, non-commercial — no payments, no
ads). The website is publicly reachable; content risk is controlled by limiting the
curator/upload side, not by a "private/testing" label. Under India's **Digital Personal Data
Protection Act, 2023 (DPDP Act)** and the **DPDP Rules, 2025**, a Data Fiduciary must obtain
consent that is **free, specific, informed, unambiguous, and affirmative** (no pre-ticked
boxes) and must **record** that consent — who gave it, when, and **which policy version** they
accepted. Because verifiable parental consent for minors is out of scope for the beta, the
service is **18+ only** and must exclude under-18 users *before* it collects any personal data.

This feature delivers a **consent + 18+ gate as the real Step 1 of onboarding**, together with
**syncing the real legal policy drafts into the database** so the beta actually displays the
policies the user is consenting to. These two pieces ship as **one compliance unit** because of
the **version contract**: the Terms-of-Service and Privacy-Policy links shown at the gate MUST
display the *same* policy version that the consent record stamps. A gate that records consent to
"version X" while showing the user "version Y" is not informed consent.

**This is strategy, not legal advice.** The `legal/*.md` drafts are India-aware working drafts
grounded in IT Act 2000 §79 + IT Rules 2021, Copyright Rules 2013 Rule 75, and the DPDP Act.
They still contain `[PLACEHOLDERS]` (entity name, emails, Grievance Officer, version, effective
date) that the founder and counsel must fill. This feature wires the *machinery* so the eventual
final-text swap is a **content / re-seed step, not a code change**.

The same consent machinery also powers a **one-time Curator Terms acceptance at the
"Become a Curator" step**. This is a **relationship-level** agreement captured once when a
Subject activates the curator role, and is distinct from — and complementary to — the
**per-upload DMCA attestation** already shipped in migration `0029`, which the curator repeats
on every publish. The Curator Terms state that the curator **retains ownership** of their clips
while **granting ShowShak a non-exclusive, worldwide, royalty-free, sublicensable license** to
host and operate those clips through the service and its infrastructure providers, that
**ShowShak claims no ownership** and is a **neutral host/showcase** (it does not host the
underlying shows or movies; "Watch It" links out to third-party platforms), and that the curator
**warrants their rights** to the clip and **indemnifies** ShowShak. To honor the same version
contract, the Curator Terms version shown and linked at the Become-a-Curator step is identical to
the version stamped on the recorded acceptance, and the acceptance must bind **before** the
account role is changed to curator.

### What this builds on (do not duplicate)

This feature mirrors the **attestation pattern** already shipped in migration `0029`
(`.kiro/specs/dmca-moderation-scaffolding`):

- **`policy_versions`** (migration `0029`) already stores immutable, addressable policy
  revisions for the four documents (`tos | privacy | copyright | community`) and is
  world-readable via RLS; `ss_get_policy_version(doc, version)` already returns the exact stored
  body. **No counsel-approved rows have been seeded yet**, so `showshak-legal.html` currently
  degrades to clearly-marked **placeholder scaffolding**. This feature seeds the real drafts.
- **`ssAttestationComplete(attestation, requiredVersion)`** is the established pure,
  dual-exported, fast-check-tested validator pattern in `showshak-shared.js`; the new consent
  validator mirrors it exactly.
- **`ssRecordAttestation` / `ssLoadPolicyVersion`** are the established window-only RPC-wrapper
  pattern; the new `ssRecordConsent` wrapper sits beside them.
- **Migrations are founder-applied manually.** The next free number is constrained:
  **`0030` is RESERVED for DMCA Phase 2** (termination markers). This feature's migration MUST
  therefore use **`0031`** (or the next free number above any reserved one) so it does not
  collide.

### Sacred-rule alignment

The gate must not damage the guest-first onboarding feel more than the law requires: it adds a
single affirmative step before personal-data collection and nothing more. No public surface this
feature touches exposes fires-received totals, Watch-It tap counts, or pre-Watch-It clip titles,
and a user may read **only their own** consent record (enforced by RLS, never UI-only).

## Glossary

- **System** — the ShowShak application (vanilla HTML/CSS/JS client, Supabase Postgres + Auth +
  Edge Functions, RLS), excluding the more specific components named below.
- **Consent_Gate** — the mandatory onboarding **Step 1** surface in `index.html` that presents
  the affirmative consent checkbox, the clickable Terms-of-Service and Privacy-Policy links, and
  the explicit 18+ affirmation, and that blocks entry until consent is given.
- **Legal_Surface** — `showshak-legal.html`, the page that renders each policy document by
  version from the Policy_Store.
- **Policy_Store** — the `policy_versions` table (migration `0029`) plus the
  `ss_get_policy_version(doc, version)` read RPC; the immutable, addressable source of policy
  text.
- **Consent_Recorder** — the new `SECURITY DEFINER` RPC (`ss_record_consent`) and its
  window-only client wrapper (`ssRecordConsent`) that persist one consent record.
- **Consent record** — one persisted row capturing the consenting subject identifier, the UTC
  acceptance timestamp, the affirmative-acceptance flag, the 18+ affirmation flag, and the
  accepted Terms-of-Service and Privacy-Policy version identifiers.
- **Subject** — the person giving consent, identified by an authenticated user id or, before
  sign-in, a stable guest identifier.
- **Personal-data collection** — any capture or storage of the Subject's onboarding inputs or
  identifiers beyond what is strictly required to display and operate the Consent_Gate (genre
  picks, platform picks, account creation, profile data).
- **Affirmative consent** — consent expressed by a deliberate action on a control that is
  **unticked / unselected by default**; a pre-ticked control is not affirmative consent.
- **18+ affirmation** — the Subject's explicit affirmation that they are 18 years of age or
  older.
- **Policy version identifier** — the immutable `version` label of a `policy_versions` row
  (e.g. a semantic version or dated label) such as `1.0-beta`.
- **Version contract** — the rule that the Terms-of-Service and Privacy-Policy versions shown
  and linked at the Consent_Gate are identical to the versions stamped in the consent record.
- **Consent_Validator** — the pure, dual-exported, fast-check-tested function (`ssConsentComplete`
  / `ssConsentRecordValid`) that decides whether a consent record is complete and valid.
- **Seeding / re-seeding** — inserting or publishing policy text into the Policy_Store as data,
  with no client/code change required.
- **DPDP** — the Digital Personal Data Protection Act, 2023 and the DPDP Rules, 2025 (India).
- **Become_a_Curator_Surface** — the "Become a Curator" flow in `showshak-profile.html`
  (the `#bc-overlay` modal, its multi-step `bcStep` progression, and the `bcActivate()` action)
  through which a Subject activates the curator role.
- **Curator_Terms** — the policy document, stored in the Policy_Store as `doc = 'curator'` and
  rendered on the Legal_Surface, that states the curator's ownership retention, the license grant
  to the System, the System's neutral-host posture and no-ownership claim, the curator's rights
  warranty and indemnity, and the curator's agreement to the Community Guidelines and Copyright
  Policy. Seeded from the founder-authored draft `legal/curator-terms.md`.
- **License grant** — the non-exclusive, worldwide, royalty-free, sublicensable permission the
  curator grants the System and its infrastructure providers (content delivery network and video
  providers such as Mux) to host, store, reproduce, transcode, create thumbnails and previews of,
  display, distribute, and promote a clip on and through the service for as long as the clip is on
  the platform, plus a reasonable backup and legal-retention tail.
- **Curator-terms acceptance** — one persisted consent record, distinguished by an acceptance
  `kind` discriminator value of `'curator_terms'`, capturing the Subject identifier, the UTC
  acceptance timestamp, the affirmative-acceptance flag, and the accepted Curator_Terms version
  identifier.
- **Acceptance kind** — the `kind` discriminator column on the consent record store distinguishing
  a Consent_Gate onboarding consent (`'user_consent'`) from a Curator-terms acceptance
  (`'curator_terms'`), so both reuse the same store and write path.

## Requirements

### Requirement 1: Live policy display from real drafts (seed / sync)

**User Story:** As a beta user in India, I want the Terms of Service and Privacy Policy I am
asked to accept to show the real policy drafts rather than placeholder text, so that my consent
is informed.

#### Acceptance Criteria

1. WHEN the founder seeds policy content into the Policy_Store, THE System SHALL publish the
   Terms-of-Service draft and the Privacy-Policy draft from `legal/terms-of-service.md` and
   `legal/privacy-policy.md` as `policy_versions` rows with `doc = 'tos'` and `doc = 'privacy'`
   respectively, where a published row consists of the verbatim `.md` body, a non-empty version
   identifier, and a non-empty effective date.
2. WHEN a Subject opens the Legal_Surface for `doc = 'tos'` or `doc = 'privacy'` AND a current,
   non-deleted `policy_versions` row exists for that `doc`, THE Legal_Surface SHALL render the
   stored body, version identifier, and effective date from that row and SHALL suppress the
   built-in placeholder scaffolding.
3. THE System SHALL permit at most one current, non-deleted `policy_versions` row per `doc` via a
   partial unique index, and SHALL maintain exactly one current row per `doc` once that `doc` is
   published.
4. WHERE a published policy draft still contains unfilled placeholder markers, defined as
   bracketed `[PLACEHOLDER]`-style tokens, THE Legal_Surface SHALL continue to display the visible
   "counsel review required" marker alongside that policy.
5. WHEN counsel-approved final text is seeded as a new `policy_versions` row, THE System SHALL
   adopt that text as a re-seed of policy data on the next load without requiring any change to
   client or application code.
6. IF the Policy_Store contains no current, non-deleted row for a requested `doc`, THEN THE
   Legal_Surface SHALL display its clearly-marked placeholder scaffolding for that `doc`,
   including a version marker, an effective-date marker, and a counsel marker, so the surface
   remains reachable.
7. THE seeding and re-seeding operations SHALL be expressed as database content applied by the
   founder.
8. THE System SHALL NOT overwrite or mutate any previously published `policy_versions` row.
9. IF loading the stored policy text fails, THEN THE Legal_Surface SHALL degrade to its
   clearly-marked placeholder scaffolding for the requested `doc`.

### Requirement 2: Consent + 18+ gate as onboarding Step 1

**User Story:** As ShowShak operating an 18+ India beta, I want a mandatory affirmative consent
and 18+ gate as the first onboarding step, so that no personal data is collected before the user
affirmatively accepts the policies and confirms they are an adult.

#### Acceptance Criteria

1. WHEN a Subject begins onboarding in `index.html`, THE Consent_Gate SHALL be rendered as the
   first interactive onboarding surface (Step 1), before any genre-selection, platform-selection,
   or sign-in surface is rendered or made interactive.
2. THE Consent_Gate SHALL present a consent acceptance control that is in the unselected state by
   default on every fresh onboarding entry.
3. THE Consent_Gate SHALL present an 18+ affirmation control that is in the unselected state by
   default on every fresh onboarding entry.
4. THE Consent_Gate SHALL present a clickable Terms-of-Service link and a clickable
   Privacy-Policy link that each, WHEN activated, open the corresponding policy on the
   Legal_Surface without dismissing, resetting, or altering the selection state of the consent
   acceptance control or the 18+ affirmation control.
5. WHILE either the consent acceptance control or the 18+ affirmation control is in the
   unselected state, THE Consent_Gate SHALL keep the onboarding-advance control in a disabled
   state that does not respond to click, tap, or keyboard activation.
6. WHEN the Subject has placed both the consent acceptance control and the 18+ affirmation control
   in the selected state, THE Consent_Gate SHALL enable the onboarding-advance control so that
   activating it advances to the next onboarding step.
7. WHILE the Subject has not both affirmatively selected the consent acceptance control and
   selected the 18+ affirmation control at the Consent_Gate, THE System SHALL NOT perform
   personal-data collection, where personal-data collection means transmitting any
   Subject-identifying data to a backend or persisting it to durable storage.
8. THE 18+ affirmation SHALL be satisfied before any personal-data collection occurs, including
   before any guest entry into the application beyond the Consent_Gate.
9. THE Consent_Gate SHALL be implemented as a self-contained surface within `index.html`, defined
   entirely within that file and styled using inline styles, with no dependency on external
   stylesheet or script files for its presentation or gating behavior.
10. WHEN the Subject activates the enabled onboarding-advance control, THE Consent_Gate SHALL
    record an affirmative-consent entry capturing that the consent acceptance and 18+ affirmation
    were both selected, before advancing to the next onboarding step.
11. IF the Subject attempts to advance past the Consent_Gate while either the consent acceptance
    control or the 18+ affirmation control is unselected, THEN THE Consent_Gate SHALL keep the
    Subject on the Consent_Gate and SHALL NOT advance onboarding.

### Requirement 3: Record the consent in the database

**User Story:** As a Data Fiduciary under DPDP, I want each consent recorded with who consented,
when, and which policy versions were accepted, so that the consent is provable after the fact.

#### Acceptance Criteria

1. WHEN a Subject affirmatively accepts at the Consent_Gate, THE Consent_Recorder SHALL persist
   exactly one consent record containing the Subject identifier, the acceptance timestamp in UTC,
   the affirmative-acceptance flag, the 18+ affirmation flag, the accepted Terms-of-Service
   version identifier, and the accepted Privacy-Policy version identifier.
2. THE System SHALL introduce the consent record store and its write path as a new
   founder-applied migration numbered `0031`, reserving `0030` for DMCA Phase 2 and using the
   next free number above any reserved number.
3. THE consent record store, its write path, and its access controls SHALL mirror the migration
   `0029` attestation pattern: a dedicated consent table, a `SECURITY DEFINER` write RPC named
   `ss_record_consent` as the only sanctioned insert path, and the existing `ss_get_policy_version`
   read RPC for policy text.
4. WHEN a Subject reads consent records, THE System SHALL enforce, via row-level security keyed on
   the authenticated identity (mirroring `curator_id = auth.uid()`), that own-row reads return
   only the Subject's matching consent records and reads for any other Subject's records return
   zero rows.
5. WHEN the consent record write path persists a record, THE System SHALL set the Subject
   identifier server-side from the authenticated identity (`auth.uid()`) or the guest identifier,
   and SHALL ignore any client-supplied identity claim.
6. IF the Subject identity is missing or cannot be resolved from the authenticated identity or
   guest identifier, THEN THE System SHALL NOT persist any consent record and SHALL surface an
   indication that consent could not be saved.
7. IF the affirmative-acceptance flag or the 18+ affirmation flag is not true, or either the
   accepted Terms-of-Service version identifier or the accepted Privacy-Policy version identifier
   is empty, THEN THE System SHALL reject the request without inserting any consent record.
8. IF persisting the consent record fails, THEN THE System SHALL roll back the write
   transactionally leaving no partial row, and SHALL NOT advance onboarding past the Consent_Gate.
9. THE System SHALL retain each consent record after the associated account or guest session ends,
   and the consent record reference SHALL have no delete cascade that erases it, so the acceptance
   remains provable.
10. THE consent record store SHALL NOT expose fires-received totals, Watch-It tap counts, or
    pre-Watch-It clip titles.

### Requirement 4: Version contract between gate and record

**User Story:** As a beta user, I want the policies I am shown at the gate to be exactly the
versions my consent is recorded against, so that I am consenting to what I actually read.

#### Acceptance Criteria

1. WHEN the Consent_Gate presents the Terms-of-Service and Privacy-Policy links, THE Consent_Gate
   SHALL resolve the single Terms-of-Service version and the single Privacy-Policy version marked
   current in the Policy_Store.
2. WHEN the Consent_Gate resolves the current Terms-of-Service and Privacy-Policy version
   identifiers at presentation, THE Consent_Gate SHALL reuse those same resolved version
   identifiers for the policy links, the Legal_Surface display, and the persisted consent record
   without re-resolving them during the consent action.
3. WHEN a consent record is persisted, THE accepted Terms-of-Service version identifier and the
   accepted Privacy-Policy version identifier SHALL equal the version identifiers bound at the
   Consent_Gate for that consent action.
4. WHEN the Subject opens a policy link from the Consent_Gate, THE Legal_Surface SHALL display the
   bound version identifier that the consent record will stamp.
5. IF a current Terms-of-Service version or a current Privacy-Policy version cannot be resolved
   from the Policy_Store, THEN THE Consent_Gate SHALL NOT bind or persist consent against an
   unresolved version.
6. IF a current Terms-of-Service version or a current Privacy-Policy version cannot be resolved
   from the Policy_Store, THEN THE Consent_Gate SHALL surface a visible indication that the
   policies are unavailable AND keep the advance control disabled.

### Requirement 5: Pure consent-validity correctness logic

**User Story:** As a developer maintaining ShowShak's property-tested core, I want a pure consent
validator mirroring `ssAttestationComplete`, so that consent completeness is provable in the test
suite and reusable as the gate's enable condition and the server's re-validation spec.

#### Acceptance Criteria

1. THE System SHALL expose a pure function (`ssConsentComplete` / `ssConsentRecordValid`) in
   `showshak-shared.js` that returns the strict boolean `true` only when a consent record has an
   affirmative-acceptance flag strictly equal to boolean `true`, a 18+ affirmation flag strictly
   equal to boolean `true`, a Terms-of-Service version identifier that is a string whose trimmed
   length is ≥ 1, and a Privacy-Policy version identifier that is a string whose trimmed length is
   ≥ 1; otherwise it SHALL return the strict boolean `false`.
2. IF the affirmative-acceptance flag is not strictly equal to boolean `true` (including truthy
   non-boolean values), THEN THE Consent_Validator SHALL return the strict boolean `false`.
3. IF the 18+ affirmation flag is not strictly equal to boolean `true` (including truthy
   non-boolean values), THEN THE Consent_Validator SHALL return the strict boolean `false`.
4. IF the accepted Terms-of-Service version identifier is not a string OR its trimmed length is 0,
   THEN THE Consent_Validator SHALL return the strict boolean `false`.
5. IF the accepted Privacy-Policy version identifier is not a string OR its trimmed length is 0,
   THEN THE Consent_Validator SHALL return the strict boolean `false`.
6. IF the input consent record is null, undefined, or not an object, THEN THE Consent_Validator
   SHALL return the strict boolean `false` without raising an error.
7. WHEN invoked with any input value of any type, THE Consent_Validator SHALL NOT throw and SHALL
   always return a strict boolean (`true` or `false`).
8. THE Consent_Validator SHALL produce no side effects, SHALL NOT mutate its input, and SHALL
   return an identical output for identical input on every invocation.
9. THE System SHALL export the Consent_Validator on both `window.*` and `module.exports` so it is
   executable under `node tests/run-all.js`.
10. THE System SHALL include a fast-check property test for the Consent_Validator that runs green
    under `node tests/run-all.js`.

### Requirement 6: Client consent wrapper

**User Story:** As a developer wiring the gate, I want an impure `ssRecordConsent` client wrapper
beside the existing `ssRecordAttestation` / `ssLoadPolicyVersion` wrappers, so that the gate
records consent through one guarded, fail-soft entry point.

#### Acceptance Criteria

1. THE System SHALL provide a client wrapper (`ssRecordConsent`) in `showshak-shared.js`, exported
   only on `window.*` beside the existing `ssRecordAttestation` and `ssLoadPolicyVersion`
   wrappers, that records a consent record by invoking the `ss_record_consent` `SECURITY DEFINER`
   RPC.
2. WHEN the `ss_record_consent` RPC persists the consent record without reporting an error, THE
   `ssRecordConsent` wrapper SHALL return a result indicating success.
3. IF the database client (`window.ssDB`) is unavailable or the Subject identity (the
   authenticated user id or guest identifier) cannot be resolved, THEN THE `ssRecordConsent`
   wrapper SHALL return a result indicating failure, SHALL NOT invoke the `ss_record_consent` RPC,
   and SHALL NOT raise an error.
4. IF the `ss_record_consent` RPC reports an error, THEN THE `ssRecordConsent` wrapper SHALL
   return a result indicating failure that carries an error indication and SHALL NOT raise an
   error.
5. THE `ssRecordConsent` wrapper SHALL invoke the `ss_record_consent` RPC only after the
   Consent_Validator returns true for the consent record.
6. IF the Consent_Validator returns false for the consent record, THEN THE `ssRecordConsent`
   wrapper SHALL return a result indicating failure and SHALL NOT invoke the `ss_record_consent`
   RPC.
7. THE `ssRecordConsent` wrapper SHALL NOT throw under any code path.

### Requirement 7: Deployment cache busting

**User Story:** As the founder deploying to the installed PWA, I want the service-worker cache
version bumped when this feature ships, so that users receive the new gate and policy wiring
rather than a stale cached bundle.

#### Acceptance Criteria

1. WHEN this feature's client changes are shipped, THE System SHALL increment `CACHE_VERSION` in
   `sw.js` from its current value `v29` to `v30`, such that the new value is exactly one greater
   than the prior numeric suffix and differs from every previously deployed `CACHE_VERSION` value.
2. WHEN `CACHE_VERSION` is set to the incremented value, THE System SHALL derive the active cache
   name as `showshak-` concatenated with the incremented `CACHE_VERSION` value.
3. WHEN the service worker installs under the incremented `CACHE_VERSION`, THE System SHALL
   include both `index.html` (precached as the scope root `./`) and `showshak-legal.html` in the
   precache asset list so the Consent_Gate and the policy surfaces are served from the incremented
   cache.
4. IF precaching of an individual asset path fails during install, THEN THE System SHALL ignore
   that single failure and continue precaching the remaining assets so that install completes
   without aborting.
5. WHEN the service worker activated under the incremented `CACHE_VERSION` takes control, THE
   System SHALL delete all caches whose names begin with `showshak-` and do not equal the active
   cache name, while retaining the persistent video Segment_Cache bucket.

### Requirement 8: Curator Terms policy document (seed / display)

**User Story:** As a Subject about to become a curator, I want to read the real Curator Terms
that describe what rights I keep and what license I grant, so that my acceptance is informed.

#### Acceptance Criteria

1. WHEN the founder seeds Curator_Terms content into the Policy_Store, THE System SHALL publish
   the Curator_Terms draft from `legal/curator-terms.md` as a `policy_versions` row with
   `doc = 'curator'`, where a published row consists of the verbatim `.md` body, a non-empty
   version identifier, and a non-empty effective date.
2. WHEN a Subject opens the Legal_Surface for `doc = 'curator'` AND a current, non-deleted
   `policy_versions` row exists for that `doc`, THE Legal_Surface SHALL render the stored body,
   version identifier, and effective date from that row and SHALL suppress the built-in
   placeholder scaffolding.
3. WHERE the published Curator_Terms draft still contains unfilled placeholder markers, defined as
   bracketed `[PLACEHOLDER]`-style tokens, THE Legal_Surface SHALL display the visible
   "counsel review required" marker alongside the Curator_Terms.
4. IF the Policy_Store contains no current, non-deleted row for `doc = 'curator'`, THEN THE
   Legal_Surface SHALL display its clearly-marked placeholder scaffolding for the Curator_Terms,
   including a version marker, an effective-date marker, and a counsel marker, so the surface
   remains reachable.
5. IF loading the stored Curator_Terms text fails, THEN THE Legal_Surface SHALL degrade to its
   clearly-marked placeholder scaffolding for `doc = 'curator'`.
6. THE published Curator_Terms body SHALL state that the curator retains ownership of clips the
   curator posts.
7. THE published Curator_Terms body SHALL state that the curator grants the System a
   non-exclusive, worldwide, royalty-free, sublicensable License grant to the System and its
   infrastructure, content-delivery, and video providers to host, store, reproduce, transcode,
   create thumbnails and previews of, display, distribute, and promote the clip on and through the
   service for as long as the clip is on the platform, together with a reasonable backup and
   legal-retention tail.
8. THE published Curator_Terms body SHALL state that the System claims no ownership of clips and is
   a neutral host and showcase that does not host the underlying shows or movies, and that the
   "Watch It" action links out to third-party streaming platforms.
9. THE published Curator_Terms body SHALL state that the curator represents and warrants that the
   curator created or holds all necessary rights, licenses, and permissions to the clip and
   everything in the clip, including video, audio and music, and any third-party material, and that
   the clip does not infringe.
10. THE published Curator_Terms body SHALL state that the curator is solely responsible for the
    curator's clips and indemnifies the System against claims arising from those clips.
11. THE published Curator_Terms body SHALL state that the curator agrees to the Community
    Guidelines and the Copyright Policy, will post neither infringing content nor unlicensed music
    or audio, and that repeat infringers may be suspended or terminated.
12. THE System SHALL permit at most one current, non-deleted `policy_versions` row for
    `doc = 'curator'`, and SHALL maintain exactly one current row for `doc = 'curator'` once that
    `doc` is published.
13. IF counsel-approved final text is seeded as a new `policy_versions` row for `doc = 'curator'`,
    THEN THE System SHALL adopt that text on the next load without overwriting or mutating any
    previously published `policy_versions` row and without requiring any change to client or
    application code.

### Requirement 9: Curator Terms acceptance at Become-a-Curator

**User Story:** As ShowShak activating a new curator, I want the curator to affirmatively accept
the Curator Terms once before the curator role is granted, so that the relationship-level rights
grant and indemnity are recorded and provable, complementing the per-upload attestation.

#### Acceptance Criteria

1. WHEN a Subject reaches the Curator Terms step of the Become_a_Curator_Surface, THE
   Become_a_Curator_Surface SHALL present a Curator_Terms acceptance control that is in the
   unselected state by default on every fresh entry to that step, together with a clickable link
   that opens the Curator_Terms on the Legal_Surface.
2. WHILE the Curator_Terms acceptance control is in the unselected state, THE
   Become_a_Curator_Surface SHALL keep the curator activation control in a disabled state that
   does not respond to click, tap, or keyboard activation.
3. WHEN the Become_a_Curator_Surface presents the Curator_Terms link, THE Become_a_Curator_Surface
   SHALL resolve the single Curator_Terms version marked current in the Policy_Store and SHALL
   reuse that same resolved version identifier for the link, the Legal_Surface display, and the
   persisted Curator-terms acceptance, without re-resolving it during the activation action, so
   that the version shown and linked equals the version stamped.
4. IF a current Curator_Terms version cannot be resolved from the Policy_Store, THEN THE
   Become_a_Curator_Surface SHALL surface a visible indication that the Curator Terms are
   unavailable, SHALL keep the curator activation control disabled, and SHALL NOT bind or persist a
   Curator-terms acceptance against an unresolved version.
5. WHEN the Subject activates the enabled curator activation control in `bcActivate()`, THE System
   SHALL persist exactly one Curator-terms acceptance through the Consent_Recorder before changing
   the account role to curator, reusing the migration `0031` consent record store with an
   Acceptance kind discriminator value of `'curator_terms'`, and capturing the Subject identifier,
   the acceptance timestamp in UTC, the affirmative-acceptance flag, and the accepted
   Curator_Terms version identifier.
6. WHEN the Curator-terms acceptance write path persists a record, THE System SHALL set the Subject
   identifier server-side from the authenticated identity (`auth.uid()`) and SHALL ignore any
   client-supplied identity claim.
7. WHEN a Subject reads Curator-terms acceptance records, THE System SHALL enforce, via row-level
   security keyed on the authenticated identity, that own-row reads return only the Subject's
   matching records and reads for any other Subject's records return zero rows.
8. IF persisting the Curator-terms acceptance fails or the Subject identity cannot be resolved,
   THEN THE System SHALL NOT change the account role to curator, SHALL roll back the write leaving
   no partial record, and SHALL surface a visible indication that the acceptance could not be
   saved.
9. THE accepted Curator_Terms version identifier persisted in a Curator-terms acceptance SHALL
   equal the Curator_Terms version identifier bound at the Become_a_Curator_Surface for that
   acceptance action.
10. THE Curator-terms acceptance record SHALL be retained after the associated account ends, with
    no delete cascade that erases it, and SHALL NOT expose fires-received totals, Watch-It tap
    counts, or pre-Watch-It clip titles.
11. THE System SHALL expose a pure predicate in `showshak-shared.js`, exported on both `window.*`
    and `module.exports` and consistent with the Consent_Validator style, that returns the strict
    boolean `true` only when a Curator-terms acceptance has an affirmative-acceptance flag strictly
    equal to boolean `true` and a Curator_Terms version identifier that is a string whose trimmed
    length is ≥ 1, and otherwise returns the strict boolean `false`, and that for any input value of
    any type SHALL NOT throw, SHALL produce no side effects, SHALL NOT mutate its input, and SHALL
    always return a strict boolean.
12. THE Become_a_Curator_Surface and its curator activation gating SHALL be implemented in
    `showshak-profile.html`, and the Curator-terms acceptance SHALL bind before the `users.role`
    flip performed in `bcActivate()`.
13. THE System SHALL include a fast-check property test for the Curator-terms acceptance predicate
    that runs green under `node tests/run-all.js`.
14. IF the Curator-terms acceptance predicate returns false for the acceptance, THEN THE System
    SHALL NOT persist a Curator-terms acceptance and SHALL NOT change the account role to curator.
