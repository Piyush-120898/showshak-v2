-- ═══════════════════════════════════════════════════════════════
-- SHOWSHAK — SOCIAL LAYER ACCESS  (Step 4: fires / follows / saves)
-- ───────────────────────────────────────────────────────────────
-- Opens write access (with the right safety rules) for the three
-- social actions, so a logged-in user can fire clips, follow curators,
-- and save clips to stacks — and can ONLY touch their own data.
--
-- Reminder (your schema's golden rule): the *_count columns on content
-- are a CACHE. The TRUTH is the rows in content_fires. This file also
-- adds a trigger that keeps content.fires_count in sync automatically
-- whenever a fire row is added or removed — derive, then cache, done
-- correctly in the database (not trusted from the UI).
--
-- These are ADDITIVE, safe changes (grants + policies + a trigger) —
-- no existing data is touched. Run: SQL Editor → paste → Run.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. CONTENT_FIRES  — the 🔥 (a user fires a clip)
-- ───────────────────────────────────────────────────────────────
grant select, insert, delete on table content_fires to authenticated;

alter table content_fires enable row level security;

-- You can only see / create / remove YOUR OWN fires.
-- (Public fire COUNTS come from content.fires_count, never from
--  reading everyone's rows — that keeps "fires given" private.)
drop policy if exists fires_select_own on content_fires;
create policy fires_select_own on content_fires
  for select using (user_id = auth.uid());

drop policy if exists fires_insert_own on content_fires;
create policy fires_insert_own on content_fires
  for insert with check (user_id = auth.uid());

drop policy if exists fires_delete_own on content_fires;
create policy fires_delete_own on content_fires
  for delete using (user_id = auth.uid());

-- Keep content.fires_count accurate as fires are added/removed.
create or replace function public.sync_fires_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update content set fires_count = fires_count + 1 where id = new.content_id;
  elsif (tg_op = 'DELETE') then
    update content set fires_count = greatest(fires_count - 1, 0) where id = old.content_id;
  end if;
  return null;
end; $$;

drop trigger if exists trg_sync_fires_count on content_fires;
create trigger trg_sync_fires_count
  after insert or delete on content_fires
  for each row execute function public.sync_fires_count();

-- ───────────────────────────────────────────────────────────────
-- 2. FOLLOWS  — a user follows a curator
-- ───────────────────────────────────────────────────────────────
grant select, insert, delete on table follows to authenticated;

alter table follows enable row level security;

-- The follow graph is readable (needed for follower counts + a
-- profile's "following" list), but you can only create/remove your OWN
-- follows (follower_id must be you).
drop policy if exists follows_read on follows;
create policy follows_read on follows
  for select using (deleted_at is null);

drop policy if exists follows_insert_own on follows;
create policy follows_insert_own on follows
  for insert with check (follower_id = auth.uid());

drop policy if exists follows_delete_own on follows;
create policy follows_delete_own on follows
  for delete using (follower_id = auth.uid());

-- ───────────────────────────────────────────────────────────────
-- 3. STACKS + STACK_ITEMS  — saving clips into collections
-- ───────────────────────────────────────────────────────────────
-- stacks already had a SELECT policy (public or own) from 0001.
grant select, insert, update, delete on table stacks      to authenticated;
grant select, insert, update, delete on table stack_items to authenticated;

-- You can create / edit / delete only your OWN stacks.
drop policy if exists stacks_insert_own on stacks;
create policy stacks_insert_own on stacks
  for insert with check (user_id = auth.uid());

drop policy if exists stacks_update_own on stacks;
create policy stacks_update_own on stacks
  for update using (user_id = auth.uid());

drop policy if exists stacks_delete_own on stacks;
create policy stacks_delete_own on stacks
  for delete using (user_id = auth.uid());

alter table stack_items enable row level security;

-- Read items if the stack is public OR yours.
drop policy if exists stack_items_read on stack_items;
create policy stack_items_read on stack_items
  for select using (
    exists (select 1 from stacks s
            where s.id = stack_id
              and (s.visibility = 'public' or s.user_id = auth.uid()))
  );

-- Add / remove items only in stacks you own.
drop policy if exists stack_items_write on stack_items;
create policy stack_items_write on stack_items
  for all
  using      (exists (select 1 from stacks s where s.id = stack_id and s.user_id = auth.uid()))
  with check (exists (select 1 from stacks s where s.id = stack_id and s.user_id = auth.uid()));

-- ═══════════════════════════════════════════════════════════════
-- DONE. The social layer is now writable (safely) once content +
-- curators are real rows in the DB. Next: make the feed's clips real
-- (DB-backed) so fires/saves/follows have real IDs to link to.
-- ═══════════════════════════════════════════════════════════════
