// Feature: feed-follows — unit: clip-shape parity + session-cache reuse
/* ═══════════════════════════════════════════════════════════════
   tests/unit-feed-shape-cache.test.js — Node example/unit tests for the
   feed-follows Phase 2 ssLoadClips orchestration in showshak-shared.js. Plain
   Node (no framework, no fast-check); auto-discovered by `node tests/run-all.js`.

   Two guarantees of the ranker-ON happy path (Req 6.3, 6.4, 7.3):

   • CLIP-SHAPE PARITY (Req 7.3): with the ranker on and a successful candidate +
     hydration, ssLoadClips returns clips whose FIELD SET is identical to the
     pre-ranker feed clip shape produced by ssMapContentRowsToClips for the same
     row — the ranker path adds/removes no field.

   • SESSION-CACHE REUSE (Req 6.3, 6.4): with the SAME viewer id, two consecutive
     page requests (n,0) then (n,n) build the candidate/ranked list ONCE (a single
     candidate query across both calls) and hydrate per page, and the two pages are
     contiguous, non-overlapping slices of one ranked order (no duplicate ids) —
     Tier 5 is not reshuffled between pages.

   Harness mirrors tests/unit-recorder-fire-and-forget.test.js.
═══════════════════════════════════════════════════════════════ */
'use strict';

const noop = () => {};

function elementStub() {
  return {
    style: {}, dataset: {},
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    setAttribute: noop, getAttribute: () => null, removeAttribute: noop,
    appendChild: noop, removeChild: noop, remove: noop, insertBefore: noop,
    addEventListener: noop, removeEventListener: noop,
    querySelector: () => elementStub(), querySelectorAll: () => [],
    insertAdjacentHTML: noop, append: noop, prepend: noop,
    focus: noop, blur: noop, click: noop, play: () => Promise.resolve(), pause: noop,
  };
}
function makeStore() {
  const map = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null),
    setItem: (k, v) => { map[k] = String(v); }, removeItem: (k) => { delete map[k]; },
    clear: () => { for (const k in map) delete map[k]; }, _map: map,
  };
}
const localStore = makeStore();

let _user = null, _db = null;

global.window = {
  addEventListener: noop, removeEventListener: noop,
  location: { pathname: '/' }, navigator: { userAgent: '' },
  matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
  requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
  localStorage: localStore, sessionStorage: makeStore(),
};
global.localStorage = localStore;
global.document = {
  body: elementStub(), head: elementStub(), documentElement: elementStub(),
  addEventListener: noop, removeEventListener: noop,
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createElement: () => elementStub(), createElementNS: () => elementStub(),
};
global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
global.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return []; } };

require('../showshak-shared.js');
const W = global.window;
Object.defineProperty(W, 'ssDB', { configurable: true, get: () => _db });
W.ssCurrentUser = () => _user;

function makeDb(opts) {
  opts = opts || {};
  const db = { _queries: [] };
  function classify(rec) {
    if (rec.table === 'follows') return 'follows';
    if (rec.table === 'view_events') return 'view_events';
    if (rec.calls.indexOf('in') !== -1) return 'hydration';
    if (rec.calls.indexOf('range') !== -1) return 'fallback';
    if (rec.calls.indexOf('limit') !== -1) return 'candidate';
    return 'unknown';
  }
  function resultFor(rec) {
    let spec = opts[rec.kind];
    if (spec === undefined) spec = { data: [], error: null };
    if (typeof spec === 'function') spec = spec(rec);
    if (spec === 'throw') throw new Error('stub query throw: ' + rec.kind);
    return spec;
  }
  db.from = function (table) {
    const rec = { table: table, select: null, calls: [], args: {}, kind: null };
    db._queries.push(rec);
    const b = {
      select(s) { rec.select = s; rec.calls.push('select'); return b; },
      eq(c, v) { rec.calls.push('eq'); (rec.args.eq = rec.args.eq || []).push([c, v]); return b; },
      is(c, v) { rec.calls.push('is'); (rec.args.is = rec.args.is || []).push([c, v]); return b; },
      in(c, v) { rec.calls.push('in'); rec.args.in = [c, v]; return b; },
      order(c, o) { rec.calls.push('order'); rec.args.order = [c, o]; return b; },
      limit(n) { rec.calls.push('limit'); rec.args.limit = n; return b; },
      range(a, z) { rec.calls.push('range'); rec.args.range = [a, z]; return b; },
      insert(p) { rec.calls.push('insert'); return Promise.resolve({ data: [p], error: null }); },
      then(onF, onR) {
        rec.kind = classify(rec);
        let res;
        try { res = resultFor(rec); } catch (e) { return Promise.reject(e).then(onF, onR); }
        return Promise.resolve(res).then(onF, onR);
      },
    };
    return b;
  };
  db.ofKind = (k) => db._queries.filter((q) => q.kind === k);
  return db;
}

const NOW = Date.now();
function candRow(id, o) {
  o = o || {};
  return {
    id: id, creator_id: o.creator_id || ('cr_' + id),
    created_at: o.created_at != null ? o.created_at : (NOW - 1000),
    fires_count: o.fires_count || 0, views_count: o.views_count || 0,
  };
}
function richRow(id, o) {
  o = o || {};
  return {
    id: id, description: o.description || ('cap ' + id),
    fires_count: o.fires_count || 0, views_count: o.views_count || 0, meta: o.meta || {},
    status: 'live', deleted_at: null, mux_playback_id: o.mux_playback_id || null,
    url: o.url || null, thumbnail_url: o.thumbnail_url || null, duration_sec: o.duration_sec || null,
    creator: { username: 'u_' + id, name: 'N', avatar_url: null },
    title: { name: 'T', year: 2021, synopsis: 's', providers: {}, cached_at: null },
    platform: { id: 1, name: 'Netflix', color: '#E50914', abbr: 'N' },
  };
}

let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log('  \u2713 ' + name); }
  catch (e) { failures++; console.log('  \u2717 ' + name + '\n      ' + (e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function keysOf(o) { return Object.keys(o).sort(); }

(async function run() {
  console.log('Feature: feed-follows — clip-shape parity + session-cache reuse\n');

  // CLIP-SHAPE PARITY (Req 7.3): the ranker path returns clips with EXACTLY the
  // same field set the pre-ranker ssMapContentRowsToClips produces for that row.
  await check('clip-shape parity: ranker-path clip field set == ssMapContentRowsToClips shape (Req 7.3)', async () => {
    _user = { id: 'viewer_shape_1' };
    localStore.clear();
    const cand = [candRow('a', { fires_count: 9, views_count: 3 }), candRow('b'), candRow('c')];
    _db = makeDb({
      candidate: { data: cand, error: null },
      follows: { data: [], error: null },
      hydration: (rec) => ({ data: (rec.args.in && rec.args.in[1] || []).map((id) => richRow(id)), error: null }),
      fallback: { data: cand.map((r) => richRow(r.id)), error: null },
    });

    const clips = await W.ssLoadClips(10, 0);
    assert(clips.length > 0,
      'ranker-ON ssLoadClips returned an empty page for live candidates — the feed must surface clips (Req 7.3)');

    // The canonical pre-ranker shape for a single hydrated row.
    const refClip = W.ssMapContentRowsToClips([richRow('a')])[0];
    const refKeys = keysOf(refClip);
    clips.forEach(function (c) {
      assert(JSON.stringify(keysOf(c)) === JSON.stringify(refKeys),
        'clip field set differs from the pre-ranker shape.\n        ranker : ' + JSON.stringify(keysOf(c))
        + '\n        expected: ' + JSON.stringify(refKeys));
    });
  });

  // SESSION-CACHE REUSE (Req 6.3, 6.4): same viewer, two consecutive pages reuse a
  // single ranked list — one candidate query total, hydrate per page, contiguous
  // non-overlapping slices (no duplicate ids → Tier 5 not reshuffled).
  await check('session-cache reuse: 2 pages → 1 candidate query, per-page hydration, no overlap (Req 6.3, 6.4)', async () => {
    _user = { id: 'viewer_cache_1' };      // SAME viewer across both calls
    localStore.clear();
    // 6 live candidates so two pages of 3 are both non-empty.
    const cand = [];
    for (let i = 0; i < 6; i++) cand.push(candRow('c' + i, { created_at: NOW - i * 1000, fires_count: i }));
    _db = makeDb({
      candidate: { data: cand, error: null },
      follows: { data: [], error: null },
      hydration: (rec) => ({ data: (rec.args.in && rec.args.in[1] || []).map((id) => richRow(id)), error: null }),
      fallback: { data: cand.map((r) => richRow(r.id)), error: null },
    });

    const page1 = await W.ssLoadClips(3, 0);
    const page2 = await W.ssLoadClips(3, 3);

    // Exactly ONE candidate query across both page requests (ranked list is cached).
    const candQ = _db.ofKind('candidate');
    assert(candQ.length === 1,
      'expected the candidate/ranked list to be built ONCE across two pages, got ' + candQ.length + ' candidate queries');
    // Hydration runs per page.
    assert(_db.ofKind('hydration').length === 2,
      'expected one hydration query per page (2 total), got ' + _db.ofKind('hydration').length);

    assert(page1.length > 0 && page2.length > 0,
      'both pages must be non-empty over 6 live candidates (page1=' + page1.length + ', page2=' + page2.length + ')');

    // Contiguous, non-overlapping slices of one ranked order: no id appears in both.
    const ids1 = page1.map((c) => c.id);
    const ids2 = page2.map((c) => c.id);
    const set1 = new Set(ids1);
    ids2.forEach(function (id) {
      assert(!set1.has(id), 'pages overlap: id "' + id + '" appears in both pages (ranked list was reshuffled/rebuilt)');
    });
    // No duplicates within the combined two pages.
    const all = ids1.concat(ids2);
    assert(new Set(all).size === all.length, 'duplicate ids across the two pages: ' + JSON.stringify(all));
  });

  console.log('\n' + (failures ? `FAILED (${failures})` : 'ALL PASSED'));
  process.exitCode = failures ? 1 : 0;
})();
