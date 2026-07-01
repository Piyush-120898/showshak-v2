-- ═══════════════════════════════════════════════════════════════
-- 0034_curator_application.sql
-- SHOWSHAK — CURATOR APPLICATION & APPROVAL, PHASE 1: application table,
--            per-user admin flag, ss_is_admin() refine, submit RPC
-- (.kiro/specs/curator-application-approval — Task 2.1;
--  Requirements 1, 2, 5, 6, 13, 19)
-- ───────────────────────────────────────────────────────────────
-- Interposes a HUMAN REVIEW step between "a user wants to curate" and "a
-- user IS a curator." Submitting the 4-step application creates ONE
-- `curator_application` row at status='pending' and does NOT change the
-- applicant's role. Approval (Phase 2, migration 0035) is the ONLY thing
-- that flips role → 'curator', through an admin-only SECURITY DEFINER RPC.
--
-- ── SCOPE OF THIS PHASE-1 FILE (Task 2.1) ──
--   1. users.is_admin  — the additive per-user admin flag (admin bootstrap).
--   2. curator_application — one row per submitted application.
--   3. ss_is_admin() REFINE — recognise the per-user is_admin flag (so the
--      founder's ordinary browser JWT is admin without the service-role key),
--      keeping the 0029 service_role path.
--   4. RLS on curator_application — owner reads own; admin reads all; nobody
--      else (no insert/update/delete policy for normal roles).
--   5. ss_submit_curator_application(payload) — the ONLY insert path; a
--      SECURITY DEFINER RPC that re-validates the payload in SQL (mirroring
--      the pure ssValidateCuratorApplication) and leaves users.role UNCHANGED.
-- The audit table + approve/reject/verify RPCs live in 0035 (Phase 2); the
-- publish gate + badge/grandfather treatment in 0036 (Phase 3).
--
-- ── ADDITIVE + NON-REGRESSIVE + IDEMPOTENT ──
-- Adds only a new column (is_admin), a new table, new RLS policies, and new
-- functions. It does NOT drop, rename, retype, or remove any existing table
-- or column. `add column if not exists`, `create table if not exists`, and
-- drop-and-recreate of functions/policies make it re-runnable in one paste.
-- All timestamps are UTC (timestamptz). Number 0030 is RESERVED for DMCA
-- Phase 2 and is deliberately skipped.
--
-- Run: Supabase → SQL Editor → paste → Run.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;   -- gen_random_uuid() on fresh projects

-- ───────────────────────────────────────────────────────────────
-- 1. users.is_admin  (the per-user admin flag — admin bootstrap; Req 13)
-- ───────────────────────────────────────────────────────────────
-- Admin is granted by a ONE-TIME founder-run SQL line (no admin-granting UI —
-- the smallest attack surface for beta):
--     update public.users set is_admin = true where username = '<founder-handle>';
-- Additive, defaults false, never regresses an existing row.
alter table public.users add column if not exists is_admin boolean not null default false;

-- ───────────────────────────────────────────────────────────────
-- 2. curator_application  (Req 1, 6, 7, 8 — one row per submitted application)
-- ───────────────────────────────────────────────────────────────
-- A first-class, multi-instance, historical record: a rejected applicant
-- reapplies → a NEW row; the old one is retained. status is a closed set
-- (the Application_Status domain). reference_clip_path is a Storage object
-- path in the PRIVATE `review-clips` bucket — NEVER a content.id and NEVER a
-- Mux playback id (Req 3.1/3.2). Standard conventions (uuid PK, timestamps,
-- meta) as since 0001.
create table if not exists curator_application (
  id                  uuid primary key default gen_random_uuid(),
  applicant_id        uuid not null references users(id),   -- = auth.uid() at submit (Req 1.3)
  status              text not null default 'pending'
                        check (status in ('pending','approved','rejected')),  -- Application_Status (Req 8.1)
  applicant_info      jsonb not null default '{}',          -- Step 1 applicant info snapshot
  curator_info        jsonb not null default '{}',          -- Step 2 curator info (bio/pitch)
  genres              text[] not null default '{}',         -- 1..6 selected genres (Req 2.1/2.5)
  social_link         text not null,                        -- Step 3 primary field (Req 1.2/2.3)
  reference_clip_path text,                                 -- private review-clips path; null when omitted (Req 3)
  terms_version       text not null,                        -- accepted Curator_Terms version (Req 1.6)
  created_at          timestamptz default now(),
  updated_at          timestamptz,
  deleted_at          timestamptz,
  meta                jsonb default '{}'
);
create index if not exists idx_curapp_applicant on curator_application (applicant_id, created_at desc);
create index if not exists idx_curapp_status    on curator_application (status, created_at desc);

-- ───────────────────────────────────────────────────────────────
-- 3. ss_is_admin()  REFINE  (recognise the per-user is_admin flag; Req 13)
-- ───────────────────────────────────────────────────────────────
-- 0029 defined ss_is_admin() as a service_role-only check. This refinement
-- ALSO returns true for an authenticated user whose users.is_admin is strictly
-- true — so the founder's ordinary browser session is admin without holding
-- the service-role key. SECURITY DEFINER + locked search_path (the standard
-- posture). CONSERVATIVE: any error/absent value resolves to false (coalesce).
create or replace function ss_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(auth.role() = 'service_role', false)
      or coalesce((select u.is_admin from public.users u where u.id = auth.uid()), false);
$$;

-- ───────────────────────────────────────────────────────────────
-- 4. curator_application RLS  (owner-read own; admin-read all; else zero rows)
-- ───────────────────────────────────────────────────────────────
-- RLS is the security boundary. The applicant may read ONLY their own rows
-- (their profile status panel); an admin reads all (the console). There is
-- intentionally NO insert/update/delete policy for normal roles — inserts go
-- SOLELY through ss_submit_curator_application (SECURITY DEFINER, below), which
-- sets applicant_id = auth.uid() server-side; approve/reject (0035) mutate via
-- SECURITY DEFINER too. So a Normal_User/Guest SELECT that is neither owner nor
-- admin returns ZERO rows (Req 13.4), and no client can forge or self-approve.
alter table curator_application enable row level security;

drop policy if exists curapp_read_own on curator_application;
create policy curapp_read_own on curator_application
  for select using (applicant_id = auth.uid());          -- Req 6.2 (applicant sees own status)

drop policy if exists curapp_admin_read on curator_application;
create policy curapp_admin_read on curator_application
  for select using (ss_is_admin());                       -- Req 9 (admin reads all)

-- PostgREST needs a table-level SELECT grant for the API roles; RLS above is
-- what actually limits WHICH rows each caller sees (own / all / none).
grant usage on schema public to anon, authenticated;
grant select on curator_application to anon, authenticated;

-- ───────────────────────────────────────────────────────────────
-- 5. ss_submit_curator_application(payload jsonb)  (Req 1, 2, 5, 13 — the ONLY insert path)
-- ───────────────────────────────────────────────────────────────
-- There is no insert policy on curator_application, so an application can ONLY
-- be filed through this SECURITY DEFINER door, which:
--   1. requires an authenticated caller (auth.uid() not null), else raises.
--   2. RE-VALIDATES well-formedness IN SQL, MIRRORING the pure
--      ssValidateCuratorApplication EXACTLY (defense in depth — the browser
--      gate is UX only). On invalid input it RAISES and inserts NOTHING (Req 1.4).
--   3. On valid input inserts exactly ONE row: applicant_id = auth.uid(),
--      status='pending', the captured fields, the (nullable) reference_clip_path,
--      and terms_version. It LEAVES users.role UNCHANGED (Req 1.5/5.3) — no
--      promotion happens here.
--   4. Returns { application_id, status:'pending' } and nothing else.
--
-- SQL checks MIRROR ssValidateCuratorApplication (stable keys in fixed order):
--   applicant_info : payload.applicant has a non-empty trimmed name OR username
--   genres         : a JSON array of length 1..6
--   social_link    : trimmed length >= 1
--   terms          : payload.termsAccepted is the strict JSON boolean true
-- Whitespace-only strings trim to length 0 (via '^\s+|\s+$'), exactly like
-- String.prototype.trim(). reference_clip is OPTIONAL — never validated (Req 2.2).
create or replace function public.ss_submit_curator_application(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_missing  text[] := '{}';
  v_name     text := regexp_replace(coalesce(payload#>>'{applicant,name}',''),     '^\s+|\s+$', '', 'g');
  v_username text := regexp_replace(coalesce(payload#>>'{applicant,username}',''),  '^\s+|\s+$', '', 'g');
  v_link     text := regexp_replace(coalesce(payload->>'social_link',''),           '^\s+|\s+$', '', 'g');
  v_terms    boolean := (payload -> 'termsAccepted') = 'true'::jsonb;   -- strict === true
  v_genres_is_array boolean := jsonb_typeof(payload->'genres') = 'array';
  v_genres_len int := case when jsonb_typeof(payload->'genres') = 'array'
                            then jsonb_array_length(payload->'genres') else 0 end;
  v_genres   text[];
  v_ref      text := nullif(payload->>'reference_clip_path', '');   -- null when absent/empty (Req 3, optional)
  v_id       uuid;
begin
  -- caller must be authenticated (guests cannot apply)
  if v_uid is null then
    raise exception 'authentication required to submit a curator application'
      using errcode = 'insufficient_privilege';
  end if;

  -- ── re-validate well-formedness in SQL; collect every failing key in fixed order ──
  if not (char_length(v_name) >= 1 or char_length(v_username) >= 1)
     then v_missing := v_missing || 'applicant_info'; end if;
  if not (v_genres_is_array and v_genres_len between 1 and 6)
     then v_missing := v_missing || 'genres';         end if;
  if char_length(v_link) < 1
     then v_missing := v_missing || 'social_link';    end if;
  if v_terms is not true
     then v_missing := v_missing || 'terms';          end if;

  -- invalid → raise WITHOUT inserting anything (no application row)
  if array_length(v_missing, 1) is not null then
    raise exception 'malformed curator application: missing/invalid %', array_to_string(v_missing, ', ')
      using errcode = 'check_violation';
  end if;

  -- materialise genres jsonb array → text[]
  v_genres := array(select jsonb_array_elements_text(payload->'genres'));

  -- ── valid → insert exactly ONE pending application; role is NOT touched ──
  insert into curator_application (
    applicant_id, status, applicant_info, curator_info,
    genres, social_link, reference_clip_path, terms_version
  ) values (
    v_uid, 'pending',
    coalesce(payload->'applicant',    '{}'::jsonb),
    coalesce(payload->'curator_info', '{}'::jsonb),
    v_genres, v_link, v_ref,
    coalesce(payload->>'terms_version', '')
  )
  returning id into v_id;

  return jsonb_build_object('application_id', v_id, 'status', 'pending');
end;
$$;

grant execute on function public.ss_submit_curator_application(jsonb) to authenticated;

-- ───────────────────────────────────────────────────────────────
-- 6. PRIVATE REVIEW-CLIPS STORAGE BUCKET + POLICIES  (Req 3 — review-only)
-- ───────────────────────────────────────────────────────────────
-- The optional Reference_Clip lives in a PRIVATE bucket (public = false): its
-- objects are NOT servable by URL and carry NO Mux asset/playback id, so there
-- is no path by which it becomes a feed clip (Req 3.1/3.2). The applicant may
-- upload ONLY under their own uid prefix (review-clips/<auth.uid()>/…), may NOT
-- read it back (review-only — not even the owner; Req 3.5), and an Admin reads it
-- via ss_is_admin() (the signed-URL RPC in 0035 is the console's read path).
-- Idempotent: bucket upsert-skips, policies drop-and-recreate.
insert into storage.buckets (id, name, public)
values ('review-clips', 'review-clips', false)
on conflict (id) do nothing;

drop policy if exists reviewclip_owner_insert on storage.objects;
create policy reviewclip_owner_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'review-clips'
    and (storage.foldername(name))[1] = auth.uid()::text     -- own-prefix only (Req 3)
  );

drop policy if exists reviewclip_admin_read on storage.objects;
create policy reviewclip_admin_read on storage.objects
  for select using (bucket_id = 'review-clips' and ss_is_admin());   -- Req 3.3 (admin-only read)
-- NOTE: deliberately NO owner-read policy — the applicant uploads but never reads
-- the review clip back (Req 3.5).

-- Reload PostgREST so the new RPC + table are visible immediately (idempotent).
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- DONE (Phase 1 / migration 0034). An authenticated user can now file exactly
-- one well-formed pending application via ss_submit_curator_application; the
-- row is readable only by its owner or an admin; the optional review clip lands
-- in the PRIVATE review-clips bucket (admin-read only); NO role has changed.
-- The ONLY remaining founder-run step for Phase 1 (Task 2.2) is the one-time
-- admin bootstrap for YOUR account:
--     update public.users set is_admin = true where username = '<founder-handle>';
-- Phase 2 (0035): audit table + approve/reject/verify RPCs. Phase 3 (0036):
-- publish gate + drop the 0020 auto-promote trigger.
-- ═══════════════════════════════════════════════════════════════
