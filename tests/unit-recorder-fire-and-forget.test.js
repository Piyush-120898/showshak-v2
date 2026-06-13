// Feature: creator-analytics — unit: recorder fire-and-forget
/* ═══════════════════════════════════════════════════════════════
   tests/unit-recorder-fire-and-forget.test.js — Node example/unit tests for the
   creator-analytics Event_Recorder impure wrappers in showshak-shared.js:
     • ssRecordView   (view_events,  per-session de-dup)
     • ssRecordWatch  (watch_events, NO de-dup / NO self-collapse)
     • ssRecordShare  (share_events)

   These wrappers are browser-only and exposed on `window`. They build a payload
   with the pure helpers and fire-and-forget INSERT via window.ssDB.from(table)
   .insert(payload) WITHOUT awaiting on the caller's path, swallowing rejection
   so playback / Watch It navigation / share are never blocked (design's Error
   Handling section; Req 1.4, 2.5, 3.4, 13.1, 13.2).

   This is a plain example/unit test (NOT a property test — no fast-check). It
   follows the existing harness convention: install the DOM/window stub BEFORE
   requiring showshak-shared.js (the module runs DOM setup at load), and exit
   non-zero on failure so tests/run-all.js detects it.

   The DB stub's .from(table).insert(payload) records every call (table +
   payload) so we can assert what was / wasn't inserted, and is controllable per
   case to resolve OR reject. The inserts are issued SYNCHRONOUSLY (the wrapper
   calls .insert() before returning even though it does not await it), so call
   assertions can run immediately after invoking a wrapper; where a swallowed
   rejection needs to settle, we await a microtask/timer tick.
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

let _user = null;   // mutable: signed-in user object or null (guest)
let _db = null;     // mutable: current ssDB stub (or undefined to simulate missing)

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
  createElement: () => elementStub(), createElementNS: () => elementStub(),
};
global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
global.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return []; } };

require('../showshak-shared.js');
const W = global.window;
// shared.js may install its own window.ssCurrentUser at load; bind ssDB +
// ssCurrentUser to our test-controlled getters AFTER require so the wrappers
// (which read window.* at call time) see our values.
Object.defineProperty(W, 'ssDB', { configurable: true, get: () => _db });
W.ssCurrentUser = () => _user;

/* Track unhandled rejections so we can prove the wrappers swallow insert
   failures internally (no rejection ever escapes the fire-and-forget path). */
let _unhandled = 0;
process.on('unhandledRejection', () => { _unhandled++; });

/* ── DB stub: .from(table).insert(payload) records calls; resolve or reject ── */
function makeDb(mode /* 'resolve' | 'reject' */) {
  const calls = [];                       // [{ table, payload }]
  const db = {
    from(table) {
      return {
        insert(payload) {
          calls.push({ table: table, payload: payload });
          if (mode === 'reject') return Promise.reject(new Error('insert boom'));
          return Promise.resolve({ data: [payload], error: null });
        },
      };
    },
  };
  db._calls = calls;
  return db;
}

/* Distinct, well-formed 36-char uuids (pass _ssIsUuid → recordable). The 8-4-4-4-12
   layout with hex/dash chars matches the recorder's uuid test exactly. */
let _uuidSeq = 0;
function uuid() {
  _uuidSeq++;
  const tail = _uuidSeq.toString(16).padStart(12, '0').slice(-12);
  return '0123abcd-0000-4000-8000-' + tail;   // 8+1+4+1+4+1+4+1+12 = 36 chars
}
const flush = () => new Promise((r) => setTimeout(r, 5));   // let swallowed rejections settle

/* ── tiny async runner (mirrors the suite's no-framework convention) ── */
let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log('  \u2713 ' + name); }
  catch (e) { failures++; console.log('  \u2717 ' + name + '\n      ' + (e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const WRAPPERS = [
  { name: 'ssRecordView',  fn: (id) => W.ssRecordView(id),        table: 'view_events'  },
  { name: 'ssRecordWatch', fn: (id) => W.ssRecordWatch(id, {}),   table: 'watch_events' },
  { name: 'ssRecordShare', fn: (id) => W.ssRecordShare(id),       table: 'share_events' },
];

(async function run() {
  console.log('Feature: creator-analytics — recorder fire-and-forget unit tests\n');

  // 1. Insert REJECTS → each wrapper returns synchronously without throwing, the
  //    caller's flow continues, and the rejection is swallowed internally (no
  //    unhandled rejection). (Req 1.4, 2.5, 3.4, 13.1, 13.2)
  await check('1: a rejecting insert never throws and is swallowed; flow continues', async () => {
    _user = { id: uuid() };
    _db = makeDb('reject');
    const before = _unhandled;
    for (const w of WRAPPERS) {
      const id = uuid();
      let after = 'sentinel';
      let ret;
      assert((() => { ret = w.fn(id); after = 'continued'; return true; })(), 'wrapper must not throw');
      assert(ret === undefined, w.name + ' should return undefined (fire-and-forget)');
      assert(after === 'continued', w.name + ' caller flow must continue past the call');
      // insert was still attempted synchronously despite the eventual rejection
      assert(_db._calls.some((c) => c.table === w.table), w.name + ' should attempt the ' + w.table + ' insert');
    }
    await flush();
    assert(_unhandled === before, 'no unhandled rejection should escape the wrappers (got ' + (_unhandled - before) + ')');
  });

  // 2. Non-recordable clip id (integer / non-uuid string / null) → clean no-op:
  //    NO insert attempted, for all three wrappers. (Req 1.6, 2.6, 3.5)
  await check('2: non-recordable clip id is a clean no-op (no insert)', async () => {
    _user = { id: uuid() };
    const badIds = [7, '42', 'not-a-uuid', null, undefined];
    for (const w of WRAPPERS) {
      for (const bad of badIds) {
        _db = makeDb('resolve');
        const ret = w.fn(bad);
        assert(ret === undefined, w.name + ' should no-op (undefined) for ' + String(bad));
        assert(_db._calls.length === 0, w.name + ' must NOT insert for non-recordable id ' + String(bad));
      }
    }
    await flush();
  });

  // 3. Missing window.ssDB → NO throw, NO insert, for all three. (design Error
  //    Handling: "missing window.ssDB causes the recorder to return early")
  await check('3: missing window.ssDB → no throw, no insert', async () => {
    _user = { id: uuid() };
    _db = undefined;                 // window.ssDB resolves to undefined
    for (const w of WRAPPERS) {
      const id = uuid();
      let ok = false;
      try { const ret = w.fn(id); ok = (ret === undefined); }
      catch (e) { throw new Error(w.name + ' threw with ssDB missing: ' + e.message); }
      assert(ok, w.name + ' should no-op cleanly with ssDB missing');
    }
    await flush();
  });

  // 4. Repeat view of the SAME clip id in the same session → ssRecordView inserts
  //    only the FIRST time (exactly one view_events insert across two calls with
  //    the same uuid); a DIFFERENT uuid inserts again. (Req 1.5)
  await check('4: ssRecordView de-dups a repeated clip id within the session', async () => {
    _user = { id: uuid() };
    _db = makeDb('resolve');
    const id = uuid();
    W.ssRecordView(id);
    W.ssRecordView(id);              // repeat → must be skipped
    const sameIdInserts = _db._calls.filter((c) => c.table === 'view_events' && c.payload.content_id === id);
    assert(sameIdInserts.length === 1, 'expected exactly ONE view insert for a repeated clip, got ' + sameIdInserts.length);

    const id2 = uuid();
    W.ssRecordView(id2);             // different clip → inserts again
    const otherInserts = _db._calls.filter((c) => c.table === 'view_events' && c.payload.content_id === id2);
    assert(otherInserts.length === 1, 'a different clip id should record a new view, got ' + otherInserts.length);
    await flush();
  });

  // 5. Guests insert user_id = null; signed-in inserts the user's id, for a
  //    recordable clip — asserted via the captured payload. (Req 1.2/1.3, 2.3/2.4,
  //    3.2/3.3, 5.2/5.3)
  await check('5: payload user_id is null for guests and the user id when signed in', async () => {
    // Guest
    _user = null;
    for (const w of WRAPPERS) {
      _db = makeDb('resolve');
      const id = uuid();
      w.fn(id);
      const call = _db._calls.find((c) => c.table === w.table && c.payload.content_id === id);
      assert(call, w.name + ' should have inserted for a recordable clip as a guest');
      assert(call.payload.user_id === null, w.name + ' guest payload user_id must be null, got ' + JSON.stringify(call.payload.user_id));
    }
    // Signed-in
    const myId = uuid();
    _user = { id: myId };
    for (const w of WRAPPERS) {
      _db = makeDb('resolve');
      const id = uuid();
      w.fn(id);
      const call = _db._calls.find((c) => c.table === w.table && c.payload.content_id === id);
      assert(call, w.name + ' should have inserted for a recordable clip when signed in');
      assert(call.payload.user_id === myId, w.name + ' signed-in payload user_id must equal the user id, got ' + JSON.stringify(call.payload.user_id));
    }
    await flush();
  });

  // 6. ssRecordWatch performs NO de-dup — two calls with the same uuid insert
  //    twice. (Req 2.7)
  await check('6: ssRecordWatch does NOT de-dup (two calls → two inserts)', async () => {
    _user = { id: uuid() };
    _db = makeDb('resolve');
    const id = uuid();
    W.ssRecordWatch(id, {});
    W.ssRecordWatch(id, {});
    const inserts = _db._calls.filter((c) => c.table === 'watch_events' && c.payload.content_id === id);
    assert(inserts.length === 2, 'ssRecordWatch should insert twice for the same clip (no de-dup), got ' + inserts.length);
    await flush();
  });

  console.log('\n' + (failures ? `FAILED (${failures})` : 'ALL PASSED'));
  process.exitCode = failures ? 1 : 0;
})();
