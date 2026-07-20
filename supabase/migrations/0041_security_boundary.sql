-- 0041_security_boundary.sql
-- Additive security boundary: protect privileged columns, introduce a
-- server-owned content asset map, and replace caller-selected rate limits.
-- Apply only after 0040 has been reviewed; do not run against production
-- without first exercising the staging exploit tests.

create extension if not exists pgcrypto;

-- Make upload limits part of the database contract instead of relying on
-- dashboard-only setup. Existing objects are retained; limits apply to future
-- uploads and remain compatible with the current avatar/video clients.
insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'avatars', 'avatars', true, 5 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'review-clips', 'review-clips', false, 300 * 1024 * 1024,
  array['video/mp4', 'video/webm', 'video/quicktime']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- The browser may edit profile fields, but never trust it with privilege,
-- lifecycle, ownership, counters, or external media identifiers.
create or replace function public.ss_guard_users_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_internal boolean := auth.role() = 'service_role'
                       or current_setting('app.ss_privileged_write', true) = 'on';
begin
  if v_internal then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role is distinct from 'user'
       or coalesce(new.verified, false)
       or coalesce(new.is_admin, false)
       or coalesce(new.is_guest, false)
       or new.curator_since is not null
       or new.deleted_at is not null
       or new.deactivated_at is not null
       or new.deletion_requested_at is not null then
      raise exception 'privileged user fields are server managed'
        using errcode = 'insufficient_privilege';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.role is distinct from old.role
       or new.verified is distinct from old.verified
       or new.is_admin is distinct from old.is_admin
       or new.curator_since is distinct from old.curator_since
       or new.deleted_at is distinct from old.deleted_at
       or new.deactivated_at is distinct from old.deactivated_at
       or new.deletion_requested_at is distinct from old.deletion_requested_at
       or new.is_guest is distinct from old.is_guest then
      raise exception 'privileged user fields are server managed'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ss_guard_users_write on public.users;
create trigger ss_guard_users_write
  before insert or update on public.users
  for each row execute function public.ss_guard_users_write();

-- Browser-admin sessions must be phishing-resistant before they can read or
-- mutate sensitive admin data. The service role remains available to workers.
create or replace function public.ss_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(auth.role() = 'service_role', false)
      or (
        coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
        and coalesce((select u.is_admin from public.users u where u.id = auth.uid()), false)
      );
$$;
revoke execute on function public.ss_is_admin() from public, anon;
grant execute on function public.ss_is_admin() to authenticated;

-- Server-owned source of truth for the Mux upload lifecycle. Browser roles get
-- no table grants or policies; webhook/upload workers use service_role.
create table if not exists public.content_assets (
  content_id uuid primary key references public.content(id) on delete cascade,
  owner_id uuid not null references public.users(id),
  upload_id text unique,
  mux_asset_id text unique,
  mux_playback_id text,
  lifecycle text not null default 'processing'
    check (lifecycle in ('draft','processing','live','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.content_assets enable row level security;
revoke all on public.content_assets from public, anon, authenticated;
grant all on public.content_assets to service_role;

-- Backfill pre-migration clips so delete/retry paths never have to trust the
-- browser-writable content media columns after this boundary goes live.
do $$
declare
  v_duplicate text;
begin
  select nullif(meta->>'mux_upload_id', '') into v_duplicate
    from public.content
   where nullif(meta->>'mux_upload_id', '') is not null
   group by nullif(meta->>'mux_upload_id', '') having count(*) > 1
   limit 1;
  if v_duplicate is not null then
    raise exception 'duplicate historical Mux upload id must be resolved before 0041: %', v_duplicate;
  end if;

  select nullif(mux_asset_id, '') into v_duplicate
    from public.content
   where nullif(mux_asset_id, '') is not null
   group by nullif(mux_asset_id, '') having count(*) > 1
   limit 1;
  if v_duplicate is not null then
    raise exception 'duplicate historical Mux asset id must be resolved before 0041: %', v_duplicate;
  end if;
end;
$$;

insert into public.content_assets (
  content_id, owner_id, upload_id, mux_asset_id, mux_playback_id, lifecycle,
  created_at, updated_at
)
select c.id, c.creator_id,
       nullif(c.meta->>'mux_upload_id', ''),
       nullif(c.mux_asset_id, ''),
       nullif(c.mux_playback_id, ''),
       case
         when c.status = 'live' then 'live'
         when c.status = 'removed' or c.deleted_at is not null then 'removed'
         when c.status = 'draft' then 'draft'
         else 'processing'
       end,
       coalesce(c.created_at, now()), coalesce(c.updated_at, now())
  from public.content c
on conflict (content_id) do nothing;

create or replace function public.ss_guard_content_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_internal boolean := auth.role() = 'service_role'
                       or current_setting('app.ss_privileged_write', true) = 'on';
begin
  if v_internal then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.status, '') not in ('draft', 'processing')
       or coalesce(new.restricted, false)
       or new.mux_asset_id is not null
       or new.mux_playback_id is not null
       or new.thumbnail_url is not null
       or new.url is not null
       or new.duration_sec is not null
       or coalesce(new.fires_count, 0) <> 0
       or coalesce(new.saves_count, 0) <> 0
       or coalesce(new.views_count, 0) <> 0
       or coalesce(new.watch_it_count, 0) <> 0
       or coalesce(new.shares_count, 0) <> 0
       or new.deleted_at is not null
       or new.created_at is null
       or abs(extract(epoch from (coalesce(new.created_at, now()) - now()))) > 300
       or char_length(coalesce(new.meta->>'mux_upload_id', '')) > 200
       or new.meta ?| array['mux_asset_id','mux_playback_id','mux_clip_asset_id','mux_source_asset_id','rejected_reason'] then
      raise exception 'content lifecycle and media fields are server managed'
        using errcode = 'insufficient_privilege';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.creator_id is distinct from old.creator_id
       or new.created_at is distinct from old.created_at
       or (new.status is distinct from old.status
           and not (old.status = 'draft' and new.status = 'processing'))
       or new.restricted is distinct from old.restricted
       or new.mux_asset_id is distinct from old.mux_asset_id
       or new.mux_playback_id is distinct from old.mux_playback_id
       or new.thumbnail_url is distinct from old.thumbnail_url
       or new.url is distinct from old.url
       or new.duration_sec is distinct from old.duration_sec
       or new.fires_count is distinct from old.fires_count
       or new.saves_count is distinct from old.saves_count
       or new.views_count is distinct from old.views_count
       or new.watch_it_count is distinct from old.watch_it_count
       or new.shares_count is distinct from old.shares_count
       or (new.deleted_at is distinct from old.deleted_at
           and not (old.status = 'draft' and old.deleted_at is null and new.deleted_at is not null))
       or (new.meta->>'mux_asset_id') is distinct from (old.meta->>'mux_asset_id')
       or (new.meta->>'mux_playback_id') is distinct from (old.meta->>'mux_playback_id')
       or (new.meta->>'mux_clip_asset_id') is distinct from (old.meta->>'mux_clip_asset_id')
       or (new.meta->>'mux_source_asset_id') is distinct from (old.meta->>'mux_source_asset_id')
       or (new.meta->>'rejected_reason') is distinct from (old.meta->>'rejected_reason')
       or ((new.meta->>'mux_upload_id') is distinct from (old.meta->>'mux_upload_id')
           and not (old.status = 'draft' and new.status = 'processing'
                    and nullif(old.meta->>'mux_upload_id', '') is null
                    and char_length(coalesce(new.meta->>'mux_upload_id', '')) between 1 and 200)) then
      raise exception 'content lifecycle, ownership, counters, and media fields are server managed'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ss_guard_content_write on public.content;
create trigger ss_guard_content_write
  before insert or update on public.content
  for each row execute function public.ss_guard_content_write();

-- Cached counters are maintained by trusted triggers. Scope the bypass to the
-- nested update and restore its previous value before returning so it cannot
-- leak into later work in the same transaction.
create or replace function public.sync_fires_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous text := current_setting('app.ss_privileged_write', true);
begin
  perform set_config('app.ss_privileged_write', 'on', true);
  if tg_op = 'INSERT' then
    update content set fires_count = fires_count + 1 where id = new.content_id;
  elsif tg_op = 'DELETE' then
    update content set fires_count = greatest(fires_count - 1, 0) where id = old.content_id;
  end if;
  perform set_config('app.ss_privileged_write', coalesce(v_previous, 'off'), true);
  return null;
exception when others then
  perform set_config('app.ss_privileged_write', coalesce(v_previous, 'off'), true);
  raise;
end;
$$;

create or replace function public.sync_views_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator uuid;
  v_owner_views integer;
  v_previous text := current_setting('app.ss_privileged_write', true);
begin
  if tg_op <> 'INSERT' then
    return null;
  end if;

  select creator_id into v_creator from content where id = new.content_id;
  perform set_config('app.ss_privileged_write', 'on', true);
  if new.user_id is distinct from v_creator then
    update content set views_count = coalesce(views_count, 0) + 1
     where id = new.content_id;
  else
    select count(*) into v_owner_views from view_events
     where content_id = new.content_id and user_id = v_creator;
    if v_owner_views = 1 then
      update content set views_count = coalesce(views_count, 0) + 1
       where id = new.content_id;
    end if;
  end if;
  perform set_config('app.ss_privileged_write', coalesce(v_previous, 'off'), true);
  return null;
exception when others then
  perform set_config('app.ss_privileged_write', coalesce(v_previous, 'off'), true);
  raise;
end;
$$;

create or replace function public.ss_register_content_asset()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.content_assets (content_id, owner_id, lifecycle, upload_id)
  values (new.id, new.creator_id, coalesce(nullif(new.status, ''), 'processing'),
          nullif(new.meta->>'mux_upload_id', ''))
  on conflict (content_id) do nothing;
  return new;
end;
$$;

drop trigger if exists ss_register_content_asset on public.content;
create trigger ss_register_content_asset
  after insert on public.content
  for each row execute function public.ss_register_content_asset();

create or replace function public.ss_sync_content_asset_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.content_assets set
    lifecycle = case
      when new.deleted_at is not null or new.status = 'removed' then 'removed'
      when new.status = 'live' then 'live'
      when new.status = 'draft' then 'draft'
      else 'processing'
    end,
    upload_id = coalesce(upload_id, nullif(new.meta->>'mux_upload_id', '')),
    updated_at = now()
  where content_id = new.id;
  return new;
end;
$$;

drop trigger if exists ss_sync_content_asset_lifecycle on public.content;
create trigger ss_sync_content_asset_lifecycle
  after update of status, deleted_at, meta on public.content
  for each row execute function public.ss_sync_content_asset_lifecycle();

-- Fixed policies are server-owned. A caller supplies only bucket + subject;
-- unknown buckets fail closed instead of silently becoming unbounded.
create table if not exists public.rate_limit_policies (
  bucket text primary key check (length(bucket) between 1 and 64),
  max_events integer not null check (max_events between 1 and 100000),
  window_seconds integer not null check (window_seconds between 1 and 604800),
  enabled boolean not null default true
);
insert into public.rate_limit_policies (bucket, max_events, window_seconds) values
  ('curator_application', 5, 86400),
  ('mux_upload', 20, 3600),
  ('takedown', 10, 3600),
  ('tmdb_search', 60, 600),
  ('tmdb_write', 30, 3600),
  ('delete_clip', 30, 3600),
  ('title_create', 30, 3600),
  ('view_event', 300, 3600),
  ('watch_event', 120, 3600),
  ('share_event', 60, 3600),
  ('view_event_anon', 300, 3600),
  ('watch_event_anon', 120, 3600),
  ('share_event_anon', 60, 3600),
  ('feedback', 5, 3600),
  ('telemetry', 30, 3600)
on conflict (bucket) do nothing;
alter table public.rate_limit_policies enable row level security;
revoke all on public.rate_limit_policies from public, anon, authenticated;
grant all on public.rate_limit_policies to service_role;

create or replace function public.ss_rate_consume(p_bucket text, p_subject text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_window integer;
  v_cutoff timestamptz;
  v_oldest timestamptz;
  v_count integer;
  v_subject text := left(trim(coalesce(p_subject, '')), 256);
begin
  select max_events, window_seconds into v_limit, v_window
    from public.rate_limit_policies where bucket = p_bucket and enabled;
  if v_limit is null or v_subject = '' then
    return jsonb_build_object('allowed', false, 'retry_after_seconds', 60);
  end if;

  -- Serialize each bucket/subject pair so concurrent requests cannot overshoot.
  perform pg_advisory_xact_lock(hashtextextended(p_bucket || ':' || v_subject, 0));
  v_cutoff := now() - make_interval(secs => v_window);
  delete from public.rate_events
   where bucket = p_bucket and subject = v_subject and occurred_at < v_cutoff;
  select count(*), min(occurred_at) into v_count, v_oldest
    from public.rate_events
   where bucket = p_bucket and subject = v_subject and occurred_at >= v_cutoff;

  if v_count >= v_limit then
    return jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', greatest(1, ceil(extract(epoch from (v_oldest + make_interval(secs => v_window) - now())))::int)
    );
  end if;
  insert into public.rate_events (bucket, subject) values (p_bucket, v_subject);
  return jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
end;
$$;
revoke all on function public.ss_rate_consume(text, text) from public, anon, authenticated;
grant execute on function public.ss_rate_consume(text, text) to service_role;

-- Keep the old signature only as a compatibility shim for trusted callers;
-- supplied limits are intentionally ignored.
create or replace function public.ss_rate_allow(p_bucket text, p_subject text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce((public.ss_rate_consume(p_bucket, p_subject)->>'allowed')::boolean, false);
end;
$$;
revoke all on function public.ss_rate_allow(text, text, int, int) from public, anon, authenticated;
grant execute on function public.ss_rate_allow(text, text, int, int) to service_role;

-- Existing application RPC remains compatible, but now calls the internal
-- limiter; authenticated clients cannot invoke the limiter directly.
create or replace function public.ss_submit_curator_application(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := regexp_replace(coalesce(payload#>>'{applicant,name}',''), '^\s+|\s+$', '', 'g');
  v_username text := regexp_replace(coalesce(payload#>>'{applicant,username}',''), '^\s+|\s+$', '', 'g');
  v_link text := regexp_replace(coalesce(payload->>'social_link',''), '^\s+|\s+$', '', 'g');
  v_terms boolean := coalesce((payload -> 'termsAccepted') = 'true'::jsonb, false);
  v_genres_len int := case when jsonb_typeof(payload->'genres') = 'array' then jsonb_array_length(payload->'genres') else 0 end;
  v_reference text := nullif(btrim(coalesce(payload->>'reference_clip_path', '')), '');
  v_id uuid;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = 'insufficient_privilege'; end if;
  if payload is null or jsonb_typeof(payload) <> 'object' or octet_length(payload::text) > 32768 then
    raise exception 'malformed curator application' using errcode = 'invalid_parameter_value';
  end if;
  if exists (select 1 from curator_application where applicant_id = v_uid and status = 'pending' and deleted_at is null) then
    raise exception 'an application is already pending';
  end if;
  if char_length(v_name) < 1 and char_length(v_username) < 1 then raise exception 'malformed curator application'; end if;
  if not (jsonb_typeof(payload->'genres') = 'array' and v_genres_len between 1 and 6) then raise exception 'malformed curator application'; end if;
  if char_length(v_link) < 1 or v_terms is not true then raise exception 'malformed curator application'; end if;
  if v_reference is not null and (
      char_length(v_reference) > 512
      or split_part(v_reference, '/', 1) <> v_uid::text
      or v_reference like '%..%'
    ) then
    raise exception 'invalid reference clip path' using errcode = 'check_violation';
  end if;
  if not coalesce((public.ss_rate_consume('curator_application', v_uid::text)->>'allowed')::boolean, false) then
    raise exception 'too many applications, please try again later';
  end if;
  insert into curator_application (applicant_id,status,applicant_info,curator_info,genres,social_link,reference_clip_path,terms_version)
  values (v_uid,'pending',coalesce(payload->'applicant','{}'::jsonb),coalesce(payload->'curator_info','{}'::jsonb),array(select jsonb_array_elements_text(payload->'genres')),v_link,v_reference,coalesce(payload->>'terms_version',''))
  returning id into v_id;
  return jsonb_build_object('application_id', v_id, 'status', 'pending');
end;
$$;
grant execute on function public.ss_submit_curator_application(jsonb) to authenticated;
revoke execute on function public.ss_submit_curator_application(jsonb) from public, anon;

-- Catalog writes are curator-only, bounded, and deduplicated under an
-- advisory lock. Search remains a public read path; this function is the only
-- browser path that can create a title row.
create or replace function public.find_or_create_title(p_name text, p_year int default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  select role into v_role from public.users
   where id = v_uid and deleted_at is null and deactivated_at is null;
  if v_uid is null or v_role <> 'curator' then
    raise exception 'curator access required' using errcode = 'insufficient_privilege';
  end if;
  if char_length(v_name) not between 1 and 200 then
    raise exception 'title name is invalid' using errcode = 'check_violation';
  end if;
  if p_year is not null and p_year not between 1888 and extract(year from now())::int + 5 then
    raise exception 'title year is invalid' using errcode = 'check_violation';
  end if;
  if not coalesce((public.ss_rate_consume('title_create', v_uid::text)->>'allowed')::boolean, false) then
    raise exception 'too many title creates, please try again later';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(v_name) || ':' || coalesce(p_year::text, ''), 0));
  select id into v_id from public.titles
   where deleted_at is null and lower(name) = lower(v_name)
     and (p_year is null or year = p_year or year is null)
   order by (case when year = p_year then 0 else 1 end), created_at asc
   limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.titles (name, year, meta)
    values (v_name, p_year, jsonb_build_object('source', 'curator'))
    returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.find_or_create_title(text, int) from public, anon;
grant execute on function public.find_or_create_title(text, int) to authenticated;

-- Mark existing trusted RPC write paths so the users trigger does not break
-- account lifecycle or admin decisions. Direct table updates remain blocked.
create or replace function public.ss_deactivate_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  perform set_config('app.ss_privileged_write', 'on', true);
  update users set deleted_at = now(), deactivated_at = now(), deletion_requested_at = null, updated_at = now()
   where id = auth.uid();
end; $$;

create or replace function public.ss_request_account_deletion()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  perform set_config('app.ss_privileged_write', 'on', true);
  update users set deleted_at = now(), deletion_requested_at = now(), deactivated_at = null, updated_at = now()
   where id = auth.uid();
end; $$;

create or replace function public.ss_reactivate_account()
returns boolean language plpgsql security definer set search_path = public as $$
declare was_flagged boolean;
begin
  if auth.uid() is null then return false; end if;
  select (deleted_at is not null or deactivated_at is not null or deletion_requested_at is not null)
    into was_flagged from users where id = auth.uid();
  if coalesce(was_flagged, false) then
    perform set_config('app.ss_privileged_write', 'on', true);
    update users set deleted_at = null, deactivated_at = null, deletion_requested_at = null, updated_at = now()
     where id = auth.uid();
    return true;
  end if;
  return false;
end; $$;

create or replace function public.ss_set_curator_verified(user_id uuid, p_verified boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  if not ss_is_admin() then return jsonb_build_object('ok', false, 'reason', 'not_admin'); end if;
  select role into v_role from users where id = user_id for update;
  if v_role is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_role <> 'curator' then return jsonb_build_object('ok', false, 'reason', 'not_curator'); end if;
  perform set_config('app.ss_privileged_write', 'on', true);
  update users set verified = p_verified, updated_at = now() where id = user_id;
  insert into curator_application_log (action_type, application_id, applicant_id, actor_id, detail)
    values (case when p_verified then 'verified' else 'unverified' end, null, user_id, auth.uid(), jsonb_build_object('verified', p_verified));
  return jsonb_build_object('ok', true, 'verified', p_verified, 'user_id', user_id);
end; $$;

create or replace function public.ss_approve_application(app_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_status text; v_applicant uuid;
begin
  if not ss_is_admin() then return jsonb_build_object('ok', false, 'reason', 'not_admin'); end if;
  select status, applicant_id into v_status, v_applicant from curator_application where id = app_id for update;
  if v_status is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_status <> 'pending' then return jsonb_build_object('ok', false, 'reason', 'not_pending'); end if;
  perform set_config('app.ss_privileged_write', 'on', true);
  update users set role = 'curator', updated_at = now() where id = v_applicant;
  update curator_application set status = 'approved', reference_clip_path = null, updated_at = now() where id = app_id;
  insert into curator_application_log (action_type, application_id, applicant_id, actor_id, detail)
    values ('approved', app_id, v_applicant, auth.uid(), jsonb_build_object('from','pending','to','approved'));
  return jsonb_build_object('ok', true, 'status', 'approved', 'applicant_id', v_applicant);
end; $$;

-- SECURITY DEFINER functions otherwise inherit PostgreSQL's default PUBLIC
-- EXECUTE grant. Keep browser access only on the explicit authenticated admin
-- paths; anonymous complaint intake now enters through the Edge Function's
-- service-role client, which is the only caller of the complaint RPC.
revoke execute on function public.ss_submit_complaint(jsonb) from public, anon, authenticated;
grant execute on function public.ss_submit_complaint(jsonb) to service_role;
revoke insert on table public.feedback from public, anon, authenticated;
drop policy if exists feedback_insert on public.feedback;

-- Event tables remain insert-only, but each direct REST insert now passes a
-- server-owned quota and shape check. This protects the analytics stream even
-- if a caller bypasses the browser recorder wrappers.
create or replace function public.ss_guard_event_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket text := case tg_table_name
    when 'view_events' then 'view_event'
    when 'watch_events' then 'watch_event'
    else 'share_event' end;
  v_headers jsonb := '{}'::jsonb;
  v_headers_raw text := current_setting('request.headers', true);
  v_ip text;
  v_subject text;
  v_allowed boolean;
  v_watch_ms integer;
begin
  if nullif(v_headers_raw, '') is not null then
    begin
      v_headers := v_headers_raw::jsonb;
    exception when others then
      v_headers := '{}'::jsonb;
    end;
  end if;
  if new.user_id is null then
    v_bucket := v_bucket || '_anon';
    v_ip := btrim(split_part(coalesce(v_headers->>'cf-connecting-ip', v_headers->>'x-real-ip', v_headers->>'x-forwarded-for', ''), ',', 1));
    v_subject := case when v_ip = '' then 'anonymous:unknown'
      else 'anonymous:' || encode(digest(v_ip, 'sha256'), 'hex') end;
  else
    v_subject := new.user_id::text;
  end if;
  if new.content_id is null then
    raise exception 'content_id is required' using errcode = 'check_violation';
  end if;
  if tg_table_name = 'view_events' then
    v_watch_ms := (to_jsonb(new)->>'watch_ms')::integer;
    if v_watch_ms is null or v_watch_ms not between 0 and 600000 then
      raise exception 'watch_ms is invalid' using errcode = 'check_violation';
    end if;
  end if;
  v_allowed := coalesce((public.ss_rate_consume(v_bucket, v_subject)->>'allowed')::boolean, false);
  if not v_allowed then
    raise exception 'event rate limit exceeded' using errcode = 'program_limit_exceeded';
  end if;
  return new;
end;
$$;

drop trigger if exists ss_guard_view_event_insert on public.view_events;
create trigger ss_guard_view_event_insert before insert on public.view_events
for each row execute function public.ss_guard_event_insert();
drop trigger if exists ss_guard_watch_event_insert on public.watch_events;
create trigger ss_guard_watch_event_insert before insert on public.watch_events
for each row execute function public.ss_guard_event_insert();
drop trigger if exists ss_guard_share_event_insert on public.share_events;
create trigger ss_guard_share_event_insert before insert on public.share_events
for each row execute function public.ss_guard_event_insert();
revoke execute on function public.sync_content_genres(uuid) from public, anon, authenticated;
grant execute on function public.sync_content_genres(uuid) to service_role;
revoke execute on function public.whoami() from public, anon, authenticated;
revoke execute on function public.check_social_grants() from public, anon, authenticated;
revoke execute on function public.ss_deactivate_account() from public, anon;
revoke execute on function public.ss_request_account_deletion() from public, anon;
revoke execute on function public.ss_reactivate_account() from public, anon;
revoke execute on function public.ss_approve_application(uuid) from public, anon;
revoke execute on function public.ss_set_curator_verified(uuid, boolean) from public, anon;
revoke execute on function public.ss_reject_application(uuid) from public, anon;
revoke execute on function public.admin_traction_summary() from public, anon;
revoke execute on function public.admin_traction_daily(int) from public, anon;
revoke execute on function public.creator_analytics_totals() from public, anon;
revoke execute on function public.creator_analytics_weekly() from public, anon;
revoke execute on function public.creator_analytics_per_clip() from public, anon;
revoke execute on function public.ss_record_attestation(uuid, text, text) from public, anon;
revoke execute on function public.ss_record_curator_terms(text) from public, anon;
grant execute on function public.ss_deactivate_account() to authenticated;
grant execute on function public.ss_request_account_deletion() to authenticated;
grant execute on function public.ss_reactivate_account() to authenticated;
grant execute on function public.ss_approve_application(uuid) to authenticated;
grant execute on function public.ss_set_curator_verified(uuid, boolean) to authenticated;
grant execute on function public.ss_reject_application(uuid) to authenticated;
grant execute on function public.admin_traction_summary() to authenticated;
grant execute on function public.admin_traction_daily(int) to authenticated;
grant execute on function public.creator_analytics_totals() to authenticated;
grant execute on function public.creator_analytics_weekly() to authenticated;
grant execute on function public.creator_analytics_per_clip() to authenticated;
grant execute on function public.ss_record_attestation(uuid, text, text) to authenticated;
grant execute on function public.ss_record_curator_terms(text) to authenticated;

-- Public profile projection: expose identity/display fields only. Private
-- onboarding, lifecycle, guest, metadata, and admin columns stay on users.
create or replace view public.public_profiles as
  select id, username, name, bio, avatar_url, role, verified, genres,
         description, created_at
    from public.users
   where deleted_at is null;
grant select on public.public_profiles to anon, authenticated;

-- Handles are case-insensitive in the product. Enforce that invariant at the
-- database boundary so two racing clients cannot create lookalike identities.
do $$
declare
  v_duplicate text;
begin
  select lower(username) into v_duplicate
    from public.users
   group by lower(username) having count(*) > 1
   limit 1;
  if v_duplicate is not null then
    raise exception 'case-insensitive username collision must be resolved before 0041: %', v_duplicate;
  end if;
end;
$$;

create unique index if not exists idx_users_username_ci
  on public.users (lower(username));

-- Keep auth-profile creation aligned with the case-insensitive index and retry
-- the small race where concurrent signups derive the same base handle.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_candidate text;
  v_suffix integer := 0;
begin
  v_base := left(lower(regexp_replace(
    coalesce(
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      new.raw_user_meta_data->>'name',
      'user'
    ),
    '[^a-z0-9_]', '', 'g'
  )), 24);
  if coalesce(v_base, '') = '' then v_base := 'user'; end if;

  loop
    v_candidate := v_base || case when v_suffix = 0 then '' else v_suffix::text end;
    begin
      insert into public.users (id, username, name, avatar_url, is_guest)
      values (
        new.id,
        v_candidate,
        coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
        new.raw_user_meta_data->>'avatar_url',
        false
      )
      on conflict (id) do nothing;
      return new;
    exception when unique_violation then
      if exists (select 1 from public.users where id = new.id) then return new; end if;
      v_suffix := v_suffix + 1;
      if v_suffix > 99999 then
        raise exception 'unable to allocate a unique username';
      end if;
    end;
  end loop;
end;
$$;

-- Own-profile read returns a stable allowlisted JSON shape, independent of the
-- underlying users table. It is intentionally not public-profile data.
create or replace function public.ss_get_my_profile()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select case when u.id is null then null else jsonb_build_object(
    'id', u.id, 'username', u.username, 'name', u.name, 'bio', u.bio,
    'avatar_url', u.avatar_url, 'role', u.role, 'verified', u.verified,
    'region', u.region, 'genres', coalesce(u.genres, '{}'::text[]),
    'gender', u.gender, 'age', u.age, 'description', u.description,
    'is_guest', u.is_guest, 'meta', coalesce(u.meta, '{}'::jsonb)
  ) end
    from public.users u where u.id = auth.uid();
$$;
revoke all on function public.ss_get_my_profile() from public, anon;
grant execute on function public.ss_get_my_profile() to authenticated;

-- Own-profile writes accept only documented profile/onboarding fields. Server
-- privilege columns cannot enter through payload, even if a caller forges them.
create or replace function public.ss_update_my_profile(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_key text;
  v_meta jsonb;
  v_genres text[];
  v_row jsonb;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = 'insufficient_privilege';
  end if;
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'profile payload must be an object' using errcode = 'invalid_parameter_value';
  end if;
  if octet_length(payload::text) > 32768 then
    raise exception 'profile payload is too large' using errcode = 'program_limit_exceeded';
  end if;

  for v_key in select jsonb_object_keys(payload) loop
    if v_key not in ('username','name','bio','avatar_url','genres','region','gender','age','description','meta') then
      raise exception 'profile field is not editable: %', v_key using errcode = 'insufficient_privilege';
    end if;
  end loop;

  if payload ? 'username' and (
      payload->>'username' is null
      or btrim(payload->>'username') !~ '^[A-Za-z0-9_.]{2,30}$'
    ) then
    raise exception 'username is invalid' using errcode = 'check_violation';
  end if;
  if payload ? 'name' and char_length(coalesce(payload->>'name', '')) > 100 then
    raise exception 'name is too long' using errcode = 'check_violation';
  end if;
  if payload ? 'bio' and char_length(coalesce(payload->>'bio', '')) > 500 then
    raise exception 'bio is too long' using errcode = 'check_violation';
  end if;
  if payload ? 'avatar_url' and (
      char_length(coalesce(payload->>'avatar_url', '')) > 2048
      or (coalesce(payload->>'avatar_url', '') <> '' and payload->>'avatar_url' !~ '^https://')
    ) then
    raise exception 'avatar URL is invalid' using errcode = 'check_violation';
  end if;
  if payload ? 'genres' then
    if jsonb_typeof(payload->'genres') <> 'array' or jsonb_array_length(payload->'genres') > 12 then
      raise exception 'genres must be an array of at most 12 values' using errcode = 'check_violation';
    end if;
    v_genres := array(select jsonb_array_elements_text(payload->'genres'));
    if exists (select 1 from unnest(v_genres) g where char_length(g) not between 1 and 40) then
      raise exception 'genre value is invalid' using errcode = 'check_violation';
    end if;
  end if;
  if payload ? 'region' and upper(coalesce(payload->>'region', '')) !~ '^[A-Z]{2}$' then
    raise exception 'region is invalid' using errcode = 'check_violation';
  end if;
  if payload ? 'gender' and char_length(coalesce(payload->>'gender', '')) > 32 then
    raise exception 'gender is too long' using errcode = 'check_violation';
  end if;
  if payload ? 'description' and char_length(coalesce(payload->>'description', '')) > 500 then
    raise exception 'description is too long' using errcode = 'check_violation';
  end if;
  if payload ? 'age' and (payload->>'age' is null or (payload->>'age')::int not between 0 and 130) then
    raise exception 'age is invalid' using errcode = 'check_violation';
  end if;
  if payload ? 'meta' then
    if jsonb_typeof(payload->'meta') <> 'object' then
      raise exception 'meta must be an object' using errcode = 'check_violation';
    end if;
    for v_key in select jsonb_object_keys(payload->'meta') loop
      if v_key not in ('onboarded','dob') then
        raise exception 'metadata field is not editable: %', v_key using errcode = 'insufficient_privilege';
      end if;
    end loop;
    select coalesce(meta, '{}'::jsonb) || payload->'meta' into v_meta from users where id = v_uid;
  end if;

  update users set
    username = case when payload ? 'username' then lower(btrim(payload->>'username')) else username end,
    name = case when payload ? 'name' then nullif(btrim(payload->>'name'), '') else name end,
    bio = case when payload ? 'bio' then nullif(btrim(payload->>'bio'), '') else bio end,
    avatar_url = case when payload ? 'avatar_url' then nullif(payload->>'avatar_url', '') else avatar_url end,
    genres = case when payload ? 'genres' then v_genres else genres end,
    region = case when payload ? 'region' then upper(btrim(payload->>'region')) else region end,
    gender = case when payload ? 'gender' then nullif(btrim(payload->>'gender'), '') else gender end,
    age = case when payload ? 'age' then (payload->>'age')::int else age end,
    description = case when payload ? 'description' then nullif(btrim(payload->>'description'), '') else description end,
    meta = case when payload ? 'meta' then v_meta else meta end,
    updated_at = now()
  where id = v_uid;

  select public.ss_get_my_profile() into v_row;
  return coalesce(v_row, '{}'::jsonb);
end;
$$;
revoke all on function public.ss_update_my_profile(jsonb) from public, anon;
grant execute on function public.ss_update_my_profile(jsonb) to authenticated;

-- Consent proof and its idempotency stamp are one transaction. The browser can
-- no longer forge meta.consent_ok through the profile-update allowlist.
create or replace function public.ss_record_consent(
  p_affirmative boolean,
  p_age18plus boolean,
  p_tos_version text,
  p_privacy_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'consent requires a resolved subject identity'
      using errcode = 'insufficient_privilege';
  end if;
  if p_affirmative is not true or p_age18plus is not true
     or p_tos_version is null or char_length(btrim(p_tos_version)) = 0
     or p_privacy_version is null or char_length(btrim(p_privacy_version)) = 0 then
    raise exception 'consent requires affirmative + 18+ true and non-empty tos/privacy versions'
      using errcode = 'check_violation';
  end if;

  insert into consents (subject_id, kind, accepted_at, affirmative, age18plus, tos_version, privacy_version)
  values (v_uid, 'user_consent', now(), true, true, btrim(p_tos_version), btrim(p_privacy_version))
  returning id into v_id;
  update users set meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object(
    'consent_ok', true,
    'terms_version', btrim(p_tos_version),
    'privacy_version', btrim(p_privacy_version)
  ), updated_at = now() where id = v_uid;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;
revoke all on function public.ss_record_consent(boolean, boolean, text, text) from public, anon;
grant execute on function public.ss_record_consent(boolean, boolean, text, text) to authenticated;

-- Auth creates rows through handle_new_user; all browser profile mutations now
-- enter through ss_update_my_profile, so broad table writes are no longer needed.
revoke insert, update on table public.users from authenticated;

-- Keep public profile joins working while removing private account fields from
-- direct browser reads. Own-profile RPCs above are the only browser path for
-- region, age, guest/lifecycle, and metadata.
revoke select on table public.users from public, anon, authenticated;
grant select (id, username, name, bio, avatar_url, role, verified, genres,
             description, created_at) on table public.users to anon, authenticated;

notify pgrst, 'reload schema';
