/* ShowShak service worker — PWA install + smart caching.
   ─────────────────────────────────────────────────────────────
   Update-safe by design (your push-to-main workflow stays instant):
     • HTML pages → NETWORK-FIRST (always fresh code online; cached copy is
       only an offline fallback). So a deploy reaches users immediately.
     • Same-origin static assets (CSS/JS/SVG/manifest) → STALE-WHILE-REVALIDATE
       (instant from cache, refreshed in the background for next load).
     • Mux video/images, Supabase, fonts, CDN libs → NOT intercepted. Video is
       never cached here (storage safety; the tiered disk cache is a deliberate
       LATER decision). The browser's own HTTP cache still handles those.
     • skipWaiting + clients.claim + old-cache cleanup → new SW takes over at
       once, no "close all tabs" dance.
   Bump CACHE_VERSION to force a clean cache rebuild. */
'use strict';

var CACHE_VERSION = 'v9';
var CACHE_NAME = 'showshak-' + CACHE_VERSION;

// Best-effort precache of the app shell (failures are ignored so install never
// breaks if a path 404s). Paths are relative to the SW scope.
var PRECACHE = [
  './',
  'showshak-feed.html',
  'showshak-discover.html',
  'showshak-watchlist.html',
  'showshak-profile.html',
  'showshak-settings.html',
  'showshak-tokens.css',
  'showshak-sidebar.css',
  'showshak-mobile-nav.css',
  'showshak-components.css',
  'showshak-shared.js',
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
        if (k !== CACHE_NAME) return caches.delete(k);   // drop old versions
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

// Let a page tell a waiting SW to take over right away (used by the update prompt).
self.addEventListener('message', function (event) {
  if (event.data === 'SS_SKIP_WAITING') self.skipWaiting();
});
