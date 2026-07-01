-- ═══════════════════════════════════════════════════════════════
-- 0037_rate_limiting.sql
-- SHOWSHAK — LIGHTWEIGHT API RATE LIMITING (money + safety surfaces)
-- ───────────────────────────────────────────────────────────────
-- ShowShak had NO application-level rate limiting: RLS controls WHAT a caller
-- may do, not HOW OFTEN. This adds a small, DB-backed fixed-window limiter used
-- by the two surfaces that touch MONEY or SAFETY:
--   • mux-upload-url    — minting Mux direct-upload URLs costs money; cap per
--                         curator so a rogue/compromised curator can't run up a
--                         Mux bill.
--   • submit-takedown   — public/anon; cap per client so the safe-harbour
--                         moderation queue can't be flooded.
-- Plus a cheap hardening of ss_submit_curator_application: reject a duplicate
-- PENDING application (enforces Req 7.3 at the DB, not just the UI) and cap
-- application submits per user per day.
--
-- DESIGN: a single append-style `rate_events` table + one SECURITY DEFINER
-- function ss_rate_allow(bucket, subject, limit, window_seconds) that, in one
-- call, prunes this key's expired rows, counts the rows still inside the window,
-- and EITHER records the event and returns true (allow) OR returns false
-- WITHOUT recording (deny). The decision is simply `count < limit`. The
-- function is the only path that touches the table; RLS denies it to everyone
-- else (no reads via the API). FAIL-OPEN by contract: a null/empty subject
-- returns true, so we never block traffic we cannot attribute.
--
-- ADDITIVE + IDEMPOTENT. UTC throughout. Run AFTER 0034-0036.
-- Run: Supabase → SQL Editor → paste → Run.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ───────────────────────────────────────────────────────────────
-- 1. rate_events  (one row per allowed action; internal, never API-readable)
-- ───────────────────────────────────────────────────────────────
create table if not exists rate_events (
  id          uuid primary key default gen_random_uuid(),
  bucket      text not null,          -- 'mux_upload' | 'takedown' | 'curator_application' | ...
  subject     text not null,          -- the identity key: user id, or a hashed client IP
  occurred_at timestamptz not null default now()
);
create index if not exists idx_rate_events_key on rate_events (bucket, subject, occurred_at);

-- Internal-only: enable RLS with NO policies → anon/authenticated get zero rows
-- and cannot write directly. All access is through ss_rate_allow (SECURITY
-- DEFINER, which bypasses RLS). No table grants to the API roles.
alter table rate_events enable row level security;

-- ───────────────────────────────────────────────────────────────
-- 2. ss_rate_allow(bucket, subject, limit, window_seconds) → boolean
-- ───────────────────────────────────────────────────────────────
-- Fixed-window limiter. Returns TRUE (and records the event) when the caller is
-- under the limit; FALSE (recording nothing) when at/over it. FAIL-OPEN on an
-- empty subject or a non-positive limit (can't/shouldn't enforce → allow).
-- Self-pruning: deletes this key's rows older than the window on each call, so
-- the table stays bounded per active key.
create or replace function public.ss_rate_allow(
  p_bucket text,
  p_subject text,
  p_limit int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz;
  v_count  int;
begin
  -- fail-open when we can't/shouldn't enforce
  if p_subject is null or length(trim(p_subject)) = 0 then return true; end if;
  if p_limit is null or p_limit <= 0 then return true; end if;
  if p_window_seconds is null or p_window_seconds <= 0 then return true; end if;

  v_cutoff := now() - make_interval(secs => p_window_seconds);

  -- prune expired rows for THIS key (keeps the table bounded per active key)
  delete from rate_events
   where bucket = p_bucket and subject = p_subject and occurred_at < v_cutoff;

  -- count what remains inside the window
  select count(*) into v_count
    from rate_events
   where bucket = p_bucket and subject = p_subject and occurred_at >= v_cutoff;

  if v_count >= p_limit then
    return false;                                   -- at/over limit → DENY, record nothing
  end if;

  insert into rate_events (bucket, subject) values (p_bucket, p_subject);
  return true;                                      -- under limit → ALLOW, recorded
end;
$$;

-- Edge Functions call this: submit-takedown with the ANON key, mux-upload-url
-- with the caller's AUTHENTICATED JWT. Grant execute to both (+ service_role
-- implicitly). The SECURITY DEFINER body is the only path to the table.
grant execute on function public.ss_rate_allow(text, text, int, int) to anon, authenticated;

-- ───────────────────────────────────────────────────────────────
-- 3. Harden ss_submit_curator_application (supersedes the 0034 definition)
-- ───────────────────────────────────────────────────────────────
-- Same validation + insert as 0034, PLUS two anti-abuse guards after the auth
-- check: (a) reject a duplicate PENDING application (DB-level Req 7.3 — the UI
-- already hides the CTA while pending, this blocks a direct-API bypass); and
-- (b) cap application submits at 5 per user per 24h via ss_rate_allow. Legit
-- users never hit either (the reapply flow only runs when the latest is
-- rejected). Both raise → the client wrapper fails soft.
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
  v_terms    boolean := (payload -> 'termsAccepted') = 'true'::jsonb;
  v_genres_is_array boolean := jsonb_typeof(payload->'genres') = 'array';
  v_genres_len int := case when jsonb_typeof(payload->'genres') = 'array'
                            then jsonb_array_length(payload->'genres') else 0 end;
  v_genres   text[];
  v_ref      text := nullif(payload->>'reference_clip_path', '');
  v_id       uuid;
begin
  if v_uid is null then
    raise exception 'authentication required to submit a curator application'
      using errcode = 'insufficient_privilege';
  end if;

  -- (a) one pending application at a time (Req 7.3, enforced at the DB)
  if exists (select 1 from curator_application
              where applicant_id = v_uid and status = 'pending' and deleted_at is null) then
    raise exception 'an application is already pending review' using errcode = 'raise_exception';
  end if;

  -- (b) anti-abuse: at most 5 application submits per user per 24h
  if not ss_rate_allow('curator_application', v_uid::text, 5, 86400) then
    raise exception 'too many applications, please try again later' using errcode = 'raise_exception';
  end if;

  -- re-validate well-formedness (mirrors ssValidateCuratorApplication)
  if not (char_length(v_name) >= 1 or char_length(v_username) >= 1)
     then v_missing := v_missing || 'applicant_info'; end if;
  if not (v_genres_is_array and v_genres_len between 1 and 6)
     then v_missing := v_missing || 'genres';         end if;
  if char_length(v_link) < 1
     then v_missing := v_missing || 'social_link';    end if;
  if v_terms is not true
     then v_missing := v_missing || 'terms';          end if;

  if array_length(v_missing, 1) is not null then
    raise exception 'malformed curator application: missing/invalid %', array_to_string(v_missing, ', ')
      using errcode = 'check_violation';
  end if;

  v_genres := array(select jsonb_array_elements_text(payload->'genres'));

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

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- DONE (0037). ss_rate_allow is live; ss_submit_curator_application now rejects
-- duplicate-pending + rate-limits per user. Founder-run to finish the money/
-- safety surfaces: redeploy the two Edge Functions so they call ss_rate_allow:
--   supabase functions deploy mux-upload-url
--   supabase functions deploy submit-takedown --no-verify-jwt
-- (Optional) set a RATE_SALT function secret for submit-takedown's IP hashing:
--   supabase secrets set RATE_SALT="<any-random-string>"
-- ═══════════════════════════════════════════════════════════════
