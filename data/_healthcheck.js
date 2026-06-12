/* ═══════════════════════════════════════════════════════════════
 * data/_healthcheck.js — READ-ONLY end-to-end health check (ops tool).
 * Verifies the live pipeline from the DB's point of view + Mux reachability.
 * Safe to run anytime:  node data/_healthcheck.js
 * Uses the service-role key from data/.env (local only; never shipped).
 * ═══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

(function loadEnv() {
  const p = path.join(__dirname, '.env');
  if (!fs.existsSync(p)) return;
  fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach((line) => {
    const t = line.trim(); if (!t || t.startsWith('#')) return;
    const eq = t.indexOf('='); if (eq === -1) return;
    const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (k && process.env[k] === undefined) process.env[k] = v;
  });
})();

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = process.env.SUPABASE_ANON_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  : null;

let problems = 0;
const ok  = (m) => console.log('  \u2713 ' + m);
const bad = (m) => { problems++; console.log('  \u2717 ' + m); };

async function muxStatus(playbackId) {
  try {
    const r = await fetch('https://stream.mux.com/' + playbackId + '.m3u8', { method: 'GET' });
    return r.status;
  } catch (e) { return 'ERR'; }
}

(async () => {
  console.log('\n=== ShowShak health check ===\n');

  // 1) Content rows (service role: full visibility).
  console.log('1) Content table');
  const { data: rows, error } = await db.from('content')
    .select('id, status, mux_playback_id, deleted_at, created_at, meta')
    .order('created_at', { ascending: false });
  if (error) { bad('content query failed: ' + error.message); }
  else {
    const live = rows.filter((r) => r.status === 'live' && !r.deleted_at);
    const proc = rows.filter((r) => r.status === 'processing' && !r.deleted_at);
    const real = rows.filter((r) => !(r.meta && r.meta.seed));
    ok(`${rows.length} rows total — live ${live.length}, processing ${proc.length}, real(non-seed) ${real.length}`);
    if (proc.length) bad(`${proc.length} clip(s) STILL processing (webhook may not have flipped them)`);
    else ok('no clips stuck on processing');
  }

  // 2) Mux reachability for every live, Mux-backed clip.
  console.log('\n2) Mux stream reachability (live clips)');
  const muxClips = (rows || []).filter((r) => r.status === 'live' && !r.deleted_at && r.mux_playback_id);
  for (const c of muxClips) {
    const s = await muxStatus(c.mux_playback_id);
    if (s === 200) ok(`${c.mux_playback_id.slice(0, 16)}… → 200 OK`);
    else bad(`${c.mux_playback_id.slice(0, 16)}… → ${s} (not playable)`);
  }
  if (!muxClips.length) console.log('  (no Mux-backed live clips to check)');

  // 3) The exact feed query (what the app + cache are seeded from), timed.
  console.log('\n3) Feed query (status=live, not deleted, newest first, limit 10)');
  const t0 = Date.now();
  const { data: feed, error: ferr } = await db.from('content')
    .select('id, status, mux_playback_id, created_at')
    .eq('status', 'live').is('deleted_at', null)
    .order('created_at', { ascending: false }).range(0, 9);
  const ms = Date.now() - t0;
  if (ferr) bad('feed query failed: ' + ferr.message);
  else ok(`returned ${feed.length} clip(s) in ${ms}ms`);

  // 4) Guest (anon) can read the public feed (RLS sanity).
  if (anon) {
    console.log('\n4) Guest read (anon key + RLS)');
    const { data: gfeed, error: gerr } = await anon.from('content')
      .select('id, status').eq('status', 'live').is('deleted_at', null).limit(5);
    if (gerr) bad('anon feed read failed: ' + gerr.message);
    else ok(`guest sees ${gfeed.length} live clip(s) (public feed works)`);
  } else {
    console.log('\n4) Guest read — skipped (SUPABASE_ANON_KEY not in data/.env)');
  }

  console.log('\n=== ' + (problems ? problems + ' PROBLEM(S) FOUND' : 'ALL HEALTHY') + ' ===\n');
  console.log('Note: the 0013 feed index lives in pg_catalog and can\'t be read via the API.');
  console.log('Verify it in the SQL editor:  select indexname from pg_indexes where indexname = \'idx_content_feed_live\';\n');
  process.exit(problems ? 1 : 0);
})();
