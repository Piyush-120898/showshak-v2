-- ═══════════════════════════════════════════════════════════════
--  0033 — FEEDBACK  (Settings › Support: "Send feedback" + "Report a problem")
--  ─────────────────────────────────────────────────────────────
--  One table for both kinds of inbound support message. Anyone — signed-in or
--  guest (anon) — may INSERT; NOBODY may read via the API. Only the operator
--  reads them (service_role bypasses RLS → Supabase Table Editor / SQL). This
--  keeps submissions private, consistent with the "hide the scoreboard" posture.
--
--  ADDITIVE + NON-REGRESSIVE: brand-new table; touches nothing else.
--  Apply in the Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════

create table if not exists feedback (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('feedback','problem')),
  message     text not null check (char_length(message) between 1 and 4000),
  email       text,                                  -- optional reply address (may be null)
  subject_id  uuid default auth.uid(),               -- who sent it (anon or permanent); server-set
  meta        jsonb default '{}',                    -- page / app version / user-agent / viewport (problem reports)
  status      text not null default 'new'
              check (status in ('new','seen','resolved')),
  created_at  timestamptz default now(),
  updated_at  timestamptz,
  deleted_at  timestamptz
);

create index if not exists feedback_created_idx on feedback (created_at desc);
create index if not exists feedback_kind_status_idx on feedback (kind, status);

-- Row-Level Security: insert-only for the public roles; reads are operator-only.
alter table feedback enable row level security;

drop policy if exists feedback_insert on feedback;
create policy feedback_insert on feedback
  for insert to anon, authenticated
  with check (true);

-- Grant INSERT only. No select/update/delete grant → PostgREST refuses reads for
-- anon/authenticated; service_role (dashboard) bypasses RLS and can read/manage.
grant insert on feedback to anon, authenticated;

-- ── Operator read (run in the SQL editor whenever you want to see submissions):
--   select created_at, kind, message, email, meta
--   from feedback
--   where deleted_at is null
--   order by created_at desc;
