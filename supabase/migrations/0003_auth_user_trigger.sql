-- ═══════════════════════════════════════════════════════════════
-- SHOWSHAK — AUTH → USERS BRIDGE  (Step 1: real sign-up)
-- ───────────────────────────────────────────────────────────────
-- WHAT THIS DOES (plain language):
-- When someone signs up — by Google, Apple, OR email — Supabase puts
-- a record in its private "auth.users" table (logins live there).
-- But OUR app reads from the public "users" table (profiles live
-- there). This file builds an automatic bridge: the instant an auth
-- account is created, a matching row is created in public.users,
-- with a unique @username auto-generated from their email/name.
--
-- WHY A DATABASE TRIGGER (not frontend code):
-- It runs for EVERY provider uniformly and can't be skipped or raced
-- by the browser. One source of truth. This is the standard Supabase
-- pattern.
--
-- CRITICAL: public.users.id is set to the SAME id as the auth account
-- (new.id). That linkage is what makes our RLS rules work — e.g.
-- "user_id = auth.uid()" can only match if users.id == the login id.
--
-- HOW TO USE: Supabase → SQL Editor → New query → paste → Run.
-- ═══════════════════════════════════════════════════════════════

-- ── The function that builds a profile row from a new auth account ──
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer            -- runs with owner rights, so it can write users
set search_path = public
as $$
declare
  base_username  text;
  final_username text;
  suffix         int := 0;
begin
  -- Build a clean handle from the email local-part, or name, else 'user'.
  base_username := lower(regexp_replace(
    coalesce(
      nullif(split_part(coalesce(new.email,''), '@', 1), ''),
      new.raw_user_meta_data->>'name',
      'user'
    ),
    '[^a-z0-9_]', '', 'g'
  ));
  if base_username is null or base_username = '' then
    base_username := 'user';
  end if;

  -- Ensure the handle is unique (append 1, 2, 3… if taken).
  final_username := base_username;
  while exists (select 1 from public.users where username = final_username) loop
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  end loop;

  -- Create the matching profile row. id = the auth account id (the link).
  insert into public.users (id, username, name, avatar_url, is_guest)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    false
  )
  on conflict (id) do nothing;   -- safety: never error if it already exists

  return new;
end;
$$;

-- ── Fire the function every time a new auth account is created ──
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────────────────────────────────────────────
-- USERS table access (the app needs to READ profiles + UPDATE own)
-- ───────────────────────────────────────────────────────────────
grant select on table users to anon, authenticated;     -- public profiles readable
grant insert, update on table users to authenticated;    -- manage your own row

alter table users enable row level security;

-- Anyone may read non-deleted profiles (needed for curator pages, @handles).
drop policy if exists users_read on users;
create policy users_read on users
  for select using (deleted_at is null);

-- You may only INSERT/UPDATE your own row (id must equal your login id).
drop policy if exists users_insert_own on users;
create policy users_insert_own on users
  for insert with check (id = auth.uid());

drop policy if exists users_update_own on users;
create policy users_update_own on users
  for update using (id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- DONE. Now any sign-up (Google/Apple/email) auto-creates a profile.
-- Next: enable the providers in the Supabase dashboard (see chat).
-- ═══════════════════════════════════════════════════════════════
