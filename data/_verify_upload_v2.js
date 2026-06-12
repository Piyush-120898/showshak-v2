/* ═══════════════════════════════════════════════════════════════
 * data/_verify_upload_v2.js — verify Curator Upload v2 schema migrations
 * against the LIVE database (service role). Re-runnable ops check.
 *   node data/_verify_upload_v2.js
 * Proves the structural correctness of 0014 (content_titles), that
 * 0015's content UPDATE path works, and that 0017 (sync_content_genres
 * + the content_titles triggers) derives content_genres correctly.
 * Cleans up every test row it creates (safely re-runnable, no residue).
 * NOTE: RLS-as-enforced-for-the-anon/authenticated role is verified in
 * the browser during UI wiring (service role bypasses RLS by design).
 *
 * ⚠️ The 0017 section below only PASSES after the founder has applied
 *    supabase/migrations/0017_sync_content_genres.sql in the Supabase
 *    SQL editor. If the function/trigger is missing it fails with a
 *    helpful "apply 0017 first" message.
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
const RANDOM_UUID = '00000000-0000-0000-0000-0000000000ff';

let problems = 0;
const ok  = (m) => console.log('  \u2713 ' + m);
const bad = (m) => { problems++; console.log('  \u2717 ' + m); };

(async () => {
  console.log('\n=== Verify Curator Upload v2 schema (0014 + 0015 + 0017) ===\n');

  // Need a real clip + a real title to exercise the join table.
  const { data: clips } = await db.from('content').select('id, creator_id').limit(1);
  const { data: titles } = await db.from('titles').select('id').limit(1);
  if (!clips || !clips.length || !titles || !titles.length) {
    bad('need at least one content row and one title row to test; aborting');
    process.exit(1);
  }
  const contentId = clips[0].id;
  const titleId = titles[0].id;

  console.log('0014 — content_titles table');

  // 1) Table exists + insert works with defaults (sort_no, created_at).
  const ins = await db.from('content_titles').insert({ content_id: contentId, title_id: titleId, sort_no: 99 }).select('content_id, title_id, sort_no, created_at');
  if (ins.error) { bad('insert into content_titles failed: ' + ins.error.message); }
  else if (!ins.data || !ins.data.length) { bad('insert returned no row'); }
  else {
    ok('table exists; insert succeeded');
    if (ins.data[0].sort_no === 99) ok('sort_no stored correctly'); else bad('sort_no wrong: ' + ins.data[0].sort_no);
    if (ins.data[0].created_at) ok('created_at default populated'); else bad('created_at not defaulted');
  }

  // 2) Read it back.
  const sel = await db.from('content_titles').select('*').eq('content_id', contentId).eq('title_id', titleId);
  if (!sel.error && sel.data && sel.data.length === 1) ok('row reads back'); else bad('readback failed');

  // 3) Duplicate (same content_id + title_id) must violate the PK (23505).
  const dup = await db.from('content_titles').insert({ content_id: contentId, title_id: titleId });
  if (dup.error && (dup.error.code === '23505' || /duplicate|unique/i.test(dup.error.message))) ok('PK blocks duplicate link (no double-link)');
  else bad('duplicate link was NOT blocked (PK missing?) — ' + (dup.error ? dup.error.message : 'inserted'));

  // 4) Bogus content_id must violate the FK (23503).
  const fk = await db.from('content_titles').insert({ content_id: RANDOM_UUID, title_id: titleId });
  if (fk.error && (fk.error.code === '23503' || /foreign key/i.test(fk.error.message))) ok('FK blocks link to a non-existent clip');
  else { bad('FK to content NOT enforced — ' + (fk.error ? fk.error.message : 'inserted')); if (!fk.error) await db.from('content_titles').delete().eq('content_id', RANDOM_UUID); }

  // 5) Cleanup the test link.
  const del = await db.from('content_titles').delete().eq('content_id', contentId).eq('title_id', titleId);
  if (!del.error) ok('cleanup: test link removed'); else bad('cleanup failed: ' + del.error.message);

  console.log('\n0015 — content owner UPDATE path');
  // Verify an UPDATE on content succeeds at the table level (no-op write of
  // an existing column). RLS owner-scoping is verified in-browser later.
  const upd = await db.from('content').update({ updated_at: new Date().toISOString() }).eq('id', contentId).select('id');
  if (!upd.error && upd.data && upd.data.length === 1) ok('content UPDATE works (grant present)'); else bad('content UPDATE failed: ' + (upd.error ? upd.error.message : 'no row'));

  // ───────────────────────────────────────────────────────────────
  // 0017 — sync_content_genres function + content_titles triggers
  // ───────────────────────────────────────────────────────────────
  // This section proves the OBSERVABLE derivation behavior end-to-end with
  // a self-cleaning fixture (more robust than catalog introspection through
  // PostgREST): link a couple of temp titles whose meta.genres overlap to a
  // temp draft clip, then assert content_genres equals the de-duplicated
  // UNION of those titles' genres; unlink one and assert the genres
  // re-derive (idempotent). Every fixture row is removed in a `finally`, so
  // the script is safely re-runnable and leaves no residue. Fixture rows are
  // tagged (names prefixed `_verify_`, meta.verify=true) for precise cleanup.
  console.log('\n0017 — sync_content_genres + content_titles triggers');

  // Genre names used by the fixture. These are part of the 0001 seed list,
  // so in a normal DB sync_content_genres resolves them to the existing
  // shared `genres` rows (it does NOT auto-create them). We capture the ids
  // that already exist so cleanup can precisely remove ONLY any genre the
  // function had to auto-create (meta.source='auto'), never a shared row.
  const FIX_GENRES = ['Drama', 'Crime', 'Thriller'];
  const sortUniq = (arr) => Array.from(new Set(arr)).sort();
  const setEq = (a, b) => { const x = sortUniq(a), y = sortUniq(b); return x.length === y.length && x.every((v, i) => v === y[i]); };

  // Read the derived genre NAMES for a clip (two simple queries instead of a
  // PostgREST embed, to stay robust regardless of relationship cache state).
  const genreNamesFor = async (cid) => {
    const cg = await db.from('content_genres').select('genre_id').eq('content_id', cid);
    if (cg.error) return { error: cg.error };
    const ids = (cg.data || []).map((r) => r.genre_id);
    if (!ids.length) return { names: [], rows: 0 };
    const g = await db.from('genres').select('id, name').in('id', ids);
    if (g.error) return { error: g.error };
    return { names: (g.data || []).map((r) => r.name), rows: cg.data.length };
  };

  // (a) Existence probe: invoke the function with a content_id that has no
  // links (a no-op delete+rebuild). A "function not found" error means 0017
  // has not been applied yet — fail with a helpful message and skip the rest.
  const probe = await db.rpc('sync_content_genres', { p_content_id: RANDOM_UUID });
  const missingFn = probe.error && (probe.error.code === 'PGRST202' || /could not find the function|function .* does not exist|schema cache/i.test(probe.error.message || ''));
  if (missingFn) {
    bad('sync_content_genres() is MISSING — apply supabase/migrations/0017_sync_content_genres.sql in the Supabase SQL editor first, then re-run this script.');
  } else {
    if (probe.error) console.log('  (note: probe rpc returned "' + probe.error.message + '"; relying on the behavioral fixture below)');
    else ok('sync_content_genres() function exists (callable)');

    // Snapshot pre-existing seed genres so cleanup only removes auto-created ones.
    const preG = await db.from('genres').select('id, name').in('name', FIX_GENRES);
    const preIds = new Set((preG.data || []).map((r) => r.id));

    const creatorId = clips[0].creator_id;
    let titleAId = null, titleBId = null, gContentId = null;
    try {
      // (b) Fixture titles with overlapping genre name arrays (Crime overlaps).
      const tA = await db.from('titles').insert({ name: '_verify_title_a', meta: { verify: true, seed: '_verify_upload_v2', genres: ['Drama', 'Crime'] } }).select('id');
      const tB = await db.from('titles').insert({ name: '_verify_title_b', meta: { verify: true, seed: '_verify_upload_v2', genres: ['Crime', 'Thriller'] } }).select('id');
      if (tA.error || tB.error || !tA.data || !tB.data) { bad('could not create fixture titles: ' + ((tA.error || tB.error || {}).message || 'no row')); }
      else {
        titleAId = tA.data[0].id; titleBId = tB.data[0].id;

        // (c) Fixture clip (a draft is fine). title_id = primary (title A).
        const c = await db.from('content').insert({ creator_id: creatorId, title_id: titleAId, description: '_verify_upload_v2 fixture clip', status: 'draft', meta: { verify: true, seed: '_verify_upload_v2' } }).select('id');
        if (c.error || !c.data) { bad('could not create fixture content: ' + (c.error ? c.error.message : 'no row')); }
        else {
          gContentId = c.data[0].id;

          // (d) Link BOTH titles in ONE insert statement → the AFTER INSERT
          // statement trigger fires once and derives the de-duplicated union.
          const link = await db.from('content_titles').insert([
            { content_id: gContentId, title_id: titleAId, sort_no: 0 },
            { content_id: gContentId, title_id: titleBId, sort_no: 1 },
          ]);
          if (link.error) { bad('linking fixture titles failed: ' + link.error.message); }
          else {
            const r1 = await genreNamesFor(gContentId);
            if (r1.error) bad('reading derived genres failed: ' + r1.error.message);
            else if (setEq(r1.names, FIX_GENRES) && r1.rows === 3) ok('INSERT trigger derived the de-duplicated union (Drama, Crime, Thriller — 3 rows, no dupes)');
            else bad('union wrong after link: got [' + sortUniq(r1.names).join(', ') + '] (' + r1.rows + ' rows), expected [Crime, Drama, Thriller] (3 rows). Is 0017 applied?');

            // (e) Unlink title B → AFTER DELETE statement trigger re-derives
            // idempotently from the CURRENT links (only title A remains).
            const unlink = await db.from('content_titles').delete().eq('content_id', gContentId).eq('title_id', titleBId);
            if (unlink.error) { bad('unlinking fixture title failed: ' + unlink.error.message); }
            else {
              const r2 = await genreNamesFor(gContentId);
              if (r2.error) bad('reading re-derived genres failed: ' + r2.error.message);
              else if (setEq(r2.names, ['Drama', 'Crime']) && r2.rows === 2) ok('DELETE trigger re-derived genres idempotently (Drama, Crime — 2 rows)');
              else bad('re-derivation wrong after unlink: got [' + sortUniq(r2.names).join(', ') + '] (' + r2.rows + ' rows), expected [Crime, Drama] (2 rows)');
            }
          }
        }
      }
    } finally {
      // (f) CLEANUP — remove every fixture row so the script is re-runnable.
      // Order respects FKs: links first (the DELETE empties content_genres via
      // the trigger), then any stray content_genres, then content, then titles.
      if (gContentId) {
        await db.from('content_titles').delete().eq('content_id', gContentId);
        await db.from('content_genres').delete().eq('content_id', gContentId);
        const dC = await db.from('content').delete().eq('id', gContentId);
        if (dC.error) bad('cleanup: fixture content not removed: ' + dC.error.message);
      }
      if (titleAId) await db.from('titles').delete().eq('id', titleAId);
      if (titleBId) await db.from('titles').delete().eq('id', titleBId);
      // Remove ONLY genres the function had to auto-create during this run
      // (never shared/seed rows): new id + meta.source='auto'.
      const postG = await db.from('genres').select('id, name, meta').in('name', FIX_GENRES);
      const autoNew = (postG.data || []).filter((r) => !preIds.has(r.id) && r.meta && r.meta.source === 'auto');
      for (const r of autoNew) await db.from('genres').delete().eq('id', r.id);
      ok('cleanup: fixture titles/clip/links removed (no residue)');
    }
  }

  console.log('\n=== ' + (problems ? problems + ' PROBLEM(S)' : 'ALL STRUCTURAL CHECKS PASSED') + ' ===');
  console.log('(RLS for anon/authenticated is verified in-browser during UI wiring.)\n');
  process.exit(problems ? 1 : 0);
})();
