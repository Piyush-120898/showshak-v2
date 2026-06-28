/* ShowShak service worker — PWA install + smart caching.
   ─────────────────────────────────────────────────────────────
   Update-safe by design (your push-to-main workflow stays instant):
     • HTML navigations → STALE-WHILE-REVALIDATE (instant from cache, then
       refreshed in the background for next load). Network is used on the first/
       uncached visit and as the offline fallback. (Bump CACHE_VERSION to push a
       deploy to users right away.)
     • Same-origin static assets (CSS/JS/SVG/manifest) → STALE-WHILE-REVALIDATE
       (instant from cache, refreshed in the background for next load).
     • Mux video/images, Supabase, fonts, CDN libs → NOT intercepted. Video is
       never cached here (storage safety; the tiered disk cache is a deliberate
       LATER decision). The browser's own HTTP cache still handles those.
     • skipWaiting + clients.claim + old-cache cleanup → new SW takes over at
       once, no "close all tabs" dance.
   Bump CACHE_VERSION to force a clean cache rebuild. */
'use strict';

var CACHE_VERSION = 'v42';
var CACHE_NAME = 'showshak-' + CACHE_VERSION;

/* ── Persistent video Segment_Cache (feed-clip-load-performance Phase 4, task 22)
   ───────────────────────────────────────────────────────────────────────────
   A SEPARATE Cache Storage bucket for Mux HLS init/media segments. It is NOT
   wiped when CACHE_VERSION changes (the activate cleanup excludes it), so a
   deploy never re-downloads warmed video. Range requests are served as HTTP 206
   by slicing the cached full segment. Eviction is governed by the pure
   ssSegmentEvictionPlan (mirrored below from showshak-shared.js — the SW can't
   import that file because it runs page-level DOM setup at load). Kill-switch:
   the page posts { type:'SS_SEG_CACHE', enabled:false } (from localStorage
   ss_ff_segcache='off') to disable interception on-device without a redeploy. */
var SEG_CACHE = 'showshak-seg';               // dedicated, version-independent bucket
var SEG_CACHE_CEILING = 200 * 1024 * 1024;    // ~200 MB LRU-by-bytes ceiling
var SEG_WINDOW = { ahead: 5, behind: 5 };     // eviction eligibility window (clips around active)
var _segCacheEnabled = false;                 // OFF by default — Phase 4 is OPT-IN (page posts enable when ss_ff_segcache='on') until the 206 path is validated on-device
var _segWindow = { ids: [], activeIdx: 0 };   // ordered playback ids + active index (page-supplied)
var _segIndex = {};                           // href → { key, bytes, lastUsed, clipDistance }
var _segEvictScheduled = false;

// Mirror of the property-tested ssSegmentEvictionPlan (showshak-shared.js).
// Keep in sync; the canonical version is covered by tests/prop-feed-evict-*.
function ssSegmentEvictionPlan(input) {
  var empty = { evict: [], keep: [] };
  if (!input || typeof input !== 'object') return empty;
  var isNum = function (x) { return typeof x === 'number' && isFinite(x); };
  var segments = input.segments;
  if (!Array.isArray(segments)) return empty;
  if (!isNum(input.ceilingBytes) || !isNum(input.windowAhead) || !isNum(input.windowBehind)) return empty;
  var ceiling = input.ceilingBytes, ahead = input.windowAhead, behind = input.windowBehind;
  var valid = [];
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    if (!seg || typeof seg !== 'object') continue;
    if (typeof seg.key !== 'string') continue;
    if (!isNum(seg.bytes) || !isNum(seg.lastUsed) || !isNum(seg.clipDistance)) continue;
    valid.push(seg);
  }
  var evict = [], inWindow = [];
  for (var j = 0; j < valid.length; j++) {
    var s = valid[j];
    if (s.clipDistance < -behind || s.clipDistance > ahead) evict.push(s);
    else inWindow.push(s);
  }
  inWindow.sort(function (a, b) { return a.lastUsed - b.lastUsed; });
  var keptBytes = 0;
  for (var k = 0; k < inWindow.length; k++) keptBytes += inWindow[k].bytes;
  var keep = inWindow.slice();
  while (keptBytes > ceiling && keep.length > 1) {
    var victim = keep.shift();
    evict.push(victim);
    keptBytes -= victim.bytes;
  }
  return { evict: evict.map(function (e) { return e.key; }), keep: keep.map(function (e) { return e.key; }) };
}

// Classify a Mux URL: 'segment' (init/media → LRU bucket, range-aware),
// 'playlist' (.m3u8 → small cache, no range), or null (not a Mux media asset).
function _muxKind(url) {
  if (url.hostname !== 'stream.mux.com') return null;
  if (/\.m3u8(\?|$)/i.test(url.pathname)) return 'playlist';
  if (/\.(ts|m4s|mp4|cmfv|cmfa|m4a|aac)(\?|$)/i.test(url.pathname)) return 'segment';
  return null;
}
function _pidFromHref(href) {
  try { var u = new URL(href); var m = u.pathname.match(/^\/([^/.]+)/); return m ? m[1] : null; }
  catch (e) { return null; }
}
function _segDistance(href) {
  var pid = _pidFromHref(href);
  if (!pid) return 999;
  var idx = _segWindow.ids.indexOf(pid);
  if (idx < 0) return 999;                       // out of the known window
  return idx - (_segWindow.activeIdx || 0);
}
function _segTouch(href, bytes) {
  var e = _segIndex[href] || { key: href };
  if (bytes && (!e.bytes || bytes > e.bytes)) e.bytes = bytes;
  if (!e.bytes) e.bytes = 0;
  e.lastUsed = Date.now();
  e.clipDistance = _segDistance(href);
  _segIndex[href] = e;
}
function _segEvictSoon(cache) {
  if (_segEvictScheduled) return;
  _segEvictScheduled = true;
  setTimeout(function () {
    _segEvictScheduled = false;
    try {
      var segs = Object.keys(_segIndex).map(function (k) {
        var e = _segIndex[k];
        return { key: k, bytes: e.bytes || 0, lastUsed: e.lastUsed || 0, clipDistance: (typeof e.clipDistance === 'number') ? e.clipDistance : 999 };
      });
      var plan = ssSegmentEvictionPlan({ segments: segs, ceilingBytes: SEG_CACHE_CEILING, windowAhead: SEG_WINDOW.ahead, windowBehind: SEG_WINDOW.behind });
      if (plan && plan.evict && plan.evict.length) {
        plan.evict.forEach(function (key) { try { cache.delete(key); } catch (e) {} delete _segIndex[key]; });
      }
    } catch (e) { /* eviction is best-effort */ }
  }, 1500);
}

// Synthesize a 206 Partial Content from a cached FULL segment body. Returns null
// when the range is unsatisfiable / unreadable so the caller bypasses to network
// (never throw a 416 at the player).
function _sliceTo206(resp, rangeHeader) {
  return resp.clone().arrayBuffer().then(function (buf) {
    var total = buf.byteLength;
    var m = /bytes=(\d*)-(\d*)/i.exec(rangeHeader || '');
    if (!m) return null;
    var start = (m[1] === '') ? null : parseInt(m[1], 10);
    var end   = (m[2] === '') ? null : parseInt(m[2], 10);
    if (start === null && end === null) return null;
    if (start === null) { start = Math.max(0, total - end); end = total - 1; }       // suffix range
    else if (end === null || end >= total) { end = total - 1; }
    if (!isFinite(start) || !isFinite(end) || start < 0 || start > end || start >= total) return null;
    var sliced = buf.slice(start, end + 1);
    var headers = new Headers();
    headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + total);
    headers.set('Content-Length', String(sliced.byteLength));
    headers.set('Accept-Ranges', 'bytes');
    var ct = resp.headers.get('Content-Type'); if (ct) headers.set('Content-Type', ct);
    return new Response(sliced, { status: 206, statusText: 'Partial Content', headers: headers });
  }).catch(function () { return null; });
}

// Serve a Mux segment from the persistent bucket: hit → 200 (or 206 sliced for a
// Range), miss → fetch full (no Range so any future range is satisfiable), store,
// then serve. Any failure (opaque body, unsatisfiable range, fetch error) →
// bypass to network for this request. Never throws.
function _serveMuxSegment(req, url, kind) {
  var href = url.href;
  var rangeHeader = req.headers.get('Range');
  return caches.open(SEG_CACHE).then(function (cache) {
    var keyReq = new Request(href);   // key WITHOUT Range so all ranges share one body
    return cache.match(keyReq).then(function (cached) {
      function finish(full, fromNet) {
        if (fromNet) {
          var bytes = 0;
          var cl = full.headers.get('Content-Length'); if (cl) bytes = parseInt(cl, 10) || 0;
          if (!bytes) { return full.clone().arrayBuffer().then(function (b) { _segTouch(href, b ? b.byteLength : 0); _segEvictSoon(cache); return serve(full); }).catch(function () { return serve(full); }); }
          _segTouch(href, bytes); _segEvictSoon(cache);
        } else {
          _segTouch(href, (_segIndex[href] && _segIndex[href].bytes) || 0);
        }
        return serve(full);
      }
      function serve(resp) {
        if (kind === 'segment' && rangeHeader) {
          return _sliceTo206(resp, rangeHeader).then(function (r206) { return r206 || fetch(req); });
        }
        return resp.clone();
      }
      if (cached) return finish(cached, false);
      // Miss → fetch the FULL segment (strip Range) so we can satisfy ranges later.
      return fetch(href, { mode: 'cors', credentials: 'omit' }).then(function (full) {
        if (!full || !full.ok || full.type === 'opaque') return fetch(req);   // can't cache → bypass
        return cache.put(keyReq, full.clone()).then(function () { return finish(full, true); }).catch(function () { return finish(full, true); });
      }).catch(function () { return fetch(req); });
    });
  }).catch(function () { return fetch(req); });
}

// Best-effort precache of the app shell (failures are ignored so install never
// breaks if a path 404s). Paths are relative to the SW scope.
var PRECACHE = [
  './',
  'showshak-feed.html',
  'showshak-discover.html',
  'showshak-watchlist.html',
  'showshak-profile.html',
  'showshak-settings.html',
  'showshak-stack.html',
  'showshak-legal.html',
  'showshak-dmca.html',
  'showshak-tokens.css',
  'showshak-sidebar.css',
  'showshak-mobile-nav.css',
  'showshak-components.css',
  'showshak-shared.js',
  'showshak-stack-page.js',
  'manifest.webmanifest',
  'icon.svg'
];

self.addEventListener('install', function (event) {
  self.skipWaiting();   // activate this version immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // addAll is atomic (any 404 rejects), so add one-by-one and swallow misses.
      return Promise.all(PRECACHE.map(function (url) {
        return cache.add(url).catch(function () { /* ignore a missing path */ });
      }));
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_NAME && k !== SEG_CACHE) return caches.delete(k);   // drop old app-shell versions; KEEP the segment bucket
      }));
    }).then(function () { return self.clients.claim(); })  // control open pages now
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;                       // never touch writes

  var url = new URL(req.url);
  var sameOrigin = (url.origin === self.location.origin);

  // Versioned, immutable CDN libraries (ffmpeg.wasm trim engine, mux-player,
  // supabase-js) all come from jsdelivr → CACHE-FIRST. The ~25MB trim engine and
  // the player libs download ONCE then load instantly on every later upload /
  // app open — the big PWA smoothness win for the upload flow. jsdelivr is
  // CORS-enabled so responses are non-opaque (real-size cache, no quota trap),
  // and they're only fetched on demand (a viewer who never uploads never caches
  // ffmpeg). The URLs are version-pinned, so we never need to revalidate.
  if (url.origin === 'https://cdn.jsdelivr.net') {
    event.respondWith(
      caches.open(CACHE_NAME).then(function (cache) {
        return cache.match(req).then(function (cached) {
          if (cached) return cached;
          return fetch(req).then(function (res) {
            if (res && res.status === 200 && res.type !== 'opaque') cache.put(req, res.clone());
            return res;
          });
        });
      })
    );
    return;
  }

  // Mux HLS segments/playlists → persistent, range-aware Segment_Cache (Phase 4).
  // This is cross-origin (stream.mux.com) so it must be handled BEFORE the
  // same-origin gate below. When the kill-switch is off we don't intercept and
  // the browser handles Mux directly (today's behaviour).
  if (_segCacheEnabled) {
    var muxKind = _muxKind(url);
    if (muxKind) { event.respondWith(_serveMuxSegment(req, url, muxKind)); return; }
  }

  // Other cross-origin (Mux video/images, Supabase, Google Fonts) → don't
  // intercept. The browser handles them; video is never stored in our cache.
  if (!sameOrigin) return;

  // HTML navigations → STALE-WHILE-REVALIDATE so a visited page paints INSTANTLY
  // from cache (Instagram/TikTok-snappy), then refreshes in the background for
  // next time. Offline → cached page, then the feed shell. (To see a fresh deploy
  // immediately during dev: bump CACHE_VERSION, or DevTools → "Update on reload".)
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then(function (cache) {
        return cache.match(req).then(function (cached) {
          var network = fetch(req).then(function (res) {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          }).catch(function () {
            return cached || cache.match('showshak-feed.html');
          });
          return cached || network;   // instant from cache; network on first visit
        });
      })
    );
    return;
  }

  // Same-origin static assets → STALE-WHILE-REVALIDATE: serve the cached copy
  // instantly (fast feel), refresh it in the background for the next load.
  event.respondWith(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(req).then(function (cached) {
        var network = fetch(req).then(function (res) {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        }).catch(function () { return cached; });   // offline → whatever we have
        return cached || network;                   // cached first, else network
      });
    })
  );
});

// Let a page tell a waiting SW to take over right away (used by the update prompt),
// and receive the active-clip window (for segment clipDistance/eviction) + the
// segment-cache kill-switch.
self.addEventListener('message', function (event) {
  var d = event.data;
  if (d === 'SS_SKIP_WAITING') { self.skipWaiting(); return; }
  if (d && typeof d === 'object') {
    if (d.type === 'SS_SEG_WINDOW' && Array.isArray(d.ids)) {
      _segWindow.ids = d.ids;
      _segWindow.activeIdx = (typeof d.activeIdx === 'number' && isFinite(d.activeIdx)) ? d.activeIdx : 0;
    } else if (d.type === 'SS_SEG_CACHE') {
      _segCacheEnabled = (d.enabled !== false);
    }
  }
});
