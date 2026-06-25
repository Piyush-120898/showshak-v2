-- ═══════════════════════════════════════════════════════════════
-- seed_policy_versions.sql
-- SHOWSHAK — BETA CONSENT GATE: publish the real legal drafts
-- (.kiro/specs/beta-consent-gate — Task 3.2; Requirements 1, 8)
-- ───────────────────────────────────────────────────────────────
-- WHAT THIS IS
--   A FOUNDER-RUN, IDEMPOTENT *data* seed (not a migration, not code). It
--   publishes three rows into the REUSED `policy_versions` table (created in
--   migration 0029, never recreated here): doc='tos', doc='privacy', and
--   doc='curator'. Each row carries the VERBATIM body of the matching
--   legal/*.md draft, a non-empty version ('1.0-beta'), a non-empty
--   effective_date, and is_current = true (Req 1.1 / 8.1).
--
-- HOW TO RUN
--   Supabase SQL editor → paste this whole file → fill the three body
--   placeholders (see below) → Run. Apply 0031_beta_consent_gate.sql FIRST.
--   The final-text swap is DATA, not a code change (Req 1.7 / 8.13).
--
-- ── FOUNDER ACTION REQUIRED: paste the verbatim .md bodies ──
--   The legal/*.md drafts are large and contain [PLACEHOLDER] tokens the
--   founder/counsel fill before launch, so they are NOT inlined here. Before
--   running, replace each clearly-marked placeholder below with the VERBATIM
--   contents of the corresponding file:
--     • tos     ← legal/terms-of-service.md
--     • privacy ← legal/privacy-policy.md
--     • curator ← legal/curator-terms.md
--   The text lives between the `$body$ … $body$` dollar-quote delimiters, so
--   the pasted Markdown needs no escaping (quotes, backslashes, newlines are
--   all literal). Just ensure the pasted text never contains the literal
--   sequence `$body$`. While a pasted body still contains bracketed
--   [PLACEHOLDER] tokens, showshak-legal.html keeps its visible
--   "counsel review required" banner (Req 1.4 / 8.3) — that is expected.
--
-- ── IDEMPOTENT ──
--   Each insert is guarded with `where not exists (… doc=… and version=…)`,
--   so re-running this file inserts nothing once a (doc, version) pair is
--   already published. Safe to paste-and-Run more than once.
--
-- ── IMMUTABILITY + RE-SEED CONTRACT (Req 1.5 / 1.8 / 2.8 / 8.12 / 8.13) ──
--   Published rows are NEVER overwritten or mutated. Publishing the
--   counsel-approved final text later is a NEW immutable row (a new `version`)
--   plus an ATOMIC repoint of `is_current` — the prior rows' body / version /
--   effective_date stay exactly as published. The partial unique index
--   `uq_policy_current` (from 0029) enforces at most one current row per doc,
--   so the prior current MUST be flipped off in the SAME run. Recipe:
--
--     -- 1) insert the new immutable version (idempotent guard), is_current = true
--     insert into policy_versions (doc, version, effective_date, body, is_current)
--     select 'tos', '<new>', date '<new effective date>',
--            $body$<<< PASTE VERBATIM FINAL legal/terms-of-service.md HERE >>>$body$, true
--     where not exists (select 1 from policy_versions where doc='tos' and version='<new>');
--
--     -- 2) atomically repoint: flip every OTHER current row for this doc off
--     update policy_versions set is_current = false
--      where doc = 'tos' and version <> '<new>' and is_current;
--
--   (Apply the same two-step recipe for doc='privacy' and doc='curator'.)
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. TERMS OF SERVICE  (doc='tos' ← legal/terms-of-service.md, Req 1.1)
-- ───────────────────────────────────────────────────────────────
insert into policy_versions (doc, version, effective_date, body, is_current)
select 'tos', '1.0-beta', date '2025-01-01',
       $body$<<< PASTE VERBATIM CONTENTS OF legal/terms-of-service.md HERE >>>$body$, true
where not exists (select 1 from policy_versions where doc='tos' and version='1.0-beta');

-- ───────────────────────────────────────────────────────────────
-- 2. PRIVACY POLICY  (doc='privacy' ← legal/privacy-policy.md, Req 1.1)
-- ───────────────────────────────────────────────────────────────
insert into policy_versions (doc, version, effective_date, body, is_current)
select 'privacy', '1.0-beta', date '2025-01-01',
       $body$<<< PASTE VERBATIM CONTENTS OF legal/privacy-policy.md HERE >>>$body$, true
where not exists (select 1 from policy_versions where doc='privacy' and version='1.0-beta');

-- ───────────────────────────────────────────────────────────────
-- 3. CURATOR TERMS  (doc='curator' ← legal/curator-terms.md, Req 8.1)
-- ───────────────────────────────────────────────────────────────
-- Verbatim body of the NEW founder-authored, counsel-review-required draft
-- legal/curator-terms.md (authored in task 2.1; founder fills [PLACEHOLDER]
-- tokens + counsel-reviews before the final-text re-seed).
insert into policy_versions (doc, version, effective_date, body, is_current)
select 'curator', '1.0-beta', date '2025-01-01',
       $body$<<< PASTE VERBATIM CONTENTS OF legal/curator-terms.md HERE >>>$body$, true
where not exists (select 1 from policy_versions where doc='curator' and version='1.0-beta');
