-- ═══════════════════════════════════════════════════════════════
-- 0031_beta_consent_gate.sql
-- SHOWSHAK — BETA CONSENT GATE: DPDP affirmative consent + 18+ gate AND
--            the one-time Curator Terms acceptance (the SOFTWARE, not the law)
-- (.kiro/specs/beta-consent-gate — Task 3.1;
--  Requirements 3, 9)
-- ───────────────────────────────────────────────────────────────
-- Builds the consent-recording machinery that mirrors the 0029 attestation
-- pattern. A SINGLE shared `consents` table holds BOTH acceptance kinds —
-- the onboarding affirmative consent + 18+ gate ('user_consent') and the
-- one-time Become-a-Curator acceptance ('curator_terms') — separated by a
-- `kind` discriminator. Each kind is written ONLY through its own
-- single-purpose SECURITY DEFINER RPC, which sets subject_id = auth.uid()
-- server-side and re-validates the record before inserting. Own-row RLS
-- governs reads of ALL kinds.
--
-- ── ADDITIVE + NON-REGRESSIVE ──
-- This migration creates only new objects (the `consents` table + its RPCs),
-- with ONE non-destructive exception: it WIDENS the existing
-- `policy_versions_doc_check` constraint from 0029 to also allow doc='curator'
-- (section 0 below). That change is non-regressive — every existing row still
-- satisfies the widened set. The `policy_versions` table itself is REUSED
-- (referenced, never recreated) — a founder-run seed publishes the
-- tos/privacy/curator rows. 0030 is RESERVED for DMCA Phase 2, so this feature
-- uses 0031.
--
-- Conventions (same as every table since 0001):
--   id          → uuid primary key default gen_random_uuid()
--   created_at  → when the row was made
--   updated_at  → when it last changed
--   deleted_at  → soft delete (we hide rows, never truly erase)
--   meta        → flexible jsonb bucket for future fields
-- EXCEPTION: subject_id carries NO FK and NO `on delete cascade` — the proof
--   of consent must OUTLIVE the (anonymous or permanent) session/account it
--   belongs to (Req 3.9 / 9.10), exactly like the 0029 attestations rationale.
--
-- All timestamps are stored in UTC (timestamptz).
-- SAFE / ADDITIVE + IDEMPOTENT. Run: Supabase SQL Editor → paste → Run.
-- ═══════════════════════════════════════════════════════════════

-- Supabase has this enabled already; here for safety on fresh projects
-- (gen_random_uuid lives in pgcrypto).
create extension if not exists pgcrypto;

-- ───────────────────────────────────────────────────────────────
-- 0. WIDEN policy_versions.doc TO ALLOW 'curator'  (Req 8.1)
-- ───────────────────────────────────────────────────────────────
-- 0029 constrained doc to ('tos','privacy','copyright','community') via a
-- column-level check, which Postgres auto-named `policy_versions_doc_check`
-- (standard `<table>_<column>_check` naming). The Curator Terms (Req 8) add a
-- fifth document, doc='curator', seeded into the REUSED policy_versions table
-- by seed_policy_versions.sql — that insert would FAIL the original check. Drop
-- the old column check and re-add a named constraint that includes 'curator'.
-- Idempotent + safe: `drop ... if exists` works whether or not the auto-named
-- constraint is present, and all existing rows already satisfy the widened set.
alter table policy_versions drop constraint if exists policy_versions_doc_check;
alter table policy_versions add constraint policy_versions_doc_check
  check (doc in ('tos','privacy','copyright','community','curator'));

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
-- The ONLY sanctioned insert path for kind='user_consent'. Sets subject_id from
-- auth.uid() (ignoring any client-supplied identity), re-validates the consent
-- server-side (the SAME rule ssConsentComplete enforces), inserts exactly one
-- row at accepted_at = now(), and is transactional (a failed insert leaves no
-- partial row — Req 3.8).
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

-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 0031 COMPLETE — Task 3.1 is now in this one file:
--   0. widen policy_versions_doc_check (from 0029) to allow doc='curator', so
--      the founder-run seed can publish the Curator Terms row (Req 8.1).
--   1. consents table (shared store, kind discriminator, nullable per-kind
--      version columns, per-kind check constraints, no-FK/no-cascade) + indexes
--      on subject_id, accepted_at, kind.
--   2. RLS enabled with consents_read_own (subject_id = auth.uid()) governing
--      ALL kinds; intentionally NO insert policy.
--   3. ss_record_consent — the only 'user_consent' write path (server-set
--      identity, server-side re-validation mirroring ssConsentComplete).
--   4. ss_record_curator_terms — the only 'curator_terms' write path (server-set
--      identity, re-validation mirroring ssCuratorTermsAccepted) + grants
--      + notify pgrst reload.
--
-- [founder-run] apply 0031 in the Supabase SQL editor.
--   (Founder-applied SQL — nothing for the agent to run here. The file is
--    idempotent: paste the whole thing into Supabase SQL Editor → Run.)
-- ═══════════════════════════════════════════════════════════════
