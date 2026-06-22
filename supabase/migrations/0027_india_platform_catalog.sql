-- ═══════════════════════════════════════════════════════════════
-- 0027 — India platform catalog refresh (verified 2026)
-- ───────────────────────────────────────────────────────────────
-- The original seed (0001) mixed in platforms that are WRONG for India 2026:
--   • Disney+  → folded into JioHotstar (JioCinema + Disney+ Hotstar merged
--                Feb 2025). Not a separate service here anymore.
--   • HBO Max  → in India it exists ONLY as a hub inside JioHotstar
--                (Apr 2026 WBD×JioHotstar deal), not a standalone destination.
--   • Hulu     → never launched in India (US-only).
-- This migration:
--   1. DEACTIVATES those three (active=false) — we DO NOT delete, so any
--      existing content.platform_id / watch_events FKs stay intact.
--   2. UPSERTS the verified main + main-regional India catalog (idempotent:
--      inserts when missing by lower(name), then marks region='IN'/active=true).
-- Excluded on purpose (researched): ALTBalaji/ALTT (govt-banned, 2025), Ullu
-- and other adult apps (content-safety + banned wave), Tata Play/Airtel Xstream
-- (aggregators, not real Watch It destinations).
--
-- FOUNDER-RUN: apply in the Supabase SQL editor. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- 1. Deactivate the India-invalid / merged services (never delete — keep FKs).
update platforms
   set active = false, updated_at = now()
 where lower(name) in ('disney+', 'hbo max', 'hulu');

-- 2. Insert the verified catalog where missing (match case-insensitively on name
--    so we never duplicate an existing row like 'Netflix').
insert into platforms (name, color, abbr, region, active)
select v.name, v.color, v.abbr, 'IN', true
  from (values
    -- ── Tier 1 — major, pan-India ──
    ('Netflix',        '#E50914', 'N'),
    ('Prime Video',    '#00A8E0', 'P'),
    ('JioHotstar',     '#FF6A00', 'JH'),
    ('SonyLIV',        '#002868', 'SL'),
    ('Zee5',           '#6B1DF5', 'Z5'),
    ('Apple TV+',      '#111111', 'TV+'),
    ('YouTube',        '#FF0000', 'YT'),
    -- ── Tier 2 — main regional ──
    ('Aha',            '#FF7A00', 'aha'),   -- Telugu / Tamil
    ('Sun NXT',        '#F70146', 'SUN'),   -- South (Tamil/Telugu/Kannada/Malayalam)
    ('Hoichoi',        '#E2231A', 'hoi'),   -- Bengali
    ('Chaupal',        '#15A38A', 'CH'),    -- Punjabi / Haryanvi / Bhojpuri
    ('KableOne',       '#C0392B', 'K1'),    -- Punjabi
    ('STAGE',          '#F5C518', 'ST'),    -- Haryanvi / Rajasthani / Bhojpuri
    ('Planet Marathi', '#FF6A00', 'PM'),    -- Marathi
    ('ManoramaMax',    '#D32F2F', 'MM'),    -- Malayalam
    ('ETV Win',        '#7B2FF7', 'EW'),    -- Telugu
    -- ── Tier 3 — mainstream niche ──
    ('Crunchyroll',    '#F47521', 'CR')     -- Anime (also a SonyLIV add-on)
  ) as v(name, color, abbr)
 where not exists (
   select 1 from platforms p where lower(p.name) = lower(v.name)
 );

-- 3. Ensure every kept platform is region-tagged + active (idempotent refresh;
--    does NOT overwrite existing brand color/abbr for rows already present).
update platforms
   set region = 'IN', active = true, updated_at = now()
 where lower(name) in (
   'netflix','prime video','jiohotstar','sonyliv','zee5','apple tv+','youtube',
   'aha','sun nxt','hoichoi','chaupal','kableone','stage','planet marathi',
   'manoramamax','etv win','crunchyroll'
 );

-- Reload PostgREST so the catalog change is live immediately.
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- VERIFY (manual):
--   select name, abbr, active from platforms order by active desc, name;
--   → Disney+, HBO Max, Hulu = active:false; the verified set = active:true.
-- ═══════════════════════════════════════════════════════════════
