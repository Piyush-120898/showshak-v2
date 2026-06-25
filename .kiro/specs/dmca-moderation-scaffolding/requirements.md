# Requirements Document

## Introduction

ShowShak lets curators upload short vertical clips that recommend shows and movies. Those
clips contain video and audio the curator supplies. That makes copyright the single
largest existential risk for the platform, and a working notice-and-takedown system is the
prerequisite for ever shipping a music feature. This feature builds that system as **real,
property-tested software** — the machinery, not the law.

**Legal posture (strategy, not legal advice).** ShowShak operates as a **neutral host**:
the curator who uploads a clip takes responsibility for the video and audio in it (via an
attestation and indemnity accepted at upload time); ShowShak runs notice-and-takedown with
expeditious removal of well-formed complaints, offers a counter-notice path, and terminates
repeat infringers under a documented policy. This posture mirrors DMCA §512 safe-harbor
mechanics and India's IT Rules 2021 intermediary/grievance obligations.

**Placeholder legal copy — counsel review required.** This feature ships the *surfaces and
machinery*. Every piece of legal prose it renders (Terms of Service, Privacy Policy,
Copyright/DMCA Policy, Community/Repeat-Infringer Policy, attestation wording, statutory
notices) is **placeholder content that MUST be clearly marked "counsel review required"**
until real IP counsel signs off. Nothing in this document or the feature is legal advice.

**What this builds on (do not duplicate).** A bare `reports` table already exists from
migration `0001` (`id, reporter_id, content_id, reason, status` ∈ `open|actioned|rejected`,
`created_at, updated_at, meta`). `content.status` already supports
`processing|live|removed|draft` — the `removed` state is the takedown target. Soft deletes
via `deleted_at` exist everywhere. `showshak-settings.html` has DEAD placeholder links
("DMCA / report content", "Terms of Service", "Privacy Policy", "Report a problem") that
currently only fire `ssToast()`; these become real, reachable surfaces. The founder applies
migrations manually (currently at `0028`; the next would be `0029`), so this document is
implementation-aware but contains no migration SQL.

**Sacred-rule alignment.** Removal is enforced by Row-Level Security so a removed clip
disappears from every public surface and the feed, never UI-only (HIDE THE SCOREBOARD and
title-blind rules are unaffected — moderation surfaces never expose fires-received totals,
Watch-It taps, or pre-Watch-It titles publicly). The admin/moderation surface is gated to
service-role/admin via RLS. Neutral-host guardrails keep ShowShak from drifting into
inducement (no "use this copyrighted song" library; the platform never curates specific
copyrighted content).

**Phasing (build order; the data model is designed for all of it up front).**
- *Phase 1 — Posture & Intake:* attestation + indemnity at upload (Req 1), real
  Terms/Privacy/Copyright/Community policy surfaces (Req 2), the public takedown intake form
  + well-formedness validator (Req 3), and the append-only audit log (Req 8). Neutral-host
  guardrails (Req 10) apply throughout.
- *Phase 2 — Workflow & Compliance:* the complaint state machine + expeditious-removal
  behavior with RLS hiding (Req 4), counter-notice & reinstatement (Req 5), repeat-infringer
  counting & termination (Req 6), India IT Act grievance-officer SLA clocks (Req 7), and the
  internal moderation review surface (Req 9).

**Correctness properties (pure, dual-exported `window.*` + `module.exports`, fast-check
tested via `node tests/run-all.js`).** Mirroring the established `ssStackCanView` pattern:
- `ssDmcaNoticeWellFormed(notice)` — DMCA-notice well-formedness validator (Req 3).
- `ssComplaintTransition(state, event)` — complaint state-machine transition validator (Req 4, 5).
- `ssAckClockState(receivedAt, ackedAt, now)` — 36-hour acknowledgement clock + SLA state (Req 7).
- `ssRepeatInfringerDecision(strikes, threshold, windowDays, now)` — termination decision (Req 6).
- `ssReinstatementDue(counterFiledAt, now, minDays, maxDays)` — counter-notice reinstatement window (Req 5).
- `ssContentPubliclyVisible(content, viewerId)` — RLS-visibility predicate for removed content (Req 4).
- `ssAttestationComplete(attestation, requiredVersion)` — upload attestation completeness (Req 1).

## Glossary

- **Neutral host** — ShowShak's legal posture: it stores and serves curator-supplied media
  without endorsing or curating specific copyrighted works; responsibility rests with the
  curator.
- **Curator** — a user with `role = 'curator'` who uploads clips.
- **Complainant / Rights holder** — the party submitting a copyright complaint; MAY be a
  non-account, non-logged-in person.
- **Attestation** — the curator's affirmative statement at upload that they hold the rights
  to the clip's video and audio and accept responsibility/indemnity, recorded with who,
  when, and which policy versions were in effect.
- **Indemnity** — the curator's acceptance (within the attestation) of responsibility for
  claims arising from their uploaded clip; placeholder copy, counsel review required.
- **Policy document** — a versioned legal surface: Terms of Service, Privacy Policy,
  Copyright/DMCA Policy, or Community/Repeat-Infringer Policy.
- **Policy version** — an immutable, identifiable revision of a policy document (e.g. a
  semantic version or dated label) referenced by attestations and acknowledgements.
- **Takedown notice / Complaint** — a copyright complaint submitted through intake; a row in
  the moderation store carrying the standard DMCA elements.
- **Well-formed notice** — a complaint that contains every required DMCA element in a
  structurally valid form, as decided by `ssDmcaNoticeWellFormed`.
- **Complaint state** — one of `received | acknowledged | under_review | actioned | rejected |
  counter_received | reinstated`.
- **Expeditious removal** — the operational promise to hide/remove infringing content
  promptly after a well-formed notice; defined precisely in Requirement 4.
- **Removed** — `content.status = 'removed'`: the clip is hidden from every public surface
  and the feed by RLS.
- **Counter-notice** — a statement filed by the affected curator contesting a removal.
- **Reinstatement window** — the waiting period after a valid counter-notice before the clip
  may be reinstated, absent a complainant court action.
- **Strike / Substantiated infringement** — a complaint resolved as `actioned` against a
  given curator, counted toward the repeat-infringer threshold.
- **Repeat-infringer policy** — the documented rule that terminates/suspends a curator at a
  strike threshold within a rolling window.
- **Grievance Officer** — the named, India-resident officer required by the IT Rules 2021,
  displayed publicly, who must acknowledge complaints within 36 hours.
- **Acknowledgement SLA** — the 36-hour clock from complaint receipt to acknowledgement.
- **Audit log** — an append-only, immutable record of every moderation action, kept for
  legal defensibility.
- **Moderation review surface** — the internal, admin-only screen for triaging the complaint
  queue and taking actions.
- **System** — the ShowShak application (web client, Supabase Postgres + Auth + Storage +
  Edge Functions, RLS).

## Requirements

### Requirement 1: Creator attestation & indemnity at upload

**User Story:** As ShowShak operating as a neutral host, I want each curator to affirmatively
attest they hold the rights to a clip's video and audio and accept responsibility before it
publishes, so that responsibility rests with the uploader and the attestation is provable
later.

#### Acceptance Criteria
1. WHEN a curator attempts to publish a clip, THE System SHALL require the curator to
   affirmatively accept the attestation and indemnity statement before the clip transitions
   from `draft` or `processing` to `live`.
2. IF the attestation and indemnity statement has not been affirmatively accepted by the
   curator, THEN THE System SHALL reject the publish request, SHALL leave the clip in its
   current `draft` or `processing` status, and SHALL surface an indication that attestation
   acceptance is required.
3. WHEN a curator accepts the attestation, THE System SHALL record, as a single attestation
   record, the accepting user id, the acceptance timestamp in UTC, the accepted
   Terms-of-Service version, and the accepted attestation version.
4. IF recording the attestation record fails, THEN THE System SHALL NOT set the clip's status
   to `live`, SHALL leave the clip in its current status, and SHALL surface an error indicating
   the attestation could not be saved.
5. WHEN queried by clip id or by curator id, THE System SHALL return every recorded attestation
   matching that identifier.
6. THE attestation statement SHALL place responsibility for the clip's video and audio on the
   curator and SHALL be rendered as placeholder copy marked "counsel review required."
7. THE System SHALL retain each attestation record indefinitely, including after the associated
   clip is removed or soft-deleted, so the acceptance remains provable.
8. THE System SHALL expose a pure function `ssAttestationComplete(attestation, requiredVersion)`
   that returns true only when the attestation contains a non-empty accepting user id, a valid
   acceptance timestamp, a recorded Terms-of-Service version, and a recorded attestation
   version, and both recorded versions are greater than or equal to `requiredVersion`;
   otherwise it SHALL return false.

### Requirement 2: Terms of Service & policy surfaces

**User Story:** As a user or rights holder, I want real, versioned Terms of Service, Privacy
Policy, Copyright/DMCA Policy, and Community/Repeat-Infringer Policy pages reachable from
Settings, so that the platform's rules and my options are actually published rather than fake
links.

#### Acceptance Criteria
1. THE System SHALL provide four distinct, independently navigable policy surfaces — Terms of
   Service, Privacy Policy, Copyright/DMCA Policy, and Community/Repeat-Infringer Policy — each
   reachable from `showshak-settings.html` through a dedicated link or control.
2. WHEN a user taps a legal link in `showshak-settings.html` (Terms of Service, Privacy Policy,
   or DMCA / report content), THE System SHALL navigate to the policy surface that corresponds
   to the tapped link.
3. WHEN a user taps a legal link in `showshak-settings.html`, THE System SHALL complete
   navigation to the corresponding policy surface and SHALL NOT display a toast in place of that
   navigation.
4. THE System SHALL display, on each policy surface, a visible policy version identifier (a
   semantic version or dated label) and a visible effective date for that version.
5. THE System SHALL render every policy surface's legal text as placeholder copy clearly marked
   "counsel review required."
6. THE System SHALL retain every prior policy version as an immutable record that remains
   independently addressable by its version identifier.
7. WHEN an attestation or acknowledgement references a prior policy version, THE System SHALL
   return that referenced version's stored legal text unchanged from the version originally
   accepted.
8. IF an attestation or acknowledgement references a policy version that cannot be located, THEN
   THE System SHALL return an error indicating the referenced version is unavailable and SHALL
   NOT substitute a different version's content.
9. WHERE a policy surface concerns copyright, THE System SHALL link to the takedown intake form
   defined in Requirement 3.
10. THE policy surfaces SHALL NOT expose any fires-received totals, Watch-It tap counts, or
    pre-Watch-It clip titles.

### Requirement 3: Takedown / copyright-complaint intake

**User Story:** As a rights holder who may not have a ShowShak account, I want a public intake
form that captures a complete copyright complaint, so that I can request removal of an
infringing clip and the platform can act on a well-formed notice.

#### Acceptance Criteria
1. THE System SHALL serve the takedown intake form to any request, including requests with no
   authenticated session and no associated ShowShak account, and SHALL accept a submission from
   such a request without requiring login or account creation.
2. THE intake form SHALL require the following elements before submission is permitted: (a)
   identification of the copyrighted work as text of 1 to 2,000 characters; (b) identification
   of the allegedly infringing clip as either an existing clip id or a URL of 1 to 2,000
   characters; (c) complainant name as text of 1 to 200 characters; (d) complainant contact
   email matching the pattern `local@domain.tld`; (e) a good-faith-belief statement affirmation;
   (f) an accuracy-and-authority statement affirmation acknowledging penalty of perjury; and (g)
   an electronic signature as non-empty text of 1 to 200 characters.
3. WHEN a complaint is submitted, THE System SHALL validate its well-formedness by invoking
   `ssDmcaNoticeWellFormed(notice)` before creating any complaint record.
4. IF `ssDmcaNoticeWellFormed(notice)` reports the complaint as not well-formed, THEN THE System
   SHALL reject the submission, SHALL NOT create a complaint record, and SHALL return a message
   that names each element from criterion 2 that is missing or invalid.
5. WHEN a well-formed complaint is accepted, THE System SHALL persist it with state `received`
   and a receipt timestamp recorded in UTC, and SHALL display to the complainant a confirmation
   reference that is unique across all persisted complaints.
6. THE System SHALL expose a pure function `ssDmcaNoticeWellFormed(notice)` that returns a
   structured result indicating (a) a boolean of whether every element required by criterion 2
   is present and valid, and (b) for each element that is missing or invalid, an entry
   identifying that element, while producing no side effects and no external state changes.
7. THE intake form SHALL NOT require the complainant to provide, and SHALL NOT render or
   transmit to the complainant, any pre-Watch-It clip title.
8. THE System SHALL render a link to the public takedown intake form on the Copyright/DMCA
   Policy surface and on the Settings "DMCA / report content" row.

### Requirement 4: Takedown workflow & expeditious removal

**User Story:** As ShowShak maintaining safe-harbor posture, I want a defined complaint
workflow and a precise removal behavior that hides infringing clips through RLS, so that
expeditious removal is real and consistent.

#### Acceptance Criteria
1. THE System SHALL model each complaint with exactly one state drawn from the closed set
   `received | acknowledged | under_review | actioned | rejected | counter_received |
   reinstated`, and SHALL reject any attempt to set a state outside this set.
2. THE System SHALL expose a pure function `ssComplaintTransition(state, event)` that returns
   the resulting state for a permitted transition and an invalid result, distinguishable from
   every valid state value, for any disallowed transition.
3. THE System SHALL permit only these forward transitions: `received → acknowledged`,
   `acknowledged → under_review`, `under_review → actioned`, `under_review → rejected`,
   `actioned → counter_received`, and `counter_received → reinstated`.
4. IF a transition not permitted by criterion 3 is attempted, THEN `ssComplaintTransition`
   SHALL return its invalid result and THE System SHALL leave the stored complaint state
   unchanged.
5. **Default removal aggressiveness decision:** WHEN a complaint becomes well-formed and is
   accepted, THE System SHALL queue it for human review and SHALL NOT auto-hide the targeted
   clip until a reviewer transitions the complaint to `actioned`.
   *(Decision rationale — trade-off: immediate auto-hide on any well-formed notice maximizes
   the strength of the "expeditious" safe-harbor signal but invites false-takedown abuse that
   silences legitimate curators; queue-for-review with a hard SLA preserves expeditiousness
   while protecting curators. Given ShowShak's creator-first sacred rule and small launch
   volume, the platform chooses **queue-for-review with a fast SLA**. This default is an
   explicit, revisitable requirement, not an implementation detail.)*
6. THE System SHALL define **expeditious removal** operationally as: a reviewer SHALL action or
   reject each well-formed complaint within the Grievance-Officer SLA window defined in
   Requirement 7, measured from the complaint's entry into `under_review`.
7. WHEN a complaint transitions to `actioned`, THE System SHALL set the targeted clip's
   `content.status` to `removed`.
8. WHILE a clip's status is `removed`, THE database SHALL exclude that clip from every public
   surface and from the feed via RLS, such that an anonymous or non-privileged viewer query
   returns zero rows for that clip, independent of any client-side filtering.
9. THE System SHALL expose a pure function `ssContentPubliclyVisible(content, viewerId)` that
   returns true if and only if `content.status = 'live'` and `content.deleted_at` is unset, and
   returns false otherwise (including whenever `content.status = 'removed'` or
   `content.deleted_at` is set).
10. WHEN a complaint transitions to `reinstated`, THE System SHALL set the targeted clip's
    `content.status` back to `live` so the clip is re-included on public surfaces via RLS.
11. THE removal of a clip SHALL NOT delete its attestation record (Requirement 1) or its
    audit-log entries (Requirement 8).

### Requirement 5: Counter-notice & reinstatement

**User Story:** As a curator whose clip was removed, I want to file a counter-notice and have
my clip reinstated after the waiting period if the complainant does not escalate, so that
false or contested takedowns are correctable.

#### Acceptance Criteria
1. WHERE a complaint is in state `actioned`, THE System SHALL allow the affected curator to file
   a counter-notice.
2. IF a curator attempts to file a counter-notice while the complaint is in any state other than
   `actioned` (including `counter_received` or `reinstated`), THEN THE System SHALL reject the
   filing, SHALL display an error indicating the complaint is not in a counter-noticeable state,
   and SHALL preserve the existing complaint state and the clip's `content.status` unchanged.
3. THE counter-notice SHALL capture the curator's statement (1 to 5,000 characters inclusive),
   contact details (1 to 500 characters inclusive), and an electronic signature (1 to 200
   characters inclusive), and THE System SHALL validate that all three fields are present and
   within their specified character bounds before accepting it.
4. IF a submitted counter-notice is malformed (any required field missing, empty, or exceeding
   its specified character bound), THEN THE System SHALL reject the counter-notice, SHALL display
   an error indicating which field failed validation, and SHALL preserve the complaint in state
   `actioned` with the clip's `content.status` unchanged.
5. WHEN a well-formed counter-notice is accepted, THE System SHALL transition the complaint to
   `counter_received` and record the counter-notice filing timestamp.
6. IF a counter-notice is submitted for a complaint already in state `counter_received`, THEN THE
   System SHALL reject the duplicate submission, SHALL display an error indicating a
   counter-notice has already been filed, and SHALL preserve the recorded counter-notice and its
   filing timestamp unchanged.
7. THE System SHALL expose a pure function `ssReinstatementDue(counterFiledAt, now, minDays,
   maxDays)` that returns true only when the elapsed time from `counterFiledAt` to `now` is
   greater than or equal to `minDays` AND less than or equal to `maxDays`, and returns false
   otherwise.
8. WHEN `ssReinstatementDue` returns true for a complaint in state `counter_received` AND no
   complainant escalation has been recorded, THE System SHALL transition the complaint to
   `reinstated` and set the clip's `content.status` from `removed` to `live`.
9. IF a complainant escalation is recorded for a complaint in state `counter_received` before
   `ssReinstatementDue` returns true, THEN THE System SHALL keep the clip's `content.status` as
   `removed` and SHALL NOT transition the complaint to `reinstated`.
10. THE counter-notice copy and statutory wording SHALL be rendered as placeholder content marked
    "counsel review required."

### Requirement 6: Repeat-infringer policy & termination

**User Story:** As ShowShak preserving safe-harbor eligibility, I want to count substantiated
infringements per curator over time and terminate accounts at a documented threshold, so that
repeat infringers are removed under a consistent, provable rule.

#### Acceptance Criteria
1. WHEN a complaint against a curator transitions to `actioned`, THE System SHALL atomically
   record exactly one substantiated infringement (strike) attributed to that curator, stamped
   with the timestamp of the `actioned` transition, and SHALL record no additional strike on any
   repeated or duplicate `actioned` transition for the same complaint.
2. IF a complaint that previously transitioned to `actioned` is later `reinstated`, THEN THE
   System SHALL void the associated strike and exclude it from every repeat-infringer threshold
   count.
3. THE System SHALL expose a pure function `ssRepeatInfringerDecision(strikes, threshold,
   windowDays, now)` that returns `true` when the count of non-voided strikes whose timestamps
   fall within the rolling window beginning at `now - windowDays` and ending at `now`, inclusive
   of both bounds, is greater than or equal to `threshold`, and returns `false` otherwise.
4. WHEN `ssRepeatInfringerDecision` returns `true` for a curator, THE System SHALL suspend or
   terminate that curator's account in accordance with the documented Community/Repeat-Infringer
   Policy.
5. THE repeat-infringer `threshold` and `windowDays` values SHALL be defined only in the
   Community/Repeat-Infringer Policy surface (Requirement 2) as placeholder copy marked "counsel
   review required," and THE System SHALL NOT hardcode these values in any other location.
6. THE strike count and termination decision SHALL be derivable solely from the audit log so that
   the outcome is provable after the fact.
7. WHEN a strike is recorded on an `actioned` transition, THE System SHALL write one audit log
   entry capturing the attributed curator identity, the originating complaint reference, and the
   strike timestamp.
8. WHEN a strike is voided on a `reinstated` transition, THE System SHALL write one audit log
   entry capturing the attributed curator identity, the originating complaint reference, and the
   void timestamp.
9. IF the suspension or termination action triggered by a `true` decision fails to complete, THEN
   THE System SHALL leave the curator's account state unchanged, write an audit log entry
   indicating the failed termination attempt, and return an error indication identifying the
   affected curator to the initiating operator.

### Requirement 7: India IT Act 2021 grievance-officer compliance

**User Story:** As an Indian intermediary under the IT Rules 2021, I want a named resident
Grievance Officer displayed and a tracked 36-hour acknowledgement clock with a computable SLA
state, so that the platform meets its statutory acknowledgement and resolution obligations.

#### Acceptance Criteria
1. THE System SHALL display, on both the Copyright/DMCA Policy surface and the contact/grievance
   surface, the Grievance Officer's name, designation, and at least one contact channel (email
   address or postal address), rendered as placeholder copy that includes the visible marker
   "counsel review required."
2. WHEN a complaint is received, THE System SHALL record the receipt timestamp (`receivedAt`) as
   the time the complaint is persisted and SHALL start a 36-hour acknowledgement clock measured
   from `receivedAt`.
3. THE System SHALL expose a pure function `ssAckClockState(receivedAt, ackedAt, now)` that
   returns exactly one of `pending_within_sla`, `acknowledged`, or `breached`, where: the
   function returns `acknowledged` when `ackedAt` is non-null; returns `breached` when `ackedAt`
   is null and the elapsed time from `receivedAt` to `now` is strictly greater than 36 hours;
   and returns `pending_within_sla` when `ackedAt` is null and the elapsed time from
   `receivedAt` to `now` is less than or equal to 36 hours.
4. WHEN the Grievance Officer acknowledges a complaint, THE System SHALL set `ackedAt` to the
   acknowledgement time, transition the complaint state to `acknowledged`, and persist the
   acknowledgement timestamp.
5. WHILE a complaint is open and unacknowledged, THE System SHALL compute and display the
   remaining time, in whole minutes, before the 36-hour acknowledgement SLA is breached.
6. WHILE a complaint is open and unresolved, THE System SHALL compute and display the remaining
   time, in whole hours, before the statutory resolution SLA of 15 days from `receivedAt` is
   breached.
7. IF `ssAckClockState` returns `breached` for a complaint, THEN THE System SHALL flag that
   complaint as acknowledgement-SLA breached on the moderation review surface (Requirement 9).
8. IF an open complaint remains unresolved more than 15 days after `receivedAt`, THEN THE System
   SHALL flag that complaint as resolution-SLA breached on the moderation review surface
   (Requirement 9).

### Requirement 8: Logging / audit trail

**User Story:** As ShowShak needing legal defensibility, I want every moderation action logged
immutably with timestamps, so that the complete history of any complaint is provable and cannot
be silently altered.

#### Acceptance Criteria
1. WHEN any moderation action occurs (notice received, acknowledged, under review, actioned/
   removed, counter-notice received, reinstated, strike recorded, account terminated), THE System
   SHALL append exactly one audit log entry recording the action type, the identifier(s) of the
   affected complaint and/or clip and/or curator, the identifier of the acting party, and a UTC
   timestamp with millisecond precision.
2. IF an action type is not one of the recognized moderation action types, THEN THE System SHALL
   reject the append request and SHALL NOT create an audit log entry.
3. WHEN an audit log entry is appended, THE System SHALL persist it within 1 second of the
   moderation action being committed.
4. THE System SHALL enforce append-only behavior on the audit log through a row-level-security
   or database-level policy, independent of client-side logic.
5. IF any caller (including authenticated, administrative, or service roles) attempts to UPDATE
   an existing audit log entry, THEN THE database policy SHALL reject the operation and the entry
   SHALL remain unchanged.
6. IF any caller (including authenticated, administrative, or service roles) attempts to DELETE
   an existing audit log entry, THEN THE database policy SHALL reject the operation and the entry
   SHALL remain present.
7. THE System SHALL retain every audit log entry indefinitely after the associated clip,
   complaint, or curator account is removed, soft-deleted, or terminated.
8. WHEN a reviewer queries the audit log by complaint identifier, by clip identifier, or by
   curator identifier, THE System SHALL return all matching entries ordered by timestamp
   ascending.
9. THE System SHALL NOT expose fires-received totals, Watch-It tap counts, or pre-Watch-It clip
   titles in any audit log entry surfaced on a public surface.

### Requirement 9: Admin / moderation review surface

**User Story:** As the founder triaging moderation, I want a minimal internal surface showing
the complaint queue, SLA clocks, and the available actions, so that I can act on complaints
within the SLA without exposing anything publicly.

#### Acceptance Criteria
1. WHEN an admin opens the moderation review surface, THE System SHALL list each complaint with
   its current state, receipt timestamp, acknowledgement SLA clock, and resolution SLA clock.
2. THE moderation review surface SHALL be accessible ONLY to service-role/admin identities, and
   THE access restriction SHALL be enforced by RLS rather than by hiding elements in the UI.
3. IF an identity that is not service-role/admin requests moderation data, THEN THE database
   SHALL return zero rows.
4. THE moderation review surface SHALL expose exactly the following per-complaint actions:
   acknowledge, move to review, action (remove), reject, and record reinstatement.
5. WHEN an admin invokes one of the actions in criterion 4, THE System SHALL apply the
   corresponding state transition via `ssComplaintTransition` (Requirement 4).
6. IF `ssComplaintTransition` reports the requested transition as invalid for the complaint's
   current state, THEN THE System SHALL reject the action, leave the complaint state unchanged,
   and return an error indication identifying that the transition is not permitted.
7. WHEN an admin action results in a valid state transition, THE System SHALL write the
   corresponding audit log entry (Requirement 8) before reporting the action as successful.
8. IF the audit log entry for an admin action cannot be written, THEN THE System SHALL not commit
   the state transition and SHALL return an error indication that the action did not complete.
9. WHEN the moderation review surface lists complaints, THE System SHALL visually distinguish
   each complaint whose acknowledgement SLA clock is in a breached or near-breach state as
   reported by `ssAckClockState` (Requirement 7) from complaints in a within-SLA state.

### Requirement 10: Neutral-host guardrails

**User Story:** As ShowShak protecting its neutral-host posture, I want explicit guardrails that
keep the platform from inducing infringement, so that the legal posture is not undermined by
product features.

#### Acceptance Criteria
1. THE System SHALL NOT provide any system-supplied selection control (library, picker, catalog,
   or equivalent) that offers specific copyrighted songs or copyrighted media for curators to
   attach to clips; all of a clip's video and audio SHALL originate from curator-supplied
   uploads.
2. THE System SHALL NOT present, on the upload, onboarding, or in-product help surfaces, copy
   that names or recommends a specific copyrighted work, artist, song, or title for the curator
   to upload.
3. WHEN a clip transitions to `live`, THE System SHALL have recorded an accepted attestation
   (Requirement 1) for that clip, with no code path that publishes a clip without an accepted
   attestation.
4. THE System SHALL keep ShowShak's role described as hosting curator-supplied media rather than
   endorsing or curating specific copyrighted works, in the placeholder policy copy marked
   "counsel review required."
5. WHERE a future music or audio feature is added, WHEN a curator publishes a clip using that
   feature, THE System SHALL require an accepted attestation (Requirement 1) covering the added
   audio before the clip transitions to `live`.
6. WHERE a future music or audio feature is added, THE takedown workflow (Requirement 4) SHALL
   apply to clips using that feature, such that an `actioned` complaint sets `content.status` to
   `removed` and the clip is excluded from public surfaces by RLS.

## Non-Regression

1. THE existing `reports` table and any current report behavior SHALL continue to function; new
   moderation columns/tables SHALL be additive so existing rows keep their behavior.
2. THE `content.status` values `processing | live | removed | draft` SHALL be preserved, with
   `removed` used as the takedown target.
3. THE full property-test suite (`node tests/run-all.js`) SHALL remain green at every phase
   checkpoint, including the new pure-function correctness properties listed in the Introduction.
