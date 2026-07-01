-- ═══════════════════════════════════════════════════════════════
-- 0036_curator_publish_gate.sql
-- SHOWSHAK — CURATOR APPLICATION & APPROVAL, PHASE 3: the RLS publish gate
--            + retiring the 0020 auto-promote-on-post trigger
-- (.kiro/specs/curator-application-approval — Task 12.1;
--  Requirements 17, 18, 19)
-- ───────────────────────────────────────────────────────────────
-- Closes the loop opened in Phases 1-2: now that curator status is granted
-- ONLY by an admin approving an application (0035), publishing must be gated to
-- approved curators too — otherwise a client that skips the UI could still
-- insert a clip. Two changes, both at the database (the security boundary):
--
--   1. REDEFINE the 0012 `content_insert_own` INSERT policy so a `content` row
--      may be created ONLY when the author is BOTH themselves (creator_id =
--      auth.uid(), the 0012 invariant) AND an approved curator
--      (users.role = 'curator'). The role check runs in RLS, so it holds for
--      ANY direct data-API insert, not just the UI (Req 18.1/18.2/18.3).
--
--   2. DROP the 0020 `on_content_promote_curator` trigger so publishing no
--      longer self-promotes the author to curator (Req 18.4). Posting can no
--      longer be a back-door to curator status.
--
-- ── GRANDFATHERING (Req 17 — needs NO data migration) ──
-- An account already `role='curator'` when this ships satisfies the new
-- WITH CHECK unchanged and keeps publishing, with no curator_application row —
-- the default treatment IS grandfathering. A `User_Role` account (incl. one
-- with a pending or rejected application) fails the WITH CHECK → its insert is
-- rejected under RLS (Req 18.2/18.4).
--
-- ── ADDITIVE + IDEMPOTENT (per the phased-migration rule) ──
-- Dropping/recreating a POLICY and dropping a TRIGGER are permitted (the rule
-- forbids dropping tables/columns, not policies/triggers/functions). Re-running
-- yields identical definitions. No table/column is dropped, renamed, or retyped.
--
-- Run: Supabase → SQL Editor → paste → Run.  (Apply AFTER 0034 + 0035.)
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. PUBLISH GATE  — only an approved curator may insert a clip (Req 18)
-- ───────────────────────────────────────────────────────────────
-- Redefine the 0012 insert policy. RLS is already enabled on content (0012);
-- this only swaps the policy body. The WITH CHECK now also requires the caller
-- to be role='curator'. A guest (auth.uid() null) and a User_Role account both
-- fail → the write is rejected under RLS, independent of any UI check.
drop policy if exists content_insert_own on public.content;
create policy content_insert_own on public.content
  for insert with check (
    creator_id = auth.uid()                         -- can only publish as self (0012 invariant)
    and exists (                                    -- AND must be an approved curator (Req 18.1)
      select 1 from public.users u
       where u.id = auth.uid()
         and u.role = 'curator'
    )
  );

-- ───────────────────────────────────────────────────────────────
-- 2. RETIRE THE 0020 AUTO-PROMOTE TRIGGER  (Req 18.4)
-- ───────────────────────────────────────────────────────────────
-- The 0020 trigger promoted a content author to 'curator' on insert. With the
-- publish gate above, a non-curator can no longer insert at all — but we drop
-- the trigger regardless so posting is never a promotion path. The trigger
-- FUNCTION (public.promote_curator_on_post) is left in place, harmless and
-- unreferenced, so this migration only detaches the trigger (idempotent).
drop trigger if exists on_content_promote_curator on public.content;

-- Reload PostgREST so the redefined policy takes effect immediately (idempotent).
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- DONE (Phase 3 / migration 0036). Only an approved curator (role='curator',
-- incl. grandfathered curators) may publish a clip; a User_Role account — even
-- with a pending/rejected application — is rejected under RLS; posting no longer
-- self-promotes. This completes the curator-application-approval data layer
-- (0034 apply → 0035 decide → 0036 gate). The client-side badge rendering +
-- grandfathering CTA suppression ship with the v68→v69 deploy.
-- ═══════════════════════════════════════════════════════════════
