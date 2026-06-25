/* ═══════════════════════════════════════════════════════════════
 * data/loadtest.js — ShowShak DB load / soak test  (LOCAL, SERVICE ROLE)
 * ───────────────────────────────────────────────────────────────
 * Bulk-creates auth users, bulk-UPSERTS content (videos), then hammers
 * the feed RETRIEVAL query under rising concurrency to find the point
 * where latency/error-rate degrade — i.e. your real DB ceiling.
 *
 * It does NOT invent numbers: every figure printed is measured against
 * YOUR Supabase instance. Throughput depends on your plan/compute, the
 * pooler, indexes, RLS and network — so RUN IT to get your ceiling.
 *
 * ╔═════════════════════════════════════════════════════════════╗
 * ║  SAFETY                                                      ║
 * ║  • Uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS). LOCAL ONLY.║
 * ║  • EVERY row it writes is tagged meta.seed=true +            ║
 * ║    meta.loadtest=true; users get @loadtest.showshak emails.  ║
 * ║  • `--cleanup` purges ALL of it. Run against a staging /     ║
 * ║    disposable project if you can; it writes real rows + real ║
 * ║    auth users (which count toward your quota).               ║
 * ╚═════════════════════════════════════════════════════════════╝
 *
 *   cd data && npm install @supabase/supabase-js   (once)
 *
 *   node data/loadtest.js --users=200 --videos=2000 --concurrency=20
 *   node data/loadtest.js --ramp                 # find the retrieval ceiling
 *   node data/loadtest.js --videos=5000 --upsert-twice  # test true upsert path
 *   node data/loadtest.js --cleanup              # purge ALL load-test data
 *
 * ENV: data/.env (git-ignored) with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY,
 * or run with: node --env-file=data/.env data/loadtest.js ...
 * ═══════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const LOADTEST_EMAIL_DOMAIN = 'loadtest.showshak';   // all test users
const TAG = { seed: true, loadtest: true };          // on every written row

/* ── Env loading (self-contained fallback, mirrors ingest-tmdb.js) ── */
function _loadEnv() {
  try {
    const p = path.join(__dirname, '.env');
    if (!fs.existsSync(p)) return;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch (e) { /* ignore */ }
}
_loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (set in data/.env).');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/* ── CLI args ── */
function arg(name, def) {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  if (hit) return hit.split('=')[1];
  if (process.argv.includes('--' + name)) return true;
  return def;
}
const OPT = {
  users: parseInt(arg('users', 0), 10) || 0,
  videos: parseInt(arg('videos', 0), 10) || 0,
  concurrency: parseInt(arg('concurrency', 20), 10) || 20,
  batch: parseInt(arg('batch', 500), 10) || 500,     // rows per upsert request
  durationSec: parseInt(arg('duration', 10), 10) || 10,
  ramp: !!arg('ramp', false),
  upsertTwice: !!arg('upsert-twice', false),
  retrievalOnly: !!arg('retrieval-only', false),
  cleanup: !!arg('cleanup', false),
  baseline: !!arg('baseline', false),
  verify: !!arg('verify', false),
};

/* ── Tiny stats + concurrency helpers ── */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const now = () => Number(process.hrtime.bigint() / 1000n) / 1000; // ms, high-res
function pct(arr, p) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}
function summarize(label, lat, errors, elapsedMs) {
  const n = lat.length + errors;
  console.log(
    `  ${label.padEnd(22)} ok=${lat.length} err=${errors} ` +
    `${(n / (elapsedMs / 1000)).toFixed(1)}/s  ` +
    `p50=${pct(lat, 50).toFixed(0)}ms p95=${pct(lat, 95).toFixed(0)}ms p99=${pct(lat, 99).toFixed(0)}ms`
  );
}

/* Run `tasks` (array of () => Promise) with a bounded worker pool. Records each
   task's latency (ms) on success, counts failures — never throws. */
async function runPool(tasks, concurrency) {
  const lat = [];
  let errors = 0, i = 0;
  const t0 = now();
  async function worker() {
    while (i < tasks.length) {
      const my = i++;
      const s = now();
      try { await tasks[my](); lat.push(now() - s); }
      catch (e) { errors++; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return { lat, errors, elapsedMs: now() - t0 };
}

/* ── Phase A: bulk-create auth users (trigger auto-creates public.users) ── */
async function createUsers(n, concurrency) {
  if (!n) return [];
  console.log(`\n▶ Creating ${n} auth users (concurrency ${concurrency})…`);
  const ids = [];
  const tasks = Array.from({ length: n }, () => async () => {
    const email = `lt-${crypto.randomUUID()}@${LOADTEST_EMAIL_DOMAIN}`;
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),     // throwaway; these never log in
      email_confirm: true,
      user_metadata: { name: 'LoadTest', seed: true, loadtest: true },
    });
    if (error) throw error;
    if (data && data.user) ids.push(data.user.id);
  });
  const r = await runPool(tasks, concurrency);
  summarize('users.createUser', r.lat, r.errors, r.elapsedMs);
  // Tag the auto-created profile rows so cleanup + RESET catch them.
  if (ids.length) {
    await db.from('users').update({ meta: TAG }).in('id', ids);
  }
  return ids;
}

/* Fetch existing load-test user ids (for a videos-only run). */
async function existingLoadtestUserIds(limit = 1000) {
  const { data } = await db.from('users').select('id').eq('meta->>loadtest', 'true').limit(limit);
  return (data || []).map(r => r.id);
}

/* ── Phase B: bulk-UPSERT content (videos) ── */
function makeVideoRow(creatorId) {
  return {
    id: crypto.randomUUID(),
    creator_id: creatorId,
    description: 'Load-test clip ' + crypto.randomUUID().slice(0, 8),
    status: 'live',
    fires_count: Math.floor(Math.random() * 5000),
    meta: { seed: true, loadtest: true, bg: 'linear-gradient(160deg,#1a0505,#000)' },
  };
}
async function upsertVideos(m, userIds, concurrency, batchSize, twice) {
  if (!m) return;
  if (!userIds.length) { console.error('No load-test users to own videos. Run with --users first.'); return; }
  console.log(`\n▶ Upserting ${m} content rows (batch ${batchSize}, concurrency ${concurrency})…`);
  const rows = Array.from({ length: m }, () => makeVideoRow(userIds[Math.floor(Math.random() * userIds.length)]));
  const batches = [];
  for (let k = 0; k < rows.length; k += batchSize) batches.push(rows.slice(k, k + batchSize));
  const insertTasks = batches.map(b => async () => {
    const { error } = await db.from('content').upsert(b, { onConflict: 'id' });
    if (error) throw error;
  });
  const r = await runPool(insertTasks, concurrency);
  summarize('content.upsert(insert)', r.lat, r.errors, r.elapsedMs);
  console.log(`    → ${(rows.length / (r.elapsedMs / 1000)).toFixed(0)} rows/sec inserted`);

  if (twice) {   // re-upsert the SAME ids → exercises the UPDATE path of upsert
    console.log(`▶ Re-upserting the same ${m} rows (UPDATE path)…`);
    rows.forEach(row => { row.fires_count = Math.floor(Math.random() * 5000); });
    const updTasks = batches.map(b => async () => {
      const { error } = await db.from('content').upsert(b, { onConflict: 'id' });
      if (error) throw error;
    });
    const r2 = await runPool(updTasks, concurrency);
    summarize('content.upsert(update)', r2.lat, r2.errors, r2.elapsedMs);
    console.log(`    → ${(rows.length / (r2.elapsedMs / 1000)).toFixed(0)} rows/sec updated`);
  }
}

/* ── Phase C: retrieval load — the real feed query, concurrently, for N sec ── */
async function retrievalLoad(concurrency, durationSec) {
  const sel = 'id, description, fires_count, views_count, meta, status, mux_playback_id, url, thumbnail_url, duration_sec, creator:creator_id(username,name,avatar_url), title:title_id(name,year,synopsis,providers,cached_at), platform:platform_id(id,name,color,abbr)';
  const deadline = now() + durationSec * 1000;
  const lat = []; let errors = 0;
  async function worker() {
    while (now() < deadline) {
      const off = Math.floor(Math.random() * 50);   // vary the window
      const s = now();
      const { error } = await db.from('content')
        .select(sel).eq('status', 'live').is('deleted_at', null)
        .order('created_at', { ascending: false }).range(off, off + 9);
      if (error) errors++; else lat.push(now() - s);
    }
  }
  const t0 = now();
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { lat, errors, elapsedMs: now() - t0 };
}

/* ── Phase D: ramp retrieval concurrency to find the degradation point ── */
async function rampRetrieval() {
  console.log(`\n▶ Ramping feed-retrieval concurrency (each step ${OPT.durationSec}s)…`);
  console.log('  The CEILING is the last step before p95 latency spikes or errors appear.\n');
  const steps = [5, 10, 20, 40, 80, 120, 160];
  let prevP95 = 0;
  for (const c of steps) {
    const r = await retrievalLoad(c, OPT.durationSec);
    const qps = (r.lat.length / (r.elapsedMs / 1000));
    const p95 = pct(r.lat, 95);
    const errRate = r.errors / Math.max(1, r.lat.length + r.errors);
    console.log(
      `  conc=${String(c).padStart(3)}  ${qps.toFixed(0).padStart(5)} q/s  ` +
      `p50=${pct(r.lat, 50).toFixed(0)}ms p95=${p95.toFixed(0)}ms p99=${pct(r.lat, 99).toFixed(0)}ms  ` +
      `errRate=${(errRate * 100).toFixed(1)}%` +
      ((errRate > 0.01 || (prevP95 && p95 > prevP95 * 2)) ? '   ← degrading' : '')
    );
    prevP95 = p95;
    await sleep(500);
  }
  console.log('\n  Read the table top→down: throughput should rise then plateau; the ceiling');
  console.log('  is where q/s stops rising and p95 climbs sharply or errRate > ~1%.');
}

/* ── Baseline / verify: prove the DB returns to exactly its prior state ── */
async function tableCount(t) {
  const r = await db.from(t).select('id', { count: 'exact', head: true });
  return r.error ? '?' : (r.count || 0);
}
async function loadtestResidue() {
  const u = await db.from('users').select('id', { count: 'exact', head: true }).eq('meta->>loadtest', 'true');
  const c = await db.from('content').select('id', { count: 'exact', head: true }).eq('meta->>loadtest', 'true');
  return { users: u.count || 0, content: c.count || 0 };
}
async function baseline() {
  console.log('\n▶ BASELINE row counts (save these — compare after cleanup):');
  for (const t of ['users', 'content', 'titles', 'follows', 'content_fires', 'stacks']) {
    console.log(`    ${t.padEnd(16)} ${await tableCount(t)}`);
  }
  const res = await loadtestResidue();
  console.log(`    (load-test residue now: users=${res.users} content=${res.content} — should be 0 before a run)`);
}
async function verify() {
  console.log('\n▶ VERIFY — load-test residue (MUST be 0 to confirm the DB is back to normal):');
  const res = await loadtestResidue();
  console.log(`    users tagged loadtest:   ${res.users}`);
  console.log(`    content tagged loadtest: ${res.content}`);
  console.log('\n▶ Current totals (compare to your saved baseline):');
  for (const t of ['users', 'content', 'titles']) console.log(`    ${t.padEnd(16)} ${await tableCount(t)}`);
  if (res.users === 0 && res.content === 0) console.log('\n  ✅ Clean — no load-test rows remain. DB is back to its prior state.');
  else console.log('\n  ⚠ Residue remains — re-run `--cleanup` (or RESET_demo_data.sql) until both are 0.');
}

/* ── Cleanup: purge ALL load-test data, FK-safe + provable ── */
async function cleanup() {
  console.log('\n▶ Cleanup: purging all load-test data (FK-safe order)…');
  // 1. content first (it FK-references users via creator_id).
  const { error: ce } = await db.from('content').delete().eq('meta->>loadtest', 'true');
  console.log('  content (loadtest) deleted', ce ? ('ERROR ' + ce.message) : 'ok');
  // 2. profile rows (public.users) tagged loadtest — before deleting the auth row,
  //    so it works whether or not the auth→profile FK cascades.
  const { error: ue } = await db.from('users').delete().eq('meta->>loadtest', 'true');
  console.log('  users  (loadtest) deleted', ue ? ('ERROR ' + ue.message) : 'ok');
  // 3. auth users by the dedicated test email domain.
  let page = 1, removed = 0;
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data || !data.users.length) break;
    const mine = data.users.filter(u => (u.email || '').endsWith('@' + LOADTEST_EMAIL_DOMAIN));
    for (const u of mine) { await db.auth.admin.deleteUser(u.id).then(() => removed++).catch(() => {}); }
    if (data.users.length < 200) break;
    page++;
  }
  console.log(`  auth users deleted: ${removed}`);
  await verify();   // prove it's clean
}

/* ── Main ── */
(async function main() {
  console.log('ShowShak load test →', SUPABASE_URL);
  if (OPT.baseline) { await baseline(); return; }
  if (OPT.verify) { await verify(); return; }
  if (OPT.cleanup) { await cleanup(); return; }

  if (OPT.retrievalOnly || OPT.ramp) {
    if (OPT.ramp) {
      await rampRetrieval();
    } else {
      console.log(`\n▶ Feed retrieval (concurrency ${OPT.concurrency}, ${OPT.durationSec}s)…`);
      const r = await retrievalLoad(OPT.concurrency, OPT.durationSec);
      summarize('content.retrieval', r.lat, r.errors, r.elapsedMs);
    }
    return;
  }

  let userIds = await createUsers(OPT.users, OPT.concurrency);
  if (!userIds.length && OPT.videos) userIds = await existingLoadtestUserIds();
  await upsertVideos(OPT.videos, userIds, OPT.concurrency, OPT.batch, OPT.upsertTwice);

  console.log('\n▶ Feed retrieval under load:');
  const r = await retrievalLoad(OPT.concurrency, OPT.durationSec);
  summarize('content.retrieval', r.lat, r.errors, r.elapsedMs);

  console.log('\nDone. Run `node data/loadtest.js --ramp` for the retrieval ceiling,');
  console.log('and `node data/loadtest.js --cleanup` to purge everything when finished.');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
