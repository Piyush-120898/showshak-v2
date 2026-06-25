# Design Document

## Overview

This feature delivers a **DPDP-grade affirmative consent + 18+ gate** as the real **Step 1** of
onboarding in `index.html`, **seeds the real legal drafts** into the existing `policy_versions`
table so `showshak-legal.html` displays them, and adds the **machinery** to record each consent:
a pure validator (`ssConsentComplete`), a window-only client wrapper (`ssRecordConsent`), and a
new founder-applied migration (`0031`) carrying a `consents` table + an `ss_record_consent`
`SECURITY DEFINER` RPC + own-row RLS.

The **same machinery** also powers a **one-time Curator Terms acceptance at the "Become a
Curator" step** in `showshak-profile.html`. This is a **relationship-level** agreement captured
once when a Subject activates the curator role — distinct from, and complementary to, the
**per-upload DMCA attestation** already shipped in `0029`. It reuses the *same* `consents` store
(via a `kind` discriminator), the *same* `policy_versions` table (a new `doc = 'curator'` row),
the *same* Legal_Surface, and a sibling validator/wrapper pair beside the consent ones. The
Curator Terms version shown and linked at Become-a-Curator is identical to the version stamped on
the recorded acceptance, and the acceptance binds **before** the account role flips to curator.

These pieces ship as **one compliance unit** because of the **version contract**: the
Terms-of-Service, Privacy-Policy, and Curator-Terms links shown MUST display the *same* version
the consent/acceptance record stamps. A gate that records consent to "version X" while showing the
user "version Y" is not informed consent.

**This is strategy, not legal advice.** The `legal/*.md` drafts are India-aware working drafts
that still contain `[PLACEHOLDER]` tokens (entity name, emails, Grievance Officer, version,
effective date). This feature wires the *machinery* so the eventual final-text swap is a
**content / re-seed step, not a code change**.

### How it fits the existing architecture (reuse, do not rebuild)

This feature mirrors the **attestation pattern** already shipped and applied in migration `0029`
(`.kiro/specs/dmca-moderation-scaffolding`). It reuses what `0029` built and adds a sibling
write path:

| Already exists (`0029`) | This feature adds (`0031`) — same shape |
|---|---|
| `policy_versions` table + `ss_get_policy_version(doc, version)` RPC + world-readable RLS | **Reused as-is** — seeded with real `tos`/`privacy` drafts; no schema change |
| `attestations` table + `ss_record_attestation` `SECURITY DEFINER` RPC + own-row RLS (`curator_id = auth.uid()`) | `consents` table + `ss_record_consent` `SECURITY DEFINER` RPC + own-row RLS (`subject_id = auth.uid()`) |
| `ssAttestationComplete(attestation, requiredVersion)` — pure, dual-exported, fast-check-tested validator | `ssConsentComplete(consent)` **and** `ssCuratorTermsAccepted(acceptance)` — pure, dual-exported, fast-check-tested validators beside it |
| `ssRecordAttestation` / `ssLoadPolicyVersion` — window-only, fail-soft RPC wrappers | `ssRecordConsent` / `ssRecordCuratorTerms` / `ssCurrentPolicyVersions` — window-only, fail-soft wrappers beside them |

- **`policy_versions` is NOT recreated.** Migration `0031` references it and a founder-run seed
  publishes the `tos`, `privacy`, **and `curator`** rows.
- **The `consents` store is shared across kinds.** Both the onboarding consent and the Curator
  Terms acceptance write to the **same** `consents` table, distinguished by a `kind` discriminator
  (`'user_consent'` | `'curator_terms'`), through **kind-specific** `SECURITY DEFINER` RPCs. One
  table, one own-row RLS policy, two single-purpose write paths.
- **Migrations are founder-applied manually.** `0030` is RESERVED for DMCA Phase 2; this feature
  uses **`0031`** so it never collides.
- The security boundary is the **database** (RLS + `SECURITY DEFINER` RPC + server-side
  re-validation). The pure JS validator is the gate's enable condition and the spec the SQL
  re-validation honors — never the enforcement point.

### Sacred-rule alignment

The gate adds **exactly one** onboarding step before personal-data collection and nothing more.
No surface this feature touches exposes fires-received totals, Watch-It tap counts, or
pre-Watch-It clip titles. The `consents` store carries none of those columns. A Subject may read
**only their own** consent record, enforced by RLS keyed on `auth.uid()` — never UI-only.

## Architecture

```
  index.html onboarding overlay (self-contained, inline styles — Req 2.9)
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  STEP 1  CONSENT + 18+ GATE   (NEW — the only added step, Req 2.1/7)        │
  │    on open → ssCurrentPolicyVersions()  ── resolves CURRENT tos+privacy ──┐ │
  │                │ ok → bind { tosVersion, privacyVersion } ONCE (Req 4.1/4.2)│
  │                │ miss → "policies unavailable", advance stays OFF (Req 4.6) │
  │    [ ] I affirmatively accept the Terms & Privacy Policy   (unticked, 2.2)  │
  │    [ ] I am 18 years of age or older                       (unticked, 2.3)  │
  │    Terms ↗   Privacy ↗   → open Legal_Surface?doc=&v=<bound> in NEW TAB     │
  │                            (checkbox state preserved — Req 2.4)             │
  │    advance enabled IFF both boxes checked AND policies resolved (inline)    │
  │         │ activate advance (Req 2.10)                                       │
  │         ▼                                                                   │
  │    window.ssRecordConsent({ affirmative, age18plus, tos_version,           │
  │                              privacy_version })                            │
  │         │ 1) ssConsentComplete(consent) → false ? fail, no RPC (Req 6.6)   │
  │         │ 2) resolve identity: ssCurrentUser() ?? signInAnonymously()       │
  │         │       null ? fail, no RPC (Req 3.6 / 6.3)                         │
  │         │ 3) ssDB.rpc('ss_record_consent', …)                              │
  │         ▼                                                                   │
  │      ok → advance to Step 2 (Genres)  │  fail → stay on gate (Req 2.11/3.8)│
  │  STEP 2 Genres → STEP 3 Platforms → STEP 4 Sign-In  (each shifted +1)       │
  └──────────────────────────────────────────────────────────────────────────┘
        │ ss_record_consent (SECURITY DEFINER)                  Legal_Surface
        ▼                                                       (showshak-legal.html)
  subject_id := auth.uid()  (server-side; client claim ignored, Req 3.5)         │
  re-validate flags===true + non-empty versions (Req 3.7) ── mirror ── ssConsentComplete
  insert ONE consents row (accepted_at = now() UTC)  ──┐                          │
  RLS: consents_read_own  using (subject_id = auth.uid())  (own-row only, Req 3.4)│
  policy_versions (reused) ◀── ss_get_policy_version(doc, BOUND version) ─────────┘
  seeded by founder (real tos/privacy drafts) — re-seed = data, not code (Req 1)
```

**Guest-first auth today.** `showshak-supabase.js` creates a single shared anon client
(`window.ssDB`) with the public `anon` key. There is **no Supabase session** until a real
sign-in: `window.ssCurrentUser()` returns `null` for guests, so **`auth.uid()` is `NULL` at gate
time** under the current model. Sign-in is onboarding's last step (Step 4 after this feature), so
consent at Step 1 happens *before* any account exists. Resolving the Subject for an own-row,
RLS-enforced consent record therefore requires an explicit identity decision (below).

**Become-a-Curator flow (`showshak-profile.html`, `#bc-overlay` modal).** The Curator Terms
acceptance reuses the same store and identity model on the curator step of the existing `bcStep`
progression:

```
  #bc-overlay modal — Curator Terms step (the existing final bcStep, Req 9.1/9.12)
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  on entering the step → ssCurrentPolicyVersions({curator:true})            │
  │        ok → bind boundCurator = curator.version ONCE (Req 9.3)             │
  │        miss → "Curator Terms unavailable", activate stays OFF (Req 9.4)    │
  │  [ ] I accept the Curator Terms        (UNTICKED by default, Req 9.1)      │
  │  Curator Terms ↗ → showshak-legal.html?doc=curator&v=<boundCurator>        │
  │                    (NEW TAB; checkbox + modal state preserved, Req 9.1)    │
  │  activate enabled IFF box checked AND boundCurator resolved (Req 9.2/9.4)  │
  │        │ activate (bcActivate)                                            │
  │        ▼                                                                   │
  │  acceptance = { affirmative:true, curator_version:boundCurator }           │
  │  ssCuratorTermsAccepted(acceptance) → false ? abort, NO role flip (9.14)   │
  │  const r = await window.ssRecordCuratorTerms(acceptance)   ◀── BIND FIRST  │
  │        │ r.ok === false → surface error, DO NOT flip role (Req 9.8)        │
  │        ▼ r.ok === true                                                     │
  │  ssBuildOnboardingPatch(...) → users.update({role…})  ◀── role flip (9.5)  │
  └──────────────────────────────────────────────────────────────────────────┘
        │ ss_record_curator_terms (SECURITY DEFINER)
        ▼
  subject_id := auth.uid()  (server-side; reject when null — Req 9.6/9.8)
  re-validate affirmative===true + non-empty curator_version (mirror ssCuratorTermsAccepted)
  insert ONE consents row  kind='curator_terms', curator_version=bound  (Req 9.5)
  RLS: consents_read_own using (subject_id = auth.uid())  (own-row, all kinds — Req 9.7)
  policy_versions (reused) ◀── doc='curator' row seeded by founder (Req 8)
```

A Subject in the curator step **already has a permanent Supabase session** (they signed in during
onboarding to reach a profile), so `auth.uid()` is non-null here without minting an anonymous
session; `ssRecordCuratorTerms` still lazily ensures a session via the **same** identity
resolution `ssRecordConsent` uses, for safety.

## Design Decisions

### Decision 1 — Guest identity: establish an anonymous session lazily at advance

**Decision: Option (a) — mint a Supabase anonymous session so `auth.uid()` is always present,
but do it lazily inside `ssRecordConsent` (only after both boxes are checked and advance is
activated), never on gate render.**

- **Why (a) over a client `guest_id` (b):** Req 3.4 mandates own-row reads enforced by RLS
  "keyed on the authenticated identity (mirroring `curator_id = auth.uid()`)". A client-generated
  `guest_id` is client-supplied and forgeable, so RLS could not safely scope own-row reads by it —
  that would make the read boundary UI-only, violating the sacred rule. A Supabase **anonymous
  session** yields a real `auth.uid()` (a pseudonymous `auth.users` row, `is_anonymous = true`,
  JWT role `authenticated`, no PII), so `consents.subject_id = auth.uid()` is the **identical**
  own-row contract `attestations` already uses. When the Subject later signs in at Step 4,
  Supabase identity-linking preserves the same `uid`, so the consent stays attached to the
  durable account.
- **What `auth.uid()` is at gate time:** under today's model, `NULL` until a session exists.
  `ssRecordConsent` therefore resolves identity as `ssCurrentUser()` and, when `null`, calls
  `window.ssDB.auth.signInAnonymously()` to mint one, then re-reads it. If no identity can be
  established (offline / auth error), the wrapper **fails soft** (returns `{ ok:false }`, no RPC),
  the gate stays put, and nothing is persisted (Req 3.6 / 6.3).
- **DPDP timing (Req 2.7 / 2.8):** the anonymous session is minted **only at the advance action,
  after both boxes are affirmatively checked** — never on render. It carries no
  Subject-identifying data; it is the pseudonymous identity the consent is recorded against, i.e.
  "strictly required to … operate the Consent_Gate" per the glossary carve-out. No genre/platform
  picks or profile data are transmitted before the gate is passed.

### Decision 2 — Consent table shape + RPC + RLS (mirror `0029` attestations)

`consents` mirrors `attestations`: server-set identity, server-set UTC timestamp, recorded
versions, a `meta` bucket, and **no delete cascade** so the record outlives the session (Req 3.9 /
9.10). `ss_record_consent` mirrors `ss_record_attestation`: `SECURITY DEFINER`, locked
`search_path`, sets identity from `auth.uid()`, re-validates server-side, and is the **only**
sanctioned insert path for the `user_consent` kind. Own-row RLS mirrors `attestations_read_own` and
governs **all** kinds. Full SQL in **Data Models** below.

**Shared store, kind discriminator (Req 9.5).** The same `consents` table holds both the
onboarding consent and the Curator Terms acceptance, separated by a
`kind text not null default 'user_consent'` column constrained to `'user_consent' | 'curator_terms'`.
Because the two kinds stamp different version sets, the version columns are **nullable** and used
per-kind:

- `tos_version` / `privacy_version` — **nullable**, populated only for `kind = 'user_consent'`.
- `curator_version` — **nullable** `text`, populated only for `kind = 'curator_terms'`.

A `check` constraint ties each kind to its required columns (user-consent ⇒ non-empty tos+privacy;
curator-terms ⇒ non-empty curator_version) so a malformed row cannot exist regardless of which RPC
wrote it. The **no-FK / no-cascade / own-row-RLS / retained-forever** posture is identical for all
kinds.

### Decision 3 — Version contract: resolve current once, reuse everywhere

The gate resolves the **single current** `tos` and `privacy` versions **once** when Step 1 opens,
via `ssCurrentPolicyVersions()` (a direct read of `policy_versions where is_current and
deleted_at is null` — that table is world-readable). The resolved `{ tosVersion, privacyVersion }`
pair is held in gate state and reused, with **no re-resolve during the advance action** (Req 4.2),
for all three consumers:

1. **Policy links** — `showshak-legal.html?doc=tos&v=<tosVersion>` / `?doc=privacy&v=<privacyVersion>`.
2. **Legal_Surface display** — the page loads the **bound** version via `ssLoadPolicyVersion(doc, v)`
   so the Subject reads exactly what will be stamped (Req 4.4).
3. **Persisted record** — `ssRecordConsent` is called with the same two identifiers (Req 4.3).

If either current version cannot be resolved (no seeded current row, or the read fails), the gate
shows a visible **"policies currently unavailable"** notice and keeps advance **disabled
regardless of checkbox state** (Req 4.5 / 4.6); no consent is bound or persisted against an
unresolved version.

**Curator Terms version contract (Req 9.3 / 9.4 / 9.9).** The same rule governs Become-a-Curator:
the curator step resolves the **single current** `curator` version **once** on entering the step
(via `ssCurrentPolicyVersions({ curator:true })`), binds it to `boundCurator`, and reuses that one
identifier for the policy link (`?doc=curator&v=<boundCurator>`), the Legal_Surface display, and
the persisted acceptance — with no re-resolve during `bcActivate()`. If the current `curator`
version cannot be resolved, the step shows a **"Curator Terms unavailable"** notice, keeps the
activate control disabled, and binds/persists nothing.

### Decision 4 — Seeding as founder-applied data, separate from the migration

- **Schema (machinery)** lives in `supabase/migrations/0031_beta_consent_gate.sql` — the
  `consents` table (with the `kind` discriminator), the `ss_record_consent` and
  `ss_record_curator_terms` RPCs, RLS, grants. Founder applies it once.
- **Policy text (content)** lives in a **separate** founder-run seed,
  `supabase/seed/seed_policy_versions.sql`, which `insert`s the `tos`, `privacy`, **and `curator`**
  rows into the reused `policy_versions` table (verbatim `legal/*.md` body, a non-empty `version`,
  a non-empty `effective_date`, `is_current = true`). Keeping the seed out of the migration means
  the eventual **final-text swap is re-running a seed, not editing a migration or any client
  code** (Req 1.5 / 1.7 / 8.13).
- **The Curator Terms draft must be authored.** `legal/curator-terms.md` does **not** exist yet;
  it is a **new founder-authored, counsel-review-required draft** that must be written before the
  seed can publish it, mirroring the other `legal/*.md` drafts in tone, the
  `<!-- DRAFT — COUNSEL REVIEW REQUIRED -->` header, the `**Version:** [VERSION] · **Effective
  date:** [EFFECTIVE_DATE]` line, and `[PLACEHOLDER]` tokens. Its substance is fully enumerated by
  Req 8.6–8.11 (see Decision 8).
- **Re-seed mechanics (Req 1.3 / 2.8 / 8.12 / 8.13):** publishing counsel-approved final text for
  any `doc` (`tos`, `privacy`, `curator`) inserts a **new** immutable row (new `version`) and
  atomically repoints `is_current` to it (the prior row's `is_current` flips to `false`). The
  partial unique index `uq_policy_current` guarantees at most one current row per `doc`. The
  published **content** of any prior row — `body`, `version`, `effective_date` — is **never**
  altered; only the `is_current` pointer moves, preserving an auditable history. The seed is
  idempotent (guarded `insert … where not exists`).
- **`[PLACEHOLDER]` marker logic (Req 1.4):** while a published body still contains bracketed
  `[…]` tokens, `showshak-legal.html` keeps the visible **"counsel review required"** banner. This
  decision is the pure helper `ssPolicyNeedsCounselReview(body)` (below), so it is provable and
  identical for stored bodies and the built-in placeholder scaffolding.

### Decision 5 — Pure core (mirror `ssAttestationComplete`)

`ssConsentComplete(consent)` is the single pure validator for onboarding consent (the
requirement's `ssConsentComplete` / `ssConsentRecordValid` slash denotes one function; we
standardize on `ssConsentComplete` to mirror `ssAttestationComplete`). `ssCuratorTermsAccepted(acceptance)`
is the sibling pure validator for the Curator Terms acceptance (Req 9.11): `true` only when
`acceptance.affirmative === true` **and** `acceptance.curator_version` is a string with trimmed
length ≥ 1. Both are strict-boolean, total, never-throws, no-mutation, deterministic, and
dual-exported. Signatures + properties in **Components** and **Correctness Properties**.

### Decision 6 — Onboarding integration

The gate is injected as a new **first** panel; Genres/Platforms/Sign-In each shift one place
later (progress goes from 3 nodes to 4 — the single added step, Req 7). Gating (enable/disable the
existing `#ob-next-btn`) is computed by an **inline** function in `index.html` so presentation and
gating have **no external-script dependency** (Req 2.9); that inline check mirrors
`ssConsentComplete`, which the RPC re-validates. Policy links use `target="_blank"` so opening a
policy never dismisses the overlay or resets checkbox state (Req 2.4). On advance, the gate calls
`ssRecordConsent` and **only advances on `{ ok:true }`** (Req 2.10 / 2.11 / 3.8).

### Decision 7 — Sacred rules

`consents` has no fires/tap-count/title columns (Req 3.10 / 9.10); reads are own-row via RLS for
**all kinds** (Req 3.4 / 9.7); exactly one onboarding step is added (Req 7); nothing here surfaces
the scoreboard. **This is strategy, not legal advice** — the `legal/*.md` drafts (including the new
`legal/curator-terms.md`) remain counsel-review-required working drafts with `[PLACEHOLDER]`
tokens, and the Legal_Surface keeps a visible "counsel review required" marker until final
bracket-free text is seeded.

### Decision 8 — Curator Terms: separate single-purpose RPC (not an overloaded `ss_record_consent`)

**Decision: add a sibling `ss_record_curator_terms(p_curator_version text)` `SECURITY DEFINER`
RPC rather than extending `ss_record_consent` with a `kind` parameter and conditional validation.**

- **Why a sibling over an overloaded RPC:** the two kinds re-validate *different* fields
  (user-consent needs `affirmative + age18plus + tos + privacy`; curator-terms needs
  `affirmative + curator_version`). Branching one RPC on `kind` would mean nullable parameters,
  per-kind `if` ladders, and a signature that lies about which arguments matter — the opposite of
  the single-purpose `ss_record_attestation` it mirrors. Two small RPCs each keep their server-side
  re-validation a flat, total check that exactly mirrors one pure validator. This is the same
  "one RPC, one job" shape the rest of the schema uses.
- **What it MUST do (Req 9.5 / 9.6 / 9.8 / 9.14):** set `subject_id = auth.uid()` server-side and
  **reject when null** (`insufficient_privilege`, insert nothing); re-validate server-side
  (`p_affirmative is true` **and** non-empty trimmed `p_curator_version`, else `check_violation`);
  insert **exactly one** `consents` row with `kind = 'curator_terms'`, `curator_version =
  p_curator_version`, `accepted_at = now()` UTC, `affirmative = true`, and `tos_version` /
  `privacy_version` / `age18plus` left `null`; be **transactional** (a failed insert leaves no
  partial row); `grant execute … to authenticated`; `notify pgrst` to reload the schema. SQL in
  **Data Models**.
- **Curator Terms substance (Req 8.6–8.11)** is **content**, carried verbatim by the seeded
  `legal/curator-terms.md` body, not by code. The authored draft MUST state: the curator **retains
  ownership** of their clips (8.6); grants the System a **non-exclusive, worldwide, royalty-free,
  sublicensable License grant** to its infrastructure / CDN / video providers (e.g. Mux) to host,
  store, reproduce, transcode, thumbnail/preview, display, distribute, and promote the clip for as
  long as it is on the platform plus a backup/legal-retention tail (8.7); that the System **claims
  no ownership** and is a **neutral host/showcase** that does not host the underlying shows/movies
  and whose "Watch It" links out to third-party platforms (8.8); the curator's **rights warranty**
  over the clip including video, audio/music, and third-party material (8.9); the curator's **sole
  responsibility + indemnity** (8.10); and the curator's **agreement to the Community Guidelines and
  Copyright Policy, no infringing content, no unlicensed music/audio, and a repeat-infringer
  suspension/termination** clause (8.11). This complements — does not replace — the per-upload DMCA
  attestation from `0029`.

### Decision 9 — Become-a-Curator integration: acceptance is a hard precondition to the role flip

**Decision: bind the Curator Terms acceptance on the existing final `bcStep` of `#bc-overlay`, and
make a successful `ssRecordCuratorTerms` call a hard precondition for the `users.role` flip in
`bcActivate()`.**

- **Today (the gap this closes):** `bcActivate()` flips the role via `ssBuildOnboardingPatch(...)`
  + `ssDB.from('users').update(patch)` **without recording any acceptance**, and the existing
  `bcAgreed` is a **UI-only** boolean. This design replaces that UI-only gate with a recorded,
  version-stamped acceptance.
- **On entering the curator step (Req 9.1 / 9.3):** call `ssCurrentPolicyVersions({ curator:true })`
  **once**, bind `boundCurator`, and set the Curator Terms link `href` to
  `showshak-legal.html?doc=curator&v=<boundCurator>` with `target="_blank"` so opening it never
  dismisses the modal or resets state. If the version does not resolve, show "Curator Terms
  unavailable" and keep activate disabled (Req 9.4).
- **Acceptance control (Req 9.1 / 9.2):** the existing agree control is rendered **UNTICKED by
  default** on every fresh entry (`openBecomeCurator()` already resets `bcAgreed = false`); the
  activate control (`bc-next` on the final step) stays **disabled** until the box is ticked **and**
  `boundCurator` is resolved.
- **On activate (Req 9.5 / 9.8 / 9.14):** `bcActivate()` builds
  `acceptance = { affirmative:true, curator_version: boundCurator }`, gates it through
  `ssCuratorTermsAccepted(acceptance)` (false ⇒ abort, no role flip), then
  `const r = await window.ssRecordCuratorTerms(acceptance)` — **before** the role flip. Only on
  `r.ok === true` does it proceed to `ssBuildOnboardingPatch(...)` + `users.update`. On
  `r.ok === false` it does **not** flip the role and surfaces "couldn't save your acceptance".

## Data Models

`consents` follows repo conventions: `uuid` PK (`gen_random_uuid()`), UTC `timestamptz`,
`created_at`/`updated_at`/`deleted_at`, and a `meta jsonb default '{}'` bucket — mirroring
`attestations` exactly. `subject_id` carries **no FK and no cascade**, mirroring the `0029`
"outlives" rationale, so deleting the (anonymous or permanent) auth user never erases the proof
of consent (Req 3.9 / 9.10). The single table holds **both** acceptance kinds, separated by the
`kind` discriminator and written only by the two kind-specific `SECURITY DEFINER` RPCs.

### Migration `0031_beta_consent_gate.sql` (founder-applied; idempotent, single paste)

```sql
-- ───────────────────────────────────────────────────────────────
-- 1. CONSENTS  (Req 3 / 9 — one row per affirmative consent or curator-terms
--    acceptance, distinguished by `kind`; retained forever)
-- ───────────────────────────────────────────────────────────────
-- Mirrors the 0029 `attestations` shape. subject_id = auth.uid() (anonymous or
-- permanent), set SERVER-SIDE by the RPCs. NO `on delete cascade` and NO FK: the
-- record must OUTLIVE the session/account it belongs to (Req 3.9 / 9.10), exactly
-- like moderation_log's curator_id rationale. Version columns are nullable and
-- used per-kind; check constraints below tie each kind to its required columns.
create table if not exists consents (
  id               uuid primary key default gen_random_uuid(),
  subject_id       uuid not null,                 -- = auth.uid() (anon or permanent) — server-set (Req 3.5 / 9.6)
  kind             text not null default 'user_consent',  -- 'user_consent' | 'curator_terms' (Req 9.5)
  accepted_at      timestamptz not null,          -- UTC acceptance time, server now() (Req 3.1 / 9.5)
  affirmative      boolean not null,              -- affirmative-acceptance flag (Req 3.1 / 9.5)
  age18plus        boolean,                        -- 18+ flag — required for user_consent only (Req 3.1)
  tos_version      text,                           -- accepted ToS version — user_consent only (Req 3.1 / 4.3)
  privacy_version  text,                           -- accepted Privacy version — user_consent only (Req 3.1 / 4.3)
  curator_version  text,                           -- accepted Curator Terms version — curator_terms only (Req 9.5 / 9.9)
  created_at       timestamptz default now(),
  updated_at       timestamptz,
  deleted_at       timestamptz,                   -- present for convention; NEVER set by this feature (Req 3.9 / 9.10)
  meta             jsonb default '{}',
  -- kind is constrained, and each kind requires exactly its own version columns,
  -- so a malformed row cannot exist no matter which RPC wrote it.
  constraint consents_kind_ck check (kind in ('user_consent','curator_terms')),
  constraint consents_user_consent_ck check (
    kind <> 'user_consent' or (
      age18plus is not null
      and tos_version     is not null and char_length(btrim(tos_version))     > 0
      and privacy_version is not null and char_length(btrim(privacy_version)) > 0
    )
  ),
  constraint consents_curator_terms_ck check (
    kind <> 'curator_terms' or (
      curator_version is not null and char_length(btrim(curator_version)) > 0
    )
  )
);
create index if not exists idx_consents_subject  on consents (subject_id);
create index if not exists idx_consents_accepted on consents (accepted_at);
create index if not exists idx_consents_kind     on consents (kind);

-- ───────────────────────────────────────────────────────────────
-- 2. CONSENTS RLS  (own-row read only — Req 3.4)  [mirrors attestations_read_own]
-- ───────────────────────────────────────────────────────────────
-- A Subject may read ONLY their own consent rows of ANY kind; everyone else gets
-- ZERO rows. There is intentionally NO insert policy: rows are created ONLY through
-- the SECURITY DEFINER RPCs (ss_record_consent / ss_record_curator_terms), which set
-- subject_id = auth.uid() server-side — so a client can neither forge nor read
-- another Subject's consent or curator-terms acceptance (Req 3.4 / 9.7).
alter table consents enable row level security;

drop policy if exists consents_read_own on consents;
create policy consents_read_own on consents
  for select using (subject_id = auth.uid());

-- ───────────────────────────────────────────────────────────────
-- 3. ss_record_consent(...)  (Req 3.1/3.5/3.6/3.7/3.8)  [mirrors ss_record_attestation]
-- ───────────────────────────────────────────────────────────────
-- The ONLY sanctioned insert path. Sets subject_id from auth.uid() (ignoring any
-- client-supplied identity), re-validates the consent server-side (the SAME rule
-- ssConsentComplete enforces), inserts exactly one row at accepted_at = now(),
-- and is transactional (a failed insert leaves no partial row — Req 3.8).
create or replace function public.ss_record_consent(
  p_affirmative     boolean,
  p_age18plus       boolean,
  p_tos_version     text,
  p_privacy_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  -- identity must resolve (anonymous or permanent) — else persist nothing (Req 3.6)
  if v_uid is null then
    raise exception 'consent requires a resolved subject identity'
      using errcode = 'insufficient_privilege';
  end if;

  -- server-side re-validation MIRRORS ssConsentComplete (Req 3.7): both flags
  -- strictly true AND both version identifiers non-empty after trim.
  if p_affirmative is not true or p_age18plus is not true
     or p_tos_version is null or char_length(btrim(p_tos_version)) = 0
     or p_privacy_version is null or char_length(btrim(p_privacy_version)) = 0 then
    raise exception 'consent requires affirmative + 18+ true and non-empty tos/privacy versions'
      using errcode = 'check_violation';
  end if;

  insert into consents (subject_id, kind, accepted_at, affirmative, age18plus, tos_version, privacy_version)
  values (v_uid, 'user_consent', now(), true, true, p_tos_version, p_privacy_version)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- ── EXECUTE grant (repo convention) ──
-- Anonymous (pre-session) callers have auth.uid() = null and would be rejected
-- above; once a session exists (anonymous OR permanent) the JWT role is
-- `authenticated`. Grant to authenticated, mirroring ss_record_attestation.
grant execute on function public.ss_record_consent(boolean, boolean, text, text) to authenticated;

-- ───────────────────────────────────────────────────────────────
-- 4. ss_record_curator_terms(...)  (Req 9.5/9.6/9.8/9.14)  [sibling of ss_record_consent]
-- ───────────────────────────────────────────────────────────────
-- The ONLY sanctioned insert path for kind='curator_terms'. Single-purpose: sets
-- subject_id from auth.uid() (rejecting null), re-validates the SAME rule
-- ssCuratorTermsAccepted enforces (affirmative true AND non-empty curator_version),
-- inserts exactly one row at accepted_at = now(), and is transactional (a failed
-- insert leaves no partial row — Req 9.8). Leaves age18plus/tos/privacy null.
create or replace function public.ss_record_curator_terms(
  p_curator_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  -- identity must resolve — else persist nothing AND (caller must not flip role) (Req 9.6/9.8)
  if v_uid is null then
    raise exception 'curator terms acceptance requires a resolved subject identity'
      using errcode = 'insufficient_privilege';
  end if;

  -- server-side re-validation MIRRORS ssCuratorTermsAccepted (Req 9.14): the
  -- curator_version must be non-empty after trim. The affirmative dimension is
  -- structural here — the RPC IS the affirmative act, so it always inserts
  -- affirmative = true, and the client wrapper has already gated on
  -- ssCuratorTermsAccepted (affirmative === true) before calling.
  if p_curator_version is null or char_length(btrim(p_curator_version)) = 0 then
    raise exception 'curator terms acceptance requires a non-empty curator_version'
      using errcode = 'check_violation';
  end if;

  insert into consents (subject_id, kind, accepted_at, affirmative, curator_version)
  values (v_uid, 'curator_terms', now(), true, p_curator_version)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.ss_record_curator_terms(text) to authenticated;

-- Reload PostgREST so the new RPCs + grants are live immediately.
notify pgrst, 'reload schema';
```

### Founder seed `supabase/seed/seed_policy_versions.sql` (data, re-runnable)

```sql
-- Publishes the real tos/privacy drafts into the REUSED policy_versions table
-- (created in 0029). Idempotent: only inserts when that (doc, version) is absent.
-- Re-seeding final counsel text = insert a NEW version row + repoint is_current;
-- prior rows' body/version/effective_date are NEVER mutated (Req 1.3/2.8).
insert into policy_versions (doc, version, effective_date, body, is_current)
select 'tos', '1.0-beta', date '2025-01-01',
       $body$<<< verbatim contents of legal/terms-of-service.md >>>$body$, true
where not exists (select 1 from policy_versions where doc='tos' and version='1.0-beta');

insert into policy_versions (doc, version, effective_date, body, is_current)
select 'privacy', '1.0-beta', date '2025-01-01',
       $body$<<< verbatim contents of legal/privacy-policy.md >>>$body$, true
where not exists (select 1 from policy_versions where doc='privacy' and version='1.0-beta');

-- Curator Terms (Req 8.1) — verbatim body of the NEW founder-authored draft
-- legal/curator-terms.md (must be written first; counsel-review-required).
insert into policy_versions (doc, version, effective_date, body, is_current)
select 'curator', '1.0-beta', date '2025-01-01',
       $body$<<< verbatim contents of legal/curator-terms.md >>>$body$, true
where not exists (select 1 from policy_versions where doc='curator' and version='1.0-beta');

-- When a newer version is later seeded, flip the prior current off in the same
-- run so uq_policy_current (one current per doc) holds:
--   update policy_versions set is_current = false
--    where doc = 'tos' and version <> '<new>' and is_current;
```

## Components and Interfaces

### Pure correctness function (`showshak-shared.js` — DOM-free, never throws, dual-exported, fast-check-tested)

Added beside `ssAttestationComplete` in both the `if (typeof window !== 'undefined')` block and
the consolidated `module.exports` block, so `node tests/run-all.js` can require it (Req 5.9). It
is the gate's enable condition and the spec `ss_record_consent` re-validates — never the security
boundary.

```js
// ── Req 5.1–5.8 ───────────────────────────────────────────────────────────────
ssConsentComplete(consent) -> boolean
// returns the STRICT boolean true IFF ALL hold:
//   • consent is a non-null object
//   • consent.affirmative     === true     (strict boolean; truthy non-booleans → false, Req 5.2)
//   • consent.age18plus       === true     (strict boolean; truthy non-booleans → false, Req 5.3)
//   • typeof consent.tos_version     === 'string' && consent.tos_version.trim().length     >= 1 (Req 5.4)
//   • typeof consent.privacy_version === 'string' && consent.privacy_version.trim().length >= 1 (Req 5.5)
//   else the STRICT boolean false. null/undefined/non-object → false, never throws (Req 5.6/5.7).
// PURE: no side effects, does NOT mutate `consent`, deterministic (Req 5.8).

// ── Req 9.11 ──────────────────────────────────────────────────────────────────
ssCuratorTermsAccepted(acceptance) -> boolean
// returns the STRICT boolean true IFF ALL hold:
//   • acceptance is a non-null object
//   • acceptance.affirmative      === true     (strict boolean; truthy non-booleans → false)
//   • typeof acceptance.curator_version === 'string' && acceptance.curator_version.trim().length >= 1
//   else the STRICT boolean false. null/undefined/non-object → false, never throws.
// PURE: no side effects, does NOT mutate `acceptance`, deterministic. Mirrors
// ssConsentComplete's style; it is the curator step's enable condition and the
// spec ss_record_curator_terms re-validates server-side — never the boundary.

// ── Req 1.4 ─────────────────────────────────────────────────────────────────────
ssPolicyNeedsCounselReview(body) -> boolean
// returns true IFF the policy body still needs the "counsel review required" marker:
//   • body is not a non-empty string  → true  (no real text yet → fail-safe to "show marker")
//   • body contains a bracketed [PLACEHOLDER]-style token (matches /\[[^\]]+\]/) → true
//   • otherwise (a non-empty body with NO bracketed tokens) → false  (final text → suppress marker)
// PURE, never throws, no mutation.
```

### Impure client wrappers (`showshak-shared.js`, window-only — mirror `ssRecordAttestation` / `ssLoadPolicyVersion`)

```js
// ── Req 6 ── window-only, fail-soft, NEVER throws, NOT in module.exports.
ssRecordConsent(consent) -> Promise<{ ok:true, id } | { ok:false, error }>
//   1. gate FIRST with ssConsentComplete(consent) → false ? return {ok:false}, NO RPC (Req 6.5/6.6)
//   2. require window.ssDB → unavailable ? {ok:false}, NO RPC (Req 6.3)
//   3. resolve identity: me = ssCurrentUser(); if null → await ssDB.auth.signInAnonymously();
//      re-read; still null ? {ok:false}, NO RPC (Req 6.3)
//   4. await ssDB.rpc('ss_record_consent', { p_affirmative, p_age18plus,
//          p_tos_version, p_privacy_version })
//   5. res.error ? {ok:false, error} (Req 6.4) : {ok:true, id} (Req 6.2)
//   wrapped in try/catch so it NEVER throws (Req 6.7).

// ── Req 9.5–9.8/9.14 ── window-only, fail-soft, NEVER throws. Mirrors ssRecordConsent.
ssRecordCuratorTerms(acceptance) -> Promise<{ ok:true, id } | { ok:false, error }>
//   1. gate FIRST with ssCuratorTermsAccepted(acceptance) → false ? {ok:false}, NO RPC (Req 9.14)
//   2. require window.ssDB → unavailable ? {ok:false}, NO RPC
//   3. resolve identity via the SAME path ssRecordConsent uses:
//      me = ssCurrentUser(); if null → await ssDB.auth.signInAnonymously(); re-read;
//      still null ? {ok:false}, NO RPC (Req 9.6/9.8)   [curator step normally already has a session]
//   4. await ssDB.rpc('ss_record_curator_terms', { p_curator_version: acceptance.curator_version })
//   5. res.error ? {ok:false, error} (Req 9.8) : {ok:true, id} (Req 9.5)
//   wrapped in try/catch so it NEVER throws. Caller (bcActivate) flips users.role ONLY on {ok:true}.

// ── Req 4.1 / 9.3 ── window-only, fail-soft. Resolves the SINGLE current versions ONCE
// (policy_versions is world-readable, so a direct read). The curator doc is resolved only
// when requested so the gate (tos+privacy) and the curator step (curator) reuse one resolver.
ssCurrentPolicyVersions(opts?) -> Promise<{ ok:true, tos?:{version,effective_date},
                                            privacy?:{version,effective_date},
                                            curator?:{version,effective_date} } | { ok:false }>
//   default (no opts): reads is_current, deleted_at is null rows for ('tos','privacy');
//       ok:true only when BOTH resolve; else {ok:false} → gate shows "policies unavailable".
//   { curator:true }: additionally (or solely, for the Become-a-Curator step) resolves the
//       current 'curator' row; ok:true only when 'curator' resolves; else {ok:false}
//       → curator step shows "Curator Terms unavailable" (Req 9.4).

// Reused unchanged from 0029:
ssLoadPolicyVersion(doc, ver)   // exact addressable read of one immutable policy revision
```

### `index.html` — Consent_Gate (inline, self-contained — Req 2.9)

- **Markup:** a new `#ob-panel-0` (rendered first), two **unticked** checkboxes
  (`#consent-accept`, `#consent-age18`), two `target="_blank"` policy links, and a
  `#consent-policy-status` region for the "policies unavailable" notice. Progress row gains a
  4th node; Genres/Platforms/Sign-In labels shift.
- **On open:** `await ssCurrentPolicyVersions()`; on `ok` store
  `boundTos`/`boundPrivacy` and set the two link `href`s to
  `showshak-legal.html?doc=…&v=<bound>`; on miss show the unavailable notice.
- **Inline gate:** `obConsentReady() = #consent-accept.checked && #consent-age18.checked &&
  policiesResolved` drives `#ob-next-btn.disabled`. Both checkboxes reset to unticked on every
  fresh `openOnboarding()` (Req 2.2 / 2.3).
- **Advance handler** `obConsentAdvance()`: build `consent = { affirmative:true, age18plus:true,
  tos_version:boundTos, privacy_version:boundPrivacy }`; `const r = await
  window.ssRecordConsent(consent)`; `r.ok` ? `showStep(next)` : surface "consent could not be
  saved" and stay (Req 2.10 / 2.11 / 3.8).

### `showshak-legal.html` — Legal_Surface (small enhancements)

- **Resolve current (Req 1.2 / 8.2):** `renderDoc(doc)` resolves the current version (via
  `ssCurrentPolicyVersions()` / `is_current`) instead of a hardcoded `cfg.version`, then loads the
  exact body with `ssLoadPolicyVersion(doc, version)`; on success it renders the stored
  body/version/effective_date and suppresses the built-in scaffolding. **`doc = 'curator'` is
  handled identically to `tos`/`privacy`** — same resolve → load → render → fallback path, with a
  `curator` entry added to the page's `cfg` doc map (title + scaffolding).
- **Honor `?v=` (Req 4.4 / 9.3):** when the URL carries `&v=<version>` (the gate's or the curator
  step's bound link), load that exact version so the Subject reads exactly what the record will
  stamp.
- **Counsel marker (Req 1.4 / 8.3):** show the `COUNSEL_BANNER` when
  `ssPolicyNeedsCounselReview(renderedBody)` is `true` — i.e. for the placeholder scaffolding AND
  for any stored body (including `curator`) that still contains `[…]` tokens; suppress it once
  final bracket-free text is seeded.
- **Fallback (Req 1.6 / 1.9 / 8.4 / 8.5):** no current row, or a load error, for any `doc`
  (including `curator`) → the existing clearly-marked placeholder scaffolding (version marker,
  effective-date marker, counsel marker) so the surface stays reachable.

### `showshak-profile.html` — Become-a-Curator wiring (Req 9.1–9.5, 9.8, 9.12, 9.14)

The existing `#bc-overlay` modal, its `bcStep` progression, the `bcAgreed` flag, and `bcActivate()`
are extended on the **final (Curator Terms) step**:

- **Bind version once (Req 9.3):** when the curator step becomes active (in `bcRender()` for the
  final step, or `openBecomeCurator()`), `await window.ssCurrentPolicyVersions({ curator:true })`;
  on `ok` store `boundCurator = curator.version` and set the Curator Terms link `href` to
  `showshak-legal.html?doc=curator&v=<boundCurator>` (`target="_blank"`, so opening it preserves
  the modal + checkbox state); on miss show a "Curator Terms unavailable" notice and keep activate
  disabled (Req 9.4).
- **Unticked by default + activate gating (Req 9.1 / 9.2):** `openBecomeCurator()` already resets
  `bcAgreed = false`; the activate control (`bc-next` on the final step) is enabled **iff**
  `bcAgreed && boundCurator` is resolved (extends the current `next.disabled = !bcAgreed`).
- **Acceptance binds before the role flip (Req 9.5 / 9.8 / 9.12 / 9.14):** `bcActivate()` is
  changed to, **before** any `users.update`:
  ```js
  const acceptance = { affirmative: true, curator_version: boundCurator };
  if (!window.ssCuratorTermsAccepted(acceptance)) return;            // Req 9.14 — no flip
  const r = await window.ssRecordCuratorTerms(acceptance);          // Req 9.5 — bind FIRST
  if (!r.ok) { /* surface "couldn't save your acceptance" */ return; } // Req 9.8 — no flip
  // only now proceed to the EXISTING role flip:
  const patch = ssBuildOnboardingPatch({ handle, bio, genres: bcGenres, avatarUrl });
  await window.ssDB.from('users').update(patch).eq('id', user.id);  // users.role → curator
  ```
  This closes the current gap where `bcActivate()` flips the role with only a UI-only `bcAgreed`
  check and no recorded acceptance.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of
a system — essentially, a formal statement about what the system should do. Properties serve as
the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

PBT applies here because the consent validator (`ssConsentComplete`), the curator-terms validator
(`ssCuratorTermsAccepted`), and the counsel-marker decision (`ssPolicyNeedsCounselReview`) are
**pure functions** with large input spaces and clear universal rules. The DB write paths, RLS,
version resolution, and onboarding/Become-a-Curator orchestration are **not** property-tested
(they are integration/example/smoke — see Testing Strategy); the validators are the spec that
`ss_record_consent` / `ss_record_curator_terms` re-validate server-side, so testing them covers
the gate-enable (Req 2.5/2.6/2.11), curator-activate-enable (Req 9.2/9.14), and server-rejection
(Req 3.7 / 9.14) rules at once.

### Property 1: Complete consent is accepted

*For any* object whose `affirmative` is strictly boolean `true`, whose `age18plus` is strictly
boolean `true`, whose `tos_version` is a string with trimmed length ≥ 1, and whose
`privacy_version` is a string with trimmed length ≥ 1, `ssConsentComplete` returns the strict
boolean `true`.

**Validates: Requirements 5.1, 2.6**

### Property 2: Any incomplete consent is rejected

*For any* input where at least one of the following holds — `affirmative` is not strictly `true`
(including truthy non-boolean values), `age18plus` is not strictly `true` (including truthy
non-boolean values), `tos_version` is not a string or its trimmed length is 0, `privacy_version`
is not a string or its trimmed length is 0, or the input is `null`/`undefined`/not an object —
`ssConsentComplete` returns the strict boolean `false`.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 2.5, 2.11, 3.7**

### Property 3: Validator is total and strictly boolean

*For any* input value of any type, `ssConsentComplete` does not throw and returns a value that is
strictly `true` or strictly `false`.

**Validates: Requirements 5.7**

### Property 4: Validator is pure (deterministic, non-mutating)

*For any* input, `ssConsentComplete` produces no side effects, does not mutate its input, and
returns an identical output for identical input on every invocation.

**Validates: Requirements 5.8**

### Property 5: Counsel-review marker tracks placeholder tokens

*For any* policy body, `ssPolicyNeedsCounselReview` returns `true` when the body is not a
non-empty string or contains a bracketed `[…]` placeholder token, and returns `false` when the
body is a non-empty string containing no bracketed token.

**Validates: Requirements 1.4, 8.3**

### Property 6: Curator-terms acceptance validity

*For any* input value of any type, `ssCuratorTermsAccepted` returns the strict boolean `true`
**iff** the input is a non-null object whose `affirmative` is strictly boolean `true` (truthy
non-boolean values such as `1` or `'true'` yield `false`) and whose `curator_version` is a string
with trimmed length ≥ 1; for every other input — including a missing/ill-typed/empty/whitespace
`curator_version`, a non-strict-`true` `affirmative`, and any `null`/`undefined`/non-object — it
returns the strict boolean `false`.

**Validates: Requirements 9.11, 9.2, 9.14**

### Property 7: Curator-terms validator is total, strictly boolean, and pure

*For any* input value of any type, `ssCuratorTermsAccepted` does not throw, returns a value that
is strictly `true` or strictly `false`, produces no side effects, does not mutate its input, and
returns an identical output for identical input on every invocation.

**Validates: Requirements 9.11**

## Error Handling

The database is the security boundary; every client path is **fail-soft** and never throws,
mirroring the `0029` wrappers.

| Failure | Where caught | Behavior |
|---|---|---|
| `window.ssDB` unavailable | `ssRecordConsent` | return `{ ok:false }`, no RPC, no throw (Req 6.3) |
| No session and anonymous sign-in fails | `ssRecordConsent` | identity unresolved → `{ ok:false }`, no RPC (Req 6.3 / 3.6) |
| `ssConsentComplete` returns `false` | `ssRecordConsent` | `{ ok:false }`, no RPC (Req 6.6) |
| `ss_record_consent` RPC reports error / raises | `ssRecordConsent` try/catch | `{ ok:false, error }`, no throw (Req 6.4); DB transaction rolls back leaving no partial row (Req 3.8) |
| `auth.uid()` null at RPC | `ss_record_consent` | raise `insufficient_privilege`, insert nothing (Req 3.6) |
| Flags not true / versions empty at RPC | `ss_record_consent` | raise `check_violation`, insert nothing (Req 3.7) |
| Current tos/privacy version unresolved | gate + `ssCurrentPolicyVersions` | "policies unavailable" notice, advance stays disabled, no bind/persist (Req 4.5 / 4.6) |
| Current curator version unresolved | curator step + `ssCurrentPolicyVersions({curator:true})` | "Curator Terms unavailable" notice, activate stays disabled, no bind/persist (Req 9.4) |
| `ssCuratorTermsAccepted` returns `false` | `ssRecordCuratorTerms` | `{ ok:false }`, no RPC, no throw (Req 9.14) |
| `ss_record_curator_terms` reports error / raises | `ssRecordCuratorTerms` try/catch | `{ ok:false, error }`, no throw; DB transaction rolls back leaving no partial row (Req 9.8) |
| `auth.uid()` null / flags-versions invalid at curator RPC | `ss_record_curator_terms` | raise `insufficient_privilege` / `check_violation`, insert nothing (Req 9.6 / 9.14) |
| Curator-terms write fails or identity unresolved | `bcActivate` | surface "couldn't save your acceptance", **do NOT flip `users.role`** (Req 9.8 / 9.14) |
| Consent record write fails | `obConsentAdvance` | surface "consent could not be saved", **stay on the gate**, do not advance (Req 2.11 / 3.8) |
| Stored policy load fails / no current row | `showshak-legal.html` `renderDoc` | degrade to clearly-marked placeholder scaffolding for any `doc` incl. `curator` (Req 1.6 / 1.9 / 8.4 / 8.5) |

## Testing Strategy

**Dual approach.** Property tests cover the pure validator and the marker decision; example and
integration checks cover the DB write path, RLS, version resolution, and onboarding orchestration
(which are not amenable to PBT).

### Property-based tests (fast-check, ≥ 100 iterations each)

New file **`tests/prop-consent.test.js`** (plain Node + fast-check, `installDomStub()` before
requiring `showshak-shared.js`, registered in `tests/run-all.js`), mirroring
`tests/prop-*` conventions. Each test is tagged:

`// Feature: beta-consent-gate, Property N: <property text>` and `// **Validates: Requirements …**`

- **Property 1** — generate complete consents (both flags `true`, random non-empty/whitespace-padded
  version strings) → assert `ssConsentComplete === true`.
- **Property 2** — generate consents with one or more broken fields (flags as `1`/`'true'`/`0`/
  missing; versions as non-strings, empty, or all-whitespace) and `fc.anything()` non-objects →
  assert `=== false`.
- **Property 3** — `fc.assert(fc.property(fc.anything(), v => { const r = ssConsentComplete(v);
  return r === true || r === false; }))` inside a `try/catch` that fails on throw (totality).
- **Property 4** — deep-freeze / snapshot the input, call twice, assert equal results and the input
  is unchanged (determinism + no mutation).
- **Property 5** — generate bodies with and without bracketed tokens (plus `null`/non-string/empty)
  → assert `ssPolicyNeedsCounselReview` matches token presence with the fail-safe on non-strings.
- **Property 6** — generate valid acceptances (`affirmative:true`, random non-empty/whitespace-padded
  `curator_version`) → assert `ssCuratorTermsAccepted === true`; generate broken acceptances
  (`affirmative` as `1`/`'true'`/`0`/missing; `curator_version` non-string/empty/all-whitespace) and
  `fc.anything()` non-objects → assert `=== false`.
- **Property 7** — `fc.assert(fc.property(fc.anything(), v => { const r = ssCuratorTermsAccepted(v);
  return r === true || r === false; }))` inside a `try/catch` that fails on throw (totality), plus a
  deep-freeze + double-call equality check (determinism + no mutation).

PBT library: **fast-check** (already a dev dependency); do **not** hand-roll generators framework.
All seven properties live in **`tests/prop-consent.test.js`** (Properties 6–7 for the curator
predicate sit beside Properties 1–4 for `ssConsentComplete` and Property 5 for
`ssPolicyNeedsCounselReview`), satisfying Req 9.13.

### Example / integration / smoke checks (founder-run, manual or scripted)

- **Migration `0031`** applies cleanly in the Supabase SQL editor; `ss_record_consent` **and
  `ss_record_curator_terms`** exist and are granted to `authenticated`; `consents` has RLS enabled
  with `consents_read_own`, the `kind` discriminator + check constraints, and the nullable version
  columns (Req 3.3 / 9.5).
- **RLS** — signed-in-as-A reads only A's consent rows of **any kind** (incl. `curator_terms`);
  reading as B returns zero rows (Req 3.4 / 9.7); a direct client `insert` into `consents` is
  denied (only the RPCs write).
- **RPC (consent)** — a valid call inserts exactly one `user_consent` row with `subject_id =
  auth.uid()`, UTC `accepted_at`, both flags `true`, both bound versions; a call with `auth.uid()`
  null, a false flag, or an empty version inserts nothing (Req 3.1 / 3.5 / 3.6 / 3.7).
- **RPC (curator terms)** — a valid call inserts exactly one `kind='curator_terms'` row with
  `subject_id = auth.uid()`, UTC `accepted_at`, `affirmative=true`, `curator_version` = bound, and
  `tos/privacy/age18plus` null; a call with `auth.uid()` null or an empty `curator_version` inserts
  nothing (Req 9.5 / 9.6 / 9.8 / 9.14).
- **Seed** — after running `seed_policy_versions.sql`, `showshak-legal.html` shows the stored
  `tos`/`privacy`/**`curator`** bodies and suppresses the scaffolding; with placeholder tokens still
  present the counsel banner remains; with `policy_versions` empty the page degrades to scaffolding
  (Req 1.2 / 1.4 / 1.6 / 8.2 / 8.3 / 8.4).
- **Curator Terms content review** — the authored `legal/curator-terms.md` draft is reviewed
  (founder + counsel) to confirm it states ownership retention, the license grant, neutral-host /
  no-ownership, the rights warranty, indemnity, and the guidelines / no-unlicensed-music /
  repeat-infringer clauses (Req 8.6–8.11).
- **Onboarding** — fresh entry shows both boxes unticked; advance disabled until both checked and
  policies resolved; opening a policy link (new tab) preserves checkbox state; advancing records
  consent and only proceeds on success; an unresolved current version shows "policies unavailable"
  and keeps advance disabled (Req 2.1–2.11, 4.x).
- **Become-a-Curator** — fresh entry to the curator step shows the agree control unticked and
  activate disabled; opening the Curator Terms link (new tab) preserves state; activate enables only
  when ticked and the curator version resolved; activating records exactly one `curator_terms`
  acceptance and **only then** flips `users.role`; a failed/unresolved acceptance leaves the role
  unchanged and surfaces an error; an unresolved curator version shows "Curator Terms unavailable"
  and keeps activate disabled (Req 9.1–9.9, 9.12, 9.14).

## Deployment

Per Req 7, ship the client changes with a cache bump in `sw.js`:

- Increment `CACHE_VERSION` from `'v29'` to `'v30'` (exactly one greater; `CACHE_NAME` derives as
  `'showshak-' + CACHE_VERSION` automatically).
- The `PRECACHE` list already includes `'./'` (precaches `index.html` as the scope root),
  `'showshak-legal.html'`, **and `'showshak-profile.html'`** (confirmed present in `sw.js`), so the
  gate, the policy/Curator-Terms surface, and the Become-a-Curator flow are all served from the
  bumped cache; the existing one-by-one `cache.add(...).catch(...)` ignores individual precache
  misses so install never aborts. **No `PRECACHE` change is needed** — the `v29 → v30` bump already
  ships every client file this feature touches (`index.html`, `showshak-legal.html`,
  `showshak-profile.html`, `showshak-shared.js`).
- The existing `activate` cleanup deletes every `showshak-*` cache except the active `CACHE_NAME`
  and the version-independent `SEG_CACHE` (`'showshak-seg'`) segment bucket — no change needed.

Founder-applied steps (no agent execution): **author the new `legal/curator-terms.md` draft**
(counsel-review-required), apply `0031_beta_consent_gate.sql`, then run `seed_policy_versions.sql`
(now publishing `tos`, `privacy`, and `curator`), all via the Supabase SQL editor.
