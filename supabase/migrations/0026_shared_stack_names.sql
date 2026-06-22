-- ═══════════════════════════════════════════════════════════════
-- 0026 — Shared-stack attribution: real NAMES (not just @handles)
-- ───────────────────────────────────────────────────────────────
-- WHY: the stack folder header showed "@handle" and, for a normal user's
-- view-mode stack, fell back to a literal "@curator" because the OWNER is not
-- in stack_members (members are only populated for collaborative joins). This
-- REPLACES get_shared_stack so it ALWAYS returns the owner's real identity and
-- a display name for every contributor:
--   • stack.owner  = { user_id, username, name, is_curator }   (always present)
--   • members[]    now also carry  name  +  is_curator
--   • clips[].creator already carried name (unchanged)
-- Additive only — every existing field is preserved, so older callers keep
-- working. SECURITY DEFINER + the same shareable/owner gate as 0022/0023 (no
-- leak: still returns null for a private stack the caller doesn't own).
--
-- FOUNDER-RUN: apply in the Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════

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
  ownerobj jsonb;
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

  -- Members now carry a display NAME + an is_curator flag (role = 'curator').
  select jsonb_agg(jsonb_build_object(
             'user_id',    m.user_id,
             'role',       m.role,
             'username',   (select u.username from users u where u.id = m.user_id),
             'name',       (select u.name     from users u where u.id = m.user_id),
             'is_curator', (select (u.role = 'curator') from users u where u.id = m.user_id)
           ) order by m.joined_at),
         count(*)
    into members, mcount
    from stack_members m
   where m.stack_id = p_stack_id;

  -- Authoritative OWNER identity — always present, even when the owner has no
  -- stack_members row (the normal-user view-stack case that showed "@curator").
  select jsonb_build_object(
           'user_id',    ou.id,
           'username',   ou.username,
           'name',       ou.name,
           'is_curator', (ou.role = 'curator')
         )
    into ownerobj
    from users ou
   where ou.id = s.user_id;

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
      'mode',        s.mode,
      'owner',       ownerobj
    ),
    'clips',           coalesce(items, '[]'::jsonb),
    'members',         coalesce(members, '[]'::jsonb),
    'member_count',    coalesce(mcount, 0),
    'viewer_is_member', coalesce(is_mem, false)
  );
end;
$$;
grant execute on function public.get_shared_stack(uuid) to anon, authenticated;

-- Reload PostgREST so the change is live immediately.
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- VERIFY (manual):
--   • rpc('get_shared_stack', { p_stack_id }) → stack.owner = {user_id,
--     username, name, is_curator}; members[] each have name + is_curator.
--   • A normal user's shared (unlisted/public) view-stack now returns the
--     owner's real name instead of the "@curator" fallback.
-- ═══════════════════════════════════════════════════════════════
