-- ═══════════════════════════════════════════════════════════════
-- 0025_account_lifecycle.sql
-- SHOWSHAK — ACCOUNT DEACTIVATE / DELETE (30-day retention) + REACTIVATE
-- ───────────────────────────────────────────────────────────────
-- Settings → Account → Danger zone:
--   • Deactivate — temporarily hide the profile; restored automatically the
--     next time the user signs in.
--   • Delete — hide the profile NOW and start a 30-day retention window. If the
--     user signs in within 30 days, the account is fully restored; after 30 days
--     a founder-run purge job permanently removes the data (see footer).
--
-- Both are REVERSIBLE soft operations on the public `users` row (the existing
-- `deleted_at` soft-delete hides the profile via the app's standard
-- `deleted_at is null` filters). Two markers record intent + the clock:
--   • deactivated_at         — set by Deactivate
--   • deletion_requested_at  — set by Delete (the 30-day countdown anchor)
-- Reactivation clears all three. The actual irreversible purge of data + the
-- Supabase auth user requires the service role and is a FOUNDER-RUN scheduled
-- job (pg_cron skeleton in the footer) — it is intentionally NOT done here.
--
-- All three functions are SECURITY DEFINER + locked search_path, self-scoped to
-- auth.uid() (a user can only ever act on their OWN account), mirroring the
-- security posture of the 0019 analytics RPCs. Idempotent. Run: SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- ── Markers (deleted_at already exists from 0001) ──
alter table users add column if not exists deactivated_at        timestamptz;
alter table users add column if not exists deletion_requested_at timestamptz;

-- ── Deactivate: hide now, fully reversible on next sign-in ──
create or replace function public.ss_deactivate_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  update users
     set deleted_at = now(), deactivated_at = now(), deletion_requested_at = null, updated_at = now()
   where id = auth.uid();
end;
$$;

-- ── Request deletion: hide now + start the 30-day retention clock ──
create or replace function public.ss_request_account_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  update users
     set deleted_at = now(), deletion_requested_at = now(), deactivated_at = null, updated_at = now()
   where id = auth.uid();
end;
$$;

-- ── Reactivate: clear all flags. Returns true iff the account was flagged
--    (so the client can greet "welcome back"). Called once per tab on sign-in. ──
create or replace function public.ss_reactivate_account()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare was_flagged boolean;
begin
  if auth.uid() is null then return false; end if;
  select (deleted_at is not null or deactivated_at is not null or deletion_requested_at is not null)
    into was_flagged
    from users where id = auth.uid();
  if coalesce(was_flagged, false) then
    update users
       set deleted_at = null, deactivated_at = null, deletion_requested_at = null, updated_at = now()
     where id = auth.uid();
    return true;
  end if;
  return false;
end;
$$;

grant execute on function public.ss_deactivate_account()        to authenticated;
grant execute on function public.ss_request_account_deletion()  to authenticated;
grant execute on function public.ss_reactivate_account()        to authenticated;

-- Reload PostgREST so the new columns + RPCs are live immediately.
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- DONE (reversible layer). The client wires Deactivate/Delete to these RPCs and
-- auto-reactivates on sign-in.
--
-- ── FOUNDER-RUN (NOT executed here): the 30-day permanent purge ──
-- The irreversible deletion of expired accounts needs the service role (it must
-- remove the Supabase AUTH user, which RLS/anon cannot). Set up a scheduled job
-- (Supabase scheduled Edge Function, or pg_cron + a service-role function) that,
-- for every users row with `deletion_requested_at < now() - interval '30 days'`:
--   1. soft/hard-removes their content + event rows (or anonymizes),
--   2. deletes the public users row,
--   3. calls auth.admin.deleteUser(id) via the service role.
-- Until that job exists, expired accounts simply remain hidden (deleted_at set)
-- and recoverable — which is safe; nothing is lost prematurely.
-- ═══════════════════════════════════════════════════════════════
