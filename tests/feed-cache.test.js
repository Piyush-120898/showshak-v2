/* ═══════════════════════════════════════════════════════════════
   tests/feed-cache.test.js — Node property tests for the per-user feed
   cache + bounded video warming (run: node tests/feed-cache.test.js).
   No framework; exits non-zero on failure (mirrors pure-helpers.test.js).

   showshak-shared.js runs DOM setup at load, so we install a small DOM/window
   stub BEFORE requiring it — but unlike pure-helpers, we give window a REAL
   in-memory localStorage and counting fetch/Image stubs so the cache + warming
   behaviour is observable.

   Properties:
     C1 — write→read round-trips the clips and caps at SS_FEED_CACHE_MAX
     C2 — read returns null on version mismatch / corrupt / empty payload
     C3 — the cache is keyed per user (different user id → different bucket)
     C4 — ssFeedListChanged: false iff the first window matches by id+order
     C5 — ssWarmClips bounded to N and de-duped per playback id; never throws
═══════════════════════════════════════════════════════════════ */
'use strict';

const noop = () => {};

/* In-memory localStorage so cache read/write are real. */
function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
    _map: m,
  };
}

/* Counting fetch + Image so warming behaviour is observable. */
let _fetchCalls = [];
let _imageSrcs = [];
global.fetch = (url) => { _fetchCalls.push(url); return Promise.resolve({ ok: true }); };
global.Image = class { set src(v) { _imageSrcs.push(v); } };

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

let _user = null;  // mutable so we can test per-user keying
global.window = {
  addEventListener: noop, removeEventListener: noop,
  location: { pathname: '/' }, navigator: { userAgent: '' },
  matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
  requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
  localStorage: memStorage(),
  sessionStorage: memStorage(),
  ssCurrentUser: () => _user,
};
global.document = {
  body: elementStub(), head: elementStub(), documentElement: elementStub(),
  addEventListener: noop, removeEventListener: noop,
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createElement: () => elementStub(), createElementNS: () => elementStub(),
};
global.window.performance = global.performance;
// _ssSegPrefetchOn()/_ssFeatureOff() read the BARE `localStorage` global (as in a
// browser page), so mirror window.localStorage onto it for the gate to resolve.
global.localStorage = global.window.localStorage;
global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
global.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return []; } };

require('../showshak-shared.js');
const W = global.window;
// shared.js installs its own window.ssCurrentUser at load, so override it AFTER
// require so the cache key reflects our test user.
W.ssCurrentUser = () => _user;

/* ── tiny runner ── */
let failures = 0;
function check(name, fn) {
  try { fn(); console.log('  \u2713 ' + name); }
  catch (e) { failures++; console.log('  \u2717 ' + name + '\n      ' + e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function rint(n) { return Math.floor(Math.random() * n); }
function makeClips(n) {
  return Array.from({ length: n }, (_, i) => ({ id: 'id-' + i + '-' + rint(1e6), muxPlaybackId: 'pb-' + i, poster: 'https://image.mux.com/pb-' + i + '/thumbnail.jpg' }));
}

console.log('Feature: feed cache + warming property tests\n');

check('C1: write then read round-trips clips, capped at SS_FEED_CACHE_MAX', () => {
  for (let it = 0; it < 200; it++) {
    _user = { id: 'u' + rint(5) };
    W.localStorage.clear();
    const n = 1 + rint(40);
    const clips = makeClips(n);
    W.ssWriteFeedCache(clips);
    const got = W.ssReadFeedCache();
    assert(got && Array.isArray(got.clips), 'expected a cache hit');
    assert(got.clips.length === Math.min(n, W.SS_FEED_CACHE_MAX), 'expected cap at ' + W.SS_FEED_CACHE_MAX + ', got ' + got.clips.length);
    for (let i = 0; i < got.clips.length; i++) assert(got.clips[i].id === clips[i].id, 'clip order/id mismatch');
    assert(typeof got.ageMs === 'number' && got.ageMs >= 0, 'ageMs should be a non-negative number');
  }
});

check('C2: read returns null on version mismatch / corrupt / empty', () => {
  _user = { id: 'uX' };
  // corrupt JSON
  W.localStorage.setItem('ss_feed_cache_v1_uX', '{not json');
  assert(W.ssReadFeedCache() === null, 'corrupt payload should be null');
  // wrong version
  W.localStorage.setItem('ss_feed_cache_v1_uX', JSON.stringify({ v: 999, ts: Date.now(), clips: makeClips(3) }));
  assert(W.ssReadFeedCache() === null, 'version mismatch should be null');
  // empty clips
  W.localStorage.setItem('ss_feed_cache_v1_uX', JSON.stringify({ v: 1, ts: Date.now(), clips: [] }));
  assert(W.ssReadFeedCache() === null, 'empty clips should be null');
});

check('C3: cache is keyed per user (no cross-user bleed)', () => {
  W.localStorage.clear();
  _user = { id: 'alice' }; W.ssWriteFeedCache(makeClips(4));
  _user = { id: 'bob' };
  assert(W.ssReadFeedCache() === null, 'bob must not see alice\'s cache');
  W.ssWriteFeedCache(makeClips(2));
  assert(W.ssReadFeedCache().clips.length === 2, 'bob sees his own 2');
  _user = { id: 'alice' };
  assert(W.ssReadFeedCache().clips.length === 4, 'alice still sees her 4');
  _user = null; // guest bucket is separate
  assert(W.ssReadFeedCache() === null, 'guest has its own (empty) bucket');
});

check('C4: ssFeedListChanged false iff first window matches by id+order', () => {
  for (let it = 0; it < 200; it++) {
    const a = makeClips(1 + rint(40));
    const b = a.map((c) => ({ id: c.id }));          // same ids/order
    assert(W.ssFeedListChanged(a, b) === false, 'identical first window should be unchanged');
    if (b.length > 1) {                               // swap two → changed
      const swapped = b.slice(); const t = swapped[0]; swapped[0] = swapped[1]; swapped[1] = t;
      assert(W.ssFeedListChanged(a, swapped) === true, 'reordered window should be changed');
    }
    const CAP = W.SS_FEED_CACHE_MAX;
    assert(W.ssFeedListChanged(a, b.concat([{ id: 'extra' }])) === (Math.min(a.length, CAP) !== Math.min(b.length + 1, CAP)), 'length-diff detection');
  }
});

check('C5: ssWarmClips bounded to N, de-duped per playback id, never throws', () => {
  // The first-segment prefetch is gated on the SW Segment_Cache being opt-in
  // (ss_ff_segcache='on'); enable it here so the prefetch path is exercised.
  W.localStorage.setItem('ss_ff_segcache', 'on');
  _fetchCalls = []; _imageSrcs = [];
  const clips = makeClips(8);
  W.ssWarmClips(clips, 2);          // warm first 2
  assert(_fetchCalls.length === 2, 'should warm exactly 2 manifests, got ' + _fetchCalls.length);
  W.ssWarmClips(clips, 2);          // same again → de-duped (no new fetches)
  assert(_fetchCalls.length === 2, 'repeat warm must be de-duped, got ' + _fetchCalls.length);
  W.ssWarmClips(clips, 4);          // extend by 2 more
  assert(_fetchCalls.length === 4, 'extending should add 2 more, got ' + _fetchCalls.length);
  // never throws on missing/empty
  W.ssWarmClips(null, 3); W.ssWarmClips([], 3); W.ssWarmClips([{ id: 'x' }], 3);
  assert(_fetchCalls.length === 4, 'clips without playback ids add no fetches');
  W.localStorage.removeItem('ss_ff_segcache');
});

check('C6: ssWarmClips does NOT prefetch video when the SW cache is off (default)', () => {
  // Default (no ss_ff_segcache flag): the first-segment prefetch is gated OFF so
  // it never competes with the active clip for the stream.mux.com connection
  // pool. Posters still warm (cheap, different host); zero stream fetches.
  W.localStorage.removeItem('ss_ff_segcache');
  _fetchCalls = []; _imageSrcs = [];
  const clips = makeClips(6).map((c, i) => ({ ...c, muxPlaybackId: 'off-' + i }));  // fresh pids (avoid _ssWarmed dedup from C5)
  W.ssWarmClips(clips, 4);
  assert(_fetchCalls.length === 0, 'gated off → no stream.mux.com prefetch, got ' + _fetchCalls.length);
  assert(_imageSrcs.length > 0, 'posters should still warm when the prefetch is gated off');
});

console.log('\n' + (failures ? `FAILED (${failures})` : 'ALL PASSED'));
process.exit(failures ? 1 : 0);
