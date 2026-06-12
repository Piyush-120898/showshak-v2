/* ═══════════════════════════════════════════════════════════════
   tests/pure-helpers.test.js — Node property tests for the mux-video-clips
   pure helpers (no framework; run with `node tests/pure-helpers.test.js`).
   Mirrors the data/_verify.js precedent: plain Node, exit non-zero on failure.

   showshak-shared.js is browser code that runs DOM setup at load, so we install
   a tiny no-op DOM/window stub BEFORE requiring it. The functions under test are
   PURE (numbers / plain objects), so the stub never affects their behaviour —
   it only lets the module load and populate module.exports.

   Covers design Correctness Properties:
     Property 1  — loader returns only live, non-deleted clips
     Property 2  — loader maps Mux fields from the correct columns
     Property 4  — getProgress is always a fraction in [0,1]
     Property 5  — seek and getProgress round-trip
     Property 6  — muted state round-trips
     Property 9  — next window fetched exactly once at the threshold
     Property 10 — concurrent mounted players are bounded
═══════════════════════════════════════════════════════════════ */
'use strict';

/* ── Minimal DOM/window stub so showshak-shared.js can load in Node ── */
const noop = () => {};
function elementStub(tag) {
  return {
    tagName: tag ? String(tag).toUpperCase() : 'DIV',
    style: {}, dataset: {},
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    setAttribute: noop, getAttribute: () => null, removeAttribute: noop,
    appendChild: noop, removeChild: noop, remove: noop, insertBefore: noop,
    addEventListener: noop, removeEventListener: noop,
    querySelector: () => elementStub(), querySelectorAll: () => [],
    insertAdjacentHTML: noop, append: noop, prepend: noop,
    focus: noop, blur: noop, click: noop,
    play: () => Promise.resolve(), pause: noop,
  };
}
global.window = {
  addEventListener: noop, removeEventListener: noop,
  location: { pathname: '/' }, navigator: { userAgent: '' },
  matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
  requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
};
global.document = {
  body: elementStub(), head: elementStub(), documentElement: elementStub(),
  addEventListener: noop, removeEventListener: noop,
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createElement: (tag) => elementStub(tag), createElementNS: (ns, tag) => elementStub(tag),
};
// Assign globals defensively — some (navigator/location) are getter-only in
// modern Node, so guard each. The code reads window.* anyway.
function safeGlobal(k, v) { try { global[k] = v; } catch (e) {} }
safeGlobal('localStorage', global.window.localStorage);
safeGlobal('sessionStorage', global.window.sessionStorage);
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = noop;
global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
global.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return []; } };

const ss = require('../showshak-shared.js');

/* ── tiny test runner ── */
const ITER = 200;
let failures = 0;
function check(name, fn) {
  try { fn(); console.log('  \u2713 ' + name); }
  catch (e) { failures++; console.log('  \u2717 ' + name + '\n      ' + e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[randInt(0, arr.length - 1)];

console.log('Feature: mux-video-clips — pure helper property tests\n');

/* ── Property 1 + 2: loader filter + Mux mapping ──
   Feature: mux-video-clips, Property 1 / Property 2 */
check('Property 1+2: loader returns only live/non-deleted rows and maps Mux fields', () => {
  assert(typeof ss.ssMapContentRowsToClips === 'function', 'ssMapContentRowsToClips not exported');
  for (let it = 0; it < ITER; it++) {
    const n = randInt(0, 8);
    const rows = [];
    for (let i = 0; i < n; i++) {
      const status = pick(['draft', 'processing', 'live', 'removed']);
      const deleted = pick([null, null, '2024-01-01T00:00:00Z']);
      const pid = pick([null, 'pbk_' + i, '']);
      const thumb = pick([null, 'https://image.mux.com/' + i + '/thumbnail.jpg', '']);
      rows.push({ id: 'c' + i, status, deleted_at: deleted, mux_playback_id: pid, thumbnail_url: thumb, meta: {}, fires_count: 0 });
    }
    const out = ss.ssMapContentRowsToClips(rows);
    // Property 1: a row survives iff status==='live' && deleted_at==null.
    const expected = rows.filter(r => r.status === 'live' && r.deleted_at == null);
    assert(out.length === expected.length, `len ${out.length} != ${expected.length}`);
    // Property 2: mapping pulls muxPlaybackId/poster from the right columns.
    out.forEach((clip, k) => {
      const src = expected[k];
      assert(clip.muxPlaybackId === (src.mux_playback_id || null), 'muxPlaybackId mismap');
      // poster prefers thumbnail_url; else derives the Mux still-frame from the
      // playback id (cover_time omitted here since meta is empty); null when neither.
      const expPoster = src.thumbnail_url
        || (src.mux_playback_id ? ('https://image.mux.com/' + src.mux_playback_id + '/thumbnail.jpg') : null);
      assert(clip.poster === expPoster, 'poster mismap');
      if (!src.mux_playback_id) assert(!clip.muxPlaybackId, 'no pid → falsy muxPlaybackId');
    });
  }
});

/* ── Property 3: factory selects video iff a playback id is present ──
   Feature: mux-video-clips, Property 3 */
check('Property 3: ssCreateSurface returns VideoSurface iff muxPlaybackId, both satisfy the contract', () => {
  const contract = ['mount','play','pause','setMuted','isMuted','getProgress','seek','onTimeupdate','onEnded','destroy'];
  for (let it = 0; it < ITER; it++) {
    const hasPid = Math.random() < 0.5;
    const clip = { muxPlaybackId: hasPid ? 'pbk_' + it : (Math.random() < 0.5 ? null : ''), bg: '#000',
                   poster: hasPid ? 'https://image.mux.com/x/thumbnail.jpg' : null };
    const surf = ss.ssCreateSurface(clip, { bgClass: 'clip-bg' });
    contract.forEach(m => assert(typeof surf[m] === 'function', 'missing contract method ' + m));
    const cap = { style: {}, _child: null, appendChild(el) { this._child = el; } };
    const el = surf.mount(cap);
    const tag = (el && el.tagName) ? String(el.tagName).toLowerCase() : '';
    if (clip.muxPlaybackId) assert(tag === 'mux-player', 'expected mux-player, got ' + tag);
    else assert(tag === 'div', 'expected gradient div, got ' + tag);
    surf.destroy();
  }
});

/* ── Property 4: getProgress ∈ [0,1] for any input ──
   Feature: mux-video-clips, Property 4 */check('Property 4: ssClipProgress always returns a fraction in [0,1]', () => {
  const weird = [0, -5, NaN, Infinity, -Infinity, undefined, null];
  for (let it = 0; it < ITER; it++) {
    const t = Math.random() < 0.3 ? pick(weird) : (Math.random() * 1000 - 100);
    const d = Math.random() < 0.3 ? pick(weird) : (Math.random() * 1000);
    const p = ss.ssClipProgress(t, d);
    assert(typeof p === 'number' && p >= 0 && p <= 1 && !Number.isNaN(p), `progress out of range: ${p} (t=${t},d=${d})`);
  }
});

/* ── Property 5: seek → getProgress round-trips ──
   Feature: mux-video-clips, Property 5 */
check('Property 5: ssSeekToTime then ssClipProgress recovers the fraction', () => {
  for (let it = 0; it < ITER; it++) {
    const f = Math.random();
    const d = 0.5 + Math.random() * 1000;       // finite duration > 0
    const t = ss.ssSeekToTime(f, d);
    const back = ss.ssClipProgress(t, d);
    assert(Math.abs(back - f) < 1e-9, `round-trip ${back} != ${f}`);
  }
});

/* ── Property 6: mute round-trips ──
   Feature: mux-video-clips, Property 6 */
check('Property 6: ssMuteRoundTrip(media, m) === !!m', () => {
  for (let it = 0; it < ITER; it++) {
    const media = { currentTime: 0, duration: 10, muted: pick([true, false]) };
    const m = pick([true, false, 1, 0, '', 'x', null, undefined]);
    assert(ss.ssMuteRoundTrip(media, m) === !!m, `mute round-trip failed for ${String(m)}`);
  }
});

/* ── Property 9: next-window decision fires once at the +6 leading edge ──
   Feature: mux-video-clips, Property 9 */
check('Property 9: ssShouldFetchNextWindow only at windowStart+6 leading edge, not in-flight', () => {
  const W = ss.SS_CLIP_WINDOW;
  for (let it = 0; it < ITER; it++) {
    const windowStart = randInt(0, 50);
    const total = windowStart + W;                 // latest window fully loaded
    const active = randInt(0, total - 1);
    // In-flight always blocks.
    assert(ss.ssShouldFetchNextWindow(active, windowStart, total, true) === false, 'in-flight must block');
    const got = ss.ssShouldFetchNextWindow(active, windowStart, total, false);
    const expect = active >= windowStart + 6 && active >= total - W && active < total && active >= 0;
    assert(got === expect, `decision ${got} != ${expect} (active=${active},start=${windowStart},total=${total})`);
  }
});

/* ── Property 10: mounted player set is bounded ──
   Feature: mux-video-clips, Property 10 */
check('Property 10: ssMountedPlayerSet size ≤ maxLive and all indices in range', () => {
  for (let it = 0; it < ITER; it++) {
    const total = randInt(0, 60);
    const active = randInt(-1, Math.max(0, total - 1));
    const maxLive = randInt(1, 6);
    const set = ss.ssMountedPlayerSet(active, total, maxLive);
    assert(Array.isArray(set), 'not an array');
    assert(set.length <= maxLive, `size ${set.length} > ${maxLive}`);
    set.forEach(i => assert(i >= 0 && i < total, `index ${i} out of [0,${total})`));
    // active (when valid) must stay mounted.
    if (active >= 0 && active < total) assert(set.indexOf(active) !== -1, 'active not mounted');
  }
});

console.log('\n' + (failures ? `FAILED: ${failures} propert${failures === 1 ? 'y' : 'ies'}` : 'ALL PASSED'));
process.exit(failures ? 1 : 0);
