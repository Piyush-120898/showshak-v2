-- ═══════════════════════════════════════════════════════════════
-- 0022_stack_sharing_visibility.sql
-- SHOWSHAK — STACK SHARING, PHASE 1: visibility + shared-read RPC
-- (.kiro/specs/stack-sharing — Requirements 1, 2, 4; Tasks 2.1–2.4)
-- ───────────────────────────────────────────────────────────────
-- Turns Stacks into a sharable surface with the private/unlisted/public
-- model, WITHOUT letting unlisted stacks be enumerated. Privacy is enforced
-- here in the DB (RLS + a SECURITY DEFINER read RPC), never in the UI.
--
-- ── RECONCILED WITH THE LIVE SCHEMA (not the design draft) ──
-- The design doc was written against an idealized schema. The real `stacks`
-- table (migration 0001) already differs, so this migration adapts:
--
--   1. `visibility` ALREADY EXISTS (0001: text default 'private', commented
--      'public'|'friends'|'private', NO check constraint). So we do NOT add the
--      column — we (a) migrate any legacy 'friends' rows to 'unlisted' (friends-
--      share == link-share == unlisted, the exact semantic), then (b) add a
--      CHECK for ('private','unlisted','public'). A raw CHECK add would FAIL if
--      'friends' rows existed, hence the normalize-first step.
--
--   2. `is_highlight` ALREADY EXISTS (0001: boolean default false, "public
--      profile shelf"). The design called this `highlighted`. We REUSE
--      `is_highlight` rather than adding a second, drifting column. The JS layer
--      maps is_highlight -> stack.highlighted (Task 3/6).
--
--   3. The SELECT policy ALREADY EXISTS and is already correct: `read_stacks`
--      (0008) = `visibility='public' OR user_id=auth.uid()`. That is exactly the
--      non-enumeration guarantee (unlisted is NOT 'public', so it is never
--      directly SELECTable). We recreate it idempotently to be explicit.
--
--   4. The shared-read RPC orders items by `stack_items.added_at` — the real
--      column (the design said `created_at`, which does not exist on stack_items
--      and would throw on every shared-stack open).
--
-- Only `mode` is a genuinely new column (Phase-2 collaboration; added now,
-- additive, so the data model is complete up front). All existing private
-- stacks keep behaving identically (Requirement 9).
--
-- SAFE / ADDITIVE + IDEMPOTENT. Run: Supabase SQL Editor → paste → Run.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Normalize legacy visibility values, then constrain ────────
-- Map the old 'friends' value to 'unlisted' (same meaning: anyone with the
-- link). Also defensively coerce any NULL/unknown to 'private' (never leak).
update stacks set visibility = 'unlisted' where visibility = 'friends';
update stacks set visibility = 'private'
  where visibility is null or visibility not in ('private','unlisted','public');

alter table stacks alter column visibility set default 'private';
alter table stacks alter column visibility set not null;

alter table stacks drop constraint if exists stacks_visibility_check;
alter table stacks add constraint stacks_visibility_check
  check (visibility in ('private','unlisted','public'));

-- ── 2. New `mode` column (Phase 2 collaboration; additive now) ───
alter table stacks add column if not exists mode text not null default 'view';
alter table stacks drop constraint if exists stacks_mode_check;
alter table stacks add constraint stacks_mode_check
  check (mode in ('view','collaborative'));

-- `is_highlight` already exists (0001) — ensure the default is explicit.
alter table stacks alter column is_highlight set default false;

-- ── 3. Read policy: owner OR public only (no unlisted enumeration) ──
-- Recreated idempotently. Unlisted stacks are reachable ONLY via the RPC below.
alter table stacks enable row level security;
drop policy if exists read_stacks on stacks;
create policy read_stacks on stacks for select
  using (visibility = 'public' or user_id = auth.uid());

-- Owner UPDATE policy (covers the new visibility/mode/is_highlight columns).
drop policy if exists stacks_update_own on stacks;
create policy stacks_update_own on stacks for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── 4. get_shared_stack(id): the ONLY read path for unlisted ─────
-- SECURITY DEFINER so it can read past the table policy, but returns rows ONLY
-- when the stack is shareable (unlisted/public) OR owned by the caller. Returns
-- null for a missing/soft-deleted/private-not-owned stack (→ "unavailable" in
-- the UI; no clips, no leak — Req 4.2). Clips are projected into the SAME nested
-- shape PostgREST emits for the feed query (creator/title/platform embeds), so
-- the existing ssMapContentRowsToClips + ssClipsForFeed map them with zero
-- special-casing. Only LIVE, non-deleted clips are returned, ordered by added_at.
create or replace function public.get_shared_stack(p_stack_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s     stacks;
  items jsonb;
begin
  select * into s from stacks where id = p_stack_id and deleted_at is null;
  if not found then
    return null;
  end if;

  -- Private stacks are visible only to their owner.
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

  return jsonb_build_object(
    'stack', jsonb_build_object(
      'id',          s.id,
      'name',        s.name,
      'user_id',     s.user_id,
      'visibility',  s.visibility,
      'highlighted', s.is_highlight,   -- mapped to the JS `highlighted` field
      'mode',        s.mode
    ),
    'clips', coalesce(items, '[]'::jsonb)
  );
end;
$$;

-- Guests can open shared links too (read path is anon-allowed); contributing
-- (Phase 2) requires auth. Grant execute to both roles.
grant execute on function public.get_shared_stack(uuid) to anon, authenticated;

-- Reload PostgREST so the RPC + column changes are live immediately.
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- DONE (Phase 1 schema). After this runs:
--   • stacks.visibility is constrained to private|unlisted|public (legacy
--     'friends' → 'unlisted'); stacks.mode (view|collaborative) exists.
--   • Direct `select * from stacks` as anon returns ONLY public rows
--     (unlisted is non-enumerable — verify this manually).
--   • rpc('get_shared_stack', { p_stack_id }) returns {stack, clips[]} for an
--     unlisted/public/owned stack, else null — the only read path for unlisted.
-- Next (code): Task 3 — ssLoadSharedStackById / ssStackShareUrl /
--   ssSetStackVisibility in showshak-shared.js (written to fail soft until this
--   migration is applied).
-- ═══════════════════════════════════════════════════════════════
