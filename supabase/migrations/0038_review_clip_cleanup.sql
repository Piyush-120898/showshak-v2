-- ═══════════════════════════════════════════════════════════════
-- 0038_review_clip_cleanup.sql
-- SHOWSHAK — delete the review-only reference clip once an application is
--            DECIDED (approved or rejected). Data-minimisation (DPDP) + no
--            dangling review media once it has served its single purpose.
-- (.kiro/specs/curator-application-approval — follow-up)
-- ───────────────────────────────────────────────────────────────
-- The optional Reference_Clip lives in the PRIVATE `review-clips` Storage
-- bucket for the admin to review a PENDING application. Once the admin approves
-- or rejects, the clip is no longer needed. This migration:
--   1. adds an admin DELETE policy on the review-clips bucket so the console can
--      remove the object via the Storage API (RLS previously allowed admin
--      SELECT only);
--   2. re-declares ss_approve_application / ss_reject_application so the terminal
--      decision ALSO nulls `curator_application.reference_clip_path` in the same
--      transaction — clearing the DB pointer so no rejected-row "load clip"
--      button dangles and no orphaned path remains.
-- The physical Storage object is removed CLIENT-SIDE by the admin console
-- (window.ssDB.storage.from('review-clips').remove([path])) right after the RPC
-- succeeds — the sanctioned way to delete the backing file (a bare
-- DELETE on storage.objects would orphan it). The decision AUDIT trail
-- (curator_application_log) is untouched — we keep who/when, drop only the media.
--
-- ADDITIVE + IDEMPOTENT. Run AFTER 0034-0037.
-- Run: Supabase → SQL Editor → paste → Run.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. Admin DELETE on the private review-clips bucket
-- ───────────────────────────────────────────────────────────────
drop policy if exists reviewclip_admin_delete on storage.objects;
create policy reviewclip_admin_delete on storage.objects
  for delete using (bucket_id = 'review-clips' and ss_is_admin());

-- ───────────────────────────────────────────────────────────────
-- 2. Approve — same as 0035, PLUS null out reference_clip_path
-- ───────────────────────────────────────────────────────────────
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

  select status, applicant_id into v_status, v_applicant
    from curator_application where id = app_id for update;

  if v_status is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'not_pending');
  end if;

  update public.users set role = 'curator', updated_at = now() where id = v_applicant;
  update curator_application
     set status = 'approved', reference_clip_path = null, updated_at = now()
   where id = app_id;   -- clip pointer cleared on decision (physical file removed by the console)
  insert into curator_application_log (action_type, application_id, applicant_id, actor_id, detail)
    values ('approved', app_id, v_applicant, auth.uid(), jsonb_build_object('from','pending','to','approved'));

  return jsonb_build_object('ok', true, 'status', 'approved', 'applicant_id', v_applicant);
end;
$$;

-- ───────────────────────────────────────────────────────────────
-- 3. Reject — same as 0035, PLUS null out reference_clip_path
-- ───────────────────────────────────────────────────────────────
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
    return jsonb_build_object('ok', false, 'reason', 'not_pending');
  end if;

  update curator_application
     set status = 'rejected', reference_clip_path = null, updated_at = now()
   where id = app_id;   -- role UNCHANGED; clip pointer cleared on decision
  insert into curator_application_log (action_type, application_id, applicant_id, actor_id, detail)
    values ('rejected', app_id, v_applicant, auth.uid(), jsonb_build_object('from','pending','to','rejected'));

  return jsonb_build_object('ok', true, 'status', 'rejected', 'applicant_id', v_applicant);
end;
$$;

grant execute on function public.ss_approve_application(uuid) to authenticated;
grant execute on function public.ss_reject_application(uuid)  to authenticated;

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- DONE (0038). Approve/reject now null reference_clip_path; the admin console
-- removes the private Storage object via the Storage API after the decision.
-- No founder step beyond applying this migration (the console change ships with
-- the frontend deploy).
-- ═══════════════════════════════════════════════════════════════
