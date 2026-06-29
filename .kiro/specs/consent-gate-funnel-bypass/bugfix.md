# Bugfix Requirements Document

## Introduction

ShowShak's DPDP affirmative-consent + 18+ gate (the `beta-consent-gate` feature)
is enforced in ONLY ONE place: the landing-page onboarding overlay in `index.html`
(the "Get Started" flow, Step 1 = Consent, `obConsentAdvance` →
`window.ssRecordConsent`). It is NOT present anywhere in the guest-first funnel,
which is the PRIMARY way real accounts are created.

Concretely, an account can be created through three paths that never capture or
record consent:

- **(a) OAuth via the in-app signup sheet** — `window.ssGuestSignup` /
  `_ssGuestDoSignup('google'|'apple')` calls `window.ssDB.auth.signInWithOAuth`
  directly. The sheet is opened by the guest gate (`ssGuestGuard`), the sidebar
  "Log in" (`ss-auth-login` → `ssOpenSignup`), and value-moment prompts. No
  consent / 18+ step, no `ssRecordConsent` call.
- **(b) Email via the in-app signup sheet** — `ssEmailSubmit` calls
  `window.ssDB.auth.signUp` (and `signInWithPassword` on the already-registered
  fallback) directly. Same omission.
- **(c) Post-login in-app onboarding** — `_ssAfterLogin` opens the `#ss-ob-overlay`
  overlay for any account whose `users.meta.onboarded !== true`. It collects only
  username + genres + platforms; `_finishOnboarding` writes `meta.onboarded = true`
  and lets the user into the app. There is NO consent step.

**Result:** a user who creates an account through the guest funnel reaches the
usable app having never seen or recorded the DPDP consent or the 18+ affirmation.
The founder reproduced this — a freshly created account was never shown the
legal-acceptance step. For an 18+ open beta in India, this is a DPDP-compliance
(legal/existential) defect.

**Secondary finding (captured here, not lost):** even the working landing-path
gate depends on `window.ssCurrentPolicyVersions()` reading the `policy_versions`
table directly. The `grant select on policy_versions to anon, authenticated;`
statement is still FOUNDER-RUN-pending per the handoff. Without it the read is
permission-denied and the gate fail-softs to "Policies currently unavailable" with
Continue stuck disabled. The desired compliance behaviour is **fail-CLOSED**: if
the current policy versions cannot be resolved, the user must NOT be able to
proceed into the app un-consented — but the flow must never crash.

**Intended fix direction (context only — these requirements describe WHAT, not HOW):**
enforce consent at the ONE post-login chokepoint every authentication path passes
through (e.g. `_ssAfterLogin` / before the post-login onboarding completes / before
the app is usable), reusing the existing, property-tested `ssConsentComplete` plus
the impure wrappers `ssRecordConsent` and `ssCurrentPolicyVersions`. The
landing-path pre-auth consent must keep working and must NOT double-prompt a user
who already consented.

### Existing reusable pieces (the fix reuses, does not reinvent)

- **Pure, property-tested:** `ssConsentComplete(consent)` — strict boolean gate
  (`affirmative === true && age18plus === true && non-empty tos_version &&
  non-empty privacy_version`). In `module.exports`.
- **Impure window-only wrappers:** `ssRecordConsent(consent)` (gates with
  `ssConsentComplete`, lazily mints an anon session, calls the SECURITY DEFINER
  RPC `ss_record_consent` which sets `subject_id = auth.uid()` + `accepted_at`
  server-side, fail-soft), `ssCurrentPolicyVersions(opts)` (reads current
  tos+privacy versions, fail-soft), `ssLoadPolicyVersion`, `ssRecordCuratorTerms`,
  `ssCuratorTermsAccepted`.
- The in-page legal modal `ssOpenLegal(doc, version)`.
- Migration `0031` already created the consent tables/RPCs + own-row RLS +
  per-kind check constraints. There is currently **NO** client read for "does a
  valid consent record already exist for this subject?" — a new idempotency check
  (a `select` or a small RPC) is likely required so the fix never re-prompts an
  already-consented user and never lets an un-consented session through.

### Assumptions / Prerequisites

- **Founder-run DB dependency:** `grant select on policy_versions to anon,
  authenticated;` MUST be applied in the Supabase SQL editor for
  `ssCurrentPolicyVersions()` to resolve. Until it is applied, the gate fails
  closed (correct for compliance) but no path can complete consent. This grant is
  an explicit prerequisite for the fix to function end-to-end.
- A current `tos` and `privacy` row exist in `policy_versions` with
  `is_current = true`.
- The bugfix changes only the consent-enforcement wiring of the auth funnel; the
  pure logic in `showshak-shared.js` (and its `module.exports`) stays
  dual-exported for Node + fast-check, and the suite (`node tests/run-all.js`,
  currently 101 files green) must stay green.

## Bug Analysis

### Current Behavior (Defect)

What currently happens: accounts created through the guest funnel reach the usable
app with no recorded DPDP consent or 18+ affirmation, because the consent gate is
wired into the landing onboarding only.

1.1 WHEN a visitor creates/links an account via the in-app signup sheet's
"Continue with Google" / "Continue with Apple" (`_ssGuestDoSignup` →
`ssDB.auth.signInWithOAuth`) THEN the system authenticates the user and lets them
into the app WITHOUT capturing or recording any consent or 18+ affirmation (no
`ssRecordConsent` call).

1.2 WHEN a visitor creates an account via the in-app signup sheet's "Sign up with
Email" (`ssEmailSubmit` → `ssDB.auth.signUp`, or the `signInWithPassword`
already-registered fallback) THEN the system authenticates the user and lets them
into the app WITHOUT capturing or recording any consent or 18+ affirmation.

1.3 WHEN a newly authenticated account with `users.meta.onboarded !== true` goes
through the post-login in-app onboarding (`_ssAfterLogin` → `#ss-ob-overlay`) THEN
the system collects only username + genres + platforms and `_finishOnboarding`
sets `meta.onboarded = true` and admits the user, WITHOUT any consent step.

1.4 WHEN an account is created through any guest-funnel path (1.1–1.3) THEN the
system permits a fully usable authenticated session for which NO consent row
exists in the `0031` consent table for that `subject_id`.

1.5 WHEN an account that was created before this fix (and therefore has no consent
record) signs in again THEN the system does not detect the missing consent and
admits the user to the app un-consented (existing accounts are never caught).

1.6 WHEN the current policy versions cannot be resolved (e.g. the founder-run
`policy_versions` SELECT grant has not been applied, so
`ssCurrentPolicyVersions()` returns `{ ok:false }`) THEN the landing gate
fail-softs to "Policies currently unavailable" with Continue disabled, AND the
guest funnel — having no gate at all — still admits the user to the app
un-consented.

### Expected Behavior (Correct)

What should happen instead: every authentication path is forced through a single
consent chokepoint, and no authenticated session can reach a usable app state
without a recorded, version-stamped DPDP consent + 18+ affirmation.

2.1 WHEN a visitor authenticates via OAuth ("Continue with Google" / "Continue
with Apple") and has no valid existing consent record THEN the system SHALL require
and record an affirmative, version-stamped DPDP consent + 18+ affirmation (via
`ssRecordConsent`) BEFORE the app becomes usable.

2.2 WHEN a visitor authenticates via Email ("Sign up with Email", including the
already-registered sign-in fallback) and has no valid existing consent record THEN
the system SHALL require and record an affirmative, version-stamped DPDP consent +
18+ affirmation BEFORE the app becomes usable.

2.3 WHEN a newly authenticated account goes through the post-login in-app
onboarding (`_ssAfterLogin` / `#ss-ob-overlay`) and has no valid existing consent
record THEN the system SHALL present and successfully record consent + 18+ as part
of (and as a gate within) that flow, such that onboarding cannot complete
(`meta.onboarded` cannot be set to `true` and the app cannot become usable)
un-consented.

2.4 WHEN any authentication path completes THEN the system SHALL guarantee the
invariant that NO authenticated session reaches a usable app state without a
recorded, version-stamped DPDP consent + 18+ affirmation for that `subject_id`.

2.5 WHEN an authenticated user already has a valid recorded consent (e.g. they
consented through the landing onboarding, or on a prior session) THEN the system
SHALL NOT re-prompt for consent and SHALL admit them directly (idempotency — at
most one prompt per un-consented subject).

2.6 WHEN the consent prompt is shown on any funnel path THEN the system SHALL
require an affirmative acceptance via controls that are UNTICKED by default and
SHALL stamp the recorded consent with the resolved current `tos_version` and
`privacy_version` (DPDP: free, specific, informed, unambiguous; no pre-ticked
boxes), mirroring the existing landing gate's behaviour and gating on
`ssConsentComplete`.

2.7 WHEN the current policy versions cannot be resolved (transient DB error,
missing grant, or no current rows) THEN the system SHALL fail CLOSED — the user
SHALL NOT be able to proceed into the app un-consented — SHALL surface a
recoverable "policies unavailable / try again" state with the option to retry, and
SHALL NEVER throw or crash; the system SHALL NEVER fail OPEN (admit an
un-consented session) on a policy-resolution or save failure.

2.8 WHEN an account created before this fix (with no consent record) next signs in
THEN the system SHALL detect the missing consent at that login and require + record
it before the app becomes usable.

### Unchanged Behavior (Regression Prevention)

Existing behaviour that must be preserved.

3.1 WHEN a visitor uses the landing-page onboarding consent flow (`index.html`
Step 1 → `obConsentAdvance` → `ssRecordConsent`) THEN the system SHALL CONTINUE TO
work exactly as today (affirmative, unticked-by-default, version-stamped, fail-soft
policy resolution, no double-prompt for a user who already consented there).

3.2 WHEN a brand-new, un-signed-up guest browses the app THEN the system SHALL
CONTINUE TO let them scroll/feel the experience (browse the feed, open clips, Watch
It, Share) before any signup prompt — the consent chokepoint fires only at/after
authentication, NOT on first browse, so the guest-first funnel is preserved.

3.3 WHEN the test suite runs (`node tests/run-all.js`) THEN the system SHALL
CONTINUE TO pass all currently-green files (101), and `ssConsentComplete` SHALL
CONTINUE TO be a pure, deterministic, side-effect-free, never-throwing strict
boolean gate exported via `module.exports`.

3.4 WHEN any user interacts with the app after this fix THEN the system SHALL
CONTINUE TO honour the sacred product rules (e.g. no scoreboard / engagement-count
leakage, the trust-based discovery model) — the consent wiring SHALL NOT expose,
alter, or leak any gated product surface.

3.5 WHEN `ssRecordConsent`, `ssCurrentPolicyVersions`, and `ssConsentComplete` are
called THEN the system SHALL CONTINUE TO honour their existing contracts: the
database (SECURITY DEFINER RPCs + own-row RLS + `0031` check constraints) remains
the security boundary, the wrappers stay impure/window-only (NOT in
`module.exports`), and all stay fail-soft and never throw.

3.6 WHEN a user authenticates via OAuth or Email and the existing
`onAuthStateChange` → `_ssAfterLogin` lifecycle runs THEN the system SHALL CONTINUE
TO perform its current post-login work (Following hydration, account reactivation
check, username/genre/platform onboarding for un-onboarded accounts) — the consent
gate is added to this lifecycle, not a replacement for it.

## Bug Condition and Properties

### Bug Condition

```pascal
FUNCTION isBugCondition(X)
  INPUT: X = {
    authPath,          // one of: oauth_sheet, email_sheet, postlogin_onboarding
    isAuthenticated,   // boolean — an auth session exists for subject_id
    hasValidConsent,   // boolean — a valid version-stamped consent row exists
                       //           for subject_id (per ssConsentComplete + 0031)
    reachedUsableApp   // boolean — the session reached usable app state
  }
  OUTPUT: boolean

  // The bug: an authenticated session reaches the usable app WITHOUT a valid
  // recorded consent for its subject. (Pre-existing un-consented accounts are
  // included: isAuthenticated = true, hasValidConsent = false.)
  RETURN X.isAuthenticated = true
     AND X.hasValidConsent = false
     AND X.reachedUsableApp = true
END FUNCTION
```

Concrete counterexample (the observed bug): a visitor taps "Continue with Google"
in the in-app signup sheet (`authPath = oauth_sheet`). `signInWithOAuth` succeeds,
`onAuthStateChange` → `_ssAfterLogin` runs the username/genres onboarding,
`_finishOnboarding` sets `meta.onboarded = true`, and the app becomes usable — with
`hasValidConsent = false`. No consent row was ever written.

### Property: Fix Checking (no un-consented session reaches the app)

```pascal
// F': the fixed funnel that enforces consent at the post-login chokepoint.
FOR ALL X WHERE isBugCondition(X) DO
  result ← F'(X)
  // After the fix, an authenticated subject without prior valid consent is
  // forced through the consent gate before the app is usable.
  ASSERT result.reachedUsableApp = false
      OR result.hasValidConsent  = true
  // The consent that is recorded is affirmative, 18+, and version-stamped.
  ASSERT result.hasValidConsent IMPLIES
         ssConsentComplete(result.recordedConsent) = true
  ASSERT no_crash(result)
END FOR
```

### Property: Idempotency (already-consented users not re-prompted)

```pascal
FOR ALL X WHERE X.isAuthenticated = true AND X.hasValidConsent = true DO
  result ← F'(X)
  ASSERT result.consentPromptShown = false   // no double-prompt
  ASSERT result.reachedUsableApp   = true     // admitted directly
END FOR
```

### Property: Fail-Closed on policy-resolution / save failure (never fail-open)

```pascal
FOR ALL X WHERE X.isAuthenticated = true
            AND X.hasValidConsent = false
            AND (policyResolutionFails(X) OR consentSaveFails(X)) DO
  result ← F'(X)
  ASSERT result.reachedUsableApp = false   // fail CLOSED, never OPEN
  ASSERT no_crash(result)                   // recoverable + retryable, never throws
END FOR
```

### Property: Preservation Checking (non-buggy inputs unchanged)

```pascal
// For all inputs that do NOT trigger the bug, the fixed funnel behaves
// identically to the original — landing-path consent, guest browsing, and the
// already-consented login path are unchanged.
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F'(X) = F(X)
END FOR
```

**Key definitions:**
- **C(X)** — Bug Condition: an authenticated session reaches usable app state with
  no valid recorded consent (`isAuthenticated ∧ ¬hasValidConsent ∧ reachedUsableApp`).
- **P(result)** — desired behaviour for `C(X)`: the session is either blocked from
  the usable app or has a valid, version-stamped, affirmative 18+ consent recorded;
  never crashes; fails closed on policy/save failure; no double-prompt for
  already-consented users.
- **¬C(X)** — non-buggy inputs to preserve: un-authenticated guests browsing,
  the landing-path consent flow, and already-consented authenticated logins.
- **F** — the original funnel (consent enforced on the landing path only; guest
  funnel un-gated).
- **F'** — the fixed funnel (consent enforced at the single post-login chokepoint
  every auth path passes through, reusing `ssConsentComplete` + `ssRecordConsent`
  + `ssCurrentPolicyVersions`).
