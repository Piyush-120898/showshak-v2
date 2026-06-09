-- ═══════════════════════════════════════════════════════════════
-- SHOWSHAK — CONSTRAINT AUDIT  (read-only; safe to run anytime)
-- ───────────────────────────────────────────────────────────────
-- PURPOSE: prove that every table's data-integrity rules are actually
-- enforced in the LIVE database — not just assumed. Run each query in
-- the Supabase SQL Editor and read the results. NOTHING is changed;
-- these are pure SELECTs.
--
-- WHAT "constraints" guarantee (plain language):
--   PRIMARY KEY  → every row is uniquely identifiable; no duplicates
--   FOREIGN KEY  → a reference can't point to a row that doesn't exist
--                  (e.g. a clip can't belong to a non-existent user)
--   UNIQUE       → no two rows share a value that must be unique (@handle)
--   CHECK        → a custom rule holds (e.g. you can't follow yourself)
--   NOT NULL     → required fields can never be blank
-- ═══════════════════════════════════════════════════════════════


-- ── 1. PRIMARY KEYS — one per table, the row's unique identifier ──
select
  tc.table_name,
  string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as primary_key_columns
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema   = kcu.table_schema
where tc.constraint_type = 'PRIMARY KEY'
  and tc.table_schema    = 'public'
group by tc.table_name
order by tc.table_name;


-- ── 2. FOREIGN KEYS — every cross-table reference + its delete rule ──
-- "delete_rule = CASCADE" means deleting the parent removes the children
-- (e.g. delete a user → their fires/stacks/subscriptions go too).
select
  tc.table_name                         as from_table,
  kcu.column_name                       as from_column,
  ccu.table_name                        as references_table,
  ccu.column_name                       as references_column,
  rc.delete_rule                        as on_delete
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema    = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema    = tc.table_schema
join information_schema.referential_constraints rc
  on rc.constraint_name  = tc.constraint_name
 and rc.constraint_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema    = 'public'
order by from_table, from_column;


-- ── 3. UNIQUE constraints — values that must never repeat ──
select
  tc.table_name,
  string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as unique_columns
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema    = kcu.table_schema
where tc.constraint_type = 'UNIQUE'
  and tc.table_schema    = 'public'
group by tc.table_name, tc.constraint_name
order by tc.table_name;


-- ── 4. CHECK constraints — custom business rules (e.g. no self-follow) ──
-- (Filters out the auto-generated NOT NULL checks so you see only the
--  meaningful rules.)
select
  tc.table_name,
  cc.check_clause
from information_schema.table_constraints tc
join information_schema.check_constraints cc
  on tc.constraint_name = cc.constraint_name
 and tc.constraint_schema = cc.constraint_schema
where tc.constraint_type = 'CHECK'
  and tc.table_schema    = 'public'
  and cc.check_clause not like '%IS NOT NULL%'
order by tc.table_name;


-- ── 5. INTEGRITY SPOT-CHECK — are there any ORPHANS right now? ──
-- Each should return 0. A non-zero count means a child row points to a
-- missing parent (which FKs should make impossible — this confirms it).
select 'content.creator_id -> users'        as relationship,
       count(*) as orphans
  from content c left join users u on u.id = c.creator_id
 where c.creator_id is not null and u.id is null
union all
select 'content.title_id -> titles',
       count(*)
  from content c left join titles t on t.id = c.title_id
 where c.title_id is not null and t.id is null
union all
select 'user_subscriptions.user_id -> users',
       count(*)
  from user_subscriptions s left join users u on u.id = s.user_id
 where u.id is null
union all
select 'user_subscriptions.platform_id -> platforms',
       count(*)
  from user_subscriptions s left join platforms p on p.id = s.platform_id
 where p.id is null
union all
select 'public.users.id -> auth.users (login link)',
       count(*)
  from public.users pu left join auth.users au on au.id = pu.id
 where au.id is null;

-- ═══════════════════════════════════════════════════════════════
-- HOW TO READ THE RESULTS:
--  • Query 1: every table should list a primary_key (usually "id").
--  • Query 2: confirms each FK points where it should + its delete rule.
--    Look for "public.users.id -> auth.users ... on_delete = CASCADE"
--    (the link we added in migration 0004) and the fires/stacks/subs FKs.
--  • Query 3: users.username and titles.tmdb_id should appear (unique).
--  • Query 4: should show the follows "follower_id <> creator_id" rule.
--  • Query 5: every row should read 0 orphans. If any is > 0, tell me.
-- ═══════════════════════════════════════════════════════════════
