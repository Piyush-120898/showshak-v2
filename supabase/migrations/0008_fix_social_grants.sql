-- ═══════════════════════════════════════════════════════════════
-- SHOWSHAK — FIX SOCIAL GRANTS  (resolves "permission denied 42501")
-- ───────────────────────────────────────────────────────────────
-- The diagnostic showed: FIRE/FOLLOW fail with
--   "permission denied for table content_fires / follows" (code 42501)
-- = the table-level GRANT for the `authenticated` role is missing.
-- (Migration 0006 likely errored on a later line and the whole script
--  rolled back as one transaction, so its grants never applied.)
--
-- This file re-applies ONLY the grants + RLS policies for the social
-- tables. Every statement is idempotent and has no risky dependency,
-- so it cannot roll back. Run: SQL Editor → paste → Run.
-- ═══════════════════════════════════════════════════════════════

-- Make sure the API roles can use the schema at all.
grant usage on schema public to anon, authenticated;

-- ── content_fires (the fire reaction) ──
grant select, insert, delete on table content_fires to authenticated;
alter table content_fires enable row level security;
drop policy if exists fires_select_own on content_fires;
create policy fires_select_own on content_fires for select using (user_id = auth.uid());
drop policy if exists fires_insert_own on content_fires;
create policy fires_insert_own on content_fires for insert with check (user_id = auth.uid());
drop policy if exists fires_delete_own on content_fires;
create policy fires_delete_own on content_fires for delete using (user_id = auth.uid());

-- ── follows ──
grant select, insert, delete on table follows to authenticated;
alter table follows enable row level security;
drop policy if exists follows_read on follows;
create policy follows_read on follows for select using (deleted_at is null);
drop policy if exists follows_insert_own on follows;
create policy follows_insert_own on follows for insert with check (follower_id = auth.uid());
drop policy if exists follows_delete_own on follows;
create policy follows_delete_own on follows for delete using (follower_id = auth.uid());

-- ── stacks + stack_items (saves) ──
grant select, insert, update, delete on table stacks      to authenticated;
grant select, insert, update, delete on table stack_items to authenticated;

alter table stacks enable row level security;
drop policy if exists read_stacks on stacks;
create policy read_stacks on stacks for select using (visibility = 'public' or user_id = auth.uid());
drop policy if exists stacks_insert_own on stacks;
create policy stacks_insert_own on stacks for insert with check (user_id = auth.uid());
drop policy if exists stacks_update_own on stacks;
create policy stacks_update_own on stacks for update using (user_id = auth.uid());
drop policy if exists stacks_delete_own on stacks;
create policy stacks_delete_own on stacks for delete using (user_id = auth.uid());

alter table stack_items enable row level security;
drop policy if exists stack_items_read on stack_items;
create policy stack_items_read on stack_items for select using (
  exists (select 1 from stacks s where s.id = stack_id and (s.visibility = 'public' or s.user_id = auth.uid()))
);
drop policy if exists stack_items_write on stack_items;
create policy stack_items_write on stack_items for all
  using      (exists (select 1 from stacks s where s.id = stack_id and s.user_id = auth.uid()))
  with check (exists (select 1 from stacks s where s.id = stack_id and s.user_id = auth.uid()));

-- ── fires_count keeper (so the cached count stays accurate) ──
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

-- ═══════════════════════════════════════════════════════════════
-- DONE. Re-open showshak-db-test.html (signed in) and tap the test
-- buttons — FIRE and FOLLOW should now succeed.
-- ═══════════════════════════════════════════════════════════════
