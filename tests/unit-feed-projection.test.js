// Feature: feed-follows — unit: candidate projection is public-signals-only
/* ═══════════════════════════════════════════════════════════════
   tests/unit-feed-projection.test.js — Node example/unit test for the feed-follows
   Phase 2 candidate query projection in showshak-shared.js. Plain Node (no
   framework, no fast-check); auto-discovered by `node tests/run-all.js`.

   This is the structural guarantee of HIDE THE SCOREBOARD at the data layer
   (Req 3.2, 3.3): the candidate query that feeds the pure ranker must select
   ONLY the five public-signal columns and must never request a private metric
   column. We drive ssLoadClips with the ranker ON and a succeeding candidate
   query, capture the exact select() string passed to the CANDIDATE query (the
   content + .limit() chain, distinguished from the content + .in() hydration
   chain), and assert it is exactly the five public columns.

   Harness mirrors tests/unit-recorder-fire-and-forget.test.js: DOM/window stub
   BEFORE require, window.ssDB / window.ssCurrentUser bound via getters AFTER
   require, stubbed chainable ssDB.
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
function richRow(id) {
  return {
    id: id, description: 'cap ' + id, fires_count: 1, views_count: 2, meta: {},
    status: 'live', deleted_at: null, mux_playback_id: null, url: null,
    thumbnail_url: null, duration_sec: null,
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

/* Columns that MUST NOT leak into the candidate projection (the hidden scoreboard /
   private metrics). Each is checked as a substring of the candidate select string. */
const FORBIDDEN_COLUMNS = ['watch_it_count', 'watch_events', 'reach', 'analytics_daily', 'watch_it'];
const EXPECTED_SELECT = 'id, creator_id, created_at, fires_count, views_count';

(async function run() {
  console.log('Feature: feed-follows — candidate projection is public-signals-only\n');

  await check('candidate select is EXACTLY the 5 public-signal columns (Req 3.3)', async () => {
    _user = { id: 'viewer_proj_1' };
    localStore.clear();
    _db = makeDb({
      candidate: { data: [candRow('a', { fires_count: 5, views_count: 9 }), candRow('b')], error: null },
      follows: { data: [], error: null },
      hydration: (rec) => ({ data: (rec.args.in && rec.args.in[1] || []).map(richRow), error: null }),
      fallback: { data: [richRow('a'), richRow('b')], error: null },
    });

    await W.ssLoadClips(10, 0);

    const candQ = _db.ofKind('candidate');
    assert(candQ.length === 1, 'expected exactly one candidate query, got ' + candQ.length);
    const sel = candQ[0].select;
    assert(typeof sel === 'string', 'candidate query must call .select() with a string');
    assert(sel === EXPECTED_SELECT,
      'candidate select must be EXACTLY "' + EXPECTED_SELECT + '", got "' + sel + '"');
  });

  await check('candidate select contains NO private/scoreboard column (Req 3.2)', async () => {
    _user = { id: 'viewer_proj_2' };
    localStore.clear();
    _db = makeDb({
      candidate: { data: [candRow('a'), candRow('b')], error: null },
      follows: { data: [], error: null },
      hydration: (rec) => ({ data: (rec.args.in && rec.args.in[1] || []).map(richRow), error: null }),
      fallback: { data: [richRow('a')], error: null },
    });

    await W.ssLoadClips(10, 0);

    const candQ = _db.ofKind('candidate');
    assert(candQ.length === 1, 'expected exactly one candidate query, got ' + candQ.length);
    const sel = candQ[0].select || '';
    FORBIDDEN_COLUMNS.forEach(function (col) {
      assert(sel.indexOf(col) === -1,
        'candidate select must NOT mention the private column "' + col + '" — got "' + sel + '"');
    });
    // The 5 public signals are present.
    ['id', 'creator_id', 'created_at', 'fires_count', 'views_count'].forEach(function (col) {
      assert(sel.indexOf(col) !== -1, 'candidate select must include public signal "' + col + '"');
    });
  });

  console.log('\n' + (failures ? `FAILED (${failures})` : 'ALL PASSED'));
  process.exitCode = failures ? 1 : 0;
})();
