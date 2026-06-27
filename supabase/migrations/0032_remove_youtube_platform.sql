-- ═══════════════════════════════════════════════════════════════
-- 0032 — Remove YouTube from the platform catalog
-- ───────────────────────────────────────────────────────────────
-- YouTube is free / ad-supported and is not a premium "Watch It"
-- subscription destination in the ShowShak model. We deactivate it
-- (never delete) so any existing content.platform_id / watch_events
-- FKs stay intact, exactly like the 0027 deactivations.
--
-- After this, the active India catalog = 16 platforms
-- (6 major + 9 regional + Crunchyroll).
--
-- FOUNDER-RUN: apply in the Supabase SQL editor. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

update platforms
   set active = false, updated_at = now()
 where lower(name) = 'youtube';

-- Reload PostgREST so the catalog change is live immediately.
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- VERIFY (manual):
--   select name, active from platforms where lower(name) = 'youtube';
--   → active:false
-- ═══════════════════════════════════════════════════════════════
