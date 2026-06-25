-- ═══════════════════════════════════════════════════════════════
-- 0029_dmca_intake_posture.sql
-- SHOWSHAK — DMCA / MODERATION SCAFFOLDING, PHASE 1: posture, policy,
--            intake, audit (the SOFTWARE, not the law)
-- (.kiro/specs/dmca-moderation-scaffolding — Tasks 2.1–2.4;
--  Requirements 1, 2, 3, 4, 6, 7, 8)
-- ───────────────────────────────────────────────────────────────
-- Builds the notice-and-takedown machinery that lets ShowShak stand as a
-- neutral host: curators attest at publish time (attestations), the four
-- policy documents are immutable + addressable (policy_versions), an
-- anonymous complainant can file a well-formed takedown (complaints, a
-- closed 7-state machine), and every state change is recorded in an
-- APPEND-ONLY audit trail (moderation_log). Strikes are DERIVED from the
-- log, never stored.
--
-- ── SCOPE OF THIS TASK (2.1) ──
-- This step adds ONLY the four new tables + their indexes. The triggers
-- (append-only immutability + the attestation publish gate), the RLS
-- policies, the ss_is_admin() helper, and the Phase-1 SECURITY DEFINER
-- RPCs are appended to THIS SAME FILE by tasks 2.2 / 2.3 / 2.4. The
-- founder applies the completed 0029 in one paste.
--
-- ── ADDITIVE + NON-REGRESSIVE ──
-- This migration is purely additive. It does NOT modify the existing
-- `reports` table (0001) — DMCA intake gets its own `complaints` table so
-- the lightweight authenticated "report this clip" path keeps its exact
-- shape and 'open|actioned|rejected' status domain. It references the
-- existing `content` and `users` tables (0001) but never alters them.
--
-- Conventions (same as every table since 0001):
--   id          → uuid primary key default gen_random_uuid()
--   created_at  → when the row was made
--   updated_at  → when it last changed
--   deleted_at  → soft delete (we hide rows, never truly erase)
--   meta        → flexible jsonb bucket for future fields
-- EXCEPTION: moderation_log is append-only and therefore has NO
--   updated_at / deleted_at (those would imply mutability the audit
--   contract forbids).
--
-- All timestamps are stored in UTC (timestamptz).
-- SAFE / ADDITIVE + IDEMPOTENT. Run: Supabase SQL Editor → paste → Run.
-- ═══════════════════════════════════════════════════════════════

-- Supabase has this enabled already; here for safety on fresh projects
-- (gen_random_uuid lives in pgcrypto).
create extension if not exists pgcrypto;

-- ───────────────────────────────────────────────────────────────
-- 1. ATTESTATIONS  (Req 1 — one row per accepted attestation)
-- ───────────────────────────────────────────────────────────────
-- The curator's "I have the rights / I indemnify" acceptance recorded at
-- publish time. RETAINED FOREVER (Req 1.7, 8.7): the clip_id reference
-- deliberately has NO `on delete cascade` — deleting a clip must never
-- erase the proof that its uploader attested.
create table if not exists attestations (
  id                  uuid primary key default gen_random_uuid(),
  clip_id             uuid not null references content(id),   -- NO on delete cascade (Req 1.7/4.11)
  curator_id          uuid not null references users(id),
  accepted_at         timestamptz not null,                   -- UTC acceptance time (Req 1.3)
  tos_version         text not null,                          -- accepted ToS version (Req 1.3)
  attestation_version text not null,                          -- accepted attestation copy version
  created_at          timestamptz default now(),
  updated_at          timestamptz,
  deleted_at          timestamptz,
  meta                jsonb default '{}'
);
create index if not exists idx_attestations_clip    on attestations (clip_id);
create index if not exists idx_attestations_curator on attestations (curator_id);

-- ───────────────────────────────────────────────────────────────
-- 2. POLICY_VERSIONS  (Req 2 — immutable, addressable policy revisions)
-- ───────────────────────────────────────────────────────────────
-- The four legal documents (ToS, Privacy, Copyright/DMCA, Community/
-- Repeat-Infringer). Each (doc, version) is unique and never overwritten
-- (Req 2.6, 2.7); a partial unique index guarantees AT MOST ONE current
-- version per doc. Bodies are PLACEHOLDER prose carrying the visible
-- marker "counsel review required" — no real legal text lives here.
create table if not exists policy_versions (
  id             uuid primary key default gen_random_uuid(),
  doc            text not null check (doc in ('tos','privacy','copyright','community')),
  version        text not null,                  -- semantic or dated label (Req 2.4)
  effective_date date not null,                  -- visible effective date (Req 2.4)
  body           text not null,                  -- placeholder legal prose ("counsel review required")
  is_current     boolean not null default false, -- exactly one current per doc (enforced by partial index)
  created_at     timestamptz default now(),
  updated_at     timestamptz,
  deleted_at     timestamptz,
  meta           jsonb default '{}',
  unique (doc, version)
);
create unique index if not exists uq_policy_current on policy_versions (doc) where is_current;

-- ───────────────────────────────────────────────────────────────
-- 3. COMPLAINTS  (Req 3,4,5,7 — the notice-and-takedown row)
-- ───────────────────────────────────────────────────────────────
-- The closed 7-state machine. Accepts NON-ACCOUNT complainants — the
-- complainant_* fields are free text with NO FK to users (a DMCA notice
-- can arrive from anyone, logged in or not). This is a NEW table, NOT an
-- extension of `reports`. The public `confirmation_ref` is unguessable
-- and unique across all complaints (Req 3.5).
create table if not exists complaints (
  id                  uuid primary key default gen_random_uuid(),
  state               text not null default 'received'
                        check (state in ('received','acknowledged','under_review',
                                         'actioned','rejected','counter_received','reinstated')),
  -- target (one of: an existing clip id, or a URL only)
  content_id          uuid references content(id),        -- existing clip id (nullable)
  target_url          text,                               -- 1..2000 chars when no clip id (Req 3.2b)
  -- DMCA notice elements (Req 3.2)
  work_identification text not null,                       -- 1..2000 (Req 3.2a)
  complainant_name    text not null,                       -- 1..200  (Req 3.2c)
  complainant_email   text not null,                       -- local@domain.tld (Req 3.2d)
  good_faith          boolean not null,                    -- good-faith affirmation (Req 3.2e)
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
  confirmation_ref    text not null unique
                        default ('SS-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
  created_at          timestamptz default now(),
  updated_at          timestamptz,
  deleted_at          timestamptz,
  meta                jsonb default '{}'
);
create index if not exists idx_complaints_state    on complaints (state);
create index if not exists idx_complaints_content  on complaints (content_id);
create index if not exists idx_complaints_received on complaints (received_at);

-- ───────────────────────────────────────────────────────────────
-- 4. MODERATION_LOG  (Req 8 — append-only, immutable audit trail)
-- ───────────────────────────────────────────────────────────────
-- Every state change and account action lands here. APPEND-ONLY by
-- design: NO updated_at / deleted_at (immutability is the contract; a
-- BEFORE UPDATE/DELETE trigger added in task 2.2 hard-rejects mutation
-- for ALL roles incl. service). The id/complaint/clip/curator references
-- are plain uuids with NO FKs — the log must OUTLIVE the complaints,
-- clips, and users it describes (Req 8.7). Repeat-infringer strikes are
-- DERIVED from these rows (Req 6.6), never stored.
create table if not exists moderation_log (
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
  -- NO updated_at / deleted_at — append-only (Req 8.4–8.6).
);
create index if not exists idx_modlog_complaint on moderation_log (complaint_id, occurred_at);
create index if not exists idx_modlog_clip       on moderation_log (clip_id, occurred_at);
create index if not exists idx_modlog_curator    on moderation_log (curator_id, occurred_at);

-- ═══════════════════════════════════════════════════════════════
-- TASK 2.2 — DB-LEVEL GUARANTEES (triggers + admin helper)
-- ───────────────────────────────────────────────────────────────
-- Three database-enforced guarantees that no client/RLS logic can bypass:
--   (5) moderation_log is APPEND-ONLY for EVERY role (Req 8.4/8.5/8.6),
--   (6) no clip reaches 'live' without an accepted attestation (Req 10.3/10.5),
--   (7) ss_is_admin() — the privilege predicate the 2.3 RLS reads use.
-- All objects use `create or replace` and `drop trigger if exists … ; create
-- trigger …` so this file stays idempotent / re-runnable in one paste.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 5. MODERATION_LOG IMMUTABILITY  (Req 8.4 / 8.5 / 8.6 — append-only)
-- ───────────────────────────────────────────────────────────────
-- The audit trail is the legal record; it may only ever GROW. This pair of
-- BEFORE triggers hard-rejects any UPDATE or DELETE on moderation_log.
--
-- WHY A TRIGGER, NOT JUST RLS: a BEFORE trigger fires for the TABLE OWNER and
-- the `service_role` too — neither of which RLS policies constrain. So even a
-- privileged service-role UPDATE/DELETE raises here. Immutability is therefore
-- a property of the TABLE itself, independent of who is connected or what RLS
-- says — exactly what Req 8.4/8.5/8.6 demand. INSERT is untouched (the log
-- still grows normally).
create or replace function moderation_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'moderation_log is append-only (% rejected)', tg_op;
end;
$$;

drop trigger if exists trg_modlog_no_update on moderation_log;
create trigger trg_modlog_no_update
  before update on moderation_log
  for each row execute function moderation_log_immutable();

drop trigger if exists trg_modlog_no_delete on moderation_log;
create trigger trg_modlog_no_delete
  before delete on moderation_log
  for each row execute function moderation_log_immutable();

-- ───────────────────────────────────────────────────────────────
-- 6. ATTESTATION PUBLISH GATE  (Req 10.3 / 10.5 — no live clip w/o attestation)
-- ───────────────────────────────────────────────────────────────
-- The single chokepoint where a clip becomes public is the status flip to
-- 'live' (today: the mux-webhook 'processing→live'). This BEFORE UPDATE trigger
-- on content refuses that flip unless an attestations row already exists for
-- the clip. Because it lives in the DB (not the UI/webhook), ANY future path
-- that tries to publish — including a later music/audio feature — inherits the
-- same gate automatically (Req 10.5). Only fires on the transition INTO 'live'
-- (new='live' AND old is distinct from 'live'); all other updates pass through.
create or replace function content_requires_attestation()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'live' and (old.status is distinct from 'live') then
    if not exists (select 1 from attestations a where a.clip_id = new.id) then
      raise exception 'cannot publish clip % to live without an accepted attestation', new.id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_content_attestation on content;
create trigger trg_content_attestation
  before update on content
  for each row execute function content_requires_attestation();

-- ───────────────────────────────────────────────────────────────
-- 7. ss_is_admin()  (the privilege predicate for the 2.3 admin-only reads)
-- ───────────────────────────────────────────────────────────────
-- Returns TRUE only for the trusted server-side `service_role` (the founder's
-- admin tooling connects with it); FALSE for `anon` and ordinary
-- `authenticated` users. This mirrors how privilege is established elsewhere
-- (the 0009 whoami debug reads the same `auth.role()` JWT role; the 0011 grants
-- treat service_role as the trusted admin identity). The 2.3 policies on
-- `complaints` / `moderation_log` gate SELECT on ss_is_admin(), so a normal
-- user hitting those tables directly gets ZERO rows (Req 9.2/9.3).
--
-- SECURITY DEFINER + locked search_path = the standard posture for every
-- privileged helper in this schema (0008/0016/0019/0025). CONSERVATIVE BY
-- DEFAULT: any unexpected/absent role resolves to false (coalesce).
create or replace function ss_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(auth.role() = 'service_role', false);
$$;

-- ═══════════════════════════════════════════════════════════════
-- DONE (Task 2.2 — the append-only immutability triggers, the attestation
-- publish gate, and the ss_is_admin() helper). Task 2.3 (RLS) follows below.
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- TASK 2.3 — ROW-LEVEL SECURITY  (enablement + policies)
-- ───────────────────────────────────────────────────────────────
-- RLS is the SECURITY BOUNDARY for this feature — not the UI. Each of the
-- four new tables gets RLS enabled and exactly the read/write posture the
-- design's "RLS Policies" section prescribes:
--   • attestations    → owner may read only their OWN rows; no direct insert
--                        (inserts come solely from ss_record_attestation,
--                        the SECURITY DEFINER RPC in task 2.4).
--   • policy_versions  → world-readable public legal text (deleted_at is null);
--                        writes are service-role / out-of-band only.
--   • complaints       → NO anon/authenticated read; admin-only read via
--                        ss_is_admin(); no insert policy (anonymous intake
--                        goes through ss_submit_complaint, SECURITY DEFINER).
--   • moderation_log   → admin-only read via ss_is_admin(); append-only is
--                        already enforced by the 2.2 triggers; inserts come
--                        from the SECURITY DEFINER RPCs.
-- And we CONFIRM (do not rebuild) that the existing read_live_content policy
-- from 0001 already hides removed/soft-deleted clips from public reads.
--
-- IDEMPOTENT: every policy uses `drop policy if exists … ; create policy …`
-- so this file re-runs cleanly in a single paste. `enable row level security`
-- is itself idempotent (a no-op when already enabled).
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 8. ATTESTATIONS RLS  (owner-read only — Req 1)
-- ───────────────────────────────────────────────────────────────
-- A curator may read their OWN attestation rows (curator_id = auth.uid());
-- nobody else can SELECT them, and anon/intake cannot read at all. There is
-- intentionally NO insert policy: attestations are created ONLY through the
-- ss_record_attestation SECURITY DEFINER RPC (task 2.4), which sets
-- curator_id = auth.uid() server-side. So a normal client can never forge or
-- read someone else's attestation.
alter table attestations enable row level security;

drop policy if exists attestations_read_own on attestations;
create policy attestations_read_own on attestations
  for select using (curator_id = auth.uid());

-- ───────────────────────────────────────────────────────────────
-- 9. POLICY_VERSIONS RLS  (world-readable public legal text — Req 2.6)
-- ───────────────────────────────────────────────────────────────
-- The four policy documents are PUBLIC text — anyone (anon or authenticated)
-- may read any non-soft-deleted version (current AND prior), so the four
-- addressable surfaces work without login. Writes (publishing a new version)
-- are service-role / out-of-band only: there is intentionally NO insert/update
-- policy for normal roles, so ordinary callers can read the law but never
-- rewrite it (prior versions are never overwritten — Req 2.6/2.7).
alter table policy_versions enable row level security;

drop policy if exists policy_versions_read on policy_versions;
create policy policy_versions_read on policy_versions
  for select using (deleted_at is null);

-- ───────────────────────────────────────────────────────────────
-- 10. COMPLAINTS RLS  (admin-only read; zero rows for everyone else — Req 9.2/9.3)
-- ───────────────────────────────────────────────────────────────
-- The moderation queue is PRIVATE. There is NO select policy for anon or
-- authenticated callers, and the ONLY select policy is gated on ss_is_admin()
-- — so a non-admin SELECT on complaints returns ZERO rows (Req 9.2/9.3), the
-- queue cannot be enumerated, and no complainant can read another's notice.
--
-- INTAKE NOTE: anonymous intake NEVER does a raw insert into this table.
-- A complainant files a takedown through ss_submit_complaint (SECURITY
-- DEFINER, task 2.4), which validates + inserts the row server-side and
-- returns ONLY the confirmation_ref. That is why there is intentionally NO
-- insert policy here — an anon caller can create a well-formed complaint via
-- the RPC but can never read, enumerate, or choose the state of any row.
alter table complaints enable row level security;

drop policy if exists complaints_admin_read on complaints;
create policy complaints_admin_read on complaints
  for select using (ss_is_admin());

-- ───────────────────────────────────────────────────────────────
-- 11. MODERATION_LOG RLS  (admin-only read — Req 9.2/9.3)
-- ───────────────────────────────────────────────────────────────
-- The audit trail is admin/service-only on read: the sole select policy is
-- gated on ss_is_admin(), so anon/authenticated callers get ZERO rows.
-- Append-only is ALREADY enforced at the table level by the 2.2 BEFORE
-- UPDATE/DELETE triggers (which reject for every role incl. service), and
-- inserts happen only via the SECURITY DEFINER RPCs — so no insert/update/
-- delete policy is needed or wanted here.
alter table moderation_log enable row level security;

drop policy if exists modlog_admin_read on moderation_log;
create policy modlog_admin_read on moderation_log
  for select using (ss_is_admin());

-- ───────────────────────────────────────────────────────────────
-- 12. CONTENT REMOVAL = RLS GUARANTEE  (confirm existing 0001 policy — Req 4.8)
-- ───────────────────────────────────────────────────────────────
-- NO NEW CONTENT POLICY IS DEFINED OR ALTERED HERE — this is a confirmation,
-- not new SQL. The existing read_live_content policy from 0001 reads:
--
--     create policy read_live_content on content
--       for select using (deleted_at is null and status = 'live');
--
-- Because that public-read policy admits a row ONLY when status = 'live' AND
-- deleted_at is null, a clip whose status is flipped to 'removed' (or whose
-- deleted_at is set) immediately returns ZERO rows to any anonymous or
-- non-privileged SELECT. Removal therefore hides a clip EVERYWHERE via RLS —
-- the Feed, profiles, stacks, every public surface — with no new content
-- policy required (Req 4.8). ss_moderate_complaint (task 2.4 / Phase 2) flips
-- content.status via SECURITY DEFINER, so it bypasses this read policy to
-- write while the read policy continues to gate every public read. We
-- deliberately do NOT redefine or alter read_live_content.

-- ═══════════════════════════════════════════════════════════════
-- DONE (Task 2.3 — RLS enabled on all four tables with the prescribed
-- read posture: attestations owner-read; policy_versions world-read;
-- complaints + moderation_log admin-only read via ss_is_admin(); and the
-- existing read_live_content policy confirmed as the removal guarantee).
-- Still to be APPENDED to this same file before the founder applies 0029:
--   • Task 2.4 — the Phase-1 SECURITY DEFINER RPCs (ss_submit_complaint,
--     ss_record_attestation, ss_get_policy_version) + a trailing
--     `notify pgrst, 'reload schema';`.
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- TASK 2.4 — PHASE-1 SECURITY DEFINER RPCs  (the only privileged write/read paths)
-- ───────────────────────────────────────────────────────────────
-- Three privileged functions, all in the established stack-sharing /
-- analytics posture: language plpgsql (or sql), SECURITY DEFINER, locked
-- `set search_path = public`, EXECUTE granted explicitly to the right API
-- roles, and a trailing `notify pgrst, 'reload schema';`. They are the ONLY
-- sanctioned paths for the writes/reads they perform — RLS (task 2.3) denies
-- the underlying tables to ordinary callers, so these RPCs are the doors.
--
--   • ss_submit_complaint(payload jsonb)            → anon + authenticated
--       the ONLY complaint write path for anonymous complainants.
--   • ss_record_attestation(uuid, text, text)       → authenticated
--       the ONLY attestation write path (curator = auth.uid()).
--   • ss_get_policy_version(text, text)             → anon + authenticated
--       exact addressable read of one immutable policy revision.
--
-- All use `create or replace function` → idempotent / re-runnable in one paste.
-- ═══════════════════════════════════════════════════════════════

-- Ensure the API roles can use the schema at all (idempotent; already granted
-- in earlier migrations, repeated here for a clean standalone paste).
grant usage on schema public to anon, authenticated;

-- ───────────────────────────────────────────────────────────────
-- 13. ss_submit_complaint(payload jsonb)  (Req 3.5, 7.2, 8.1 — anon intake)
-- ───────────────────────────────────────────────────────────────
-- The ONLY complaint write path for an anonymous (non-account) complainant.
-- There is no insert policy on `complaints` (task 2.3), so a takedown can ONLY
-- be filed through this SECURITY DEFINER door, which:
--   1. RE-VALIDATES well-formedness IN SQL (third layer — see below); on
--      invalid input it RAISES and inserts NOTHING.
--   2. On valid input inserts exactly ONE `complaints` row at state='received',
--      received_at = now() (the 36-hour ack-SLA anchor, Req 7.2), with the
--      notice fields from the payload.
--   3. Appends ONE `moderation_log` row (action_type='received', complaint_id =
--      the new id, clip_id = the content_id if any, actor_id = auth.uid() —
--      NULL for an anonymous filer, detail carrying the confirmation_ref) — IN
--      THE SAME TRANSACTION (Req 8.1). If the log append fails, the whole insert
--      rolls back, so a complaint can never exist without its audit entry.
--   4. Returns ONLY the public confirmation_ref. It never selects or exposes any
--      other column — the complainant learns their reference and nothing else.
--
-- THREE-LAYER VALIDATION around the pure ssDmcaNoticeWellFormed spec (defense in
-- depth — a malformed notice cannot persist no matter how it arrives):
--   (a) the browser form gates submit with ssDmcaNoticeWellFormed (UX only);
--   (b) the submit-takedown Edge Function re-runs ssDmcaNoticeWellFormed before
--       calling this RPC (never trusts the client);
--   (c) THIS RPC re-validates a THIRD time in SQL, so even a direct RPC call that
--       bypasses the form and the function still cannot store a bad notice.
-- The SQL checks below MIRROR ssDmcaNoticeWellFormed EXACTLY:
--   work_identification : trimmed length 1..2000
--   target              : a non-empty content_id OR a target_url trimmed 1..2000
--   complainant_name    : trimmed length 1..200
--   complainant_email   : matches /^[^@\s]+@[^@\s]+\.[^@\s]+$/  (same regex)
--   good_faith          : strict JSON boolean true
--   accuracy_authority   : strict JSON boolean true
--   signature           : trimmed length 1..200
-- Whitespace-only strings trim to length 0 → treated as empty, exactly like the
-- JS helper (which uses String.prototype.trim()); we trim ALL whitespace via a
-- '^\s+|\s+$' regexp_replace so tabs/newlines collapse the same way.
create or replace function public.ss_submit_complaint(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_missing text[] := '{}';
  -- whitespace-trimmed projections (mirror String.trim(): all leading/trailing \s)
  v_work     text := regexp_replace(coalesce(payload->>'work_identification',''), '^\s+|\s+$', '', 'g');
  v_cid_raw  text := regexp_replace(coalesce(payload->>'content_id',''),          '^\s+|\s+$', '', 'g');
  v_url      text := regexp_replace(coalesce(payload->>'target_url',''),          '^\s+|\s+$', '', 'g');
  v_name     text := regexp_replace(coalesce(payload->>'complainant_name',''),    '^\s+|\s+$', '', 'g');
  v_email    text := coalesce(payload->>'complainant_email','');   -- regex matches as-is (no trim)
  v_sig      text := regexp_replace(coalesce(payload->>'signature',''),           '^\s+|\s+$', '', 'g');
  -- strict JSON boolean true (the string "true" or 1 would NOT match — mirrors === true)
  v_good_faith boolean := (payload -> 'good_faith')        = 'true'::jsonb;
  v_accuracy   boolean := (payload -> 'accuracy_authority') = 'true'::jsonb;
  v_cid_ok   boolean := char_length(v_cid_raw) >= 1;
  v_url_ok   boolean := char_length(v_url) between 1 and 2000;
  v_content_id uuid;
  v_id  uuid;
  v_ref text;
begin
  -- ── layer (c): re-validate well-formedness in SQL; collect every failing key ──
  if char_length(v_work) not between 1 and 2000 then v_missing := v_missing || 'work_identification'; end if;
  if not (v_cid_ok or v_url_ok)                  then v_missing := v_missing || 'target';             end if;
  if char_length(v_name) not between 1 and 200   then v_missing := v_missing || 'complainant_name';   end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'      then v_missing := v_missing || 'complainant_email';  end if;
  if v_good_faith is not true                     then v_missing := v_missing || 'good_faith';          end if;
  if v_accuracy   is not true                     then v_missing := v_missing || 'accuracy_authority';  end if;
  if char_length(v_sig) not between 1 and 200    then v_missing := v_missing || 'signature';           end if;

  -- invalid → raise WITHOUT inserting anything (no complaints row, no log row)
  if array_length(v_missing, 1) is not null then
    raise exception 'malformed DMCA notice: missing/invalid %', array_to_string(v_missing, ', ')
      using errcode = 'check_violation';
  end if;

  -- resolve a clip target only when content_id is a well-formed uuid; otherwise
  -- the notice stands on its target_url alone (the row stays URL-only).
  if v_cid_ok then
    begin
      v_content_id := v_cid_raw::uuid;
    exception when invalid_text_representation then
      v_content_id := null;
    end;
  end if;

  -- ── valid → insert exactly one complaint at state='received' (received_at = now) ──
  insert into complaints (
    state, content_id, target_url,
    work_identification, complainant_name, complainant_email,
    good_faith, accuracy_authority, signature,
    received_at
  ) values (
    'received',
    v_content_id,
    case when v_url_ok then v_url else null end,
    v_work, v_name, v_email,
    true, true, v_sig,
    now()
  )
  returning id, confirmation_ref into v_id, v_ref;

  -- ── append the 'received' audit entry IN THE SAME TRANSACTION (Req 8.1) ──
  -- actor_id = auth.uid() resolves to NULL for an anonymous filer (Req 8 note);
  -- the confirmation_ref is carried in detail so the receipt is provable from the log.
  insert into moderation_log (action_type, complaint_id, clip_id, actor_id, detail)
  values ('received', v_id, v_content_id, auth.uid(),
          jsonb_build_object('confirmation_ref', v_ref));

  -- ── return ONLY the public confirmation reference — never any other column ──
  return jsonb_build_object('confirmation_ref', v_ref);
end;
$$;

-- ───────────────────────────────────────────────────────────────
-- 14. ss_record_attestation(p_clip_id, p_tos_version, p_attestation_version)
--     (Req 1.3 / 1.4 — the only attestation write path)
-- ───────────────────────────────────────────────────────────────
-- Inserts exactly ONE attestations row for the SIGNED-IN curator
-- (curator_id = auth.uid(), accepted_at = now()) with the accepted ToS +
-- attestation copy versions. There is no insert policy on `attestations`
-- (task 2.3), so this SECURITY DEFINER door is the sole way to record one.
--
-- The caller must OWN the clip (content.creator_id = auth.uid()) — a curator
-- can only attest for their own upload. On ANY failure (not signed in, not the
-- owner, missing versions, FK violation) the function RAISES and inserts NO
-- row — so the clip never gains an attestation it didn't earn, and the
-- content_requires_attestation gate (task 2.2) keeps it UNPUBLISHED (Req 1.4).
create or replace function public.ss_record_attestation(
  p_clip_id            uuid,
  p_tos_version        text,
  p_attestation_version text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'must be signed in to record an attestation'
      using errcode = 'insufficient_privilege';
  end if;

  -- caller must own the clip being attested
  if not exists (
    select 1 from content c
     where c.id = p_clip_id
       and c.creator_id = v_uid
  ) then
    raise exception 'cannot attest for clip % — not owned by caller', p_clip_id
      using errcode = 'insufficient_privilege';
  end if;

  -- both versions must be recorded (non-empty)
  if p_tos_version is null or char_length(btrim(p_tos_version)) = 0
     or p_attestation_version is null or char_length(btrim(p_attestation_version)) = 0 then
    raise exception 'attestation requires a non-empty tos_version and attestation_version'
      using errcode = 'check_violation';
  end if;

  insert into attestations (clip_id, curator_id, accepted_at, tos_version, attestation_version)
  values (p_clip_id, v_uid, now(), p_tos_version, p_attestation_version);
end;
$$;

-- ───────────────────────────────────────────────────────────────
-- 15. ss_get_policy_version(p_doc, p_version)  (Req 2.7 / 2.8 — exact, never substitute)
-- ───────────────────────────────────────────────────────────────
-- Returns the EXACT stored body/version/effective_date for the addressed
-- (doc, version) pair. If that exact version does not exist (or is soft-
-- deleted), it RAISES "policy version unavailable" — it NEVER silently
-- substitutes another (e.g. the current) version (Req 2.8). policy_versions is
-- world-readable via RLS, but this RPC gives surfaces a single, explicit,
-- error-on-miss read path so a dangling version reference fails loudly.
create or replace function public.ss_get_policy_version(p_doc text, p_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_row policy_versions;
begin
  select * into v_row
    from policy_versions
   where doc = p_doc
     and version = p_version
     and deleted_at is null;

  if not found then
    raise exception 'policy version unavailable: doc=% version=%', p_doc, p_version
      using errcode = 'no_data_found';
  end if;

  return jsonb_build_object(
    'doc',            v_row.doc,
    'version',        v_row.version,
    'effective_date', v_row.effective_date,
    'body',           v_row.body
  );
end;
$$;

-- ── EXECUTE grants (repo convention: grant to the precise API roles) ──
-- ss_submit_complaint   → anon + authenticated (anonymous intake is the point)
-- ss_record_attestation → authenticated only (a curator attesting their upload)
-- ss_get_policy_version → anon + authenticated (public legal text, no login)
grant execute on function public.ss_submit_complaint(jsonb)                    to anon, authenticated;
grant execute on function public.ss_record_attestation(uuid, text, text)       to authenticated;
grant execute on function public.ss_get_policy_version(text, text)             to anon, authenticated;

-- Reload PostgREST so the new RPCs + grants are live immediately.
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 0029 COMPLETE — all of Tasks 2.1–2.4 are now in this one file:
--   2.1  four tables + indexes (attestations, policy_versions, complaints,
--        moderation_log).
--   2.2  DB-level guarantees: moderation_log append-only triggers, the
--        content_requires_attestation publish gate, and ss_is_admin().
--   2.3  RLS on all four tables (attestations owner-read; policy_versions
--        world-read; complaints + moderation_log admin-only read), plus the
--        confirmed read_live_content removal guarantee.
--   2.4  the Phase-1 SECURITY DEFINER RPCs: ss_submit_complaint (anon intake,
--        three-layer validation, atomic received-log), ss_record_attestation
--        (owner-gated), ss_get_policy_version (exact, error-on-miss) + grants
--        + notify pgrst reload.
--
-- [founder-run] apply 0029 in the Supabase SQL editor.
--   (Founder-applied SQL — nothing for the agent to run here. The file is
--    idempotent: paste the whole thing into Supabase SQL Editor → Run.)
-- ═══════════════════════════════════════════════════════════════
