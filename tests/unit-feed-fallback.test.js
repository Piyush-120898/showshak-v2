// Feature: feed-follows — unit: fallback / kill-switch control flow
/* ═══════════════════════════════════════════════════════════════
   tests/unit-feed-fallback.test.js — Node example/unit tests for the feed-follows
   Phase 2 ssLoadClips orchestration in showshak-shared.js. Plain Node (no
   framework, no fast-check); auto-discovered by `node tests/run-all.js`.

   These tests exercise the IMPURE shell (ssLoadClips + _ssEnsureFeedSession +
   _ssFeedFallbackPage) with a STUBBED window.ssDB, mirroring the harness
   convention of tests/unit-recorder-fire-and-forget.test.js: install the
   DOM/window stub BEFORE require('../showshak-shared.js'), then bind
   window.ssDB / window.ssCurrentUser via getters AFTER require so the wrappers
   read our test-controlled values at call time.

   The ssDB stub is a chainable Supabase query builder that records, per query,
   the table, the select() string, and the ordered chain of methods + args, and
   is a thenable whose resolution is configured per test. It classifies each
   query by shape:
     • candidate  : content + .limit()           (public-signals-only)
     • hydration  : content + .in('id', …)        (rich rehydrate of a page)
     • fallback   : content + .range()            (today's flat newest-first feed)
     • follows    : follows                        (_ssFollowedCreatorIds)

   FALLBACK / KILL-SWITCH behaviours under test (Req 8.1, 8.2, 8.6, 8.7):
     1. Candidate query error            ⇒ ssLoadClips serves the flat fallback page.
     2. ss_ff_ranker='off' (kill switch) ⇒ fallback WITHOUT building a candidate query.
     3. Candidate ok + hydration error   ⇒ ssLoadClips serves the fallback page.
     4. Fallback query itself errors      ⇒ ssLoadClips returns [] (no throw).
═══════════════════════════════════════════════════════════════ */
'use strict';

const noop = () => {};

/* ── DOM/window stub installed BEFORE requiring showshak-shared.js ── */
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

/* A REAL localStorage map (not a no-op): the kill switch reads
   localStorage.getItem('ss_ff_ranker') and seen-state reads ss_seen_v1_<key>, so
   the store must actually round-trip values. */
function makeStore() {
  const map = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null),
    setItem: (k, v) => { map[k] = String(v); },
    removeItem: (k) => { delete map[k]; },
    clear: () => { for (const k in map) delete map[k]; },
    _map: map,
  };
}
const localStore = makeStore();

let _user = null;   // mutable: signed-in user object or null (guest)
let _db = null;     // mutable: current ssDB stub

global.window = {
  addEventListener: noop, removeEventListener: noop,
  location: { pathname: '/' }, navigator: { userAgent: '' },
  matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
  requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
  localStorage: localStore, sessionStorage: makeStore(),
};
global.localStorage = localStore;   // ssLoadClips reads the GLOBAL localStorage for the kill switch
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

/* ── chainable Supabase query stub ──────────────────────────────────────────
   Every chained method returns the same builder and records its call + args; the
   builder is a thenable whose resolution is decided by `opts[kind]` (an object
   { data, error }, a function(rec)=>result, or the string 'throw'). */
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
    const rec = { table: table, select: null, calls: [], args: {}, kind: null, inserted: null };
    db._queries.push(rec);
    const b = {
      select(s) { rec.select = s; rec.calls.push('select'); return b; },
      eq(col, val) { rec.calls.push('eq'); (rec.args.eq = rec.args.eq || []).push([col, val]); return b; },
      is(col, val) { rec.calls.push('is'); (rec.args.is = rec.args.is || []).push([col, val]); return b; },
      in(col, vals) { rec.calls.push('in'); rec.args.in = [col, vals]; return b; },
      order(col, o) { rec.calls.push('order'); rec.args.order = [col, o]; return b; },
      limit(n) { rec.calls.push('limit'); rec.args.limit = n; return b; },
      range(a, z) { rec.calls.push('range'); rec.args.range = [a, z]; return b; },
      insert(p) { rec.calls.push('insert'); rec.inserted = p; return Promise.resolve({ data: [p], error: null }); },
      then(onF, onR) {
        rec.kind = classify(rec);
        let res;
        try { res = resultFor(rec); }
        catch (e) { return Promise.reject(e).then(onF, onR); }
        return Promise.resolve(res).then(onF, onR);
      },
    };
    return b;
  };
  db.kinds = () => db._queries.map((q) => q.kind);
  db.ofKind = (k) => db._queries.filter((q) => q.kind === k);
  return db;
}

const NOW = Date.now();
/* Production-faithful candidate row: ONLY the 5 selected public-signal columns
   (exactly what the candidate `.select('id, creator_id, created_at,
   fires_count, views_count')` returns from PostgREST — no status/deleted_at). */
function candRow(id, o) {
  o = o || {};
  return {
    id: id, creator_id: o.creator_id || ('cr_' + id),
    created_at: o.created_at != null ? o.created_at : (NOW - 1000),
    fires_count: o.fires_count || 0, views_count: o.views_count || 0,
  };
}
/* Rich content row as the hydration / fallback rich select returns it (live). */
function richRow(id, o) {
  o = o || {};
  return {
    id: id, description: o.description || ('caption ' + id),
    fires_count: o.fires_count || 0, views_count: o.views_count || 0,
    meta: o.meta || {}, status: 'live', deleted_at: null,
    mux_playback_id: o.mux_playback_id || null, url: o.url || null,
    thumbnail_url: o.thumbnail_url || null, duration_sec: o.duration_sec || null,
    creator: { username: 'user_' + id, name: 'Name', avatar_url: null },
    title: { name: 'Title', year: 2021, synopsis: 'syn', providers: {}, cached_at: null },
    platform: { id: 1, name: 'Netflix', color: '#E50914', abbr: 'N' },
  };
}

/* ── tiny async runner (mirrors the suite's no-framework convention) ── */
let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log('  \u2713 ' + name); }
  catch (e) { failures++; console.log('  \u2717 ' + name + '\n      ' + (e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function ids(clips) { return clips.map((c) => c.id); }

/* Reset module-level feed-session caching between cases by using a NEW viewer id
   (a different viewerKey forces _ssEnsureFeedSession to rebuild) and clearing the
   feature-flag / seen-state store. */
let _vseq = 0;
function freshViewer() { _vseq++; localStore.clear(); _user = { id: 'viewer_' + _vseq }; }

(async function run() {
  console.log('Feature: feed-follows — fallback / kill-switch control-flow unit tests\n');

  // 1. Candidate query returns an error ⇒ ssLoadClips serves the flat fallback
  //    page: it maps the flat status='live'/deleted_at null/created_at desc/.range
  //    rows via ssMapContentRowsToClips and returns those clips (Req 8.1, 8.6).
  await check('1: candidate-query error ⇒ serves the flat fallback page (Req 8.1, 8.6)', async () => {
    freshViewer();
    const fbRows = [richRow('f1'), richRow('f2'), richRow('f3')];
    _db = makeDb({
      candidate: { data: null, error: { message: 'candidate boom' } },
      follows: { data: [], error: null },
      fallback: { data: fbRows, error: null },
    });
    const clips = await W.ssLoadClips(10, 0);

    const candQ = _db.ofKind('candidate');
    const fbQ = _db.ofKind('fallback');
    assert(candQ.length === 1, 'expected the candidate query to be attempted, got ' + candQ.length);
    assert(fbQ.length === 1, 'expected exactly one flat fallback query, got ' + fbQ.length);
    // Fallback issued the flat newest-first shape: live + non-deleted + created_at desc + range.
    const fb = fbQ[0];
    assert(fb.args.range && fb.args.range[0] === 0 && fb.args.range[1] === 9,
      'fallback must use .range(offset, offset+limit-1)=(0,9), got ' + JSON.stringify(fb.args.range));
    assert(fb.args.order && fb.args.order[0] === 'created_at' && fb.args.order[1] && fb.args.order[1].ascending === false,
      'fallback must order by created_at desc');
    const eqCols = (fb.args.eq || []).map((p) => p[0] + '=' + p[1]);
    assert(eqCols.indexOf('status=live') !== -1, 'fallback must filter status=live');
    const isCols = (fb.args.is || []).map((p) => p[0]);
    assert(isCols.indexOf('deleted_at') !== -1, 'fallback must filter deleted_at IS NULL');
    // Returns the mapped fallback clips (Req 8.6).
    const expected = W.ssMapContentRowsToClips(fbRows);
    assert(clips.length === expected.length, 'expected ' + expected.length + ' fallback clips, got ' + clips.length);
    assert(JSON.stringify(ids(clips)) === JSON.stringify(ids(expected)),
      'fallback clip ids mismatch: ' + JSON.stringify(ids(clips)));
  });

  // 2. ss_ff_ranker='off' (kill switch) ⇒ fallback served WITHOUT ever building a
  //    candidate query (the ranker session is never constructed).
  await check('2: ss_ff_ranker=off ⇒ fallback without any candidate query (kill switch)', async () => {
    freshViewer();
    localStore.setItem('ss_ff_ranker', 'off');
    const fbRows = [richRow('k1'), richRow('k2')];
    _db = makeDb({
      candidate: { data: [candRow('a'), candRow('b')], error: null },  // must NOT be used
      follows: { data: [], error: null },
      fallback: { data: fbRows, error: null },
    });
    const clips = await W.ssLoadClips(8, 0);

    assert(_db.ofKind('candidate').length === 0, 'kill switch must NOT issue a candidate query');
    assert(_db.ofKind('fallback').length === 1, 'kill switch must serve the flat fallback (.range) query');
    const expected = W.ssMapContentRowsToClips(fbRows);
    assert(JSON.stringify(ids(clips)) === JSON.stringify(ids(expected)),
      'kill-switch fallback clip ids mismatch: ' + JSON.stringify(ids(clips)));
  });

  // 3. Candidate query succeeds but the HYDRATION query returns an error ⇒
  //    ssLoadClips degrades to the flat fallback page (Req 8.2).
  await check('3: candidate ok + hydration error ⇒ serves the fallback page (Req 8.2)', async () => {
    freshViewer();
    const cand = [candRow('a'), candRow('b'), candRow('c')];
    const fbRows = [richRow('f1'), richRow('f2')];
    _db = makeDb({
      candidate: { data: cand, error: null },
      follows: { data: [], error: null },
      hydration: { data: null, error: { message: 'hydration boom' } },
      fallback: { data: fbRows, error: null },
    });
    const clips = await W.ssLoadClips(10, 0);

    assert(_db.ofKind('candidate').length === 1, 'expected a candidate query');
    assert(_db.ofKind('hydration').length === 1,
      'expected a hydration query to be attempted (ranker must produce a page from live candidates); got '
      + _db.ofKind('hydration').length + ' — queries: ' + JSON.stringify(_db.kinds()));
    assert(_db.ofKind('fallback').length === 1, 'hydration error must fall back to the flat feed');
    const expected = W.ssMapContentRowsToClips(fbRows);
    assert(JSON.stringify(ids(clips)) === JSON.stringify(ids(expected)),
      'post-hydration-error fallback clip ids mismatch: ' + JSON.stringify(ids(clips)));
  });

  // 4. The fallback query ITSELF errors ⇒ ssLoadClips returns [] (empty page),
  //    no throw (Req 8.7). Triggered here via a candidate error → fallback → error.
  await check('4: fallback query error ⇒ empty page, no throw (Req 8.7)', async () => {
    freshViewer();
    _db = makeDb({
      candidate: { data: null, error: { message: 'candidate boom' } },
      follows: { data: [], error: null },
      fallback: { data: null, error: { message: 'fallback boom' } },
    });
    let clips, threw = false;
    try { clips = await W.ssLoadClips(10, 0); } catch (e) { threw = true; }
    assert(!threw, 'ssLoadClips must not throw when the fallback query errors');
    assert(Array.isArray(clips) && clips.length === 0, 'expected an empty page [], got ' + JSON.stringify(clips));
  });

  console.log('\n' + (failures ? `FAILED (${failures})` : 'ALL PASSED'));
  process.exitCode = failures ? 1 : 0;
})();
