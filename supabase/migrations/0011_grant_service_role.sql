-- ═══════════════════════════════════════════════════════════════
-- 0011_grant_service_role.sql
-- ───────────────────────────────────────────────────────────────
-- Restore the STANDARD Supabase access for the `service_role`.
--
-- WHY: ShowShak's DB was set up to "lock every table by default"
-- (no auto-exposure of new tables). That posture also withheld
-- privileges from `service_role`, so the local TMDB ingest script
-- (data/ingest-tmdb.js), which authenticates AS service_role, got
-- "permission denied for table platforms / titles".
--
-- `service_role` is the trusted, server-side-only admin role (it is
-- NEVER shipped to the browser — the app uses the anon key). Granting
-- it full DML on the public schema is the Supabase default posture and
-- is a SAFE / ADDITIVE change (see supabase/SCHEMA_CHANGE_PROCESS.md).
--
-- Idempotent: safe to run more than once.
-- ═══════════════════════════════════════════════════════════════

grant usage on schema public to service_role;

grant select, insert, update, delete, references, trigger
  on all tables in schema public to service_role;

grant usage, select on all sequences in schema public to service_role;

-- Make future tables/sequences accessible to service_role too, so we
-- don't have to re-grant every time a new table is added.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;

-- Tell PostgREST to reload so the new grants take effect immediately.
notify pgrst, 'reload schema';
