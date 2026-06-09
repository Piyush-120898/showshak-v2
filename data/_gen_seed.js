/* Generates supabase/migrations/0007_seed_demo_content.sql from the single
   source of truth (showshak-data.js). Demo curators become real auth users,
   demo clips become real linked content. EVERYTHING is tagged seed so the
   reset script can wipe it cleanly. Run: node data/_gen_seed.js */
const fs = require('fs');
const crypto = require('crypto');
const SSData = require('./showshak-data.js');

const q = (s) => (s == null ? '' : String(s)).replace(/'/g, "''");   // escape single quotes
const uuid = () => crypto.randomUUID();

// Curator display metadata (from the central curators map).
const curators = SSData.curators;            // { username: {name, verified, bio, ...} }
const clips    = SSData.clips;               // the 8 canonical clips

// Assign stable UUIDs.
const curatorId = {};                        // username -> uuid
Object.keys(curators).forEach(u => { curatorId[u] = uuid(); });

let out = `-- ═══════════════════════════════════════════════════════════════
-- SHOWSHAK — SEED DEMO CONTENT  (Step 4 precondition)  [AUTO-GENERATED]
-- ───────────────────────────────────────────────────────────────
-- Generated from data/showshak-data.js by data/_gen_seed.js — do not
-- edit by hand; regenerate instead.
--
-- Makes the demo feed REAL so fires/saves/follows can link by foreign
-- key (your "everything linked to the video + curator" requirement):
--   • ${Object.keys(curators).length} demo curators  -> real auth.users + public.users (role=curator)
--   • ${clips.length} demo titles    -> titles
--   • ${clips.length} demo clips     -> content (linked to creator + title + platform)
--   • genre + mood links             -> content_genres / content_moods
--
-- EVERYTHING here is tagged seed (meta.seed = true / email @seed.showshak)
-- so supabase/RESET_demo_data.sql can remove all of it for a clean
-- launch — without touching any real users or data.
--
-- Run ONCE: SQL Editor → paste → Run. (Re-running errors on duplicate
-- emails, which is harmless — run the reset first if you want to redo.)
-- ═══════════════════════════════════════════════════════════════

`;

// ── 1. Curators as real auth users (trigger auto-creates the profile) ──
out += `-- ── 1. Demo curators (real auth users; trigger creates their profile) ──\n`;
Object.keys(curators).forEach(u => {
  const c = curators[u];
  const email = `${u}@seed.showshak`;
  out += `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('${curatorId[u]}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '${email}', crypt('seed-no-login-2026', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', '${q(c.name)}', 'seed', true));\n`;
});

// ── 2. Enrich the auto-created profiles (role, verified, bio, seed tag) ──
out += `\n-- ── 2. Enrich curator profiles created by the trigger ──\n`;
Object.keys(curators).forEach(u => {
  const c = curators[u];
  out += `update public.users set role='curator', verified=${c.verified ? 'true' : 'false'}, bio='${q(c.bio)}', curator_since=now(), meta=jsonb_build_object('seed', true) where id='${curatorId[u]}';\n`;
});

// ── 3. Titles ──
out += `\n-- ── 3. Demo titles ──\n`;
const titleId = {};
clips.forEach(c => {
  titleId[c.id] = uuid();
  out += `insert into titles (id, name, year, synopsis, meta) values ('${titleId[c.id]}', '${q(c.title)}', ${c.year || 'null'}, '${q(c.synopsis)}', jsonb_build_object('seed', true));\n`;
});

// ── 4. Content (clips) linked to creator + title + platform ──
out += `\n-- ── 4. Demo clips (content), linked to creator + title + platform ──\n`;
const contentId = {};
clips.forEach(c => {
  contentId[c.id] = uuid();
  const meta = `jsonb_build_object('seed', true, 'bg', '${q(c.gradient)}', 'lang', '${q(c.lang)}', 'season', '${q(c.season || '')}', 'mood', '${q(JSON.stringify(c.mood || []))}')`;
  out += `insert into content (id, creator_id, title_id, platform_id, description, status, fires_count, meta)
values ('${contentId[c.id]}', '${curatorId[c.curator]}', '${titleId[c.id]}', (select id from platforms where name='${q(c.platform)}' and deleted_at is null limit 1), '${q(c.feedCaption)}', 'live', ${c.fires || 0}, ${meta});\n`;
});

// ── 5. Genre links ──
out += `\n-- ── 5. content_genres links (genres exist from migration 0001) ──\n`;
clips.forEach(c => {
  (c.genre || []).forEach(g => {
    out += `insert into content_genres (content_id, genre_id) select '${contentId[c.id]}', id from genres where name='${q(g)}' limit 1 on conflict do nothing;\n`;
  });
});

// ── 6. Mood links ──
out += `\n-- ── 6. content_moods links (moods exist from migration 0001) ──\n`;
clips.forEach(c => {
  (c.mood || []).forEach(m => {
    out += `insert into content_moods (content_id, mood_id) select '${contentId[c.id]}', id from moods where name='${q(m)}' limit 1 on conflict do nothing;\n`;
  });
});

out += `\n-- ═══════════════════════════════════════════════════════════════
-- DONE. The feed's clips + curators are now real, FK-linked rows.
-- Fires / saves / follows can now persist against real IDs.
-- To wipe everything for launch: run supabase/RESET_demo_data.sql
-- ═══════════════════════════════════════════════════════════════
`;

fs.writeFileSync(__dirname + '/../supabase/migrations/0007_seed_demo_content.sql', out);
console.log('Wrote supabase/migrations/0007_seed_demo_content.sql');
console.log('Curators:', Object.keys(curators).length, '| Titles/Clips:', clips.length);
