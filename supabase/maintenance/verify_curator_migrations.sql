-- ═══════════════════════════════════════════════════════════════
-- verify_curator_migrations.sql  (READ-ONLY — safe to run any time)
-- Confirms migrations 0034 / 0035 / 0036 fully applied. Nothing is
-- written. ONE query so the Supabase SQL editor shows ALL rows at once
-- (the editor only displays the LAST statement's grid — so we UNION).
-- EVERY row's `ok` should be TRUE. Any FALSE → tell the agent which one.
-- ═══════════════════════════════════════════════════════════════

with checks(ord, item, ok) as (

  -- ── 0034 ──────────────────────────────────────────────────────
  select 1, 'users.is_admin column',
    exists (select 1 from information_schema.columns
            where table_schema='public' and table_name='users' and column_name='is_admin')

  union all select 2, 'curator_application table',
    exists (select 1 from information_schema.tables
            where table_schema='public' and table_name='curator_application')

  union all select 3, 'curator_application has all 9 columns',
    (select count(*) from information_schema.columns
      where table_schema='public' and table_name='curator_application'
        and column_name in ('id','applicant_id','status','applicant_info','curator_info',
                            'genres','social_link','reference_clip_path','terms_version')) = 9

  union all select 4, 'all 5 RPC/functions exist',
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public'
        and p.proname in ('ss_is_admin','ss_submit_curator_application',
                          'ss_approve_application','ss_reject_application','ss_set_curator_verified')) = 5

  union all select 5, 'ss_is_admin reads is_admin flag',
    coalesce((select pg_get_functiondef(p.oid) ilike '%is_admin%'
              from pg_proc p join pg_namespace n on n.oid=p.pronamespace
              where n.nspname='public' and p.proname='ss_is_admin' limit 1), false)

  union all select 6, 'policy curapp_read_own',
    exists (select 1 from pg_policies where schemaname='public'
            and tablename='curator_application' and policyname='curapp_read_own')

  union all select 7, 'policy curapp_admin_read',
    exists (select 1 from pg_policies where schemaname='public'
            and tablename='curator_application' and policyname='curapp_admin_read')

  -- ── 0035 ──────────────────────────────────────────────────────
  union all select 8, 'curator_application_log table',
    exists (select 1 from information_schema.tables
            where table_schema='public' and table_name='curator_application_log')

  union all select 9, 'log append-only triggers (2)',
    (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid
      where c.relname='curator_application_log'
        and t.tgname in ('trg_curlog_no_update','trg_curlog_no_delete')) = 2

  union all select 10, 'policy curlog_admin_read',
    exists (select 1 from pg_policies where schemaname='public'
            and tablename='curator_application_log' and policyname='curlog_admin_read')

  -- ── 0034 Storage (the bits most likely to miss on a choked run) ──
  union all select 11, 'review-clips bucket exists & PRIVATE',
    exists (select 1 from storage.buckets where id='review-clips' and public = false)

  union all select 12, 'storage policy reviewclip_owner_insert',
    exists (select 1 from pg_policies where schemaname='storage'
            and tablename='objects' and policyname='reviewclip_owner_insert')

  union all select 13, 'storage policy reviewclip_admin_read',
    exists (select 1 from pg_policies where schemaname='storage'
            and tablename='objects' and policyname='reviewclip_admin_read')

  -- ── 0036 ──────────────────────────────────────────────────────
  union all select 14, 'content_insert_own requires curator role',
    coalesce((select pg_get_expr(pol.polwithcheck, pol.polrelid) ilike '%role%curator%'
              from pg_policy pol join pg_class c on c.oid=pol.polrelid
              where c.relname='content' and pol.polname='content_insert_own' limit 1), false)

  union all select 15, 'on_content_promote_curator trigger removed',
    not exists (select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
                where c.relname='content' and t.tgname='on_content_promote_curator')
)
select ord, item, ok from checks order by ord;

-- After this returns all-true, confirm YOUR admin bootstrap separately
-- (replace the handle):
--   select username, is_admin from public.users where username = '<your-handle>';
