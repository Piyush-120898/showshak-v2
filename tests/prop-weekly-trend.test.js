/* ═══════════════════════════════════════════════════════════════
   tests/prop-weekly-trend.test.js — Node property test for the
   creator-analytics weekly-trend model `ssWeeklyTrend(buckets, todayEpochDay)`
   in showshak-shared.js.
   Plain Node (no framework) + fast-check; run with:
     node tests/prop-weekly-trend.test.js

   showshak-shared.js runs DOM setup at load, so we install the shared DOM/window
   stub (tests/_pbt.js) BEFORE requiring it. The helper is PURE.

   EXACT semantics (mirrored by the independent oracle below): returns EXACTLY 7
   entries ascending from (today-6) to today (no day omitted; empty days zero).
   Events outside the [today-6, today] window are ignored. Per day the SAME rules
   as the totals apply, grouped per clip: views/shares use the Self_Activity
   collapse, watch counts every tap, fires count at most one per distinct user.
   Days are taken from each event's numeric `day` (UTC epoch-day). todayEpochDay
   is injected for determinism.
═══════════════════════════════════════════════════════════════ */
'use strict';

const { ITER, installDomStub } = require('./_pbt.js');
installDomStub();
const fc = require('fast-check');
const ss = require('../showshak-shared.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

/* ── SQL-semantics primitives (mirror the helper's internals) ── */
function uid(ev) {
  if (!ev || typeof ev !== 'object') return null;
  const u = ev.user_id;
  return (u === undefined) ? null : u;
}
function isDistinct(a, b) {
  if (a === null && b === null) return false;
  if (a === null || b === null) return true;
  return a !== b;
}
function sqlEquals(a, b) {
  if (a === null || b === null) return false;
  return a === b;
}
function countCollapse(events, creatorId) {
  const owner = (creatorId === undefined) ? null : creatorId;
  let nonOwner = 0;
  let hasSelf = false;
  for (const ev of events) {
    const u = uid(ev);
    if (isDistinct(u, owner)) nonOwner++;
    else if (sqlEquals(u, owner)) hasSelf = true;
  }
  return nonOwner + (hasSelf ? 1 : 0);
}
function countFires(records) {
  const users = new Set();
  for (const r of records) users.add(uid(r));
  return users.size;
}
function epochDay(ev) {
  if (!ev || typeof ev !== 'object') return null;
  if (typeof ev.day === 'number' && isFinite(ev.day)) return Math.floor(ev.day);
  return null;   // the test generates numeric `day` only
}
function clipKeyOf(ev) {
  return (ev && typeof ev === 'object') ? ('cid:' + String(ev.content_id)) : 'cid:undefined';
}

/* ── Independent oracle reproducing ssWeeklyTrend's documented aggregation ── */
function expectedTrend(buckets, today) {
  const start = today - 6;
  const b = (buckets && typeof buckets === 'object') ? buckets : {};
  const views = Array.isArray(b.views) ? b.views : [];
  const shares = Array.isArray(b.shares) ? b.shares : [];
  const watches = Array.isArray(b.watches) ? b.watches : [];
  const fires = Array.isArray(b.fires) ? b.fires : [];

  const result = [];
  const index = {};
  for (let d = start; d <= today; d++) {
    const entry = { day: d, views: 0, shares: 0, watch_its: 0, fires: 0 };
    result.push(entry);
    index[d] = entry;
  }

  function accColl(list, field) {
    const byDay = {};
    for (const ev of list) {
      const day = epochDay(ev);
      if (day === null || day < start || day > today) continue;
      const k = clipKeyOf(ev);
      if (!byDay[day]) byDay[day] = {};
      if (!byDay[day][k]) {
        const cid = (ev && typeof ev === 'object' && ev.creator_id !== undefined) ? ev.creator_id : null;
        byDay[day][k] = { creatorId: cid, events: [] };
      }
      byDay[day][k].events.push(ev);
    }
    for (const dayKey in byDay) {
      const e = index[dayKey];
      if (!e) continue;
      let total = 0;
      const clips = byDay[dayKey];
      for (const ck in clips) total += countCollapse(clips[ck].events, clips[ck].creatorId);
      e[field] += total;
    }
  }
  accColl(views, 'views');
  accColl(shares, 'shares');

  const wByDay = {};
  for (const wev of watches) {
    const wday = epochDay(wev);
    if (wday === null || wday < start || wday > today) continue;
    if (!wByDay[wday]) wByDay[wday] = [];
    wByDay[wday].push(wev);
  }
  for (const wKey in wByDay) {
    if (index[wKey]) index[wKey].watch_its += wByDay[wKey].length;
  }

  const fByDay = {};
  for (const fev of fires) {
    const fday = epochDay(fev);
    if (fday === null || fday < start || fday > today) continue;
    const fk = clipKeyOf(fev);
    if (!fByDay[fday]) fByDay[fday] = {};
    if (!fByDay[fday][fk]) fByDay[fday][fk] = [];
    fByDay[fday][fk].push(fev);
  }
  for (const fDayKey in fByDay) {
    const fe = index[fDayKey];
    if (!fe) continue;
    let ftotal = 0;
    const fclips = fByDay[fDayKey];
    for (const fck in fclips) ftotal += countFires(fclips[fck]);
    fe.fires += ftotal;
  }

  return result;
}

let failed = 0;

console.log('Feature: creator-analytics — weekly trend property test\n');

// Feature: creator-analytics, Property 10
// Property 10: Weekly trend is a 7-day, zero-filled bucketing of the same rules.
// For any set of events, ssWeeklyTrend returns exactly one entry for each of the
// last 7 calendar days (no day omitted, missing days zero), ignores events
// outside the window, and applies the same per-clip-per-day counting rules as the
// totals (views/shares self-collapse, watch every tap, fires distinct-user).
// **Validates: Requirements 9.1, 9.2, 9.3, 9.5, 13.4**
try {
  const TODAY = 20000;                 // fixed injected "today" epoch-day for determinism
  const START = TODAY - 6;
  // Days span the window AND outside it (before start, after today) so out-of-window
  // events must be ignored.
  const dayGen = fc.integer({ min: START - 3, max: TODAY + 3 });
  const ownerPool = fc.constantFrom('owner-1', 'owner-2');
  const userPool = fc.constantFrom('owner-1', 'owner-2', 'viewer-x', 'viewer-y', null, undefined);
  const contentPool = fc.constantFrom('clip-1', 'clip-2', 'clip-3');

  // View/share/fire records carry content_id, creator_id, user_id, day.
  const collapseEvent = fc.record({
    content_id: contentPool,
    creator_id: ownerPool,
    user_id: userPool,
    day: dayGen,
  });
  // Watch records carry content_id + day (user_id/creator_id ignored by the helper).
  const watchEvent = fc.record({
    content_id: contentPool,
    user_id: userPool,
    day: dayGen,
  });

  const bucketsGen = fc.record({
    views: fc.array(collapseEvent, { maxLength: 25 }),
    shares: fc.array(collapseEvent, { maxLength: 25 }),
    watches: fc.array(watchEvent, { maxLength: 25 }),
    fires: fc.array(collapseEvent, { maxLength: 25 }),
  });

  fc.assert(fc.property(bucketsGen, (buckets) => {
    const got = ss.ssWeeklyTrend(buckets, TODAY);
    const exp = expectedTrend(buckets, TODAY);

    // Exactly 7 entries, ascending START..TODAY, no day omitted.
    assert(Array.isArray(got) && got.length === 7, `expected 7 entries, got ${got && got.length}`);
    for (let i = 0; i < 7; i++) {
      assert(got[i].day === START + i, `entry ${i} day ${got[i].day} != ${START + i}`);
      assert(got[i].views >= 0 && got[i].shares >= 0 && got[i].watch_its >= 0 && got[i].fires >= 0,
        'counts must be non-negative');
    }

    // Deep-equals the independently recomputed aggregates.
    assert(JSON.stringify(got) === JSON.stringify(exp),
      `trend mismatch:\n got=${JSON.stringify(got)}\n exp=${JSON.stringify(exp)}\n buckets=${JSON.stringify(buckets)}`);
    return true;
  }), { numRuns: ITER });

  // Empty / missing buckets → 7 zero-filled entries.
  {
    const zero = ss.ssWeeklyTrend({}, TODAY);
    assert(zero.length === 7, 'empty buckets must still produce 7 entries');
    zero.forEach((e, i) => {
      assert(e.day === START + i, 'empty buckets day sequence');
      assert(e.views === 0 && e.shares === 0 && e.watch_its === 0 && e.fires === 0, 'empty buckets must be zero');
    });
    const nullish = ss.ssWeeklyTrend(null, TODAY);
    assert(nullish.length === 7, 'null buckets must still produce 7 entries');
  }

  // Out-of-window events are ignored.
  {
    const trend = ss.ssWeeklyTrend({
      views: [{ content_id: 'c', creator_id: 'o', user_id: 'v', day: START - 1 },   // before window
              { content_id: 'c', creator_id: 'o', user_id: 'v', day: TODAY + 1 }],  // after window
      shares: [], watches: [], fires: [],
    }, TODAY);
    const totalViews = trend.reduce((s, e) => s + e.views, 0);
    assert(totalViews === 0, 'out-of-window events must be ignored');
  }

  // Explicit per-day rule check: on one day, two non-owner views + two owner views
  // on the same clip → 2 + 1 (collapse) = 3 views; two watch taps → 2; two fires by
  // same user → 1.
  {
    const day = TODAY - 2;
    const trend = ss.ssWeeklyTrend({
      views: [
        { content_id: 'c1', creator_id: 'owner-1', user_id: 'a', day },
        { content_id: 'c1', creator_id: 'owner-1', user_id: 'b', day },
        { content_id: 'c1', creator_id: 'owner-1', user_id: 'owner-1', day },
        { content_id: 'c1', creator_id: 'owner-1', user_id: 'owner-1', day },
      ],
      shares: [],
      watches: [
        { content_id: 'c1', day }, { content_id: 'c1', day },
      ],
      fires: [
        { content_id: 'c1', user_id: 'a', day }, { content_id: 'c1', user_id: 'a', day },
      ],
    }, TODAY);
    const e = trend.find((x) => x.day === day);
    assert(e.views === 3, `expected 3 views, got ${e.views}`);
    assert(e.watch_its === 2, `expected 2 watch_its, got ${e.watch_its}`);
    assert(e.fires === 1, `expected 1 fire, got ${e.fires}`);
  }

  console.log('  \u2713 Property 10');
} catch (e) {
  failed++;
  console.log('  \u2717 Property 10\n      ' + e.message);
}

console.log('\n' + (failed ? `FAILED: ${failed} property` : 'ALL PASSED'));
process.exitCode = failed ? 1 : 0;
