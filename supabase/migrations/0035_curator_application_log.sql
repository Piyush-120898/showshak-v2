-- ═══════════════════════════════════════════════════════════════
-- 0035_curator_application_log.sql
-- SHOWSHAK — CURATOR APPLICATION & APPROVAL, PHASE 2: append-only audit
--            table + the privileged approve / reject / verify RPCs
-- (.kiro/specs/curator-application-approval — Task 7.1;
--  Requirements 10, 11, 12, 13, 14, 19)
-- ───────────────────────────────────────────────────────────────
-- This is where the PRIVILEGED role/verified flips live. Every decision runs
-- ONLY through an admin-only SECURITY DEFINER RPC gated by ss_is_admin()
-- (refined in 0034 to honour the per-user users.is_admin flag). RLS denies the
-- underlying tables to ordinary callers, so these RPCs are the only doors.
-- Each RPC (a) authorises via ss_is_admin() — non-admin → no-op, NO change;
-- (b) checks its precondition (status='pending' for approve/reject; target
-- role='curator' for verify); (c) mutates state AND appends exactly ONE audit
-- row — atomically, in one transaction. Any failure rolls back the whole
-- function, so a decision can never persist without its audit entry (Req 14.5).
--
-- ── APPEND-ONLY AUDIT (modelled EXACTLY on 0029 moderation_log) ──
-- curator_application_log has NO updated_at / deleted_at (immutability is the
-- contract), NO foreign keys (the log must OUTLIVE the applications / users it
-- describes — Req 14.4), and a BEFORE UPDATE/DELETE trigger that raises for
-- EVERY role incl. service_role — so immutability is a property of the TABLE,
-- not merely an RLS policy a privileged role could bypass (Req 14.2).
--
-- ── REVIEW-CLIP READ (design deviation, documented) ──
-- The design sketched ss_admin_reference_clip_url as a SQL function returning a
-- signed URL. Standard Supabase Postgres cannot mint Storage signed URLs (no
-- signing secret in SQL). The equivalent guarantee is enforced by the 0034
-- Storage policy `reviewclip_admin_read USING ss_is_admin()`: only an admin JWT
-- may read/sign objects in the private review-clips bucket, so the admin console
-- generates the short-lived signed URL client-side via the Storage API. No SQL
-- URL function is needed or created here (Req 3.3 stays enforced by RLS).
--
-- ── ADDITIVE + NON-REGRESSIVE + IDEMPOTENT ──
-- Adds only a new table, its RLS + immutability triggers, and new functions.
-- Drops/recreates its own functions/triggers/policies so a re-run yields
-- identical definitions. Never alters an existing table/column. UTC throughout.
--
-- Run: Supabase → SQL Editor → paste → Run.  (Apply AFTER 0034.)
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ───────────────────────────────────────────────────────────────
-- 1. curator_application_log  (Req 14 — append-only, immutable audit trail)
-- ───────────────────────────────────────────────────────────────
-- One row per approve / reject / verify / unverify. Plain-uuid references with
-- NO FK so the log outlives what it describes (Req 14.4). NO updated_at /
-- deleted_at — append-only (Req 14.2/14.3).
create table if not exists curator_application_log (
  id             uuid primary key default gen_random_uuid(),
  action_type    text not null
                   check (action_type in ('approved','rejected','verified','unverified')),  -- Req 14.1
  application_id uuid,                          -- affected Application_Row (no FK — Req 14.4)
  applicant_id   uuid,                          -- affected applicant / curator (no FK)
  actor_id       uuid,                          -- acting admin (no FK)
  occurred_at    timestamptz not null default clock_timestamp(),   -- UTC, ms precision (Req 14.1)
  detail         jsonb not null default '{}',   -- e.g. { from, to, verified }
  created_at     timestamptz default now()
  -- NO updated_at / deleted_at — append-only (Req 14.2/14.3).
);
create index if not exists idx_curlog_application on curator_application_log (application_id, occurred_at);
create index if not exists idx_curlog_applicant   on curator_application_log (applicant_id, occurred_at);

-- ───────────────────────────────────────────────────────────────
-- 2. APPEND-ONLY IMMUTABILITY  (Req 14.2 — reject UPDATE/DELETE for ALL roles)
-- ───────────────────────────────────────────────────────────────
-- A BEFORE trigger fires for the table owner + service_role too (neither of
-- which RLS constrains), so immutability is a property of the TABLE itself.
-- INSERT is untouched (the log still grows).
create or replace function curator_application_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'curator_application_log is append-only (% rejected)', tg_op;   -- Req 14.2
end;
$$;

drop trigger if exists trg_curlog_no_update on curator_application_log;
create trigger trg_curlog_no_update
  before update on curator_application_log
  for each row execute function curator_application_log_immutable();

drop trigger if exists trg_curlog_no_delete on curator_application_log;
create trigger trg_curlog_no_delete
  before delete on curator_application_log
  for each row execute function curator_application_log_immutable();

-- ───────────────────────────────────────────────────────────────
-- 3. curator_application_log RLS  (admin-only read; Req 13.4)
-- ───────────────────────────────────────────────────────────────
-- The audit trail is admin/service-only on read: the sole select policy is
-- gated on ss_is_admin(), so anon/authenticated callers get ZERO rows. Inserts
-- happen only inside the SECURITY DEFINER RPCs below.
alter table curator_application_log enable row level security;

drop policy if exists curlog_admin_read on curator_application_log;
create policy curlog_admin_read on curator_application_log
  for select using (ss_is_admin());

-- ───────────────────────────────────────────────────────────────
-- 4. ss_approve_application(app_id uuid)  (Req 10, 13, 14 — the role flip)
-- ───────────────────────────────────────────────────────────────
-- Admin-only, pending-only. In ONE transaction: set the applicant's
-- users.role='curator' (that one row only — Req 10.5), set the application
-- status='approved', append one 'approved' audit row. Non-admin → no-op
-- (Req 13.2). Non-pending → no-op, NO role/status change (Req 10.4). Any
-- failure rolls back the whole txn (Req 10.2/14.5).
create or replace function public.ss_approve_application(app_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status    text;
  v_applicant uuid;
begin
  if not ss_is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;

  -- lock the application row for the duration of the transaction
  select status, applicant_id into v_status, v_applicant
    from curator_application where id = app_id for update;

  if v_status is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'not_pending');   -- Req 10.4
  end if;

  -- mutate + audit, atomically (Req 10.1)
  update public.users set role = 'curator', updated_at = now() where id = v_applicant;   -- exactly one row (Req 10.5)
  update curator_application set status = 'approved', updated_at = now() where id = app_id;
  insert into curator_application_log (action_type, application_id, applicant_id, actor_id, detail)
    values ('approved', app_id, v_applicant, auth.uid(), jsonb_build_object('from','pending','to','approved'));

  return jsonb_build_object('ok', true, 'status', 'approved', 'applicant_id', v_applicant);
end;
$$;

-- ───────────────────────────────────────────────────────────────
-- 5. ss_reject_application(app_id uuid)  (Req 11, 13, 14 — decision only)
-- ───────────────────────────────────────────────────────────────
-- Admin-only, pending-only. Set status='rejected', LEAVE users.role UNCHANGED
-- (Req 11.1), append one 'rejected' audit row — one transaction. Non-pending →
-- no-op (Req 11.3). Prior rejected rows are retained as history (Req 11.4).
create or replace function public.ss_reject_application(app_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status    text;
  v_applicant uuid;
begin
  if not ss_is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;

  select status, applicant_id into v_status, v_applicant
    from curator_application where id = app_id for update;

  if v_status is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'not_pending');   -- Req 11.3
  end if;

  update curator_application set status = 'rejected', updated_at = now() where id = app_id;   -- role UNCHANGED (Req 11.1)
  insert into curator_application_log (action_type, application_id, applicant_id, actor_id, detail)
    values ('rejected', app_id, v_applicant, auth.uid(), jsonb_build_object('from','pending','to','rejected'));

  return jsonb_build_object('ok', true, 'status', 'rejected', 'applicant_id', v_applicant);
end;
$$;

-- ───────────────────────────────────────────────────────────────
-- 6. ss_set_curator_verified(user_id uuid, verified boolean)  (Req 12, 13, 14)
-- ───────────────────────────────────────────────────────────────
-- Admin-only. Sets users.verified ONLY for an account whose role='curator'
-- (Req 12.3), and appends one 'verified'/'unverified' audit row — one txn.
-- Non-admin → no-op (Req 13.2). Non-curator target → no-op. Rolls back on
-- failure (Req 12.4/14.5).
create or replace function public.ss_set_curator_verified(user_id uuid, p_verified boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if not ss_is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;

  select role into v_role from public.users where id = user_id for update;

  if v_role is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_role <> 'curator' then
    return jsonb_build_object('ok', false, 'reason', 'not_curator');   -- Req 12.3
  end if;

  update public.users set verified = p_verified, updated_at = now() where id = user_id;
  insert into curator_application_log (action_type, application_id, applicant_id, actor_id, detail)
    values (case when p_verified then 'verified' else 'unverified' end,
            null, user_id, auth.uid(), jsonb_build_object('verified', p_verified));

  return jsonb_build_object('ok', true, 'verified', p_verified, 'user_id', user_id);
end;
$$;

-- ───────────────────────────────────────────────────────────────
-- 7. GRANTS  (execute to authenticated; the admin gate lives INSIDE each fn)
-- ───────────────────────────────────────────────────────────────
-- Granting execute to `authenticated` is safe: a non-admin caller hits the
-- ss_is_admin() gate at the top of every function and gets a no-op result with
-- NO state change (Req 13.2). The functions are the ONLY paths that can flip
-- role/verified; RLS blocks direct writes.
grant usage on schema public to authenticated;
grant execute on function public.ss_approve_application(uuid)          to authenticated;
grant execute on function public.ss_reject_application(uuid)           to authenticated;
grant execute on function public.ss_set_curator_verified(uuid, boolean) to authenticated;
-- Reload PostgREST so the new RPCs are visible immediately (idempotent).
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- DONE (Phase 2 / migration 0035). Admins can now approve (role→curator),
-- reject (status only), and verify/unverify curators — each atomic with exactly
-- one append-only audit row; non-admins and non-pending/non-curator targets are
-- no-ops; the audit log rejects UPDATE/DELETE for every role. Phase 3 (0036):
-- the RLS publish gate + dropping the 0020 auto-promote trigger.
-- ═══════════════════════════════════════════════════════════════
