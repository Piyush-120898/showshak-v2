-- ═══════════════════════════════════════════════════════════════
-- 0039 — ADD LIONSGATE PLAY TO THE PLATFORM CATALOG  (founder-requested)
-- ───────────────────────────────────────────────────────────────
-- Lionsgate Play is live in India (standalone app/site + Prime Video
-- Channels / Apple TV Channels add-on) and TMDB reports it as a watch
-- provider ("Lionsgate Play"), so curators keep hitting titles that
-- stream there with no matching catalog chip.
--
-- Same pattern as 0027: idempotent insert-if-missing by lower(name),
-- region-tag + activate on re-run. NOTHING is deleted or deactivated.
-- The active-only readers (onboarding, settings My Platforms, upload
-- availability chips) pick it up automatically after the PostgREST
-- reload — no frontend change needed for it to APPEAR; the tmdb-providers
-- Edge Function maps the TMDB provider name onto this row (redeploy it
-- after applying — see VERIFY below).
--
-- Run: Supabase SQL editor → paste → Run. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

insert into platforms (name, color, abbr, region, active)
select v.name, v.color, v.abbr, 'IN', true
  from (values
    ('Lionsgate Play', '#E5A00D', 'LP')
  ) as v(name, color, abbr)
 where not exists (
   select 1 from platforms p where lower(p.name) = lower(v.name)
 );

-- Idempotent refresh (matches 0027 §3): if the row already existed but was
-- deactivated/untagged, re-activate + region-tag it without touching color/abbr.
update platforms
   set region = 'IN', active = true, updated_at = now()
 where lower(name) = 'lionsgate play';

-- Reload PostgREST so the catalog change is live immediately.
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- VERIFY (manual):
--   select name, abbr, active from platforms where lower(name) = 'lionsgate play';
--   → one row, active = true.
-- THEN redeploy the TMDB mapper so new title links match it:
--   supabase functions deploy tmdb-providers --no-verify-jwt
-- ═══════════════════════════════════════════════════════════════
