# Design Document

## Overview

This feature builds ShowShak's notice-and-takedown machinery — the **software**, not the law —
that lets the platform stand as a **neutral host**: curators take responsibility for the video
and audio they upload (via an attestation + indemnity accepted at publish time), ShowShak runs
expeditious notice-and-takedown, offers a counter-notice path, and terminates repeat infringers
under a documented policy. The posture mirrors DMCA §512 safe-harbor mechanics and India's IT
Rules 2021 intermediary/grievance obligations.

**This is strategy, not legal advice.** Every piece of legal prose this feature renders (Terms
of Service, Privacy Policy, Copyright/DMCA Policy, Community/Repeat-Infringer Policy, the
attestation wording, statutory notices, counter-notice copy, Grievance-Officer details, the
repeat-infringer `threshold`/`windowDays`) is **placeholder content that MUST carry the visible
marker "counsel review required"** until IP counsel signs off. The design ships the surfaces and
the state machine; counsel supplies the words.

### How it fits the existing architecture

The design reuses what already exists and mirrors the established `stack-sharing` pattern
(RLS as the security boundary + `SECURITY DEFINER` RPCs as the only privileged write/read paths +
pure, dual-exported, fast-check-tested helpers in `showshak-shared.js` for UI/UX only):

- **`content.status`** already supports `processing | live | removed | draft` (migration `0001`).
  `removed` is the takedown target. The existing `read_live_content` policy already gates public
  reads to `status = 'live' AND deleted_at is null` — removal therefore *already* hides a clip
  everywhere the moment its status flips to `removed`. We confirm and lean on this, not rebuild it.
- **The upload publish flow** (`showshak-upload.html` → `publish()`) inserts a `content` row at
  `status = 'processing'`; the **`mux-webhook`** Edge Function later flips it `processing → live`.
  That webhook flip is the single chokepoint where a clip becomes public, so the attestation
  guarantee (Req 10.3) is enforced there *and* by a DB trigger, never by UI alone.
- **The `reports` table** (`0001`: `reporter_id, content_id, reason, status ∈ open|actioned|rejected`)
  stays exactly as it is. See "Extend `reports` or add a new table?" below — we add new tables and
  do **not** touch `reports`, satisfying the Non-Regression requirement.
- **Edge Functions** follow the existing `supabase/functions/*` Deno pattern (`mux-upload-url`,
  `mux-webhook`, `_shared/cors.ts`, `_shared/verify-signature.ts`).
- **Migrations** are founder-applied manually; current max is `0028`, so this feature's migrations
  start at **`0029`** and split by phase (`0029` Phase 1, `0030` Phase 2).

### Neutral-host legal posture (strategy summary)

ShowShak stores and serves curator-supplied media without endorsing or curating specific
copyrighted works. Three structural guardrails (Req 10) keep the product from drifting into
inducement: (1) no system-supplied library/picker of specific copyrighted songs or media;
(2) no onboarding/upload/help copy that names or recommends a specific copyrighted work to upload;
(3) no code path publishes a clip to `live` without a recorded accepted attestation — enforced in
the database, so a future music/audio feature inherits the same gate automatically.

### Sacred-rule alignment

Removal is an RLS guarantee, never UI-only — a `removed` clip returns **zero rows** to any
anonymous or non-privileged viewer query, independent of the client. The moderation surface is
gated to service-role/admin by RLS (non-admin → zero rows). Nothing in this feature exposes
fires-received totals, Watch-It tap counts, or pre-Watch-It titles on any public surface, and the
intake form never requires or renders a pre-Watch-It clip title. The player, CDN/MP4 pipeline, and
Feed are untouched.

## Architecture

```
                          ┌─────────────────────────────────────────────────────────┐
   PHASE 1: POSTURE & INTAKE                                                          │
                          │                                                           │
 Curator publishes clip   │   showshak-upload.html publish()                          │
   │                      │     │ records attestation (RPC ss_record_attestation)     │
   ▼                      │     ▼                                                      │
 attestations row  ◀──────┤   content row status='processing'                         │
 (kept forever)           │     │                                                      │
                          │     ▼  mux-webhook flips processing→live                  │
                          │   TRIGGER content_requires_attestation  ──┐                │
                          │     (rejects →'live' with no attestation) │ Req 10.3       │
                          │                                            ▼               │
 Anonymous complainant    │   showshak-dmca.html (public intake form, no login)        │
   │                      │     │ POST                                                 │
   ▼                      │     ▼                                                      │
 Edge fn submit-takedown ─┼──▶ ssDmcaNoticeWellFormed(notice)  (re-validated server)   │
   │ well-formed          │     │ ok → RPC ss_submit_complaint (SECURITY DEFINER)      │
   ▼                      │     ▼                                                      │
 complaints row state='received' + receivedAt(UTC) + public confirmation ref           │
   │                      │     │ atomically appends moderation_log 'received'         │
   └──────────────────────┼─────┴────────── policy_versions (immutable, addressable)   │
                          │                  4 policy surfaces (showshak-legal.html)    │
                          └───────────────────────────────────────────────────────────┘
                          ┌─────────────────────────────────────────────────────────┐
   PHASE 2: WORKFLOW & COMPLIANCE                                                      │
                          │                                                            │
 Admin (showshak-moderation.html, RLS-gated to admin) │                               │
   │ acknowledge/review/action/reject/reinstate        │                              │
   ▼                                                    ▼                              │
 RPC ss_moderate_complaint(complaintId, event)                                         │
   │ 1) ssComplaintTransition(state,event) → next | INVALID                            │
   │ 2) if INVALID → error, no change (Req 9.6)                                         │
   │ 3) append moderation_log entry  (Req 9.7/9.8 — log BEFORE commit)                 │
   │ 4) on 'action'  → content.status='removed'   + record strike (Req 6.1)            │
   │ 5) on 'reinstate' → content.status='live'     + void strike (Req 6.2)             │
   ▼                                                                                   │
 complaints.state advanced  ──▶ RLS hides/show clip everywhere                          │
                                                                                       │
 Curator counter-notice (showshak-counter-notice.html, owner-gated)                    │
   │ RPC ss_file_counter_notice → state 'actioned'→'counter_received' + counterFiledAt │
   ▼                                                                                   │
 Reinstatement check (founder-run / admin) ssReinstatementDue(...) + no escalation     │
   │ → ss_moderate_complaint('reinstate')                                              │
   ▼                                                                                   │
 Repeat-infringer: ssRepeatInfringerDecision(strikes,threshold,windowDays,now)         │
   │ true → ss_terminate_curator (audit-logged; account state from audit log)          │
   ▼                                                                                   │
 SLA clocks: ssAckClockState(receivedAt,ackedAt,now) + 15-day resolution clock         │
                          └────────────────────────────────────────────────────────── ┘
```

**The security boundary is the database.** Pure JS functions (`ss*`) decide UI/UX and are
re-validated server-side; they are never the enforcement point. Every state-changing path goes
through a `SECURITY DEFINER` RPC that (a) re-runs the relevant pure-function logic in SQL/Deno,
(b) writes the audit entry, and (c) mutates state — atomically, in that order.

### Extend `reports` or add a new table? (decision)

**Decision: add a new `complaints` table; leave `reports` untouched.** Rationale:

- The Non-Regression requirement demands existing `reports` rows keep their behavior and that new
  moderation columns/tables be **additive**. Bolting a 7-state machine, counter-notice fields,
  non-account complainant identity, SLA timestamps, and a public confirmation reference onto the
  bare `reports` table (`reporter_id, content_id, reason, status ∈ open|actioned|rejected`) would
  change its shape and its `status` domain — a regression risk and a muddier model.
- `reports` is an **authenticated in-product "report this clip"** affordance (it has a
  `reporter_id` FK to `users`). DMCA intake must accept **non-account, non-logged-in** complainants
  (Req 3.1), which `reports.reporter_id → users` cannot represent cleanly.
- A dedicated `complaints` table gets its own closed 7-state domain, its own RLS, and its own audit
  trail without disturbing the lightweight reports path. The two can be reconciled later if desired
  (a `reports` row could spawn a `complaints` row), but that is out of scope here.

## Data Models

All new tables follow repo conventions: `uuid` PK (`gen_random_uuid()`), `created_at`/`updated_at`/
`deleted_at` timestamps, and a `meta jsonb default '{}'` bucket — except the audit log, which is
**append-only and therefore has no `updated_at`/`deleted_at`** (those would imply mutability the
trigger forbids). All timestamps are stored in UTC (`timestamptz`).

The data model is designed **complete up front** (Phase 2 tables included) even though the founder
applies it in two phased migrations, so the schema never needs reshaping mid-feature.

### Migration `0029` — Phase 1: posture, policy, intake, audit

```sql
-- attestations — Req 1. One row per accepted attestation; retained forever (Req 1.7, 8.7),
-- never cascade-deleted with the clip.
create table attestations (
  id                 uuid primary key default gen_random_uuid(),
  clip_id            uuid not null references content(id),   -- NO on delete cascade (Req 1.7/4.11)
  curator_id         uuid not null references users(id),
  accepted_at        timestamptz not null,                   -- UTC acceptance time (Req 1.3)
  tos_version        text not null,                           -- accepted ToS version (Req 1.3)
  attestation_version text not null,                          -- accepted attestation copy version
  created_at timestamptz default now(), updated_at timestamptz,
  deleted_at timestamptz, meta jsonb default '{}'
);
create index idx_attestations_clip    on attestations (clip_id);
create index idx_attestations_curator on attestations (curator_id);

-- policy_versions — Req 2. Immutable, addressable revisions of the four policy documents.
-- (doc, version) is unique; prior versions are never overwritten (Req 2.6, 2.7).
create table policy_versions (
  id             uuid primary key default gen_random_uuid(),
  doc            text not null check (doc in ('tos','privacy','copyright','community')),
  version        text not null,                  -- semantic or dated label (Req 2.4)
  effective_date date not null,                  -- visible effective date (Req 2.4)
  body           text not null,                  -- placeholder legal prose ("counsel review required")
  is_current     boolean not null default false, -- exactly one current per doc (enforced by partial index)
  created_at timestamptz default now(), updated_at timestamptz,
  deleted_at timestamptz, meta jsonb default '{}',
  unique (doc, version)
);
create unique index uq_policy_current on policy_versions (doc) where is_current;

-- complaints — Req 3,4,5,7. The notice-and-takedown row. Accepts non-account complainants
-- (complainant_* are free text, no FK to users). New table, NOT an extension of `reports`.
create table complaints (
  id                  uuid primary key default gen_random_uuid(),
  state               text not null default 'received'
                        check (state in ('received','acknowledged','under_review',
                                         'actioned','rejected','counter_received','reinstated')),
  -- target
  content_id          uuid references content(id),       -- existing clip id (nullable: may be a URL only)
  target_url          text,                               -- 1..2000 chars when no clip id (Req 3.2b)
  -- DMCA notice elements (Req 3.2)
  work_identification text not null,                       -- 1..2000 (Req 3.2a)
  complainant_name    text not null,                       -- 1..200  (Req 3.2c)
  complainant_email   text not null,                       -- local@domain.tld (Req 3.2d)
  good_faith          boolean not null,                    -- affirmation (Req 3.2e)
  accuracy_authority  boolean not null,                    -- penalty-of-perjury affirmation (Req 3.2f)
  signature           text not null,                       -- 1..200 (Req 3.2g)
  -- lifecycle timestamps
  received_at         timestamptz not null,                -- UTC receipt; SLA anchor (Req 3.5, 7.2)
  acked_at            timestamptz,                          -- set on acknowledge (Req 7.4)
  -- counter-notice (Req 5)
  counter_statement   text,                                 -- 1..5000 when present (Req 5.3)
  counter_contact     text,                                 -- 1..500 when present (Req 5.3)
  counter_signature   text,                                 -- 1..200 when present (Req 5.3)
  counter_filed_at    timestamptz,                          -- reinstatement-window anchor (Req 5.5)
  escalation_at       timestamptz,                          -- complainant court action recorded (Req 5.9)
  -- public, unguessable confirmation reference, unique across all complaints (Req 3.5)
  confirmation_ref    text not null unique default ('SS-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
  created_at timestamptz default now(), updated_at timestamptz,
  deleted_at timestamptz, meta jsonb default '{}'
);
create index idx_complaints_state   on complaints (state);
create index idx_complaints_content on complaints (content_id);
create index idx_complaints_received on complaints (received_at);

-- moderation_log — Req 8. Append-only, immutable audit trail. No updated_at/deleted_at by design
-- (immutability is the contract). Repeat-infringer strikes are DERIVED from these rows (Req 6.6).
create table moderation_log (
  id            uuid primary key default gen_random_uuid(),
  action_type   text not null check (action_type in (
                  'received','acknowledged','under_review','actioned','rejected',
                  'counter_received','reinstated','strike_recorded','strike_voided',
                  'account_terminated','termination_failed')),   -- recognized set (Req 8.2)
  complaint_id  uuid,                          -- affected complaint (no FK: log outlives complaints — Req 8.7)
  clip_id       uuid,                          -- affected clip      (no FK: outlives content)
  curator_id    uuid,                          -- attributed curator (no FK: outlives users)
  actor_id      uuid,                          -- acting party (admin/service; null for anon-intake 'received')
  occurred_at   timestamptz not null default clock_timestamp(),  -- UTC, ms precision (Req 8.1)
  detail        jsonb not null default '{}',   -- e.g. {confirmation_ref}, {reason}, strike window context
  created_at    timestamptz default now()
);
create index idx_modlog_complaint on moderation_log (complaint_id, occurred_at);
create index idx_modlog_clip       on moderation_log (clip_id, occurred_at);
create index idx_modlog_curator    on moderation_log (curator_id, occurred_at);
```

**Strike representation (Req 6).** A "strike" is **not** a stored table — it is **derived from the
`moderation_log`**: a strike for a curator exists for each `strike_recorded` entry that does not
have a corresponding later `strike_voided` entry for the same `complaint_id`. This makes the strike
count and termination decision provable purely from the immutable log (Req 6.6) and makes voiding
on reinstatement (Req 6.2) a matter of appending a `strike_voided` entry — never mutating history.

### Migration `0030` — Phase 2: account-termination marker (additive)

```sql
-- Repeat-infringer suspension/termination state on the existing users row (additive markers,
-- mirroring the 0025 account-lifecycle pattern). The DECISION + COUNT remain derived from the
-- audit log; these columns are the applied OUTCOME, written only by ss_terminate_curator.
alter table users add column if not exists infringer_terminated_at timestamptz;
alter table users add column if not exists infringer_suspended_at  timestamptz;
```

`threshold` and `windowDays` are **not** columns and **not** hardcoded outside the policy surface
(Req 6.5) — they live only as placeholder copy in the Community/Repeat-Infringer Policy
(`policy_versions` row, `doc='community'`), are read from there by the admin tooling, and are passed
as arguments into `ssRepeatInfringerDecision`.

## RLS Policies

RLS is the enforcement boundary. Admin/service identity is determined the same way the existing
analytics/account RPCs establish privilege — via `SECURITY DEFINER` RPCs and a service-role check;
direct table access for non-privileged callers returns zero rows.

```sql
-- ── content: removal already hides everywhere (confirm + rely, do not rebuild) ──
-- Existing policy from 0001 is exactly right and unchanged:
--   read_live_content: using (deleted_at is null and status = 'live')
-- A clip with status='removed' (or deleted_at set) therefore returns ZERO rows to any
-- anonymous/non-privileged SELECT (Req 4.8). No new content policy is needed; `ss_moderate_complaint`
-- flips status to 'removed'/'live' via SECURITY DEFINER, so it bypasses the read policy to write.

-- ── attestations: owner may read their own; intake/anon may not read at all ──
alter table attestations enable row level security;
create policy attestations_read_own on attestations for select
  using (curator_id = auth.uid());
-- INSERT happens only via ss_record_attestation (SECURITY DEFINER) — no direct insert policy.

-- ── policy_versions: current + prior versions are world-readable (they are public legal text) ──
alter table policy_versions enable row level security;
create policy policy_versions_read on policy_versions for select
  using (deleted_at is null);
-- INSERT/UPDATE restricted to service role (founder publishes new versions out of band).

-- ── complaints: NO public/owner read. The moderation queue is admin/service only (Req 9.2/9.3) ──
alter table complaints enable row level security;
-- (no select policy for anon/authenticated → zero rows for non-service callers)
create policy complaints_admin_read on complaints for select
  using (ss_is_admin());                       -- helper: true only for service-role/admin identities
-- Anonymous INTAKE never does a raw insert — it calls ss_submit_complaint (SECURITY DEFINER).
-- A complainant learns ONLY their confirmation_ref (returned by the RPC), never a row read.

-- ── moderation_log: admin/service read; APPEND-ONLY for everyone incl. service (Req 8.4–8.6) ──
alter table moderation_log enable row level security;
create policy modlog_admin_read on moderation_log for select
  using (ss_is_admin());

-- Append-only is enforced at the DATABASE level by a trigger that hard-rejects UPDATE and DELETE
-- for ALL roles, including service_role — independent of any client/RLS logic (Req 8.4/8.5/8.6):
create or replace function moderation_log_immutable() returns trigger
  language plpgsql as $$
begin
  raise exception 'moderation_log is append-only (% rejected)', tg_op;
end; $$;
create trigger trg_modlog_no_update before update on moderation_log
  for each row execute function moderation_log_immutable();
create trigger trg_modlog_no_delete before delete on moderation_log
  for each row execute function moderation_log_immutable();
-- A BEFORE trigger fires for the table owner and service role too, so even a service-role
-- UPDATE/DELETE raises — the immutability is not merely an RLS policy a privileged role could skip.

-- ── attestation gate: no clip reaches 'live' without an accepted attestation (Req 10.3/10.5) ──
create or replace function content_requires_attestation() returns trigger
  language plpgsql as $$
begin
  if new.status = 'live' and (old.status is distinct from 'live') then
    if not exists (select 1 from attestations a where a.clip_id = new.id) then
      raise exception 'cannot publish clip % to live without an accepted attestation', new.id;
    end if;
  end if;
  return new;
end; $$;
create trigger trg_content_attestation before update on content
  for each row execute function content_requires_attestation();
```

`ss_is_admin()` is a small `SECURITY DEFINER` helper returning true only for the service role /
designated admin identity (the founder); it mirrors how privileged reads are gated elsewhere. Every
moderation read on the client uses the service role through the moderation RPCs, so a normal
authenticated user hitting `complaints`/`moderation_log` directly gets **zero rows** (Req 9.3).

### Public takedown intake — how an anonymous insert is allowed safely

There is **no open insert policy** on `complaints`. The public form (servable to anyone, no login —
Req 3.1) calls the **`submit-takedown` Edge Function**, which re-validates with
`ssDmcaNoticeWellFormed` and then calls the **`ss_submit_complaint(payload jsonb)`**
`SECURITY DEFINER` RPC. The RPC re-validates server-side, inserts the row with `state='received'`
and `received_at = now()`, appends the `received` audit entry **in the same transaction**, and
returns only the `confirmation_ref`. An anonymous caller can therefore *create* a well-formed
complaint but can never *read* the queue, *choose* a state, or *enumerate* anything — the classic
stack-sharing "privileged RPC is the only write path" shape applied to intake.

## Components and Interfaces

### Pure correctness-property functions (`showshak-shared.js` — DOM-free, never throw, dual-exported, fast-check-tested)

Mirroring the established `ssStackCanView` pattern: each function is added to both the
`if (typeof window !== 'undefined')` block and the `module.exports` block, lives beside its
guards/constants, tolerates malformed input by returning a safe value rather than throwing, and is
the spec the corresponding SQL/Deno re-validation must honor. The JS layer is **UI/UX + server
re-validation input**, never the security boundary.

Sentinel for the state machine: `SS_COMPLAINT_INVALID = '__invalid__'` — a constant distinguishable
from every valid state value (none of the seven valid states equals it), exported alongside the
functions so callers compare against the named constant.

```js
// ── Req 1.8 ──────────────────────────────────────────────────────────────────
ssAttestationComplete(attestation, requiredVersion) -> boolean
// inputs:  attestation = { curator_id|accepting_user_id, accepted_at, tos_version, attestation_version }
//          requiredVersion = comparable version (string/number) the accepted versions must meet/exceed
// returns: true IFF ALL hold:
//   • accepting user id is a non-empty string
//   • accepted_at is a valid timestamp (parseable, finite)
//   • tos_version is recorded (non-empty)
//   • attestation_version is recorded (non-empty)
//   • compareVersion(tos_version)        >= requiredVersion  AND
//     compareVersion(attestation_version) >= requiredVersion
//   else false. Null/undefined attestation → false.
// edge cases: empty-string ids/versions → false; unparseable accepted_at → false; missing
//   requiredVersion treated as the lowest possible bound (any recorded version satisfies it).

// ── Req 3.6 ──────────────────────────────────────────────────────────────────
ssDmcaNoticeWellFormed(notice) -> { ok: boolean, missing: string[] }
// Pure, NO side effects, NO external state (Req 3.6). Validates every Req 3.2 element:
//   work_identification : string, length 1..2000
//   target              : content_id (non-empty) OR target_url (string length 1..2000)  [one required]
//   complainant_name    : string, length 1..200
//   complainant_email   : matches /^[^@\s]+@[^@\s]+\.[^@\s]+$/  (local@domain.tld)
//   good_faith          : === true
//   accuracy_authority   : === true
//   signature           : string, length 1..200
// returns ok = (missing.length === 0); missing = identifiers of each failing element (stable keys,
//   e.g. 'work_identification','target','complainant_email',...) so the caller names them (Req 3.4).
// edge cases: null/undefined notice → { ok:false, missing:[all keys] }; whitespace-only strings
//   count as empty (length after trim is 0); over-bound strings fail.

// ── Req 4.2/4.3/4.4 ───────────────────────────────────────────────────────────
ssComplaintTransition(state, event) -> nextState | SS_COMPLAINT_INVALID
// The state machine. `event` is the admin/system action. Permitted transitions ONLY (Req 4.3):
//   (received,            'acknowledge') -> 'acknowledged'
//   (acknowledged,        'review')      -> 'under_review'
//   (under_review,        'action')      -> 'actioned'
//   (under_review,        'reject')      -> 'rejected'
//   (actioned,            'counter')     -> 'counter_received'
//   (counter_received,    'reinstate')   -> 'reinstated'
// ANY other (state,event) — unknown state, unknown event, or a disallowed pair — returns
//   SS_COMPLAINT_INVALID. Total function over all inputs; never throws (Req 4.2/4.4).

// ── Req 4.9 ──────────────────────────────────────────────────────────────────
ssContentPubliclyVisible(content, viewerId) -> boolean
// returns true IFF content.status === 'live' AND content.deleted_at is unset (null/undefined).
// false otherwise — explicitly false when status === 'removed' OR deleted_at is set.
// (viewerId is accepted for signature symmetry/future use; visibility here does not depend on it —
//  this is the public-surface predicate, mirroring the read_live_content RLS policy.) Null content → false.

// ── Req 5.7 ──────────────────────────────────────────────────────────────────
ssReinstatementDue(counterFiledAt, now, minDays, maxDays) -> boolean
// elapsedDays = (now - counterFiledAt) in days. returns true IFF minDays <= elapsedDays <= maxDays
//   (inclusive both bounds). false otherwise, including null counterFiledAt or unparseable inputs.
// edge cases: now before counterFiledAt → elapsed negative → false; minDays>maxDays → always false.

// ── Req 6.3 ──────────────────────────────────────────────────────────────────
ssRepeatInfringerDecision(strikes, threshold, windowDays, now) -> boolean
// strikes = array of { timestamp, voided?:boolean }. Counts strikes where voided !== true AND
//   timestamp within [now - windowDays, now] inclusive of BOTH bounds. returns true IFF
//   count >= threshold, else false. edge cases: empty/non-array strikes → 0 → false (unless
//   threshold<=0); voided strikes never counted (Req 6.2); out-of-window strikes excluded.

// ── Req 7.3 ──────────────────────────────────────────────────────────────────
ssAckClockState(receivedAt, ackedAt, now) -> 'pending_within_sla' | 'acknowledged' | 'breached'
// SS_ACK_SLA_HOURS = 36 (single source of truth, dual-exported).
//   ackedAt non-null                              -> 'acknowledged'
//   ackedAt null AND (now-receivedAt) >  36h       -> 'breached'      (strictly greater)
//   ackedAt null AND (now-receivedAt) <= 36h       -> 'pending_within_sla'
// Returns exactly one of the three. Unparseable receivedAt with null ackedAt → 'breached'
//   (fail-safe: an unknowable clock is treated as needing attention).
```

### Impure helpers (`showshak-shared.js`, window-only — mirror the `_ssDb*` / RPC-wrapper pattern)

```js
ssRecordAttestation(clipId, tosVersion, attestationVersion)  // → rpc('ss_record_attestation', …)
ssSubmitTakedown(notice)        // client-side ssDmcaNoticeWellFormed gate → POST submit-takedown fn → {confirmation_ref} | {missing}
ssLoadPolicyVersion(doc, ver)   // → rpc('ss_get_policy_version', …); error if version unavailable (Req 2.8)
ssModerateComplaint(id, event)  // admin → rpc('ss_moderate_complaint', …); maps INVALID → error toast (Req 9.6)
ssFileCounterNotice(id, fields) // curator → rpc('ss_file_counter_notice', …)
ssAckRemainingMinutes(receivedAt, now) // whole-minutes-to-36h, for the SLA countdown (Req 7.5)
ssResolutionRemainingHours(receivedAt, now) // whole-hours-to-15-days, resolution SLA (Req 7.6)
```

### Edge Functions / RPCs

Server-side pieces, mirroring `supabase/functions/*` (Deno) and the stack-sharing
`SECURITY DEFINER` RPC style. Each state mutation re-runs pure-function logic server-side and writes
the audit entry **in the same transaction** as the state change (Req 9.7/9.8).

| Server piece | Type | Purpose | Validates / writes |
|---|---|---|---|
| `submit-takedown` | Edge Function (Deno, anon-allowed) | Public intake endpoint for non-logged-in complainants. Re-runs `ssDmcaNoticeWellFormed`; on `ok` calls `ss_submit_complaint`; else returns `missing[]`. CORS-open like other functions. | Req 3.1, 3.3, 3.4 |
| `ss_submit_complaint(payload jsonb)` | RPC, `SECURITY DEFINER`, `anon` execute | Re-validate well-formedness in SQL; insert `complaints` (`state='received'`, `received_at=now()`); append `moderation_log('received')` same tx; return `{confirmation_ref}`. The only complaint write path for anon. | Req 3.5, 7.2, 8.1 |
| `ss_record_attestation(p_clip_id, p_tos_version, p_attestation_version)` | RPC, `SECURITY DEFINER`, `authenticated` | Insert one `attestations` row (curator = `auth.uid()`, `accepted_at=now()`). Caller owns the clip. Failure → no row, error surfaced (Req 1.4). | Req 1.3, 1.4 |
| `ss_get_policy_version(p_doc, p_version)` | RPC, readable | Return the exact stored `body`/`version`/`effective_date`; error if `(doc,version)` not found — never substitute (Req 2.7, 2.8). | Req 2.7, 2.8 |
| `ss_moderate_complaint(p_id, p_event)` | RPC, `SECURITY DEFINER`, admin-gated | Load state → `ssComplaintTransition(state,event)`; if INVALID → error, no change (Req 9.6). Else: append matching `moderation_log` entry; on `action` set `content.status='removed'` + append `strike_recorded`; on `reject` no clip change; on `reinstate` set `content.status='live'` + append `strike_voided`; on `acknowledge` set `acked_at`. All atomic; if the log append fails the transition rolls back (Req 8 / 9.8). | Req 4.7, 4.10, 6.1, 6.2, 7.4, 9.5–9.8 |
| `ss_file_counter_notice(p_id, p_statement, p_contact, p_signature)` | RPC, `SECURITY DEFINER`, owner-gated | Allowed only when state = `actioned` (Req 5.1/5.2); validate the three fields' bounds (Req 5.3/5.4); reject duplicate if already `counter_received` (Req 5.6); on success transition `actioned → counter_received` via `ssComplaintTransition` + record `counter_filed_at`; append audit. | Req 5.1–5.6 |
| `ss_terminate_curator(p_curator_id)` | RPC, `SECURITY DEFINER`, admin-gated | Recompute strikes from `moderation_log`, run `ssRepeatInfringerDecision` with policy `threshold`/`windowDays`; if true set `users.infringer_terminated_at` + append `account_terminated`; on failure leave account unchanged, append `termination_failed`, return error naming the curator (Req 6.9). | Req 6.4, 6.6–6.9 |

The `submit-takedown` function re-validates rather than trusting the client (defense in depth);
`ss_submit_complaint` re-validates a third time in SQL so even a direct RPC call cannot persist a
malformed notice. This three-layer validation around the pure `ssDmcaNoticeWellFormed` spec mirrors
how `mux-upload-url`/`mux-webhook` re-check auth and signatures server-side.

## Surfaces / UI

All surfaces are vanilla HTML/CSS/JS (no build step), title-blind, and scoreboard-safe — no
fires-received totals, Watch-It tap counts, or pre-Watch-It titles anywhere (Req 2.10, 8.9).

| Surface | File | Audience | Notes |
|---|---|---|---|
| Four policy pages | `showshak-legal.html?doc=tos\|privacy\|copyright\|community` | Public | One page, four addressable docs (or four sections); each shows version + effective date (Req 2.4) and the "counsel review required" marker (Req 2.5). Copyright doc links to intake (Req 2.9, 3.8) and shows Grievance-Officer details (Req 7.1). Community doc states `threshold`/`windowDays` as placeholder copy (Req 6.5). |
| Public takedown intake | `showshak-dmca.html` | Anyone, no login | Captures all Req 3.2 elements with client-side `ssDmcaNoticeWellFormed` gating; submits via `ssSubmitTakedown`; shows the unique `confirmation_ref` on success (Req 3.5). Never asks for / renders a clip title (Req 3.7). |
| Counter-notice | `showshak-counter-notice.html?complaint=<id>` | Affected curator (owner-gated) | Visible/actionable only when the complaint is `actioned` (Req 5.1/5.2); the three bounded fields; placeholder statutory copy (Req 5.10). |
| Attestation step | injected into `showshak-upload.html` publish flow | Curator | A required checkbox/affirmation step before `publish()` fires; placeholder indemnity copy marked "counsel review required" (Req 1.6). Publish is blocked until accepted (Req 1.1/1.2); on accept, `ssRecordAttestation` runs and only then does the content row proceed (Req 1.3/1.4). |
| Admin moderation review | `showshak-moderation.html` | service-role/admin only | Lists each complaint with state, `received_at`, ack SLA clock, resolution SLA clock (Req 9.1); exactly five actions: acknowledge, move to review, action (remove), reject, record reinstatement (Req 9.4); visually flags breached/near-breach ack clocks (Req 9.9). RLS returns zero rows to non-admins (Req 9.2/9.3) — the gate is the DB, not hidden UI. |
| Settings wiring | `showshak-settings.html` (edit) | All | Replace the four dead `ssToast(...)` legal links — "Terms of Service", "Privacy Policy", "DMCA / report content", and the footer Terms/Privacy/DMCA — with real navigation to the corresponding surfaces (Req 2.1/2.2/2.3, 3.8). The "DMCA / report content" row → `showshak-dmca.html`. No toast in place of navigation (Req 2.3). |

**SLA countdowns (Req 7.5/7.6).** The moderation surface (and, where appropriate, the curator's
view of their own removed clip) computes the remaining time live: whole **minutes** to the 36-hour
ack SLA via `ssAckRemainingMinutes`, and whole **hours** to the 15-day resolution SLA via
`ssResolutionRemainingHours`, with `ssAckClockState` driving the breach/near-breach styling.

## Workflows

**Upload with attestation (Req 1, 10.3).** Curator completes the upload steps → at publish, the
attestation step requires affirmative acceptance → on accept, `ssRecordAttestation` inserts the
`attestations` row → `publish()` inserts the `content` row at `processing` → `mux-webhook` flips it
to `live`, but the `content_requires_attestation` trigger blocks the flip if no attestation row
exists. No attestation, no live clip — anywhere, including future audio features (Req 10.5).

**Anonymous takedown → received (Req 3).** Complainant opens `showshak-dmca.html` (no login) →
fills the notice → client `ssDmcaNoticeWellFormed` gate → `submit-takedown` re-validates →
`ss_submit_complaint` re-validates, inserts `state='received'` + `received_at` (UTC), appends the
`received` audit entry atomically, returns `confirmation_ref` → complainant sees the reference. The
36-hour ack clock starts at `received_at` (Req 7.2).

**Admin acknowledge → review → action/remove (Req 4, 7, 9).** Admin opens the RLS-gated queue →
`acknowledge` (`received→acknowledged`, sets `acked_at`) → `move to review`
(`acknowledged→under_review`; expeditious-removal SLA measured from here, Req 4.6) →
`action` (`under_review→actioned`): `content.status='removed'` (RLS hides it everywhere) + a
`strike_recorded` audit entry, **or** `reject` (`under_review→rejected`, no clip change). Each
action writes its audit entry before reporting success; an invalid transition is refused with the
state unchanged.

**Counter-notice → reinstatement (Req 5).** With the complaint `actioned`, the curator files a
counter-notice on `showshak-counter-notice.html` → `ss_file_counter_notice` validates and
transitions `actioned→counter_received`, recording `counter_filed_at`. Later, a reinstatement check
evaluates `ssReinstatementDue(counter_filed_at, now, minDays, maxDays)`; if true **and** no
`escalation_at` recorded, `ss_moderate_complaint('reinstate')` transitions
`counter_received→reinstated`, sets `content.status='live'`, and appends `strike_voided` (voiding
the strike, Req 6.2). If the complainant escalated first (`escalation_at` set), the clip stays
`removed` and no reinstatement occurs (Req 5.9).

**Repeat-infringer termination (Req 6).** Strikes are derived from `moderation_log`
(`strike_recorded` minus matching `strike_voided`). `ss_terminate_curator` recomputes the
non-voided strike count within the rolling window and runs `ssRepeatInfringerDecision` against the
policy's `threshold`/`windowDays`; on `true` it sets the termination marker and audit-logs it; on
failure it leaves the account unchanged, logs `termination_failed`, and returns an error naming the
curator.

**SLA clock computation/surfacing (Req 7).** For each open complaint the moderation surface derives
ack state (`ssAckClockState`), minutes-to-ack-breach, and hours-to-resolution-breach from
`received_at`/`acked_at`/`now`, flags breached ack clocks (Req 7.7) and >15-day unresolved
complaints (Req 7.8), and renders the Grievance-Officer block from placeholder copy (Req 7.1).

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a
system — essentially, a formal statement about what the system should do. Properties serve as the
bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Generative property-based testing applies cleanly here because the feature's heart is **seven pure decision
functions** with large/infinite input spaces (arbitrary attestation objects, notice objects,
state/event pairs, content rows, and time/threshold arithmetic). Each property below maps to exactly
one named function, was derived from the prework analysis, and is implemented as a **single
fast-check property test (≥100 iterations)** in `tests/`, dual-exported from `showshak-shared.js`,
and tagged with the feature name and property number (see Testing Strategy). The surrounding DB/RLS/RPC behavior
(removal hiding, append-only log, atomic audit-before-commit, uniqueness, no-cascade retention) is
verified by integration tests and the manual RLS check page, **not** by property tests, per the
prework classifications.

### Property 1: Attestation completeness

*For any* attestation object and any `requiredVersion`, `ssAttestationComplete(attestation,
requiredVersion)` returns `true` if and only if the attestation has a non-empty accepting user id, a
valid (parseable) acceptance timestamp, a recorded (non-empty) Terms-of-Service version, a recorded
(non-empty) attestation version, AND both recorded versions are greater than or equal to
`requiredVersion`; otherwise it returns `false` (and never throws, including for null/partial input).

**Validates: Requirements 1.8**

### Property 2: DMCA notice well-formedness

*For any* notice object, `ssDmcaNoticeWellFormed(notice)` returns `{ ok, missing }` where `ok` is
`true` if and only if every Requirement 3.2 element is present and within bounds (work identification
1–2,000 chars; a clip id or a 1–2,000-char URL; complainant name 1–200 chars; email matching
`local@domain.tld`; good-faith `true`; accuracy/authority `true`; signature 1–200 chars), and
`missing` lists exactly the identifiers of the elements that are absent or invalid (empty iff `ok`).
The function produces no side effects and does not mutate its input.

**Validates: Requirements 3.2, 3.4, 3.6**

### Property 3: Complaint state machine

*For any* `state` and `event` values, `ssComplaintTransition(state, event)` returns the documented
next state for exactly the six permitted forward transitions (`received→acknowledged`,
`acknowledged→under_review`, `under_review→actioned`, `under_review→rejected`,
`actioned→counter_received`, `counter_received→reinstated`) and returns `SS_COMPLAINT_INVALID` — a
sentinel distinguishable from every one of the seven valid states — for all other pairs, including
unknown states or events. Every non-invalid output is itself a member of the closed state set.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 4: Public visibility predicate

*For any* content row and any `viewerId`, `ssContentPubliclyVisible(content, viewerId)` returns
`true` if and only if `content.status === 'live'` and `content.deleted_at` is unset, and returns
`false` otherwise — in particular it returns `false` whenever `content.status === 'removed'` or
`content.deleted_at` is set. This mirrors the `read_live_content` RLS rule that hides removed clips.

**Validates: Requirements 4.9**

### Property 5: Reinstatement window

*For any* `counterFiledAt`, `now`, `minDays`, and `maxDays`, `ssReinstatementDue(counterFiledAt, now,
minDays, maxDays)` returns `true` if and only if the elapsed time from `counterFiledAt` to `now`,
expressed in days, is greater than or equal to `minDays` AND less than or equal to `maxDays`
(inclusive of both bounds); it returns `false` otherwise, including when elapsed time is negative,
when `counterFiledAt` is null/unparseable, or when `minDays > maxDays`.

**Validates: Requirements 5.7**

### Property 6: Repeat-infringer decision

*For any* array of strikes (each with a timestamp and an optional `voided` flag) and any `threshold`,
`windowDays`, and `now`, `ssRepeatInfringerDecision(strikes, threshold, windowDays, now)` returns
`true` if and only if the count of non-voided strikes whose timestamps fall within the rolling window
`[now - windowDays, now]` (inclusive of both bounds) is greater than or equal to `threshold`, and
returns `false` otherwise. Voided strikes and out-of-window strikes are never counted.

**Validates: Requirements 6.2, 6.3**

### Property 7: Acknowledgement-SLA clock state

*For any* `receivedAt`, `ackedAt`, and `now`, `ssAckClockState(receivedAt, ackedAt, now)` returns
exactly one of `'acknowledged'`, `'breached'`, or `'pending_within_sla'`: `'acknowledged'` when
`ackedAt` is non-null; `'breached'` when `ackedAt` is null and the elapsed time from `receivedAt` to
`now` is strictly greater than 36 hours; and `'pending_within_sla'` when `ackedAt` is null and the
elapsed time is less than or equal to 36 hours.

**Validates: Requirements 7.3**

## Error Handling

- **Attestation not accepted / record fails (Req 1.2, 1.4):** publish is blocked client-side; if
  `ss_record_attestation` errors, no attestation row is written, the clip stays in its current
  status, and the curator sees an "attestation could not be saved" message. The
  `content_requires_attestation` trigger is the backstop — a `processing→live` flip with no
  attestation row raises, so the webhook leaves the clip `processing`.
- **Malformed notice (Req 3.4):** `submit-takedown` returns the `missing[]` from
  `ssDmcaNoticeWellFormed`; the form names each failing element; **no** `complaints` row is created.
  Re-validation runs in the Edge Function and again in `ss_submit_complaint`, so a crafted direct RPC
  call cannot bypass it.
- **Policy version unavailable (Req 2.8):** `ss_get_policy_version` errors when `(doc, version)` is
  not found and never substitutes another version's text; the surface shows an "unavailable version"
  message.
- **Invalid transition (Req 4.4, 9.6):** `ss_moderate_complaint` maps `SS_COMPLAINT_INVALID` to an
  error, leaves the stored `state` and `content.status` untouched, and the admin sees "transition not
  permitted".
- **Audit-before-commit atomicity (Req 9.7, 9.8):** the audit append and the state mutation happen in
  one transaction; if the append fails, the whole transaction rolls back and the action reports
  failure — the state never advances without its log entry.
- **Counter-notice in wrong state / duplicate / malformed (Req 5.2, 5.4, 5.6):** `ss_file_counter_notice`
  rejects with a specific message and preserves the complaint state and `content.status` unchanged.
- **Termination failure (Req 6.9):** the account state is left unchanged, a `termination_failed`
  audit entry is appended, and the RPC returns an error naming the affected curator.
- **Append-only violations (Req 8.5, 8.6):** any UPDATE/DELETE on `moderation_log` — from any role,
  including service — raises at the DB level via the immutability trigger.
- **Anonymous-intake abuse (anti-abuse):** the public form is the only open surface, so it is the
  attack surface. Mitigations: the Edge Function applies basic rate-limiting/size caps and CORS like
  the other functions; `ss_submit_complaint` is the sole write path (no raw insert), so an attacker
  can only create well-formed `received` rows, never read/enumerate the queue or set arbitrary state;
  the **queue-for-review default (Req 4.5)** means a flood of notices cannot auto-hide any clip — a
  human reviewer must transition to `actioned`, which is the deliberate false-takedown trade-off the
  requirements already settled (protect curators, preserve expeditiousness via the SLA).

## Testing Strategy

**Dual approach.** Property tests verify the seven pure functions across their full input space; unit
and integration tests verify specific examples, side effects, and DB/RLS guarantees that are not
universal-over-inputs.

**Property tests (fast-check, `tests/`, ≥100 iterations each, dual-exported helpers).** One test per
property above:
- Property 1 → `ssAttestationComplete` (generators: random presence/absence of each field, empty
  strings, bad timestamps, versions above/below `requiredVersion`).
- Property 2 → `ssDmcaNoticeWellFormed` (well-formed and each-element-broken notices; whitespace-only;
  over-bound strings; malformed emails; clip-id vs URL target; assert input not mutated).
- Property 3 → `ssComplaintTransition` (arbitrary `state`/`event` strings incl. the seven valid
  states and the six valid events; assert the invalid sentinel ≠ any valid state).
- Property 4 → `ssContentPubliclyVisible` (random `status` ∈ the four values + arbitrary, random
  `deleted_at` set/unset).
- Property 5 → `ssReinstatementDue` (random `counterFiledAt`/`now`/`minDays`/`maxDays`, incl. negative
  elapsed and `minDays > maxDays`; assert inclusive boundaries).
- Property 6 → `ssRepeatInfringerDecision` (strike arrays with random timestamps + voided flags,
  random `threshold`/`windowDays`/`now`; assert window inclusivity and voided exclusion).
- Property 7 → `ssAckClockState` (random `receivedAt`/`ackedAt`/`now`; assert the 36h strict boundary
  and three-way totality).

Each test carries a tag comment naming the feature and its property number (e.g. `Feature:
dmca-moderation-scaffolding, Property 3`) and the full suite must stay green via **`node tests/run-all.js`** at every phase checkpoint (Non-Regression 3).

**Integration / example tests (not PBT — per prework):** anonymous intake accepted without login
(3.1); re-validation precedes insert (3.3); confirmation-ref uniqueness (3.5); `actioned` sets
`content.status='removed'` and `reinstated` sets it back (4.7/4.10); attestation/audit retained after
removal (4.11/8.7); single-strike idempotence (6.1); audit-before-commit + rollback (9.7/9.8);
policy-version round-trip and missing-version error (2.7/2.8).

**Manual DB/RLS verification (mirrors `showshak-rls-check.html`):** add a `showshak-dmca-rls-check.html`
(or extend the existing check page) that, run as anon and as a normal authenticated user, confirms:
a `removed` clip returns zero rows from `content` (4.8); `complaints` and `moderation_log` return zero
rows to non-admin (9.2/9.3); a direct UPDATE/DELETE on `moderation_log` raises for every role
(8.4–8.6); and a `processing→live` flip with no attestation row raises (10.3). These are DB guarantees
the founder verifies after applying each migration in the SQL editor.

## Phasing

Built in two phases that match the requirements; the data model (both migrations' tables) is designed
up front so nothing reshapes mid-feature, the Feed never breaks, and `node tests/run-all.js` stays
green at each checkpoint.

**Phase 1 — Posture & Intake.** Migration `0029` (`attestations`, `policy_versions`, `complaints`,
`moderation_log`, the immutability trigger, the attestation gate trigger, RLS). Pure functions
`ssAttestationComplete`, `ssDmcaNoticeWellFormed`, `ssContentPubliclyVisible` + their property tests.
Surfaces: the four policy pages (`showshak-legal.html`), the public intake form (`showshak-dmca.html`),
the attestation step injected into `showshak-upload.html`, and the wired-up `showshak-settings.html`
legal links. Edge Function `submit-takedown` + RPCs `ss_submit_complaint`, `ss_record_attestation`,
`ss_get_policy_version`. Neutral-host guardrails (Req 10) apply throughout. At this checkpoint the
takedown is *received and logged*; nothing is removed yet.

**Phase 2 — Workflow & Compliance.** Migration `0030` (account-termination markers). Pure functions
`ssComplaintTransition`, `ssReinstatementDue`, `ssRepeatInfringerDecision`, `ssAckClockState` + their
property tests. RPCs `ss_moderate_complaint` (transition + removal/reinstatement + strike record/void,
atomic with audit), `ss_file_counter_notice`, `ss_terminate_curator`. Surfaces: the RLS-gated admin
moderation review (`showshak-moderation.html`) with SLA clocks and the five actions, and the curator
counter-notice surface (`showshak-counter-notice.html`). This phase activates expeditious removal,
counter-notice/reinstatement, repeat-infringer termination, and the grievance SLA clocks — each
flipping `content.status` so the existing RLS hides/shows the clip, and the player and Feed remain
untouched.
