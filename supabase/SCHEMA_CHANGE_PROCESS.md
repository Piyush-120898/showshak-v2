# ShowShak — Schema Change & Safety Process

> Captures the team rule (raised by the backend lead) so **the live
> site never crashes because of backend/schema work**. We get that
> safety through **environments + reviewed migrations**, not a second
> repository (our backend is managed Supabase + SQL migrations, not a
> separate server program — one repo is correct for a team this size).

## The golden rule
**Never run an unreviewed, untested schema change against the
production database.** Production is the Supabase project real users
hit.

## Two kinds of change

**SAFE / additive (low risk)** — run on production after review:
- Adding a new table
- Adding a *nullable* column
- Adding an index
- Adding a GRANT / RLS policy

**RISKY / destructive (must be staged first)** — see process below:
- Dropping or renaming a table or column
- Changing a column type
- Adding a `NOT NULL` to an existing column
- Adding/altering a constraint on a table that already has data
- Anything with `delete from`, `drop`, `alter ... type`, backfills

## Process for RISKY changes
1. **Write it as a numbered migration** in `supabase/migrations/`
   (we already do this — 0001…0005).
2. **Test on a staging Supabase project first** (a free second project
   that mirrors production). Run the migration there, click through the
   app pointed at staging, confirm nothing breaks.
3. **Back up / know the rollback** — note how to undo it before running.
4. **Run on production** only after staging passes.
5. **Re-run the constraint audit** (`supabase/audit_constraints.sql`)
   to confirm integrity still holds.

## When we'll set up the staging project
Right before the first risky change (e.g. when we start altering tables
that already hold real user rows). Until then, our changes have been
additive (new tables, grants, policies), which are safe to apply
directly after review.

## Why not a separate backend repo?
A separate repo helps when frontend and backend are two different
programs. Ours aren't: the "backend" is Supabase (managed) + the SQL
files in this repo. Splitting them would create two repos to keep in
sync for no safety gain. **Environments** (staging vs production) give
the real protection the team wants, with one source of truth.
