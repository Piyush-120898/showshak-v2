/* ═══════════════════════════════════════════════════════════════
 * data/ingest-tmdb.js — TMDB → Supabase WATCH-IT INGEST  (PRODUCER)
 * ───────────────────────────────────────────────────────────────
 * Standalone local Node script. It is the ONLY component permitted to
 * call TMDB. The founder runs it MANUALLY on a TMDB-reachable network
 * (VPN / Cloudflare DNS), because TMDB is ISP/DNS-blocked in India.
 *
 * It links `titles` rows to TMDB, fetches region-aware FLATRATE
 * streaming providers, maps them onto our `platforms` catalog, and
 * writes `titles.providers` (JSONB keyed by region) + `titles.tmdb_id`
 * + `titles.cached_at` using the Supabase SERVICE ROLE key.
 *
 *   node data/ingest-tmdb.js            # link + cache titles missing a tmdb_id
 *   node data/ingest-tmdb.js --force    # re-link + re-cache ALL titles
 *
 * ╔═════════════════════════════════════════════════════════════╗
 * ║  **SECURITY — READ THIS**                                    ║
 * ║  The SUPABASE_SERVICE_ROLE_KEY bypasses Row Level Security   ║
 * ║  and the TMDB_API_KEY are LOCAL / SERVER-ONLY secrets.       ║
 * ║  They live ONLY in data/.env (git-ignored) and must NEVER    ║
 * ║  appear in any showshak-*.js file, any HTML file, the git    ║
 * ║  repo, or any India-egress / browser path. The shipped app   ║
 * ║  uses the anon key only and reads the cache — it never runs  ║
 * ║  this script and never touches TMDB.                         ║
 * ╚═════════════════════════════════════════════════════════════╝
 *
 * DEPENDENCY: this script requires the npm package
 *   @supabase/supabase-js
 * The founder installs it ONCE before running, in data/ (or the repo
 * root) — a CDN import is NOT an option for Node, the npm package is
 * required:
 *   cd data && npm install @supabase/supabase-js
 * `fetch` is used from the Node global (Node 18+).
 *
 * ENV LOADING — two supported ways:
 *   1. Native (Node >= 20.6):  node --env-file=data/.env data/ingest-tmdb.js
 *   2. Self-contained fallback: _loadEnv() below reads data/.env directly.
 * Either way, assertEnv() fails fast if any of the three required vars
 * (TMDB_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) is missing.
 * ═══════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

/* ── Constants ──────────────────────────────────────────────── */
const REGIONS = ['IN'];          // designed for multiple, e.g. ['IN','US','GB']
const TMDB_DELAY_MS = 300;       // polite pacing between TMDB calls
const TMDB_BASE = 'https://api.themoviedb.org/3';
const NAME_SIMILARITY_THRESHOLD = 0.6;  // min normalized-name similarity to accept a match

/* ── Env loading ────────────────────────────────────────────────
 * Self-contained fallback so the script stays dependency-light. If
 * `node --env-file=data/.env` was used, the vars are already present
 * and we leave them untouched (only set when currently unset). */
function _loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;            // assertEnv() will report missing vars
  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;   // ignore blanks / comments
    const eq = trimmed.indexOf('=');                   // split on the FIRST '=' only
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // strip optional surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = val;  // don't override
  });
}

/* Fail fast with an explicit message listing every missing var, so the
 * script never runs half-configured. */
function assertEnv() {
  const required = ['TMDB_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter((k) => !process.env[k] || !String(process.env[k]).trim());
  if (missing.length) {
    console.error('✗ ingest-tmdb: missing required environment variable(s): ' + missing.join(', '));
    console.error('  Populate data/.env (copy from data/.env.example) with real values, then re-run.');
    console.error('  Either: node --env-file=data/.env data/ingest-tmdb.js');
    console.error('      or: node data/ingest-tmdb.js   (this script auto-loads data/.env)');
    process.exit(1);
  }
}

/* ── Supabase SERVICE-ROLE client ───────────────────────────────
 * The service-role key bypasses RLS, which is required to update
 * `titles` rows. Local/server-only — see the security banner above. */
_loadEnv();
assertEnv();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ═══════════════════════════════════════════════════════════════
 * TASK 2.1 — Title selection + TMDB search & ranking
 * ═══════════════════════════════════════════════════════════════ */

/* selectTitles(force)
 *   non-forced : rows where tmdb_id is null AND deleted_at is null   (R1.2)
 *   --force    : ALL rows where deleted_at is null                   (R1.5) */
async function selectTitles(force) {
  let query = db.from('titles')
    .select('id, name, year, tmdb_id, meta')
    .is('deleted_at', null);
  if (!force) query = query.is('tmdb_id', null);
  const { data, error } = await query;
  if (error) throw new Error('selectTitles failed: ' + error.message);
  return data || [];
}

/* Normalize a name for comparison: lowercase, strip diacritics, drop
 * punctuation, collapse whitespace. Used for exact-name equality and
 * similarity scoring. */
function normalizeName(name) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')   // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')        // punctuation -> space
    .trim()
    .replace(/\s+/g, ' ');
}

/* Lightweight similarity in [0,1] based on token (word) overlap
 * (Jaccard). Cheap, deterministic, dependency-free; good enough to
 * gate clearly-wrong matches below NAME_SIMILARITY_THRESHOLD. */
function nameSimilarity(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const sa = new Set(na.split(' '));
  const sb = new Set(nb.split(' '));
  let inter = 0;
  sa.forEach((tok) => { if (sb.has(tok)) inter++; });
  const union = new Set([...sa, ...sb]).size;
  return union ? inter / union : 0;
}

/* Pull the candidate's release year from either movie or tv shape. */
function candidateYear(c) {
  const d = c.release_date || c.first_air_date || '';
  const y = parseInt(String(d).slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

/* Candidate display name across movie/tv shapes. */
function candidateName(c) {
  return c.title || c.name || c.original_title || c.original_name || '';
}

/* Call a single TMDB search endpoint (movie|tv) by name (+ year when
 * known), returning the raw results[] tagged with media_type. */
async function tmdbSearch(mediaType, name, year) {
  const params = new URLSearchParams({
    api_key: process.env.TMDB_API_KEY,   // TMDB v3 auth via query param
    query: name,
    include_adult: 'false'
  });
  if (year) {
    // movie uses `year`; tv uses `first_air_date_year`
    params.set(mediaType === 'tv' ? 'first_air_date_year' : 'year', String(year));
  }
  const url = `${TMDB_BASE}/search/${mediaType}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB search/${mediaType} HTTP ${res.status}`);
  const json = await res.json();
  return (json.results || []).map((r) => ({ ...r, media_type: mediaType }));
}

/* searchTmdb(name, year)
 *   - queries /search/movie and /search/tv, combines results          (R1.3)
 *   - deterministic ranking: normalized exact-name equality first,
 *     then smallest absolute year difference, then popularity desc
 *   - returns { id, media_type } or null when nothing clears the
 *     minimum name-similarity threshold (-> unmatched, R1.6) */
async function searchTmdb(name, year) {
  const [movies, tv] = await Promise.all([
    tmdbSearch('movie', name, year),
    tmdbSearch('tv', name, year)
  ]);
  const candidates = movies.concat(tv);
  if (!candidates.length) return null;

  const targetNorm = normalizeName(name);

  // Keep only candidates clearing the match gate (R1.6). A candidate matches if:
  //   (a) its normalized name equals the target, OR
  //   (b) ALL of the target's tokens are contained in the candidate's tokens
  //       (handles subtitle-extended titles, e.g. "Scam 1992" matching
  //        "Scam 1992: The Harshad Mehta Story"), OR
  //   (c) Jaccard token overlap >= NAME_SIMILARITY_THRESHOLD.
  const _tn = normalizeName(name);
  const _tt = new Set(_tn.split(' ').filter(Boolean));
  const viable = candidates.filter((c) => {
    const cn = normalizeName(candidateName(c));
    if (!cn) return false;
    if (cn === _tn) return true;
    const ct = new Set(cn.split(' ').filter(Boolean));
    let allIn = _tt.size > 0;
    _tt.forEach((tok) => { if (!ct.has(tok)) allIn = false; });
    if (allIn) return true;
    return nameSimilarity(name, candidateName(c)) >= NAME_SIMILARITY_THRESHOLD;
  });
  if (!viable.length) return null;

  viable.sort((a, b) => {
    // 1. exact normalized-name equality ranks above partial
    const aExact = normalizeName(candidateName(a)) === targetNorm ? 1 : 0;
    const bExact = normalizeName(candidateName(b)) === targetNorm ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;

    // 2. smallest absolute year difference (only when a year is known)
    if (year) {
      const ay = candidateYear(a);
      const by = candidateYear(b);
      const ad = ay == null ? Infinity : Math.abs(ay - year);
      const bd = by == null ? Infinity : Math.abs(by - year);
      if (ad !== bd) return ad - bd;
    }

    // 3. popularity desc tie-break for stability
    return (b.popularity || 0) - (a.popularity || 0);
  });

  const best = viable[0];
  return { id: best.id, media_type: best.media_type };
}

/* ═══════════════════════════════════════════════════════════════
 * TASK 2.2 — Provider fetch, catalog load, toCacheEntry
 * ═══════════════════════════════════════════════════════════════ */

/* fetchWatchProviders(mediaType, tmdbId)
 *   GET /{movie|tv}/{tmdbId}/watch/providers                          (R2.1)
 *   `results` is keyed by region; each region exposes flatrate[],
 *   rent[], buy[]. We read flatrate[] ONLY (R2.2). A region with no
 *   entry simply yields [] downstream (no crash). */
async function fetchWatchProviders(mediaType, tmdbId) {
  const params = new URLSearchParams({ api_key: process.env.TMDB_API_KEY });
  const url = `${TMDB_BASE}/${mediaType}/${tmdbId}/watch/providers?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB watch/providers HTTP ${res.status}`);
  return res.json();   // { id, results: { IN: { flatrate:[], rent:[], buy:[] }, ... } }
}

/* TMDB provider_name -> our platforms catalog `name`. Normalized keys
 * (lowercased) so look-ups are forgiving of TMDB's exact casing. */
const PROVIDER_TO_CATALOG = {
  'netflix': 'Netflix',
  'amazon prime video': 'Prime Video',
  'amazon video': 'Prime Video',
  'disney plus hotstar': 'JioHotstar',
  'jiohotstar': 'JioHotstar',
  'jiocinema': 'JioHotstar',
  'disney plus': 'Disney+',
  'apple tv plus': 'Apple TV+',
  'apple tv+': 'Apple TV+',
  'sonyliv': 'SonyLIV',
  'hbo max': 'HBO Max',
  'max': 'HBO Max',
  'zee5': 'Zee5',
  'hulu': 'Hulu'
};

/* Catalog index, loaded once at startup via loadCatalog(): lowercased
 * catalog name -> { id, name, color, abbr }. */
let catalogByName = {};

async function loadCatalog() {
  const { data, error } = await db.from('platforms')
    .select('id,name,color,abbr')
    .is('deleted_at', null);
  if (error) throw new Error('loadCatalog failed: ' + error.message);
  catalogByName = {};
  (data || []).forEach((row) => {
    if (row && row.name) catalogByName[String(row.name).toLowerCase()] = row;
  });
  return catalogByName;
}

/* toCacheEntry(p) — p is a single TMDB flatrate provider object.
 * Produces a Provider_Cache_Entry: the four required canonical fields
 * are ALWAYS present (R2.3); catalog enrichment is additive and null
 * when no catalog match exists (R11.1 / R11.2). logo_path is stored
 * verbatim, NEVER fetched (image.tmdb.org is blocked in India). */
function toCacheEntry(p) {
  const canonical = PROVIDER_TO_CATALOG[String(p.provider_name || '').trim().toLowerCase()] || null;
  const cat = canonical ? catalogByName[canonical.toLowerCase()] : null;
  return {
    // ── canonical TMDB fields (satisfies R2.3 shape exactly) ──
    provider_name: p.provider_name,
    provider_id:   p.provider_id,
    logo_path:     p.logo_path || null,   // stored, not fetched (India block)
    type:          'flatrate',
    // ── catalog enrichment (additive; powers R5 + R11 without a 2nd query) ──
    platform_id:   cat ? cat.id    : null,  // nullable — reconciles with user_subscriptions
    catalog_name:  cat ? cat.name  : null,
    color:         cat ? cat.color : null,   // null -> frontend uses neutral default
    abbr:          cat ? cat.abbr  : null
  };
}

/* ═══════════════════════════════════════════════════════════════
 * TASK 2.3 — main loop: link -> fetch -> map -> write, with
 *            per-title resilience, tally, and summary
 * ═══════════════════════════════════════════════════════════════ */

function printSummary(tally) {
  console.log('\n── Ingest summary ─────────────────────────────');
  console.log(`  matched   : ${tally.matched}`);    // titles newly linked to TMDB
  console.log(`  unmatched : ${tally.unmatched}`);  // searched but no qualifying match
  console.log(`  skipped   : ${tally.skipped}`);    // already linked, not --force
  console.log(`  failed    : ${tally.failed}`);     // errored mid-title (caught, continued)
  console.log(`  updated   : ${tally.updated}`);    // rows written to titles
  console.log('───────────────────────────────────────────────\n');
}

async function main() {
  const force = process.argv.includes('--force');
  await loadCatalog();                               // load platforms catalog once
  const titles = await selectTitles(force);
  console.log(`ingest-tmdb: ${titles.length} title(s) selected${force ? ' (--force)' : ''}.`);

  const tally = { matched: 0, unmatched: 0, failed: 0, updated: 0, skipped: 0 };

  for (const t of titles) {
    try {
      // 1. LINK — skip when already linked and not forced (R1.4)
      let tmdbId = t.tmdb_id;
      let mediaType = t.meta && t.meta.media_type;
      if (force || !tmdbId) {
        const match = await searchTmdb(t.name, t.year);   // R1.3
        if (!match) { tally.unmatched++; continue; }       // R1.6 — leave tmdb_id unchanged
        tmdbId = match.id;
        mediaType = match.media_type;
        tally.matched++;
      } else {
        tally.skipped++;
      }

      // 2. PROVIDERS per region (R2.1)
      const raw = await fetchWatchProviders(mediaType, tmdbId);
      const providers = {};
      for (const region of REGIONS) {
        const flatrate = (raw.results && raw.results[region] && raw.results[region].flatrate) || [];
        providers[region] = flatrate.map(toCacheEntry);    // R2.2 flatrate ONLY + R2.3 shape
      }

      // 3. WRITE (R1.3 tmdb_id, R2.3 providers, R2.4 cached_at)
      const { error } = await db.from('titles').update({
        tmdb_id: tmdbId,
        providers,
        cached_at: new Date().toISOString(),
        meta: { ...(t.meta || {}), media_type: mediaType }
      }).eq('id', t.id);
      if (error) throw new Error('update failed: ' + error.message);
      tally.updated++;
      console.log(`✓ ${t.name} -> tmdb_id ${tmdbId} (${mediaType || '?'})`);
    } catch (err) {
      tally.failed++;                                  // R3.3 — record + keep going
      console.error(`✗ ${t.name}: ${err.message}`);
    }
    await sleep(TMDB_DELAY_MS);                         // polite pacing between titles
  }

  printSummary(tally);                                 // R3.4
  return tally;
}

/* Run when invoked directly (not when require()'d for testing). */
if (require.main === module) {
  main().catch((err) => {
    console.error('✗ ingest-tmdb fatal:', err && err.message ? err.message : err);
    process.exit(1);
  });
}

module.exports = {
  selectTitles, searchTmdb, normalizeName, nameSimilarity,
  fetchWatchProviders, toCacheEntry, PROVIDER_TO_CATALOG, loadCatalog,
  main, REGIONS, TMDB_DELAY_MS
};
