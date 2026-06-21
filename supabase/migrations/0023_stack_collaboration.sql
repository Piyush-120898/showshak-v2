-- ═══════════════════════════════════════════════════════════════
-- 0023_stack_collaboration.sql
-- SHOWSHAK — STACK SHARING, PHASE 2: collaborative stacks
-- (.kiro/specs/stack-sharing — Requirements 6, 7, 8; Task 8)
-- ───────────────────────────────────────────────────────────────
-- Adds multi-contributor ("collaborative") stacks on top of Phase 1's
-- visibility model. Privacy + authority stay enforced in the DB (RLS + a
-- cap-gated SECURITY DEFINER join RPC), never the UI.
--
-- WHAT THIS ADDS
--   • stack_members            — who may co-add to a collaborative stack
--                                (the owner is always a member; cap incl. owner).
--   • stack_items.added_by     — per-clip attribution.
--   • collaborative RLS         — INSERT: owner OR member of a collaborative stack;
--                                DELETE: owner OR the contributor who added it.
--   • member-cap trigger        — hard ceiling of 6 members (incl. owner),
--                                mirroring SS_STACK_MEMBER_CAP in showshak-shared.js.
--   • join_stack(id) RPC        — idempotent, cap-gated join (the only join path);
--                                ensures the owner is counted as a member.
--   • get_shared_stack(id)      — REPLACED to also return mode, per-clip added_by
--                                (+ contributor username), the member list,
--                                member_count and viewer_is_member. Additive:
--                                Phase-1 callers ignore the extra fields.
--
-- RECONCILED WITH THE LIVE SCHEMA
--   • 0008 created a single `stack_items_write` (FOR ALL, owner-only) policy.
--     That blocks collaborators from inserting, so we DROP it and add granular
--     INSERT/DELETE policies. (stack_items is never UPDATEd, so dropping FOR ALL
--     loses nothing.)
--   • The 0008 `stack_items_read` (public-or-owner) is widened so a member can
--     read items of a collaborative stack that is merely unlisted. The policy
--     references `stacks` + `stack_members` only (never `stack_items` itself), so
--     there is no recursive-RLS hazard.
--
-- SAFE / ADDITIVE + IDEMPOTENT. Run: Supabase SQL Editor → paste → Run.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Membership table ──────────────────────────────────────────
create table if not exists stack_members (
  stack_id  uuid not null references stacks(id) on delete cascade,
  user_id   uuid not null references users(id),
  role      text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (stack_id, user_id)
);
create index if not exists idx_stack_members_user on stack_members (user_id);

grant select, delete on table stack_members to authenticated;
-- (INSERTs go through join_stack(), a SECURITY DEFINER RPC, so we do NOT grant
--  a broad INSERT — every join is funneled through the cap-gated path.)

alter table stack_members enable row level security;

-- READ: you can see your own membership rows; the stack owner can see all member
-- rows for their stack. (The full member LIST for non-owner members is returned
-- by get_shared_stack(), which is SECURITY DEFINER — so no self-referential
-- policy on stack_members is needed, avoiding RLS recursion.)
drop policy if exists stack_members_read on stack_members;
create policy stack_members_read on stack_members for select using (
  user_id = auth.uid()
  or exists (select 1 from stacks s where s.id = stack_id and s.user_id = auth.uid())
);

-- DELETE: a member may leave (delete their OWN non-owner row); the owner may
-- remove any non-owner member. The owner row (role='owner') is never deletable
-- → the owner is always a member (Req 6.6).
drop policy if exists stack_members_delete on stack_members;
create policy stack_members_delete on stack_members for delete using (
  role <> 'owner'
  and (
    user_id = auth.uid()
    or exists (select 1 from stacks s where s.id = stack_id and s.user_id = auth.uid())
  )
);

-- ── 2. Per-clip attribution ──────────────────────────────────────
alter table stack_items add column if not exists added_by uuid references users(id);

-- ── 3. Collaborative item write policies (replace the owner-only FOR ALL) ──
drop policy if exists stack_items_write on stack_items;

-- INSERT: the stack owner, OR a member of a COLLABORATIVE stack (Req 7.1).
drop policy if exists stack_items_insert on stack_items;
create policy stack_items_insert on stack_items for insert with check (
  exists (select 1 from stacks s where s.id = stack_id and s.user_id = auth.uid())
  or exists (
    select 1 from stacks s
    join stack_members m on m.stack_id = s.id
    where s.id = stack_id and s.mode = 'collaborative' and m.user_id = auth.uid()
  )
);

-- DELETE: the stack owner (any item) OR the contributor who added it (Req 8.1, 8.2).
drop policy if exists stack_items_delete on stack_items;
create policy stack_items_delete on stack_items for delete using (
  exists (select 1 from stacks s where s.id = stack_id and s.user_id = auth.uid())
  or added_by = auth.uid()
);

-- READ: public/owner (as before) OR a member of the stack (so members can read
-- the items of an UNLISTED collaborative stack directly, not only via the RPC).
drop policy if exists stack_items_read on stack_items;
create policy stack_items_read on stack_items for select using (
  exists (select 1 from stacks s where s.id = stack_id and (s.visibility = 'public' or s.user_id = auth.uid()))
  or exists (select 1 from stack_members m where m.stack_id = stack_items.stack_id and m.user_id = auth.uid())
);

-- ── 4. Member-cap trigger (hard ceiling = SS_STACK_MEMBER_CAP = 6, incl. owner) ──
create or replace function public.enforce_stack_member_cap()
returns trigger language plpgsql as $$
declare cnt int;
begin
  select count(*) into cnt from stack_members where stack_id = new.stack_id;
  if cnt >= 6 then   -- SS_STACK_MEMBER_CAP (keep in sync with showshak-shared.js)
    raise exception 'stack member cap reached' using errcode = 'check_violation';
  end if;
  return new;
end; $$;
drop trigger if exists trg_stack_member_cap on stack_members;
create trigger trg_stack_member_cap before insert on stack_members
  for each row execute function public.enforce_stack_member_cap();

-- ── 5. join_stack(id): the only join path (idempotent, cap-gated) ─
create or replace function public.join_stack(p_stack_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s        stacks;
  me       uuid := auth.uid();
  cnt      int;
  already  boolean;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'reason', 'signin');
  end if;

  select * into s from stacks where id = p_stack_id and deleted_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'notfound');
  end if;
  if s.mode <> 'collaborative' then
    return jsonb_build_object('ok', false, 'reason', 'notcollab');
  end if;

  -- Ensure the owner is counted as a member (idempotent). This is the only place
  -- the owner row is created, so the cap always includes the owner (Req 6.3, 6.6).
  insert into stack_members (stack_id, user_id, role)
    values (p_stack_id, s.user_id, 'owner')
    on conflict (stack_id, user_id) do nothing;

  select exists (
    select 1 from stack_members where stack_id = p_stack_id and user_id = me
  ) into already;
  if already then
    return jsonb_build_object('ok', true, 'joined', false, 'already', true);
  end if;

  select count(*) into cnt from stack_members where stack_id = p_stack_id;
  if cnt >= 6 then   -- cap reached (Req 6.4)
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;

  insert into stack_members (stack_id, user_id, role) values (p_stack_id, me, 'member');
  return jsonb_build_object('ok', true, 'joined', true);
end;
$$;
grant execute on function public.join_stack(uuid) to authenticated;

-- ── 6. get_shared_stack(id): enriched with collaboration data (REPLACES 0022) ──
-- Still returns null for a missing / private-not-owned stack (no leak). Now also
-- returns: stack.mode; per-clip added_by + added_by_username (attribution);
-- members[] (id, username, role); member_count; viewer_is_member. All additive —
-- Phase 1 callers simply ignore the extra fields.
create or replace function public.get_shared_stack(p_stack_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s        stacks;
  items    jsonb;
  members  jsonb;
  mcount   int;
  is_mem   boolean;
begin
  select * into s from stacks where id = p_stack_id and deleted_at is null;
  if not found then
    return null;
  end if;
  if s.visibility = 'private' and s.user_id is distinct from auth.uid() then
    return null;
  end if;

  select jsonb_agg(
           jsonb_build_object(
             'id',              c.id,
             'description',     c.description,
             'fires_count',     c.fires_count,
             'views_count',     c.views_count,
             'meta',            c.meta,
             'status',          c.status,
             'mux_playback_id', c.mux_playback_id,
             'url',             c.url,
             'thumbnail_url',   c.thumbnail_url,
             'duration_sec',    c.duration_sec,
             'added_by',        si.added_by,
             'added_by_username', (select u2.username from users u2 where u2.id = si.added_by),
             'creator', (
               select jsonb_build_object('username', u.username, 'name', u.name, 'avatar_url', u.avatar_url)
               from users u where u.id = c.creator_id
             ),
             'title', (
               select jsonb_build_object('name', t.name, 'year', t.year, 'synopsis', t.synopsis,
                                         'providers', t.providers, 'cached_at', t.cached_at)
               from titles t where t.id = c.title_id
             ),
             'platform', (
               select jsonb_build_object('id', p.id, 'name', p.name, 'color', p.color, 'abbr', p.abbr)
               from platforms p where p.id = c.platform_id
             )
           )
           order by si.added_at
         )
    into items
    from stack_items si
    join content c on c.id = si.content_id
   where si.stack_id = p_stack_id
     and c.status = 'live'
     and c.deleted_at is null;

  select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'role', m.role,
                                      'username', (select u.username from users u where u.id = m.user_id))
                   order by m.joined_at),
         count(*)
    into members, mcount
    from stack_members m
   where m.stack_id = p_stack_id;

  select exists (
    select 1 from stack_members m where m.stack_id = p_stack_id and m.user_id = auth.uid()
  ) into is_mem;

  return jsonb_build_object(
    'stack', jsonb_build_object(
      'id',          s.id,
      'name',        s.name,
      'user_id',     s.user_id,
      'visibility',  s.visibility,
      'highlighted', s.is_highlight,
      'mode',        s.mode
    ),
    'clips',           coalesce(items, '[]'::jsonb),
    'members',         coalesce(members, '[]'::jsonb),
    'member_count',    coalesce(mcount, 0),
    'viewer_is_member', coalesce(is_mem, false)
  );
end;
$$;
grant execute on function public.get_shared_stack(uuid) to anon, authenticated;

-- Reload PostgREST so the new table + RPCs are live immediately.
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- DONE (Phase 2 schema). After this runs:
--   • rpc('join_stack', { p_stack_id }) adds the caller to a collaborative stack
--     (idempotent; owner auto-counted; 'full' at 6; 'signin'/'notcollab'/'notfound').
--   • Members of a collaborative stack can INSERT items (added_by) and DELETE
--     their OWN items; the owner can delete ANY item and remove any member.
--   • get_shared_stack() now carries mode, attribution, member list/count, and
--     viewer_is_member for the collaboration UI.
-- ═══════════════════════════════════════════════════════════════
