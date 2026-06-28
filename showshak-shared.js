/* ═══════════════════════════════════════════════════════════════
   SHOWSHAK — SHARED JAVASCRIPT
   All utilities shared across every page.
   ─────────────────────────────────────────────────────────────
   Include at end of <body> on every page:
   <script src="showshak-shared.js"></script>
═══════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════
   SVG MARK — injected once into every page
════════════════════════════════════════════════ */
const SS_MARK_SVG = `
<svg class="svg-defs" aria-hidden="true">
  <symbol id="ss-mark" viewBox="0 0 1254 1254">
    <rect width="1254" height="1254" fill="#000"/>
    <path fill="#EA3B32" d="M402,551C559,551 715,551 872,551C876,551 880,552 883,554C908,568 931,585 952,605C964,618 975,631 986,647L442,647C438,647 433,646 430,644C391,627 357,605 328,573C322,567 317,559 310,551Z"/>
    <path fill="#EA3B32" d="M525,1089C492,1085 462,1075 432,1065C403,1055 375,1043 349,1029C345,1027 343,1027 340,1030C327,1043 314,1057 301,1070C300,1071 298,1073 296,1073C279,1073 261,1073 244,1073C243,1073 242,1072 241,1072L241,994C243,994 245,994 247,994C325,994 403,994 482,994C484,994 487,995 489,996C521,1016 557,1027 595,1030C630,1033 665,1030 700,1019C715,1013 730,1006 744,996C745,995 748,994 750,994C812,994 874,994 936,994C937,994 937,994 939,994C934,999 929,1003 924,1007C891,1034 854,1055 813,1070C793,1077 772,1082 752,1088C747,1089 742,1089 738,1089C668,1089 598,1089 528,1089Z"/>
    <path fill="#EA3B32" d="M864,158C868,162 871,161 874,157C885,146 897,134 908,123C909,122 911,121 912,121C931,121 950,121 970,121L970,204C968,204 967,204 965,204C898,204 831,204 765,204C762,204 760,203 758,201C703,162 643,155 579,171C558,177 540,187 523,201C521,203 519,204 517,204C455,204 395,204 335,204C333,204 333,204 332,204C334,201 335,200 337,198C367,167 404,144 445,128C466,120 488,114 510,108C516,106 522,106 528,106C588,106 649,106 710,107C722,107 734,111 746,114C787,124 826,139 864,158Z"/>
    <path fill="#111" d="M661,471C695,482 729,493 763,505C789,514 814,524 844,537L310,537C297,532 263,447 285,440C372,440 562,440 601,450Z"/>
    <path fill="#111" d="M845,660L988,660C996,665 1023,749 1015,758L748,758C720,751 476,660 476,660Z"/>
    <path fill="#EA3B32" d="M388,426C302,426 258,363 268,329C313,329 470,329 475,333C480,362 517,404 544,423Z"/>
    <path fill="#EA3B32" d="M805,868L1025,773C1027,805 1015,868 812,867Z"/>
    <path fill="#111" d="M799,980L764,980C771,970 803,895 816,883C864,883 1004,882 1008,889C996,921 957,976 946,980Z"/>
    <path fill="#111" d="M466,315L272,315C268,309 290,259 313,224C325,218 497,218 493,234C472,282 473,308 466,315Z"/>
    <path fill="#111" d="M238,912L238,888C244,882 318,882 363,882C375,888 424,945 457,975C462,980 387,980 239,974Z"/>
    <path fill="#111" d="M924,218C938,218 970,225 970,305C960,315 861,315 850,309C820,261 780,221 780,218Z"/>
    <path fill="#EA3B32" d="M281,772C305,772 311,775 361,868L237,868C237,836 235,772 235,772Z"/>
    <path fill="#EA3B32" d="M917,329L970,329L970,426L904,423C877,361 862,329 862,329Z"/>
  </symbol>
</svg>`;

document.body.insertAdjacentHTML('afterbegin', SS_MARK_SVG);

/* ── PWA: register the service worker (install + smart caching) ──
   Runs on every app page that loads shared.js. Relative path so it works under
   the GitHub Pages project subpath; HTTPS/localhost only. The SW handles its own
   updates (skipWaiting + clients.claim), so deploys propagate without stale cache.
   Fully guarded + try/caught so it never affects Node (test) loads or non-PWA env. */
(function ssRegisterSW() {
  try {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
    if (typeof location === 'undefined') return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
    if (typeof window === 'undefined' || !window.addEventListener) return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* best-effort */ });
    });
  } catch (e) { /* never block the app on SW registration */ }
})();


/* ════════════════════════════════════════════════
   PORTRAIT LOCK
   ─────────────────────────────────────────────────
   ShowShak is a vertical-clip product → portrait ONLY. The manifest
   (orientation:"portrait") locks the INSTALLED PWA on Android, but iOS
   ignores manifest orientation, so on a phone held in landscape we cover
   the app with a "rotate to portrait" overlay instead of ever rendering a
   landscape layout. Pure CSS media query (no JS resize churn). Targets
   touch PHONES only — short landscape height + coarse pointer — so desktop
   and the phone-width column on wide screens are never affected; tablets
   (tall even in landscape) are left alone.
════════════════════════════════════════════════ */
(function ssPortraitLock() {
  try {
    if (typeof document === 'undefined' || !document.body) return;
    if (document.getElementById('ss-rotate')) return;
    var css =
      '@media (orientation: landscape) and (max-height: 600px) and (pointer: coarse){' +
        '#ss-rotate{display:flex !important}' +
      '}' +
      '#ss-rotate{display:none;position:fixed;inset:0;z-index:2147483600;background:#0B0B0F;' +
        'color:#fff;flex-direction:column;align-items:center;justify-content:center;gap:16px;' +
        'text-align:center;padding:24px;font-family:\'DM Sans\',system-ui,sans-serif;}' +
      '#ss-rotate .ssr-mark{width:68px;height:68px;border-radius:17px;overflow:hidden;background:#000;' +
        'border:1px solid rgba(234,59,50,.25);box-shadow:0 0 40px rgba(234,59,50,.3);}' +
      '#ss-rotate .ssr-mark svg{width:100%;height:100%;display:block;}' +
      '#ss-rotate .ssr-icon{font-size:30px;color:#EA3B32;animation:ssrTurn 2.2s ease-in-out infinite;}' +
      '#ss-rotate .ssr-title{font-family:\'Bebas Neue\',sans-serif;font-size:26px;letter-spacing:2px;}' +
      '#ss-rotate .ssr-sub{font-size:13px;color:#A0A0B8;max-width:280px;line-height:1.5;}' +
      '@keyframes ssrTurn{0%,100%{transform:rotate(-12deg)}50%{transform:rotate(78deg)}}';
    var st = document.createElement('style');
    st.id = 'ss-rotate-style';
    st.textContent = css;
    document.head.appendChild(st);
    var el = document.createElement('div');
    el.id = 'ss-rotate';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<div class="ssr-mark"><svg viewBox="0 0 1254 1254" xmlns="http://www.w3.org/2000/svg"><use href="#ss-mark"/></svg></div>' +
      '<div class="ssr-icon">\u21BB</div>' +
      '<div class="ssr-title">ROTATE TO PORTRAIT</div>' +
      '<div class="ssr-sub">ShowShak is built for portrait — turn your phone upright to keep watching.</div>';
    document.body.appendChild(el);
  } catch (e) { /* never block the app on the portrait lock */ }
})();


/* ════════════════════════════════════════════════
   TOAST
════════════════════════════════════════════════ */
(function setupToast() {
  if (!document.getElementById('ss-toast')) {
    const el = document.createElement('div');
    el.id = 'ss-toast';
    document.body.appendChild(el);
  }
})();

let _toastTimer = null;

function ssToast(msg) {
  const t = document.getElementById('ss-toast');
  if (!t) return;
  t.innerHTML = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

function showToast(msg) { ssToast(msg); }


/* ════════════════════════════════════════════════
   PAGE FADE-IN
════════════════════════════════════════════════ */
// Single reveal path used by every load event. With the static shell +
// removed body{opacity:0} (Phase 1), the body already paints visible on the
// first frame — this is a belt-and-braces reveal that clears any residual
// hiding transition (e.g. the outgoing-page fade left by ssNavigate) and
// correctly covers the internal MPA-nav case where the document is a fresh
// load (pageshow.persisted === false).
function _ssRevealBody() {
  document.body.style.transition = 'none';
  document.body.style.opacity = '1';
}

// ssPageFadeIn — kept as a thin wrapper so existing callers/exports never
// break. It NO LONGER re-hides the body (no opacity:0): re-hiding would
// reintroduce a flash / black-on-internal-nav now that body{opacity:0} is
// gone. It simply reveals.
function ssPageFadeIn() {
  _ssRevealBody();
}

document.addEventListener('DOMContentLoaded', (e) => {
  if (ssShouldRevealBody({ type: 'DOMContentLoaded' })) _ssRevealBody();
});

// Reveal on EVERY pageshow — both true bfcache restores (e.persisted === true,
// preserving the original bfcache fix) AND fresh internal MPA navigations
// (e.persisted === false), gated by the property-tested ssShouldRevealBody.
window.addEventListener('pageshow', (e) => {
  if (ssShouldRevealBody({ type: 'pageshow', persisted: e.persisted })) {
    _ssRevealBody();
  }
});


/* ════════════════════════════════════════════════
   WATCH IT SHEET
════════════════════════════════════════════════ */

/* Minimal HTML-escape for interpolating curator free-text (title names and
   platform names can be curator-created) into the sheet markup. */
function _ssEscapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* Avatar circle inner content: the curator's profile PHOTO when present (so the
   feed/viewer/cards show the real face), else the uppercase first letter as a
   fallback. URL is HTML-escaped for safe attribute interpolation. The avatar
   itself is never dimmed — focus-dimming applies to text/rails, not the face. */
function _ssAvatarInner(creator) {
  if (creator && creator.avatar) {
    return '<img class="ss-avatar-img" src="' + _ssEscapeHtml(creator.avatar) + '" alt="" loading="lazy">';
  }
  return _ssEscapeHtml((creator && creator.letter) || '');
}

/* Build the per-title input list the Watch It sheet renders (Req 2.4).
   RECOMMENDED lazy-fetch approach (keeps the hot feed query unchanged): for a
   REAL clip (uuid content id in show.id — the field set by ssMapContentRowsToClips
   and carried through the viewer normalizer) query `content_titles` for the
   clip's linked titles, each with its OWN region-aware `providers`, ordered by
   `sort_no` (primary first). Each title carries the clip's `curatorPlat` so the
   curator-platform fallback (Req 1.4 / 2.5 / 6.1) resolves PER-TITLE when a
   title has no providers for the region.

   FALLBACK (documented): when there is no usable content id (mock/demo clips,
   Discover/Watchlist/Profile clips), or the fetch errors / returns no rows, we
   build a single-title list from the clip itself so those surfaces and genuine
   single-title clips keep working. Never throws; always returns ≥ 1 entry. */
async function _ssFetchSheetTitles(show) {
  const single = [{
    name:        show.title,
    year:        show.year,
    providers:   show.providers,
    curatorPlat: show.curatorPlat
  }];
  if (!window.ssDB || !_ssIsUuid(show.id)) return single;
  // Prewarmed/previously-opened → return the cached titles instantly (no network).
  if (_ssSheetTitlesCache[show.id]) return _ssSheetTitlesCache[show.id];
  try {
    // Curator declarations are stored for the curator's region (IN default),
    // resolved the same way the rest of the sheet flow resolves region.
    const region  = (typeof ssGetRegion === 'function') ? (await ssGetRegion()) : 'IN';
    const catalog = await _ssPlatformCatalogMap();
    const res = await window.ssDB.from('content_titles')
      .select('sort_no, curator_platform_ids, titles:title_id ( id, name, year, providers )')
      .eq('content_id', show.id)
      .order('sort_no');
    if (res.error || !res.data || !res.data.length) return single;
    const titles = res.data.map(function (row) {
      const t = row.titles || {};
      // BACKWARD-SAFE: when the column isn't applied yet the select returns
      // undefined → treat as [] → today's behaviour. Ids with no catalog match
      // silently drop (.filter(Boolean)).
      const ids = Array.isArray(row.curator_platform_ids) ? row.curator_platform_ids : [];
      const declaredForRegion = ids.map(function (id) { return catalog[id]; }).filter(Boolean);
      return {
        name:        t.name || show.title,
        year:        t.year || show.year,
        providers:   t.providers || {},
        declaredPlatforms: { [region]: declaredForRegion },   // NEW — Curator_Declared_Platforms (Req 4.1)
        curatorPlat: show.curatorPlat   // legacy per-title fallback still honoured by the resolver
      };
    });
    _ssSheetTitlesCache[show.id] = titles;   // cache so reopen / post-prewarm is instant
    return titles;
  } catch (e) {
    return single;   // any failure → graceful single-title fallback
  }
}

/* Prewarm the Watch It sheet data for a clip so the sheet opens INSTANTLY:
   warm the (already-memoized) region + subscriptions, and prefetch + cache this
   clip's linked titles/providers. Idempotent, fire-and-forget; never throws.
   Called when a clip becomes active so the data is ready before the tap. */
function ssPrewarmWatch(show) {
  if (!show) return;
  try {
    if (typeof ssGetRegion === 'function') ssGetRegion();
    if (typeof ssGetSubscribedPlatformIds === 'function') ssGetSubscribedPlatformIds();
    if (window.ssDB && _ssIsUuid(show.id) && !_ssSheetTitlesCache[show.id]) {
      _ssFetchSheetTitles(show);   // resolves into _ssSheetTitlesCache; ignore the promise
    }
  } catch (e) { /* prewarm is best-effort */ }
}
if (typeof window !== 'undefined') window.ssPrewarmWatch = ssPrewarmWatch;

/* Render one option row's markup. Title/platform free-text is HTML-escaped;
   the platform + owning-title names ride on data-* attributes so the click
   handler reads decoded values (no free-text interpolated into inline JS). */
function _ssRenderSheetOption(p, titleName) {
  return `
      <div class="sheet-option" data-plat="${_ssEscapeHtml(p.name)}" data-title="${_ssEscapeHtml(titleName)}">
        <div class="sheet-plat-logo" style="background:${_ssEscapeHtml(p.color)}">${_ssEscapeHtml(p.label)}</div>
        <div class="sheet-option-info">
          <div class="sheet-option-name">${_ssEscapeHtml(p.name)}</div>
          <div class="sheet-option-sub">${_ssEscapeHtml(p.sub)}</div>
          ${p.included ? '<span class="sheet-included">✓ In your plan</span>' : ''}
        </div>
        <span class="sheet-option-arrow">›</span>
      </div>`;
}

/* Current Watch It sheet context, stashed by ssOpenSheet so ssHandleWatchNow
   (which only receives display strings) can record a Watch_Event for the right
   clip. Reset/overwritten each time the sheet opens. */
var _ssSheetShow   = null;
var _ssSheetRegion = undefined;
// Per-clip Watch It titles/providers cache (keyed by content id), populated by
// _ssFetchSheetTitles + ssPrewarmWatch so opening the sheet needs no network.
var _ssSheetTitlesCache = {};

async function ssOpenSheet(show) {
  if (!show) return;

  // Stash the current sheet's clip (and, once resolved, its region) so the
  // option-click handler — which only receives display strings — can record a
  // Watch_Event for the right clip (Req 2.1/2.2).
  _ssSheetShow   = show;
  _ssSheetRegion = undefined;

  // Open the overlay immediately (runs synchronously before the first await)
  // so the sheet appears at once; the header + options fill in after the
  // cached lookups + lazy title fetch below resolve.
  document.getElementById('watch-sheet-overlay')?.classList.add('open');
  document.getElementById('watch-sheet')?.classList.add('open');

  const header = document.getElementById('sheet-header');
  const opts   = document.getElementById('sheet-options');
  if (!opts) return;

  // Resolve region + subscriptions (cached), build the per-title input list
  // (lazy fetch of the clip's linked titles, single-title fallback otherwise),
  // then resolve EACH title independently via the shared resolver (Req 2.4).
  const region   = await ssGetRegion();
  _ssSheetRegion = region;   // stash for the Watch_Event recorded on option click
  const subs     = await ssGetSubscribedPlatformIds();
  const titles   = await _ssFetchSheetTitles(show);
  const sections = window.ssResolveWatchOptionsForTitles(titles, region, subs);
  const multi    = sections.length > 1;

  // ── Header ── This is the Watch It reveal moment, so showing titles here is
  // correct (the clip BODY stays title-hidden — Req 6.1). Single-title: reveal
  // that title. Multi-title: neutral header + a count, each section carries its
  // own title name. Degrade gracefully when title data is missing.
  if (header) {
    if (multi) {
      header.innerHTML = `
      <div class="sheet-thumb" style="background:${_ssEscapeHtml(show.bg)}">
        <span>▶</span>
      </div>
      <div class="sheet-info">
        <div class="sheet-show-title">Where to watch</div>
        <div class="sheet-meta">${sections.length} titles</div>
      </div>
    `;
    } else {
      const t0      = (sections[0] && sections[0].title) || {};
      const title   = t0.name || show.title || 'Ready to watch';
      const metaTop = [t0.year || show.year, show.season].filter(Boolean).join(' · ');
      const genres  = (show.genre || []).join(' · ');
      const meta    = [metaTop, genres].filter(Boolean).join('<br>') || 'Choose where to watch it';
      header.innerHTML = `
      <div class="sheet-thumb" style="background:${_ssEscapeHtml(show.bg)}">
        <span>${_ssEscapeHtml(title)}</span>
      </div>
      <div class="sheet-info">
        <div class="sheet-show-title">${_ssEscapeHtml(title)}</div>
        <div class="sheet-meta">${meta}</div>
      </div>
    `;
    }
  }

  // ── Options ── one labelled section per linked title. A multi-title clip
  // shows each title's name above its own region-aware options (or its neutral
  // message when none resolve). A single-title clip renders just its options,
  // with no redundant per-title heading (the header already names it).
  opts.innerHTML = sections.map(function (sec) {
    const titleName = (sec.title && sec.title.name) || show.title || 'Title';
    const heading   = multi
      ? '<div class="sheet-title-section"><span class="sheet-title-label">' + _ssEscapeHtml(titleName) + '</span></div>'
      : '';
    const body = sec.message
      ? '<div class="sheet-empty">' + _ssEscapeHtml(sec.message) + '</div>'
      : sec.options.map(function (p) { return _ssRenderSheetOption(p, titleName); }).join('');
    return heading + body;
  }).join('');

  // Wire click handlers from the data-* attributes (decoded, injection-safe),
  // routing each option to ssHandleWatchNow with its OWN title's name.
  opts.querySelectorAll('.sheet-option').forEach(function (el) {
    el.addEventListener('click', function () {
      ssHandleWatchNow(el.getAttribute('data-plat'), el.getAttribute('data-title'));
    });
  });
}

function ssCloseSheet() {
  document.getElementById('watch-sheet')?.classList.remove('open');
  document.getElementById('watch-sheet-overlay')?.classList.remove('open');
}

/* Best-effort "open the platform" URL for a title. TMDB does NOT provide true
   per-title app deep links (only a JustWatch aggregator page), so we open the
   platform's SEARCH for the title: on mobile an https link opens the platform's
   APP via universal links when installed, otherwise its website. Unknown
   platforms fall back to a Google "watch on" search (always resolves). */
function ssPlatformWatchUrl(platform, titleName) {
  var q = encodeURIComponent(String(titleName || '').trim());
  var key = String(platform || '').toLowerCase().trim();
  var map = {
    'netflix':             'https://www.netflix.com/search?q=' + q,
    'prime video':         'https://www.primevideo.com/search?phrase=' + q,
    'amazon prime video':  'https://www.primevideo.com/search?phrase=' + q,
    'disney+':             'https://www.hotstar.com/in/search?q=' + q,
    'jiohotstar':          'https://www.hotstar.com/in/search?q=' + q,
    'hotstar':             'https://www.hotstar.com/in/search?q=' + q,
    'jiocinema':           'https://www.jiocinema.com/search/' + q,
    'apple tv+':           'https://tv.apple.com/in/search?term=' + q,
    'sonyliv':             'https://www.sonyliv.com/search?searchTerm=' + q,
    'hbo max':             'https://www.hotstar.com/in/search?q=' + q,
    'max':                 'https://play.max.com/search?q=' + q,
    'zee5':                'https://www.zee5.com/search?q=' + q,
    'hulu':                'https://www.hulu.com/search?q=' + q,
    'youtube':             'https://www.youtube.com/results?search_query=' + q,
    'crunchyroll':         'https://www.crunchyroll.com/search?q=' + q
    // Regional app-first platforms (Aha, Sun NXT, Hoichoi, Chaupal, KableOne,
    // STAGE, Planet Marathi, ManoramaMax, ETV Win) have no reliable web search
    // URL — they intentionally fall through to the Google "watch on <platform>"
    // resolver below, which always resolves and opens their app/site.
  };
  return map[key] || ('https://www.google.com/search?q=' + encodeURIComponent((titleName || '') + ' watch on ' + (platform || '')));
}

function ssHandleWatchNow(platform, showTitle) {
  // Record the Watch It tap fire-and-forget BEFORE/independent of opening, so it
  // never blocks navigation (Req 2.1, 2.2). Mock/demo clips are skipped by the
  // recorder; every real tap counts.
  ssRecordWatch(_ssSheetShow && _ssSheetShow.id, { region: _ssSheetRegion, platform_id: undefined, title_id: undefined });
  var url = ssPlatformWatchUrl(platform, showTitle);
  ssCloseSheet();
  // Open the platform in a new context (keeps ShowShak open). On mobile this
  // hands off to the platform's app via universal links if installed, else the
  // website. Falls back to a same-tab navigation if the popup is blocked.
  var opened = null;
  try { opened = window.open(url, '_blank', 'noopener'); } catch (e) { opened = null; }
  if (!opened) { try { window.location.href = url; } catch (e2) {} }
  setTimeout(function () { ssToast('▶ Opening ' + platform); }, 150);
}

function openSheet(idx)       { if (typeof SHOWS !== 'undefined') ssOpenSheet(SHOWS[idx]); }
function closeSheet()         { ssCloseSheet(); }
function handleWatchNow(p, t) { ssHandleWatchNow(p, t); }


/* ════════════════════════════════════════════════
   SHARED CHROME — sidebar + mobile nav + Watch It sheet
   ─────────────────────────────────────────────────────
   This markup used to be copy-pasted (identically) into every
   app page. It now lives here once. A page opts in by placing
   an empty <div id="ss-nav"></div> where the chrome should go;
   ssInjectChrome() fills it. Pages WITHOUT that placeholder
   (e.g. index.html, showshak-upload.html) are left untouched.

   The Watch It sheet (#watch-sheet) is included so ssOpenSheet()
   works on EVERY page that has the nav — previously the sheet
   only existed on the Feed, so "Watch It" from the universal
   clip viewer silently did nothing on Discover/Watchlist/Profile.
════════════════════════════════════════════════ */
const SS_SIDEBAR_HTML = `
<nav class="sidebar" id="sidebar">
  <a class="sidebar-logo" href="showshak-feed.html">
    <div class="sidebar-mark"><svg viewBox="0 0 1254 1254" xmlns="http://www.w3.org/2000/svg"><use href="#ss-mark"/></svg></div>
    <span class="sidebar-wordmark">show<em>shak</em></span>
  </a>
  <div class="sidebar-divider"></div>
  <div class="sidebar-nav">
    <a class="nav-item" data-nav="feed" href="showshak-feed.html"><div class="nav-item-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg></div><span class="nav-item-label">Feed</span></a>
    <a class="nav-item" data-nav="discover" href="showshak-discover.html"><div class="nav-item-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><span class="nav-item-label">Discover</span></a>
    <a class="nav-item" data-nav="watchlist" href="showshak-watchlist.html"><div class="nav-item-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></div><span class="nav-item-label">Watchlist</span></a>
    <a class="nav-item" data-nav="profile" href="showshak-profile.html"><div class="nav-item-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><span class="nav-item-label">Profile</span></a>
  </div>
  <div class="sidebar-bottom">
    <a class="nav-item-settings ss-auth-settings" data-nav="settings" href="showshak-settings.html"><div class="nav-item-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></div><span class="nav-item-label">Settings</span></a>
    <a class="nav-item-settings ss-auth-login" href="#" onclick="if(window.ssOpenSignup)ssOpenSignup('login');return false;" style="display:none"><div class="nav-item-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg></div><span class="nav-item-label">Log in</span></a>
  </div>
</nav>`;

const SS_WATCH_SHEET_HTML = `
<div id="watch-sheet-overlay" onclick="ssCloseSheet()"></div>
<div id="watch-sheet">
  <div class="sheet-handle"></div>
  <div class="sheet-header" id="sheet-header"></div>
  <div class="sheet-options-label">WATCH ON</div>
  <div id="sheet-options"></div>
  <div class="sheet-cancel" onclick="ssCloseSheet()">Cancel</div>
</div>`;

const SS_MOBILE_NAV_HTML = `
<nav class="mobile-bottom-nav">
  <a class="mob-nav-item" data-mob-nav="feed" href="showshak-feed.html"><div class="mob-nav-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg></div><span class="mob-nav-label">Feed</span></a>
  <a class="mob-nav-item" data-mob-nav="discover" href="showshak-discover.html"><div class="mob-nav-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><span class="mob-nav-label">Discover</span></a>
  <a class="mob-nav-item" data-mob-nav="watchlist" href="showshak-watchlist.html"><div class="mob-nav-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></div><span class="mob-nav-label">Watchlist</span></a>
  <a class="mob-nav-item" data-mob-nav="profile" href="showshak-profile.html"><div class="mob-nav-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><span class="mob-nav-label">Profile</span></a>
</nav>`;

function ssInjectChrome() {
  const slot = document.getElementById('ss-nav');
  if (!slot) return;   // page opted out (index/upload) — leave it alone
  // data-no-sheet lets a page (e.g. Feed, which has its own bespoke sheet
  // markup) skip the shared Watch It sheet to avoid a duplicate id.
  const includeSheet = slot.getAttribute('data-no-sheet') === null;
  slot.outerHTML = SS_SIDEBAR_HTML + (includeSheet ? SS_WATCH_SHEET_HTML : '') + SS_MOBILE_NAV_HTML;
  highlightActiveNav();
  ssSyncAuthChrome();
}

/* ════════════════════════════════════════════════
   AUTH CHROME — Login ⇄ Settings
   ─────────────────────────────────────────────────
   The sidebar-bottom slot shows "Log in" for guests (opens the shared
   signup sheet) and flips to "Settings" once a real session exists. Driven
   by ssIsSignedUp(); re-run on the initial async session read and on every
   onAuthStateChange (login / logout) from the guest gate. Safe to call
   before auth resolves — defaults to the guest (Log in) view.
════════════════════════════════════════════════ */
function ssSyncAuthChrome() {
  const signedIn = (typeof window.ssIsSignedUp === 'function') ? window.ssIsSignedUp() : false;
  document.querySelectorAll('.ss-auth-settings').forEach(el => { el.style.display = signedIn ? '' : 'none'; });
  document.querySelectorAll('.ss-auth-login').forEach(el => { el.style.display = signedIn ? 'none' : ''; });
  // Let any page (e.g. the Profile hero gear) react to the same flip.
  if (typeof window.ssOnAuthChromeSync === 'function') { try { window.ssOnAuthChromeSync(signedIn); } catch (e) {} }
}
window.ssSyncAuthChrome = ssSyncAuthChrome;

/* ════════════════════════════════════════════════
   NAV HIGHLIGHT
════════════════════════════════════════════════ */
function highlightActiveNav() {
  const path = window.location.pathname.toLowerCase();
  const navMap = {
    'feed':      'feed',
    'discover':  'discover',
    'watchlist': 'watchlist',
    'profile':   'profile',
    'settings':  'settings',
  };
  for (const key of Object.keys(navMap)) {
    if (path.includes(key)) {
      document.querySelectorAll('.nav-item, .nav-item-settings').forEach(el => el.classList.remove('active'));
      document.querySelectorAll(`[data-nav="${key}"]`).forEach(el => el.classList.add('active'));
      document.querySelectorAll('.mob-nav-item').forEach(el => el.classList.remove('active'));
      document.querySelectorAll(`[data-mob-nav="${key}"]`).forEach(el => el.classList.add('active'));
      break;
    }
  }
}

// Inject shared chrome as early as possible (the script tag is at end of
// <body>, so the DOM placeholder already exists). Falls back to highlight
// for any page that hard-codes its own nav and has no placeholder.
ssInjectChrome();
highlightActiveNav();


/* ════════════════════════════════════════════════
   FORMAT HELPERS
════════════════════════════════════════════════ */
function fmtFires(n) {
  // Coerce defensively: a missing/NaN/Infinity count must never render as
  // "NaN"/"undefined" on the Fire pill (a sacred surface). Non-finite → 0.
  n = Number(n);
  if (!isFinite(n)) n = 0;
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function ssScrollToTop(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
}

function scrollFeedToTop() { ssScrollToTop('feed'); }


/* ════════════════════════════════════════════════
   SHARE UTILITY
════════════════════════════════════════════════ */
/* Build a deep link to a SINGLE clip — opens in the feed's clip viewer via the
   ?clip= param. Only real (uuid) clips deep-link; mock/demo clips fall back to
   the current URL. NEVER includes the show title — the title is revealed only
   at Watch It (sacred rule). */
function _ssClipShareUrl(id) {
  try {
    if (!_ssIsUuid(id)) return window.location.href;
    var dir = location.pathname.replace(/[^/]*$/, '');     // strip filename → directory
    return location.origin + dir + 'showshak-feed.html?clip=' + encodeURIComponent(id);
  } catch (e) { return window.location.href; }
}

function ssShare(show) {
  if (!show) return;
  // Record the share fire-and-forget alongside the native share / clipboard
  // path (Req 3.1). The wrapper skips mock clips and never blocks the action.
  ssRecordShare(show && show.id);
  var url = _ssClipShareUrl(show.id);
  // Title-blind copy: we never reveal the show name in a share — discovery is
  // the curator's clip, not the title (revealed only at Watch It).
  var text = 'Found this on ShowShak — swipe, discover, Watch It. 🔥';
  if (navigator.share) {
    navigator.share({ title: 'A pick on ShowShak', text: text, url: url }).catch(function () {});
  } else {
    navigator.clipboard
      .writeText(url)
      .then(function () { ssToast('🔗 Link copied'); })
      .catch(function () { ssToast('🔗 ' + url); });
  }
}

function shareClip(idx) {
  if (typeof SHOWS !== 'undefined') ssShare(SHOWS[idx]);
}

/* Share a CURATOR PROFILE — links to the public profile (?curator=<username>),
   which already renders the real curator (identity, clips, public stacks). Only
   curator profiles are shareable (user profiles are private); the caller passes
   the handle. Showing the @username is fine — the title-hidden rule is about
   clip titles, not curator identity. */
function ssShareProfile(username) {
  var u = String(username || '').replace(/^@/, '').trim();
  if (!u) { ssToast('Profile not available to share'); return; }
  var dir = location.pathname.replace(/[^/]*$/, '');
  var url = location.origin + dir + 'showshak-profile.html?curator=' + encodeURIComponent(u);
  if (navigator.share) {
    navigator.share({ title: '@' + u + ' on ShowShak', text: 'Check out @' + u + '’s picks on ShowShak 🔥', url: url }).catch(function () {});
  } else {
    navigator.clipboard
      .writeText(url)
      .then(function () { ssToast('🔗 Profile link copied'); })
      .catch(function () { ssToast('🔗 ' + url); });
  }
}
window.ssShareProfile = ssShareProfile;

/* Share a whole Stack / collection. Native share sheet on mobile,
   clipboard fallback on desktop. Used by Watchlist (and later the
   profile Highlights shelf). Pass the stack object from ssGetStacks().

   Visibility-aware: tapping Share opens the visibility CHOOSER (mounted by the
   page) so the owner sets privacy first, then we hand off to the native share
   sheet. Title-blind: the stack NAME is the curator's own collection label (not
   a show/movie title), so it's allowed; we never include a show title. */
function ssShareStack(stack) {
  if (!stack) return;
  // Prefer the visibility chooser sheet when a page has mounted it.
  if (typeof window !== 'undefined' && typeof window.ssOpenShareChooser === 'function') {
    window.ssOpenShareChooser(stack);
    return;
  }
  // Fallback (no chooser on this surface): share directly if already shareable,
  // else point the owner at the ⋮ menu. (No silent visibility change.)
  if (_ssStackVisibility(stack) !== 'private') { ssShareStackWithVisibility(stack, _ssStackVisibility(stack)); return; }
  ssToast('Open the stack’s ⋮ menu to set visibility, then share');
}

/* Persist the chosen visibility, then share. For a non-private choice this
   builds the ?stack= link and invokes the native share sheet (clipboard
   fallback); for 'private' it just persists and shows no link. Called by the
   visibility chooser after the owner picks. Title-blind throughout. */
function ssShareStackWithVisibility(stack, visibility) {
  if (!stack) return;
  const v = (visibility === 'unlisted' || visibility === 'public') ? visibility : 'private';
  if (typeof ssSetStackVisibility === 'function') ssSetStackVisibility(stack.id, v, stack.highlighted);
  if (v === 'private') { ssToast('Saved as Private — only you can see it'); return; }
  const shareable = Object.assign({}, stack, { visibility: v });
  const url = ssStackShareUrl(shareable);
  if (!url) { ssToast('This stack can’t be shared yet'); return; }
  const n = shareable.clips ? shareable.clips.length : 0;
  const countTxt = n ? `${n} hand-picked clip${n !== 1 ? 's' : ''}` : 'a collection';
  const title = `${shareable.name || 'A ShowShak Stack'} — a ShowShak Stack`;
  const text  = `Check out "${shareable.name || 'this stack'}" on ShowShak — ${countTxt} of what to watch next. 🔥`;

  if (navigator.share) {
    navigator.share({ title, text, url }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(`${text}\n${url}`)
      .then(() => ssToast(`🔗 “${shareable.name || 'Stack'}” link copied`))
      .catch(() => ssToast('Could not copy link'));
  } else {
    ssToast('Sharing not supported on this browser');
  }
}
if (typeof window !== 'undefined') window.ssShareStackWithVisibility = ssShareStackWithVisibility;

/* ── Shared visibility chooser sheet (stack-folder-view) ──
   Injected lazily on first use; opened via window.ssOpenShareChooser(stack).
   Renders the role-gated options from the pure ssShareVisibilityOptions and
   routes the pick to ssShareStackWithVisibility (persist → native share). The
   sheet is intentionally dumb: gating is in the pure fn, persistence/share in
   the impure helper. Used by both the Watchlist and the Stack Folder page. */
var SS_SHARE_SHEET_HTML =
  '<div id="ss-share-overlay" onclick="ssCloseShareChooser()"></div>' +
  '<div id="ss-share-sheet" role="dialog" aria-modal="true">' +
    '<div class="ss-share-handle"></div>' +
    '<div class="ss-share-title">Share this stack</div>' +
    '<div class="ss-share-sub">Choose who can see it, then pick where to send it.</div>' +
    '<div id="ss-share-options"></div>' +
    '<div class="ss-share-cancel" onclick="ssCloseShareChooser()">Cancel</div>' +
  '</div>';

function _ssEnsureShareSheet() {
  if (typeof document === 'undefined' || !document.body) return;
  if (document.getElementById('ss-share-sheet')) return;
  try { document.body.insertAdjacentHTML('beforeend', SS_SHARE_SHEET_HTML); } catch (e) {}
}
function ssCloseShareChooser() {
  var o = document.getElementById('ss-share-overlay'), s = document.getElementById('ss-share-sheet');
  if (o) o.classList.remove('open');
  if (s) s.classList.remove('open');
}
function ssOpenShareChooser(stack) {
  if (!stack) return;
  _ssEnsureShareSheet();
  var render = function () {
    var role    = (typeof ssIsCuratorAccountSync === 'function' && ssIsCuratorAccountSync()) ? 'curator' : 'user';
    var current = (stack.visibility === 'unlisted' || stack.visibility === 'public') ? stack.visibility : 'private';
    var opts    = ssShareVisibilityOptions(role, current);
    var meta = {
      private:  { label: 'Private',    desc: 'Only you can see it' },
      unlisted: { label: 'Get a link', desc: 'Anyone with the link can view' },
      public:   { label: 'Public',     desc: 'Listed on your profile' }
    };
    var box = document.getElementById('ss-share-options');
    if (box) {
      box.innerHTML = opts.map(function (v) {
        var m = meta[v] || { label: v, desc: '' };
        var on = (v === current) ? ' ss-share-opt-current' : '';
        return '<div class="ss-share-opt' + on + '" data-vis="' + v + '">' +
                 '<div class="ss-share-opt-main">' + m.label + (v === current ? ' · current' : '') + '</div>' +
                 '<div class="ss-share-opt-desc">' + m.desc + '</div>' +
               '</div>';
      }).join('');
      box.querySelectorAll('.ss-share-opt').forEach(function (el) {
        el.addEventListener('click', function () {
          var vis = el.getAttribute('data-vis');
          ssCloseShareChooser();
          if (typeof ssShareStackWithVisibility === 'function') ssShareStackWithVisibility(stack, vis);
        });
      });
    }
    var o = document.getElementById('ss-share-overlay'), s = document.getElementById('ss-share-sheet');
    if (o) o.classList.add('open');
    if (s) s.classList.add('open');
  };
  // Resolve the account role first so curators are offered Public, then render.
  if (typeof ssResolveMyRole === 'function') { ssResolveMyRole().then(render).catch(render); }
  else render();
}
if (typeof window !== 'undefined') {
  window.ssOpenShareChooser  = ssOpenShareChooser;
  window.ssCloseShareChooser = ssCloseShareChooser;
}


/* ════════════════════════════════════════════════
   STACK SHARING — pure visibility / placement / collaboration rules
   DOM-free, never throw, dual-exported for Node + fast-check. These drive
   UX ONLY; the real security boundary is RLS + the get_shared_stack RPC
   (migrations 0022 / 0023). Stack shape: { id, name, clips,
   visibility:'private'|'unlisted'|'public', highlighted:bool,
   mode:'view'|'collaborative', owner_id|user_id }. Unknown/missing
   visibility is treated as 'private' (the safe default — never leak).
   See .kiro/specs/stack-sharing.
════════════════════════════════════════════════ */
/* Max members per stack, INCLUDING the owner. Single source of truth for the
   cap (mirrored by the migration 0023 trigger). */
var SS_STACK_MEMBER_CAP = 6;

/* Normalize a stack's visibility to one of the three valid values; anything
   unknown/missing collapses to 'private' so a malformed row never leaks. */
function _ssStackVisibility(stack) {
  var v = stack && stack.visibility;
  return (v === 'unlisted' || v === 'public') ? v : 'private';
}
/* The stack's owner id, tolerant of both the DB shape (user_id) and the
   normalized/shared shape (owner_id). */
function _ssStackOwner(stack) {
  return (stack && (stack.owner_id || stack.user_id)) || null;
}

/* View access: the owner can always view; anyone else can view iff the stack
   is not private. (Validates Req 2.1, 2.2, 4.2 — Property 1.) */
function ssStackCanView(viewerId, stack) {
  if (!stack) return false;
  var owner = _ssStackOwner(stack);
  if (viewerId && owner && viewerId === owner) return true;
  return _ssStackVisibility(stack) !== 'private';
}

/* Listed on a public profile iff visibility is public. (Req 2.3, 3.4 — Property 2.) */
function ssStackIsListed(stack) {
  return !!stack && _ssStackVisibility(stack) === 'public';
}

/* Where a stack renders on the public profile: 'highlights' (public+highlighted),
   'folder' (public, not highlighted), or 'none' (never, for non-public).
   (Req 3.2, 3.3 — Property 3.) */
function ssStackShelfPlacement(stack) {
  if (!ssStackIsListed(stack)) return 'none';
  return stack.highlighted ? 'highlights' : 'folder';
}

/* Contribution authority: only on a collaborative stack, and only for a member
   (the owner is always a member). (Req 7.1 — Property 6.) */
function ssCanContribute(viewerId, stack, memberIds) {
  if (!viewerId || !stack) return false;
  if (stack.mode !== 'collaborative') return false;
  var owner = _ssStackOwner(stack);
  if (owner && viewerId === owner) return true;
  return Array.isArray(memberIds) && memberIds.indexOf(viewerId) !== -1;
}

/* Join authority: collaborative AND below the cap AND not already a member.
   cap falls back to SS_STACK_MEMBER_CAP; never permits the count to reach/exceed
   the cap. (Req 6.2, 6.3, 6.4 — Property 4.) */
function ssCanJoinStack(stack, memberCount, cap, alreadyMember) {
  if (!stack || stack.mode !== 'collaborative') return false;
  if (alreadyMember) return false;
  var c = (typeof cap === 'number' && cap > 0) ? cap : SS_STACK_MEMBER_CAP;
  var n = (typeof memberCount === 'number' && memberCount >= 0) ? memberCount : 0;
  return n < c;
}

/* Removal authority: the owner may remove any item; a non-owner may remove only
   an item they themselves added (added_by). (Req 8.1, 8.2 — Property 5.) */
function ssCanRemoveStackItem(viewerId, item, stack) {
  if (!viewerId || !item || !stack) return false;
  var owner = _ssStackOwner(stack);
  if (owner && viewerId === owner) return true;
  return item.added_by === viewerId;
}

/* ── Stack Folder View pure helpers (stack-folder-view feature) ──
   DOM-free, never throw, dual-exported. UX-only; the security boundary stays
   RLS + get_shared_stack. See .kiro/specs/stack-folder-view. */

/* Fixed Watchlist preview cap — single source of truth. */
var SS_STACK_PREVIEW_CAP = 12;

/* Watchlist preview truncation → { shown, viewAll }. `shown` is the
   order-preserving prefix of up to `cap` clips (SAME references, no clone);
   `viewAll` is true iff there are strictly MORE clips than the cap. Tolerant:
   non-array clips → []; non-positive/non-number cap → SS_STACK_PREVIEW_CAP. */
function ssStackPreviewClips(clips, cap) {
  var list = Array.isArray(clips) ? clips : [];
  var c = (typeof cap === 'number' && cap > 0) ? Math.floor(cap) : SS_STACK_PREVIEW_CAP;
  return { shown: list.slice(0, Math.min(c, list.length)), viewAll: list.length > c };
}

/* Ordered, de-duplicated attribution list for the folder header: the owner
   FIRST, then the other members in their given order, each identity at most
   once (owner never duplicated even if present in members). Identity key =
   user_id || id || username. View-only (no other members) → [owner]. Accepts
   owner/member as an object ({user_id|id, username, role}) or a bare id/handle. */
function ssStackContributors(owner, members) {
  function norm(x) {
    if (x == null) return null;
    if (typeof x === 'string') { var s = x.replace(/^@/, '').trim(); return s ? { id: s, username: s, name: s } : null; }
    if (typeof x === 'object') {
      var key = x.user_id || x.id || x.username;
      if (!key) return null;
      // Carry display name + curator flag through (additive — UX uses them to
      // show a real NAME and to gate clickability to curators only).
      return {
        id: String(key),
        username: (x.username != null ? x.username : String(key)),
        name: (x.name != null ? x.name : null),
        role: x.role,
        is_curator: !!x.is_curator
      };
    }
    return null;
  }
  var out = [], seen = {};
  var o = norm(owner);
  if (o) { out.push(o); seen[o.id] = true; }
  if (Array.isArray(members)) {
    for (var i = 0; i < members.length; i++) {
      var m = norm(members[i]);
      if (!m || seen[m.id]) continue;
      seen[m.id] = true;
      out.push(m);
    }
  }
  return out;
}

/* Allowed share-visibility options by role. Curator → all three; anyone else →
   private + unlisted (never public). `currentVisibility` only marks the current
   choice in the UI; it never widens the returned set. Reuses the same curator
   rule as the rest of stack-sharing (role 'curator' string or a truthy flag). */
function ssShareVisibilityOptions(role, currentVisibility) {
  var isCurator = (role === 'curator') || (role === true);
  return isCurator ? ['private', 'unlisted', 'public'] : ['private', 'unlisted'];
}

if (typeof window !== 'undefined') {
  window.SS_STACK_MEMBER_CAP    = SS_STACK_MEMBER_CAP;
  window.ssStackCanView         = ssStackCanView;
  window.ssStackIsListed        = ssStackIsListed;
  window.ssStackShelfPlacement  = ssStackShelfPlacement;
  window.ssCanContribute        = ssCanContribute;
  window.ssCanJoinStack         = ssCanJoinStack;
  window.ssCanRemoveStackItem   = ssCanRemoveStackItem;
  window.SS_STACK_PREVIEW_CAP   = SS_STACK_PREVIEW_CAP;
  window.ssStackPreviewClips    = ssStackPreviewClips;
  window.ssStackContributors    = ssStackContributors;
  window.ssShareVisibilityOptions = ssShareVisibilityOptions;
}

/* ── Impure stack-sharing helpers (DB / share-link / shared-load) ──
   These talk to Supabase (window.ssDB) + the get_shared_stack RPC (migration
   0022). All FAIL SOFT: they no-op for guests/offline/mock ids and never throw,
   so the app keeps working before the migration is applied. Window-only (they
   touch location/network) — the property-tested boundary is the pure block above. */

/* Owner UPDATE of a stack's visibility (+ optional highlight). Updates the
   local cache first for an instant UI, then mirrors to the DB fire-and-forget
   (mirrors the _ssDb* pattern). `highlighted` is only meaningful for public
   stacks; persisted to the existing `is_highlight` column. (Req 1.5, 3.1.) */
function ssSetStackVisibility(stackId, visibility, highlighted) {
  const v = (visibility === 'unlisted' || visibility === 'public') ? visibility : 'private';
  // Local cache first (instant UI).
  try {
    const stacks = ssGetStacks();
    const st = stacks.find(function (s) { return s.id === stackId; });
    if (st) {
      st.visibility = v;
      if (typeof highlighted === 'boolean') st.highlighted = highlighted;
      _ss_writeStacks(stacks);
    }
  } catch (e) { /* keep going — DB is the source of truth */ }
  // DB mirror (fire-and-forget, owner-scoped via RLS too).
  _ssTrackWrite((async function () {
    try {
      if (!window.ssDB || !window.ssCurrentUser) return;
      const me = window.ssCurrentUser();
      if (!me || !_ssIsUuid(stackId)) return;
      const patch = { visibility: v };
      if (typeof highlighted === 'boolean') patch.is_highlight = highlighted;
      const res = await window.ssDB.from('stacks').update(patch).eq('id', stackId).eq('user_id', me.id);
      if (res.error) console.warn('SS set visibility:', res.error.message);
    } catch (e) { /* keep UI working even if the write fails */ }
  })());
}

/* Build the shareable deep link for a stack — ONLY for non-private stacks
   (Req 5.1). Returns null for private/mock so callers can prompt instead.
   Never includes a show title. */
function ssStackShareUrl(stack) {
  try {
    if (!stack || !_ssIsUuid(stack.id)) return null;
    if (_ssStackVisibility(stack) === 'private') return null;
    const dir = location.pathname.replace(/[^/]*$/, '');   // → directory
    return location.origin + dir + 'showshak-stack.html?stack=' + encodeURIComponent(stack.id);
  } catch (e) { return null; }
}

/* Load a shared stack by id via the SECURITY DEFINER RPC (the ONLY read path
   for unlisted). Returns { stack, clips } with clips in the feed shape (mapped
   through the existing mappers), or null when unavailable/private/not-found/
   error — the caller shows an "unavailable" state (Req 4.1, 4.2). */
async function ssLoadSharedStackById(id) {
  if (!window.ssDB || !_ssIsUuid(id)) return null;
  try {
    const res = await window.ssDB.rpc('get_shared_stack', { p_stack_id: id });
    if (res.error || !res.data || !res.data.stack) return null;
    const rows  = res.data.clips || [];
    const base  = (typeof ssMapContentRowsToClips === 'function') ? ssMapContentRowsToClips(rows) : rows;
    const clips = (typeof ssClipsForFeed === 'function') ? ssClipsForFeed(base) : base;
    return {
      stack: res.data.stack,
      clips: clips,
      members: res.data.members || [],
      memberCount: res.data.member_count || 0,
      viewerIsMember: !!res.data.viewer_is_member
    };
  } catch (e) { return null; }
}

if (typeof window !== 'undefined') {
  window.ssSetStackVisibility  = ssSetStackVisibility;
  window.ssStackShareUrl       = ssStackShareUrl;
  window.ssLoadSharedStackById = ssLoadSharedStackById;
}

/* Resolve the signed-in user's account role ('user' | 'curator') from the
   `users` table, cached for the session. Used to gate curator-only UI such as
   the Public stack visibility option (Req 1.3, 1.4). Defaults to 'user' for
   guests / unknown / error / before-resolve, so the curator-only option is
   hidden until we positively know the account is a curator (fail safe). Migration
   0020 promotes role='curator' on first post, so this is reliable for posters. */
var _ssRoleCache = null;
async function ssResolveMyRole() {
  if (_ssRoleCache !== null) return _ssRoleCache;
  try {
    if (!window.ssDB || !window.ssCurrentUser) { _ssRoleCache = 'user'; return _ssRoleCache; }
    const me = window.ssCurrentUser();
    if (!me || !me.id) { _ssRoleCache = 'user'; return _ssRoleCache; }
    const { data } = await window.ssDB.from('users').select('role').eq('id', me.id).single();
    _ssRoleCache = (data && data.role === 'curator') ? 'curator' : 'user';
  } catch (e) { _ssRoleCache = 'user'; }
  return _ssRoleCache;
}
/* Synchronous best-effort read of the cached role (null until ssResolveMyRole
   resolves). Callers treat anything !== 'curator' as a normal user. */
function ssIsCuratorAccountSync() { return _ssRoleCache === 'curator'; }
if (typeof window !== 'undefined') {
  window.ssResolveMyRole = ssResolveMyRole;
  window.ssIsCuratorAccountSync = ssIsCuratorAccountSync;
}

/* ── Phase 2: collaborative-stack helpers (DB; fail soft, never throw) ──
   Authority is RLS + the cap-gated join_stack RPC (migration 0023); these are
   thin wrappers. They no-op for guests/offline/mock ids. */

/* Set a stack's mode ('view' | 'collaborative'). Local cache first, then DB
   mirror (owner-scoped). Only meaningful for shared (unlisted/public) stacks. */
function ssSetStackMode(stackId, mode) {
  const m = (mode === 'collaborative') ? 'collaborative' : 'view';
  try {
    const stacks = ssGetStacks();
    const st = stacks.find(s => s.id === stackId);
    if (st) { st.mode = m; _ss_writeStacks(stacks); }
  } catch (e) {}
  _ssTrackWrite((async function () {
    try {
      if (!window.ssDB || !window.ssCurrentUser) return;
      const me = window.ssCurrentUser();
      if (!me || !_ssIsUuid(stackId)) return;
      const res = await window.ssDB.from('stacks').update({ mode: m }).eq('id', stackId).eq('user_id', me.id);
      if (res.error) console.warn('SS set mode:', res.error.message);
    } catch (e) {}
  })());
}

/* Join a collaborative stack via the cap-gated RPC (the only join path).
   Returns the RPC result { ok, reason?, joined?, already? } or null on
   error/guest — the caller maps reasons ('signin'|'full'|'notcollab'|...). */
async function ssJoinStack(stackId) {
  if (!window.ssDB || !_ssIsUuid(stackId)) return null;
  try {
    const res = await window.ssDB.rpc('join_stack', { p_stack_id: stackId });
    if (res.error) { console.warn('SS join_stack:', res.error.message); return null; }
    return res.data || null;
  } catch (e) { return null; }
}

/* Add a clip to a collaborative shared stack WITH attribution (added_by = me).
   RLS allows this only for the owner or a member. De-dupes on the
   (stack_id, content_id) PK. Returns true on success/already-present. */
async function ssAddClipToSharedStack(stackId, clipId) {
  if (!window.ssDB || !window.ssCurrentUser || !_ssIsUuid(stackId) || !_ssIsUuid(clipId)) return false;
  try {
    const me = window.ssCurrentUser(); if (!me) return false;
    const { error } = await window.ssDB.from('stack_items')
      .insert({ stack_id: stackId, content_id: clipId, added_by: me.id });
    if (error && error.code !== '23505') { console.warn('SS add shared clip:', error.message); return false; }
    return true;
  } catch (e) { return false; }
}

/* Remove a single clip from a shared stack. RLS allows the owner (any item) or
   the contributor who added it (ssCanRemoveStackItem mirrors this client-side). */
async function ssRemoveSharedStackItem(stackId, clipId) {
  if (!window.ssDB || !_ssIsUuid(stackId) || !_ssIsUuid(clipId)) return false;
  try {
    const { error } = await window.ssDB.from('stack_items')
      .delete().eq('stack_id', stackId).eq('content_id', clipId);
    if (error) { console.warn('SS remove shared item:', error.message); return false; }
    return true;
  } catch (e) { return false; }
}

/* Leave a collaborative stack (delete your own non-owner membership). The owner
   row is RLS-protected from deletion, so the owner can never accidentally leave. */
async function ssLeaveStack(stackId) {
  if (!window.ssDB || !window.ssCurrentUser || !_ssIsUuid(stackId)) return false;
  try {
    const me = window.ssCurrentUser(); if (!me) return false;
    const { error } = await window.ssDB.from('stack_members')
      .delete().eq('stack_id', stackId).eq('user_id', me.id);
    if (error) { console.warn('SS leave stack:', error.message); return false; }
    return true;
  } catch (e) { return false; }
}

/* Owner removes a member (RLS: only the owner, never the owner row). The member's
   already-added clips remain unless the owner removes them too (Req 8.4). */
async function ssRemoveStackMember(stackId, userId) {
  if (!window.ssDB || !_ssIsUuid(stackId) || !_ssIsUuid(userId)) return false;
  try {
    const { error } = await window.ssDB.from('stack_members')
      .delete().eq('stack_id', stackId).eq('user_id', userId);
    if (error) { console.warn('SS remove member:', error.message); return false; }
    return true;
  } catch (e) { return false; }
}

if (typeof window !== 'undefined') {
  window.ssSetStackMode          = ssSetStackMode;
  window.ssJoinStack             = ssJoinStack;
  window.ssAddClipToSharedStack  = ssAddClipToSharedStack;
  window.ssRemoveSharedStackItem = ssRemoveSharedStackItem;
  window.ssLeaveStack            = ssLeaveStack;
  window.ssRemoveStackMember     = ssRemoveStackMember;
}


/* ════════════════════════════════════════════════
   SMOOTH PAGE NAVIGATION
════════════════════════════════════════════════ */
function ssNavigate(url) {
  // Phase 2: reconcile the manual fade with cross-document View Transitions so
  // exactly ONE animation runs (never both). The pure ssNavStrategy (Property 4)
  // owns the decision; here we only compute the real-environment booleans it
  // expects and branch on the result.
  try {
    // supportsViewTransition: presence of document.startViewTransition is a
    // reliable proxy for a browser that supports the View Transitions API. The
    // cross-document (MPA) transition is actually driven by the CSS
    // `@view-transition` opt-in + the navigation itself — we do NOT call
    // startViewTransition here; we only DECIDE whether to skip the manual fade.
    var supportsViewTransition =
      (typeof document !== 'undefined' && 'startViewTransition' in document);

    // reducedMotion: guarded so it never throws if matchMedia is unavailable;
    // defaults to false in that case.
    var reducedMotion = false;
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      reducedMotion = !!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    if (ssNavStrategy({ supportsViewTransition: supportsViewTransition, reducedMotion: reducedMotion }) === 'view-transition') {
      // Skip the manual opacity fade — the browser cross-fades old→new via the
      // CSS @view-transition opt-in. No 90ms manual hold (no double-animation).
      window.location.href = url;
      return;
    }
  } catch (_) {
    // Any error computing the environment → fall through to the manual-fade
    // path below. Never break navigation.
  }

  // 'instant' strategy (or fallback): keep today's behavior EXACTLY.
  document.body.style.transition = 'opacity 0.1s ease';
  document.body.style.opacity = '0';
  // Navigate almost immediately — the old 230ms hold was pure dead time before
  // the load even began. A short fade just acknowledges the tap; the SW serves
  // the next page's HTML from cache so it paints fast.
  setTimeout(() => { window.location.href = url; }, 90);
}

document.addEventListener('click', function(e) {
  const link = e.target.closest('a[href]');
  if (!link) return;
  const href = link.getAttribute('href');
  if (!href || href === '#' || href.startsWith('http') || link.hasAttribute('onclick')) return;
  const inNav = link.closest('.sidebar-nav') ||
                link.closest('.sidebar-bottom') ||
                link.closest('.mobile-bottom-nav') ||
                link.closest('.sidebar-logo');
  if (!inNav) return;
  e.preventDefault();
  ssNavigate(href);
});


/* ════════════════════════════════════════════════
   ── UNIVERSAL SAVE & STACKS SYSTEM ──────────────
   The DB (stacks / stack_items) is the source of truth. sessionStorage
   ('ss_stacks_v1') is an INSTANT-UI cache for fast same-tab reads: every
   write mirrors to the DB (_ssDb* helpers), and ssHydrateStacks() rebuilds
   the cache from the DB on login/refresh so it never drifts. Guests/offline
   use the cache alone.

   Storage key : 'ss_stacks_v1'
   Stack schema : { id, name, createdAt, clips[] }
   Clip schema  : { id, title, bg, platColor,
                    platLabel, caption, genre[], lang,
                    creator{ name, letter, bg } }

   Main entry point from any page:
     ssToggleSave(clip, saveBtnElement)

   Save button requirements:
     — add  data-save-id="${clip.id}"  to the button
     — add  .saved  class when already saved (call
       ssSyncSaveBtn(clip.id) after page renders)
════════════════════════════════════════════════ */

const SS_STACKS_KEY = 'ss_stacks_v1';

/* ── Storage read / write ──────────────────────── */

function ssGetStacks() {
  try {
    return JSON.parse(sessionStorage.getItem(SS_STACKS_KEY) || '[]');
  } catch { return []; }
}

function _ss_writeStacks(stacks) {
  try {
    sessionStorage.setItem(SS_STACKS_KEY, JSON.stringify(stacks));
  } catch (e) { console.warn('ShowShak: sessionStorage write failed', e); }
  // Notify any subscribed page (e.g. Watchlist) so it can re-render live.
  if (typeof _ssNotifyStacksChange === 'function') _ssNotifyStacksChange();
}

/* ── Read helpers ──────────────────────────────── */

function ssIsClipSaved(clipId) {
  return ssGetStacks().some(s => s.clips.some(c => c.id === clipId));
}

/* ── Stack operations ──────────────────────────── */

/* ── Stacks change notifications ───────────────────
   Any page can subscribe to be told when the Stacks data
   changes (created/renamed/deleted, clips added/removed),
   so it can re-render live without a refresh. This keeps
   page-specific logic OUT of shared.js — pages opt in.
     ssOnStacksChange(fn)  → register a listener
   _ss_writeStacks() fires all listeners after every write. */
const _ssStacksListeners = [];
function ssOnStacksChange(fn) {
  if (typeof fn === 'function') _ssStacksListeners.push(fn);
}
function _ssNotifyStacksChange() {
  _ssStacksListeners.forEach(fn => { try { fn(); } catch (e) { console.warn('ShowShak: stacks listener failed', e); } });
}


/* ════════════════════════════════════════════════
   UNIVERSAL FOLLOWING SYSTEM
   Single source of truth for which curators the user follows.
   Mirrors the Save/Stacks system: any page can follow/unfollow a
   curator and the Profile → Following list (and every Follow button)
   stays in sync. sessionStorage by design (fresh-start on the live
   page, like Stacks) — real persistence arrives with the backend.

   A "followed curator" record:
     { username, name, letter, bg, verified, clips }
   Only `username` is required; the rest hydrates the Following list.

   API (used across Feed, clip viewer, Discover, public profile):
     ssGetFollowing()            → array of followed curator records
     ssIsFollowing(username)     → bool
     ssToggleFollow(curator)     → flips; returns true if now following
     ssFollow(curator) / ssUnfollow(username)
     ssOnFollowingChange(fn)     → live re-render subscription
   ════════════════════════════════════════════════ */
const SS_FOLLOWING_KEY = 'ss_following_v1';
const _ssFollowListeners = [];

function ssGetFollowing() {
  try { return JSON.parse(sessionStorage.getItem(SS_FOLLOWING_KEY) || '[]'); }
  catch { return []; }
}
function _ss_writeFollowing(list) {
  try { sessionStorage.setItem(SS_FOLLOWING_KEY, JSON.stringify(list)); }
  catch (e) { console.warn('ShowShak: following write failed', e); }
  _ssFollowListeners.forEach(fn => { try { fn(); } catch (e) { console.warn('ShowShak: following listener failed', e); } });
}
function ssOnFollowingChange(fn) {
  if (typeof fn === 'function') _ssFollowListeners.push(fn);
}
function ssIsFollowing(username) {
  if (!username) return false;
  const u = String(username).replace(/^@/, '');
  return ssGetFollowing().some(c => c.username === u);
}
function ssFollow(curator) {
  const c = _ssNormalizeCurator(curator);
  if (!c) return false;
  const list = ssGetFollowing();
  if (!list.some(x => x.username === c.username)) { list.push(c); _ss_writeFollowing(list); }
  _ssDbFollow(c.username, true);   // persist to DB (fire-and-forget)
  return true;
}
function ssUnfollow(username) {
  if (!username) return false;
  const u = String(username).replace(/^@/, '');
  const list = ssGetFollowing().filter(c => c.username !== u);
  _ss_writeFollowing(list);
  _ssDbFollow(u, false);           // persist to DB (fire-and-forget)
  return false;
}

/* Persist a follow/unfollow to the DB. Resolves the curator's real
   user id from their @username, then inserts/deletes a follows row for
   the logged-in user. No-ops silently for guests or unknown curators
   (e.g. mock-only curators not seeded in the DB). */
async function _ssDbFollow(username, shouldFollow) {
  try {
    if (!window.ssDB || !window.ssCurrentUser) return;
    const me = window.ssCurrentUser();
    if (!me) return;
    const u = String(username).replace(/^@/, '');
    const { data: cur } = await window.ssDB.from('users').select('id').eq('username', u).single();
    if (!cur || !cur.id || cur.id === me.id) return;
    if (shouldFollow) {
      // insert (not upsert) — these rows are only inserted/deleted, never
      // updated, so we don't need (and shouldn't require) UPDATE privilege.
      // Ignore duplicate-key errors (already following).
      const { error } = await window.ssDB.from('follows').insert({ follower_id: me.id, creator_id: cur.id });
      if (error && error.code !== '23505') console.warn('ShowShak follow:', error.message);
    } else {
      await window.ssDB.from('follows').delete().eq('follower_id', me.id).eq('creator_id', cur.id);
    }
  } catch (e) { /* keep UI working even if the DB write fails */ }
}

/* Seed the local Following store from the DB (the source of truth for a
   signed-in user) so the count badge, the Follow buttons, and the Following
   list all agree — across sessions, not just within one tab. Mirrors
   ssHydrateStacks. REPLACES the local store with the DB set, which also cleans
   any stale/mock-only follows that never persisted. Guests keep their local
   store (this no-ops). Fires listeners so subscribed views re-render live. */
async function ssHydrateFollowing() {
  try {
    if (!window.ssDB || !window.ssCurrentUser) return;
    const me = window.ssCurrentUser(); if (!me) return;
    const { data, error } = await window.ssDB
      .from('follows')
      .select('creator:creator_id(username, name, avatar_url, verified)')
      .eq('follower_id', me.id)
      .is('deleted_at', null);
    if (error || !data) return;
    // Preserve any per-curator clip counts we already had locally (the follows
    // join doesn't carry them); default 0 otherwise.
    const prevClips = {};
    ssGetFollowing().forEach(p => { if (p && p.username) prevClips[p.username] = p.clips || 0; });
    const list = data.filter(r => r.creator && r.creator.username).map(r => {
      const u = r.creator.username;
      return {
        username: u,
        name:     r.creator.name || u,
        letter:   (r.creator.name || u || '?').charAt(0).toUpperCase(),
        bg:       '#EA3B32',
        verified: !!r.creator.verified,
        clips:    prevClips[u] || 0,
      };
    });
    _ss_writeFollowing(list);   // replace local store + fire listeners (live re-render)
  } catch (e) { /* keep UI working even if the hydrate fails */ }
}
if (typeof window !== 'undefined') window.ssHydrateFollowing = ssHydrateFollowing;

/* Persist a fire/unfire to the DB. Inserts/deletes a content_fires row
   for the logged-in user; the DB trigger keeps content.fires_count in
   sync. No-ops for guests or clips whose id isn't a real DB row (mock
   clips), so the prototype keeps working. */
async function _ssDbFire(clipId, shouldFire) {
  try {
    if (!window.ssDB || !window.ssCurrentUser) return;
    const me = window.ssCurrentUser();
    if (!me) return;
    // Real clip ids are uuids; mock ids are small integers — skip those.
    if (!/^[0-9a-f-]{36}$/i.test(String(clipId))) return;
    if (shouldFire) {
      // insert (not upsert) — fire rows are only inserted/deleted. Ignore
      // duplicate-key (already fired); the trigger keeps fires_count synced.
      const { error } = await window.ssDB.from('content_fires').insert({ user_id: me.id, content_id: clipId });
      if (error && error.code !== '23505') console.warn('ShowShak fire:', error.message);
    } else {
      await window.ssDB.from('content_fires').delete().eq('user_id', me.id).eq('content_id', clipId);
    }
  } catch (e) { /* keep UI working even if the DB write fails */ }
}
function ssToggleFollow(curator) {
  const c = _ssNormalizeCurator(curator);
  if (!c) return false;
  return ssIsFollowing(c.username) ? ssUnfollow(c.username) : ssFollow(c);
}
/* Accepts a username string OR a partial curator object from any page. */
function _ssNormalizeCurator(curator) {
  if (!curator) return null;
  if (typeof curator === 'string') {
    const u = curator.replace(/^@/, '');
    return u ? { username: u, name: u, letter: u.charAt(0).toUpperCase(), bg: '#EA3B32', verified: false, clips: 0 } : null;
  }
  const u = String(curator.username || curator.name || '').replace(/^@/, '');
  if (!u) return null;
  return {
    username: u,
    name:     curator.name || u,
    letter:   (curator.letter || u.charAt(0)).toUpperCase(),
    bg:       curator.bg || curator.color || '#EA3B32',
    verified: !!curator.verified,
    clips:    curator.clips != null ? curator.clips : (curator.clipCount != null ? curator.clipCount : 0),
  };
}

/* ── OPEN A CURATOR PROFILE (app-wide) ───────────────────────────
   Tapping a curator's name/avatar on ANY clip (Feed, clip viewer,
   Discover results, Watchlist, Profile grids) opens their PUBLIC
   profile. We stash the curator object so the profile page can render
   real data with no backend yet (same handoff Discover search uses).
   Accepts a username string or a partial curator object. */
function ssOpenCurator(curator) {
  const c = _ssNormalizeCurator(curator);
  if (!c) return;
  try { sessionStorage.setItem('ss_view_curator_v1', JSON.stringify({
    username: c.username, name: c.name, letter: c.letter, bg: c.bg,
    verified: c.verified, clipCount: c.clips,
  })); } catch (e) {}
  const url = 'showshak-profile.html?face=public&curator=' + encodeURIComponent(c.username);
  // If a full-screen clip viewer is open, tear it down first so we don't
  // navigate "underneath" it.
  if (typeof ssCloseClip === 'function') {
    const v = document.getElementById('ss-clip-viewer');
    if (v && v.classList.contains('open')) ssCloseClip();
  }
  if (typeof ssNavigate === 'function') ssNavigate(url);
  else window.location.href = url;
}

/* Wire any element declaratively as a "open this curator" trigger:
   give it  data-curator="<username>"  (+ optional data-curator-name /
   -letter / -bg / -verified). ssWireCuratorLinks(root) attaches the
   click handler (and stops propagation so it doesn't trigger the clip).
   Pages call this after rendering clip/creator markup. */
function ssWireCuratorLinks(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-curator]').forEach(el => {
    if (el._ssCuratorWired) return;
    el._ssCuratorWired = true;
    el.style.cursor = 'pointer';
    el.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      ssOpenCurator({
        username: el.getAttribute('data-curator'),
        name:     el.getAttribute('data-curator-name'),
        letter:   el.getAttribute('data-curator-letter'),
        bg:       el.getAttribute('data-curator-bg'),
        verified: el.getAttribute('data-curator-verified') === '1',
      });
    });
  });
}

/* Wire any Follow button declaratively. Give the button:
     data-follow="<username>"  (+ optional data-follow-* attrs for the
     name/letter/bg/verified/clips so the Following list shows real info).
   This sets initial label and toggles on click, app-wide. Pages call
   ssWireFollowButtons() after they render clip/curator markup. */
function ssWireFollowButtons(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-follow]').forEach(btn => {
    if (btn._ssFollowWired) { _ssPaintFollowBtn(btn); return; }
    btn._ssFollowWired = true;
    _ssPaintFollowBtn(btn);
    btn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      ssToggleFollow({
        username: btn.getAttribute('data-follow'),
        name:     btn.getAttribute('data-follow-name'),
        letter:   btn.getAttribute('data-follow-letter'),
        bg:       btn.getAttribute('data-follow-bg'),
        verified: btn.getAttribute('data-follow-verified') === '1',
        clips:    parseInt(btn.getAttribute('data-follow-clips') || '0', 10),
      });
      // Repaint every button for this curator everywhere on the page.
      _ssRepaintAllFollowButtons();
      const u = btn.getAttribute('data-follow').replace(/^@/, '');
      ssToast(ssIsFollowing(u) ? `Following @${u}` : `Unfollowed @${u}`);
    });
  });
}
function _ssPaintFollowBtn(btn) {
  const following = ssIsFollowing(btn.getAttribute('data-follow'));
  btn.classList.toggle('is-following', following);
  // Respect a compact style (just "Follow"/"Following") vs "+ Follow".
  const plus = btn.hasAttribute('data-follow-plus');
  btn.textContent = following ? 'Following' : (plus ? '+ Follow' : 'Follow');
}
function _ssRepaintAllFollowButtons() {
  document.querySelectorAll('[data-follow]').forEach(_ssPaintFollowBtn);
}
// Keep buttons in sync if following changes from elsewhere (e.g. viewer).
ssOnFollowingChange(_ssRepaintAllFollowButtons);

function ssCreateStack(name) {
  const stacks = ssGetStacks();
  const id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('stack_' + Date.now());
  const stack  = { id: id, name: name.trim(), createdAt: Date.now(), visibility: 'private', highlighted: false, mode: 'view', clips: [] };
  stacks.push(stack);
  _ss_writeStacks(stacks);
  _ssDbCreateStack(stack);   // mirror to DB so it persists past the tab session
  return stack;
}

function ssRenameStack(stackId, name) {
  const clean = (name || '').trim();
  if (!clean) return false;
  const stacks = ssGetStacks();
  const stack  = stacks.find(s => s.id === stackId);
  if (!stack) return false;
  stack.name = clean;
  _ss_writeStacks(stacks);   // fires listeners → live re-render
  return true;
}

function ssAddClipToStack(stackId, clip) {
  const stacks = ssGetStacks();
  const stack  = stacks.find(s => s.id === stackId);
  if (!stack) return;
  if (stack.clips.some(c => c.id === clip.id)) return; // no duplicates
  stack.clips.unshift(clip);                            // newest first
  _ss_writeStacks(stacks);
  _ssTrackWrite(_ssDbAddClip(stackId, clip.id));
}

function ssRemoveClipFromStack(stackId, clipId) {
  const stacks = ssGetStacks();
  const stack  = stacks.find(s => s.id === stackId);
  if (!stack) return;
  stack.clips = stack.clips.filter(c => c.id !== clipId);
  _ss_writeStacks(stacks);
  _ssTrackWrite(_ssDbRemoveClip(stackId, clipId));
}

function ssRemoveClipFromAllStacks(clipId) {
  const stacks = ssGetStacks();
  const affected = stacks.filter(s => s.clips.some(c => String(c.id) === String(clipId))).map(s => s.id);
  stacks.forEach(s => { s.clips = s.clips.filter(c => c.id !== clipId); });
  _ss_writeStacks(stacks);
  affected.forEach(sid => _ssDbRemoveClip(sid, clipId));
}

/* Stacks DB mirror (insert/delete only — never upsert; lesson #3). */
function _ssIsUuid(v) { return /^[0-9a-f-]{36}$/i.test(String(v)); }
const _ssStackCreates = {};   // stackId -> Promise (so adds wait for the create)
// Track in-flight stack writes so hydrate doesn't overwrite a save that
// hasn't reached the DB yet (prevents the "empty folder" clobber).
let _ssPendingWrites = [];
function _ssTrackWrite(p) {
  if (!p || typeof p.then !== 'function') return;
  _ssPendingWrites.push(p);
  p.finally(() => { _ssPendingWrites = _ssPendingWrites.filter(x => x !== p); });
}
async function _ssDbCreateStack(stack) { const p=(async()=>{ try { if(!window.ssDB||!window.ssCurrentUser)return; const me=window.ssCurrentUser(); if(!me||!_ssIsUuid(stack.id))return; const {error}=await window.ssDB.from('stacks').insert({id:stack.id,user_id:me.id,name:stack.name}); if(error&&error.code!=='23505')console.warn('SS stack create:',error.message);}catch(e){} })(); _ssStackCreates[stack.id]=p; return p; }
async function _ssDbRenameStack(stackId,name){ try{ if(!window.ssDB||!window.ssCurrentUser)return; const me=window.ssCurrentUser(); if(!me||!_ssIsUuid(stackId))return; await window.ssDB.from('stacks').update({name:name}).eq('id',stackId).eq('user_id',me.id);}catch(e){} }
async function _ssDbDeleteStack(stackId){ try{ if(!window.ssDB||!window.ssCurrentUser)return; const me=window.ssCurrentUser(); if(!me||!_ssIsUuid(stackId))return; await window.ssDB.from('stack_items').delete().eq('stack_id',stackId); await window.ssDB.from('stacks').delete().eq('id',stackId).eq('user_id',me.id);}catch(e){} }
async function _ssDbAddClip(stackId,clipId){ try{ if(!window.ssDB||!window.ssCurrentUser)return; const me=window.ssCurrentUser(); if(!me||!_ssIsUuid(stackId)||!_ssIsUuid(clipId))return; if(_ssStackCreates[stackId])await _ssStackCreates[stackId]; const {error}=await window.ssDB.from('stack_items').insert({stack_id:stackId,content_id:clipId,added_by:me.id}); if(error&&error.code!=='23505')console.warn('SS stack add:',error.message);}catch(e){} }
async function _ssDbRemoveClip(stackId,clipId){ try{ if(!window.ssDB||!window.ssCurrentUser)return; const me=window.ssCurrentUser(); if(!me||!_ssIsUuid(stackId)||!_ssIsUuid(clipId))return; await window.ssDB.from('stack_items').delete().eq('stack_id',stackId).eq('content_id',clipId);}catch(e){} }

/* Hydrate the local Stacks store from the DB (so saved clips persist
   across sessions/devices). Loads the users stacks + their items + the
   linked clip display data, rebuilds the sessionStorage store in the
   shape the Watchlist renders, then notifies listeners. No-op for guests. */
function _ssHexToRgb(hex) {
  if (!hex) return null;
  const m = String(hex).replace('#','').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return parseInt(m[1],16) + ',' + parseInt(m[2],16) + ',' + parseInt(m[3],16);
}
async function ssHydrateStacks() {
  try {
    if (!window.ssDB || !window.ssCurrentUser) return;
    const me = window.ssCurrentUser(); if (!me) return;
    // Wait for any in-flight saves to land first, so we never overwrite a
    // just-saved clip with a stale DB snapshot (the "empty folder" clobber).
    if (_ssPendingWrites.length) { try { await Promise.all(_ssPendingWrites); } catch (e) {} }
    const { data: stacks, error } = await window.ssDB
      .from('stacks')
      .select('id, name, created_at, visibility, is_highlight, mode, stack_items(content_id, added_by, adder:added_by(username), content:content_id(id, description, fires_count, meta, mux_playback_id, thumbnail_url, creator:creator_id(username), platform:platform_id(name,color,abbr)))')
      .eq('user_id', me.id).is('deleted_at', null);
    if (error || !stacks) return;
    const mapped = stacks.map(st => ({
      id: st.id, name: st.name, createdAt: st.created_at ? Date.parse(st.created_at) : Date.now(),
      visibility: st.visibility || 'private', highlighted: !!st.is_highlight, mode: st.mode || 'view',
      ownerId: me.id, joined: false,
      clips: (st.stack_items || []).filter(it => it.content).map(it => {
        const c = it.content, meta = c.meta || {}, p = c.platform || {}, cr = c.creator || {};
        return { id: c.id, title: '', bg: meta.bg || 'linear-gradient(160deg,#1a0505,#2d0808,#0d0d0d,#000)',
          // Poster: stored thumbnail (cover frame) else derive the Mux still-frame
          // from the playback id, so saved-stack frames show the real thumbnail.
          muxPlaybackId: c.mux_playback_id || null,
          poster: c.thumbnail_url || (c.mux_playback_id ? ssCoverThumbUrl(c.mux_playback_id, (typeof meta.cover_time === 'number' && meta.cover_time > 0) ? meta.cover_time : undefined) : null),
          platColor: p.color || '#EA3B32', platLabel: p.name || '', platAbbr: p.abbr || '', platRgb: _ssHexToRgb(p.color) || '234,59,50',
          caption: c.description || '', genre: Array.isArray(meta.genres) ? meta.genres.slice() : [], lang: meta.lang || '', fires: c.fires_count || 0,
          addedBy: it.added_by || null, addedByName: (it.adder && it.adder.username) || null,
          creator: { name: cr.username || 'curator', letter: (cr.username||'C').charAt(0).toUpperCase(), bg: '#EA3B32' } };
      })
    }));

    // JOINED collaborative stacks: stacks where I'm a member but NOT the owner.
    // Read my membership rows (RLS lets me see my own), then load each via the
    // get_shared_stack RPC (the only read path for unlisted). Fully isolated +
    // fail-soft so the owned-stacks store is never affected by a failure here.
    const joinedMapped = [];
    try {
      const { data: memRows } = await window.ssDB
        .from('stack_members').select('stack_id, role').eq('user_id', me.id);
      const ownedIds = new Set(mapped.map(s => s.id));
      const joinIds = (memRows || [])
        .filter(m => m.role !== 'owner')
        .map(m => m.stack_id)
        .filter(id => _ssIsUuid(id) && !ownedIds.has(id));
      for (const sid of joinIds) {
        try {
          const res = await window.ssDB.rpc('get_shared_stack', { p_stack_id: sid });
          const d = res && res.data;
          if (!d || !d.stack) continue;
          joinedMapped.push({
            id: d.stack.id, name: d.stack.name || 'Shared stack', createdAt: Date.now(),
            visibility: d.stack.visibility || 'unlisted', highlighted: !!d.stack.highlighted,
            mode: d.stack.mode || 'view', joined: true, ownerId: d.stack.user_id,
            clips: (d.clips || []).map(rc => {
              const meta = rc.meta || {}, p = rc.platform || {}, cr = rc.creator || {};
              return { id: rc.id, title: '', bg: meta.bg || 'linear-gradient(160deg,#1a0505,#2d0808,#0d0d0d,#000)',
                muxPlaybackId: rc.mux_playback_id || null,
                poster: rc.thumbnail_url || (rc.mux_playback_id ? ssCoverThumbUrl(rc.mux_playback_id, (typeof meta.cover_time === 'number' && meta.cover_time > 0) ? meta.cover_time : undefined) : null),
                platColor: p.color || '#EA3B32', platLabel: p.name || '', platAbbr: p.abbr || '', platRgb: _ssHexToRgb(p.color) || '234,59,50',
                caption: rc.description || '', genre: Array.isArray(meta.genres) ? meta.genres.slice() : [], lang: meta.lang || '', fires: rc.fires_count || 0,
                addedBy: rc.added_by || null, addedByName: rc.added_by_username || null,
                creator: { name: cr.username || 'curator', letter: (cr.username||'C').charAt(0).toUpperCase(), bg: '#EA3B32' } };
            })
          });
        } catch (e) { /* skip this one joined stack; keep the rest */ }
      }
    } catch (e) { /* no joined stacks / table not present yet → owned-only */ }

    const all = mapped.concat(joinedMapped);
    try { sessionStorage.setItem(SS_STACKS_KEY, JSON.stringify(all)); } catch (e) {}
    if (typeof _ssNotifyStacksChange === 'function') _ssNotifyStacksChange();
    if (typeof ssSyncAllSaveBtns === 'function') ssSyncAllSaveBtns();
  } catch (e) { /* keep local store on failure */ }
}

/* ════════════════════════════════════════════════
   ── UNIFIED CLIP LOADER (one source for every page) ──
   Single place every page gets its clips from, so they all carry real
   DB UUIDs and the shared save/fire/follow functions work identically
   everywhere. Returns a normalized base shape; per-page adapters below
   reshape it to what feed/discover expect. Falls back to [] on failure
   (callers keep their mock data), so guests/offline still work.
   ════════════════════════════════════════════════ */
function _ssHexRgb(h){ var m=String(h||"").replace("#","").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i); return m?(parseInt(m[1],16)+","+parseInt(m[2],16)+","+parseInt(m[3],16)):"234,59,50"; }

/* ════════════════════════════════════════════════
   WATCH IT — region + subscription resolution (cached)
   ─────────────────────────────────────────────────────
   Both caches are invalidated on auth state change (see the guest
   gate's onAuthStateChange handler) so sign-in/out re-resolves. */
let _ssRegion = null, _ssSubIds = null;

// users.region for the signed-in user; default 'IN' for guests/unknown/error (R9).
async function ssGetRegion() {
  if (_ssRegion) return _ssRegion;
  try {
    const me = window.ssCurrentUser && window.ssCurrentUser();
    if (me && window.ssDB) {
      const { data } = await window.ssDB.from('users').select('region').eq('id', me.id).single();
      _ssRegion = (data && data.region) || 'IN';
    } else { _ssRegion = 'IN'; }
  } catch (e) { _ssRegion = 'IN'; }   // R9.2 default
  return _ssRegion;
}
// Invalidate the cached region/subscriptions so the next Watch It resolve re-reads
// the DB (used after Settings changes the region or platforms in the same session).
function ssInvalidateRegion() { _ssRegion = null; }
function ssInvalidateSubs() { _ssSubIds = null; }
if (typeof window !== 'undefined') { window.ssInvalidateRegion = ssInvalidateRegion; window.ssInvalidateSubs = ssInvalidateSubs; }

/* Check whether a @handle is available (unique across ALL users — normal users
   and curators alike). Case-INSENSITIVE (ilike), excludes the caller's own id so
   keeping your current handle reads as available. Returns
   { ok, reason:'empty'|'invalid'|'taken'|'error'|null, clean }. Impure (DB),
   never throws. Used by the Settings handle editor (and reusable at signup). */
async function ssCheckUsernameAvailable(username, excludeId) {
  var clean = (typeof ssNormalizeCuratorUsername === 'function')
    ? (ssNormalizeCuratorUsername(username) || '')
    : String(username == null ? '' : username).replace(/^@/, '').trim();
  if (!clean) return { ok: false, reason: 'empty', clean: '' };
  if (!/^[a-zA-Z0-9_.]{2,30}$/.test(clean)) return { ok: false, reason: 'invalid', clean: clean };
  if (!window.ssDB) return { ok: false, reason: 'error', clean: clean };
  try {
    // ilike gives case-insensitivity, but `_` and `%` are LIKE wildcards — escape
    // them so a handle with an underscore matches literally (not as "any char").
    var pattern = clean.replace(/[\\%_]/g, function (m) { return '\\' + m; });
    var res = await window.ssDB.from('users').select('id').ilike('username', pattern);
    if (res.error) return { ok: false, reason: 'error', clean: clean };
    var taken = (res.data || []).some(function (r) { return r.id !== excludeId; });
    return { ok: !taken, reason: taken ? 'taken' : null, clean: clean };
  } catch (e) { return { ok: false, reason: 'error', clean: clean }; }
}
if (typeof window !== 'undefined') window.ssCheckUsernameAvailable = ssCheckUsernameAvailable;

// Set of platform_id the signed-in user holds; empty Set for guests/error (R8.2, R8.3).
async function ssGetSubscribedPlatformIds() {
  if (_ssSubIds) return _ssSubIds;
  _ssSubIds = new Set();
  try {
    const me = window.ssCurrentUser && window.ssCurrentUser();
    if (me && window.ssDB) {
      const { data } = await window.ssDB.from('user_subscriptions')
        .select('platform_id').eq('user_id', me.id).is('deleted_at', null);
      (data || []).forEach(function (r) { _ssSubIds.add(r.platform_id); });
    }
  } catch (e) { /* R8.3 — swallow, leave set empty */ }
  return _ssSubIds;
}

// Best-effort memoized Platform_Catalog loader (impure: one network read).
// Caches an { id → { platform_id, name, color, abbr } } map used by
// _ssFetchSheetTitles to resolve curator-declared platform ids into the
// CatalogPlatform shape the pure resolver expects. On any failure returns an
// empty map; never throws. NOT part of the pure export block — the pure
// resolver never calls it; declarations are handed to it as plain data.
let _ssPlatCatalog = null;
async function _ssPlatformCatalogMap() {
  if (_ssPlatCatalog) return _ssPlatCatalog;
  _ssPlatCatalog = {};
  try {
    if (window.ssDB) {
      const { data } = await window.ssDB.from('platforms').select('id, name, color, abbr');
      (data || []).forEach(function (r) {
        if (r && r.id) {
          _ssPlatCatalog[r.id] = { platform_id: r.id, name: r.name, color: r.color, abbr: r.abbr };
        }
      });
    }
  } catch (e) { /* best-effort — leave map empty on failure */ }
  return _ssPlatCatalog;
}
window.ssGetRegion = ssGetRegion;
window.ssGetSubscribedPlatformIds = ssGetSubscribedPlatformIds;

/* The one resolver that turns a clip's cached providers into sheet options.
   Feed, Discover, and the unified viewer all funnel through it so Watch It
   behaves identically everywhere. It never throws on missing providers,
   region, or subs (R6.3, R8.3). */
/* Local name normalization for dedup, mirroring the TMDB-match normalization:
   NFKD-strip diacritics, lowercase, trim. Pure; never throws on non-strings. */
function _ssNormalizePlatformName(s) {
  try {
    return String(s == null ? '' : s)
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim();
  } catch (e) {
    return '';
  }
}

/* Dedup key for a resolved option: its platform_id when present, else its
   normalized name. First occurrence wins; TMDB-sourced instances are kept
   ahead of declared duplicates (concat order). */
function _ssDedupKey(option) {
  return (option && option.platform_id)
    ? option.platform_id
    : _ssNormalizePlatformName(option && option.name);
}

function ssResolveWatchOptions(clip, region, subscribedPlatformIds) {
  // Only a non-empty string region is honoured; anything else (falsy, or a
  // hostile non-string that would throw on key coercion) defaults to 'IN'
  // (R7.2 + Property 9 totality).
  region = (typeof region === 'string' && region) ? region : 'IN';
  // Guard subs: only a real Set (has a `.has` method) is honoured; anything else
  // (array, null, junk) degrades to an empty set so we never throw (Property 9).
  const subs = (subscribedPlatformIds && typeof subscribedPlatformIds.has === 'function')
    ? subscribedPlatformIds
    : new Set();

  const NEUTRAL_COLOR = 'var(--ss-neutral, #2a2a2a)';

  // ── Gather the two sources for the region, guarding every access. ──
  let tmdb = (clip && clip.providers && clip.providers[region]) || [];
  if (!Array.isArray(tmdb)) tmdb = [];

  let declared = (clip && clip.declaredPlatforms && clip.declaredPlatforms[region]) || [];
  if (!Array.isArray(declared)) declared = [];
  // Backward compat: no declarations but a legacy curatorPlat → treat as declared.
  if (!declared.length && clip && clip.curatorPlat) declared = [clip.curatorPlat];

  const hadTmdb = tmdb.length > 0;

  // ── Map TMDB providers to the unified Watch_Option shape (R5.1/5.3, R11). ──
  const mapTmdb = function (entry) {
    const e        = entry || {};
    const included = !!(e.platform_id && subs.has(e.platform_id));
    return {
      name:        e.catalog_name || e.provider_name,
      color:       e.color ? e.color : NEUTRAL_COLOR,
      label:       e.abbr || (e.provider_name ? String(e.provider_name).charAt(0) : '▶'),
      sub:         included ? 'In your plan' : 'Available to stream',
      included:    included,
      platform_id: e.platform_id || null
    };
  };

  // ── Backward-compatibility guard (Property 10): with NO curator declarations
  //    the result is EXACTLY today's behaviour — the legacy 1:1 TMDB mapping
  //    (NOT de-duplicated, preserving any duplicate provider rows as before),
  //    else the neutral message. The de-duplicated union (below) governs only
  //    the merge case where declarations are present, so the two regions of the
  //    input space never overlap. ──
  if (!declared.length) {
    if (hadTmdb) {
      const options = tmdb.map(mapTmdb);
      options.sort(function (a, b) { return (b.included ? 1 : 0) - (a.included ? 1 : 0); });
      return { options: options, fallback: false, message: null };
    }
    return { options: [], fallback: true, message: 'Not available to stream in your region' };
  }

  // ── Map curator-declared platforms to the identical shape. ──
  const declaredOptions = declared.map(function (entry) {
    const d        = entry || {};
    const included = !!(d.platform_id && subs.has(d.platform_id));
    return {
      name:        d.name,
      color:       d.color ? d.color : NEUTRAL_COLOR,
      label:       d.abbr || (d.name ? String(d.name).charAt(0) : '▶'),
      sub:         included ? 'In your plan' : 'Available to stream',
      included:    included,
      platform_id: d.platform_id || null
    };
  });

  // ── De-duplicated union: TMDB first, then declared. First occurrence wins;
  //    a dropped duplicate ORs its `included` into the kept option (R4.2). ──
  const byKey = {};
  const merged = [];
  tmdb.map(mapTmdb).concat(declaredOptions).forEach(function (opt) {
    const key = _ssDedupKey(opt);
    if (Object.prototype.hasOwnProperty.call(byKey, key)) {
      const kept = byKey[key];
      kept.included = kept.included || opt.included;
      kept.sub = kept.included ? 'In your plan' : 'Available to stream';
    } else {
      byKey[key] = opt;
      merged.push(opt);
    }
  });

  // ── In_Your_Plan first, otherwise stable order (R6.2). ──
  merged.sort(function (a, b) { return (b.included ? 1 : 0) - (a.included ? 1 : 0); });

  // declared is non-empty here, so `merged` is always non-empty.
  // fallback === true IFF there were NO TMDB providers (declared-only result).
  return { options: merged, fallback: !hadTmdb, message: null };
}
window.ssResolveWatchOptions = ssResolveWatchOptions;

/* Pure Content_Row → Clip mapper (no Supabase, no DOM, no network).
   Filters to live, non-deleted rows then applies the row→clip Mux projection.
   Kept pure so it is Node-testable on arbitrary row arrays; ssLoadClips
   delegates its filter + projection here (Req 4.1, 4.2, 4.3, 4.4). The
   status/deleted_at guard mirrors the SQL pre-filter so the helper is correct
   even when fed rows that did not pass through the query (Req 2.3, 12.3). */
function ssMapContentRowsToClips(rows){
  if(!rows || !rows.length) return [];
  return rows.filter(function(row){
    // Only live, non-deleted rows survive (Req 4.3, 2.3, 12.3).
    return row && row.status === "live" && (row.deleted_at == null);
  }).map(function(row){
    var meta=row.meta||{}, p=row.platform||{}, t=row.title||{}, cr=row.creator||{};
    // Moods/vibes: v2 writes the canonical `meta.vibes` (string[]); legacy rows
    // carry `meta.mood` (a JSON-stringified array). Read vibes first, else fall
    // back to the legacy field so both old and uploaded clips surface moods.
    var mood=[];
    if (Array.isArray(meta.vibes)) { mood = meta.vibes.slice(); }
    else { try{ mood=JSON.parse(meta.mood||"[]"); }catch(e){} }
    var uname=cr.username||"curator";
    return {
      id: row.id,
      title: t.name||"", year: t.year||"", synopsis: t.synopsis||"",
      caption: row.description||"", fires: row.fires_count||0, views: row.views_count||0,
      genre: Array.isArray(meta.genres) ? meta.genres.slice() : [], mood: mood, lang: meta.lang||"", season: meta.season||"",
      bg: meta.bg||"linear-gradient(160deg,#1a0505,#2d0808,#0d0d0d,#000)",
      // Mux playback fields: null muxPlaybackId → GradientSurface fallback (Req 4.2, 4.4).
      muxPlaybackId: row.mux_playback_id || null,
      // Poster: prefer the stored thumbnail_url (the webhook bakes in the cover
      // frame); else derive the Mux still-frame from the playback id (+ cover_time)
      // so every live clip has a real frame everywhere it's rendered. Null only
      // when there's no playback id yet (still processing) → gradient fallback.
      poster: row.thumbnail_url || (row.mux_playback_id ? ssCoverThumbUrl(row.mux_playback_id, (typeof meta.cover_time === 'number' && meta.cover_time > 0) ? meta.cover_time : undefined) : null),
      url: row.url || null,
      durationSec: row.duration_sec || null,
      platLabel: p.name||"Streaming", platColor: p.color||"#EA3B32",
      platAbbr: p.abbr||(p.name?p.name.charAt(0):"▶"), platRgb: _ssHexRgb(p.color),
      // Watch It cache (region-keyed Provider_Cache) + curator fallback platform.
      providers: t.providers || {},
      cachedAt: t.cached_at || null,
      curatorPlat: (p && p.name) ? { platform_id: p.id||null, name: p.name, color: p.color, abbr: p.abbr } : null,
      creator: { name: uname, letter: uname.charAt(0).toUpperCase(), bg: "#EA3B32", avatar: cr.avatar_url||null }
    };
  });
}

/* IMPURE — today's flat newest-first feed, extracted verbatim so it is the single
   safe degradation path used by the Phase 2 ssLoadClips orchestration. Live,
   non-deleted rows, created_at desc, .range() page slice, mapped via the pure
   ssMapContentRowsToClips. Any query error / no data / throw → empty page ([]),
   never propagated (Req 8.6, 8.7). Window-only impure helper (touches window.ssDB)
   — intentionally NOT added to module.exports. */
async function _ssFeedFallbackPage(limit, offset){
  if(!window.ssDB) return [];
  var n = limit||50, off = offset||0;
  try{
    var res = await window.ssDB.from("content")
      .select("id, description, fires_count, views_count, meta, status, mux_playback_id, url, thumbnail_url, duration_sec, creator:creator_id(username,name,avatar_url), title:title_id(name,year,synopsis,providers,cached_at), platform:platform_id(id,name,color,abbr)")
      .eq("status","live").is("deleted_at",null).order("created_at",{ascending:false}).range(off, off + n - 1);
    if(res.error || !res.data || !res.data.length) return [];
    // Filter + projection delegated to the pure helper (the SQL filter above
    // remains an efficient DB-side pre-filter; the helper re-enforces it).
    return ssMapContentRowsToClips(res.data);
  }catch(e){ return []; }
}
/* ssLoadClips(limit, offset) — IMPURE, CHANGED (feed-follows Phase 2, task 6).
   Orchestrates the pure tiered ranker behind the candidate fetch + hydrate, with
   the on-device kill switch and automatic flat-feed fallback. Signature and the
   returned clip shape are unchanged (Req 7.3); every failure path degrades to
   today's flat feed (Req 8.1, 8.2). See .kiro/specs/feed-follows
   (design.md §"ssLoadClips(limit, offset) — IMPURE, CHANGED"). */
async function ssLoadClips(limit, offset){
  var n = limit||50, off = offset||0;
  // Kill switch (on-device, no redeploy): ss_ff_ranker === 'off' → today's flat feed.
  try {
    if (typeof localStorage !== 'undefined' && localStorage && localStorage.getItem('ss_ff_ranker') === 'off') {
      return _ssFeedFallbackPage(n, off);
    }
  } catch (e) { /* ignore storage errors; continue to ranker */ }
  try {
    if (!window.ssDB) return [];                         // preserve today's guest/offline behavior
    var session = await _ssEnsureFeedSession();          // builds + caches Ranked_List once per session
    if (!session) return _ssFeedFallbackPage(n, off);    // candidate fetch failed (Req 8.1)
    var pageIds = ssSliceRankedPage(session.rankedIds, n, off);   // PURE page slice (Req 6)
    if (!pageIds.length) return [];                      // past the end / empty page
    // Hydrate the page's full rows with the EXISTING rich select (scoreboard-safe,
    // unchanged projection), re-enforcing live/non-deleted; .in() does NOT preserve order.
    var res = await window.ssDB.from("content")
      .select("id, description, fires_count, views_count, meta, status, mux_playback_id, url, thumbnail_url, duration_sec, creator:creator_id(username,name,avatar_url), title:title_id(name,year,synopsis,providers,cached_at), platform:platform_id(id,name,color,abbr)")
      .in("id", pageIds).eq("status","live").is("deleted_at",null);
    if (res.error || !res.data) return _ssFeedFallbackPage(n, off);   // hydration error (Req 8.2)
    // Reorder hydrated rows to match pageIds order (since .in() is unordered),
    // dropping any id that didn't hydrate (e.g. unpublished between fetch + hydrate).
    var byId = {};
    res.data.forEach(function (row) { byId[row.id] = row; });
    var ordered = [];
    pageIds.forEach(function (id) { if (byId[id]) ordered.push(byId[id]); });
    return ssMapContentRowsToClips(ordered);             // unchanged clip shape (Req 7.3)
  } catch (e) {
    return _ssFeedFallbackPage(n, off);                  // ranker/hydration throw (Req 8.2)
  }
}
/* FEED shape: titles shown, raw cache carried for the Watch It sheet resolver. */
function ssClipsForFeed(base){ return base.map(function(c){ return {
  id:c.id, title:(c.title||"").toUpperCase(), year:c.year, genre:c.genre, lang:c.lang,
  season:c.season, synopsis:c.synopsis, caption:c.caption, creator:c.creator, litCount:c.fires, views:c.views,
  providers:c.providers, curatorPlat:c.curatorPlat,
  muxPlaybackId:c.muxPlaybackId, poster:c.poster,
  platLabel:(c.curatorPlat&&c.curatorPlat.name)||c.platLabel, platColor:(c.curatorPlat&&c.curatorPlat.color)||c.platColor, platRgb:c.platRgb, bg:c.bg }; }); }
/* DISCOVER shape: title hidden, mood[] kept, raw cache carried for the resolver. */
function ssClipsForDiscover(base){ return base.map(function(c){ return {
  id:c.id, caption:c.caption, genre:c.genre, lang:c.lang, platLabel:c.platLabel, platColor:c.platColor,
  platAbbr:c.platAbbr, platRgb:c.platRgb, creator:c.creator, fires:c.fires, views:c.views, bg:c.bg, mood:c.mood,
  muxPlaybackId:c.muxPlaybackId, poster:c.poster,
  providers:c.providers, curatorPlat:c.curatorPlat }; }); }
window.ssLoadClips=ssLoadClips; window.ssClipsForFeed=ssClipsForFeed; window.ssClipsForDiscover=ssClipsForDiscover; window.ssMapContentRowsToClips=ssMapContentRowsToClips;

/* ── Phase 2 impure shell for the tiered ranker (feed-follows) ──────────────
   These IMPURE helpers source the inputs the pure ssRankFeed needs (seen-state,
   follow graph, a per-session seed) and cache the ranked list once per feed
   session. They are window-only (touch window.ssDB / window.ssCurrentUser /
   localStorage), fail-soft, and NEVER throw — every path degrades to a safe
   empty/null so ssLoadClips can fall back. Intentionally NOT in module.exports.
   NOTE: not yet wired into ssLoadClips (that is task 6); ssLoadClips still
   returns _ssFeedFallbackPage today. */

// Beta-scale candidate ceiling for the public-signals-only candidate query
// (design: ≥ expected ~500 live clips). A safety cap, not a product knob.
var SS_FEED_CANDIDATE_CAP = 1000;

// Module-level feed session cache: { key, seed, rankedIds, builtAt }. Computed
// once per feed session and reused across pages so pagination is stable and
// Tier 5 never reshuffles mid-scroll (Req 6.3, 6.4). null = not built yet.
var _ssFeedSession = null;

// Per-session nonce created ONCE at module load. Combined with the viewer key it
// yields a seed that is stable within a session but varies across sessions
// (fresh page load / module re-eval → new nonce → new Tier 5 shuffle).
var _ssFeedSessionNonce = (Date.now() + '_' + Math.random());

// Reuse window (ms) before a same-viewer session is considered stale and rebuilt.
var SS_FEED_SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

/* IMPURE — client seen-state read (Req 4.5, 8.4, 5.2). Returns
   { available:boolean, seen:string[] }. Guests, missing/empty/non-array/empty
   array, JSON-parse errors, or any throw → { available:false, seen:[] }. A
   non-empty id array → { available:true, seen:ids }. Never throws. Window-only;
   NOT in module.exports. */
function _ssReadSeenState(key){
  try{
    if(key === 'guest') return { available:false, seen:[] };
    var raw = (typeof window !== 'undefined' && window.localStorage)
      ? window.localStorage.getItem('ss_seen_v1_' + key) : null;
    if(!raw) return { available:false, seen:[] };
    var ids = JSON.parse(raw);
    if(!Array.isArray(ids) || !ids.length) return { available:false, seen:[] };
    return { available:true, seen:ids };
  }catch(e){ return { available:false, seen:[] }; }
}

/* IMPURE — followed creator ids (Req 5.2, 8.3). One cheap indexed query for the
   viewer's followed creator_ids (real UUIDs, to match candidate.creator_id —
   independent of the username-keyed ssGetFollowing() UI store). Guest / no
   ssDB / no ssCurrentUser / any error → []. Never throws. Window-only; NOT in
   module.exports. */
async function _ssFollowedCreatorIds(){
  try{
    if(!window.ssDB || !window.ssCurrentUser) return [];
    var me = window.ssCurrentUser();
    if(!me) return [];
    var res = await window.ssDB.from('follows')
      .select('creator_id').eq('follower_id', me.id).is('deleted_at', null);
    if(!res || res.error || !res.data) return [];
    return res.data.map(function(r){ return r.creator_id; }).filter(Boolean);
  }catch(e){ return []; }
}

/* IMPURE-ish — per-session feed seed (Req 6.4). Stable within a feed session,
   varies across sessions: key + the module-load nonce. ssRankFeed hashes the
   string via _ssXmur3, so any stable string is a valid seed. Total; never
   throws. Window-only; NOT in module.exports. */
function _ssFeedSeed(key){
  return String(key) + ':' + _ssFeedSessionNonce;
}

/* IMPURE — build/reuse the feed session (Req 3.3, 6.3, 6.4, 8.1). Issues the
   public-signals-ONLY candidate query, sources follow graph + seen-state +
   seed, ranks ONCE via the pure ssRankFeed, and caches the ranked list. Reuses
   a fresh same-viewer session. Returns the session object, or null on
   missing ssDB / candidate-query error / no data / any throw (caller serves the
   flat fallback). Window-only; NOT in module.exports. */
async function _ssEnsureFeedSession(){
  var viewerKey = (window.ssCurrentUser && window.ssCurrentUser() && window.ssCurrentUser().id) || 'guest';
  // Reuse a fresh same-viewer session so pagination stays stable (Req 6.3, 6.4).
  if(_ssFeedSession && _ssFeedSession.key === viewerKey
     && (Date.now() - _ssFeedSession.builtAt) < SS_FEED_SESSION_TTL_MS){
    return _ssFeedSession;
  }
  try{
    if(!window.ssDB) return null;
    // Candidate query: ONLY the 5 public-signal columns (Req 3.3 — scoreboard
    // safety). No private columns are ever requested here.
    var candRes = await window.ssDB.from('content')
      .select('id, creator_id, created_at, fires_count, views_count')
      .eq('status','live').is('deleted_at', null)
      .order('created_at',{ascending:false}).limit(SS_FEED_CANDIDATE_CAP);
    if(!candRes || candRes.error || !candRes.data) return null;   // → fallback (Req 8.1)
    var followGraph = { creatorIds: await _ssFollowedCreatorIds() };
    var seenState = _ssReadSeenState(viewerKey);
    var seed = _ssFeedSeed(viewerKey);
    var rankedIds = ssRankFeed({ candidateSet: candRes.data, followGraph: followGraph, seenState: seenState, seed: seed, now: Date.now() });
    _ssFeedSession = { key: viewerKey, seed: seed, rankedIds: rankedIds, builtAt: Date.now() };
    return _ssFeedSession;
  }catch(e){ return null; }   // any throw → caller falls back (Req 8.1)
}

// Window-only exposure for later wiring / testing (matches the file's impure
// helper pattern). Intentionally NOT added to module.exports.
if(typeof window !== 'undefined'){
  window._ssReadSeenState = _ssReadSeenState;
  window._ssFollowedCreatorIds = _ssFollowedCreatorIds;
  window._ssFeedSeed = _ssFeedSeed;
  window._ssEnsureFeedSession = _ssEnsureFeedSession;
}

/* Load ONE live clip by id (for shared ?clip= deep links), independent of the
   feed window. Returns a feed-shaped clip or null. */
async function ssLoadClipById(id){
  if(!window.ssDB || !id) return null;
  try{
    var res = await window.ssDB.from("content")
      .select("id, description, fires_count, views_count, meta, status, mux_playback_id, url, thumbnail_url, duration_sec, creator:creator_id(username,name,avatar_url), title:title_id(name,year,synopsis,providers,cached_at), platform:platform_id(id,name,color,abbr)")
      .eq("id", id).eq("status","live").is("deleted_at",null).limit(1);
    if(res.error || !res.data || !res.data.length) return null;
    var mapped = ssMapContentRowsToClips(res.data);
    if(!mapped.length) return null;
    var feed = (typeof ssClipsForFeed === 'function') ? ssClipsForFeed(mapped) : mapped;
    return feed[0] || null;
  }catch(e){ return null; }
}
window.ssLoadClipById = ssLoadClipById;

/* ── Views display helper ────────────────────────────
   The clip "views" trust signal (eye-count), companion to the fire count.
   Shows the REAL views_count only (the 0021 trigger keeps content.views_count
   in sync from view_events, and backfills existing ones). No fabricated
   fallback — a clip with no recorded views shows 0, so the public card always
   matches the owner's analytics count (both derive from view_events). */
function ssDisplayViews(clip){
  if(!clip) return 0;
  var v = Number(clip.views);
  return (isFinite(v) && v > 0) ? v : 0;
}
window.ssDisplayViews = ssDisplayViews;

/* ═══════════════════════════════════════════════════════════════
   PUBLIC CURATOR PROFILE — pure helpers (no Supabase, no DOM, no network,
   Node-testable). These encode the by-username decision logic the public
   profile hydrator relies on, and are exported under the consolidated
   module.exports block below so the fast-check tests can require them.
   See .kiro/specs/public-curator-profile.
   ═══════════════════════════════════════════════════════════════ */

/* Normalize a raw ?curator value into a queryable username, or null.
   PURE: URL-decode → trim → strip exactly ONE leading '@' → trim again.
   A malformed percent-escape must NOT throw — decodeURIComponent failure is
   treated as identity (the original string is used). Returns the cleaned
   non-empty string, or null when the result is empty / whitespace-only / a
   lone '@', or when the input is not a string (Req 1.1, 1.3, 1.6, 8.1). */
function ssNormalizeCuratorUsername(raw){
  if (typeof raw !== "string") return null;
  var decoded;
  try { decoded = decodeURIComponent(raw); }
  catch (e) { decoded = raw; }            // malformed escape → identity, never throw
  var trimmed = decoded.trim();
  if (trimmed.charAt(0) === "@") trimmed = trimmed.slice(1);  // strip exactly ONE leading '@'
  trimmed = trimmed.trim();
  return trimmed.length ? trimmed : null;
}
window.ssNormalizeCuratorUsername = ssNormalizeCuratorUsername;

/* Resolve a Viewed_Curator view-model from already-fetched backend data.
   PURE: no Supabase, no DOM, no network. Inputs:
     usersRow      : the users row (or null/undefined when not found)
     contentRows   : raw content rows (or null) — projected via ssMapContentRowsToClips
     followerCount : non-negative integer (or anything; clamped to a >= 0 integer)
   Returns:
     { found: boolean,
       profile: { name, handle, photo, letter, bio, genres, verified } | null,
       clips: Clip[],                  // [] when not found / no rows
       stats: { followers, clips } }   // both non-negative integers
   Role gate: usersRow null/undefined OR role !== 'curator' yields found=false
   (Req 1.4, 1.5, 8.3, 8.4, 10.1). Identity fallbacks per Req 2.1-2.10; clips via
   the existing pure mapper, order preserved (Req 3.2); stats clamp per Req 4.1-4.3. */
function ssResolveCuratorViewModel(usersRow, contentRows, followerCount){
  // Existence gate → not-found shape (Req 1.4, 8.3, 8.4, 10.1). A null/undefined
  // (or non-object) row is "not found". NOTE: we deliberately do NOT gate on
  // usersRow.role here — the `role` column is not reliably set to 'curator' in
  // practice (sign-up creates role='user' and posting a clip never flips it), so
  // gating on it wrongly rejects real curators who have posted real clips. The
  // "is this a public curator surface" policy (role OR has-clips) is decided by
  // the caller (hydrateCuratorProfile), which has both the row and the clips.
  if (!usersRow || typeof usersRow !== "object") {
    return { found: false, profile: null, clips: [], stats: { followers: 0, clips: 0 } };
  }

  function nonEmptyStr(v){ return (typeof v === "string" && v.length > 0) ? v : null; }

  var username = (typeof usersRow.username === "string") ? usersRow.username : "";
  var nameVal  = nonEmptyStr(usersRow.name);
  var name     = nameVal != null ? nameVal : username;          // Req 2.1, 2.8
  var letterSrc = nameVal != null ? nameVal : username;          // Req 2.4
  var letter    = letterSrc ? letterSrc.charAt(0).toUpperCase() : "";
  var avatar    = nonEmptyStr(usersRow.avatar_url);              // Req 2.3, 2.4
  var bioVal    = nonEmptyStr(usersRow.bio);                     // Req 2.5, 2.9
  var genres    = (Array.isArray(usersRow.genres) && usersRow.genres.length) ? usersRow.genres : []; // Req 2.7, 2.10

  // Clips via the existing pure mapper, preserving most-recent-first order (Req 3.2).
  var clips = ssMapContentRowsToClips(contentRows || []);

  // Followers clamped to a non-negative integer, else 0 (Req 4.1, 4.2).
  var followers = 0;
  if (typeof followerCount === "number" && isFinite(followerCount) && followerCount >= 0) {
    followers = Math.floor(followerCount);
  }

  return {
    found: true,
    profile: {
      name: name,
      handle: "@" + username,                                   // Req 2.2
      photo: avatar,                                            // null when empty (Req 2.3, 2.4)
      letter: letter,
      bio: bioVal != null ? bioVal : "",                        // Req 2.5, 2.9
      genres: genres,
      verified: !!usersRow.verified                             // Req 2.6
    },
    clips: clips,
    stats: { followers: followers, clips: clips.length }        // Req 4.3
  };
}
window.ssResolveCuratorViewModel = ssResolveCuratorViewModel;

/* ═══════════════════════════════════════════════════════════════
   CREATOR ANALYTICS — Event_Recorder pure helpers (no DOM, no network,
   never throw, Node-testable). These encode the capture-side decisions and
   insert-payload shapes the fire-and-forget recorder wrappers rely on, and are
   exported under the consolidated module.exports block below so the Node
   fast-check tests can require them. See .kiro/specs/creator-analytics.

   Split (per the design's "Event_Recorder → Pure helpers"):
     • ssIsRecordableClipId  — mock/prototype skip decision  (Req 1.6, 2.6, 3.5, 12.4)
     • ssResolveEventUserId  — insert-payload user_id resolution (Req 1.2/1.3, 2.3/2.4, 3.2/3.3)
     • ssShouldRecordView    — per-session view de-dup decision   (Req 1.5)
     • ssBuildViewEvent      — view insert payload                (Req 1.1)
     • ssBuildShareEvent     — share insert payload               (Req 3.1)
     • ssBuildWatchEvent     — watch insert payload (+optional fields) (Req 2.1, 2.2)
   ═══════════════════════════════════════════════════════════════ */

/* Mock/prototype-clip skip decision (Req 1.6, 2.6, 3.5, 12.4). Only persisted
   `content` rows have uuid ids; mock/prototype clips use small integers. Reuses
   the same uuid test the fire helpers use (`_ssIsUuid`), so the recorder records
   exactly the persisted clips and skips prototype integer ids, null, undefined,
   and malformed strings. Returns true iff `clipId` is a uuid-form content id. */
function ssIsRecordableClipId(clipId) {
  // null/undefined are never uuids; _ssIsUuid stringifies defensively and
  // never throws, so this stays pure for any input.
  if (clipId === null || clipId === undefined) return false;
  return _ssIsUuid(clipId);
}

/* Insert-payload user_id resolution (Req 1.2/1.3, 2.3/2.4, 3.2/3.3, 5.2/5.3).
   A signed-in user object with an `id` resolves to that id; a guest
   (null/undefined, or an object without a usable id) resolves to null. Never
   throws and never returns any other value. */
function ssResolveEventUserId(currentUser) {
  if (currentUser && typeof currentUser === 'object') {
    var id = currentUser.id;
    if (typeof id === 'string' && id) return id;
  }
  return null;
}

/* Per-session view de-dup DECISION (Req 1.5). Pure: given the Set of clip ids
   already viewed this session and a candidate clip id, returns true the first
   time the id is seen and false thereafter. Does NOT mutate the Set — the impure
   caller marks the id on a true result. Handles a missing/empty set gracefully. */
function ssShouldRecordView(viewedSet, clipId) {
  if (!viewedSet || typeof viewedSet.has !== 'function') return true;
  return !viewedSet.has(clipId);
}

/* View_Event insert payload (Req 1.1). Pure builder so the shape is testable. */
function ssBuildViewEvent(clipId, userId) {
  return { content_id: clipId, user_id: userId };
}

/* Share_Event insert payload (Req 3.1). */
function ssBuildShareEvent(clipId, userId) {
  return { content_id: clipId, user_id: userId };
}

/* Watch_Event insert payload (Req 2.1, 2.2). Includes `title_id` / `platform_id`
   / `region` ONLY when the Watch It selection provided them (truthy/defined);
   each absent value is omitted entirely so the DB defaults/nulls apply — values
   are never invented. */
function ssBuildWatchEvent(clipId, userId, opts) {
  var payload = { content_id: clipId, user_id: userId };
  var o = (opts && typeof opts === 'object') ? opts : {};
  if (o.title_id !== undefined && o.title_id !== null && o.title_id !== '') payload.title_id = o.title_id;
  if (o.platform_id !== undefined && o.platform_id !== null && o.platform_id !== '') payload.platform_id = o.platform_id;
  if (o.region !== undefined && o.region !== null && o.region !== '') payload.region = o.region;
  return payload;
}

/* ═══════════════════════════════════════════════════════════════
   CREATOR ANALYTICS — Event_Recorder impure wrappers (browser-only,
   fire-and-forget). These sit on top of the pure helpers above and write one
   event row per captured action, mirroring the existing `_ssDbFire` /
   `_ssDbFollow` DB pattern: guard `window.ssDB` + `window.ssCurrentUser`,
   resolve the viewer, skip non-recordable (mock/prototype) clips, build the
   payload with the pure builder, then INSERT without `await` on the caller's
   path and swallow any rejection so playback / Watch It navigation / share are
   never blocked or thrown into.

     • ssRecordView  → view_events,  + per-session de-dup (Req 1.4, 1.5, 1.6, 13.1, 13.2)
     • ssRecordWatch → watch_events, no de-dup / no self-collapse (Req 2.5, 2.6, 2.7, 13.1, 13.2)
     • ssRecordShare → share_events  (Req 3.4, 3.5, 13.1, 13.2)

   Per-session view de-dup state is a module-level Set keyed by clip id, reset
   naturally on page load (one "playback session" per the requirement). Fires are
   NOT written here — they keep the existing `content_fires` capture (Req 4.2).
   ═══════════════════════════════════════════════════════════════ */

/* Clip ids viewed in this playback session (reset on page load). ssRecordView
   consults this via ssShouldRecordView and marks an id only when a View_Event is
   actually recorded, so a repeat view of the same clip is a clean no-op. */
var _ssViewedThisSession = new Set();

/* Cap on the persisted per-viewer seen-list so it stays bounded (keeps the most
   recent ids). The feed ranker only needs a recent window to de-prioritise
   already-seen clips, so an unbounded list would be wasteful. */
var SS_SEEN_MAX = 500;

/* IMPURE — additively append a clip id to the per-viewer seen-list in
   localStorage 'ss_seen_v1_<uid>' (the POPULATE side of _ssReadSeenState; Req
   4.6). Fully fail-soft: storage disabled / quota / parse errors → silent no-op.
   Never throws and never affects playback or view recording. Guards:
     • GUEST (no uid / 'guest') → skip; we never write an anonymous seen-list.
     • Only records real clip ids (ssIsRecordableClipId) so mock/prototype ids
       are skipped — matching what ssRecordView itself records.
     • De-dupes (skips if already present) and caps to the most-recent
       SS_SEEN_MAX ids. Window-only; NOT in module.exports. */
function _ssMarkSeen(clipId) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;  // no storage → no-op
    if (!ssIsRecordableClipId(clipId)) return;                          // mock/prototype id → skip
    var uid = (typeof window.ssCurrentUser === 'function'
      && window.ssCurrentUser() && window.ssCurrentUser().id) || null;
    if (!uid || uid === 'guest') return;                                // guest → no anonymous list
    var key = 'ss_seen_v1_' + uid;
    var ids;
    try { ids = JSON.parse(window.localStorage.getItem(key)); }
    catch (e) { ids = null; }
    if (!Array.isArray(ids)) ids = [];                                  // parse-error / non-array → []
    if (ids.indexOf(clipId) !== -1) return;                            // already seen → dedupe no-op
    ids.push(clipId);
    if (ids.length > SS_SEEN_MAX) ids = ids.slice(ids.length - SS_SEEN_MAX); // keep most-recent
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch (e) { /* fail-soft: never affect playback or view recording */ }
}

/* Record a View_Event fire-and-forget (Req 1.1, 1.4, 1.5, 1.6, 13.1, 13.2).
   Resolves the viewer (null for a guest), no-ops when ssDB is missing or the
   clip id isn't a persisted content row, and de-dups per session. */
function ssRecordView(clipId) {
  try {
    if (!window.ssDB || !ssIsRecordableClipId(clipId)) return;          // clean no-op
    var me = (typeof window.ssCurrentUser === 'function') ? window.ssCurrentUser() : null;
    var userId = ssResolveEventUserId(me);
    if (!ssShouldRecordView(_ssViewedThisSession, clipId)) return;       // already viewed this session
    _ssViewedThisSession.add(clipId);
    _ssMarkSeen(clipId);   // additive seen-state write (Req 4.6) — guarded, fail-soft, guests skipped
    var payload = ssBuildViewEvent(clipId, userId);
    // Fire-and-forget: do NOT await on the caller's path; swallow rejections.
    Promise.resolve(window.ssDB.from('view_events').insert(payload))
      .then(function (res) { if (res && res.error) console.warn('ShowShak view:', res.error.message); })
      .catch(function () { /* never block playback */ });
  } catch (e) { /* keep playback working even if recording fails */ }
}

/* Record a Watch_Event fire-and-forget (Req 2.1, 2.2, 2.5, 2.6, 2.7, 13.1, 13.2).
   No de-dup and no self-collapse — every tap inserts a row. `opts` may carry
   title_id / platform_id / region, passed through by the pure builder. */
function ssRecordWatch(clipId, opts) {
  try {
    if (!window.ssDB || !ssIsRecordableClipId(clipId)) return;          // clean no-op
    var me = (typeof window.ssCurrentUser === 'function') ? window.ssCurrentUser() : null;
    var userId = ssResolveEventUserId(me);
    var payload = ssBuildWatchEvent(clipId, userId, opts);
    Promise.resolve(window.ssDB.from('watch_events').insert(payload))
      .then(function (res) { if (res && res.error) console.warn('ShowShak watch:', res.error.message); })
      .catch(function () { /* never block the Watch It navigation */ });
  } catch (e) { /* keep navigation working even if recording fails */ }
}

/* Record a Share_Event fire-and-forget (Req 3.1, 3.4, 3.5, 13.1, 13.2). */
function ssRecordShare(clipId) {
  try {
    if (!window.ssDB || !ssIsRecordableClipId(clipId)) return;          // clean no-op
    var me = (typeof window.ssCurrentUser === 'function') ? window.ssCurrentUser() : null;
    var userId = ssResolveEventUserId(me);
    var payload = ssBuildShareEvent(clipId, userId);
    Promise.resolve(window.ssDB.from('share_events').insert(payload))
      .then(function (res) { if (res && res.error) console.warn('ShowShak share:', res.error.message); })
      .catch(function () { /* never block the share action */ });
  } catch (e) { /* keep the share action working even if recording fails */ }
}

/* Expose the impure recorder wrappers on window (consistent with how other ss*
   functions are exposed). They are browser-only, so they are NOT added to the
   Node `module.exports` block — only the pure helpers they build on are. */
if (typeof window !== 'undefined') {
  window.ssRecordView  = ssRecordView;
  window.ssRecordWatch = ssRecordWatch;
  window.ssRecordShare = ssRecordShare;
  window._ssMarkSeen   = _ssMarkSeen;
}

/* ── VIEW dwell (Reach = genuine attention, not a scroll-by) ──────────────────
   A View_Event is recorded only after a clip has been the ACTIVE (playing) clip
   for SS_VIEW_DWELL_MS, so clips the viewer scrolls past quickly never inflate
   Reach. The dwell lives in the engine's active-clip path so it covers BOTH
   hosts (the inline Feed and the fullscreen viewer): every active-clip change
   clears the pending timer and starts a fresh one (`_ssViewDwellTimer`), and the
   timer records only if the SAME clip is still active when it fires. The timer
   is also cleared when the fullscreen viewer tears down and when an inline mount
   is rebuilt. ssRecordView already de-dups per session, so re-activating a clip
   later is a harmless no-op. */
var SS_VIEW_DWELL_MS = 2000;   // Reach attention threshold: a clip must stay active this long (ms) before it counts as a view.
var _ssViewDwellTimer = null;  // pending dwell timer for the currently-active clip (module-level so every host shares it).

/* Cancel any pending dwell-view timer. Called on every active-clip change,
   on fullscreen teardown, and on inline mount rebuild, so a clip scrolled past
   quickly never records. */
function _ssCancelViewDwell() {
  if (_ssViewDwellTimer) { clearTimeout(_ssViewDwellTimer); _ssViewDwellTimer = null; }
  return undefined;
}

/* (Re)start the dwell timer for the clip that JUST became active in `mode`
   ('INLINE' | 'FULLSCREEN'). When it fires, re-check the active index hasn't
   changed before recording the correct host's active clip. Picks the clip from
   the right host's state: _ssvClips[_ssvActiveIdx] for FULLSCREEN,
   _inlineClips[_inlineActiveIdx] for INLINE. ssRecordView skips non-uuid mock
   ids, so only real clips record. */
function _ssScheduleViewDwell(mode) {
  _ssCancelViewDwell();
  var m = (mode === 'INLINE') ? 'INLINE' : 'FULLSCREEN';
  var idxAtStart = (m === 'INLINE') ? _inlineActiveIdx : _ssvActiveIdx;
  _ssViewDwellTimer = setTimeout(function () {
    _ssViewDwellTimer = null;
    try {
      // Guard: only record if the SAME clip is still the active one.
      var idxNow = (m === 'INLINE') ? _inlineActiveIdx : _ssvActiveIdx;
      if (idxNow !== idxAtStart) return;
      var clip = (m === 'INLINE') ? _inlineClips[idxNow] : _ssvClips[idxNow];
      if (clip && clip.id != null) ssRecordView(clip.id);
    } catch (e) { /* never affect playback */ }
  }, SS_VIEW_DWELL_MS);
}

/* ═══════════════════════════════════════════════════════════════
   CREATOR ANALYTICS — Analytics_Reader counting-model helpers (pure: no DOM,
   no network, never throw). These are the EXECUTABLE SPECIFICATION the
   migration `0019` SQL reader mirrors row-for-row
   (creator_analytics_totals / creator_analytics_weekly /
   creator_analytics_per_clip). The JS helpers and the SQL implement the SAME
   counting rules, so property-testing the helpers validates the counting
   contract `0019` must honor. Exported under the consolidated module.exports
   block below. See .kiro/specs/creator-analytics.

   Helpers (per the design's "Counting rules" + the 0019 SQL semantics):
     • ssCountWithSelfCollapse — views/shares Self_Activity collapse  (Req 1.7/1.8/1.9, 3.6/3.7, 7.6, 10.4)
     • ssCountWatch            — watch taps, no de-dup, no collapse    (Req 2.7, 2.8, 7.7, 10.4)
     • ssCountFires            — at most one fire per distinct user     (Req 4.1, 4.4, 7.7, 10.4)
     • ssFilterOwnClips        — owner-scoping filter                   (Req 7.1, 7.4, 10.2, 11.1)

   These operate PER CLIP (the totals aggregate across clips by summing each
   clip's per-clip result; ssFilterOwnClips narrows the clip set first). They
   are composable and defensive: null/undefined/non-array inputs yield a sensible
   empty result (0 or []), never a throw.

   SQL "IS DISTINCT FROM" semantics, replicated exactly so the property tests
   (3.2–3.5) can mirror them:
     • A guest event (user_id = null) is IS DISTINCT FROM any non-null
       creator_id, so guests ALWAYS count individually as non-owners.
     • Two nulls are NOT distinct from each other (matches SQL), but the
       self-collapse branch is keyed on SQL `=` to creator_id (not distinctness):
       `null = anything` is NULL/false in SQL, so a guest user_id is never
       treated as the owner's own activity.
     • Self-collapse adds AT MOST 1 per clip when ≥1 self-event exists, and 0
       when none exists — regardless of how many self-events there are.
   ═══════════════════════════════════════════════════════════════ */

/* Normalize a raw event user_id to JS null for guest (treat undefined as null),
   so the distinctness/equality checks below match the DB's nullable user_id. */
function _ssEventUserId(ev) {
  if (!ev || typeof ev !== 'object') return null;
  var u = ev.user_id;
  return (u === undefined) ? null : u;
}

/* SQL `a IS DISTINCT FROM b`: two nulls are NOT distinct; a null and a value
   ARE distinct; otherwise compare by equality. */
function _ssIsDistinctFrom(a, b) {
  if (a === null && b === null) return false;
  if (a === null || b === null) return true;
  return a !== b;
}

/* SQL `a = b` for the self branch: NULL on either side yields NULL (false);
   otherwise strict equality. A guest (null) is therefore never the owner. */
function _ssSqlEquals(a, b) {
  if (a === null || b === null) return false;
  return a === b;
}

/* Self_Activity collapse counter for VIEWS and SHARES (Req 1.7/1.8/1.9,
   3.6/3.7, 7.6, 10.4). For a single clip owned by `creatorId` and a
   list/multiset of events (each with a `user_id`; guest = null):

     count = (events whose user_id IS DISTINCT FROM creatorId — each counted
              individually, including guests and repeat views by the same
              viewer)
           + (1 if at least one event has user_id = creatorId, else 0)

   Mirrors the 0019 SQL shape
     count(*) where user_id is distinct from c.creator_id
     + count(distinct clip) where user_id = c.creator_id
   (which, per single clip, is 1 when any self-event exists, else 0).
   Defensive: a non-array `events` yields 0; `creatorId` undefined is treated
   as null. Never throws. */
function ssCountWithSelfCollapse(events, creatorId) {
  if (!Array.isArray(events)) return 0;
  var owner = (creatorId === undefined) ? null : creatorId;
  var nonOwner = 0;
  var hasSelf = false;
  for (var i = 0; i < events.length; i++) {
    var uid = _ssEventUserId(events[i]);
    if (_ssIsDistinctFrom(uid, owner)) nonOwner++;
    else if (_ssSqlEquals(uid, owner)) hasSelf = true;
  }
  return nonOwner + (hasSelf ? 1 : 0);
}

/* Watch counter (Req 2.7, 2.8, 7.7, 10.4). Every Watch_Event counts: no
   per-session de-dup and no self-collapse, so owner taps and repeated taps by
   the same viewer are each counted. Mirrors the 0019 SQL `count(*)` over
   watch_events. Defensive: a non-array input yields 0; never throws. */
function ssCountWatch(events) {
  if (!Array.isArray(events)) return 0;
  return events.length;
}

/* Fire counter (Req 4.1, 4.4, 7.7, 10.4). For a single clip's fire records,
   counts at most one fire per DISTINCT user (the owner included), so duplicate
   records for the same user collapse to one. Mirrors the 0019 SQL `count(*)`
   over content_fires, where the PK (user_id, content_id) already guarantees one
   row per (user, clip). Defensive: a non-array input yields 0; undefined
   user_id is normalized to null (a single distinct key); never throws. */
function ssCountFires(fireRecords) {
  if (!Array.isArray(fireRecords)) return 0;
  var users = new Set();
  for (var i = 0; i < fireRecords.length; i++) {
    users.add(_ssEventUserId(fireRecords[i]));
  }
  return users.size;
}

/* Owner-scoping filter (Req 7.1, 7.4, 10.2, 11.1). Given a set of clips (each
   with `id` + `creator_id`) and a caller id, returns only the clips whose
   `creator_id` strictly equals `callerId` — so events on clips the caller does
   not own never contribute to the caller's totals. Mirrors the 0019 SQL
   `my_clips` CTE (`where creator_id = auth.uid()`). Defensive: a non-array
   `clips` yields []; non-object entries are skipped; never throws. */
function ssFilterOwnClips(clips, callerId) {
  if (!Array.isArray(clips)) return [];
  var out = [];
  for (var i = 0; i < clips.length; i++) {
    var clip = clips[i];
    if (clip && typeof clip === 'object' && clip.creator_id === callerId) out.push(clip);
  }
  return out;
}

/* Insert-payload acceptance model (Req 5.2, 5.3, 5.4). Models the `0019`
   anti-spoofing `with check (user_id is not distinct from auth.uid())` insert
   policy on view_events / watch_events / share_events. Given the inserting
   viewer's identity (`viewerId` — their auth.uid(), null/undefined for a Guest)
   and the proposed payload `user_id`, returns whether the DB would ACCEPT the
   insert:
     • accept IFF `payloadUserId` IS NOT DISTINCT FROM `viewerId`
     • signed-in (viewerId is a non-null id) → accept only when
       payloadUserId === viewerId (their own id)
     • guest (viewerId null/undefined) → accept only when payloadUserId is
       null/undefined
     • reject every other combination (forging another user's id, or a guest
       sending a non-null id)
   `undefined` is treated the same as `null` (Guest) for both arguments. Reuses
   the same IS DISTINCT FROM semantics encoded by `_ssIsDistinctFrom`. Pure;
   never throws. */
function ssEventInsertAccepted(viewerId, payloadUserId) {
  var viewer = (viewerId === undefined) ? null : viewerId;
  var payload = (payloadUserId === undefined) ? null : payloadUserId;
  // `is not distinct from` is the negation of `is distinct from`.
  return !_ssIsDistinctFrom(payload, viewer);
}

/* ═══════════════════════════════════════════════════════════════
   CREATOR ANALYTICS — Weekly_Trend model helper (pure: no DOM, no network,
   never throws). Executable specification of the `0019`
   `creator_analytics_weekly()` SQL: it returns exactly one entry for EACH of
   the last 7 calendar days (no day omitted; days with no events are
   zero-filled), in ascending day order, mirroring the SQL
   `generate_series(0, 6)` over the `current_date - 6 .. current_date` window
   (inclusive of today, six days back). Each event is bucketed into its
   calendar day and the SAME counting rules as the totals are applied
   PER (clip, day), then summed across the owner's clips for each day:
     • views  — Self_Activity collapse (ssCountWithSelfCollapse): non-owner
                views counted individually; the owner's own views on a clip
                collapse to exactly one per (clip, day) (Req 9.5)
     • shares — same Self_Activity collapse as views (Req 9.5)
     • watch_its — every Watch_Event counted (ssCountWatch); no de-dup, no
                collapse (Req 9.5)
     • fires  — at most one per distinct user per clip (ssCountFires) (Req 9.5)

   Signature: ssWeeklyTrend(buckets, todayEpochDay)
     • buckets: { views, shares, watches, fires } — four arrays of event
       records. View/share/fire records have shape
         { content_id, creator_id, user_id, day }
       and watch records { content_id, day } (user_id/creator_id are ignored
       for watch — no collapse). `creator_id` is the owning curator of the
       clip (the events passed in are already owner-scoped upstream by
       ssFilterOwnClips, matching the `my_clips` CTE); it is used only to
       decide whether an event is the owner's own Self_Activity.
     • A record's calendar day is derived by `_ssEpochDayOf`: a finite numeric
       `day` is the UTC epoch-day (days since 1970-01-01) and is used directly;
       otherwise `created_at` (a ms-since-epoch number, an ISO string, or a
       Date) is converted to its UTC epoch-day. Records whose day cannot be
       resolved, or that fall outside the 7-day window, are ignored (mirroring
       the SQL `created_at >= current_date - 6` bound and the inner-join drop
       of out-of-window / future rows).
     • todayEpochDay (injectable): the UTC epoch-day treated as "today" (the
       inclusive end of the window). Made a parameter so the helper is
       deterministic and testable rather than reading the real clock. Default
       when omitted/non-finite: Math.floor(Date.now() / 86400000) (today in
       UTC).

   Returns: an array of EXACTLY 7 entries, ascending by day from
   (today - 6) to today, each of shape
     { day, views, shares, watch_its, fires }
   where `day` is the bucket's UTC epoch-day integer and the four counts are
   the per-day aggregates (>= 0).

   Defensive: a null/undefined/non-object `buckets`, or any missing/non-array
   bucket, yields a fully zero-filled result — still EXACTLY 7 entries. Never
   throws.
   ═══════════════════════════════════════════════════════════════ */

/* Resolve a raw event record to its UTC epoch-day (days since 1970-01-01), or
   null when it cannot be derived. A finite numeric `day` is taken as the
   epoch-day directly; otherwise `created_at` (ms number / ISO string / Date)
   is converted. Never throws. */
function _ssEpochDayOf(ev) {
  if (!ev || typeof ev !== 'object') return null;
  if (typeof ev.day === 'number' && isFinite(ev.day)) return Math.floor(ev.day);
  var ca = ev.created_at;
  if (typeof ca === 'number' && isFinite(ca)) return Math.floor(ca / 86400000);
  if (ca instanceof Date) {
    var t = ca.getTime();
    return isFinite(t) ? Math.floor(t / 86400000) : null;
  }
  if (typeof ca === 'string') {
    var p = Date.parse(ca);
    return isFinite(p) ? Math.floor(p / 86400000) : null;
  }
  return null;
}

function ssWeeklyTrend(buckets, todayEpochDay) {
  // "today" reference — injectable for determinism; default is the real UTC day.
  var today = (typeof todayEpochDay === 'number' && isFinite(todayEpochDay))
    ? Math.floor(todayEpochDay)
    : Math.floor(Date.now() / 86400000);
  var startDay = today - 6;

  // Normalize buckets defensively — any missing/odd bucket becomes [].
  var b = (buckets && typeof buckets === 'object') ? buckets : {};
  var views   = Array.isArray(b.views)   ? b.views   : [];
  var shares  = Array.isArray(b.shares)  ? b.shares  : [];
  var watches = Array.isArray(b.watches) ? b.watches : [];
  var fires   = Array.isArray(b.fires)   ? b.fires   : [];

  // Zero-filled 7-day skeleton (ascending), plus a day -> entry index.
  var result = [];
  var index = {};
  for (var d = startDay; d <= today; d++) {
    var entry = { day: d, views: 0, shares: 0, watch_its: 0, fires: 0 };
    result.push(entry);
    index[d] = entry;
  }

  function clipKeyOf(ev) {
    return (ev && typeof ev === 'object') ? ('cid:' + String(ev.content_id)) : 'cid:undefined';
  }

  // Views / shares: per day, group by clip then apply the Self_Activity
  // collapse per (clip, day) (ssCountWithSelfCollapse), summing across clips.
  function accumulateCollapse(eventList, field) {
    var byDay = {}; // day -> { clipKey -> { creatorId, events:[] } }
    for (var i = 0; i < eventList.length; i++) {
      var ev = eventList[i];
      var day = _ssEpochDayOf(ev);
      if (day === null || day < startDay || day > today) continue;
      var k = clipKeyOf(ev);
      if (!byDay[day]) byDay[day] = {};
      if (!byDay[day][k]) {
        var cid = (ev && typeof ev === 'object' && ev.creator_id !== undefined) ? ev.creator_id : null;
        byDay[day][k] = { creatorId: cid, events: [] };
      }
      byDay[day][k].events.push(ev);
    }
    for (var dayKey in byDay) {
      if (!byDay.hasOwnProperty(dayKey)) continue;
      var e = index[dayKey];
      if (!e) continue;
      var clips = byDay[dayKey];
      var total = 0;
      for (var ck in clips) {
        if (!clips.hasOwnProperty(ck)) continue;
        total += ssCountWithSelfCollapse(clips[ck].events, clips[ck].creatorId);
      }
      e[field] += total;
    }
  }

  accumulateCollapse(views, 'views');
  accumulateCollapse(shares, 'shares');

  // Watch Its: count every tap in the window (ssCountWatch), grouped per day.
  var wByDay = {};
  for (var wi = 0; wi < watches.length; wi++) {
    var wev = watches[wi];
    var wday = _ssEpochDayOf(wev);
    if (wday === null || wday < startDay || wday > today) continue;
    if (!wByDay[wday]) wByDay[wday] = [];
    wByDay[wday].push(wev);
  }
  for (var wKey in wByDay) {
    if (!wByDay.hasOwnProperty(wKey)) continue;
    if (index[wKey]) index[wKey].watch_its += ssCountWatch(wByDay[wKey]);
  }

  // Fires: per day, group by clip then count at most one per distinct user per
  // clip (ssCountFires), summing across clips.
  var fByDay = {};
  for (var fi = 0; fi < fires.length; fi++) {
    var fev = fires[fi];
    var fday = _ssEpochDayOf(fev);
    if (fday === null || fday < startDay || fday > today) continue;
    var fk = clipKeyOf(fev);
    if (!fByDay[fday]) fByDay[fday] = {};
    if (!fByDay[fday][fk]) fByDay[fday][fk] = [];
    fByDay[fday][fk].push(fev);
  }
  for (var fDayKey in fByDay) {
    if (!fByDay.hasOwnProperty(fDayKey)) continue;
    var fe = index[fDayKey];
    if (!fe) continue;
    var fclips = fByDay[fDayKey];
    var ftotal = 0;
    for (var fck in fclips) {
      if (!fclips.hasOwnProperty(fck)) continue;
      ftotal += ssCountFires(fclips[fck]);
    }
    fe.fires += ftotal;
  }

  return result;
}

/* ═══════════════════════════════════════════════════════════════
   CURATOR UPLOAD v2 — pure helpers (no DOM, no network, Node-testable).
   These encode the input-driven logic the upload flow relies on and are
   exported under the consolidated module.exports block below so tests/ can
   require them under the DOM stub. See .kiro/specs/curator-upload-v2.
   ═══════════════════════════════════════════════════════════════ */

/* Pitch length rules — Req 5.1, 5.2, 5.3 (Open Decision resolved: 280 chars).

   SS_PITCH_MAX is the hard maximum (characters). There is NO minimum beyond a
   non-empty pitch: a Pitch is publishable iff its length is between 1 and 280
   inclusive. The sweet-spot range (SS_PITCH_SWEET_MIN..SS_PITCH_SWEET_MAX) is a
   SOFT, advisory hint only — it NEVER affects `ok`, so a pitch outside the
   sweet spot but within the maximum is still publishable.

   Length decision (documented, locked): we validate and report the *trimmed*
   character length. The UI shows a live counter and the DB stores the pitch in
   content.description, so leading/trailing whitespace should not count toward
   either the publishable check or the maximum. Consequences, kept consistent:
     - empty OR whitespace-only pitch  → length 0   → ok=false, overMax=false
     - exactly 280 (trimmed)           → length 280 → ok=true,  overMax=false
     - 281+ (trimmed)                  → length 281 → ok=false, overMax=true

   Pure + defensive: never touches the DOM/network and never throws on odd
   input (null, undefined, numbers) — the argument is coerced via String(...). */
var SS_PITCH_MAX = 280;          // hard maximum, characters (Req 5.3)
var SS_PITCH_SWEET_MIN = 80;     // soft hint lower bound (advisory only, Req 5.2)
var SS_PITCH_SWEET_MAX = 180;    // soft hint upper bound (advisory only, Req 5.2)

function ssValidatePitch(text){
  var raw = String(text == null ? '' : text);
  var length = raw.trim().length;                 // trimmed length drives every decision
  var overMax = length > SS_PITCH_MAX;            // Req 5.3
  var ok = length > 0 && length <= SS_PITCH_MAX;  // Req 5.1 (no minimum beyond > 0)
  // Soft hint — advisory only, must never influence `ok` (Req 5.2).
  var inSweetSpot = length >= SS_PITCH_SWEET_MIN && length <= SS_PITCH_SWEET_MAX;
  return { ok: ok, length: length, overMax: overMax, inSweetSpot: inSweetSpot };
}
if (typeof window !== 'undefined') {
  window.ssValidatePitch = ssValidatePitch;
  window.SS_PITCH_MAX = SS_PITCH_MAX;
  window.SS_PITCH_SWEET_MIN = SS_PITCH_SWEET_MIN;
  window.SS_PITCH_SWEET_MAX = SS_PITCH_SWEET_MAX;
}

/* Clip Trim rules — Req 7.2, 7.3, 7.4, 7.6.

   SS_DURATION_CAP is the single shared 90-second Duration_Cap used by BOTH the
   trim validation here AND the media-file validation (Task 5.1 reuses this same
   constant) so the limit is defined in exactly one place. Mirrors the cap the
   webhook re-applies server-side.

   These three helpers are pure (no DOM, no network) and DEFENSIVE — they never
   throw on any input (null, undefined, strings, NaN, Infinity); odd inputs are
   coerced via Number(...) and non-finite values are rejected, never crash.

   ── ssValidateTrim reason codes (locked, documented) ──
     ''                 → ok === true   (no reason needed)
     'non_finite'       → In_Point or Out_Point is not a finite number
     'out_not_after_in' → Out_Point <= In_Point  (Req 7.2; covers a zero-length
                          or backwards selection — the "empty" case)
     'over_cap'         → finite, out > in, but (out - in) > SS_DURATION_CAP (Req 7.4)

   ── ok-gate (locked, matches design Property 2 exactly) ──
     ok === isFinite(in) && isFinite(out) && (out > in) && ((out - in) <= 90)
   srcDur is accepted for signature/audit completeness, but it deliberately does
   NOT tighten `ok`: Property 2 states ok IFF (out > in AND out - in <= 90), so
   adding srcDur bounds (e.g. in >= 0, out <= srcDur) could flip ok to false
   where Property 2 expects true and would violate the property. We therefore
   keep the gate to the four primary conditions only. */
var SS_DURATION_CAP = 90;        // Duration_Cap in seconds (Req 4 / Req 7.4), shared

/* outSec - inSec, clamped to >= 0 and finite-safe (never NaN, never negative).
   Rule: coerce both inputs to Number; if either is non-finite return 0;
   otherwise return Math.max(0, outSec - inSec). */
function ssTrimDuration(inSec, outSec){
  var a = Number(inSec);
  var b = Number(outSec);
  if (!isFinite(a) || !isFinite(b)) return 0;
  var d = b - a;
  return d > 0 ? d : 0;          // Math.max(0, d), avoiding -0
}

/* Validate a trim selection. Returns { ok, reason, durationSec }.
   Never throws; durationSec is always a finite number >= 0 (from ssTrimDuration). */
function ssValidateTrim(inSec, outSec, srcDur){
  var a = Number(inSec);
  var b = Number(outSec);
  var durationSec = ssTrimDuration(inSec, outSec);  // finite, >= 0

  if (!isFinite(a) || !isFinite(b)) {
    return { ok: false, reason: 'non_finite', durationSec: durationSec };
  }
  if (!(b > a)) {                                   // Req 7.2 (also catches zero-length)
    return { ok: false, reason: 'out_not_after_in', durationSec: durationSec };
  }
  if ((b - a) > SS_DURATION_CAP) {                  // Req 7.4
    return { ok: false, reason: 'over_cap', durationSec: durationSec };
  }
  return { ok: true, reason: '', durationSec: durationSec };
}

/* True IFF the selection equals the whole source: In_Point === 0 and
   Out_Point === srcDur (Req 7.6). Finite-safe: if srcDur is non-finite, return
   false. Exact compare (no epsilon) per design Property 3. */
function ssIsFullSourceTrim(inSec, outSec, srcDur){
  var a = Number(inSec);
  var b = Number(outSec);
  var s = Number(srcDur);
  if (!isFinite(s)) return false;
  return a === 0 && b === s;
}
if (typeof window !== 'undefined') {
  window.ssTrimDuration = ssTrimDuration;
  window.ssValidateTrim = ssValidateTrim;
  window.ssIsFullSourceTrim = ssIsFullSourceTrim;
  window.SS_DURATION_CAP = SS_DURATION_CAP;
}

/* Media-file validation — Req 4.1, 4.2, 4.3, 4.7 (design Property 4).

   Gates a source file on BOTH the duration cap and the file-size cap *before*
   the UI mints a Mux direct-upload (`ok` is that precondition); the webhook
   re-applies the same duration bound server-side as a backstop.

   SS_FILE_SIZE_CAP is the File_Size_Cap (~300 MB). The design says
   "approximately 300 MB"; we lock the exact byte value to the binary MiB
   reading 300 * 1024 * 1024 = 314,572,800 bytes (no prior size cap existed in
   this file, so this is the canonical definition). SS_DURATION_CAP (90 s) is
   REUSED from the trim section above — the 90 is defined in exactly one place.

   ── ssValidateMediaFile reason codes (locked, documented) ──
     ''              → ok === true   (no reason needed)
     'invalid'       → sizeBytes or durationSec is non-finite (NaN/Infinity) or
                       negative — neither cap can be meaningfully evaluated
     'over_duration' → finite, non-negative, but durationSec > SS_DURATION_CAP
     'over_size'     → finite, non-negative, within duration, but
                       sizeBytes > SS_FILE_SIZE_CAP

   ── ok-gate (matches design Property 4 for valid finite, non-negative input) ──
     ok === (durationSec <= 90) && (sizeBytes <= SS_FILE_SIZE_CAP)

   ── Precedence when BOTH caps are exceeded ──
     Duration is checked FIRST, so a both-over file reports 'over_duration'.
     Duration is the harder, server-re-checked limit (the webhook deletes
     over-duration assets), so surfacing it first guides the curator to the
     blocking issue. Deterministic and documented.

   ── Non-finite / negative handling ──
     Inputs are coerced via Number(...). Any non-finite (NaN, ±Infinity) or
     negative duration or size makes ok=false with reason 'invalid'. Pure +
     defensive: no DOM, no network, never throws. */
var SS_FILE_SIZE_CAP = 300 * 1024 * 1024;  // File_Size_Cap = 314,572,800 bytes (~300 MiB), Req 4.3

function ssValidateMediaFile(sizeBytes, durationSec){
  var size = Number(sizeBytes);
  var dur = Number(durationSec);

  // Reject non-finite or negative inputs up front (Req 4.7 — fail closed).
  if (!isFinite(size) || !isFinite(dur) || size < 0 || dur < 0) {
    return { ok: false, reason: 'invalid' };
  }
  if (dur > SS_DURATION_CAP) {                 // Req 4.1 — duration precedence
    return { ok: false, reason: 'over_duration' };
  }
  if (size > SS_FILE_SIZE_CAP) {               // Req 4.3
    return { ok: false, reason: 'over_size' };
  }
  return { ok: true, reason: '' };
}
if (typeof window !== 'undefined') {
  window.ssValidateMediaFile = ssValidateMediaFile;
  window.SS_FILE_SIZE_CAP = SS_FILE_SIZE_CAP;
}

/* ═══════════════════════════════════════════════════════════════
   GENRE UNION — ssGenreUnion (Req 3.1, 3.2, 3.3; design Property 5)
   ═══════════════════════════════════════════════════════════════
   Client-side helper that flattens an array of per-title genre-name lists
   into the de-duplicated, FIRST-SEEN-ORDER-STABLE union the upload flow
   shows/transports. Example:
     ssGenreUnion([["Drama","Crime"], ["Crime","Thriller"], []])
       → ["Drama","Crime","Thriller"]

   ── De-dup semantics (DECIDED + LOCKED so the property test 6.2 mirrors it) ──
   • TRIM: each name is trimmed of leading/trailing whitespace before use.
   • DROP: empty/blank names (trim → '') are dropped and contribute nothing.
   • NON-STRING COERCION: non-string entries are SKIPPED, never String()-coerced.
       - null / undefined           → ignored
       - numbers/booleans/objects   → skipped (NOT coerced to text)
     This keeps the output predictable: only real string names survive.
   • DE-DUP KEY: the TRIMMED string, compared CASE-SENSITIVELY. The first-seen
     casing is preserved; later differently-cased variants ("drama" after
     "Drama") are treated as distinct and kept.
       Rationale: this is a display/transport list. The DB function
       sync_content_genres (0017) is the authority on case-INSENSITIVE
       resolution + create-if-missing; the client must NOT silently merge
       "Drama"/"drama" in a way that diverges from what gets sent, so we
       de-dup by exact trimmed text and let the DB normalise casing. Documented
       here and asserted by Property 5.

   ── Empty-safe + pure ──
     Outer arg null/undefined/not-an-array → []. Inner lists that are
     empty/null/undefined/non-array contribute nothing. Never throws, no DOM,
     no network.

   ── Idempotent ──
     For an already-unioned array u (distinct trimmed strings, no blanks),
     ssGenreUnion([u]) deep-equals u (same order, same values). */
function ssGenreUnion(titlesGenreLists){
  var out = [];
  var seen = Object.create(null);              // trimmed-name → true (case-sensitive key)
  if (!Array.isArray(titlesGenreLists)) return out;   // null/undefined/non-array → []
  for (var i = 0; i < titlesGenreLists.length; i++) {
    var list = titlesGenreLists[i];
    if (!Array.isArray(list)) continue;          // empty/null/undefined/non-array inner → skip
    for (var j = 0; j < list.length; j++) {
      var name = list[j];
      if (typeof name !== 'string') continue;    // skip non-strings (no coercion)
      var trimmed = name.trim();
      if (trimmed === '') continue;              // drop blank/whitespace-only
      if (seen[trimmed]) continue;               // de-dup by exact trimmed text
      seen[trimmed] = true;
      out.push(trimmed);
    }
  }
  return out;
}
if (typeof window !== 'undefined') {
  window.ssGenreUnion = ssGenreUnion;
}

/* ═══════════════════════════════════════════════════════════════
   TITLE LINKING + PUBLISH GATING — ssBuildTitleLinks, ssCanPublish
   (Req 1.2, 1.5, 2.2, 2.3; design Property 7)
   ───────────────────────────────────────────────────────────────
   A clip can recommend SEVERAL titles. The curator's chosen order IS the
   array order. These pure helpers turn that selection into the ordered
   `content_titles` link descriptors and decide whether a draft may publish.

   ── ssBuildTitleLinks(selectedTitles) ──
   Input : an array of selected-title entries, in the curator's order.
   Output: an array of link descriptors, ONE per DISTINCT title, shaped
             { title_id, sort_no }
           with sort_no = 0..m-1 following first-seen input order. The FIRST
           distinct title gets sort_no 0 — the PRIMARY (it mirrors
           content.title_id; see migration 0014, content_titles.sort_no = 0).

   ── Accepted entry shapes (documented, in precedence order) ──
     1. An OBJECT with a string `id`            → uses entry.id
     2. An OBJECT with a string `title_id`      → fallback when `id` absent
     3. A BARE string/uuid                      → the entry IS the id
   Anything else (null/undefined/empty-string id, numbers, objects with no
   usable id) is SKIPPED. Ids are uuids: kept AS-IS as strings, never Number()'d
   or otherwise coerced. A whitespace-only / empty id is treated as unusable.

   Note on content_id: 0014's content_titles row is (content_id, title_id,
   sort_no). The clip id isn't known when building links (the row is inserted
   at publish time), so this helper emits only { title_id, sort_no }; the
   publish step (task 14.7) attaches content_id.

   ── DE-DUP ──
     If the same id appears more than once, only the FIRST occurrence is kept
     (with its sort_no); later duplicates are dropped. sort_no stays a
     contiguous 0..m-1 with NO gaps after de-duping.

   ── Defensive ──
     null / undefined / non-array input → []. Pure, never throws. */
function ssBuildTitleLinks(selectedTitles){
  var out = [];
  if (!Array.isArray(selectedTitles)) return out;   // null/undefined/non-array → []
  var seen = Object.create(null);                   // title_id → true (de-dup, first wins)
  for (var i = 0; i < selectedTitles.length; i++) {
    var entry = selectedTitles[i];
    var id = null;
    if (typeof entry === 'string') {
      id = entry;                                   // bare string/uuid entry
    } else if (entry && typeof entry === 'object') {
      if (typeof entry.id === 'string') id = entry.id;             // primary shape
      else if (typeof entry.title_id === 'string') id = entry.title_id; // fallback shape
    }
    if (typeof id !== 'string') continue;           // no usable id → skip
    id = id.trim();
    if (id === '') continue;                        // empty/whitespace-only id → skip
    if (seen[id]) continue;                         // drop later duplicate, keep first
    seen[id] = true;
    out.push({ title_id: id, sort_no: out.length }); // contiguous 0..m-1, no gaps
  }
  return out;
}
if (typeof window !== 'undefined') {
  window.ssBuildTitleLinks = ssBuildTitleLinks;
}

/* ── ssCanPublish(draft) ──
   Returns true IFF the draft has at least one linked title — the gate the
   Review & Publish step checks (task 14.7) before minting an upload.

   A "draft" here is minimally an object that may carry:
     • selectedTitles : array of selected-title entries (see ssBuildTitleLinks)
     • title_id       : a primary title id (the sort_no 0 title)

   ── Exact rule (locked) ──
     ssCanPublish(draft) === true  iff
         ssBuildTitleLinks(draft.selectedTitles).length >= 1
       OR draft.title_id is a non-empty (trimmed) string id.
   This stays consistent with publish: the row's title_id is the sort_no 0
   title — which is exactly ssBuildTitleLinks(selectedTitles)[0].title_id when
   titles are selected, or draft.title_id when already set. When ssCanPublish
   is true the publish row's title_id is therefore guaranteed non-null.

   Defensive: null/undefined/odd input → false. Pure, never throws. */
function ssCanPublish(draft){
  if (!draft || typeof draft !== 'object') return false;
  if (ssBuildTitleLinks(draft.selectedTitles).length >= 1) return true;
  if (typeof draft.title_id === 'string' && draft.title_id.trim() !== '') return true;
  return false;
}
if (typeof window !== 'undefined') {
  window.ssCanPublish = ssCanPublish;
}

/* ═══════════════════════════════════════════════════════════════
   COVER THUMBNAIL — ssCoverThumbUrl, ssParseCoverTime
   (Req 8.2, 8.3; design Property 8)
   ───────────────────────────────────────────────────────────────
   The cover is a timestamp into the published clip, rendered as a Mux
   on-demand thumbnail. These two pure helpers build that URL and parse the
   cover time back out, and are exact round-trip inverses.

   ── URL SHAPE (locked) ──
     Absolute https URL so it is a complete, valid src:
       with a time : https://image.mux.com/<playbackId>/thumbnail.jpg?time=<t>
       no time     : https://image.mux.com/<playbackId>/thumbnail.jpg
     (The design text writes image.mux.com/<pid>/thumbnail.jpg?time=N; we
     prefix https:// so the value is a usable absolute URL. The Property-8
     round-trip only depends on the ?time=<t> query + parser, which holds
     regardless of the scheme.)

   ── ssCoverThumbUrl(playbackId, timeSec) ──
   • timeSec is a valid, USABLE cover time when it coerces to a finite,
     non-negative Number — INCLUDING 0. Zero is a real cover time (the first
     frame, the picker's default), so an explicitly-passed 0 yields ?time=0.
   • timeSec NOT supplied (undefined/null) OR not usable (non-finite, e.g.
     NaN/Infinity, or negative) → return the DEFAULT cover URL with NO `time`
     query parameter (design Property 8: "when no cover time is supplied the
     default cover URL carries no time parameter"). This is the crux of the
     0-vs-undefined distinction: 0 ⇒ ?time=0, undefined ⇒ no param.
   • Number formatting: render with String(Number(t)) so 5 → "5" and
     5.5 → "5.5"; ssParseCoverTime parses back with Number(), giving an exact
     round-trip for any finite non-negative t.
   • playbackId is used as-is (uuid-like string), coerced to a string;
     missing/empty playbackId still returns a sensible string (the id segment
     is just empty), never throws. The common case is a valid playback id.
   Pure: no DOM, no network, never throws. */
function ssCoverThumbUrl(playbackId, timeSec){
  var pid = (playbackId === undefined || playbackId === null) ? '' : String(playbackId);
  var base = 'https://image.mux.com/' + pid + '/thumbnail.jpg';
  // "no time supplied" = undefined/null OR not a usable non-negative finite number.
  if (timeSec === undefined || timeSec === null) return base;
  var t = Number(timeSec);
  if (!isFinite(t) || t < 0) return base;       // NaN, Infinity, negative → default (no param)
  return base + '?time=' + String(t);            // includes 0 → ?time=0
}
if (typeof window !== 'undefined') {
  window.ssCoverThumbUrl = ssCoverThumbUrl;
}

/* ── ssParseCoverTime(thumbUrl) ──
   Inverse of ssCoverThumbUrl: extract the `time` query value and return it as
   a Number, or null when there is no usable time.

   ── Locked rule ──
     ssParseCoverTime(ssCoverThumbUrl(pid, t)) === t for any valid non-negative
       finite t (including 0);
     ssParseCoverTime(ssCoverThumbUrl(pid)) === null (default URL → no param).
   • Returns null (the chosen "no time" sentinel) when: input is not a string,
     there is no `time` param, or the captured value is not a finite Number.
   • Parsing is DOM-free and dependency-free: a small regex captures the value
     after ?time= or &time=, then Number() coerces it.
   Pure: never throws. */
function ssParseCoverTime(thumbUrl){
  if (typeof thumbUrl !== 'string') return null;
  var m = /[?&]time=([^&#]+)/.exec(thumbUrl);
  if (!m) return null;                            // no time param (default URL) → null
  var t = Number(m[1]);
  if (!isFinite(t)) return null;                  // unusable value → null
  return t;
}
if (typeof window !== 'undefined') {
  window.ssParseCoverTime = ssParseCoverTime;
}

/* ═══════════════════════════════════════════════════════════════
   MULTI-TITLE WATCH IT — ssResolveWatchOptionsForTitles
   (Req 1.4, 2.4, 2.5, 6.2; design Property 6)
   ───────────────────────────────────────────────────────────────
   A v2 clip can recommend SEVERAL titles, and the Watch It sheet renders one
   section PER title. This is the multi-title extension of the single-title
   resolver ssResolveWatchOptions(clip, region, subscribedPlatformIds) defined
   earlier in this file — it does NOT reimplement any resolution logic, it just
   maps over the titles and delegates EACH one to that existing resolver, so
   every per-title behaviour (region-cached providers, the curator-platform
   fallback when a title has no providers for the region, the neutral
   "not available" message) is identical to the single-title path.

   ── Signature ──
     ssResolveWatchOptionsForTitles(titles, region, subs)
   • titles : array of title-like objects, each shaped like what
              ssResolveWatchOptions expects (carries `providers`, a
              region-keyed object, and optionally `curatorPlat`).
   • region : region string; forwarded UNCHANGED to each resolver call.
              (ssResolveWatchOptions itself defaults a falsy region to 'IN'.)
   • subs   : Set of subscribed platform_ids; forwarded UNCHANGED.
              (ssResolveWatchOptions itself defaults a falsy subs to new Set().)
   region/subs are passed THROUGH as-is — this helper never defaults or alters
   them; whatever defaulting happens is done by ssResolveWatchOptions alone.

   ── Per-entry output shape (LOCKED so property test 9.2 mirrors it) ──
   Returns an ARRAY with exactly ONE element per input title, IN ORDER. Entry i
   corresponds to titles[i] and equals:
     { title: titles[i], options, fallback, message }
   where { options, fallback, message } are the EXACT fields returned by
   ssResolveWatchOptions(titles[i], region, subs). So:
     • result.length === titles.length                       (one per title, order preserved)
     • result[i].title === titles[i]                          (the original object, by reference)
     • the rest of result[i] (options/fallback/message) deep-equals
       ssResolveWatchOptions(titles[i], region, subs)
   The `title` field lets the sheet render a labelled section per title.

   ── null/undefined-entry decision (DECIDED + LOCKED): KEEP, do not skip ──
   To guarantee "exactly one entry per title in order", we map the array AS-IS:
   the output length always equals the input length. A null/undefined title is
   kept and still passed to ssResolveWatchOptions — verified safe because that
   resolver guards every access (`clip && clip.providers...`, `clip && clip.curatorPlat`)
   and so returns its neutral branch { options: [], fallback: true, message:
   'Not available to stream in your region' } for a null clip rather than
   throwing. The kept entry is therefore { title: null, options: [], fallback:
   true, message: 'Not available...' }.

   ── Empty/defensive ──
     titles null/undefined/non-array → []. Pure: no DOM, no network, never throws. */
function ssResolveWatchOptionsForTitles(titles, region, subs){
  if (!Array.isArray(titles)) return [];          // null/undefined/non-array → []
  return titles.map(function (title) {
    var res = ssResolveWatchOptions(title, region, subs);  // delegate; reuse EXACTLY
    return {
      title:    title,
      options:  res.options,
      fallback: res.fallback,
      message:  res.message
    };
  });
}
if (typeof window !== 'undefined') {
  window.ssResolveWatchOptionsForTitles = ssResolveWatchOptionsForTitles;
}

/* ═══════════════════════════════════════════════════════════════
   DRAFTS — ssDraftToRow, ssDraftToLinks, ssRowToDraft
   (Req 5.4, 9.1, 9.4; design Property 9 — "Draft state round-trips")
   ───────────────────────────────────────────────────────────────
   A draft is a `content` row with status='draft' (no new column — design
   "Draft model"). These three PURE helpers serialise a draft's in-progress
   state to a `content` row patch (+ content_titles link rows) and reconstruct
   it, so a draft can be saved and resumed. Together they satisfy the
   ROUND-TRIP contract (design Property 9):

       ssRowToDraft(ssDraftToRow(d), ssDraftToLinks(d))  deep-equals  d

   ── CANONICAL DRAFT SHAPE (locked, so the 10.2 property test mirrors it) ──
     draft = {
       selectedTitles: [ {id:<string>}, ... ],   // ordered, distinct, non-empty ids
       pitch:    <string>,                        // the curator's pitch text
       vibes:    <string[]>,                      // selected mood names
       coverTime:<number|null>,                   // seconds into clip; null = none
       trim:     { in:<number>, out:<number>, src:<number> } | null,
     }
   selectedTitles entries are the NORMALISED {id} form — the same input
   ssBuildTitleLinks accepts. On the way BACK, ssRowToDraft reconstructs
   selectedTitles FROM THE LINKS as `links.sortBy(sort_no).map(l => ({id:
   l.title_id}))`. So a draft whose selectedTitles are already [{id:'a'},
   {id:'b'}] (distinct ids, in order) round-trips EXACTLY. (A draft using
   richer title objects or bare-string ids still serialises fine, but its
   selectedTitles come back normalised to [{id}], which is the documented and
   intended canonical form for the round-trip.)

   ── DB COLUMN MAPPING (design "Draft model") ──
     pitch          → content.description
     primary title  → content.title_id   (the sort_no 0 link, or null)
     linked titles  → content_titles rows {title_id, sort_no}
     vibes/moods    → content.meta.vibes
     cover time     → content.meta.cover_time
     trim points    → content.meta.trim = { in, out, src }
   (Video/Mux fields are intentionally NOT handled here: a draft may have no
   asset yet, and the mux_* columns are written by the publish/webhook path,
   not by draft (de)serialisation.)

   ── EXACT meta SHAPE produced by ssDraftToRow (locked) ──
   `meta` ALWAYS carries exactly these three keys so the round-trip is
   well-defined regardless of which fields the draft set:
       meta: { vibes: <string[]>, cover_time: <number|null>, trim: <{in,out,src}|null> }
   Defaults: vibes → [], cover_time → null, trim → null.

   ── ROUND-TRIP CONTRACT (locked) ──
   For a draft d whose selectedTitles is a list of {id:<string>} with distinct,
   non-empty ids in order, pitch a string, vibes a string[], coverTime a
   number|null, and trim a {in,out,src}|null, then
       ssRowToDraft(ssDraftToRow(d), ssDraftToLinks(d))  deep-equals  d.
   The 10.2 property test generates drafts in exactly this normalised shape.

   All three helpers are PURE: no DOM, no network, never throw; missing /
   malformed input degrades to a sensible empty draft / empty row / empty
   links. */

/* Normalise a trim value to the locked { in, out, src } shape, or null. */
function _ssNormTrim(t){
  if (!t || typeof t !== 'object') return null;
  return { in: t.in, out: t.out, src: t.src };
}
/* Normalise a cover time to a finite number, or null (0 is a valid time). */
function _ssNormCoverTime(v){
  if (v === undefined || v === null) return null;
  var n = Number(v);
  return isFinite(n) ? n : null;
}

/* ── ssDraftToRow(draft) → `content` row patch ──
   { description, title_id, status:'draft', meta:{ vibes, cover_time, trim } }
   • description = draft.pitch coerced to a string ('' when absent/non-string).
   • title_id    = ssBuildTitleLinks(draft.selectedTitles)[0]?.title_id ?? null
                   (the primary, sort_no 0 link; null when no titles selected).
   • meta carries the locked three keys with their defaults (see header).
   Pure, never throws; a missing/odd draft yields the sensible empty row. */
function ssDraftToRow(draft){
  var d = (draft && typeof draft === 'object') ? draft : {};
  var links = ssBuildTitleLinks(d.selectedTitles);
  return {
    description: (typeof d.pitch === 'string') ? d.pitch : '',
    title_id: links.length ? links[0].title_id : null,
    status: 'draft',
    meta: {
      vibes: Array.isArray(d.vibes) ? d.vibes.slice() : [],
      cover_time: _ssNormCoverTime(d.coverTime),
      trim: _ssNormTrim(d.trim)
    }
  };
}
if (typeof window !== 'undefined') {
  window.ssDraftToRow = ssDraftToRow;
}

/* ── ssDraftToLinks(draft) → content_titles rows ──
   Reuses ssBuildTitleLinks: one { title_id, sort_no } per distinct selected
   title, sort_no 0..n-1 in curator order. Pure, never throws (delegates the
   null/non-array → [] handling to ssBuildTitleLinks). */
function ssDraftToLinks(draft){
  return ssBuildTitleLinks(draft && draft.selectedTitles);
}
if (typeof window !== 'undefined') {
  window.ssDraftToLinks = ssDraftToLinks;
}

/* ── ssRowToDraft(row, links) → reconstructed draft state ──
   The inverse of ssDraftToRow + ssDraftToLinks:
     { selectedTitles, pitch, vibes, coverTime, trim }
   • selectedTitles = links sorted by sort_no ASCENDING, mapped to {id:
     l.title_id} (restores curator order; normalised {id} form).
   • pitch     = row.description || '' (string).
   • vibes     = row.meta.vibes when an array, else [].
   • coverTime = row.meta.cover_time normalised to a finite number, else null.
   • trim      = row.meta.trim normalised to {in,out,src}, else null.
   Pure, never throws; tolerates missing row / meta / links (→ empties). */
function ssRowToDraft(row, links){
  var r = (row && typeof row === 'object') ? row : {};
  var meta = (r.meta && typeof r.meta === 'object') ? r.meta : {};
  var ls = Array.isArray(links) ? links.slice() : [];
  ls.sort(function (a, b) {
    var an = (a && isFinite(Number(a.sort_no))) ? Number(a.sort_no) : 0;
    var bn = (b && isFinite(Number(b.sort_no))) ? Number(b.sort_no) : 0;
    return an - bn;                               // ascending by sort_no → restores order
  });
  return {
    selectedTitles: ls.map(function (l) { return { id: l.title_id }; }),
    pitch: (typeof r.description === 'string') ? r.description : '',
    vibes: Array.isArray(meta.vibes) ? meta.vibes.slice() : [],
    coverTime: _ssNormCoverTime(meta.cover_time),
    trim: _ssNormTrim(meta.trim)
  };
}
if (typeof window !== 'undefined') {
  window.ssRowToDraft = ssRowToDraft;
}

/* ═══════════════════════════════════════════════════════════════
   EDIT-AFTER-POST — ssBuildEditPatch
   (Req 10.2, 10.3, 10.5; design Property 10 — "Edit patch only ever
   touches Mutable_Metadata")
   ───────────────────────────────────────────────────────────────
   Edit-after-post lets an owner change a published clip's METADATA only.
   The video bytes / Mux asset are the Immutable_Asset and must NEVER be
   written through the edit path (Req 10.3). This PURE helper turns an
   `editInput` into a `content` UPDATE patch that is GUARANTEED to contain
   ONLY mutable keys — it is built by an explicit ALLOWLIST (never by
   spreading editInput), so an unknown or forbidden field carried on the
   input can never leak into the patch.

   ── ALLOWLIST (the ONLY keys the patch may ever own) ──
     top-level : { description, title_id, meta, thumbnail_url }
     meta       : { vibes, cover_time }            (when meta is present)
   The patch NEVER contains mux_asset_id, mux_playback_id, url,
   mux_upload_id, duration_sec, status, creator_id, deleted_at, or any
   other field — including the immutable video-bytes/asset fields.

   ── INPUT CONTRACT (editInput, all keys optional) ──
     pitch          : string  — the new pitch (see description rule below)
     selectedTitles : array   — selected-title entries; the primary is
                                ssBuildTitleLinks(selectedTitles)[0].title_id
     title_id       : string  — alternative DIRECT primary title id (used
                                only when selectedTitles yields no primary)
     vibes          : string[]— selected moods → meta.vibes
     coverTime      : number  — seconds into the clip → meta.cover_time
                                (0 is a valid, included value)
     thumbnailUrl   : string  — explicit cover image URL (takes precedence)
     coverUrl       : string  — alias for thumbnailUrl
     muxPlaybackId  : string  — used ONLY to BUILD a thumbnail_url via
                                ssCoverThumbUrl when a coverTime is given;
                                it is NEVER written as a mux_* field.
   Any other property on editInput (e.g. mux_asset_id, url) is IGNORED.

   ── KEY RULES (locked, so the 10.4 property test mirrors them) ──
   • description : included ONLY when editInput.pitch is a string AND
     ssValidatePitch(pitch).ok is true (length 1..280). An over-max pitch
     (>280, .ok=false) → description OMITTED, so an invalid pitch is never
     written (Req 10.5 — "apply the same Pitch length rules"). The UI/
     ssValidatePitch enforce the 280 cap; this builder simply omits the
     key when the pitch is out of range.
   • title_id    : the primary from ssBuildTitleLinks(selectedTitles)[0]
     when selectedTitles yields a link; else editInput.title_id when it is
     a non-empty (trimmed) string; else OMITTED.
   • meta        : an object carrying ONLY the present sub-keys —
       vibes      when editInput.vibes is an array,
       cover_time when editInput.coverTime is a finite number (incl. 0).
     When neither is present, meta is OMITTED entirely (no empty {}).
   • thumbnail_url : PRECEDENCE — an explicit string thumbnailUrl (or
     coverUrl) wins; otherwise, when muxPlaybackId is given AND coverTime
     is a finite number, it is built via ssCoverThumbUrl(muxPlaybackId,
     coverTime). Otherwise OMITTED. (muxPlaybackId alone, with no cover
     time and no explicit url, never produces a thumbnail_url.)

   Pure: no DOM, no network, never throws. null/undefined/odd editInput →
   returns {} (or a patch with only the derivable allowed keys). */
function ssBuildEditPatch(editInput){
  var e = (editInput && typeof editInput === 'object') ? editInput : {};
  var patch = {};                                 // ALLOWLIST: assign only mutable keys

  // description — only a valid (1..280) pitch is ever written (Req 10.5).
  if (typeof e.pitch === 'string' && ssValidatePitch(e.pitch).ok) {
    patch.description = e.pitch;
  }

  // title_id — prefer the primary derived from selectedTitles, else the
  // direct title_id when it is a non-empty string.
  var links = ssBuildTitleLinks(e.selectedTitles);
  if (links.length) {
    patch.title_id = links[0].title_id;
  } else if (typeof e.title_id === 'string' && e.title_id.trim() !== '') {
    patch.title_id = e.title_id;
  }

  // meta — include ONLY the present sub-keys; omit meta entirely if empty.
  var meta = {};
  var hasMeta = false;
  if (Array.isArray(e.vibes)) { meta.vibes = e.vibes.slice(); hasMeta = true; }
  var coverTimeNum = Number(e.coverTime);
  var hasCoverTime = (e.coverTime !== undefined && e.coverTime !== null && isFinite(coverTimeNum));
  if (hasCoverTime) { meta.cover_time = coverTimeNum; hasMeta = true; }
  if (hasMeta) { patch.meta = meta; }

  // thumbnail_url — explicit url wins; else build from playback id + cover time.
  var explicitUrl = (typeof e.thumbnailUrl === 'string') ? e.thumbnailUrl
                  : (typeof e.coverUrl === 'string') ? e.coverUrl
                  : null;
  if (explicitUrl !== null) {
    patch.thumbnail_url = explicitUrl;
  } else if (e.muxPlaybackId !== undefined && e.muxPlaybackId !== null &&
             String(e.muxPlaybackId) !== '' && hasCoverTime) {
    patch.thumbnail_url = ssCoverThumbUrl(e.muxPlaybackId, coverTimeNum);
  }

  return patch;
}
if (typeof window !== 'undefined') {
  window.ssBuildEditPatch = ssBuildEditPatch;
}

/* ═══════════════════════════════════════════════════════════════
   CURATOR ROLE PERSISTENCE — ssBuildOnboardingPatch
   (Req 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 7.2, 7.3, 9.2; design
   Components → "The patch shape", Properties 1-3)
   ───────────────────────────────────────────────────────────────
   Curator onboarding completion (`bcActivate`) persists the chosen
   identity together with `role = 'curator'` in a single self-scoped
   `users` update. This PURE helper turns the collected onboarding
   fields into that UPDATE patch. The patch is built by an explicit
   ALLOWLIST (never by spreading the input), so an unknown field on the
   input can never leak in, and identity keys are included ONLY when
   their source value is present/valid so an empty value never
   overwrites an existing one (Req 1.6 — no overwrite-with-empty).

   ── ALLOWLIST (the ONLY keys the patch may ever own) ──
     { role, username, bio, genres, avatar_url }

   ── INPUT CONTRACT (input, all keys optional; input may be
      null/undefined/{}) ──
     handle    : string  — raw handle field (may include a leading '@'
                           and surrounding whitespace)
     bio       : string  — raw bio value
     genres    : string[]— selected specialties
     avatarUrl : string|null — resolved Storage public URL when an
                           upload succeeded; null/undefined otherwise

   ── KEY RULES (locked, so the Property tests mirror them) ──
   • role        : ALWAYS 'curator' for every input, including {} /
     null / undefined (Req 1.1, 9.2).
   • username    : included ONLY when `handle` is a string that is
     non-empty after (a) trimming surrounding whitespace and (b)
     stripping exactly ONE leading '@'. Stored value is that trimmed,
     '@'-free string. Empty after stripping → OMITTED (Req 1.2).
   • bio         : included ONLY when `bio` is a string non-empty after
     trim(); stored value is the trimmed bio. Else OMITTED (Req 1.3).
   • genres      : included ONLY when `genres` is an array of length
     1..6 (inclusive); stored as a shallow copy. Length 0 or >6, or a
     non-array → OMITTED (Req 1.4).
   • avatar_url  : included ONLY when `avatarUrl` is a non-empty string;
     stored as-is. null/undefined/'' → OMITTED (Req 1.5).

   Pure: no DOM, no Supabase, no network, never throws. */
function ssBuildOnboardingPatch(input){
  var i = (input && typeof input === 'object') ? input : {};
  var patch = { role: 'curator' };                // ALLOWLIST: role is always set

  // username — trim whitespace, strip a single leading '@', include when non-empty.
  if (typeof i.handle === 'string') {
    var handle = i.handle.trim();
    if (handle.charAt(0) === '@') { handle = handle.slice(1); }
    handle = handle.trim();
    if (handle !== '') { patch.username = handle; }
  }

  // bio — include the trimmed value only when non-empty.
  if (typeof i.bio === 'string') {
    var bio = i.bio.trim();
    if (bio !== '') { patch.bio = bio; }
  }

  // genres — include a shallow copy only for an array of length 1..6.
  if (Array.isArray(i.genres) && i.genres.length >= 1 && i.genres.length <= 6) {
    patch.genres = i.genres.slice();
  }

  // avatar_url — include a non-empty string as-is.
  if (typeof i.avatarUrl === 'string' && i.avatarUrl !== '') {
    patch.avatar_url = i.avatarUrl;
  }

  return patch;
}
if (typeof window !== 'undefined') {
  window.ssBuildOnboardingPatch = ssBuildOnboardingPatch;
}

/* ── MY CLIPS (owner profile) ───────────────────────────────────
   Loads the SIGNED-IN user's OWN clips straight from the DB, scoped to
   creator_id = me. Unlike ssLoadClips (feed = live only), this includes
   'processing' rows too and carries the REAL status, so the profile's
   "My Clips" badge reflects the database — not a stale sessionStorage
   copy. This is the authoritative source for the owner profile so an
   upload survives re-login and a webhook flip to 'live' is reflected on
   next load. Returns [] for guests / offline (profile keeps its mock). */
async function ssLoadMyClips(){
  if(!window.ssDB) return [];
  var me = window.ssCurrentUser && window.ssCurrentUser();
  if(!me || !me.id) return [];
  try{
    var res = await window.ssDB.from("content")
      .select("id, description, fires_count, views_count, meta, status, mux_playback_id, url, thumbnail_url, duration_sec, created_at, creator:creator_id(username,name,avatar_url), title:title_id(name,year,synopsis,providers,cached_at), platform:platform_id(id,name,color,abbr)")
      .eq("creator_id", me.id)
      .in("status", ["processing","live"])
      .is("deleted_at", null)
      .order("created_at",{ascending:false});
    if(res.error || !res.data) return [];
    return res.data.map(function(row){
      var meta=row.meta||{}, p=row.platform||{}, t=row.title||{}, cr=row.creator||{};
      var mood=[]; try{ mood=JSON.parse(meta.mood||"[]"); }catch(e){}
      var uname=cr.username||"curator";
      return {
        id: row.id, status: row.status, mine: true,
        title: t.name||"", year: t.year||"", synopsis: t.synopsis||"",
        caption: row.description||"", fires: row.fires_count||0, views: row.views_count||0,
        genre: Array.isArray(meta.genres) ? meta.genres.slice() : [], mood: mood, lang: meta.lang||"", season: meta.season||"",
        bg: meta.bg||"linear-gradient(160deg,#1a0505,#2d0808,#0d0d0d,#000)",
        muxPlaybackId: row.mux_playback_id || null,
        poster: row.thumbnail_url || (row.mux_playback_id ? ssCoverThumbUrl(row.mux_playback_id, (typeof meta.cover_time === 'number' && meta.cover_time > 0) ? meta.cover_time : undefined) : null),
        url: row.url || null,
        durationSec: row.duration_sec || null,
        platLabel: p.name||"Streaming", platColor: p.color||"#EA3B32",
        platAbbr: p.abbr||(p.name?p.name.charAt(0):"\u25B6"), platRgb: _ssHexRgb(p.color),
        providers: t.providers || {},
        cachedAt: t.cached_at || null,
        curatorPlat: (p && p.name) ? { platform_id: p.id||null, name: p.name, color: p.color, abbr: p.abbr } : null,
        creator: { name: uname, letter: uname.charAt(0).toUpperCase(), bg: "#EA3B32", avatar: cr.avatar_url||null }
      };
    });
  }catch(e){ return []; }
}
window.ssLoadMyClips=ssLoadMyClips;

/* ── Button UI sync ────────────────────────────── */
// Call after any page renders its save buttons so they
// reflect the current sessionStorage state correctly.
function ssSyncSaveBtn(clipId) {
  const saved = ssIsClipSaved(clipId);
  document.querySelectorAll(`[data-save-id="${clipId}"]`).forEach(btn => {
    btn.classList.toggle('saved', saved);
  });
}

function ssSyncAllSaveBtns() {
  document.querySelectorAll('[data-save-id]').forEach(btn => {
    const id = btn.getAttribute('data-save-id');
    // id can be string or number — compare loosely
    const saved = ssGetStacks().some(s => s.clips.some(c => String(c.id) === String(id)));
    btn.classList.toggle('saved', saved);
  });
}

/* ── Main toggle entry point ───────────────────── */
// Call this from every save button on every page:
//   onclick="ssToggleSave(SHOWS[i], this)"
// The button must also have data-save-id="${show.id}"
function ssToggleSave(clip, btnEl) {
  if (!clip) return;
  if (ssIsClipSaved(clip.id)) {
    // Already saved — remove from all stacks immediately
    ssRemoveClipFromAllStacks(clip.id);
    ssSyncSaveBtn(clip.id);
    if (btnEl) btnEl.classList.remove('saved');
    ssToast('Removed from Watchlist');
  } else {
    // Not saved — open the stack picker
    _ssOpenStackSheet(clip, btnEl);
  }
}


/* ════════════════════════════════════════════════
   STACK SHEET
   Full bottom-sheet UI for picking / creating stacks.
   Injected into the DOM once by this file — works on
   every page without any extra HTML.
════════════════════════════════════════════════ */

let _ssSheetClip  = null;
let _ssSheetBtn   = null;

/* ── Inject CSS ──────────────────────────────── */
(function _injectStackSheetCSS() {
  const s = document.createElement('style');
  s.id = 'ss-stack-sheet-style';
  s.textContent = `
    /* Overlay */
    #ss-stack-overlay {
      position: fixed; inset: 0; z-index: 500;
      background: rgba(0,0,0,0.65);
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
    }
    #ss-stack-overlay.open { opacity: 1; pointer-events: all; }

    /* Sheet */
    #ss-stack-sheet {
      position: fixed; left: 50%; bottom: 0;
      transform: translateX(-50%) translateY(100%);
      z-index: 501;
      background: #13131A;
      border-top: 1px solid rgba(255,255,255,0.07);
      border-radius: 24px 24px 0 0;
      padding: 0 0 32px;
      transition: transform 0.4s cubic-bezier(.4,0,.2,1);
      max-height: 80vh; overflow-y: auto;
      width: min(440px, 100vw); scrollbar-width: none;
    }
    #ss-stack-sheet::-webkit-scrollbar { display: none; }
    #ss-stack-sheet.open { transform: translateX(-50%) translateY(0); }

    .ss-sh-handle {
      width: 36px; height: 4px;
      background: rgba(255,255,255,0.07);
      border-radius: 2px; margin: 14px auto 0;
    }
    .ss-sh-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 20px; letter-spacing: 1.5px; color: #fff;
      padding: 14px 20px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .ss-sh-title em { color: #EA3B32; font-style: normal; }

    .ss-sh-section-label {
      padding: 14px 20px 8px;
      font-size: 10px; font-weight: 700; color: #5A5A72;
      letter-spacing: 2.5px; text-transform: uppercase;
    }

    /* Stack row */
    .ss-stack-row {
      display: flex; align-items: center; gap: 14px;
      padding: 10px 20px; cursor: pointer; transition: background 0.15s;
    }
    .ss-stack-row:hover  { background: #1A1A24; }
    .ss-stack-row:active { background: #22222F; }

    .ss-stack-row-thumb {
      width: 46px; height: 46px; border-radius: 11px; flex-shrink: 0;
      overflow: hidden; position: relative;
      background: #1A1A24; border: 1px solid rgba(255,255,255,0.07);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
    }
    .ss-stack-row-thumb-bg {
      position: absolute; inset: 0;
      background-size: cover; background-position: center;
    }
    .ss-stack-row-info { flex: 1; min-width: 0; }
    .ss-stack-row-name {
      font-size: 14px; font-weight: 600; color: #fff;
      margin-bottom: 2px; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis;
    }
    .ss-stack-row-count { font-size: 12px; color: #5A5A72; }

    .ss-stack-row-check {
      width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
      border: 1.5px solid rgba(255,255,255,0.14);
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s cubic-bezier(.34,1.56,.64,1);
    }
    .ss-stack-row.in-stack .ss-stack-row-check {
      background: #EA3B32; border-color: #EA3B32;
      box-shadow: 0 0 10px rgba(234,59,50,0.45);
    }

    /* No stacks message */
    .ss-no-stacks {
      padding: 12px 20px 4px;
      font-size: 13px; color: #5A5A72;
    }

    /* Create new stack row */
    .ss-create-row {
      padding: 14px 20px;
      border-top: 1px solid rgba(255,255,255,0.07);
      margin-top: 4px;
    }
    .ss-create-trigger {
      display: flex; align-items: center; gap: 12px;
      cursor: pointer; transition: opacity 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .ss-create-trigger:hover { opacity: 0.75; }
    .ss-create-plus {
      width: 46px; height: 46px; border-radius: 11px;
      border: 1.5px dashed rgba(234,59,50,0.4);
      display: flex; align-items: center; justify-content: center;
      color: #EA3B32; font-size: 24px; flex-shrink: 0;
      transition: border-color 0.15s;
    }
    .ss-create-trigger:hover .ss-create-plus { border-color: rgba(234,59,50,0.7); }
    .ss-create-plus-label {
      font-size: 14px; font-weight: 600; color: #EA3B32;
    }

    /* Inline input */
    .ss-create-input-row {
      display: none; gap: 8px; margin-top: 10px;
    }
    .ss-create-input-row.visible { display: flex; }
    .ss-name-input {
      flex: 1; background: #1A1A24;
      border: 1.5px solid rgba(234,59,50,0.35);
      border-radius: 12px; padding: 11px 14px;
      color: #fff; font-family: 'DM Sans', sans-serif;
      font-size: 14px; font-weight: 500; outline: none;
      transition: border-color 0.2s;
    }
    .ss-name-input:focus  { border-color: rgba(234,59,50,0.65); }
    .ss-name-input::placeholder { color: #5A5A72; }
    .ss-name-confirm {
      padding: 11px 18px; border-radius: 12px;
      background: #EA3B32; border: none; color: #fff;
      font-family: 'DM Sans', sans-serif;
      font-size: 13px; font-weight: 700; cursor: pointer;
      white-space: nowrap; transition: background 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .ss-name-confirm:hover { background: #FF4D42; }

    /* Cancel */
    .ss-sh-cancel {
      margin: 8px 20px 0; padding: 13px; text-align: center;
      color: #5A5A72; font-size: 14px; font-weight: 500;
      cursor: pointer; border: 1px solid rgba(255,255,255,0.07);
      border-radius: 14px; font-family: 'DM Sans', sans-serif;
      transition: background 0.15s;
    }
    .ss-sh-cancel:hover { background: #1A1A24; }
  `;
  document.head.appendChild(s);
})();

/* ── Inject HTML ─────────────────────────────── */
(function _injectStackSheetHTML() {
  const overlay = document.createElement('div');
  overlay.id = 'ss-stack-overlay';
  overlay.addEventListener('click', e => {
    if (e.target === overlay) _ssCloseStackSheet();
  });
  overlay.innerHTML = `
    <div id="ss-stack-sheet">
      <div class="ss-sh-handle"></div>
      <div class="ss-sh-title">Save to <em>Stack</em></div>
      <div class="ss-sh-section-label">YOUR STACKS</div>
      <div id="ss-stack-list"></div>
      <div class="ss-create-row">
        <div class="ss-create-trigger" onclick="_ssShowCreateInput()">
          <div class="ss-create-plus">+</div>
          <span class="ss-create-plus-label">New stack</span>
        </div>
        <div class="ss-create-input-row" id="ss-create-input-row">
          <input class="ss-name-input" id="ss-name-input"
            type="text" placeholder="Stack name…" maxlength="32"
            onkeydown="if(event.key==='Enter') _ssConfirmCreate()"/>
          <button class="ss-name-confirm" onclick="_ssConfirmCreate()">Save</button>
        </div>
      </div>
      <div class="ss-sh-cancel" onclick="_ssCloseStackSheet()">Cancel</div>
    </div>
  `;
  document.body.appendChild(overlay);
})();

/* ── Sheet open / close ──────────────────────── */
function _ssOpenStackSheet(clip, btnEl) {
  _ssSheetClip = clip;
  _ssSheetBtn  = btnEl;
  _ssRenderStackList();
  // Reset create input state
  document.getElementById('ss-create-input-row')?.classList.remove('visible');
  const inp = document.getElementById('ss-name-input');
  if (inp) inp.value = '';
  document.getElementById('ss-stack-overlay')?.classList.add('open');
  document.getElementById('ss-stack-sheet')?.classList.add('open');
}

function _ssCloseStackSheet() {
  document.getElementById('ss-stack-sheet')?.classList.remove('open');
  document.getElementById('ss-stack-overlay')?.classList.remove('open');
  _ssSheetClip = null;
  _ssSheetBtn  = null;
}

/* ── Render stack list inside sheet ─────────── */
function _ssRenderStackList() {
  const list = document.getElementById('ss-stack-list');
  if (!list) return;
  const stacks = ssGetStacks();

  if (!stacks.length) {
    list.innerHTML = `<div class="ss-no-stacks">No stacks yet — create one below to start saving.</div>`;
    return;
  }

  const clipId = _ssSheetClip?.id;

  list.innerHTML = stacks.map(stack => {
    const inStack   = stack.clips.some(c => String(c.id) === String(clipId));
    const firstClip = stack.clips[0];
    const checkSVG  = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,6 5,9 10,3"/></svg>`;
    return `
      <div class="ss-stack-row ${inStack ? 'in-stack' : ''}"
           onclick="_ssToggleInStack('${stack.id}')">
        <div class="ss-stack-row-thumb">
          ${firstClip
            ? `<div class="ss-stack-row-thumb-bg" style="background:${firstClip.bg}"></div>`
            : '🗂️'}
        </div>
        <div class="ss-stack-row-info">
          <div class="ss-stack-row-name">${stack.name}</div>
          <div class="ss-stack-row-count">${stack.clips.length} clip${stack.clips.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="ss-stack-row-check">${inStack ? checkSVG : ''}</div>
      </div>`;
  }).join('');
}

/* ── Toggle clip in a stack ──────────────────── */
function _ssToggleInStack(stackId) {
  if (!_ssSheetClip) return;
  const stacks  = ssGetStacks();
  const stack   = stacks.find(s => s.id === stackId);
  if (!stack) return;

  const alreadyIn = stack.clips.some(c => String(c.id) === String(_ssSheetClip.id));
  const clipId = _ssSheetClip.id;

  if (alreadyIn) {
    // Removing is not a "done" action — keep the sheet open so the user
    // can re-pick. Route through ssRemoveClipFromStack so it ALSO mirrors
    // the removal to the DB (not just sessionStorage).
    ssRemoveClipFromStack(stackId, clipId);
    ssToast(`Removed from ${stack.name}`);
    _ssRenderStackList();
    ssSyncSaveBtn(clipId);
  } else {
    // Saving IS a completion action. Route through ssAddClipToStack so it
    // writes to BOTH sessionStorage AND the DB (this was the bug: the sheet
    // used to write storage directly and skip the DB, so saves vanished on
    // hydrate / next session). Then checkmark + auto-close.
    ssAddClipToStack(stackId, _ssSheetClip);
    ssToast(`🔖 Saved to ${stack.name}`);
    _ssRenderStackList();          // briefly shows the checkmark filling in
    ssSyncSaveBtn(clipId);
    setTimeout(_ssCloseStackSheet, 380);  // let the check animate, then dismiss
  }
}

/* ── Create new stack inline ─────────────────── */
function _ssShowCreateInput() {
  document.getElementById('ss-create-input-row')?.classList.add('visible');
  document.getElementById('ss-name-input')?.focus();
}

function _ssConfirmCreate() {
  const input = document.getElementById('ss-name-input');
  const name  = input?.value?.trim();
  if (!name) { ssToast('Give your stack a name first'); return; }

  const newStack = ssCreateStack(name);

  // Immediately add the current clip to the new stack
  if (_ssSheetClip) {
    ssAddClipToStack(newStack.id, _ssSheetClip);
    ssSyncSaveBtn(_ssSheetClip.id);
    if (_ssSheetBtn) _ssSheetBtn.classList.add('saved');
    ssToast(`🔖 Saved to ${name}`);
  }

  _ssCloseStackSheet();
}



/* ════════════════════════════════════════════════
   ── UNIVERSAL WATCH IT SHEET (auto-inject) ──────
   The Watch It sheet markup only lives inline on the
   Feed page. Inject it on every OTHER page so that
   ssOpenSheet() works everywhere (Discover, Watchlist,
   Profile, and the universal clip viewer below).
   Styles come from showshak-components.css.
════════════════════════════════════════════════ */
(function _injectWatchSheet() {
  if (document.getElementById('watch-sheet')) return; // Feed already has it
  const overlay = document.createElement('div');
  overlay.id = 'watch-sheet-overlay';
  overlay.addEventListener('click', ssCloseSheet);
  const sheet = document.createElement('div');
  sheet.id = 'watch-sheet';
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-header" id="sheet-header"></div>
    <div class="sheet-options-label">WATCH ON</div>
    <div id="sheet-options"></div>
    <div class="sheet-cancel">Cancel</div>
  `;
  sheet.querySelector('.sheet-cancel').addEventListener('click', ssCloseSheet);
  document.body.appendChild(overlay);
  document.body.appendChild(sheet);
})();


/* ════════════════════════════════════════════════
   ── UNIVERSAL CLIP VIEWER ───────────────────────
   Instagram-style full-screen clip player that opens
   from ANY page (Discover, Watchlist, Profile).

   - Covers the nav (z-index 250) but sits BELOW the
     Watch It sheet (300/301), toast (400) and stack
     sheet (500/501) so all of those still work.
   - Vertical scroll-snap through related clips
     ("same segment" — prototype algorithm groups by
     shared genre, then fills with the rest).
   - Normalizes the different per-page clip schemas
     into one canonical shape.

   Open from any card:
     ssOpenClip(clipObject, listArray)
     ssOpenClip(clipId, listArray)        // id lookup
════════════════════════════════════════════════ */

let _ssvClips      = [];      // normalized clips currently in the viewer
let _ssvFired      = new Set; // indices fired this session
let _ssvPrevScroll = null;    // saved body overflow
let _ssvObserver   = null;
let _ssvHistoryActive = false;// true while our back-to-close history entry is live

// ── Shared engine playback state (used by ClipEngine) ──────────────
// One Media_Surface + one Progress_Bar per clip, indexed like _ssvClips.
let _ssvSurfaces   = [];      // Media_Surface instances, one per clip
let _ssvBars       = [];      // Progress_Bar instances, one per clip
let _ssvActiveIdx  = -1;      // index of the currently-active (playing) clip
// INLINE first-clip muted-autoplay flag. FULLSCREEN opens are always
// gesture-initiated so this stays false here; INLINE mode (later task)
// flips it on for the first clip until the first user interaction.
// Session-level Audio_Unlock (clip-player-performance Phase 2, Req 1.1, 2.5).
// Browsers force muted autoplay until a real user gesture occurs; after the
// FIRST gesture on a feed-bearing page, unmuted playback is allowed for the
// rest of the session. This flag is shared by BOTH hosts (inline Feed +
// fullscreen viewer) through the single engine, so once it flips, scrolling
// between clips no longer needs the muted→unmuted "dance" that dropped audio.
let _ssAudioUnlocked = false;

/* ssMarkAudioUnlocked() — flip the session unlock once, on the first user
   gesture in EITHER host (or on a gesture-initiated fullscreen open / mute
   toggle). Idempotent. (Req 1.1, 2.5) */
function ssMarkAudioUnlocked() {
  if (_ssAudioUnlocked) return;
  _ssAudioUnlocked = true;
}

/* ssResolveSurfaceMuted(unlocked, mutePref) — the PURE audio-resolution rule
   (Req 1.4, 1.5; design Property 1). Before Audio_Unlock the browser forces
   muted, so the answer is always true; after unlock we honor the persisted
   Mute_Preference. Total and DOM-free for Node + fast-check. */
function ssResolveSurfaceMuted(unlocked, mutePref) {
  if (!unlocked) return true;        // autoplay policy: muted until first gesture
  return Boolean(mutePref);          // post-unlock: honor persisted intent
}

/* resolveMuted(mode) — the single sound-resolution rule (design: Sound model),
   now expressed through the pure ssResolveSurfaceMuted + the session unlock
   flag. Mode is retained for call-site compatibility but no longer branches:
   the unlock flag is shared across hosts, so the rule is uniform. */
function _ssvResolveMuted(mode) {
  return ssResolveSurfaceMuted(_ssAudioUnlocked, ssGetMutePref());
}

/* _activatePostUnlock(prevSurface, surface) — the unlock-aware activate
   (Req 1.3, 1.4, 1.8). Once Audio_Unlock is granted, activating a clip is just
   "pause prev, play active": we set the resolved sound state ONCE (never the
   muted→unmuted transition that caused audio to drop on scroll) and play. If
   the browser still rejects play() (e.g. a re-point landed mid gesture-expiry),
   retry once, then fall back to a muted play so the VIDEO keeps moving — the
   onMutedChange listener repaints the icon to the real state. The session
   unlock flag is NOT cleared by a single rejection. */
function _activatePostUnlock(prevSurface, surface) {
  if (prevSurface) { try { prevSurface.pause(); } catch (e) {} }
  if (!surface) return;
  // A continuation must NEVER act on a surface that has since been paused
  // (i.e. the user scrolled away). play()'s promise rejects on that pause, and
  // the old code's .catch() blindly retried play() — resurrecting a
  // scrolled-away clip with its audio (you'd SEE the new clip but HEAR the old
  // one). This guard makes every retry/unmute a no-op once intent is gone.
  var live = function () { return !surface.intendsToPlay || surface.intendsToPlay(); };
  var wantMuted = ssResolveSurfaceMuted(true, ssGetMutePref());
  if (wantMuted) {
    // Muted by preference: set + play, no unmute step.
    try { surface.setMuted(true); } catch (e) {}
    var pm = surface.play();
    Promise.resolve(pm).catch(function () { if (!live()) return; try { surface.play(); } catch (e) {} });
    return;
  }
  // Sound ON: start MUTED (muted autoplay is ALWAYS allowed), then unmute the
  // now-playing element. Starting unmuted is rejected by strict autoplay policies
  // (notably iOS) → the old "set unmuted then play" path fell back to a muted
  // backstop and the clip stayed silent (the "next clips are muted on scroll"
  // bug). Unmuting an already-playing element after the session's first
  // gesture-unlock is permitted, so this carries sound across EVERY clip.
  try { surface.setMuted(true); } catch (e) {}
  var p = surface.play();
  Promise.resolve(p).then(function () {
    if (!live()) return;                           // scrolled away → don't unmute
    try { surface.setMuted(false); } catch (e) {}
  }).catch(function () {
    if (!live()) return;                           // scrolled away → don't resurrect
    var p2 = surface.play();                       // retry (still muted)
    Promise.resolve(p2).then(function () { if (!live()) return; try { surface.setMuted(false); } catch (e) {} })
      .catch(function () { if (!live()) return; try { surface.setMuted(true); surface.play(); } catch (e) {} });
  });
}

/* _ssActivateSurface(surface, wantMuted) — the autoplay-policy-safe play+sound
   sequence for the PRE-UNLOCK case only (the very first clip, before any
   gesture). Once _ssAudioUnlocked is true, setActive uses _activatePostUnlock
   instead, so this path runs with wantMuted === true (muted-first, no unmute).

   WHY (pre-unlock): browsers ALWAYS allow MUTED autoplay but block UNMUTED
   play() unless it happens during a transient user activation. So the first
   clip starts MUTED and plays — never a black/stalled frame — and the first
   gesture then unlocks + applies the Mute_Preference. */
function _ssActivateSurface(surface, wantMuted) {
  if (!surface) return;
  // Same anti-resurrection guard as _activatePostUnlock: once the surface is
  // paused (scrolled away), no continuation may replay or unmute it.
  var live = function () { return !surface.intendsToPlay || surface.intendsToPlay(); };
  surface.setMuted(true);
  var p = surface.play();
  Promise.resolve(p).then(function () {
    if (!live()) return;                     // scrolled away → stop here
    if (wantMuted || !surface.setMuted) return;
    surface.setMuted(false);                 // honor "sound on"
    var p2 = surface.play();                  // re-assert in case unmute paused it
    Promise.resolve(p2).catch(function () {
      if (!live()) return;
      try { surface.setMuted(true); surface.play(); } catch (e) {}  // keep video playing, muted
    });
  }).catch(function () {
    if (!live()) return;                     // scrolled away → don't resurrect
    try { surface.setMuted(true); surface.play(); } catch (e) {}    // rare: one muted retry
  });
}

/* ── INLINE-mode engine state ───────────────────────────────────────
   The INLINE host (the Feed's #feed) keeps its OWN surface/clip/active
   state, SEPARATE from the FULLSCREEN viewer's _ssv* state, because both
   can be mounted at once (the inline Feed stays in the DOM behind an open
   fullscreen viewer). ClipEngine.fire/togglePause/setActive are mode-aware:
   passing mode === 'INLINE' routes them to these arrays + the Feed's DOM
   id/rail scheme (see _inline* helpers below); the default (FULLSCREEN)
   path is byte-for-byte unchanged. */
let _inlineClips     = [];     // normalized clips currently in the inline Feed
let _inlineSurfaces  = [];     // Media_Surface instances, one per inline clip
let _inlineBars      = [];     // Progress_Bar instances, one per inline clip
let _inlineFired     = new Set();  // inline clip indices fired this session
let _inlineActiveIdx = -1;     // index of the currently-active inline clip
let _inlineObserver  = null;   // IntersectionObserver for the inline host
let _inlineResizeBound = false;        // guard: bind the resize handler once
let _inlineInteractionCleanup = null;  // tears down the first-gesture listeners

/* ── Normalizer: any page schema → canonical clip ── */
function _ssvNormalize(raw) {
  if (!raw) return null;

  // creator can be an object {name,letter,bg} or a string + sibling fields
  let creator;
  if (raw.creator && typeof raw.creator === 'object') {
    creator = { name: raw.creator.name, letter: raw.creator.letter, bg: raw.creator.bg, avatar: raw.creator.avatar || null };
  } else if (typeof raw.creator === 'string') {
    creator = {
      name:   raw.creator,
      letter: raw.creatorLetter || raw.creator.charAt(0).toUpperCase(),
      bg:     raw.creatorBg || '#EA3B32',
      avatar: raw.creatorAvatar || null,
    };
  } else {
    creator = { name: 'showshak', letter: 'S', bg: '#EA3B32', avatar: null };
  }

  const fires     = (raw.fires != null) ? raw.fires : (raw.litCount != null ? raw.litCount : 0);
  const platByAbbr = { 'N':'Netflix','P':'Prime Video','D+':'Disney+','JH':'JioHotstar','S':'SonyLIV','HBO':'HBO Max','Z5':'Zee5','▶':'Apple TV+' };
  const platLabel = raw.platLabel || (raw.platforms && raw.platforms[0] && raw.platforms[0].name) || platByAbbr[raw.platAbbr] || 'Streaming';
  const platColor = raw.platColor || (raw.platforms && raw.platforms[0] && raw.platforms[0].color) || '#EA3B32';
  const platAbbr  = raw.platAbbr  || (raw.platforms && raw.platforms[0] && raw.platforms[0].label) || (platLabel.charAt(0) || '▶');
  const platRgb   = raw.platRgb   || '234,59,50';

  let platforms = raw.platforms;
  if (!platforms || !platforms.length) {
    platforms = [{ name: platLabel, color: platColor, label: platAbbr, sub: 'Available to stream', included: false }];
  }

  return {
    id: raw.id,
    title: raw.title || '',                 // hidden in viewer; revealed only at Watch It
    bg: raw.bg || 'linear-gradient(160deg,#1a0505,#2d0808,#0d0d0d,#000)',
    caption: raw.caption || '',
    genre: raw.genre || [],
    lang: raw.lang || '',
    year: raw.year || '',
    season: raw.season || '',
    creator, fires,
    platLabel, platColor, platAbbr, platRgb, platforms,
    // Carry the Mux playback fields through normalization so the fullscreen
    // viewer's ssCreateSurface() builds a VideoSurface (real video) and not the
    // gradient fallback. Also carry the Watch It cache so the sheet resolves.
    muxPlaybackId: raw.muxPlaybackId || null,
    poster: raw.poster || null,
    url: raw.url || null,
    durationSec: raw.durationSec || null,
    providers: raw.providers || {},
    curatorPlat: raw.curatorPlat || null,
  };
}

/* ── Build the "same segment" ordering ──────────── */
function _ssvBuildList(clicked, list) {
  const start = _ssvNormalize(clicked);
  if (!Array.isArray(list) || !list.length) return [start];

  const normalized = list.map(_ssvNormalize).filter(Boolean);
  const seen = new Set([String(start.id)]);
  const related = [];
  const rest = [];

  normalized.forEach(c => {
    if (String(c.id) === String(start.id)) return;
    if (seen.has(String(c.id))) return;
    seen.add(String(c.id));
    const sharesGenre = c.genre.some(g => start.genre.includes(g));
    (sharesGenre ? related : rest).push(c);
  });

  return [start, ...related, ...rest];
}

/* ── Inject viewer CSS once ─────────────────────── */
(function _injectClipViewerCSS() {
  const s = document.createElement('style');
  s.id = 'ss-clip-viewer-style';
  s.textContent = `
    #ss-clip-viewer {
      position: fixed; inset: 0; z-index: 250;
      background: #000;
      display: flex; justify-content: center; align-items: stretch;
      opacity: 0; pointer-events: none;
      transition: opacity 0.28s ease;
    }
    #ss-clip-viewer.open { opacity: 1; pointer-events: all; }

    /* Drag-to-dismiss: the inner feed slides horizontally with the
       finger (swipe right anywhere → go back). JS toggles .ssv-dragging
       off so the spring-back / fly-out animates. */
    .ssv-feed.ssv-snap { transition: transform 0.3s var(--ease-smooth); }

    .ssv-feed {
      position: relative; height: 100%;
      width: min(440px, 100vw);
      overflow-y: scroll; scroll-snap-type: y mandatory;
      -webkit-overflow-scrolling: touch; scrollbar-width: none;
    }
    .ssv-feed::-webkit-scrollbar { display: none; }

    .ssv-clip {
      position: relative; width: 100%; height: 100%;
      scroll-snap-align: start; scroll-snap-stop: always;
      overflow: hidden; flex-shrink: 0;
    }
    /* Media_Surface mount point — the surface attaches its gradient/<video>
       node here. Sits below the tap zone (z 10) and chrome. */
    .ssv-media { position: absolute; inset: 0; z-index: 0; filter: brightness(1.18) saturate(1.1); }
    .ssv-bg {
      position: absolute; inset: 0;
      background-size: cover; background-position: center;
      transform: scale(1.04); transition: transform 0.6s var(--ease-smooth);
    }
    .ssv-clip.active .ssv-bg { transform: scale(1); }

    /* Progress bar (Progress_Bar component) — thin bar across the top of the
       clip, driven by the Media_Surface. Never intercepts taps. */
    .ssv-clip .ss-progress {
      position: absolute; top: 0; left: 0; right: 0; height: 3px; z-index: 36;
      background: rgba(255,255,255,0.18); pointer-events: none;
    }
    .ssv-clip .ss-progress-fill {
      height: 100%; width: 0%;
      background: rgba(255,255,255,0.95);
      box-shadow: 0 0 6px rgba(255,255,255,0.5);
      transition: width 0.12s linear;
    }

    /* Pause affordance: dim the clip slightly when single-tap paused. */
    .ssv-clip.ssv-paused .ssv-media::after {
      content: ''; position: absolute; inset: 0;
      background: rgba(0,0,0,0.28);
    }
    /* Center pause/play feedback glyph (fullscreen). Hidden by default; held
       visible while paused; on resume it shows the play glyph then quickly
       blurs/scales out as the video starts. */
    .ssv-pause-icon {
      position: absolute; top: 50%; left: 50%; z-index: 22;
      width: 76px; height: 76px; border-radius: 50%;
      transform: translate(-50%,-50%) scale(0.7);
      background: rgba(0,0,0,0.42); backdrop-filter: blur(2px);
      display: flex; align-items: center; justify-content: center;
      opacity: 0; pointer-events: none; filter: none;
      transition: opacity .2s ease, transform .2s ease, filter .2s ease;
    }
    .ssv-pause-icon .ssv-pi-play { display: none; }
    /* Paused → pause bars, held visible. */
    .ssv-pause-icon.is-paused {
      opacity: 1; transform: translate(-50%,-50%) scale(1); filter: none;
    }
    .ssv-pause-icon.is-paused .ssv-pi-pause { display: block; }
    .ssv-pause-icon.is-paused .ssv-pi-play  { display: none; }
    /* Resuming → play glyph appears (start state), then .is-playing-out animates
       it out (fade + scale up + blur) quickly while playback resumes. */
    .ssv-pause-icon.is-playing {
      opacity: 1; transform: translate(-50%,-50%) scale(1); filter: none;
    }
    .ssv-pause-icon.is-playing .ssv-pi-pause { display: none; }
    .ssv-pause-icon.is-playing .ssv-pi-play  { display: block; }
    .ssv-pause-icon.is-playing.is-playing-out {
      opacity: 0; transform: translate(-50%,-50%) scale(1.6); filter: blur(8px);
    }
    .ssv-vig {
      position: absolute; inset: 0; pointer-events: none;
      /* Brighter scrim: a light bottom legibility gradient that clears by ~38%,
         no top tint — the clip reads as the foreground, not a dimmed backdrop. */
      background: linear-gradient(to top, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.20) 16%, rgba(0,0,0,0) 38%, rgba(0,0,0,0) 100%);
    }

    /* Double-tap-to-fire: a full-area tap zone that sits ABOVE the bg/vig
       but BELOW the rail/bottom/watch (z 20-40), so those stay clickable.
       Double tap anywhere on the clip body fires it (Instagram-style). */
    .ssv-tap { position: absolute; inset: 0; z-index: 10; -webkit-tap-highlight-color: transparent; }
    .ssv-burst {
      position: absolute; z-index: 25; pointer-events: none;
      transform: translate(-50%, -50%) scale(0.3); opacity: 0;
      filter: drop-shadow(0 4px 16px rgba(234,59,50,0.6));
    }
    .ssv-burst.go { animation: ssvBurst 0.62s cubic-bezier(.17,.89,.32,1.28) forwards; }
    @keyframes ssvBurst {
      0%   { opacity: 0; transform: translate(-50%,-50%) scale(0.3) rotate(-12deg); }
      15%  { opacity: 1; }
      45%  { opacity: 1; transform: translate(-50%,-50%) scale(1.15) rotate(6deg); }
      100% { opacity: 0; transform: translate(-50%,-50%) scale(1.5) rotate(0deg); }
    }

    /* Close button */
    .ssv-close {
      position: absolute; top: calc(14px + env(safe-area-inset-top, 0px)); left: 14px; z-index: 40;
      width: 38px; height: 38px; border-radius: 50%;
      background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.15);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; backdrop-filter: blur(8px);
      transition: background 0.15s, transform 0.15s;
    }
    .ssv-close:hover  { background: rgba(0,0,0,0.7); transform: scale(1.06); }
    .ssv-close:active { transform: scale(0.92); }

    /* Mute corner control (single shared sound toggle — replaces the old
       "Tap for sound" badge). Shows the "on" icon by default; the "off"
       (crossed) icon when muted. */
    .ssv-mute {
      position: absolute; top: calc(14px + env(safe-area-inset-top, 0px)); right: 14px; z-index: 40;
      width: 38px; height: 38px; border-radius: 50%;
      background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.15);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; backdrop-filter: blur(8px);
      transition: background 0.15s, transform 0.15s;
    }
    .ssv-mute:hover  { background: rgba(0,0,0,0.7); transform: scale(1.06); }
    .ssv-mute:active { transform: scale(0.92); }
    .ssv-mute .ssv-mute-off { display: none; }
    .ssv-mute.muted .ssv-mute-on  { display: none; }
    .ssv-mute.muted .ssv-mute-off { display: block; }

    /* Top "showing related" pill */
    .ssv-top-pill {
      position: absolute; top: calc(18px + env(safe-area-inset-top, 0px)); left: 50%; transform: translateX(-50%);
      z-index: 35; display: flex; align-items: center; gap: 6px;
      background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.12);
      border-radius: 100px; padding: 5px 12px;
      font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.85);
      backdrop-filter: blur(8px); pointer-events: none;
    }

    /* Right action rail */
    .ssv-rail {
      position: absolute; right: 12px; bottom: calc(96px + env(safe-area-inset-bottom, 0px)); z-index: 30;
      display: flex; flex-direction: column; align-items: center; gap: 18px;
    }
    .ssv-act {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      cursor: pointer; -webkit-tap-highlight-color: transparent; user-select: none;
    }
    .ssv-ico {
      width: 34px; height: 34px;
      display: flex; align-items: center; justify-content: center;
      filter: drop-shadow(0 2px 8px rgba(0,0,0,0.9));
      transition: transform 0.15s var(--ease-spring);
    }
    .ssv-act:active .ssv-ico { transform: scale(0.82); }
    .ssv-lbl {
      font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.9);
      text-shadow: 0 1px 6px rgba(0,0,0,1); letter-spacing: 0.3px;
    }
    @keyframes ssvPulse {
      0%{transform:scale(1);} 30%{transform:scale(1.45);}
      55%{transform:scale(0.9);} 75%{transform:scale(1.15);} 100%{transform:scale(1);}
    }
    .ssv-act.pulse .ssv-ico { animation: ssvPulse 0.42s cubic-bezier(.36,.07,.19,.97) forwards; }

    .ssv-fire .ffill { display: none; }
    .ssv-fire.lit .fout { display: none; }
    .ssv-fire.lit .ffill { display: block; }
    .ssv-fire.lit .ssv-lbl { color: var(--red); }

    .ssv-save .sfill { display: none; }
    .ssv-save.saved .sout { display: none; }
    .ssv-save.saved .sfill { display: block; }
    .ssv-save.saved .ssv-lbl { color: rgba(234,59,50,0.95); }

    /* Bottom content */
    .ssv-bottom {
      position: absolute; left: 14px; right: 72px; bottom: calc(84px + env(safe-area-inset-bottom, 0px)); z-index: 20;
    }
    .ssv-creator-row { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
    .ssv-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      border: 1.5px solid rgba(255,255,255,0.5); flex-shrink: 0;
      overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700; color: #fff; text-transform: uppercase;
    }
    .ssv-avatar .ss-avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .ssv-handle { font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.85); text-shadow: 0 1px 6px rgba(0,0,0,0.9); }
    .ssv-follow {
      font-size: 10px; color: var(--red); font-weight: 700; cursor: pointer;
      padding: 2px 9px; border: 1px solid var(--red); border-radius: 100px;
      transition: background 0.15s;
    }
    .ssv-follow:hover { background: rgba(234,59,50,0.15); }
    .ssv-follow.is-following { background: rgba(234,59,50,0.14); color: var(--red); border-color: rgba(234,59,50,0.55); }
    .ssv-tags { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin-bottom: 7px; }
    .ssv-caption {
      font-size: 13px; color: rgba(255,255,255,0.62); line-height: 1.45;
      text-shadow: 0 1px 8px rgba(0,0,0,0.7);
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
    }
    .ssv-caption em { color: rgba(255,255,255,0.95); font-style: normal; font-weight: 600; }

    /* Watch It button */
    .ssv-watch {
      position: absolute; left: 14px; right: 72px; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); z-index: 30;
      display: flex; align-items: center; justify-content: center;
      height: 52px; border-radius: 16px; overflow: hidden; opacity: 0.92;
      background: rgba(255,99,45,0.26);
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      font-family: var(--font-body); color: #fff; border: none; cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      box-shadow: 0 5px 22px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12);
      transition: transform 0.15s, filter 0.15s, opacity 0.2s;
    }
    /* Subtle fire-orange tracing border (replaces the old breathing glow) — keeps
       focus on the clip while still marking Watch It as the climax CTA. */
    @property --ssang { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
    @keyframes ssTraceBorder { to { --ssang: 360deg; } }
    .ssv-watch::before {
      content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1.6px;
      background: conic-gradient(from var(--ssang,0deg),
        rgba(234,59,50,0) 0deg, rgba(234,59,50,0) 230deg,
        rgba(255,99,45,0.6) 312deg, rgba(255,150,70,0.82) 346deg, rgba(234,59,50,0) 360deg);
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor; mask-composite: exclude;
      pointer-events: none; z-index: 1;
      animation: ssTraceBorder 4s linear infinite;
    }
    .ssv-watch:active { transform: scale(0.97); }
    .ssv-watch-inner { display: flex; align-items: center; gap: 10px; padding: 0 14px; width: 100%; pointer-events: none; }
    .ssv-watch-logo {
      width: 24px; height: 24px; border-radius: 7px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 8px; font-weight: 800; color: #fff;
      background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.25);
    }
    .ssv-watch-text { flex: 1; display: flex; flex-direction: column; align-items: center; line-height: 1.15; }
    .ssv-watch-main { font-size: 14px; font-weight: 800; letter-spacing: 0.4px; }
    .ssv-watch-sub  { font-size: 10px; font-weight: 500; opacity: 0.85; }
    .ssv-watch-arrow { width: 24px; display: flex; justify-content: flex-end; opacity: 0.75; }

    /* Desktop: rounded column edges so it reads as a "player" */
    @media (min-width: 701px) {
      .ssv-feed { box-shadow: 0 0 80px rgba(0,0,0,0.8); }
    }
  `;
  document.head.appendChild(s);
})();

/* ── Inject viewer container once ───────────────── */
(function _injectClipViewerHTML() {
  const v = document.createElement('div');
  v.id = 'ss-clip-viewer';
  v.innerHTML = `
    <div class="ssv-close" onclick="ssCloseClip()" aria-label="Go back">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    </div>
    <div class="ssv-mute" id="ssv-mute" onclick="ssvToggleMute()" aria-label="Mute">
      <svg class="ssv-mute-on" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
      <svg class="ssv-mute-off" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
    </div>
    <div class="ssv-top-pill">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="#EA3B32"><path d="M12 2C12 2 8 6.5 8 10a4 4 0 0 0 8 0c0-1.5-.8-3-1.5-4C13.8 7.5 14 9 13 10c-.5.5-1 .8-1 .8S10 9.5 10 8c0-2 2-6 2-6z"/><path d="M12 14c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4z"/></svg>
      More like this
    </div>
    <div class="ssv-feed" id="ssv-feed"></div>
  `;
  document.body.appendChild(v);
})();

/* ── SVG snippets for viewer ────────────────────── */
const _SSV_FIRE_OUT  = `<svg class="fout" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C12 2 8 6.5 8 10a4 4 0 0 0 8 0c0-1.5-.8-3-1.5-4C13.8 7.5 14 9 13 10c-.5.5-1 .8-1 .8S10 9.5 10 8c0-2 2-6 2-6z"/><path d="M12 14c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4z"/></svg>`;
const _SSV_FIRE_FILL = `<svg class="ffill" width="30" height="30" viewBox="0 0 24 24" fill="#EA3B32" stroke="#EA3B32" stroke-width="0.5"><path d="M12 2C12 2 8 6.5 8 10a4 4 0 0 0 8 0c0-1.5-.8-3-1.5-4C13.8 7.5 14 9 13 10c-.5.5-1 .8-1 .8S10 9.5 10 8c0-2 2-6 2-6z"/><path d="M12 14c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4z"/></svg>`;
const _SSV_SAVE_OUT  = `<svg class="sout" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
const _SSV_SAVE_FILL = `<svg class="sfill" width="26" height="26" viewBox="0 0 24 24" fill="#EA3B32" stroke="#EA3B32" stroke-width="0.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
const _SSV_SHARE     = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;

/* ════════════════════════════════════════════════
   CLIP ENGINE — single shared clip player
   ─────────────────────────────────────────────────
   The one place Fire, single-tap pause, and active-surface playback are
   defined. FULLSCREEN uses it today; INLINE (later task) reuses the same
   methods. It talks to clips ONLY through the Media_Surface contract
   (_ssvSurfaces) and persists through the existing DB wiring (_ssDbFire).
════════════════════════════════════════════════ */
const ClipEngine = {

  /* fire(idx, x, y) — the SINGLE Fire definition (merges the old
     _ssvToggleFire + _ssvFireOn). Guest-gated, turns fire ON idempotently,
     pulses the rail flame, bursts a flame at the tap point (or clip centre
     when x/y are absent), flashes the Watch It CTA, and persists via
     _ssDbFire. */
  fire(idx, x, y, mode) {
    // Guest gate first: a Fire is a reaction → prompt sign-up before any write.
    if (typeof ssGuestGuard === 'function' && ssGuestGuard('fire')) return;

    // INLINE host uses the Feed's own DOM ids/rail scheme. (See _inlineFire.)
    if (mode === 'INLINE') { _inlineFire(idx, x, y); return; }

    const clip = _ssvClips[idx];
    if (!clip) return;

    const already = _ssvFired.has(idx);
    if (!already) _ssvFired.add(idx);   // idempotent: only ever turns ON

    // Rail flame: lit state + pulse animation + count.
    const btn = document.getElementById(`ssv-fire-${idx}`);
    if (btn) {
      btn.classList.add('lit');
      const ico = btn.querySelector('.ssv-ico');
      if (ico) { ico.classList.remove('pulse'); void ico.offsetWidth; ico.classList.add('pulse'); }
    }
    const count = document.getElementById(`ssv-fire-count-${idx}`);
    if (count) count.textContent = fmtFires(clip.fires + 1);

    // Fire-burst at the tap point (relative to the clip), or centred.
    const burst = document.getElementById(`ssv-burst-${idx}`);
    const clipEl = document.getElementById(`ssv-clip-${idx}`);
    if (burst && clipEl) {
      const r = clipEl.getBoundingClientRect();
      const bx = (x != null) ? (x - r.left) : (r.width / 2);
      const by = (y != null) ? (y - r.top)  : (r.height / 2);
      burst.style.left = bx + 'px';
      burst.style.top  = by + 'px';
      burst.classList.remove('go'); void burst.offsetWidth; burst.classList.add('go');
    }

    // Fire energy → flash the Watch It CTA on this clip.
    const watch = document.querySelector(`#ssv-clip-${idx} .ssv-watch`);
    if (watch) { watch.style.filter = 'brightness(1.5) saturate(1.3)'; setTimeout(() => { watch.style.filter = ''; }, 360); }

    // Persist only on the first (idempotent) transition to fired.
    if (!already) _ssDbFire(clip.id, true);
  },

  /* togglePause(idx) — single-tap pause/resume of the active surface. */
  togglePause(idx, mode) {
    if (mode === 'INLINE') { _inlineTogglePause(idx); return; }
    const surface = _ssvSurfaces[idx];
    if (!surface) return;
    const clipEl = document.getElementById(`ssv-clip-${idx}`);
    if (surface._ssPaused) {
      surface._ssPaused = false;
      surface.play().catch(() => {});
      if (clipEl) clipEl.classList.remove('ssv-paused');
      _ssvPauseFeedback(clipEl, false);   // play glyph → quick blur-out, video resumes
    } else {
      surface._ssPaused = true;
      surface.pause();
      if (clipEl) clipEl.classList.add('ssv-paused');
      _ssvPauseFeedback(clipEl, true);    // hold the pause glyph
    }
  },

  /* setActive(idx) — make clip `idx` the playing one. Pauses the previous
     surface, applies the resolved Mute_Preference, and plays with an
     autoplay-rejection → muted-retry fallback. Progress is already wired to
     the bar at mount time. `mode` defaults to FULLSCREEN. */
  setActive(idx, mode) {
    const m = (mode === 'INLINE') ? 'INLINE' : 'FULLSCREEN';

    // INLINE host: separate state + the Feed's DOM ids/rail. (See _inlineSetActive.)
    if (m === 'INLINE') { _inlineSetActive(idx); return; }

    if (_ssvActiveIdx === idx) return;

    const prev = _ssvSurfaces[_ssvActiveIdx];
    if (prev) { prev.pause(); prev._ssPaused = false; }
    const prevEl = document.getElementById(`ssv-clip-${_ssvActiveIdx}`);
    _ssvClearPause(prevEl);                 // clear dim + lingering pause glyph on the old clip

    _ssvActiveIdx = idx;
    const surface = _ssvSurfaces[idx];
    if (!surface) return;
    _ssvClearPause(document.getElementById(`ssv-clip-${idx}`));   // new clip is playing → no pause UI

    // Solo audio: mute every OTHER mounted surface so only this clip is heard.
    _ssMuteOthers(_ssvSurfaces, idx);

    const muted = _ssvResolveMuted(m);
    surface._ssPaused = false;
    // Post-unlock: just pause-prev + play (no muted→unmuted dance → audio stays
    // continuous on scroll). Pre-unlock (first clip, no gesture yet): muted-first
    // autoplay-safe sequence. prev was already paused above, so pass null.
    if (_ssAudioUnlocked) _activatePostUnlock(null, surface);
    else _ssActivateSurface(surface, muted);
    // Reflect this clip's REAL muted state immediately (it starts muted under
    // the autoplay-safe sequence); the onMutedChange listener then live-updates
    // the icon if/when the unmute actually succeeds or the browser refuses it.
    if (typeof surface.isMuted === 'function') _ssvPaintMuteBtn(surface.isMuted());

    // Preload the NEXT clip while this one loops, so scrolling to it is
    // instant (smooth viewing). No-op for gradients / when there is no next.
    const nextSurface = _ssvSurfaces[idx + 1];
    if (nextSurface && typeof nextSurface.preload === 'function') nextSurface.preload();
    // Network-aware deeper look-ahead + resolution ceiling + bandwidth gate.
    _warmNext(idx, 'FULLSCREEN');
    // Prewarm Watch It data for this clip (and the next) so the sheet is instant.
    if (typeof ssPrewarmWatch === 'function') {
      ssPrewarmWatch(_ssvClips[idx]);
      if (_ssvClips[idx + 1]) ssPrewarmWatch(_ssvClips[idx + 1]);
    }

    // Reach = genuine attention: record a view only after this clip has stayed
    // the active one for SS_VIEW_DWELL_MS (cleared if the active clip changes).
    _ssScheduleViewDwell('FULLSCREEN');

    // Refresh the preload ladder + resolution cap for the whole mounted band
    // relative to the new active clip (only the active clip is 'auto').
    _ssApplyPreloadTiers('FULLSCREEN');
    // Spend spare bandwidth deepening upcoming clips once the active clip's
    // buffer is satisfied (Phase 2; active always wins the pipe).
    _ssStartDeepenController('FULLSCREEN');
    // Tell the SW the active-clip window so its Segment_Cache can compute
    // clipDistance for window/LRU eviction (Phase 4).
    _ssPostSegWindow('FULLSCREEN');
  },

  /* mountInline(container, clips, opts) — the INLINE render mode. Rebuilds the
     Feed on the shared engine: renders the ordered clips into `container`
     (#feed) reusing the Feed's existing scroll-snap `.clip` / `.clip-column`
     layout and class names, gives each clip a Media_Surface + Progress_Bar,
     wires the unified gesture handler, drives the active clip with an
     IntersectionObserver, owns the mobile per-clip rail + the fixed desktop
     #action-rail (positionRail), and the arrow/j/k keyboard navigation.

     The first clip plays MUTED (browser autoplay policy) until the session
     Audio_Unlock fires on the first user interaction (tap/scroll/key),
     which then applies the persisted Mute_Preference. No-ops if container or
     clips are absent. */
  mountInline(container, clips, opts) {
    if (!container || !Array.isArray(clips) || !clips.length) return;  // no-op guard

    // Tear down any previous inline mount (no surface/observer/timer leaks).
    _ssCancelViewDwell();   // drop any pending dwell-view from the old mount
    _ssStopDeepenController();   // stop deepening from the old mount (restarted on first setActive)
    _inlineSurfaces.forEach(s => { try { s.destroy(); } catch (e) {} });
    if (_inlineObserver) { _inlineObserver.disconnect(); _inlineObserver = null; }
    if (typeof _inlineInteractionCleanup === 'function') { _inlineInteractionCleanup(); _inlineInteractionCleanup = null; }
    clearTimeout(_inlineStallTimer); _inlineStallTimer = null;

    // Ordering goes ONLY through the Recommendation_Seam (Req 7.5). For the
    // Feed, the "clicked" clip is simply the first clip — ssClipOrdering keeps
    // it first and de-dupes the rest, so the Feed's natural order is preserved.
    _inlineClips    = ssClipOrdering(clips[0], clips);
    _inlineSurfaces = [];
    _inlineBars     = [];
    _inlineFired    = new Set();
    _inlineActiveIdx = -1;
    // First clip plays muted until the session Audio_Unlock (first gesture);
    // _ssAudioUnlocked is the single source of truth, shared across both hosts.
    // If a gesture already unlocked audio earlier this session (e.g. the viewer
    // came back from a fullscreen open), the first inline clip may play with
    // sound — no forced re-mute.

    // Render the clip frames (Feed's existing classes/ids).
    container.innerHTML = _inlineClips.map((c, i) => _inlineClipHTML(c, i)).join('');

    // Mount Media_Surfaces ONLY for the initial Player_Pool band around clip 0 —
    // NOT one per clip. iOS/WebKit strictly limits how many <video> elements can
    // hold loaded media at once; mounting a <mux-player> for every clip (up to
    // Metadata_Window = 30) made iOS refuse to start clips — they stuck on the
    // first frame (Android/Chrome is lenient, so it played fine there). The
    // frames + poster backgrounds are rendered for ALL clips above; the
    // IntersectionObserver + pruneInlineSurfaces (the Player_Pool) mount the rest
    // on demand as you scroll, bounded to SS_MAX_LIVE_PLAYERS — same as the
    // fullscreen viewer (which is why fullscreen never showed this bug).
    ssMountedPlayerSet(0, _inlineClips.length, SS_MAX_LIVE_PLAYERS)
      .forEach(function (i) { _inlineWireClip(i); });

    // Wire the fixed desktop #action-rail's controls to the engine (acting on
    // the active clip). Save's data-save-id + state are refreshed in _inlineSyncRail.
    _inlineWireDesktopRail();

    // First clip active + playback, then the observer for the rest.
    container.scrollTop = 0;
    document.getElementById('clip-0')?.classList.add('active');
    ClipEngine.setActive(0, 'INLINE');   // plays clip 0 (muted: awaiting gesture)
    _inlineSetupObserver(container);

    // Clear the first-clip muted lock on the first interaction (tap/scroll/key)
    // and apply the persisted Mute_Preference to the active surface (Req 4.3).
    _inlineInteractionCleanup = _inlineBindFirstInteraction(container);

    // Keyboard navigation (Arrow/j/k) — moved off the Feed into the engine.
    document.addEventListener('keydown', _inlineKeydown);
    window.navigateFeed = _inlineNavigate;   // back the Feed's #nav-arrows onclick

    // Position the desktop rail relative to the clip column (load + resize).
    requestAnimationFrame(() => { _inlinePositionRail(); _inlineAnimateRailIn(); });
    if (!_inlineResizeBound) { window.addEventListener('resize', _inlinePositionRail); _inlineResizeBound = true; }

    // Make in-feed Save/Follow buttons + curator links real and synced.
    ssSyncAllSaveBtns();
    if (typeof ssWireFollowButtons === 'function') ssWireFollowButtons(container);
    if (typeof ssWireCuratorLinks === 'function') ssWireCuratorLinks(container);
  },

  /* appendInline(container, newClips) — ADDITIVE sliding-window growth (Req 9.4).
     Appends newly-fetched clips to the existing inline Feed WITHOUT a rebuild:
     de-dupes by id, appends their frames' HTML at the correct indices, and
     wires each with the SAME per-clip wiring as mountInline (_inlineWireClip).
     No scroll reset and no teardown, so playback continues seamlessly. */
  appendInline(container, newClips) {
    if (!container || !Array.isArray(newClips) || !newClips.length) return;
    const startIdx = _inlineClips.length;
    const have = new Set(_inlineClips.map(c => String(c.id)));
    const fresh = newClips.filter(c => c && !have.has(String(c.id)));
    if (!fresh.length) return;
    _inlineClips = _inlineClips.concat(fresh);
    container.insertAdjacentHTML('beforeend',
      fresh.map((c, k) => _inlineClipHTML(c, startIdx + k)).join(''));
    // Do NOT mount a Media_Surface for each appended clip — that re-introduces the
    // "too many live <mux-player>s" bug (iOS refuses to start clips → stuck on the
    // first frame). The appended clips are ahead of the mounted band; their frames
    // + posters are rendered above, and the IntersectionObserver below drives
    // pruneInlineSurfaces to mount each one on demand (bounded to SS_MAX_LIVE_PLAYERS)
    // when it scrolls into view — same Player_Pool discipline as the initial mount.
    // Observe the newly appended frames so the active-clip observer drives them.
    if (_inlineObserver) fresh.forEach((c, k) => {
      const node = document.getElementById(`clip-${startIdx + k}`);
      if (node) _inlineObserver.observe(node);
    });
    // Make the new Save/Follow/curator controls real + synced.
    ssSyncAllSaveBtns();
    if (typeof ssWireFollowButtons === 'function') ssWireFollowButtons(container);
    if (typeof ssWireCuratorLinks === 'function') ssWireCuratorLinks(container);
  },

  /* pruneInlineSurfaces() — INLINE host entry point for the Player_Pool
     recycler (Req 2.x, 9.6). Delegates to the shared _poolRecycle so the inline
     Feed and the fullscreen viewer recycle identically through one engine
     (Req 2.7). Re-points freed surfaces onto entering clips instead of
     destroy-and-recreate; never branches on surface type. */
  pruneInlineSurfaces(activeIdx) {
    _poolRecycle(activeIdx, 'INLINE');
  },
};
// Expose globally so inline onclick handlers (rail flame) resolve it.
window.ClipEngine = ClipEngine;

/* _inlineWireClip(i) — the per-clip wiring shared by mountInline + appendInline.
   (Re)builds the Media_Surface for clip i, attaches its Progress_Bar, and binds
   the single-tap → open-viewer handler once. Idempotent: safe to call again
   when a pruned clip scrolls back into the mounted band (reuses the existing
   bar; guards the tap listener so it binds only once). Contract-only. */
function _inlineWireClip(i) {
  const card    = document.getElementById(`clip-${i}`);
  const mediaEl = document.getElementById(`clip-media-${i}`);
  if (!card || !mediaEl) return;
  if (_inlineSurfaces[i]) { try { _inlineSurfaces[i].destroy(); } catch (e) {} }
  const surface = ssCreateSurface(_inlineClips[i], { bgClass: 'clip-bg' });
  surface.mount(mediaEl);
  const bar = _inlineBars[i] || ssMakeProgressBar(card);
  surface.onTimeupdate(p => bar.set(p));
  // Keep the frame mute buttons in sync with this clip's REAL muted state while
  // it's the active clip (incl. a browser-forced autoplay mute).
  if (typeof surface.onMutedChange === 'function') {
    surface.onMutedChange(function (m) { if (i === _inlineActiveIdx) _inlinePaintMuteBtns(); });
  }
  // Drive the tap-to-play affordance from this clip's REAL playback state (only
  // while it's the active clip). On iOS a contended inline <video> can fail to
  // start and stick on the first frame; this surfaces a clear "tap to play".
  if (typeof surface.onPlayState === 'function') {
    surface.onPlayState(function (playing) { _inlineReflectStall(i, playing); });
  }
  _inlineSurfaces[i] = surface;
  _inlineBars[i] = bar;
  // FEED MODEL: a single tap OPENS the full Clip Viewer (where all actions +
  // single-tap-pause + double-tap-fire live). Rail buttons stopPropagation, so
  // they never reach this handler. Bound once per frame.
  const tapZone = document.getElementById(`tap-${i}`);
  if (tapZone && !tapZone.dataset.ssTapBound) {
    tapZone.dataset.ssTapBound = '1';
    tapZone.addEventListener('click', function () {
      ssOpenClip(_inlineClips[i], _inlineClips);
    });
  }
}

/* ssShouldShowTapToPlay(state) — PURE. Decide whether the inline feed should show
   the tap-to-play affordance on a clip. iOS/WebKit caps how many inline <video>
   elements can hold media at once, so a contended ACTIVE clip can fail to autoplay
   and stick on its first frame. Rather than fight that platform limit, we surface a
   clear affordance — shown ONLY for the ACTIVE, video clip when it is NOT actually
   playing. Non-active clips are expected to be paused (never flagged); gradient/demo
   clips don't stall (isVideo false → never flagged). Total/defensive: any malformed
   input → false. Tapping the clip opens the fullscreen viewer, which mounts a
   bounded, proven band and always plays (and on Android, where there is no stall,
   the clip is already playing so this never shows). */
function ssShouldShowTapToPlay(state) {
  if (!state || typeof state !== 'object') return false;
  return !!(state.active && state.isVideo && !state.playing);
}

var SS_STALL_GRACE_MS   = 2500;   // cold-start grace before flagging a stuck active clip
var SS_STALL_RECHECK_MS = 1200;   // debounce after a pause/waiting before flagging
var _inlineStallTimer   = null;

/* (Re)arm the deferred stall check for the active inline clip. */
function _inlineArmStallCheck(delay) {
  clearTimeout(_inlineStallTimer);
  _inlineStallTimer = setTimeout(_inlineEvalStall, delay);
}

/* Evaluate the active inline clip and toggle its tap-to-play affordance via the
   pure decision. Reads the surface's REAL playback state. */
function _inlineEvalStall() {
  var i = _inlineActiveIdx;
  if (i < 0) return;
  var icon = document.getElementById('pause-icon-' + i);
  if (!icon) return;
  var clip    = _inlineClips[i];
  var surface = _inlineSurfaces[i];
  var isVideo = !!(clip && clip.muxPlaybackId);
  var playing = !!(surface && typeof surface.isPlaying === 'function' && surface.isPlaying());
  icon.classList.toggle('show', ssShouldShowTapToPlay({ active: true, isVideo: isVideo, playing: playing }));
}

/* Surface play-state callback for inline clip i: only the ACTIVE clip drives the
   affordance. Playing → clear it at once; not-playing → re-check after a short
   debounce so normal buffering/seek/loop never flashes the icon. */
function _inlineReflectStall(i, playing) {
  if (i !== _inlineActiveIdx) return;
  if (playing) {
    clearTimeout(_inlineStallTimer);
    var icon = document.getElementById('pause-icon-' + i);
    if (icon) icon.classList.remove('show');
  } else {
    _inlineArmStallCheck(SS_STALL_RECHECK_MS);
  }
}

/* Clear any pause UI (the dim + the center pause/play glyph) from a clip element.
   Called when a clip becomes active or is scrolled away from, so a clip that was
   paused earlier never keeps showing the pause icon while it's actually playing. */
function _ssvClearPause(clipEl) {
  if (!clipEl) return;
  clipEl.classList.remove('ssv-paused');
  var icon = clipEl.querySelector('.ssv-pause-icon');
  if (icon) {
    clearTimeout(icon._ssTimer);
    icon.classList.remove('is-paused', 'is-playing', 'is-playing-out');
  }
}

/* _ssvPauseFeedback(clipEl, paused) — the center pause/play glyph feedback in
   the fullscreen viewer. paused=true → show the pause bars and hold them; on
   resume (paused=false) → flash the play glyph then quickly blur/scale it out
   while playback continues. */
function _ssvPauseFeedback(clipEl, paused) {
  if (!clipEl) return;
  var icon = clipEl.querySelector('.ssv-pause-icon');
  if (!icon) return;
  clearTimeout(icon._ssTimer);
  icon.classList.remove('is-paused', 'is-playing', 'is-playing-out');
  void icon.offsetWidth;                 // restart any in-flight transition
  if (paused) {
    icon.classList.add('is-paused');     // hold the pause bars
  } else {
    icon.classList.add('is-playing');    // play glyph at full opacity (start state)
    void icon.offsetWidth;
    icon.classList.add('is-playing-out'); // animate out (fade + scale + blur)
    icon._ssTimer = setTimeout(function () {
      icon.classList.remove('is-playing', 'is-playing-out');
    }, 280);
  }
}

/* Mute corner control helpers. The live re-apply subscription
   (ssOnMuteChange) is registered at the end of this file, AFTER the
   Mute_Preference module is defined. */
function _ssvPaintMuteBtn(muted) {
  const btn = document.getElementById('ssv-mute');
  if (!btn) return;
  btn.classList.toggle('muted', !!muted);
  btn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
}
function ssvToggleMute() {
  ssMarkAudioUnlocked();   // any toggle is a gesture → unlock the session
  // Flip the ACTUAL audible state of the active clip (read from the live surface),
  // not the raw pref or the resolved value — so a single tap always does what the
  // icon implies, even on the very first interaction.
  var act = _ssGetActiveSurface();
  var heardMuted = (act && typeof act.isMuted === 'function')
    ? act.isMuted()
    : ssResolveSurfaceMuted(_ssAudioUnlocked, ssGetMutePref());
  ssSetMutePref(!heardMuted);     // persists + ssOnMuteChange re-applies + repaints
}

/* The surface whose audio the user is actually hearing: the fullscreen viewer's
   active surface when it's open, else the feed's active surface. */
function _ssGetActiveSurface() {
  if (typeof _ssvSurfaces !== 'undefined' && _ssvActiveIdx >= 0 && _ssvSurfaces[_ssvActiveIdx]) {
    return _ssvSurfaces[_ssvActiveIdx];
  }
  if (typeof _inlineSurfaces !== 'undefined' && _inlineActiveIdx >= 0 && _inlineSurfaces[_inlineActiveIdx]) {
    return _inlineSurfaces[_inlineActiveIdx];
  }
  return null;
}

/* Paint every inline frame's mute button to the current EFFECTIVE muted state
   (pre-unlock the active clip is force-muted; post-unlock it follows the
   Mute_Preference). Called on activate, on the first-gesture unlock, and from
   the global ssOnMuteChange subscription. */
function _inlinePaintMuteBtns() {
  // Reflect the ACTIVE clip's REAL muted state (what's actually audible) when we
  // have a live surface; fall back to the resolved preference otherwise.
  var act = (typeof _inlineActiveIdx === 'number' && _inlineActiveIdx >= 0)
    ? _inlineSurfaces[_inlineActiveIdx] : null;
  var muted = (act && typeof act.isMuted === 'function')
    ? act.isMuted()
    : ssResolveSurfaceMuted(_ssAudioUnlocked, ssGetMutePref());
  var btns = document.querySelectorAll('.clip-mute');
  for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('muted', !!muted);
}

/* ════════════════════════════════════════════════
   INLINE MODE — helpers (the Feed's DOM id/rail scheme)
   ─────────────────────────────────────────────────
   These drive ClipEngine in INLINE mode. They operate on the Feed's EXISTING
   markup classes/ids so the engine-rendered Feed looks/behaves exactly like
   today's bespoke player once Task 7 wires it.

   INLINE element/id map (vs the FULLSCREEN ssv-* scheme):
     clip frame        #clip-${i}           (.clip[.active])          ← ssv-clip-${i}
     media mount       #clip-media-${i}     (surface mounts .clip-bg) ← ssv-media-${i}
     tap/gesture zone  #tap-${i}            (.clip-tap)               ← ssv-tap-${i}
     pause indicator   #pause-icon-${i}     (.clip-pause-icon.show)   ← .ssv-paused
     fire burst        #burst-${i}          (.fire-burst.pop)         ← ssv-burst-${i} (.go)
     progress bar      .ss-progress (appended via ssMakeProgressBar)  ← same component
     mobile fire       #m-lit-${i} / count #m-lit-count-${i} (.lit)   ← ssv-fire-${i}
     mobile save       #m-save-${i} (data-save-id)                    ← ssv-save
     mobile Watch It   #m-watch-${i} (.fire-flash on fire)            ← .ssv-watch
     desktop rail      #action-rail (ONE shared rail, positionRail):  ← per-clip .ssv-rail
                         fire #rail-lit + count #rail-lit-count (.lit)
                         save #rail-save (data-save-id)
                         share (3rd .act-btn, no id)
                         Watch It #rail-watch + pill #rail-watch-pill / #rail-watch-pill-plat
   The desktop rail is a single fixed element shared across clips and is
   re-synced to the active clip by _inlineSyncRail (mirrors the old syncRail).
════════════════════════════════════════════════ */

/* Build one inline clip frame (Feed classes/ids). The background is NOT
   hardcoded — the Media_Surface mounts a .clip-bg into #clip-media-${i}; the
   Progress_Bar is appended in JS via ssMakeProgressBar. Title and view/follower
   counts are never rendered on the clip body (Req 10.1, 10.4). */
function _inlineClipHTML(c, i) {
  const fired = _inlineFired.has(i);
  const tags = [...(c.genre || []), c.lang].filter(Boolean)
    .map(t => `<span class="tag">${t}</span>`).join('');
  const caption = c.caption || `A pick from <em>@${c.creator.name}</em>`;
  // Defense-in-depth defaults: a clip arriving without these fields (e.g. a
  // stale SW-cached payload from an older bundle) must never print "NaN" on the
  // Fire pill or "undefined" on the Watch It label — Fire + Watch It are sacred.
  const fires     = Number(c.fires) || 0;
  const platLabel = c.platLabel || 'Streaming';
  const platColor = c.platColor || '#EA3B32';
  const platRgb   = c.platRgb   || '234,59,50';
  const platAbbr  = (c.platforms && c.platforms[0] && c.platforms[0].label) || c.platAbbr || (platLabel.charAt(0) || '▶');
  // Poster-first frame: paint the Mux thumbnail (or the gradient) on the media
  // node up front so the clip shows an image INSTANTLY — no black/spinner while
  // the <mux-player> upgrades and buffers (Instagram/TikTok feel).
  const mediaStyle = c.poster
    ? ` style="background-image:url('${String(c.poster).replace(/'/g, '%27')}');background-size:cover;background-position:center;background-color:#000;"`
    : (c.bg ? ` style="background:${c.bg}"` : '');
  return `
    <div class="clip${i === 0 ? ' active' : ''}" id="clip-${i}" data-ss-idx="${i}">
      <div class="clip-media" id="clip-media-${i}"${mediaStyle}></div>
      <div class="clip-vignette"></div>
      <div class="clip-grain"></div>
      <div class="clip-logo-float">
        <div class="clip-logo-mark"><svg viewBox="0 0 1254 1254" xmlns="http://www.w3.org/2000/svg"><use href="#ss-mark"/></svg></div>
      </div>
      <div class="clip-mute muted" id="clip-mute-${i}" onpointerdown="event.stopPropagation()" onclick="event.stopPropagation(); ssvToggleMute()" role="button" aria-label="Toggle sound">
        <svg class="clip-mute-on" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        <svg class="clip-mute-off" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
      </div>
      <div class="clip-tap" id="tap-${i}">
        <div class="clip-pause-icon" id="pause-icon-${i}">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        </div>
      </div>
      <div class="fire-burst" id="burst-${i}">
        <svg width="110" height="110" viewBox="0 0 24 24" fill="#EA3B32"><path d="M12 2C12 2 8 6.5 8 10a4 4 0 0 0 8 0c0-1.5-.8-3-1.5-4C13.8 7.5 14 9 13 10c-.5.5-1 .8-1 .8S10 9.5 10 8c0-2 2-6 2-6z"/><path d="M12 14c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4z"/></svg>
      </div>
      <div class="mobile-action-rail" id="m-rail-${i}">
        <div class="m-act-btn" id="m-lit-${i}" onclick="event.stopPropagation(); ClipEngine.fire(${i}, null, null, 'INLINE')">
          <div class="m-act-icon">
            <svg class="m-fire-outline" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C12 2 8 6.5 8 10a4 4 0 0 0 8 0c0-1.5-.8-3-1.5-4C13.8 7.5 14 9 13 10c-.5.5-1 .8-1 .8S10 9.5 10 8c0-2 2-6 2-6z"/><path d="M12 14c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4z"/></svg>
            <svg class="m-fire-filled" width="30" height="30" viewBox="0 0 24 24"><path fill="#EA3B32" stroke="#EA3B32" stroke-width="0.5" d="M12 2C12 2 8 6.5 8 10a4 4 0 0 0 8 0c0-1.5-.8-3-1.5-4C13.8 7.5 14 9 13 10c-.5.5-1 .8-1 .8S10 9.5 10 8c0-2 2-6 2-6z"/><path fill="#EA3B32" stroke="#EA3B32" stroke-width="0.5" d="M12 14c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4z"/></svg>
          </div>
          <span class="m-act-label" id="m-lit-count-${i}">${fmtFires(fires + (fired ? 1 : 0))}</span>
        </div>
        <div class="m-act-btn" id="m-save-${i}" data-save-id="${c.id}" onclick="event.stopPropagation(); ssToggleSave(_inlineClips[${i}], this)">
          <div class="m-act-icon">
            <svg class="m-save-outline" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            <svg class="m-save-filled"  width="28" height="28" viewBox="0 0 24 24"><path fill="#EA3B32" stroke="#EA3B32" stroke-width="0.5" d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </div>
          <span class="m-act-label">Save</span>
        </div>
        <div class="m-act-btn" onclick="event.stopPropagation(); ssShare(_inlineClips[${i}])">
          <div class="m-act-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </div>
          <span class="m-act-label">Share</span>
        </div>
      </div>
      <button class="mobile-watch-btn" id="m-watch-${i}"
        style="background:rgba(255,99,45,0.26); --btn-rgb:234,59,50"
        onclick="event.stopPropagation(); ssOpenSheet(_inlineClips[${i}])">
        <div class="mobile-watch-btn-inner">
          <div class="mobile-watch-text">
            <span class="mobile-watch-text-main">Watch It</span>
          </div>
          <div class="mobile-watch-arrow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </div>
        </div>
      </button>
      <div class="clip-bottom">
        <div class="creator-row">
          <div class="creator-avatar" style="background:${c.creator.bg}" data-curator="${c.creator.name}" data-curator-name="${c.creator.name}" data-curator-letter="${c.creator.letter}" data-curator-bg="${c.creator.bg}">${_ssAvatarInner(c.creator)}</div>
          <span class="creator-name" data-curator="${c.creator.name}" data-curator-name="${c.creator.name}" data-curator-letter="${c.creator.letter}" data-curator-bg="${c.creator.bg}">@${c.creator.name}</span>
          <span class="creator-follow" data-follow="${c.creator.name}" data-follow-plus data-follow-name="${c.creator.name}" data-follow-letter="${c.creator.letter}" data-follow-bg="${c.creator.bg}">+ Follow</span>
        </div>
        <div class="tag-row">${tags}</div>
        <div class="caption">${caption}</div>
      </div>
    </div>
  `;
}

/* INLINE fire — the Feed's fire visuals, driven by the single ClipEngine.fire.
   Idempotent ON (matches the unified Fire definition). Updates the per-clip
   mobile rail + the shared desktop rail (only when this clip is active),
   bursts the flame, flashes the Watch It CTA, and persists via _ssDbFire. */
function _inlineFire(idx, x, y) {
  const clip = _inlineClips[idx];
  if (!clip) return;
  const already = _inlineFired.has(idx);
  if (!already) _inlineFired.add(idx);   // idempotent: only ever turns ON

  // Mobile per-clip flame: lit state + pulse + count.
  const mLit = document.getElementById(`m-lit-${idx}`);
  if (mLit) {
    mLit.classList.add('lit');
    const ico = mLit.querySelector('.m-act-icon');
    if (ico) { ico.classList.remove('pulse'); void ico.offsetWidth; ico.classList.add('pulse'); }
  }
  const mCount = document.getElementById(`m-lit-count-${idx}`);
  if (mCount) mCount.textContent = fmtFires(clip.fires + 1);

  // Desktop shared rail flame — only meaningful when this clip is the active one.
  if (idx === _inlineActiveIdx) {
    const litBtn = document.getElementById('rail-lit');
    if (litBtn) {
      litBtn.classList.add('lit');
      const ico = litBtn.querySelector('.act-icon');
      if (ico) { ico.classList.remove('pulse'); void ico.offsetWidth; ico.classList.add('pulse'); }
    }
    const railCount = document.getElementById('rail-lit-count');
    if (railCount) railCount.textContent = fmtFires(clip.fires + 1);
  }

  // Fire-burst at the tap point (relative to the clip), or centred.
  const burst = document.getElementById(`burst-${idx}`);
  const clipEl = document.getElementById(`clip-${idx}`);
  if (burst && clipEl) {
    const r = clipEl.getBoundingClientRect();
    burst.style.left = ((x != null) ? (x - r.left) : (r.width / 2)) + 'px';
    burst.style.top  = ((y != null) ? (y - r.top)  : (r.height / 2)) + 'px';
    burst.classList.remove('pop'); void burst.offsetWidth; burst.classList.add('pop');
    setTimeout(() => burst.classList.remove('pop'), 720);
  }

  // Fire energy → flash the Watch It CTA (mobile button + desktop pill if active).
  _inlineFlashCTA(idx);

  // Persist only on the first (idempotent) transition to fired.
  if (!already && typeof _ssDbFire === 'function') _ssDbFire(clip.id, true);
}

/* Flash the Watch It CTA (mirrors the Feed's flashCTA). */
function _inlineFlashCTA(idx) {
  if (idx === _inlineActiveIdx) {
    const pill = document.getElementById('rail-watch-pill');
    if (pill) {
      pill.classList.remove('fire-flash'); void pill.offsetWidth; pill.classList.add('fire-flash');
      pill.addEventListener('animationend', () => pill.classList.remove('fire-flash'), { once: true });
    }
  }
  const mWatch = document.getElementById(`m-watch-${idx}`);
  if (mWatch) {
    mWatch.classList.remove('fire-flash'); void mWatch.offsetWidth; mWatch.classList.add('fire-flash');
    mWatch.addEventListener('animationend', (e) => {
      if (e.animationName === 'mobileCtaFireFlash') mWatch.classList.remove('fire-flash');
    }, { once: true });
  }
}

/* INLINE single-tap pause/resume of the active surface. Shows the Feed's
   pause indicator while paused. */
function _inlineTogglePause(idx) {
  const surface = _inlineSurfaces[idx];
  if (!surface) return;
  const icon = document.getElementById(`pause-icon-${idx}`);
  if (surface._ssPaused) {
    surface._ssPaused = false;
    surface.play().catch(() => {});
    if (icon) icon.classList.remove('show');
  } else {
    surface._ssPaused = true;
    surface.pause();
    if (icon) icon.classList.add('show');
  }
}

/* Solo the active clip: PAUSE + mute every mounted surface EXCEPT the active one.
   This is the "only the clip you're looking at ever plays" invariant. Muting
   alone is NOT enough: a non-active <mux-player> that is still PLAYING (e.g. its
   autoplay attribute / play-intent got re-armed when the player pool repointed it
   while scrolling the feed) steals one of the platform's scarce simultaneous-
   video slots. On iOS that forces the ON-SCREEN clip to pause — so it freezes on
   the first frame while an off-screen clip plays silently in the background (the
   "clip sticks after the thumbnail; another clip is a quarter through" bug, which
   only shows in the heavily-recycling inline Feed, never in the fullscreen viewer
   that barely recycles). Pausing keeps the element's buffered data + preload, so
   scrolling to a paused-but-warmed clip still starts instantly. The active
   surface's own play/mute state is set by the activation path that follows.
   Host-agnostic (pass the host's surface array). */
function _ssMuteOthers(surfaces, activeIdx) {
  if (!Array.isArray(surfaces)) return;
  for (var i = 0; i < surfaces.length; i++) {
    if (i === activeIdx) continue;
    var s = surfaces[i];
    if (!s) continue;
    // Pause FIRST (also clears the autoplay attribute via the surface's pause())
    // so the element can never grab a playback slot, then mute as a backstop.
    if (typeof s.pause === 'function')    { try { s.pause(); } catch (e) {} }
    if (typeof s.setMuted === 'function') { try { s.setMuted(true); } catch (e) {} }
  }
}

/* INLINE setActive — pause the previous surface, play this one with the
   resolved Mute_Preference (autoplay-rejection → muted retry), and re-sync the
   shared desktop rail to this clip. The .active class is toggled by the
   observer (mirrors the FULLSCREEN host). */
function _inlineSetActive(idx) {
  if (_inlineActiveIdx === idx) return;

  const prev = _inlineSurfaces[_inlineActiveIdx];
  if (prev) { prev.pause(); prev._ssPaused = false; }
  const prevIcon = document.getElementById(`pause-icon-${_inlineActiveIdx}`);
  if (prevIcon) prevIcon.classList.remove('show');

  _inlineActiveIdx = idx;
  const surface = _inlineSurfaces[idx];
  if (!surface) return;

  // Solo audio: mute every OTHER mounted surface so only this clip can be heard.
  _ssMuteOthers(_inlineSurfaces, idx);

  const muted = _ssvResolveMuted('INLINE');
  surface._ssPaused = false;
  // Post-unlock: pause-prev + play with no muted→unmuted dance (audio stays on
  // through scroll). Pre-unlock first clip: muted-first autoplay-safe sequence.
  if (_ssAudioUnlocked) _activatePostUnlock(null, surface);
  else _ssActivateSurface(surface, muted);

  // Preload the NEXT clip while this one loops, for smooth scrolling.
  const nextSurface = _inlineSurfaces[idx + 1];
  if (nextSurface && typeof nextSurface.preload === 'function') nextSurface.preload();
  // Network-aware deeper look-ahead + resolution ceiling + bandwidth gate.
  _warmNext(idx, 'INLINE');
  // Prewarm Watch It data for this clip (and the next) so the sheet is instant.
  if (typeof ssPrewarmWatch === 'function') {
    ssPrewarmWatch(_inlineClips[idx]);
    if (_inlineClips[idx + 1]) ssPrewarmWatch(_inlineClips[idx + 1]);
  }

  _inlineSyncRail(idx);
  _inlineAnimateRailIn();
  _inlinePaintMuteBtns();   // keep the frame mute buttons in sync

  // Stall affordance: clear any stale icon on this clip, then (re)arm the
  // "is it actually playing?" check. If the active video clip hasn't started
  // within the grace window (iOS slot exhaustion → stuck on first frame), the
  // tap-to-play affordance appears; tapping opens the fullscreen viewer (which
  // mounts a bounded, proven band and always plays).
  var _actStallIcon = document.getElementById('pause-icon-' + idx);
  if (_actStallIcon) _actStallIcon.classList.remove('show');
  _inlineArmStallCheck(SS_STALL_GRACE_MS);

  // Reach = genuine attention: record a view only after this clip has stayed
  // the active one for SS_VIEW_DWELL_MS (cleared if the active clip changes).
  _ssScheduleViewDwell('INLINE');

  // Refresh the preload ladder + resolution cap for the whole mounted band
  // relative to the new active clip (only the active clip is 'auto').
  _ssApplyPreloadTiers('INLINE');
  // Spend spare bandwidth deepening upcoming clips once the active clip's
  // buffer is satisfied (Phase 2; active always wins the pipe).
  _ssStartDeepenController('INLINE');
  // Tell the SW the active-clip window so its Segment_Cache can compute
  // clipDistance for window/LRU eviction (Phase 4).
  _ssPostSegWindow('INLINE');
}

/* Sync the single fixed desktop #action-rail to the active clip (mirrors the
   Feed's old syncRail). The mobile rail is per-clip so it needs no sync. */
function _inlineSyncRail(idx) {
  const clip = _inlineClips[idx];
  if (!clip) return;
  const fired = _inlineFired.has(idx);
  const fires = Number(clip.fires) || 0;

  const litBtn   = document.getElementById('rail-lit');
  const litCount = document.getElementById('rail-lit-count');
  if (litCount) litCount.textContent = fmtFires(fires + (fired ? 1 : 0));
  if (litBtn) litBtn.classList.toggle('lit', fired);

  // Save: update data-save-id so ssSyncAllSaveBtns works, sync visual state,
  // and (re)wire its click to the shared Save with the correct clip.
  const saveBtn = document.getElementById('rail-save');
  if (saveBtn) {
    saveBtn.setAttribute('data-save-id', clip.id);
    saveBtn.classList.toggle('saved', ssIsClipSaved(clip.id));
    saveBtn.onclick = () => ssToggleSave(clip, saveBtn);
  }

  const pill = document.getElementById('rail-watch-pill');
  const plat = document.getElementById('rail-watch-pill-plat');
  if (pill) { pill.style.background = 'rgba(255,99,45,0.26)'; pill.style.setProperty('--pill-rgb', '234,59,50'); }
  if (plat) plat.textContent = clip.platLabel || 'Streaming';

  ssSyncAllSaveBtns();   // keep mobile per-clip save buttons in sync too
}

/* Wire the fixed desktop rail's fire / share / Watch It controls to the engine,
   acting on whatever clip is active. (Save is wired per-active-clip in
   _inlineSyncRail because it needs the clip object + data-save-id.) */
function _inlineWireDesktopRail() {
  const rail = document.getElementById('action-rail');
  if (!rail) return;
  const litBtn = document.getElementById('rail-lit');
  if (litBtn) litBtn.onclick = () => ClipEngine.fire(_inlineActiveIdx, null, null, 'INLINE');
  // Share is the .act-btn with no id (not rail-lit / not rail-save).
  rail.querySelectorAll('.act-btn').forEach(btn => {
    if (btn.id !== 'rail-lit' && btn.id !== 'rail-save') {
      btn.onclick = () => ssShare(_inlineClips[_inlineActiveIdx]);
    }
  });
  const watch = document.getElementById('rail-watch');
  if (watch) watch.onclick = () => ssOpenSheet(_inlineClips[_inlineActiveIdx]);
}

/* INLINE active-clip observer (threshold 0.6) — drives ClipEngine.setActive
   for the inline host, mirroring _ssvSetupObserver for FULLSCREEN. */
function _inlineSetupObserver(container) {
  if (_inlineObserver) _inlineObserver.disconnect();
  _inlineObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        container.querySelectorAll('.clip.active').forEach(el => el.classList.remove('active'));
        entry.target.classList.add('active');
        const idx = parseInt(entry.target.dataset.ssIdx, 10);
        if (!isNaN(idx)) {
          ClipEngine.pruneInlineSurfaces(idx);   // mount the band around the new active, drop the rest (Req 9.5)
          ClipEngine.setActive(idx, 'INLINE');
          _inlineMaybeLoadNext(idx);             // sliding-window fetch at the +6 leading edge (Req 9.3)
        }
      }
    });
  }, { root: container, threshold: 0.6 });
  container.querySelectorAll('.clip').forEach(c => _inlineObserver.observe(c));
}

/* ── Feed sliding-window pager (Req 9) ─────────────────────────────
   DB-backed windowed loading that grows the inline Feed as the viewer
   advances; ClipEngine.pruneInlineSurfaces then bounds mounted players.
   No-ops for the mock/offline feed (the pager is simply never started). */
let _feedPagerActive   = false;
let _feedWindowStart   = 0;       // rendered index where the latest window starts
let _feedNextOffset    = 0;       // DB offset for the next window fetch
let _feedFetchInFlight = false;   // single-flight guard (Req 9.3)
let _feedNoMore        = false;   // set once a short/empty page comes back
let _feedContainer     = null;

/* Fetch one window (~SS_CLIP_WINDOW clips) from the DB, in Feed shape. */
async function ssLoadClipWindow(offset) {
  if (typeof ssLoadClips !== 'function') return [];
  const base = await ssLoadClips(SS_CLIP_WINDOW, offset);
  return (typeof ssClipsForFeed === 'function') ? ssClipsForFeed(base) : base;
}

/* Fetch + append the next window. Guarded so it fires once per window (Req 9.4). */
async function loadNextWindow() {
  if (!_feedPagerActive || _feedFetchInFlight || _feedNoMore) return;
  _feedFetchInFlight = true;
  try {
    const next = await ssLoadClipWindow(_feedNextOffset);
    if (!next || !next.length) { _feedNoMore = true; return; }
    _feedWindowStart = _inlineClips.length;            // the new window begins here
    ClipEngine.appendInline(_feedContainer, next);     // seamless append (no scroll reset)
    _feedNextOffset += SS_CLIP_WINDOW;
    if (next.length < SS_CLIP_WINDOW) _feedNoMore = true;  // last (partial) page
  } catch (e) { /* swallow — the pager simply stops growing */ }
  finally { _feedFetchInFlight = false; }
}

/* Observer hook: decide whether to fetch the next window (Req 9.3). */
function _inlineMaybeLoadNext(activeIdx) {
  if (!_feedPagerActive) return;
  if (ssShouldFetchNextWindow(activeIdx, _feedWindowStart, _inlineClips.length, _feedFetchInFlight)) {
    loadNextWindow();
  }
}

/* Start the windowed pager AFTER the first window is already mounted.
   initialCount = how many DB rows the first window consumed (its offset base). */
function ssStartFeedPager(container, initialCount) {
  _feedPagerActive   = true;
  _feedContainer     = container;
  _feedWindowStart   = 0;
  _feedNextOffset    = initialCount || 0;
  _feedFetchInFlight = false;
  _feedNoMore        = false;
}

/* ── Per-user feed cache + video warming (seamless open, Req: instant feel) ──
   Instagram/TikTok-grade open without overloading the DB or Mux:
     • Render the per-user cached first window INSTANTLY (poster-first, no
       spinner), then revalidate against the DB ONCE (stale-while-revalidate).
     • Cache is keyed PER USER (guests share a 'guest' bucket), VERSIONED,
       CAPPED, and TTL'd so it self-heals and never grows unbounded.
     • Stores ONLY public clip metadata (captions, PUBLIC Mux playback ids,
       posters) — nothing RLS-protected, so the cache can never leak data the
       user could not already read.
     • Warming is BOUNDED to the next couple of clips so we never burn Mux
       bandwidth or crash mobile with too many live players. */
var SS_FEED_CACHE_VERSION = 1;                    // bump to invalidate all caches
var SS_FEED_CACHE_MAX     = 30;                   // cap stored clips = Metadata_Window (Req 7.1/7.4; feed-clip-load-performance Phase 4, task 19). METADATA ONLY — never video bytes; matches SS_METADATA_WINDOW so scroll-back within the window renders with no DB round-trip.
var SS_FEED_CACHE_TTL_MS  = 6 * 60 * 60 * 1000;   // 6h: render stale, then refresh
var SS_FEED_FRESH_MS      = 30 * 1000;            // <30s old → skip revalidation (saves a query)
var SS_WARM_AHEAD         = 2;                     // warm only the next N clips
// Instant-first-frame seed (clip-player-performance Phase 4, Req 3.1). A LOW
// initial bandwidth estimate makes mux-player/hls.js pick a small, low-bitrate
// FIRST segment that renders almost immediately, before ABR climbs to full
// quality. This is the universal first-frame lever; Phase 5 layers a
// tier-driven max-auto-resolution ceiling on top for slow connections.
var SS_START_BW_KBPS      = 700;                   // kbps seed for the first segment

/* ════════════════════════════════════════════════════════════════════════
   FEED CLIP-LOAD PERFORMANCE — TUNABLE CONSTANTS (Phase 0; Req 11.1/11.2)
   ────────────────────────────────────────────────────────────────────────
   Every prefetch/cache magnitude lives here as a NAMED tunable so the founder
   can dial generosity up or down without touching control logic. These are
   consumed by later phases (preload ladder, deepening, splash lane, SW segment
   cache); Phase 0 only wires SS_SESSION_BYTE_BUDGET into the prefetch counter
   below. Dual-exported (window.* + module.exports) like the other SS_* consts.
   ════════════════════════════════════════════════════════════════════════ */
var SS_PREFETCH_DEPTH     = { slow: 1, medium: 3, fast: 5 };   // clips ahead eligible to prefetch, per Network_Tier (Req 1.5; single source for ssNetworkPolicy.preloadDepth)
var SS_SESSION_BYTE_BUDGET = 150 * 1024 * 1024;                // ~150 MB per-session prefetch (non-active) byte ceiling (Req 3.7)
var SS_SEG_CACHE_WINDOW   = { behind: 5, ahead: 5 };           // segment-cache eviction window: N behind + N ahead of active (Req 4.5)
var SS_SEG_CACHE_CEILING  = 200 * 1024 * 1024;                 // ~200 MB LRU-by-bytes ceiling for the SW segment cache (Req 4.6)
var SS_RES_CAP            = { slow: '720p', medium: '720p', fast: '720p' }; // delivered-resolution CEILING per Network_Tier (Req 6.2/6.3). 720p everywhere: the low initial-bandwidth seed gives a fast ~480p start, then ABR climbs UP TO this ceiling when bandwidth is free (auto 480p→720p). ABR never climbs on a genuinely slow link, so this is a ceiling, not a target.
var SS_SPLASH_FLOOR_MS    = 700;                               // min brand-splash duration (first-ever launch uses 3000 — that lives in the feed splash script; not changed here) (Req 5.7)
var SS_SPLASH_CEILING_MS  = 4000;                              // hard max splash duration; lifts regardless of clip readiness (Req 5.7)
var SS_METADATA_WINDOW    = 30;                                // clips retained in the L1 metadata (SWR) cache (Req 7.1/7.4)
var SS_BUFFER_SATISFIED_S = 5;                                 // active-clip buffered-ahead seconds that gate progressive deepening (Req 2.1)
var SS_DWELL_THRESHOLD    = 0.5;                               // min dwell (0.0–1.0) at/above which aggressive deepening is permitted (Req 2.3)
var SS_PREWARM_POSTER_COUNT = 12;                              // posters decoded into the browser image cache per Target_Page cross-page prewarm. MUST stay in [12,15] (prefetch-cache-pipeline R2.2).

/* Documented Kill_Switch defaults — every Pipeline capability sits behind its
   own `ss_ff_<name>` flag and defaults OFF, so a fresh / unconfigured install
   degrades to today's load-after-mount behaviour. These 7 boolean defaults are
   the single source consumed by ssResolveKillSwitches (prefetch-cache-pipeline
   R10.1, R10.2, R10.5). All false = all capabilities off by default. */
var SS_KILL_SWITCH_DEFAULTS = {
  ss_ff_prewarm:       false,   // Cross_Page_Prewarm (Phase 1)
  ss_ff_idb:           false,   // IndexedDB Page_Data tiering (Phase 2)
  ss_ff_poster_swr:    false,   // Poster Stale_While_Revalidate (Phase 2)
  ss_ff_segprefetch:   false,   // Segment-byte prefetch (Phase 3)
  ss_ff_segcache:      false,   // SW Segment_Cache (Phase 3)
  ss_ff_speculation:   false,   // Speculation Rules prerender (Phase 3)
  ss_ff_viewtransition:false,   // cross-document View Transitions (Phase 3)
};

if (typeof window !== 'undefined') {
  window.SS_PREFETCH_DEPTH      = SS_PREFETCH_DEPTH;
  window.SS_SESSION_BYTE_BUDGET = SS_SESSION_BYTE_BUDGET;
  window.SS_SEG_CACHE_WINDOW    = SS_SEG_CACHE_WINDOW;
  window.SS_SEG_CACHE_CEILING   = SS_SEG_CACHE_CEILING;
  window.SS_RES_CAP             = SS_RES_CAP;
  window.SS_SPLASH_FLOOR_MS     = SS_SPLASH_FLOOR_MS;
  window.SS_SPLASH_CEILING_MS   = SS_SPLASH_CEILING_MS;
  window.SS_METADATA_WINDOW     = SS_METADATA_WINDOW;
  window.SS_BUFFER_SATISFIED_S  = SS_BUFFER_SATISFIED_S;
  window.SS_DWELL_THRESHOLD     = SS_DWELL_THRESHOLD;
  window.SS_PREWARM_POSTER_COUNT = SS_PREWARM_POSTER_COUNT;
  window.SS_KILL_SWITCH_DEFAULTS = SS_KILL_SWITCH_DEFAULTS;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports.SS_PREFETCH_DEPTH      = SS_PREFETCH_DEPTH;
  module.exports.SS_SESSION_BYTE_BUDGET = SS_SESSION_BYTE_BUDGET;
  module.exports.SS_SEG_CACHE_WINDOW    = SS_SEG_CACHE_WINDOW;
  module.exports.SS_SEG_CACHE_CEILING   = SS_SEG_CACHE_CEILING;
  module.exports.SS_RES_CAP             = SS_RES_CAP;
  module.exports.SS_SPLASH_FLOOR_MS     = SS_SPLASH_FLOOR_MS;
  module.exports.SS_SPLASH_CEILING_MS   = SS_SPLASH_CEILING_MS;
  module.exports.SS_METADATA_WINDOW     = SS_METADATA_WINDOW;
  module.exports.SS_BUFFER_SATISFIED_S  = SS_BUFFER_SATISFIED_S;
  module.exports.SS_DWELL_THRESHOLD     = SS_DWELL_THRESHOLD;
  module.exports.SS_PREWARM_POSTER_COUNT = SS_PREWARM_POSTER_COUNT;
  module.exports.SS_KILL_SWITCH_DEFAULTS = SS_KILL_SWITCH_DEFAULTS;
}

/* ── Session prefetch byte budget + circuit breaker (Req 3.1/3.2/3.5) ──
   A single per-session running total of bytes prefetched for NON-active clips.
   _ssChargePrefetch(bytes) adds finite, non-negative byte counts (ignoring
   NaN/negative) and engages the circuit breaker once the cumulative total
   reaches SS_SESSION_BYTE_BUDGET. _ssResetPrefetchBudget() starts a clean
   session (called from the feed cold-open in initFeed). These are impure
   session helpers (like ssRecordView), so they are WINDOW-ONLY — not part of
   the pure module.exports block. No prefetch charges the budget yet; Phases
   1–2 wire the actual downloads through _ssChargePrefetch. */
var _ssPrefetchBytes = 0;
var _ssCircuitOpen = false;

function _ssChargePrefetch(bytes) {
  if (typeof bytes !== 'number' || !isFinite(bytes) || bytes < 0) return;   // ignore NaN/Infinity/negative
  _ssPrefetchBytes += bytes;
  if (_ssPrefetchBytes >= SS_SESSION_BYTE_BUDGET) _ssCircuitOpen = true;
}

function _ssResetPrefetchBudget() {
  _ssPrefetchBytes = 0;
  _ssCircuitOpen = false;
}

if (typeof window !== 'undefined') {
  window._ssChargePrefetch = _ssChargePrefetch;
  window._ssResetPrefetchBudget = _ssResetPrefetchBudget;
}

function _ssFeedCacheKey() {
  var me = (typeof window !== 'undefined' && typeof window.ssCurrentUser === 'function') ? window.ssCurrentUser() : null;
  // The async getSession() may not have resolved yet on a cold page load, so
  // ssCurrentUser() is null at initFeed() time. Fall back to the SYNCHRONOUSLY
  // persisted last user id so the key matches what was written last session —
  // otherwise the key is 'guest', the per-user cache misses, and every return
  // to the Feed does a cold DB fetch (the "feed takes 4-5s to come back" bug).
  var id = (me && me.id) || _ssReadLastUid() || 'guest';
  return 'ss_feed_cache_v' + SS_FEED_CACHE_VERSION + '_' + id;
}

/* Last signed-in user id, persisted SYNCHRONOUSLY (localStorage) so user-keyed
   caches resolve to the right key on a cold load, before the async session
   read resolves. Written on session resolve / auth change; cleared on logout. */
var SS_LAST_UID_KEY = 'ss_last_uid';
function _ssReadLastUid() {
  try { return window.localStorage.getItem(SS_LAST_UID_KEY) || null; } catch (e) { return null; }
}
function _ssWriteLastUid(id) {
  try {
    if (id) window.localStorage.setItem(SS_LAST_UID_KEY, String(id));
    else window.localStorage.removeItem(SS_LAST_UID_KEY);
  } catch (e) { /* best-effort */ }
}

/* Read the cached first window for THIS user. Returns { clips, ageMs } or null
   (null when missing, wrong version, empty, or past the freshness TTL). */
function ssReadFeedCache() {
  try {
    var raw = window.localStorage.getItem(_ssFeedCacheKey());
    if (!raw) return null;
    var obj = JSON.parse(raw);
    if (!obj || obj.v !== SS_FEED_CACHE_VERSION || !Array.isArray(obj.clips) || !obj.clips.length) return null;
    var ageMs = Date.now() - (obj.ts || 0);
    if (SS_FEED_CACHE_TTL_MS && ageMs > SS_FEED_CACHE_TTL_MS) return null;   // too stale → revalidate from scratch
    return { clips: obj.clips, ageMs: ageMs };
  } catch (e) { return null; }
}

/* Persist the first window for THIS user (best-effort; quota/disabled storage is fine). */
function ssWriteFeedCache(clips) {
  try {
    if (!Array.isArray(clips) || !clips.length) return;
    window.localStorage.setItem(_ssFeedCacheKey(), JSON.stringify({
      v: SS_FEED_CACHE_VERSION, ts: Date.now(), clips: clips.slice(0, SS_FEED_CACHE_MAX),
    }));
  } catch (e) { /* best-effort cache */ }
}

/* ── Generic per-page, per-user clip cache ───────────────────────────────
   The same cache-then-revalidate shell the feed uses, generalized for the
   other clip-backed pages (Discover / Profile / Watchlist). Each page paints
   its LAST real content INSTANTLY from this cache, then revalidates against
   the DB and only re-renders if the list actually changed (ssFeedListChanged).
   Stores already-PAGE-SHAPED clip arrays, keyed by page name + user (falls
   back to the synchronously-persisted last user id so it hits on a cold load
   before the async session resolves). Best-effort; storage failures are fine. */
var SS_PAGE_CACHE_MAX = 60;                       // bigger than the feed window (grids show more)
function _ssPageCacheKey(name) {
  var me = (typeof window !== 'undefined' && typeof window.ssCurrentUser === 'function') ? window.ssCurrentUser() : null;
  var id = (me && me.id) || _ssReadLastUid() || 'guest';
  return 'ss_page_' + name + '_v' + SS_FEED_CACHE_VERSION + '_' + id;
}
function ssReadPageCache(name) {
  try {
    var raw = window.localStorage.getItem(_ssPageCacheKey(name));
    if (!raw) return null;
    var obj = JSON.parse(raw);
    if (!obj || obj.v !== SS_FEED_CACHE_VERSION || !Array.isArray(obj.clips) || !obj.clips.length) return null;
    if (SS_FEED_CACHE_TTL_MS && (Date.now() - (obj.ts || 0)) > SS_FEED_CACHE_TTL_MS) return null;
    return obj.clips;
  } catch (e) { return null; }
}
function ssWritePageCache(name, clips) {
  try {
    if (!Array.isArray(clips) || !clips.length) return;
    window.localStorage.setItem(_ssPageCacheKey(name), JSON.stringify({
      v: SS_FEED_CACHE_VERSION, ts: Date.now(), clips: clips.slice(0, SS_PAGE_CACHE_MAX),
    }));
  } catch (e) { /* best-effort cache */ }
}

/* ── Own-profile prewarm + cache (feed → profile instant cold start) ─────────
   Make opening Profile feel instant: cache the signed-in user's identity row
   (name / handle / avatar / bio / genres / role) keyed by uid — with the
   synchronous ss_last_uid fallback so it hits on a cold load before the async
   session resolves — and warm both the avatar IMAGE and the profile DOCUMENT
   ahead of the tap. The Profile page paints from this cache, then revalidates
   against the DB (ssWriteMyProfileCache on the fresh read). Best-effort; the
   cache is cleared on sign-out so it can never show a stale signed-in identity. */
var SS_PROFILE_CACHE_TTL_MS = 1000 * 60 * 60;   // 1h — identity changes rarely
function _ssProfileCacheKey() {
  var me = (typeof window !== 'undefined' && typeof window.ssCurrentUser === 'function') ? window.ssCurrentUser() : null;
  var id = (me && me.id) || _ssReadLastUid() || 'guest';
  return 'ss_profile_v' + SS_FEED_CACHE_VERSION + '_' + id;
}
function ssReadMyProfileCache() {
  try {
    var raw = window.localStorage.getItem(_ssProfileCacheKey());
    if (!raw) return null;
    var o = JSON.parse(raw);
    if (!o || o.v !== SS_FEED_CACHE_VERSION) return null;
    if (SS_PROFILE_CACHE_TTL_MS && (Date.now() - (o.ts || 0)) > SS_PROFILE_CACHE_TTL_MS) return null;
    return o.profile || null;
  } catch (e) { return null; }
}
function ssWriteMyProfileCache(profile) {
  try {
    if (!profile) return;
    // MERGE onto the existing cache so a partial write (e.g. hydrateOwnProfile
    // writing just the identity row, or fetchOwnFollowers writing just a count)
    // never erases other cached fields (identity ↔ counts). The page revalidates
    // every field after load, so the cache is only ever the instant-paint seed.
    var prev = (typeof ssReadMyProfileCache === 'function') ? (ssReadMyProfileCache() || {}) : {};
    var merged = Object.assign({}, prev, profile);
    window.localStorage.setItem(_ssProfileCacheKey(), JSON.stringify({
      v: SS_FEED_CACHE_VERSION, ts: Date.now(), profile: merged,
    }));
  } catch (e) { /* best-effort */ }
}
function ssClearMyProfileCache() {
  try { window.localStorage.removeItem(_ssProfileCacheKey()); } catch (e) {}
}
/* Decode an image into the browser cache so it paints with no network wait. */
function _ssWarmImage(url) {
  try { if (url && typeof Image === 'function') { var im = new Image(); im.decoding = 'async'; im.src = url; } } catch (e) {}
}
/* Prefetch a same-origin document (HTML) so a cross-page nav is warm. */
function _ssPrefetchDoc(href) {
  try {
    if (typeof document === 'undefined' || !document.head) return;
    if (document.querySelector('link[data-ss-doc="' + href + '"]')) return;
    var l = document.createElement('link');
    l.rel = 'prefetch'; l.href = href; l.setAttribute('as', 'document'); l.setAttribute('data-ss-doc', href);
    document.head.appendChild(l);
  } catch (e) { /* best-effort */ }
}
var _ssProfilePrewarmed = false;
function ssPrewarmProfile() {
  if (_ssProfilePrewarmed) return; _ssProfilePrewarmed = true;
  try {
    var onProfile = (typeof location !== 'undefined') && location.pathname.toLowerCase().indexOf('profile') !== -1;
    if (!onProfile) _ssPrefetchDoc('showshak-profile.html');   // warm the HTML doc
    // Warm the cached avatar immediately (decoded before the tap).
    var cached = ssReadMyProfileCache();
    if (cached && cached.avatar_url) _ssWarmImage(cached.avatar_url);
    if (!window.ssDB) return;
    // Resolve uid, refresh the cached identity row + the follower/clip COUNTS
    // (so the profile creds strip paints instantly on cold start, not after the
    // async counts land), and warm the fresh avatar.
    Promise.resolve()
      .then(function () { return (window.ssDB.auth && window.ssDB.auth.getSession) ? window.ssDB.auth.getSession() : null; })
      .then(function (s) {
        var user = (s && s.data && s.data.session) ? s.data.session.user : null;
        if (!user && typeof window.ssCurrentUser === 'function') user = window.ssCurrentUser();
        if (!user) return null;
        var uid = user.id;
        // Identity row + two cheap head-only COUNT queries, in parallel.
        var identityP  = window.ssDB.from('users')
          .select('username, name, bio, avatar_url, genres, verified, role')
          .eq('id', uid).single();
        var followersP = window.ssDB.from('follows')
          .select('creator_id', { count: 'exact', head: true })
          .eq('creator_id', uid).is('deleted_at', null);
        var clipsP     = window.ssDB.from('content')
          .select('id', { count: 'exact', head: true })
          .eq('creator_id', uid).in('status', ['processing', 'live']).is('deleted_at', null);
        return Promise.all([identityP, followersP, clipsP]);
      })
      .then(function (arr) {
        if (!arr) return;
        var idRes = arr[0], folRes = arr[1], clipRes = arr[2];
        if (!idRes || idRes.error || !idRes.data) return;
        var toCache = Object.assign({}, idRes.data);
        if (folRes && !folRes.error && typeof folRes.count === 'number') toCache.followers_count = folRes.count;
        if (clipRes && !clipRes.error && typeof clipRes.count === 'number') toCache.clips_count = clipRes.count;
        ssWriteMyProfileCache(toCache);
        if (idRes.data.avatar_url) _ssWarmImage(idRes.data.avatar_url);
      })
      .catch(function () { /* best-effort */ });
  } catch (e) { /* never block the app */ }
}
if (typeof window !== 'undefined') {
  window.ssReadMyProfileCache  = ssReadMyProfileCache;
  window.ssWriteMyProfileCache = ssWriteMyProfileCache;
  window.ssClearMyProfileCache = ssClearMyProfileCache;
  window.ssPrewarmProfile      = ssPrewarmProfile;
  // Kick a prewarm shortly after load (off the first-paint path) so Profile is
  // warm by the time the user taps it. Guarded so it never runs under Node.
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(function () { try { ssPrewarmProfile(); } catch (e) {} }, { timeout: 2500 });
  } else if (typeof setTimeout === 'function') {
    setTimeout(function () { try { ssPrewarmProfile(); } catch (e) {} }, 1200);
  }
}

/* ── Cross-page data + poster prewarm (prefetch-cache-pipeline Phase 1) ───────
   IMPURE shell that mirrors ssPrewarmProfile: during the Feed's Idle_Time, warm
   Discover's and Watchlist's Page_Data into the existing per-page cache and
   decode their first posters into the browser image cache, so those tabs paint
   real content on first paint. Pure decisions (which flags are on, whether to
   warm a target, which posters to decode, what's Scoreboard-safe) come from the
   dual-exported pure core (ssResolveKillSwitches / ssShouldPrewarm /
   ssPosterPrewarmList / ssPublicSignalsOnly); this shell only does the I/O.

   Window-only + fully fail-soft: gated entirely by ss_ff_prewarm (default OFF →
   today's load-after-mount behaviour is unchanged), scheduled OFF the first-paint
   critical path, and every target's work is wrapped so a query/decode failure
   leaves that Target_Page's load-after-mount path untouched. Never throws.
   Intentionally NOT in module.exports (impure, touches localStorage/Image/ssDB). */

/* Map location.pathname → the canonical page name, fail-soft. */
function _ssCurrentPageName() {
  try {
    var p = (typeof location !== 'undefined' && location.pathname) ? location.pathname.toLowerCase() : '';
    if (p.indexOf('discover') !== -1)  return 'discover';
    if (p.indexOf('watchlist') !== -1) return 'watchlist';
    if (p.indexOf('feed') !== -1)      return 'feed';
    return '';
  } catch (e) { return ''; }
}

/* Read the raw ss_ff_* Kill_Switch flags off localStorage, fail-soft. Returns a
   partial { capability: boolean } map of the flags that are actually SET, or
   null when storage is unreadable — so ssResolveKillSwitches applies the
   all-or-defaults rule (unreadable → every capability takes its default). A flag
   is "on" only when its stored value is 'on' / 'true' / '1' (defaults are OFF). */
function _ssReadPrewarmFlags() {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return null;
    var raw = {};
    for (var cap in SS_KILL_SWITCH_DEFAULTS) {
      if (!Object.prototype.hasOwnProperty.call(SS_KILL_SWITCH_DEFAULTS, cap)) continue;
      var v = localStorage.getItem(cap);
      if (v !== null) raw[cap] = (v === 'on' || v === 'true' || v === '1');
    }
    return raw;
  } catch (e) { return null; }   // unreadable storage → all-defaults
}

/* Session set of Target_Page names already warmed this Feed session (warm at
   most once per session, prefetch-cache-pipeline R1.3). */
var _ssPrewarmDone = (typeof Set === 'function') ? new Set() : null;

function ssPrewarmPages() {
  try {
    // 1) Resolve Kill_Switches; if Cross_Page_Prewarm is OFF (the default), do
    //    NOTHING — today's load-after-mount behaviour is unchanged (R10.2).
    var flags = (typeof ssResolveKillSwitches === 'function')
      ? ssResolveKillSwitches(_ssReadPrewarmFlags(), SS_KILL_SWITCH_DEFAULTS)
      : SS_KILL_SWITCH_DEFAULTS;
    if (!flags || !flags.ss_ff_prewarm) return;

    var current = _ssCurrentPageName();
    var targets = ['discover', 'watchlist'];
    // Both Target_Pages use the SAME data path the pages themselves use
    // (ssLoadClips → ssClipsForDiscover); fetch+shape once, reuse per target.
    var sharedClips = null, sharedFetched = false;

    function warmTarget(target) {
      // 3) Gate: skip the page we're on (R3.3) and any already warmed (R1.3).
      if (!(typeof ssShouldPrewarm === 'function') || !ssShouldPrewarm(target, current, _ssPrewarmDone)) return;
      if (_ssPrewarmDone && _ssPrewarmDone.add) _ssPrewarmDone.add(target);   // decision to warm → mark done

      // 5) FULLY fail-soft per target: a query/decode failure leaves this
      //    Target_Page's load-after-mount path untouched (R1.5, R10.3).
      Promise.resolve()
        .then(function () {
          if (sharedFetched) return sharedClips;
          sharedFetched = true;
          if (typeof ssLoadClips !== 'function' || typeof ssClipsForDiscover !== 'function') return null;
          return Promise.resolve(ssLoadClips(50, 0)).then(function (base) {
            sharedClips = (base && base.length) ? ssClipsForDiscover(base) : null;
            return sharedClips;
          });
        })
        .then(function (clips) {
          if (!clips || !clips.length) return;
          // 4) Sanitize EVERY record through ssPublicSignalsOnly BEFORE writing
          //    (R11.1 — no Scoreboard fields ever enter a cached payload).
          var safe = clips.map(function (c) {
            return (typeof ssPublicSignalsOnly === 'function') ? ssPublicSignalsOnly(c) : c;
          });
          if (typeof ssWritePageCache === 'function') ssWritePageCache(target, safe);

          // Decode the first SS_PREWARM_POSTER_COUNT posters into the browser
          // image cache (R2.1, R2.4, R2.6). The page clip shape carries `poster`;
          // bridge it to the helper's `posterUrl` contract.
          var posterInput = safe.map(function (c) { return { posterUrl: (c && c.poster) || '' }; });
          var list = (typeof ssPosterPrewarmList === 'function')
            ? ssPosterPrewarmList(posterInput, SS_PREWARM_POSTER_COUNT) : [];
          for (var j = 0; j < list.length; j++) {
            // A single poster decode failure must continue with the rest (R2.5).
            try { _ssWarmImage(list[j]); } catch (e) {}
          }
        })
        .catch(function () { /* leave this target's load-after-mount path untouched */ });
    }

    for (var i = 0; i < targets.length; i++) {
      try { warmTarget(targets[i]); } catch (e) { /* never let one target break another */ }
    }
  } catch (e) { /* never block the app */ }
}
if (typeof window !== 'undefined') {
  window.ssPrewarmPages = ssPrewarmPages;   // window-only (impure); NOT in module.exports
  // 2/6) Kick cross-page prewarm ONLY from the Feed (so a non-feed page never
  //      initiates prewarm of itself), scheduled OFF the first-paint critical
  //      path with rIC + a setTimeout fallback — same guard style as the
  //      ssPrewarmProfile kick above. With ss_ff_prewarm unset (default OFF) the
  //      call is a no-op, so today's load-after-mount behaviour is unchanged.
  if (_ssCurrentPageName() === 'feed') {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(function () { try { ssPrewarmPages(); } catch (e) {} }, { timeout: 2500 });
    } else if (typeof setTimeout === 'function') {
      setTimeout(function () { try { ssPrewarmPages(); } catch (e) {} }, 1200);
    }
  }
}

/* True if the fresh first window differs (by id/order) from what we rendered,
   so we ONLY re-mount when something actually changed — a correct cache never
   causes a flash or interrupts the playing clip. */
function ssFeedListChanged(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return true;
  var an = Math.min(a.length, SS_FEED_CACHE_MAX), bn = Math.min(b.length, SS_FEED_CACHE_MAX);
  if (an !== bn) return true;
  for (var i = 0; i < an; i++) {
    if (String(a[i] && a[i].id) !== String(b[i] && b[i].id)) return true;
  }
  return false;
}

/* Warm the next few clips so playback + first frame are instant when reached.
   Bounded by SS_WARM_AHEAD; de-duped per playback id so we never re-fetch.

   feed-clip-load-performance Phase 1, task 6 (Req 1.2/3.1/10.7): instead of the
   old opaque `no-cors` manifest fetch (which the player can't reuse), we do a
   real CORS first-segment prefetch — fetch the Mux media playlist, parse out the
   first variant's rendition playlist, then fetch its init/map segment (if any) +
   the first media (.ts/.m4s) segment with `cache: 'force-cache'`. Each completed
   segment fetch is sized and charged against the session prefetch budget via
   _ssChargePrefetch. De-duped per playback_id through _ssWarmed, posters still
   warmed, everything fire-and-forget + fail-soft (any error is swallowed; the
   player's own fetch still works). When the session Circuit_Breaker is open
   (_ssCircuitOpen) we SKIP the video prefetch entirely (active-only buffering).

   NOTE: without the Phase-4 service-worker segment cache these prefetched bytes
   prime DNS/TLS + the Mux CDN edge but are NOT yet guaranteed to be reused by the
   player; that guarantee lands in Phase 4. This task's job is to remove the
   wasted opaque warm and start charging the budget. */
var _ssWarmed = {};

/* _ssResolveUrl(uri, base) — resolve a possibly-relative HLS URI against the
   playlist URL it came from. Uses the URL constructor when available; falls
   back to a naive path join. Never throws. */
function _ssResolveUrl(uri, base) {
  if (!uri) return null;
  try { if (typeof URL === 'function') return new URL(uri, base).href; } catch (e) {}
  if (/^https?:\/\//i.test(uri)) return uri;
  try { var i = String(base).lastIndexOf('/'); return (i >= 0 ? String(base).slice(0, i + 1) : '') + uri; }
  catch (e) { return uri; }
}

/* _ssFirstVariantUrl(text, base) — given a Mux master playlist, return the URL
   of the first variant's rendition playlist. If `text` is already a media
   playlist (no #EXT-X-STREAM-INF), return `base` itself so the caller reads its
   segments directly. Never throws. */
function _ssFirstVariantUrl(text, base) {
  if (typeof text !== 'string') return null;
  var lines = text.split(/\r?\n/);
  var isMaster = false;
  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i].trim();
    if (ln.indexOf('#EXT-X-STREAM-INF') === 0) {
      isMaster = true;
      for (var j = i + 1; j < lines.length; j++) {
        var u = lines[j].trim();
        if (u && u.charAt(0) !== '#') return _ssResolveUrl(u, base);
      }
    }
  }
  return isMaster ? null : base;   // already a media playlist → use base
}

/* _ssFirstSegmentUrls(text, base) — given a media (rendition) playlist, return
   { init, first }: the #EXT-X-MAP init/map segment URL (if any) and the first
   media segment URL. Resolves relative URIs against `base`. Never throws. */
function _ssFirstSegmentUrls(text, base) {
  var out = { init: null, first: null };
  if (typeof text !== 'string') return out;
  var lines = text.split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i].trim();
    if (!out.init && ln.indexOf('#EXT-X-MAP:') === 0) {
      var m = ln.match(/URI="([^"]+)"/);
      if (m && m[1]) out.init = _ssResolveUrl(m[1], base);
    }
    if (!out.first && ln.indexOf('#EXTINF') === 0) {
      for (var j = i + 1; j < lines.length; j++) {
        var u = lines[j].trim();
        if (u && u.charAt(0) !== '#') { out.first = _ssResolveUrl(u, base); break; }
      }
    }
    if (out.init && out.first) break;
  }
  return out;
}

/* _ssFetchAndCharge(url) — best-effort CORS fetch of a segment with
   `cache: 'force-cache'`; on success read its size (Content-Length, else clone
   the body and measure arrayBuffer().byteLength) and charge the session prefetch
   budget. Fire-and-forget + fail-soft. */
function _ssFetchAndCharge(url) {
  if (typeof fetch !== 'function' || !url) return Promise.resolve();
  return fetch(url, { cache: 'force-cache' }).then(function (resp) {
    if (!resp || !resp.ok) return;
    var len = 0;
    try {
      var cl = resp.headers && resp.headers.get && resp.headers.get('Content-Length');
      if (cl) len = parseInt(cl, 10) || 0;
    } catch (e) {}
    if (len > 0) { _ssChargePrefetch(len); return; }
    // No Content-Length → measure the body off a clone so the original stays
    // readable for the cache/player.
    return resp.clone().arrayBuffer().then(function (buf) {
      _ssChargePrefetch(buf && buf.byteLength ? buf.byteLength : 0);
    }).catch(function () {});
  }).catch(function () {});
}

/* _ssPrefetchFirstSegment(pid) — CORS-fetch the Mux media playlist for a
   playback id, resolve the first variant's rendition playlist, then prefetch its
   init + first media segment (each charged against the budget). Fire-and-forget;
   any failure falls back to the player's own fetch. */
function _ssPrefetchFirstSegment(pid) {
  if (typeof fetch !== 'function' || !pid) return;
  var base = 'https://stream.mux.com/' + pid + '.m3u8';
  try {
    fetch(base, { cache: 'force-cache' }).then(function (resp) {
      if (!resp || !resp.ok) return;
      return resp.text().then(function (master) {
        var variantUrl = _ssFirstVariantUrl(master, base);
        if (!variantUrl) return;
        return fetch(variantUrl, { cache: 'force-cache' }).then(function (vr) {
          if (!vr || !vr.ok) return;
          return vr.text().then(function (media) {
            var segs = _ssFirstSegmentUrls(media, variantUrl);
            var jobs = [];
            if (segs.init)  jobs.push(_ssFetchAndCharge(segs.init));
            if (segs.first) jobs.push(_ssFetchAndCharge(segs.first));
            return Promise.all(jobs);
          });
        });
      });
    }).catch(function () {});
  } catch (e) {}
}

function ssWarmClips(clips, n) {
  if (!Array.isArray(clips)) return;
  var count = Math.min((n || SS_WARM_AHEAD), clips.length);
  for (var i = 0; i < count; i++) {
    var c = clips[i]; if (!c) continue;
    var pid = c.muxPlaybackId;
    if (pid && !_ssWarmed[pid]) {
      _ssWarmed[pid] = true;
      // Circuit_Breaker engaged → active-only: skip the (budget-charged) video
      // prefetch for the rest of the session (Req 3.3). Posters still warm.
      // Also gated on the SW cache being on (_ssSegPrefetchOn) — without it the
      // prefetched bytes aren't reusable and only starve the active clip's pipe.
      if (!_ssCircuitOpen && _ssSegPrefetchOn()) {
        try { _ssPrefetchFirstSegment(pid); } catch (e) {}
      }
    }
    // Prime the poster image (instant first frame when the clip is reached).
    if (c.poster && typeof Image === 'function') { try { var im = new Image(); im.src = c.poster; } catch (e) {} }
  }
}

/* _connEffectiveType() — read navigator.connection.effectiveType safely
   (clip-player-performance Phase 5, Req 4.1, 4.5). Returns undefined when the
   Network Information API is absent or throws; ssNetworkTier then defaults to
   the 'medium' tier. Impure (reads a global); the classification itself is the
   pure ssNetworkTier. */
function _connEffectiveType() {
  try {
    var c = (typeof navigator !== 'undefined') &&
            (navigator.connection || navigator.mozConnection || navigator.webkitConnection);
    return (c && c.effectiveType) ? c.effectiveType : undefined;
  } catch (e) { return undefined; }
}

/* Network-aware look-ahead + bandwidth discipline (Phase 5, Req 3.4, 4.x, 5.x).
   The active clip ALWAYS wins the pipe: we apply the tier's resolution ceiling
   to the active surface immediately, then defer off-screen warming by a short
   window so the active clip grabs its initial buffer first, and keep a single
   prefetch in flight (gated by the pure ssPreloadAction). Warm depth comes from
   the pure ssNetworkPolicy(ssNetworkTier(...)). */
var _ssWarmInFlight = 0;
var _ssActiveReady  = false;
var _ssWarmTimer    = null;

function _warmNext(activeIdx, host) {
  var isInline = (host === 'INLINE');
  var clips    = isInline ? _inlineClips : _ssvClips;
  var surfaces = isInline ? _inlineSurfaces : _ssvSurfaces;
  var a = (typeof activeIdx === 'number') ? activeIdx : (isInline ? _inlineActiveIdx : _ssvActiveIdx);
  if (!Array.isArray(clips) || a < 0 || a >= clips.length) return;

  var policy = ssNetworkPolicy(ssNetworkTier(_connEffectiveType()));

  // Tier-driven resolution ceiling on the active surface (Req 4.3, 4.4).
  var act = surfaces[a];
  if (act && typeof act.setMaxResolution === 'function') act.setMaxResolution(policy.maxResolution);

  // Active wins the pipe: reset readiness, then warm ahead only after a short
  // window so the active clip buffers first (Req 5.2, 5.4).
  _ssActiveReady = false;
  clearTimeout(_ssWarmTimer);
  _ssWarmTimer = setTimeout(function () {
    _ssActiveReady = true;
    _warmTick(a, clips, policy);
  }, 500);
}

function _warmTick(a, clips, policy) {
  var action = ssPreloadAction({
    activeReady: _ssActiveReady,
    inFlight: _ssWarmInFlight,
    warmed: 0,                       // ssWarmClips de-dupes per pid, so each tick warms the next un-warmed
    preloadDepth: policy.preloadDepth
  });
  if (action !== 'start') return;    // 'pause'/'cancel'/'idle' → leave the pipe to the active clip
  var ahead = clips.slice(a + 1, a + 1 + policy.preloadDepth);
  if (!ahead.length) return;
  _ssWarmInFlight++;                 // single in-flight discipline (Req 5.1)
  ssWarmClips(ahead, policy.preloadDepth);   // de-duped, fire-and-forget
  setTimeout(function () { if (_ssWarmInFlight > 0) _ssWarmInFlight--; }, 600);
}

/* _ssApplyPreloadTiers(host) — impure: assign the pure ssPreloadTier ladder +
   the tier resolution cap to every mounted surface of `host`, relative to the
   active clip (feed-clip-load-performance Phase 1, task 5; Req 1.1/1.4/6.1/6.2/
   3.3/12.4/12.5). The active clip (distance 0) is the ONLY surface set to
   'auto'; clips at distance 1..Prefetch_Depth get 'metadata'; everything else
   (behind the active clip or beyond the tier's depth) gets 'none'. While the
   session Circuit_Breaker is open (_ssCircuitOpen), every NON-active surface is
   forced to 'none' so the session falls back to active-only buffering — the
   active clip stays 'auto'. Tier comes from ssNetworkTier(_connEffectiveType()),
   resolution cap from ssNetworkPolicy(tier). Never throws; gradient surfaces
   no-op through their stub methods. Called at the end of ClipEngine.setActive /
   _inlineSetActive and after _poolRecycle re-points, so the tiers refresh on
   every active-clip change and every pool recycle. */
function _ssApplyPreloadTiers(host) {
  var isInline  = (host === 'INLINE');
  var surfaces  = isInline ? _inlineSurfaces : _ssvSurfaces;
  var activeIdx = isInline ? _inlineActiveIdx : _ssvActiveIdx;
  if (!Array.isArray(surfaces)) return;
  // Kill-switch (founder on-device, no redeploy): tiering OFF → restore the
  // pre-feature behaviour (every mounted surface buffers eagerly).
  if (_ssFeatureOff('tiering')) {
    for (var k = 0; k < surfaces.length; k++) {
      var sk = surfaces[k];
      if (sk && typeof sk.setPreloadTier === 'function') sk.setPreloadTier('auto');
    }
    return;
  }
  var tier   = ssNetworkTier(_connEffectiveType());
  var maxRes = ssNetworkPolicy(tier).maxResolution;
  for (var i = 0; i < surfaces.length; i++) {
    var s = surfaces[i];
    if (!s) continue;
    var distance = i - activeIdx;
    var pt = ssPreloadTier(distance, tier);
    // Circuit_Breaker engaged → active-only buffering for the rest of the
    // session: force every non-active surface to 'none' (the active clip,
    // distance 0, is untouched and stays 'auto') (Req 3.3).
    if (_ssCircuitOpen && distance !== 0) pt = 'none';
    if (typeof s.setPreloadTier === 'function') s.setPreloadTier(pt);
    if (typeof s.setMaxResolution === 'function') s.setMaxResolution(maxRes);
  }
}

/* _ssFeatureOff(name) — runtime kill-switch (feed-clip-load-performance; the
   "guardrail" the founder can flip on-device WITHOUT a redeploy). Returns true
   when the named feature has been disabled by setting localStorage
   `ss_ff_<name>` to the string 'off' (e.g. ss_ff_tiering, ss_ff_deepen,
   ss_ff_coldstart, ss_ff_segcache). Any feature with the flag off falls back to
   the pre-feature behaviour. Fail-soft: missing storage / any error → false
   (feature stays ON). Impure (reads localStorage) so it is window-only. */
function _ssFeatureOff(name) {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return false;
    return localStorage.getItem('ss_ff_' + name) === 'off';
  } catch (e) { return false; }
}

/* _ssSegPrefetchOn() — master gate for the explicit first-segment prefetch
   (warm / progressive deepening / cold-start). These fetches only HELP when the
   SW Segment_Cache is on to make the bytes reusable; with it off they just
   compete with the ACTIVE clip for the limited stream.mux.com connection pool
   (~6/host) and STALL playback as upcoming-clip prefetches pile up. So the whole
   prefetch pipeline is gated on the SAME opt-in flag as the SW cache
   (ss_ff_segcache='on'). Off by default → behaviour matches the website (native
   players + poster warming only). Fail-soft: any error → false (off). */
function _ssSegPrefetchOn() {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return false;
    return localStorage.getItem('ss_ff_segcache') === 'on';
  } catch (e) { return false; }
}

/* ── Progressive-deepening controller (feed-clip-load-performance Phase 2,
   task 11; Req 2.1/2.2/2.4/3.3/3.4/3.6) ───────────────────────────────────
   Impure loop that spends SPARE bandwidth deepening upcoming clips ONLY once
   the active clip's buffer is satisfied — the active clip always wins the pipe.
   A coalesced interval tick reads the active surface's bufferedAhead + dwell,
   then asks the pure ssShouldDeepen(...) per candidate clip (distance 1..depth)
   and, when every gate passes, prefetches that clip's first segment into the
   cache (charging the session byte budget via _ssPrefetchFirstSegment). When the
   Circuit_Breaker is open (_ssCircuitOpen) it stops deepening (and the ladder —
   task 5 — forces non-active preload='none'). Single prefetch per tick keeps a
   single download in flight. Fail-soft: every read is guarded; any error is
   swallowed so playback is never affected. Started from setActive, stopped on
   feed/viewer teardown. */
var SS_DEEPEN_TICK_MS          = 750;                  // coalesced deepening evaluation cadence (ms)
var SS_DEEPEN_SEGMENT_EST_BYTES = 1.5 * 1024 * 1024;   // ~1.5 MB assumed next-segment size for the budget gate
var _ssDeepenTimer = null;
var _ssDeepenHost  = null;

function _ssDeepenTick() {
  try {
    var host = _ssDeepenHost;
    if (!host) return;
    if (_ssCircuitOpen) return;                 // breaker engaged → active-only for the session
    var isInline  = (host === 'INLINE');
    var surfaces  = isInline ? _inlineSurfaces : _ssvSurfaces;
    var clips     = isInline ? _inlineClips    : _ssvClips;
    var activeIdx = isInline ? _inlineActiveIdx : _ssvActiveIdx;
    if (!Array.isArray(surfaces) || !Array.isArray(clips)) return;
    var active = surfaces[activeIdx];
    if (!active) return;

    var ahead = (typeof active.bufferedAhead === 'function') ? active.bufferedAhead() : 0;
    var activeBufferSatisfied = (typeof ahead === 'number') && ahead >= SS_BUFFER_SATISFIED_S;
    if (!activeBufferSatisfied) return;         // active clip not safe yet → defer (never starve it)

    var dwell = (typeof active.getProgress === 'function') ? active.getProgress() : 0;
    var tier  = ssNetworkTier(_connEffectiveType());
    var depth = ssNetworkPolicy(tier).preloadDepth;

    for (var d = 1; d <= depth; d++) {
      var idx = activeIdx + d;
      if (idx >= clips.length) break;           // clamp to clips that exist (graceful degradation)
      var clip = clips[idx];
      var pid  = clip && clip.muxPlaybackId;
      if (!pid || _ssWarmed[pid]) continue;     // skip gradients / already-warmed
      var budgetRemaining = SS_SESSION_BYTE_BUDGET - _ssPrefetchBytes;
      var should = ssShouldDeepen({
        activeBufferSatisfied: activeBufferSatisfied,
        distance: d,
        networkTier: tier,
        budgetRemainingBytes: budgetRemaining,
        nextSegmentBytes: SS_DEEPEN_SEGMENT_EST_BYTES,
        dwell: dwell,
        dwellThreshold: SS_DWELL_THRESHOLD,
        maxDistance: depth
      });
      if (should) {
        _ssWarmed[pid] = true;                  // de-dupe per playback id
        try { _ssPrefetchFirstSegment(pid); } catch (e) {}
        break;                                  // one prefetch per tick (single in-flight)
      }
    }
  } catch (e) { /* never affect playback */ }
}

function _ssStartDeepenController(host) {
  _ssDeepenHost = (host === 'INLINE') ? 'INLINE' : 'FULLSCREEN';
  if (_ssFeatureOff('deepen')) { _ssStopDeepenController(); return; }   // kill-switch
  // Deepening prefetches upcoming segments; those bytes are only reusable when
  // the SW Segment_Cache is on, and otherwise just starve the active clip's
  // stream.mux.com connection pool. Gate on the same opt-in flag.
  if (!_ssSegPrefetchOn()) { _ssStopDeepenController(); return; }
  if (_ssDeepenTimer) return;                   // already running (idempotent across setActive calls)
  if (typeof setInterval !== 'function') return;
  _ssDeepenTimer = setInterval(_ssDeepenTick, SS_DEEPEN_TICK_MS);
}

function _ssStopDeepenController() {
  if (_ssDeepenTimer) { try { clearInterval(_ssDeepenTimer); } catch (e) {} _ssDeepenTimer = null; }
  _ssDeepenHost = null;
}

/* _ssPostSegWindow(host) — tell the service worker the current ordered window of
   Mux playback ids + the active index (feed-clip-load-performance Phase 4, task
   22; Req 4.5). The SW uses this to compute each cached segment's clipDistance
   for window-based + LRU eviction (ssSegmentEvictionPlan). Also carries the
   segment-cache kill-switch: localStorage ss_ff_segcache='off' → tells the SW to
   stop intercepting Mux on-device without a redeploy. Fail-soft; no-op when there
   is no controlling SW. */
function _ssPostSegWindow(host) {
  try {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker || !navigator.serviceWorker.controller) return;
    var ctrl = navigator.serviceWorker.controller;
    // The SW Segment_Cache is OPT-IN (off by default) until its range/206 path
    // is validated on-device — with it off, the PWA delivers Mux exactly like
    // the website (no SW interception). Enable on-device with
    // localStorage ss_ff_segcache='on'.
    var segOn = false;
    try { segOn = (typeof localStorage !== 'undefined' && localStorage) && localStorage.getItem('ss_ff_segcache') === 'on'; } catch (e) { segOn = false; }
    if (!segOn) { ctrl.postMessage({ type: 'SS_SEG_CACHE', enabled: false }); return; }
    ctrl.postMessage({ type: 'SS_SEG_CACHE', enabled: true });
    var isInline  = (host === 'INLINE');
    var clips     = isInline ? _inlineClips : _ssvClips;
    var activeIdx = isInline ? _inlineActiveIdx : _ssvActiveIdx;
    if (!Array.isArray(clips)) return;
    var ids = [];
    for (var i = 0; i < clips.length; i++) ids.push((clips[i] && clips[i].muxPlaybackId) || '');
    ctrl.postMessage({ type: 'SS_SEG_WINDOW', ids: ids, activeIdx: activeIdx });
  } catch (e) { /* best-effort */ }
}

if (typeof window !== 'undefined') {
  window._ssFeatureOff            = _ssFeatureOff;
  window._ssStartDeepenController = _ssStartDeepenController;
  window._ssStopDeepenController  = _ssStopDeepenController;
  window._ssPostSegWindow         = _ssPostSegWindow;
}

if (typeof window !== 'undefined') {
  window.ssReadFeedCache  = ssReadFeedCache;
  window.ssWriteFeedCache = ssWriteFeedCache;
  window.ssFeedListChanged = ssFeedListChanged;
  window.ssWarmClips      = ssWarmClips;
  window.SS_FEED_FRESH_MS = SS_FEED_FRESH_MS;
  window.SS_FEED_CACHE_MAX = SS_FEED_CACHE_MAX;
}
if (typeof window !== 'undefined') {
  window.ssLoadClipWindow = ssLoadClipWindow;
  window.loadNextWindow   = loadNextWindow;
  window.ssStartFeedPager = ssStartFeedPager;
}

/* Bind one-shot first-interaction listeners (tap/scroll/key). The first one to
   fire clears the inline muted-autoplay lock and applies the persisted
   Mute_Preference to the active surface (Req 4.3). Returns a cleanup fn. */
function _inlineBindFirstInteraction(container) {
  function clear() {
    detach();
    if (_ssAudioUnlocked) return;
    ssMarkAudioUnlocked();   // session unlock (shared across both hosts)
    const surface = _inlineSurfaces[_inlineActiveIdx];
    if (surface) surface.setMuted(ssResolveSurfaceMuted(true, ssGetMutePref()));
    if (typeof _inlinePaintMuteBtns === 'function') _inlinePaintMuteBtns();
  }
  function detach() {
    container.removeEventListener('scroll', clear);
    container.removeEventListener('pointerdown', clear);
    document.removeEventListener('keydown', clear);
  }
  container.addEventListener('scroll', clear, { passive: true });
  container.addEventListener('pointerdown', clear);
  document.addEventListener('keydown', clear);
  return detach;
}

/* INLINE keyboard nav — ArrowDown/j → next, ArrowUp/k → previous (moved off
   the Feed into the engine). */
function _inlineKeydown(e) {
  if (e.key === 'ArrowDown' || e.key === 'j') _inlineNavigate(1);
  if (e.key === 'ArrowUp'   || e.key === 'k') _inlineNavigate(-1);
}

/* Navigate the inline Feed by `dir` (±1). Backs the Feed's #nav-arrows. */
function _inlineNavigate(dir) {
  if (!_inlineClips.length) return;
  const newIdx = _inlineActiveIdx + dir;
  if (newIdx < 0 || newIdx >= _inlineClips.length) return;
  document.getElementById(`clip-${newIdx}`)?.scrollIntoView({ behavior: 'smooth' });
}

/* Position the fixed desktop rail just right of the clip column (load + resize),
   bringing the Feed's positionRail behavior into the engine. */
function _inlinePositionRail() {
  const col  = document.getElementById('clip-column');
  const rail = document.getElementById('action-rail');
  if (!col || !rail) return;
  const rect = col.getBoundingClientRect();
  rail.style.left = (rect.right + 16) + 'px';
}

/* Replay the desktop rail's entrance animation. */
function _inlineAnimateRailIn() {
  const rail = document.getElementById('action-rail');
  if (!rail) return;
  rail.classList.remove('entering'); void rail.offsetWidth; rail.classList.add('entering');
  rail.addEventListener('animationend', () => rail.classList.remove('entering'), { once: true });
}

/* ── Render one clip ──────────────────────────────
   Mode-aware: `mode` is 'INLINE' | 'FULLSCREEN' (default FULLSCREEN). It
   selects the class set; FULLSCREEN preserves the existing .ssv-feed/.ssv-rail
   layout and ids. The clip body renders a Media_Surface mount point
   (`.ssv-media`, the surface attaches its gradient/<video> node here) and a
   Progress_Bar container is added in JS via ssMakeProgressBar after render —
   no hardcoded gradient div. `clip.title` and view/follower counts are never
   rendered on the clip body (title is revealed only in the Watch It sheet). */
function _ssvClipHTML(c, i, mode) {
  const m = (mode === 'INLINE') ? 'INLINE' : 'FULLSCREEN';
  // Class set per mode. FULLSCREEN keeps every existing ssv-* class + id so the
  // immersion layer is byte-for-byte unchanged; INLINE adds a modifier hook.
  const rootCls = m === 'INLINE' ? 'ssv-clip ssv-clip--inline' : 'ssv-clip';
  const fired = _ssvFired.has(i);
  const tags = [...(c.genre || []), c.lang].filter(Boolean)
    .map(t => `<span class="tag">${t}</span>`).join('');
  const caption = c.caption || `A pick from <em>@${c.creator.name}</em>`;
  // Poster-first frame so an un-mounted clip (outside the bounded player band)
  // shows the Mux thumbnail instead of black while you scroll to it.
  const mediaStyle = c.poster
    ? ` style="background-image:url('${String(c.poster).replace(/'/g, '%27')}');background-size:cover;background-position:center;background-color:#000;"`
    : (c.bg ? ` style="background:${c.bg}"` : '');
  return `
    <div class="${rootCls}" id="ssv-clip-${i}" data-ssv-idx="${i}">
      <div class="ssv-media" id="ssv-media-${i}"${mediaStyle}></div>
      <div class="ssv-vig"></div>

      <div class="ssv-tap" id="ssv-tap-${i}"></div>
      <div class="ssv-pause-icon" id="ssv-pause-icon-${i}">
        <svg class="ssv-pi-pause" width="30" height="30" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        <svg class="ssv-pi-play" width="32" height="32" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
      </div>
      <div class="ssv-burst" id="ssv-burst-${i}">
        <svg width="110" height="110" viewBox="0 0 24 24" fill="#EA3B32"><path d="M12 2C12 2 8 6.5 8 10a4 4 0 0 0 8 0c0-1.5-.8-3-1.5-4C13.8 7.5 14 9 13 10c-.5.5-1 .8-1 .8S10 9.5 10 8c0-2 2-6 2-6z"/><path d="M12 14c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4z"/></svg>
      </div>

      <div class="ssv-rail">
        <div class="ssv-act ssv-fire ${fired ? 'lit' : ''}" id="ssv-fire-${i}" onclick="event.stopPropagation(); ClipEngine.fire(${i})">
          <div class="ssv-ico">${_SSV_FIRE_OUT}${_SSV_FIRE_FILL}</div>
          <span class="ssv-lbl" id="ssv-fire-count-${i}">${fmtFires(c.fires + (fired ? 1 : 0))}</span>
        </div>
        <div class="ssv-act ssv-save" data-save-id="${c.id}" onclick="event.stopPropagation(); ssToggleSave(_ssvClips[${i}], this)">
          <div class="ssv-ico">${_SSV_SAVE_OUT}${_SSV_SAVE_FILL}</div>
          <span class="ssv-lbl">Save</span>
        </div>
        <div class="ssv-act" onclick="ssShare(_ssvClips[${i}])">
          <div class="ssv-ico">${_SSV_SHARE}</div>
          <span class="ssv-lbl">Share</span>
        </div>
      </div>

      <div class="ssv-bottom">
        <div class="ssv-creator-row">
          <div class="ssv-avatar" style="background:${c.creator.bg}" data-curator="${c.creator.name}" data-curator-name="${c.creator.name}" data-curator-letter="${c.creator.letter}" data-curator-bg="${c.creator.bg}">${_ssAvatarInner(c.creator)}</div>
          <span class="ssv-handle" data-curator="${c.creator.name}" data-curator-name="${c.creator.name}" data-curator-letter="${c.creator.letter}" data-curator-bg="${c.creator.bg}">@${c.creator.name}</span>
          <span class="ssv-follow" data-follow="${c.creator.name}" data-follow-plus data-follow-name="${c.creator.name}" data-follow-letter="${c.creator.letter}" data-follow-bg="${c.creator.bg}">+ Follow</span>
        </div>
        <div class="ssv-tags">${tags}</div>
        <div class="ssv-caption">${caption}</div>
      </div>

      <button class="ssv-watch" style="background:rgba(255,99,45,0.26); --ssv-rgb:234,59,50" onclick="ssOpenSheet(_ssvClips[${i}])">
        <div class="ssv-watch-inner">
          <div class="ssv-watch-text">
            <span class="ssv-watch-main">Watch It</span>
          </div>
          <div class="ssv-watch-arrow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </div>
        </div>
      </button>
    </div>
  `;
}

/* ── Open the viewer ────────────────────────────── */
function ssOpenClip(clipOrId, list) {
  // Allow passing an id when a list is provided
  let clicked = clipOrId;
  if ((typeof clipOrId === 'number' || typeof clipOrId === 'string') && Array.isArray(list)) {
    clicked = list.find(c => String(c.id) === String(clipOrId));
  }
  if (!clicked) return;

  // Ordering goes ONLY through the Recommendation_Seam (swap its body later
  // for a recommendation feed without touching engine code).
  _ssvClips = ssClipOrdering(clicked, list);
  _ssvFired = new Set();

  const feed = document.getElementById('ssv-feed');
  if (!feed) return;

  // Tear down any surfaces from a previous open (no timer leaks).
  _ssvSurfaces.forEach(s => { try { s.destroy(); } catch (e) {} });
  _ssvSurfaces = [];
  _ssvBars = [];
  _ssvActiveIdx = -1;

  feed.innerHTML = _ssvClips.map((c, i) => _ssvClipHTML(c, i, 'FULLSCREEN')).join('');

  // BOUNDED PLAYERS: mount only a small band of Media_Surfaces around the
  // active clip (not all of them) — mounting every <mux-player> at once made
  // them all buffer in parallel and saturated the network (black screens /
  // audio-without-video / everything slow). _ssvPruneSurfaces mounts the band
  // and the scroll observer slides it. Frames outside the band show their
  // poster (set in _ssvClipHTML), so nothing is ever blank.
  _ssvPruneSurfaces(0);

  // Lock background scroll
  _ssvPrevScroll = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  // Pause + mute the inline feed behind the viewer. Otherwise BOTH players run
  // for the same clip — double audio, double buffering, and they fight for
  // bandwidth, which is what made the viewer visibly "load again" on open.
  // Freeing the network lets the viewer's player start fast (same playback id =
  // segments already in the HTTP cache). Resumed in _ssvTeardownViewer.
  try { _inlineSurfaces.forEach(s => { if (s) { try { s.setMuted(true); s.pause(); } catch (e) {} } }); } catch (e) {}

  const viewer = document.getElementById('ss-clip-viewer');
  viewer.classList.add('open');

  // First clip active + observer for the rest
  feed.scrollTop = 0;
  _ssvSetupObserver(feed);
  document.getElementById('ssv-clip-0')?.classList.add('active');
  // FULLSCREEN opens are gesture-initiated → mark the session Audio_Unlock so
  // the first clip can play with sound and later scrolls skip the mute dance.
  ssMarkAudioUnlocked();
  _ssvPaintMuteBtn(ssGetMutePref());
  ClipEngine.setActive(0, 'FULLSCREEN');
  ssSyncAllSaveBtns();
  ssWireFollowButtons(feed);   // make in-viewer Follow buttons real + synced
  ssWireCuratorLinks(feed);    // tap curator name/avatar -> their profile

  // Push a history entry so the mobile back-swipe (and the browser/
  // Android back button) CLOSES the viewer instead of navigating away
  // from the page. The popstate handler below does the actual close.
  if (!_ssvHistoryActive) {
    history.pushState({ ssvViewer: true }, '');
    _ssvHistoryActive = true;
  }

  document.addEventListener('keydown', _ssvKeydown);
  _ssvAttachSwipe(feed);
}

/* ── Swipe-anywhere to go back (Instagram-style) ──────────────────
   A rightward horizontal drag from ANYWHERE on the clip slides the
   viewer with the finger and closes it past a threshold. Vertical
   drags are left alone so the normal clip scroll still works — we
   lock to whichever axis the finger commits to first. */
function _ssvAttachSwipe(feed) {
  let startX = 0, startY = 0, dx = 0, dy = 0;
  let axis = null;            // null | 'h' | 'v' — locked after first move
  let tracking = false;

  const reset = (animate) => {
    feed.classList.toggle('ssv-snap', !!animate);
    feed.style.transform = '';
    if (animate) setTimeout(() => feed.classList.remove('ssv-snap'), 320);
  };

  feed.ontouchstart = (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dx = dy = 0; axis = null; tracking = true;
    feed.classList.remove('ssv-snap');
  };

  feed.ontouchmove = (e) => {
    if (!tracking) return;
    dx = e.touches[0].clientX - startX;
    dy = e.touches[0].clientY - startY;

    // Decide the gesture axis once the finger has clearly committed.
    if (!axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    }
    if (axis !== 'h') return;            // vertical → let the feed scroll

    // Only track rightward drags (going back); clamp left at 0.
    const slide = Math.max(0, dx);
    feed.style.transform = `translateX(${slide}px)`;
    // Fade the backdrop a touch as it slides for depth.
    const viewer = document.getElementById('ss-clip-viewer');
    if (viewer) viewer.style.opacity = String(Math.max(0.35, 1 - slide / 600));
    e.preventDefault();                  // stop the page/native gesture fighting us
  };

  feed.ontouchend = () => {
    if (!tracking) return;
    tracking = false;
    const viewer = document.getElementById('ss-clip-viewer');
    const width = feed.offsetWidth || window.innerWidth;
    // Close if dragged past ~32% of the width OR a confident flick.
    if (axis === 'h' && dx > Math.min(140, width * 0.32)) {
      // Fly the viewer out to the right, then close.
      feed.classList.add('ssv-snap');
      feed.style.transform = `translateX(${width}px)`;
      if (viewer) viewer.style.opacity = '0';
      setTimeout(() => { if (viewer) viewer.style.opacity = ''; ssCloseClip(); }, 230);
    } else {
      // Snap back.
      if (viewer) viewer.style.opacity = '';
      reset(true);
    }
  };
}

// User-initiated close (close button, Escape, Watch It nav, etc.).
// If we pushed a history entry, pop it — that triggers popstate, which
// runs the real teardown. Otherwise tear down directly.
function ssCloseClip() {
  if (_ssvHistoryActive) {
    history.back();           // → fires popstate → _ssvOnPopState → teardown
  } else {
    _ssvTeardownViewer();
  }
}

// The actual close/teardown. Never touches history (so it's safe to call
// from the popstate handler after the entry has already been popped).
function _ssvTeardownViewer() {
  // Cancel any pending dwell-view so a clip the viewer was leaving never records.
  _ssCancelViewDwell();
  _ssStopDeepenController();   // stop progressive deepening when the viewer closes
  const viewer = document.getElementById('ss-clip-viewer');
  if (viewer) { viewer.classList.remove('open'); viewer.style.opacity = ''; }
  const feed = document.getElementById('ssv-feed');
  if (feed) {
    feed.style.transform = '';
    feed.classList.remove('ssv-snap');
    feed.ontouchstart = feed.ontouchmove = feed.ontouchend = null;
  }
  document.body.style.overflow = _ssvPrevScroll || '';
  if (_ssvObserver) { _ssvObserver.disconnect(); _ssvObserver = null; }
  document.removeEventListener('keydown', _ssvKeydown);
  // Destroy every Media_Surface so its rAF/timer is cancelled (no leaks).
  _ssvSurfaces.forEach(s => { try { s.destroy(); } catch (e) {} });
  _ssvSurfaces = [];
  _ssvBars = [];
  _ssvActiveIdx = -1;
  // Resume the inline feed behind us where it left off (paused on open). By now
  // a gesture has occurred (the viewer was opened by one), so use the
  // unlock-aware path when unlocked to avoid the mute→unmute dance.
  try {
    if (typeof _inlineActiveIdx === 'number' && _inlineActiveIdx >= 0 && _inlineSurfaces[_inlineActiveIdx]) {
      if (_ssAudioUnlocked) _activatePostUnlock(null, _inlineSurfaces[_inlineActiveIdx]);
      else _ssActivateSurface(_inlineSurfaces[_inlineActiveIdx], _ssvResolveMuted('INLINE'));
    }
  } catch (e) {}
  // Re-sync any save buttons on the underlying page
  setTimeout(ssSyncAllSaveBtns, 50);
}

// Back gesture / back button → close the viewer if it's open.
function _ssvOnPopState() {
  const viewer = document.getElementById('ss-clip-viewer');
  if (viewer && viewer.classList.contains('open')) {
    _ssvHistoryActive = false;   // our entry is already gone (it was popped)

    // Tell any PAGE-LEVEL popstate handler (e.g. Discover's search-results
    // view) that THIS back press was already consumed by closing the clip
    // viewer — so it must NOT also act on the same event. Without this,
    // one back press both closes the viewer AND collapses the results view,
    // dumping the user on the default Discover page instead of the results
    // list. We register first (shared.js loads before page scripts), so the
    // flag is set before the page handler reads it; clear it next tick so a
    // SUBSEQUENT back (results → default) still works normally.
    window._ssvHandledPop = true;
    setTimeout(() => { window._ssvHandledPop = false; }, 0);

    _ssvTeardownViewer();
  }
}
window.addEventListener('popstate', _ssvOnPopState);

function _ssvKeydown(e) {
  if (e.key === 'Escape') ssCloseClip();
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const feed = document.getElementById('ssv-feed');
    if (!feed) return;
    const active = feed.querySelector('.ssv-clip.active');
    const idx = active ? parseInt(active.dataset.ssvIdx) : 0;
    const next = e.key === 'ArrowDown' ? idx + 1 : idx - 1;
    document.getElementById(`ssv-clip-${next}`)?.scrollIntoView({ behavior: 'smooth' });
  }
}

/* _ssvWireClip(i) — (re)build the FULLSCREEN viewer's Media_Surface for clip i,
   attach its Progress_Bar, and bind the unified gesture handler once. Mirror of
   the inline _inlineWireClip; idempotent so a clip re-entering the mounted band
   reuses its bar and binds gestures only once. Contract-only. */
function _ssvWireClip(i) {
  const mediaEl = document.getElementById(`ssv-media-${i}`);
  const clipEl  = document.getElementById(`ssv-clip-${i}`);
  if (!mediaEl || !clipEl) return;
  if (_ssvSurfaces[i]) { try { _ssvSurfaces[i].destroy(); } catch (e) {} }
  const surface = ssCreateSurface(_ssvClips[i], { bgClass: 'ssv-bg' });
  surface.mount(mediaEl);
  const bar = _ssvBars[i] || ssMakeProgressBar(clipEl);
  surface.onTimeupdate(p => bar.set(p));
  // Keep the mute icon in sync with the clip's REAL muted state (not just the
  // saved preference): repaint whenever THIS surface's effective muted state
  // changes (incl. a browser-forced autoplay mute), but only while it's active.
  if (typeof surface.onMutedChange === 'function') {
    surface.onMutedChange(function (m) { if (i === _ssvActiveIdx) _ssvPaintMuteBtn(m); });
  }
  _ssvSurfaces[i] = surface;
  _ssvBars[i] = bar;
  const tapZone = document.getElementById(`ssv-tap-${i}`);
  if (tapZone && !tapZone.dataset.ssvTapBound) {
    tapZone.dataset.ssvTapBound = '1';
    ssAttachGestures(tapZone, i, ClipEngine);
  }
}

/* _poolRecycle(activeIdx, host) — the Player_Pool recycler (clip-player-
   performance Phase 3, Req 2.x, 9.6). Replaces destroy-and-recreate pruning:
   it keeps in-band surfaces untouched, and for clips ENTERING the band it
   RE-POINTS a surface freed by a clip LEAVING the band (no destroy/recreate)
   so scroll-back is instant and element churn/jank is avoided. Re-point is
   like-for-like by surface type (video→video, gradient→gradient); anything it
   can't cleanly reuse (type change, or more entering than freed at the feed
   ends) falls back to a fresh mount / bounded destroy — so the Feed can never
   end up in a worse state than the previous prune. host = 'INLINE' | 'FULLSCREEN'
   selects the per-host state arrays + DOM id scheme; behavior is identical
   across both through the single engine (Req 2.7, 10.1). */
function _poolRecycle(activeIdx, host) {
  var isInline = (host === 'INLINE');
  var clips    = isInline ? _inlineClips    : _ssvClips;
  var surfaces = isInline ? _inlineSurfaces : _ssvSurfaces;
  var bars     = isInline ? _inlineBars     : _ssvBars;
  var a = (activeIdx == null) ? (isInline ? _inlineActiveIdx : _ssvActiveIdx) : activeIdx;

  var band = ssMountedPlayerSet(a, clips.length, SS_MAX_LIVE_PLAYERS);
  var bandSet = new Set(band);

  // Current mounted clip indices.
  var mounted = [];
  for (var i = 0; i < surfaces.length; i++) if (surfaces[i]) mounted.push(i);

  var entering = band.filter(function (idx) { return !surfaces[idx]; });
  var leaving  = mounted.filter(function (idx) { return !bandSet.has(idx); });

  // Detach leaving surfaces (DO NOT destroy) into reuse queues split by type.
  var reuseVideo = [], reuseGradient = [];
  leaving.forEach(function (li) {
    var s = surfaces[li];
    surfaces[li] = null;
    if (!s) return;
    try { s.pause(); } catch (e) {}
    if (s._ssIsVideo) reuseVideo.push(s); else reuseGradient.push(s);
  });

  // Re-point / mount each entering clip onto a reused or fresh surface.
  entering.forEach(function (ei) {
    var clip    = clips[ei];
    var mediaEl = document.getElementById((isInline ? 'clip-media-' : 'ssv-media-') + ei);
    var frameEl = document.getElementById((isInline ? 'clip-' : 'ssv-clip-') + ei);
    if (!clip || !mediaEl || !frameEl) return;
    var wantVideo = !!clip.muxPlaybackId;
    var queue = wantVideo ? reuseVideo : reuseGradient;
    var surf = queue.shift();
    if (surf && typeof surf.repoint === 'function') {
      surf.repoint(clip, mediaEl);          // REUSE existing element — no churn
    } else {
      surf = ssCreateSurface(clip, { bgClass: isInline ? 'clip-bg' : 'ssv-bg' });
      surf.mount(mediaEl);                  // fail-safe: fresh mount
    }
    var bar = bars[ei] || ssMakeProgressBar(frameEl);
    surf.onTimeupdate(function (p) { bar.set(p); });
    bars[ei] = bar;
    if (!isInline && typeof surf.onMutedChange === 'function') {
      surf.onMutedChange(function (m) { if (ei === _ssvActiveIdx) _ssvPaintMuteBtn(m); });
    } else if (isInline && typeof surf.onMutedChange === 'function') {
      surf.onMutedChange(function (m) { if (ei === _inlineActiveIdx) _inlinePaintMuteBtns(); });
    }
    if (isInline && typeof surf.onPlayState === 'function') {
      surf.onPlayState(function (playing) { _inlineReflectStall(ei, playing); });
    }
    var tapZone = document.getElementById((isInline ? 'tap-' : 'ssv-tap-') + ei);
    if (tapZone) {
      if (isInline && !tapZone.dataset.ssTapBound) {
        tapZone.dataset.ssTapBound = '1';
        tapZone.addEventListener('click', function () { ssOpenClip(_inlineClips[ei], _inlineClips); });
      } else if (!isInline && !tapZone.dataset.ssvTapBound) {
        tapZone.dataset.ssvTapBound = '1';
        ssAttachGestures(tapZone, ei, ClipEngine);
      }
    }
    surfaces[ei] = surf;
  });

  // Leftover reusable surfaces (band shrank at the feed ends → more leaving than
  // entering) are destroyed to stay bounded. During steady scroll entering ==
  // leaving, so this destroys nothing (Req 2.6).
  reuseVideo.forEach(function (s) { try { s.destroy(); } catch (e) {} });
  reuseGradient.forEach(function (s) { try { s.destroy(); } catch (e) {} });

  // Re-point changed which clips are mounted around the active one, so refresh
  // the preload ladder + resolution cap for the new band (only the active clip
  // is 'auto'; circuit-open forces non-active to 'none').
  _ssApplyPreloadTiers(host);
}

/* _ssvPruneSurfaces(activeIdx) — FULLSCREEN host entry point, now delegating to
   the shared Player_Pool recycler (kept as a named wrapper so existing callers
   are unchanged). */
function _ssvPruneSurfaces(activeIdx) {
  _poolRecycle(activeIdx, 'FULLSCREEN');
}

function _ssvSetupObserver(feed) {
  if (_ssvObserver) _ssvObserver.disconnect();
  _ssvObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        feed.querySelectorAll('.ssv-clip.active').forEach(el => el.classList.remove('active'));
        entry.target.classList.add('active');
        // Drive engine playback: pause the previous surface, play this one
        // with the resolved Mute_Preference. (FULLSCREEN host.)
        const idx = parseInt(entry.target.dataset.ssvIdx, 10);
        if (!isNaN(idx)) {
          _ssvPruneSurfaces(idx);   // mount the band around the new active, drop the rest
          ClipEngine.setActive(idx, 'FULLSCREEN');
        }
      }
    });
  }, { root: feed, threshold: 0.6 });
  feed.querySelectorAll('.ssv-clip').forEach(c => _ssvObserver.observe(c));
}

/* ── Fire toggle inside the viewer ──────────────── */
/* (Removed) _ssvToggleFire + _ssvFireOn are now the single ClipEngine.fire
   definition above; the rail flame and double-tap both call ClipEngine.fire. */



/* ════════════════════════════════════════════════
   ── GUEST GATE (try-before-signup funnel) ───────
   Lets a brand-new visitor FEEL the app — scroll the feed, open
   clips, even Watch It & Share — then prompts sign-up at the first
   real commitment (Fire / Save / Follow) OR after they've watched a
   handful of clips. This is the "guest-first" funnel from
   backend-architecture.md.

   SWAP-READY (our scaling rule): today sign-up is mocked locally
   (sets a sessionStorage flag, like index.html's mocked auth). When
   real Supabase auth lands, ONLY the body of _ssGuestDoSignup() and
   ssIsSignedUp() change — every page and every reaction button stays
   exactly as-is. The app never talks to auth directly; it talks to
   this gate.

   WHAT IS GATED (a guest is stopped + prompted on):
     • Fire   (feed #rail-lit, viewer .ssv-fire)
     • Save   (any [data-save-id])
     • Follow (any [data-follow])
   WHAT STAYS FREE (so they feel the magic): browsing/scrolling,
   opening clips, Watch It, Share.

   VIEW TRIGGER: after SS_GUEST_VIEW_LIMIT clips become active, the
   sheet appears once (soft prompt; dismissable).
════════════════════════════════════════════════ */
(function ssGuestGate() {
  'use strict';

  const SIGNED_UP_KEY = 'ss_signed_up_v1';   // sessionStorage: legacy/onboarding flag
  const PROFILE_KEY   = 'ss_user_profile_v1'; // localStorage: set by index onboarding
  const VIEW_LIMIT    = 6;                     // clips before the soft prompt

  let _viewedClips     = 0;
  let _viewPromptShown = false;   // soft view-prompt fires only once
  let _lastActiveId    = null;    // de-dupe consecutive active toggles

  /* ── Live Supabase session (cached so ssIsSignedUp() can be sync) ──
     getSession() is async, but our click-gate needs an instant yes/no.
     So we cache the session here and keep it fresh via onAuthStateChange. */
  let _ssSession = null;

  if (window.ssDB && window.ssDB.auth) {
    // Initial read (async) — paints buttons correctly once it resolves.
    window.ssDB.auth.getSession().then(({ data }) => {
      _ssSession = data && data.session ? data.session : null;
      _ssWriteLastUid(_ssSession && _ssSession.user ? _ssSession.user.id : null);
      if (typeof ssSyncAuthChrome === 'function') ssSyncAuthChrome();
      if (_ssSession && typeof _ssRepaintAllFollowButtons === 'function') _ssRepaintAllFollowButtons();
      if (typeof ssSyncAllSaveBtns === 'function') ssSyncAllSaveBtns();
      if (_ssSession && typeof ssHydrateStacks === 'function') ssHydrateStacks();
      if (_ssSession && typeof ssHydrateFollowing === 'function') ssHydrateFollowing();
      // Warm the own-profile cache + avatar once the session is known.
      if (_ssSession && typeof ssPrewarmProfile === 'function') ssPrewarmProfile();
    }).catch(() => {});
    // Live updates: login, logout, token refresh, OAuth redirect return.
    window.ssDB.auth.onAuthStateChange((_event, session) => {
      const wasLoggedOut = !_ssSession;
      _ssSession = session || null;
      _ssWriteLastUid(_ssSession && _ssSession.user ? _ssSession.user.id : null);
      // Watch It region + subscription caches must re-resolve after any
      // sign-in / sign-out / token change.
      _ssRegion = null; _ssSubIds = null;
      if (typeof ssSyncAuthChrome === 'function') ssSyncAuthChrome();
      if (session) {
        _ssCloseSignupSheet();
        // Only react on a genuine new login (not token refreshes on every page).
        if (wasLoggedOut) _ssAfterLogin();
      }
      if (typeof _ssRepaintAllFollowButtons === 'function') _ssRepaintAllFollowButtons();
      if (typeof ssSyncAllSaveBtns === 'function') ssSyncAllSaveBtns();
    });
  } else {
    console.warn('ShowShak: Supabase not loaded — auth gate falls back to local flag.');
  }

  /* ── Signed-up check (now reads the REAL Supabase session) ──
     Order: live Supabase session → legacy onboarding/local flag.
     The local fallback keeps index.html's onboarding users un-gated
     until they're migrated to real accounts. */
  function ssIsSignedUp() {
    if (_ssSession) return true;                                       // a REAL Supabase session
    try {
      if (sessionStorage.getItem(SIGNED_UP_KEY) === '1') return true;  // explicit post-login flag
      // NOTE: the index.html onboarding prefs (PROFILE_KEY) are intentionally
      // NO LONGER treated as "signed up" — they're just saved taste picks. Only a
      // real Supabase session (or the explicit flag above) counts. This is what
      // makes the guest gate fire on Fire/Save/Follow and lets the landing page
      // hand off to REAL auth instead of faking a login. (Was the root-cause bug.)
    } catch (e) {}
    return false;
  }
  window.ssIsSignedUp = ssIsSignedUp;

  /* ── Current user helper (for pages that need the profile) ── */
  window.ssCurrentUser = function () { return _ssSession ? _ssSession.user : null; };

  /* ── Real sign-up / sign-in ──
     'google' / 'apple' → OAuth redirect (returns to this same page).
     'email'            → email + password via a tiny inline flow. */
  function _ssGuestDoSignup(method) {
    if (!window.ssDB || !window.ssDB.auth) {
      // Hard fallback (e.g. offline prototype): flip the local flag.
      try { sessionStorage.setItem(SIGNED_UP_KEY, '1'); } catch (e) {}
      _ssCloseSignupSheet();
      if (typeof ssToast === 'function') ssToast('🎉 Welcome to ShowShak');
      return;
    }

    if (method === 'google' || method === 'apple') {
      window.ssDB.auth.signInWithOAuth({
        provider: method,
        options: { redirectTo: window.location.href }   // come right back here
      }).then(({ error }) => {
        if (error) {
          // Most common cause: provider not enabled yet in the dashboard.
          if (typeof ssToast === 'function') ssToast('Sign-in unavailable — try Email');
          console.error('ShowShak OAuth error:', error.message);
        }
      });
      return;
    }

    if (method === 'email') {
      _ssShowEmailForm();
      return;
    }
  }
  window.ssGuestSignup = _ssGuestDoSignup;

  /* ── Sign out (used by Settings later) ── */
  window.ssSignOut = function () {
    if (window.ssDB && window.ssDB.auth) {
      window.ssDB.auth.signOut().then(() => {
        // Clear ALL per-user local caches so a signed-out user doesn't keep
        // seeing the previous user's stacks/following. The DB is the source
        // of truth; these are rebuilt on next login via hydrate.
        try {
          sessionStorage.removeItem(SIGNED_UP_KEY);
          sessionStorage.removeItem('ss_stacks_v1');
          sessionStorage.removeItem('ss_following_v1');
          sessionStorage.removeItem('ss_view_curator_v1');
          sessionStorage.removeItem('ss_reactchk');   // re-check reactivation on next sign-in
          if (typeof ssClearMyProfileCache === 'function') ssClearMyProfileCache();   // drop cached identity
          _ssWriteLastUid(null);   // forget the per-user cache key on sign-out
        } catch (e) {}
        if (typeof _ssNotifyStacksChange === 'function') _ssNotifyStacksChange();
        if (typeof ssToast === 'function') ssToast('Signed out');
      });
    }
  };

  /* ── Inject sheet CSS once ── */
  (function _css() {
    const s = document.createElement('style');
    s.id = 'ss-signup-sheet-style';
    s.textContent = `
      #ss-signup-overlay {
        position: fixed; inset: 0; z-index: 600;
        background: rgba(0,0,0,0.7);
        backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
      }
      #ss-signup-overlay.open { opacity: 1; pointer-events: all; }
      #ss-signup-sheet {
        position: fixed; left: 50%; bottom: 0;
        transform: translateX(-50%) translateY(100%);
        z-index: 601; width: min(440px, 100vw);
        background: #13131A; border-top: 1px solid rgba(255,255,255,0.08);
        border-radius: 26px 26px 0 0; padding: 0 22px 30px;
        transition: transform 0.42s cubic-bezier(.4,0,.2,1);
        text-align: center;
      }
      #ss-signup-sheet.open { transform: translateX(-50%) translateY(0); }
      .ss-su-handle { width: 38px; height: 4px; background: rgba(255,255,255,0.12);
        border-radius: 2px; margin: 14px auto 22px; }
      .ss-su-mark { width: 52px; height: 52px; margin: 0 auto 16px; border-radius: 14px;
        display:flex; align-items:center; justify-content:center; }
      .ss-su-mark svg { width: 52px; height: 52px; }
      .ss-su-title { font-family: 'Bebas Neue', sans-serif; font-size: 27px;
        letter-spacing: 1px; color: #fff; line-height: 1.05; margin-bottom: 8px; }
      .ss-su-title em { color: #EA3B32; font-style: normal; }
      .ss-su-sub { font-size: 13.5px; color: #9a9aac; line-height: 1.5;
        margin: 0 auto 22px; max-width: 320px; }
      .ss-su-btn {
        display: flex; align-items: center; justify-content: center; gap: 10px;
        width: 100%; height: 50px; border-radius: 14px; margin-bottom: 10px;
        font-family: 'DM Sans', sans-serif; font-size: 14.5px; font-weight: 700;
        cursor: pointer; border: 1px solid rgba(255,255,255,0.1);
        background: #1F1F2B; color: #fff; transition: background 0.15s, transform 0.1s;
        -webkit-tap-highlight-color: transparent;
      }
      .ss-su-btn:hover { background: #26263444; }
      .ss-su-btn:active { transform: scale(0.985); }
      .ss-su-btn.primary { background: #EA3B32; border-color: #EA3B32; }
      .ss-su-btn.primary:hover { background: #FF4D42; }
      .ss-su-btn:disabled { opacity: 0.6; cursor: default; }
      .ss-su-input {
        width: 100%; height: 48px; margin-bottom: 10px; padding: 0 16px;
        background: #1A1A24; border: 1px solid rgba(255,255,255,0.1);
        border-radius: 13px; color: #fff; font-family: 'DM Sans', sans-serif;
        font-size: 15px; outline: none; transition: border-color 0.15s;
      }
      .ss-su-input:focus { border-color: rgba(234,59,50,0.6); }
      .ss-su-input::placeholder { color: #5A5A72; }
      .ss-su-msg { font-size: 12.5px; color: #ff7a70; min-height: 16px;
        margin: 2px 0 10px; text-align: left; }
      .ss-su-later { margin-top: 10px; padding: 10px; font-size: 13px;
        color: #6b6b7a; font-weight: 600; cursor: pointer;
        -webkit-tap-highlight-color: transparent; }
      .ss-su-later:hover { color: #9a9aac; }
    `;
    document.head.appendChild(s);
  })();

  /* ── Inject sheet HTML once ── */
  function _ensureSheet() {
    if (document.getElementById('ss-signup-overlay')) return;
    const ov = document.createElement('div');
    ov.id = 'ss-signup-overlay';
    ov.addEventListener('click', (e) => { if (e.target === ov) _ssCloseSignupSheet(); });
    ov.innerHTML = `
      <div id="ss-signup-sheet" role="dialog" aria-label="Sign up to ShowShak">
        <div class="ss-su-handle"></div>
        <div class="ss-su-mark"><svg viewBox="0 0 1254 1254"><use href="#ss-mark"/></svg></div>
        <div class="ss-su-title" id="ss-su-title">KEEP WHAT YOU <em>LOVE</em></div>
        <div class="ss-su-sub" id="ss-su-sub">Sign up to fire clips, save to your Watchlist, and follow the curators whose taste you trust.</div>
        <button class="ss-su-btn primary" onclick="ssGuestSignup('google')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M21.35 11.1H12v2.8h5.35c-.25 1.5-1.7 4.4-5.35 4.4-3.2 0-5.8-2.65-5.8-5.9s2.6-5.9 5.8-5.9c1.8 0 3 .77 3.7 1.43l2.5-2.42C16.7 3.6 14.6 2.7 12 2.7 6.9 2.7 2.8 6.8 2.8 12s4.1 9.3 9.2 9.3c5.3 0 8.8-3.73 8.8-8.98 0-.6-.07-1.07-.15-1.52z"/></svg>
          Continue with Google
        </button>
        <button class="ss-su-btn" onclick="ssGuestSignup('email')">Sign up with Email</button>
      </div>`;
    document.body.appendChild(ov);
  }

  function _ssOpenSignupSheet(reason) {
    _ensureSheet();
    const title = document.getElementById('ss-su-title');
    const sub   = document.getElementById('ss-su-sub');
    if (reason === 'fire') {
      title.innerHTML = 'FELT THAT <em>FIRE?</em>';
      sub.textContent = 'Sign up to fire clips and tell curators what hits. Your taste shapes your feed.';
    } else if (reason === 'save') {
      title.innerHTML = 'SAVE IT FOR <em>LATER</em>';
      sub.textContent = 'Sign up to build your Watchlist and never lose a clip you loved.';
    } else if (reason === 'follow') {
      title.innerHTML = 'FOUND YOUR <em>PEOPLE?</em>';
      sub.textContent = 'Sign up to follow the curators whose taste you trust and get their new picks.';
    } else if (reason === 'login') {
      title.innerHTML = 'WELCOME TO <em>SHOWSHAK</em>';
      sub.textContent = 'Sign in or create your account to build your Watchlist, follow curators, and make this space yours.';
    } else { // view threshold
      title.innerHTML = 'ENJOYING THE <em>VIBE?</em>';
      sub.textContent = 'Sign up to save clips, follow curators, and pick up right where you left off.';
    }
    document.getElementById('ss-signup-overlay')?.classList.add('open');
    document.getElementById('ss-signup-sheet')?.classList.add('open');
  }

  function _ssCloseSignupSheet() {
    document.getElementById('ss-signup-sheet')?.classList.remove('open');
    document.getElementById('ss-signup-overlay')?.classList.remove('open');
  }
  window.ssGuestLater = _ssCloseSignupSheet;
  window._ssCloseSignupSheet = _ssCloseSignupSheet;

  /* Public guard for non-click fire paths (e.g. viewer double-tap).
     Returns true if the action should be BLOCKED (guest) and shows the
     sheet; returns false if the user is signed up (allow the action). */
  window.ssGuestGuard = function (reason) {
    if (ssIsSignedUp()) return false;
    _ssOpenSignupSheet(reason || 'fire');
    return true;
  };

  /* Public opener for an explicit Log in / Sign up entry point (sidebar
     bottom, mobile profile gear). Opens the same sheet; no-op-safe. */
  window.ssOpenSignup = function (reason) {
    _ensureSheet();
    _ssOpenSignupSheet(reason || 'login');
  };

  /* ── Inline email sign-up / sign-in form (reuses the same sheet) ──
     Replaces the sheet body with email + password fields. Tries to
     CREATE the account; if it already exists, falls back to signing in.
     On success, onAuthStateChange closes the sheet + welcomes them. */
  function _ssShowEmailForm() {
    _ensureSheet();
    const sheet = document.getElementById('ss-signup-sheet');
    if (!sheet) return;
    sheet.innerHTML = `
      <div class="ss-su-handle"></div>
      <div class="ss-su-title" style="margin-top:4px">SIGN UP WITH <em>EMAIL</em></div>
      <div class="ss-su-sub">Use your email and a password (6+ characters).</div>
      <input id="ss-su-email" class="ss-su-input" type="email" inputmode="email"
        autocomplete="email" placeholder="you@email.com" />
      <input id="ss-su-pass" class="ss-su-input" type="password"
        autocomplete="new-password" placeholder="Password" />
      <div id="ss-su-msg" class="ss-su-msg"></div>
      <button id="ss-su-go" class="ss-su-btn primary" onclick="ssEmailSubmit()">Continue</button>
      <div class="ss-su-later" onclick="ssEmailBack()">← Other ways to sign up</div>
    `;
    setTimeout(() => document.getElementById('ss-su-email')?.focus(), 60);
  }

  window.ssEmailBack = function () {
    // Rebuild the default provider sheet.
    const ov = document.getElementById('ss-signup-overlay');
    if (ov) ov.remove();           // _ensureSheet() will rebuild the default
    _ensureSheet();
    _ssOpenSignupSheet('save');
  };

  window.ssEmailSubmit = function () {
    const email = (document.getElementById('ss-su-email')?.value || '').trim();
    const pass  = document.getElementById('ss-su-pass')?.value || '';
    const msg   = document.getElementById('ss-su-msg');
    const btn   = document.getElementById('ss-su-go');
    const show  = (t) => { if (msg) msg.textContent = t; };

    if (!email || !email.includes('@')) return show('Enter a valid email.');
    if (pass.length < 6)               return show('Password needs 6+ characters.');
    if (!window.ssDB || !window.ssDB.auth) return show('Connection unavailable — try again.');

    if (btn) { btn.disabled = true; btn.textContent = 'Creating account…'; }
    show('');

    window.ssDB.auth.signUp({
      email, password: pass,
      options: { emailRedirectTo: window.location.href }   // confirm link returns here, not localhost
    }).then(({ data, error }) => {
      if (!error) {
        // If email confirmations are OFF, session is live now → state change fires.
        // If ON, there's no session yet — tell them to check their inbox.
        if (!data.session) show('Check your inbox to confirm, then come back.');
        if (btn) { btn.disabled = false; btn.textContent = 'Continue'; }
        return;
      }
      // Account already exists → try signing them in instead.
      if (/already registered|already exists/i.test(error.message)) {
        window.ssDB.auth.signInWithPassword({ email, password: pass }).then(({ error: e2 }) => {
          if (btn) { btn.disabled = false; btn.textContent = 'Continue'; }
          if (e2) show('That email exists, but the password is wrong.');
        });
        return;
      }
      if (btn) { btn.disabled = false; btn.textContent = 'Continue'; }
      show(error.message || 'Could not sign up. Try again.');
    });
  };

  /* ── Reaction gate: intercept Fire/Save/Follow in the CAPTURE phase,
       so we stop the action BEFORE its onclick runs. If signed up, we
       never interfere. ── */
  const GATED = [
    { sel: '#rail-lit',         reason: 'fire'   }, // feed fire (desktop)
    { sel: '[id^="m-lit-"]',    reason: 'fire'   }, // feed fire (mobile rail)
    { sel: '.ssv-fire',         reason: 'fire'   }, // viewer fire (rail)
    { sel: '[data-save-id]',    reason: 'save'   }, // any save button
    { sel: '[data-follow]',     reason: 'follow' }, // any follow button
  ];
  document.addEventListener('click', (e) => {
    if (ssIsSignedUp()) return;                  // signed up → fully transparent
    if (!e.target || !e.target.closest) return;
    for (const g of GATED) {
      if (e.target.closest(g.sel)) {
        e.preventDefault();
        e.stopImmediatePropagation();            // stops the element's onclick
        _ssOpenSignupSheet(g.reason);
        return;
      }
    }
  }, true);

  /* ── View trigger: count clips that become active (feed + viewer),
       prompt once at the limit. Zero page edits — we watch the DOM. ── */
  const _mo = new MutationObserver((muts) => {
    if (ssIsSignedUp() || _viewPromptShown) return;
    for (const m of muts) {
      const el = m.target;
      if (!(el instanceof Element)) continue;
      const isClip = el.classList && (el.classList.contains('clip') || el.classList.contains('ssv-clip'));
      if (!isClip || !el.classList.contains('active')) continue;
      const id = el.id || (el.dataset && el.dataset.ssvIdx) || Math.random();
      if (id === _lastActiveId) continue;        // ignore re-toggles of same clip
      _lastActiveId = id;
      _viewedClips++;
      if (_viewedClips >= VIEW_LIMIT) {
        _viewPromptShown = true;
        _ssOpenSignupSheet('view');
        break;
      }
    }
  });
  // Start once the body exists (shared.js runs at end of body).
  _mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

  /* ── Auth deep-link from the landing page ──
     index.html's onboarding sign-in hands off here with ?auth=google|apple|email.
     We strip the param first (so OAuth's redirect returns clean and we don't loop),
     then trigger the REAL auth: providers go straight to Supabase OAuth, email opens
     the inline email form. Guests only — a signed-in user is never re-prompted. */
  (function _ssAuthDeepLink() {
    let a = null;
    try { a = new URLSearchParams(window.location.search).get('auth'); } catch (e) {}
    if (!a) return;
    try {
      const p = new URLSearchParams(window.location.search);
      p.delete('auth');
      const clean = window.location.pathname + (p.toString() ? '?' + p.toString() : '') + window.location.hash;
      window.history.replaceState({}, '', clean);
    } catch (e) {}
    if (ssIsSignedUp()) return;
    a = String(a).toLowerCase();
    if (a === 'email') { _ssOpenSignupSheet('save'); _ssShowEmailForm(); }
    else if (a === 'google' || a === 'apple') { _ssGuestDoSignup(a); }
    else { _ssOpenSignupSheet('save'); }
  })();

  // Reflect auth state in the shared chrome now that ssIsSignedUp() exists
  // (covers the no-Supabase / local-flag path; the async session read above
  // refines it once it resolves).
  if (typeof ssSyncAuthChrome === 'function') ssSyncAuthChrome();
})();



/* ════════════════════════════════════════════════
   ── POST-LOGIN ONBOARDING ───────────────────────
   Runs ONCE, right after a user's first real login, to collect the
   profile details the signup providers don't give us:
     Step 1  Username (@handle)      — required, uniqueness-checked
     Step 2  Genres (taste)          — required, min 2
     Step 3  Platforms (you have)    — required-ish (drives Watch It)
     Step 4  Personal details        — OPTIONAL, "set up later"
             (gender + profile photo)

   Saves to:  users (username, gender, genres, avatar_url, onboarded)
              user_subscriptions (one row per platform they have)

   "Onboarded" is tracked by users.meta->>'onboarded' = 'true', so it
   never shows again. Reuses + improves index.html's pickers. Built as
   its own module so it only activates where Supabase + a session exist.
════════════════════════════════════════════════ */
(function ssOnboarding() {
  'use strict';

  // Improved taste list (superset of index.html's).
  const OB_GENRES = [
    ['😰','Thriller'],['😂','Comedy'],['🎭','Drama'],['👻','Horror'],
    ['💥','Action'],['❤️','Romance'],['🚀','Sci-Fi'],['⛩️','Anime'],
    ['🌸','K-Drama'],['🎬','Bollywood'],['🔍','Crime'],['🔮','Fantasy'],
    ['📺','Reality TV'],['🦸','Superhero'],['🕵️','True Crime'],
    ['🎥','Documentary'],['⚽','Sports'],['📜','History'],
  ];

  let _obUser   = null;     // auth user
  let _obStep   = 1;
  let _obData   = { name: '', username: '', genres: new Set(), platforms: new Set(), gender: '', avatar_url: '' };
  let _obPlatforms = [];    // [{id,name,color,abbr}] from DB
  let _obUsernameOk = false;

  /* ── Entry point: called once after a fresh login ── */
  window._ssAfterLogin = async function () {
    if (!window.ssDB || !_ssCanQuery()) { return; }
    const user = window.ssCurrentUser && window.ssCurrentUser();
    if (!user) return;
    _obUser = user;
    if (typeof ssHydrateFollowing === 'function') ssHydrateFollowing();   // seed Following from DB on fresh login
    // Auto-restore a deactivated / pending-deletion account on sign-in (once per
    // tab). ss_reactivate_account clears the flags and returns true iff the
    // account was flagged, so we only greet "welcome back" when it actually was.
    try {
      if (window.ssDB.rpc && !sessionStorage.getItem('ss_reactchk')) {
        sessionStorage.setItem('ss_reactchk', '1');
        window.ssDB.rpc('ss_reactivate_account').then(function (res) {
          if (res && !res.error && res.data === true && typeof ssToast === 'function') {
            ssToast('👋 Welcome back — your account is restored');
          }
        }).catch(function () {});
      }
    } catch (e) {}
    try {
      const { data, error } = await window.ssDB
        .from('users').select('username, gender, genres, avatar_url, meta').eq('id', user.id).single();
      if (error) { console.warn('ShowShak onboarding: profile read failed', error.message); return; }
      const done = data && data.meta && data.meta.onboarded === true;
      if (done) { return; }   // already onboarded → nothing to do (no per-page greeting)
      // Pre-fill the auto-generated username + any provider avatar.
      _obData.username   = (data && data.username) || '';
      _obData.name       = (data && data.name) || (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || '';
      _obData.avatar_url = (data && data.avatar_url) || (user.user_metadata && user.user_metadata.avatar_url) || '';
      _obData.gender     = (data && data.gender) || '';
      _openOnboarding();
    } catch (e) { console.warn('ShowShak onboarding error', e); }
  };

  function _ssCanQuery() { return window.ssDB && window.ssDB.from; }

  /* ── CSS ── */
  (function _css() {
    const s = document.createElement('style');
    s.id = 'ss-onboard-style';
    s.textContent = `
      #ss-ob-overlay { position: fixed; inset: 0; z-index: 700; background: #0B0B0F;
        opacity: 0; pointer-events: none; transition: opacity 0.35s ease; overflow-y: auto; }
      #ss-ob-overlay.open { opacity: 1; pointer-events: all; }
      .ss-ob-wrap { max-width: 460px; margin: 0 auto; min-height: 100%;
        display: flex; flex-direction: column; padding: 28px 22px 110px; }
      .ss-ob-progress { display: flex; align-items: center; gap: 6px; margin-bottom: 28px; }
      .ss-ob-dot { flex: 1; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.1); transition: background 0.3s; }
      .ss-ob-dot.on { background: #EA3B32; }
      .ss-ob-step { display: none; }
      .ss-ob-step.active { display: block; animation: ssObIn 0.35s ease; }
      @keyframes ssObIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      .ss-ob-title { font-family: 'Bebas Neue', sans-serif; font-size: 30px; letter-spacing: 1px;
        color: #fff; line-height: 1.05; margin-bottom: 8px; }
      .ss-ob-title em { color: #EA3B32; font-style: normal; }
      .ss-ob-sub { font-size: 14px; color: #9a9aac; line-height: 1.5; margin-bottom: 22px; }
      .ss-ob-uname-row { display: flex; align-items: center; background: #13131A;
        border: 1.5px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 0 14px;
        transition: border-color 0.15s; }
      .ss-ob-uname-row:focus-within { border-color: rgba(234,59,50,0.6); }
      .ss-ob-at { color: #5A5A72; font-size: 17px; font-weight: 700; }
      .ss-ob-uname { flex: 1; background: none; border: none; outline: none; color: #fff;
        font-family: 'DM Sans', sans-serif; font-size: 16px; padding: 15px 8px; }
      .ss-ob-uname-msg { font-size: 12.5px; min-height: 18px; margin: 8px 2px 0; }
      .ss-ob-uname-msg.ok  { color: #2ecc71; }
      .ss-ob-uname-msg.bad { color: #ff7a70; }
      .ss-ob-grid { display: flex; flex-wrap: wrap; gap: 9px; }
      .ss-ob-pill { display: inline-flex; align-items: center; gap: 7px; padding: 10px 15px;
        background: #13131A; border: 1.5px solid rgba(255,255,255,0.1); border-radius: 100px;
        color: #fff; font-size: 13.5px; font-weight: 600; cursor: pointer; transition: all 0.15s;
        -webkit-tap-highlight-color: transparent; }
      .ss-ob-pill.on { background: rgba(234,59,50,0.15); border-color: #EA3B32; color: #fff; }
      .ss-ob-plats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
      .ss-ob-plat { position: relative; background: #13131A; border: 1.5px solid rgba(255,255,255,0.1);
        border-radius: 14px; padding: 16px 8px 12px; text-align: center; cursor: pointer; transition: all 0.15s;
        -webkit-tap-highlight-color: transparent; }
      .ss-ob-plat.on { border-color: #EA3B32; background: rgba(234,59,50,0.08); }
      .ss-ob-plat-logo { width: 38px; height: 38px; border-radius: 10px; margin: 0 auto 8px;
        display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; color: #fff; }
      .ss-ob-plat-name { font-size: 11.5px; color: #cfcfda; font-weight: 600; }
      .ss-ob-plat-check { position: absolute; top: 7px; right: 7px; width: 18px; height: 18px; border-radius: 50%;
        background: #EA3B32; display: none; align-items: center; justify-content: center; }
      .ss-ob-plat.on .ss-ob-plat-check { display: flex; }
      .ss-ob-genders { display: flex; gap: 10px; }
      .ss-ob-gender { flex: 1; padding: 14px; text-align: center; background: #13131A;
        border: 1.5px solid rgba(255,255,255,0.1); border-radius: 14px; color: #cfcfda; font-weight: 600;
        font-size: 13.5px; cursor: pointer; transition: all 0.15s; }
      .ss-ob-gender.on { border-color: #EA3B32; background: rgba(234,59,50,0.08); color: #fff; }
      .ss-ob-photo-row { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
      .ss-ob-photo { width: 72px; height: 72px; border-radius: 50%; background: #13131A;
        border: 1.5px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center;
        font-size: 28px; overflow: hidden; flex-shrink: 0; }
      .ss-ob-photo img { width: 100%; height: 100%; object-fit: cover; }
      .ss-ob-photo-btn { font-size: 13px; color: #EA3B32; font-weight: 700; cursor: pointer;
        border: 1px solid rgba(234,59,50,0.4); border-radius: 10px; padding: 9px 14px; background: none; }
      .ss-ob-footer { position: fixed; left: 0; right: 0; bottom: 0; z-index: 701;
        background: linear-gradient(to top, #0B0B0F 60%, transparent);
        padding: 18px 22px 26px; }
      .ss-ob-footer-inner { max-width: 460px; margin: 0 auto; display: flex; gap: 10px; align-items: center; }
      .ss-ob-next { flex: 1; height: 52px; border-radius: 15px; background: #EA3B32; color: #fff; border: none;
        font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.15s; }
      .ss-ob-next:disabled { opacity: 0.4; cursor: default; }
      .ss-ob-next:not(:disabled):hover { background: #FF4D42; }
      .ss-ob-skip { padding: 14px 6px; font-size: 14px; color: #6b6b7a; font-weight: 600; cursor: pointer;
        background: none; border: none; -webkit-tap-highlight-color: transparent; }
      .ss-ob-skip:hover { color: #9a9aac; }
      .ss-ob-back { font-size: 13px; color: #6b6b7a; font-weight: 600; cursor: pointer; margin-bottom: 14px;
        display: inline-block; }
    `;
    document.head.appendChild(s);
  })();

  /* ── Build overlay HTML once ── */
  function _ensureOverlay() {
    if (document.getElementById('ss-ob-overlay')) return;
    const ov = document.createElement('div');
    ov.id = 'ss-ob-overlay';
    ov.innerHTML = `
      <div class="ss-ob-wrap">
        <div class="ss-ob-progress">
          <div class="ss-ob-dot" id="ss-ob-dot-1"></div>
          <div class="ss-ob-dot" id="ss-ob-dot-2"></div>
          <div class="ss-ob-dot" id="ss-ob-dot-3"></div>
          <div class="ss-ob-dot" id="ss-ob-dot-4"></div>
        </div>

        <!-- Step 1: name + username -->
        <div class="ss-ob-step" id="ss-ob-step-1">
          <div class="ss-ob-title">WHAT SHOULD WE <em>CALL YOU?</em></div>
          <div class="ss-ob-sub">Your name shows on your profile. Your handle is how people find you.</div>
          <input class="ss-ob-uname" id="ss-ob-name" type="text" maxlength="40"
            autocomplete="name" placeholder="Your name"
            style="width:100%;background:#13131A;border:1.5px solid rgba(255,255,255,0.1);border-radius:14px;margin-bottom:12px;padding:15px 14px;" />
          <div class="ss-ob-uname-row">
            <span class="ss-ob-at">@</span>
            <input class="ss-ob-uname" id="ss-ob-uname" type="text" maxlength="20"
              autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="yourname" />
          </div>
          <div class="ss-ob-uname-msg" id="ss-ob-uname-msg"></div>
        </div>

        <!-- Step 2: genres -->
        <div class="ss-ob-step" id="ss-ob-step-2">
          <div class="ss-ob-title">WHAT DO YOU <em>LOVE?</em></div>
          <div class="ss-ob-sub">Pick at least 2. We'll tune your feed to your taste.</div>
          <div class="ss-ob-grid" id="ss-ob-genre-grid"></div>
        </div>

        <!-- Step 3: platforms -->
        <div class="ss-ob-step" id="ss-ob-step-3">
          <div class="ss-ob-title">WHERE DO YOU <em>WATCH?</em></div>
          <div class="ss-ob-sub">Select your subscriptions so "Watch It" sends you to the right place.</div>
          <div class="ss-ob-plats" id="ss-ob-plat-grid"></div>
        </div>

        <!-- Step 4: personal (optional) -->
        <div class="ss-ob-step" id="ss-ob-step-4">
          <div class="ss-ob-title">MAKE IT <em>YOURS</em></div>
          <div class="ss-ob-sub">Optional — you can always set this up later from your profile.</div>
          <div style="font-size:12px;color:#6b6b7a;font-weight:700;letter-spacing:1px;margin-bottom:10px">PROFILE PHOTO</div>
          <div class="ss-ob-photo-row">
            <div class="ss-ob-photo" id="ss-ob-photo">🎬</div>
            <button class="ss-ob-photo-btn" onclick="document.getElementById('ss-ob-file').click()">Upload photo</button>
            <input id="ss-ob-file" type="file" accept="image/*" style="display:none" />
          </div>
          <div style="font-size:12px;color:#6b6b7a;font-weight:700;letter-spacing:1px;margin:22px 0 10px">GENDER</div>
          <div class="ss-ob-genders" id="ss-ob-genders">
            <div class="ss-ob-gender" data-g="male">Male</div>
            <div class="ss-ob-gender" data-g="female">Female</div>
            <div class="ss-ob-gender" data-g="other">Prefer not to say</div>
          </div>
        </div>
      </div>

      <div class="ss-ob-footer">
        <div class="ss-ob-footer-inner">
          <button class="ss-ob-skip" id="ss-ob-skip" style="display:none" onclick="ssObSkip()">Set up later</button>
          <button class="ss-ob-next" id="ss-ob-next" onclick="ssObNext()">Continue</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    _wireOnboarding();
  }

  function _wireOnboarding() {
    // Name
    const nameInput = document.getElementById('ss-ob-name');
    if (nameInput) nameInput.addEventListener('input', () => { _obData.name = nameInput.value; });

    // Username live check (debounced).
    const input = document.getElementById('ss-ob-uname');
    let t = null;
    input.addEventListener('input', () => {
      input.value = input.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
      _obData.username = input.value;
      clearTimeout(t);
      t = setTimeout(_checkUsername, 350);
      _obUsernameOk = false; _refreshNextBtn();
    });

    // Genres
    const gg = document.getElementById('ss-ob-genre-grid');
    OB_GENRES.forEach(([e, l]) => {
      const b = document.createElement('button');
      b.className = 'ss-ob-pill';
      b.innerHTML = `<span>${e}</span>${l}`;
      b.addEventListener('click', () => {
        _obData.genres.has(l) ? _obData.genres.delete(l) : _obData.genres.add(l);
        b.classList.toggle('on', _obData.genres.has(l));
        _refreshNextBtn();
      });
      gg.appendChild(b);
    });

    // Gender
    document.querySelectorAll('#ss-ob-genders .ss-ob-gender').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('#ss-ob-genders .ss-ob-gender').forEach(x => x.classList.remove('on'));
        el.classList.add('on');
        _obData.gender = el.getAttribute('data-g');
      });
    });

    // Photo upload → validate (type + size to match the bucket rules),
    // preview now, uploaded to Storage on finish.
    document.getElementById('ss-ob-file').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
      const MAX_BYTES = 5 * 1024 * 1024;   // 5 MB — matches the avatars bucket limit
      if (!OK_TYPES.includes(file.type)) {
        if (typeof ssToast === 'function') ssToast('Please use a JPG, PNG or WEBP image');
        e.target.value = ''; return;
      }
      if (file.size > MAX_BYTES) {
        if (typeof ssToast === 'function') ssToast('Image too large — keep it under 5MB');
        e.target.value = ''; return;
      }
      _obData._photoFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        document.getElementById('ss-ob-photo').innerHTML = `<img src="${reader.result}" alt="">`;
      };
      reader.readAsDataURL(file);
    });
  }

  async function _checkUsername() {
    const msg = document.getElementById('ss-ob-uname-msg');
    const u = _obData.username;
    if (!u || u.length < 3) { msg.className = 'ss-ob-uname-msg bad'; msg.textContent = u ? 'At least 3 characters.' : ''; _obUsernameOk = false; _refreshNextBtn(); return; }
    msg.className = 'ss-ob-uname-msg'; msg.textContent = 'Checking…';
    try {
      // Use the shared case-insensitive, wildcard-safe checker so signup and the
      // Settings handle editor enforce the SAME cross-user uniqueness rule.
      const r = await ssCheckUsernameAvailable(u, _obUser.id);
      if (r.ok) { msg.className = 'ss-ob-uname-msg ok'; msg.textContent = '@' + u + ' is available ✓'; _obUsernameOk = true; }
      else if (r.reason === 'taken') { msg.className = 'ss-ob-uname-msg bad'; msg.textContent = '@' + u + ' is taken.'; _obUsernameOk = false; }
      else if (r.reason === 'invalid') { msg.className = 'ss-ob-uname-msg bad'; msg.textContent = 'Use 2–30 letters, numbers, _ or .'; _obUsernameOk = false; }
      else { msg.className = 'ss-ob-uname-msg'; msg.textContent = ''; _obUsernameOk = true; /* network hiccup → don't block */ }
    } catch (e) { msg.className = 'ss-ob-uname-msg'; msg.textContent = ''; _obUsernameOk = true; /* don't block on network hiccup */ }
    _refreshNextBtn();
  }

  async function _openOnboarding() {
    _ensureOverlay();
    // Load real platforms from the DB for step 3.
    try {
      const { data } = await window.ssDB.from('platforms').select('id, name, color, abbr').eq('active', true);
      _obPlatforms = data || [];
    } catch (e) { _obPlatforms = []; }
    _renderPlatforms();
    // Pre-fill username field.
    const input = document.getElementById('ss-ob-uname');
    if (input && _obData.username) { input.value = _obData.username; }
    const nameInput = document.getElementById('ss-ob-name');
    if (nameInput && _obData.name) { nameInput.value = _obData.name; }
    if (_obData.avatar_url) document.getElementById('ss-ob-photo').innerHTML = `<img src="${_obData.avatar_url}" alt="">`;
    _obStep = 1;
    _showStep(1);
    document.getElementById('ss-ob-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    if (_obData.username) _checkUsername();
  }

  function _renderPlatforms() {
    const grid = document.getElementById('ss-ob-plat-grid');
    if (!grid) return;
    grid.innerHTML = _obPlatforms.map(p => `
      <div class="ss-ob-plat" data-pid="${p.id}">
        <div class="ss-ob-plat-check"><svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,6 5,9 10,3"/></svg></div>
        <div class="ss-ob-plat-logo" style="background:${p.color || '#EA3B32'}">${p.abbr || p.name.charAt(0)}</div>
        <div class="ss-ob-plat-name">${p.name}</div>
      </div>`).join('');
    grid.querySelectorAll('.ss-ob-plat').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-pid');
        _obData.platforms.has(id) ? _obData.platforms.delete(id) : _obData.platforms.add(id);
        el.classList.toggle('on', _obData.platforms.has(id));
        _refreshNextBtn();
      });
    });
  }

  function _showStep(n) {
    _obStep = n;
    [1,2,3,4].forEach(i => {
      document.getElementById('ss-ob-step-' + i)?.classList.toggle('active', i === n);
      document.getElementById('ss-ob-dot-' + i)?.classList.toggle('on', i <= n);
    });
    // Skip button only on the optional last step.
    document.getElementById('ss-ob-skip').style.display = (n === 4) ? '' : 'none';
    const next = document.getElementById('ss-ob-next');
    next.textContent = (n === 4) ? 'Finish' : 'Continue';
    if (n === 1) setTimeout(() => document.getElementById('ss-ob-uname')?.focus(), 80);
    _refreshNextBtn();
  }

  function _refreshNextBtn() {
    const next = document.getElementById('ss-ob-next');
    if (!next) return;
    let ok = true;
    if (_obStep === 1) ok = _obUsernameOk && _obData.username.length >= 3;
    else if (_obStep === 2) ok = _obData.genres.size >= 2;
    else if (_obStep === 3) ok = true;   // platforms recommended, not blocking
    next.disabled = !ok;
  }

  window.ssObNext = function () {
    if (_obStep < 4) { _showStep(_obStep + 1); return; }
    _finishOnboarding(false);
  };
  window.ssObSkip = function () { _finishOnboarding(true); };

  async function _finishOnboarding(skippedPersonal) {
    const next = document.getElementById('ss-ob-next');
    const skip = document.getElementById('ss-ob-skip');
    if (next) { next.disabled = true; next.textContent = 'Saving…'; }
    if (skip) skip.style.pointerEvents = 'none';

    try {
      // Upload photo to Supabase Storage if one was chosen.
      if (!skippedPersonal && _obData._photoFile) {
        try {
          const file = _obData._photoFile;
          const path = _obUser.id + '/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '');
          const up = await window.ssDB.storage.from('avatars').upload(path, file, { upsert: true });
          if (!up.error) {
            const { data: pub } = window.ssDB.storage.from('avatars').getPublicUrl(path);
            if (pub && pub.publicUrl) _obData.avatar_url = pub.publicUrl;
          }
        } catch (e) { /* storage not set up yet — skip photo, don't block */ }
      }

      // Update the profile row.
      const patch = {
        username: _obData.username,
        genres: Array.from(_obData.genres),
        meta: { onboarded: true },
      };
      if (_obData.name && _obData.name.trim()) patch.name = _obData.name.trim();
      if (!skippedPersonal && _obData.gender) patch.gender = _obData.gender;
      if (_obData.avatar_url) patch.avatar_url = _obData.avatar_url;

      const { error: upErr } = await window.ssDB.from('users').update(patch).eq('id', _obUser.id);
      if (upErr) throw upErr;

      // Save platform subscriptions (insert rows; ignore dupes).
      if (_obData.platforms.size) {
        const rows = Array.from(_obData.platforms).map(pid => ({ user_id: _obUser.id, platform_id: pid }));
        await window.ssDB.from('user_subscriptions').upsert(rows, { onConflict: 'user_id,platform_id' });
      }

      _closeOnboarding();
      if (typeof ssToast === 'function') ssToast('🎉 You\'re all set, @' + _obData.username);
    } catch (e) {
      console.error('ShowShak onboarding save failed', e);
      if (next) { next.disabled = false; next.textContent = (_obStep === 4 ? 'Finish' : 'Continue'); }
      if (skip) skip.style.pointerEvents = '';
      if (typeof ssToast === 'function') ssToast('Could not save — please try again');
    }
  }

  function _closeOnboarding() {
    document.getElementById('ss-ob-overlay')?.classList.remove('open');
    document.body.style.overflow = '';
  }
})();

/* ════════════════════════════════════════════════
   UNIFIED CLIP PLAYER — shared engine primitives
   ────────────────────────────────────────────────
   These primitives are the foundation of the single shared Clip_Engine
   powering both the inline Feed and the fullscreen viewer. The FULLSCREEN
   viewer is now wired onto them (ssCreateSurface + ssMakeProgressBar +
   ssAttachGestures + ssClipOrdering, driven by the ClipEngine object); the
   old _ssvAttachDoubleTap/_ssvFireOn/_ssvToggleFire have been removed. A
   later task repoints the Feed (INLINE mode) onto the same primitives.
════════════════════════════════════════════════ */

/**
 * Media_Surface — the contract the Clip_Engine speaks to.
 * Implementations: GradientSurface (now), VideoSurface (future, Mux <video>).
 * The engine NEVER branches on surface type; it only calls these methods
 * and subscribes to these callbacks.
 *
 *   mount(containerEl)   build & attach the medium's DOM node, returns the node
 *   play()               start/resume playback (returns a Promise)
 *   pause()              pause playback
 *   setMuted(isMuted)    audio on/off (no-op audio for gradient)
 *   isMuted()            -> boolean
 *   getProgress()        -> number in [0,1]
 *   seek(fraction)       jump to fraction in [0,1]
 *   onTimeupdate(cb)     cb(progress:0..1) fired as playback advances
 *   onEnded(cb)          cb() fired when the clip reaches its end
 *   destroy()            stop timers/listeners, detach DOM
 */
var MediaSurfaceContract = {
  mount: function (containerEl) {},   // build & attach the medium's DOM node
  play: function () {},               // start/resume playback (returns Promise)
  pause: function () {},              // pause playback
  setMuted: function (isMuted) {},    // audio on/off (no-op audio for gradient)
  isMuted: function () {},            // -> boolean
  getProgress: function () {},        // -> number in [0,1]
  seek: function (fraction) {},       // jump to fraction in [0,1]
  onTimeupdate: function (cb) {},     // cb(progress:0..1) fired as playback advances
  onEnded: function (cb) {},          // cb() fired when the clip reaches its end
  preload: function () {},            // eagerly buffer ahead (no-op for gradient)
  bufferedAhead: function () {},      // -> seconds buffered ahead of the play head (deepening gate)
  setPreloadTier: function (tier) {}, // 'auto'|'metadata'|'none' engine-assigned preload priority
  setMaxResolution: function (res) {},// tier-driven quality ceiling ('480p'|'720p'|'1080p')
  destroy: function () {},            // stop timers/listeners, detach DOM
};

/**
 * GradientSurface — today's Media_Surface. Wraps a CSS-gradient <div> and
 * drives progress from a requestAnimationFrame timer against a fixed synthetic
 * duration, so getProgress()/onTimeupdate behave like real media.
 */
function GradientSurface(clip, opts) {
  var DURATION_MS = (opts && opts.durationMs) || 16000; // ~ Feed 40ms*0.25%
  var el = null, raf = null, startedAt = 0, elapsedBase = 0;
  var muted = true, ended = false;
  var onTick = [], onEnd = [], onMute = [];
  var loopClip = !opts || opts.loop !== false;   // active clip loops by default

  function loop(now) {
    var elapsed = elapsedBase + (now - startedAt);
    var p = Math.max(0, Math.min(1, elapsed / DURATION_MS));
    onTick.forEach(function (cb) { cb(p); });
    if (p >= 1) {
      // Loop the active clip: restart the cycle instead of ending, so it
      // replays until the viewer scrolls away (mirrors VideoSurface loop).
      if (loopClip) { elapsedBase = 0; startedAt = now; raf = requestAnimationFrame(loop); return; }
      ended = true; onEnd.forEach(function (cb) { cb(); }); return;
    }
    raf = requestAnimationFrame(loop);
  }

  return {
    mount: function (container) {
      el = document.createElement('div');
      el.className = (opts && opts.bgClass) || 'clip-bg';
      el.style.background = clip.bg;
      container.appendChild(el);
      return el;
    },
    play: function () {
      if (ended) return Promise.resolve();
      startedAt = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
      return Promise.resolve();            // mirrors video.play() Promise
    },
    pause: function () {
      cancelAnimationFrame(raf);
      elapsedBase += performance.now() - startedAt;
    },
    // gradient has no audio track, but it still honors a muted flag through the
    // contract; notify listeners so the engine can keep the mute icon in sync.
    setMuted: function (m) { muted = !!m; onMute.forEach(function (cb) { cb(muted); }); },
    isMuted: function () { return muted; },
    intendsToPlay: function () { return true; },
    onMutedChange: function (cb) { if (typeof cb === 'function') onMute.push(cb); },
    // Gradients never stall, so they always report "playing" and the inline
    // tap-to-play affordance never shows for them (isVideo is false anyway).
    onPlayState: function () {},
    isPlaying: function () { return true; },
    preload: function () {},                   // nothing to buffer for a gradient
    bufferedAhead: function () { return Infinity; },  // gradient is always "ready" — never blocks deepening
    setPreloadTier: function () {},            // gradients have no preload tier
    setMaxResolution: function () {},          // gradients have no resolution ceiling
    getProgress: function () {
      return Math.max(0, Math.min(1, elapsedBase / DURATION_MS));
    },
    seek: function (f) { elapsedBase = Math.max(0, Math.min(1, f)) * DURATION_MS; },
    onTimeupdate: function (cb) { onTick.push(cb); },
    onEnded: function (cb) { onEnd.push(cb); },
    // repoint(newClip, container) — pool reuse for a gradient slot. Gradients are
    // cheap (no network/hls), so this just resets the timer, repaints the new
    // gradient, moves the node into the new container, and clears listeners for
    // the engine to rebind. Keeps the engine from branching on surface type.
    repoint: function (newClip, container) {
      clip = newClip || clip;
      ended = false; elapsedBase = 0; cancelAnimationFrame(raf);
      onTick = []; onMute = [];
      if (!el) { return this.mount(container); }
      el.style.background = clip.bg;
      if (container && el.parentNode !== container) container.appendChild(el);
      return el;
    },
    destroy: function () { cancelAnimationFrame(raf); if (el) el.remove(); el = null; onMute = []; },
  };
}

/**
 * VideoSurface — the Mux Media_Surface. Wraps a <mux-player> custom element
 * (an HTMLMediaElement-like API: play()/pause(), .muted, .currentTime,
 * .duration, and timeupdate/ended/error events) and maps it to the
 * MediaSurfaceContract. The Clip_Engine NEVER branches on this type;
 * ssCreateSurface returns it whenever a clip has a muxPlaybackId.
 * Progress/seek/mute math is delegated to the pure ss* helpers so behaviour is
 * identical with or without a DOM (Req 5.x, 6.x, 7.x, 12.4).
 */
function VideoSurface(clip, opts) {
  var el = null, ended = false;
  var onTick = [], onEnd = [], onMute = [], onPlay = [];
  var _playing = false;                          // REAL playback state (drives the stall affordance)
  var muted = true, errored = false;
  var _lastVol = 1;                              // track volume to detect a raise
  var wantPlay = false;                          // intent: should this surface be playing?
  var loopClip = !opts || opts.loop !== false;   // active clip loops by default
  // Engine-assigned preload priority (feed-clip-load-performance Phase 1, Req
  // 1.1/1.4). Defaults to 'none' so a freshly-mounted/re-pointed surface does
  // NOT start buffering on its own; the engine calls setPreloadTier() (via
  // _ssApplyPreloadTiers) right after to assign the real ladder tier — only the
  // active clip ever becomes 'auto'.
  var preloadTier = 'none';

  function handleTimeupdate() {
    // Advancing time on a non-paused element is the ground-truth "playing" signal.
    if (el && !el.paused && !el.ended) _ssSetPlaying(true);
    var p = ssClipProgress(el && el.currentTime, el && el.duration);
    onTick.forEach(function (cb) { cb(p); });
  }
  // Real-playback state relay (drives the inline tap-to-play affordance). Only
  // notifies on a transition so listeners aren't spammed every timeupdate.
  function _ssSetPlaying(v) {
    v = !!v;
    if (v === _playing) return;
    _playing = v;
    onPlay.forEach(function (cb) { try { cb(_playing); } catch (e) {} });
  }
  function handlePlaying()    { _ssSetPlaying(true); }
  function handleNotPlaying() { _ssSetPlaying(false); }
  // The media element's muted state can change for reasons OTHER than an
  // explicit setMuted() call — most importantly the browser forcing muted
  // playback under the autoplay policy. `volumechange` fires on every such
  // change, so we relay the REAL muted state to listeners; the engine uses
  // this to keep the mute icon in sync with what the user actually hears.
  function handleVolumeChange() {
    if (!el) { onMute.forEach(function (cb) { cb(muted); }); return; }
    var vol = (typeof el.volume === 'number') ? el.volume : 1;
    // Raising the volume while muted = intent to UNMUTE. Clear the mute and sync
    // the session preference so every clip follows (and mark Audio_Unlock, since
    // a volume interaction is a user gesture).
    if (el.muted && vol > _lastVol && vol > 0) {
      el.muted = false;
      if (typeof ssMarkAudioUnlocked === 'function') ssMarkAudioUnlocked();
      if (typeof ssSetMutePref === 'function') ssSetMutePref(false);
    }
    _lastVol = vol;
    muted = !!el.muted;
    // Relay the REAL muted state so the engine keeps the mute icon in sync with
    // what the user actually hears.
    onMute.forEach(function (cb) { cb(muted); });
  }
  function handleEnded() {
    if (ended) return;
    ended = true;
    onEnd.forEach(function (cb) { cb(); });
  }
  function handleError() {
    // Player failed to load video (Req 12.4): keep the poster visible and let
    // the engine advance by synthesizing an 'ended' after a short grace.
    errored = true;
    setTimeout(function () { handleEnded(); }, 600);
  }
  // When the source becomes ready (after a cold load or a pool re-point), if we
  // still INTEND to play but the element is paused, kick playback now. Fixes the
  // "scroll to a loading clip → frozen on the poster until you tap" race: the
  // initial play() ran before the new source was ready, so its intent was lost.
  function handleCanPlay() {
    if (wantPlay && el && el.paused) {
      var p = el.play();
      if (p && p.catch) p.catch(function () {
        try { el.muted = true; muted = true; el.play(); } catch (e) {}  // muted backstop
      });
    }
    // Re-assert the session sound preference once the source is ready. A cold or
    // late-loading active clip may have started under the muted backstop above;
    // unmuting a now-ready, already-playing element is allowed without a fresh
    // gesture, so audio reliably engages on scroll instead of staying silent.
    if (el && wantPlay) {
      try {
        var want = ssResolveSurfaceMuted(_ssAudioUnlocked, ssGetMutePref());
        if (!!el.muted !== want) {
          el.muted = want; muted = want;
          if (want) el.setAttribute('muted', ''); else el.removeAttribute('muted');
          onMute.forEach(function (cb) { cb(muted); });
        }
      } catch (e) {}
    }
  }

  return {
    mount: function (container) {
      el = document.createElement('mux-player');
      el.setAttribute('playback-id', clip.muxPlaybackId);
      el.setAttribute('stream-type', 'on-demand');
      // ── Mux Data QoE labeling (clip-player-performance Phase 1, Req 8.1–8.3) ──
      // Mux Data is built into <mux-player> and auto-reports startup time and
      // rebuffering. We attribute each playback to its clip so per-clip QoE is
      // reviewable as the objective scoreboard. `env-key` is set only when a
      // global is provided (mux-player otherwise infers the env from the
      // playback id). The show title here is INTERNAL telemetry only — it lives
      // in the private Mux dashboard, never a user-facing surface, so it does
      // not break the "title hidden until Watch It" rule. Tracking stays ENABLED
      // (no `disable-tracking` attribute). Best-effort; never blocks playback.
      try {
        var _muxEnv = (typeof window !== 'undefined' && window.SS_MUX_ENV_KEY) || null;
        if (_muxEnv) el.setAttribute('env-key', String(_muxEnv));
        if (clip.id != null && clip.id !== '') el.setAttribute('metadata-video-id', String(clip.id));
        var _vTitle = clip.title || (clip.creator && clip.creator.name) || '';
        if (_vTitle) el.setAttribute('metadata-video-title', String(_vTitle));
        var _viewer = (typeof window !== 'undefined' && typeof window.ssCurrentUser === 'function')
          ? window.ssCurrentUser() : null;
        if (_viewer && _viewer.id) el.setAttribute('metadata-viewer-user-id', String(_viewer.id));
      } catch (e) { /* labeling is best-effort — never block playback */ }
      el.setAttribute('playsinline', '');
      // Default to the engine-assigned preload tier (default 'none'): a mounted
      // surface no longer hardcodes preload="auto" — the engine assigns the real
      // ladder tier immediately after mount via _ssApplyPreloadTiers, so only the
      // active clip becomes 'auto' and the look-ahead band stops contending with
      // it on a constrained mobile link (feed-clip-load-performance Phase 1, Req
      // 1.1/1.4). The active clip still autoplays with sound (its tier is 'auto').
      try { el.preload = preloadTier; el.setAttribute('preload', preloadTier); } catch (e) {}
      // Instant first frame (Phase 4, Req 3.1): seed ABR LOW so the first
      // segment is a small/low rendition that renders fast. ABR climbs to full
      // quality after the first frame is on screen.
      try { el.setAttribute('initial-bandwidth-estimate-kbps', String(SS_START_BW_KBPS)); } catch (e) {}
      // Loop the active clip (TikTok/Reels-style) so it replays until the
      // viewer scrolls to another clip. Native loop never fires 'ended', so
      // the error→advance path (handleError) is unaffected.
      if (loopClip) { el.loop = true; el.setAttribute('loop', ''); }
      // Seed sound from the SESSION preference (not this surface's local state):
      // a freshly-mounted clip must honor the user's one-time mute/unmute choice
      //the so it carries across every clip. Pre-unlock this resolves to muted
      // (autoplay-safe); post-unlock it follows the persisted Mute_Preference.
      muted = ssResolveSurfaceMuted(_ssAudioUnlocked, ssGetMutePref());
      el.muted = muted;
      try { if (muted) el.setAttribute('muted', ''); else el.removeAttribute('muted'); } catch (e) {}
      // Poster from the Mux image CDN when present, else paint the clip's
      // gradient as the loading background so the frame is never blank (Req 7).
      if (clip.poster) el.setAttribute('poster', clip.poster);
      else container.style.background = clip.bg || '#000';
      // Match GradientSurface's mount node so the feed/viewer CSS is unchanged.
      el.className = (opts && opts.bgClass) || 'clip-bg';
      el.style.width = '100%';
      el.style.height = '100%';
      // No built-in player chrome: we drive play/pause via our own gestures and
      // a custom mute control, so hide mux-player's controls — including the
      // center play/pause button that otherwise flashes before autoplay starts
      // (UX fix: clips just play; the pause indicator shows only on a tap).
      try { el.style.setProperty('--controls', 'none'); } catch (e) {}
      // Fill the frame edge-to-edge (cover), matching the poster's background-
      // size:cover, so the clip runs full-bleed under the floating controls
      // instead of letterboxing into a black band (mux-player defaults to
      // 'contain'). `--media-object-fit` is mux-player's documented CSS var;
      // objectFit on the host is a harmless fallback.
      try { el.style.setProperty('--media-object-fit', 'cover'); } catch (e) {}
      try { el.style.objectFit = 'cover'; } catch (e) {}
      el.addEventListener('timeupdate', handleTimeupdate);
      el.addEventListener('ended', handleEnded);
      el.addEventListener('error', handleError);
      el.addEventListener('volumechange', handleVolumeChange);
      el.addEventListener('canplay', handleCanPlay);
      el.addEventListener('loadeddata', handleCanPlay);
      // Real-playback signals for the inline tap-to-play affordance: 'playing'
      // marks true; pause/waiting/stalled mark false (iOS stuck-on-first-frame).
      el.addEventListener('playing', handlePlaying);
      el.addEventListener('pause', handleNotPlaying);
      el.addEventListener('waiting', handleNotPlaying);
      el.addEventListener('stalled', handleNotPlaying);
      container.appendChild(el);
      return el;
    },
    play: function () {
      wantPlay = true;
      if (!el) return Promise.resolve();
      // The clip we intend to PLAY is, by definition, the ACTIVE clip — which
      // always fully preloads ("active wins the pipe"). Force preload='auto'
      // HERE so playback never stalls waiting on the tier-assignment order
      // (_ssApplyPreloadTiers runs later in setActive). This fixes the "poster
      // clears / first frame shows, then the clip freezes until reopened" race
      // introduced when mount stopped hardcoding preload='auto'.
      try { el.preload = 'auto'; el.setAttribute('preload', 'auto'); } catch (e) {}
      preloadTier = 'auto';
      // autoplay backstops the case where the source isn't ready yet: the player
      // resumes the moment it can, even if this immediate play() doesn't stick.
      // The `autoplay` ATTRIBUTE (not just the property) survives a custom-element
      // upgrade, so when mux-player loads ASYNC and upgrades this element, it
      // auto-plays — covering the window before the element is even defined.
      try { el.autoplay = true; el.setAttribute('autoplay', ''); } catch (e) {}
      // Guard the pre-upgrade window: el.play is undefined until <mux-player>
      // is defined. Don't throw — the canplay/loadeddata listeners + autoplay
      // start playback the moment it upgrades and the source is ready.
      try {
        if (typeof el.play !== 'function') return Promise.resolve();
        return el.play() || Promise.resolve();
      } catch (e) { return Promise.resolve(); }
    },
    pause: function () {
      wantPlay = false;
      if (el) { try { el.autoplay = false; el.removeAttribute('autoplay'); if (typeof el.pause === 'function') el.pause(); } catch (e) {} }
    },
    // Eagerly buffer this (not-yet-active) clip so the NEXT clip is ready to
    // play instantly when the viewer scrolls to it (smooth viewing). Safe to
    // call repeatedly; never interrupts the currently-playing surface.
    preload: function () {
      if (el) { try { el.preload = 'auto'; el.setAttribute('preload', 'auto'); } catch (e) {} }
    },
    // setPreloadTier(tier) — apply the engine-assigned preload priority from the
    // pure ssPreloadTier ladder (feed-clip-load-performance Phase 1, Req
    // 1.1/1.4/6.1). Maps 'auto'|'metadata'|'none' to the <mux-player> `preload`
    // attribute AND gates this surface's load intent: 'none' must not start
    // buffering, 'metadata' fetches just enough for the first frame, 'auto'
    // buffers fully (the active clip). Any unknown value falls back to the safe
    // 'none'. No-op until mounted; never throws. The active clip's autoplay path
    // (play()/autoplay) is independent of this, so 'auto' keeps playback as-is.
    setPreloadTier: function (tier) {
      preloadTier = (tier === 'auto' || tier === 'metadata') ? tier : 'none';
      if (el) { try { el.preload = preloadTier; el.setAttribute('preload', preloadTier); } catch (e) {} }
    },
    // setMaxResolution(res) — apply the tier-driven quality ceiling (Phase 5,
    // Req 4.3/4.4). '480p'|'720p'|'1080p'. No-op if the element isn't mounted.
    setMaxResolution: function (res) {
      if (el && res) { try { el.setAttribute('max-resolution', String(res)); } catch (e) {} }
    },
    setMuted: function (m) {
      muted = !!m;
      // Set BOTH the property (live) and the `muted` attribute (survives a
      // custom-element upgrade) so an async-loaded <mux-player> comes up with
      // the right sound state instead of defaulting to unmuted/blocked.
      if (el) { try { el.muted = muted; if (muted) el.setAttribute('muted', ''); else el.removeAttribute('muted'); } catch (e) {} }
    },
    isMuted: function () { return el ? !!el.muted : muted; },
    intendsToPlay: function () { return wantPlay; },
    onMutedChange: function (cb) { if (typeof cb === 'function') onMute.push(cb); },
    // onPlayState(cb) — cb(playing:boolean) on each real playback transition;
    // isPlaying() — the current real playback state. Drive the inline feed's
    // tap-to-play affordance (iOS stuck-on-first-frame).
    onPlayState: function (cb) { if (typeof cb === 'function') onPlay.push(cb); },
    isPlaying: function () { return !!_playing; },
    getProgress: function () { return ssClipProgress(el && el.currentTime, el && el.duration); },
    // bufferedAhead() — seconds of media buffered ahead of the current play head
    // (feed-clip-load-performance Phase 2, Req 2.1). The progressive-deepening
    // controller reads this off the ACTIVE surface to decide whether the active
    // clip's buffer is satisfied (≥ SS_BUFFER_SATISFIED_S) before spending spare
    // bandwidth on upcoming clips. Fail-soft: any error / no buffered ranges → 0
    // (treated as "not satisfied", so the active clip keeps the pipe).
    bufferedAhead: function () {
      if (!el) return 0;
      try {
        var b = el.buffered;
        var t = (typeof el.currentTime === 'number' && isFinite(el.currentTime)) ? el.currentTime : 0;
        if (!b || !b.length) return 0;
        for (var i = 0; i < b.length; i++) {
          if (t >= b.start(i) - 0.25 && t <= b.end(i) + 0.25) return Math.max(0, b.end(i) - t);
        }
        return Math.max(0, b.end(b.length - 1) - t);
      } catch (e) { return 0; }
    },
    seek: function (f) { if (el && isFinite(el.duration)) el.currentTime = ssSeekToTime(f, el.duration); },
    onTimeupdate: function (cb) { onTick.push(cb); },
    onEnded: function (cb) { onEnd.push(cb); },
    // repoint(newClip, container) — the Player_Pool reuse step (Req 2.2, 2.4,
    // 2.5, 3.2, 3.3). Re-points THIS already-upgraded <mux-player> at a new clip
    // instead of destroying + recreating it: paint the new poster FIRST (so the
    // slot is never black), move the element into the new clip's container, swap
    // the playback-id + per-clip Mux Data labels, reset ended/error, and
    // re-apply the current muted state so Audio_Unlock is preserved. Clears the
    // progress/mute listeners so the engine can rebind them to the new clip.
    repoint: function (newClip, container) {
      clip = newClip || clip;
      ended = false; errored = false; wantPlay = false;
      onTick = []; onMute = []; onPlay = []; _playing = false;   // engine rebinds for the new clip
      if (!el) { return this.mount(container); } // nothing to reuse → mount fresh
      // Poster-first paint for the NEW clip before the stream swaps.
      if (clip.poster) el.setAttribute('poster', clip.poster);
      else { el.removeAttribute('poster'); if (container) container.style.background = clip.bg || '#000'; }
      // Move the SAME element into the new clip's container (no DOM churn).
      if (container && el.parentNode !== container) container.appendChild(el);
      // Per-clip Mux Data re-labeling (best-effort; never blocks).
      try {
        if (clip.id != null && clip.id !== '') el.setAttribute('metadata-video-id', String(clip.id));
        var _t = clip.title || (clip.creator && clip.creator.name) || '';
        if (_t) el.setAttribute('metadata-video-title', String(_t));
      } catch (e) {}
      // Re-seed ABR low for the new clip's fresh hls instance (Phase 4, Req 3.1).
      try { el.setAttribute('initial-bandwidth-estimate-kbps', String(SS_START_BW_KBPS)); } catch (e) {}
      el.setAttribute('playback-id', clip.muxPlaybackId);   // new clean hls + Mux Data view
      // Default the recycled element back to preload 'none' so it does not start
      // buffering on its own; the engine re-assigns the real ladder tier right
      // after the re-point via _ssApplyPreloadTiers (Req 1.1/1.4).
      preloadTier = 'none';
      try { el.preload = 'none'; el.setAttribute('preload', 'none'); } catch (e) {}
      // Re-seed sound from the SESSION preference, NOT this recycled element's
      // stale muted state. A pooled <mux-player> that last showed a muted clip
      // would otherwise stay muted even after the user chose sound-on — that's
      // the "re-mute on every clip while scrolling the feed" bug. The feed
      // recycles surfaces heavily (the fullscreen viewer barely does), which is
      // why it only showed there. Pre-unlock this resolves to muted (autoplay).
      muted = ssResolveSurfaceMuted(_ssAudioUnlocked, ssGetMutePref());
      el.muted = muted;                          // preserve unlocked/muted state (Req 2.5)
      try { if (muted) el.setAttribute('muted', ''); else el.removeAttribute('muted'); } catch (e) {}
      return el;
    },
    destroy: function () {
      if (el) {
        el.removeEventListener('timeupdate', handleTimeupdate);
        el.removeEventListener('ended', handleEnded);
        el.removeEventListener('error', handleError);
        el.removeEventListener('volumechange', handleVolumeChange);
        el.removeEventListener('canplay', handleCanPlay);
        el.removeEventListener('loadeddata', handleCanPlay);
        try { el.pause(); } catch (e) {}
        el.remove();
      }
      el = null; onTick = []; onEnd = []; onMute = [];
    },
  };
}

/**
 * ssCreateSurface — the single factory. The ONLY place that decides which
 * Media_Surface a clip gets. The engine never branches on surface type
 * elsewhere; both arms satisfy the same MediaSurfaceContract.
 */
function ssCreateSurface(clip, opts) {
  var isVideo = !!(clip && clip.muxPlaybackId);
  var surface = isVideo
    ? VideoSurface(clip, opts)      // real Mux video (HLS via <mux-player>)
    : GradientSurface(clip, opts);  // gradient fallback (no playback id)
  // Type tag so the Player_Pool can tell whether a freed slot's surface can be
  // re-pointed at an entering clip (same type) or must be rebuilt (Req 10.1).
  surface._ssIsVideo = isVideo;
  return surface;
}

/* ── Pure surface math (DOM-free, Node-testable) ─────────────────
   The testable primitives behind VideoSurface.getProgress/seek/setMuted.
   They take plain numbers / a stub media object { currentTime, duration,
   muted } and carry no DOM or global dependency, so the Node property
   tests can require them directly. VideoSurface (the Mux <mux-player>
   wrapper) calls these so its math is identical with or without a DOM. */

/**
 * ssClipProgress(currentTime, duration) — playback position as a fraction in
 * [0,1]. Returns 0 when duration is 0, undefined, or otherwise non-finite, and
 * clamps the result so it never escapes [0,1] (Req 5.4, 6.5).
 */
function ssClipProgress(currentTime, duration) {
  var d = Number(duration);
  if (!isFinite(d) || d <= 0) return 0;        // no/invalid duration → 0
  var t = Number(currentTime);
  if (!isFinite(t)) return 0;                  // no/invalid time → 0
  return Math.max(0, Math.min(1, t / d));      // clamp to [0,1]
}

/**
 * ssSeekToTime(fraction, duration) — the target playback time for a seek.
 * Clamps fraction to [0,1] and returns fraction * duration. Returns 0 for an
 * invalid duration (0/undefined/non-finite) so the seek is a safe no-op rather
 * than producing NaN (Req 5.5).
 */
function ssSeekToTime(fraction, duration) {
  var d = Number(duration);
  if (!isFinite(d) || d <= 0) return 0;        // invalid duration → no-op time
  var f = Number(fraction);
  if (!isFinite(f)) f = 0;                      // invalid fraction → start
  f = Math.max(0, Math.min(1, f));             // clamp to [0,1]
  return f * d;
}

/**
 * ssSetMediaMuted(media, m) — set the muted flag on a stub media object
 * { currentTime, duration, muted }. Coerces to a real boolean and returns the
 * media object (Req 6.4). Safe on a null media.
 */
function ssSetMediaMuted(media, m) {
  if (media) media.muted = !!m;
  return media;
}

/**
 * ssGetMediaMuted(media) — read the muted flag back as a boolean; false when
 * there is no media (Req 6.4).
 */
function ssGetMediaMuted(media) {
  return media ? !!media.muted : false;
}

/**
 * ssMuteRoundTrip(media, m) — apply a muted state then read it back. The pure
 * round-trip primitive behind VideoSurface.setMuted/isMuted: for any media and
 * any value m, ssMuteRoundTrip(media, m) === !!m (Req 6.4).
 */
function ssMuteRoundTrip(media, m) {
  return ssGetMediaMuted(ssSetMediaMuted(media, m));
}

/* ── Windowed / sliding-window preload math (DOM-free, Node-testable) ──
   Pure decision helpers behind the feed pager (task 7.3). They take plain
   numbers and carry no DOM/global dependency so the Node property tests can
   require them directly (Req 9.1, 9.3, 9.5). */

/* Feed paging knobs. */
var SS_CLIP_WINDOW = 10;       // clips fetched per window (Req 9.1/9.3)
var SS_PRELOAD_AHEAD = 2;      // look-ahead band set to preload="auto" (Req 9.2)
var SS_MAX_LIVE_PLAYERS = 2;   // cap on concurrently mounted players (Req 9.5).
                               // iOS uses native HLS (AVPlayer) with a hard limit on
                               // simultaneous decode pipelines; 4 concurrent <mux-player>
                               // sources exceeded it and the active clip stalled on its
                               // first frame. 2 (active + 1 neighbor) keeps the recycled
                               // pool but reliably leaves a decoder for the active clip.

/**
 * ssShouldFetchNextWindow(activeIdx, windowStart, totalLoaded, inFlight) —
 * decide whether to fetch the next window. True once the active clip reaches
 * windowStart + 6 (six into the current window), only when no fetch is already
 * in flight, the active clip is within what's loaded, and the active clip is at
 * the leading edge of what's loaded (so it fires once per window, not for old
 * windows the viewer scrolled back into) (Req 9.3).
 */
function ssShouldFetchNextWindow(activeIdx, windowStart, totalLoaded, inFlight) {
  if (inFlight) return false;
  if (activeIdx < 0 || activeIdx >= totalLoaded) return false;
  var threshold = (windowStart || 0) + 6;
  // Only trigger near the leading edge of loaded clips (within the last window).
  return activeIdx >= threshold && activeIdx >= totalLoaded - SS_CLIP_WINDOW;
}

/**
 * ssMountedPlayerSet(activeIdx, totalLoaded, maxLive) — the bounded set of clip
 * indices whose surface should stay mounted: a sliding band around the active
 * index (one behind, the rest ahead) of size at most maxLive (Req 9.5).
 * Returns a sorted array of in-range indices; size is always ≤ maxLive.
 */
function ssMountedPlayerSet(activeIdx, totalLoaded, maxLive) {
  var cap = (maxLive && maxLive > 0) ? maxLive : SS_MAX_LIVE_PLAYERS;
  if (!totalLoaded || totalLoaded <= 0 || activeIdx < 0 || activeIdx >= totalLoaded) return [];
  var band = Math.min(cap, totalLoaded);
  var start = activeIdx - 1;                      // bias one behind the active clip
  if (start + band > totalLoaded) start = totalLoaded - band;  // fit against the end
  if (start < 0) start = 0;
  // Guarantee the active clip is inside [start, start+band) so it stays mounted.
  if (activeIdx < start) start = activeIdx;
  else if (activeIdx >= start + band) start = activeIdx - band + 1;
  if (start < 0) start = 0;
  var set = [];
  for (var i = start; i < totalLoaded && set.length < band; i++) set.push(i);
  return set;
}

/**
 * ssPoolPlan(prevAssignment, mountedBand, poolSize) — the recycling decision for
 * the Player_Pool (clip-player-performance Phase 3, Req 2.1-2.3, 2.6; design
 * Property 5). PURE and Node-testable.
 *
 *   prevAssignment : { [clipIdx]: slotId } currently-mounted clip → pool slot.
 *   mountedBand    : array of clip indices that SHOULD be mounted now
 *                    (from ssMountedPlayerSet).
 *   poolSize       : SS_MAX_LIVE_PLAYERS (max live slots).
 *
 * Returns {
 *   assignment : { [clipIdx]: slotId },   // band clip → slot after recycle
 *   keep       : [clipIdx],               // already-mounted band clips (stay in place)
 *   repoint    : [{ clipIdx, slotId }],   // entering clips assigned a freed/empty slot
 *   release    : [clipIdx]                // leaving clips whose slot is reused (NOT destroyed)
 * }
 *
 * Invariants (enforced + asserted by the property test):
 *   - |assignment| ≤ poolSize
 *   - every band clip appears in assignment exactly once
 *   - no slot is shared by two clips
 *   - a clip in BOTH prevAssignment and band keeps its original slot (stability)
 *   - slots freed by `release` are exactly the slots offered to `repoint`
 *     (recycling, never destroy-and-recreate).
 */
function ssPoolPlan(prevAssignment, mountedBand, poolSize) {
  var cap = (poolSize && poolSize > 0) ? Math.floor(poolSize) : SS_MAX_LIVE_PLAYERS;
  var prev = (prevAssignment && typeof prevAssignment === 'object') ? prevAssignment : {};
  // De-dupe the band, keep only finite non-negative integers, cap at poolSize.
  var seen = {};
  var band = [];
  if (Array.isArray(mountedBand)) {
    for (var bi = 0; bi < mountedBand.length && band.length < cap; bi++) {
      var ci = mountedBand[bi];
      if (typeof ci === 'number' && isFinite(ci) && ci >= 0 && !seen[ci]) {
        seen[ci] = true; band.push(ci);
      }
    }
  }
  var bandSet = seen;

  var assignment = {};
  var keep = [];
  var repoint = [];
  var release = [];
  var usedSlots = {};

  // Pass 1 — clips already mounted that remain in band keep their slot (stable).
  for (var k = 0; k < band.length; k++) {
    var c = band[k];
    if (Object.prototype.hasOwnProperty.call(prev, c)) {
      var slot = prev[c];
      assignment[c] = slot;
      usedSlots[slot] = true;
      keep.push(c);
    }
  }

  // Leaving clips (mounted before, not in band now) → released; their slots free.
  var freed = [];
  for (var pc in prev) {
    if (!Object.prototype.hasOwnProperty.call(prev, pc)) continue;
    var pcNum = Number(pc);
    if (!bandSet[pcNum]) {
      release.push(pcNum);
      freed.push(prev[pc]);
    }
  }

  // Build the free-slot pool: released slots first (reuse), then any never-used
  // slot ids in [0, cap) not currently held by a kept clip.
  var freeSlots = [];
  for (var f = 0; f < freed.length; f++) {
    if (!usedSlots[freed[f]]) { freeSlots.push(freed[f]); usedSlots[freed[f]] = true; }
  }
  for (var s = 0; s < cap; s++) {
    if (!usedSlots[s]) { freeSlots.push(s); usedSlots[s] = true; }
  }

  // Pass 2 — entering clips (in band, not previously mounted) take a free slot.
  var fp = 0;
  for (var e = 0; e < band.length; e++) {
    var ec = band[e];
    if (Object.prototype.hasOwnProperty.call(assignment, ec)) continue;  // already kept
    var slotId = freeSlots[fp++];
    assignment[ec] = slotId;
    repoint.push({ clipIdx: ec, slotId: slotId });
  }

  return { assignment: assignment, keep: keep, repoint: repoint, release: release };
}

/**
 * ssNetworkTier(effectiveType) — classify the connection into a Network_Tier
 * (clip-player-performance Phase 5, Req 4.1, 4.5; design Property 2). Total and
 * never throws: any unknown/absent input falls back to the safe 'medium' tier.
 *   'slow-2g','2g'    → 'slow'
 *   '3g'              → 'medium'
 *   '4g' (and better) → 'fast'
 *   undefined/unknown → 'medium'
 */
function ssNetworkTier(effectiveType) {
  switch (effectiveType) {
    case 'slow-2g':
    case '2g': return 'slow';
    case '3g': return 'medium';
    case '4g': return 'fast';
    default:   return 'medium';
  }
}

/**
 * ssNetworkPolicy(tier) — map a Network_Tier to the preload depth and the
 * resolution ceiling (Req 4.2, 4.3, 4.4, 4.6; design Property 3). Pure; an
 * unknown tier falls back to the medium row. preloadDepth strictly increases
 * slow<medium<fast; maxResolution is non-decreasing across the same order.
 */
function ssNetworkPolicy(tier) {
  // Single source of truth: the per-tier tunables SS_PREFETCH_DEPTH + SS_RES_CAP
  // (defined above). Unknown/garbage tier falls back to the medium row.
  var t = (tier === 'slow' || tier === 'fast') ? tier : 'medium';
  return { preloadDepth: SS_PREFETCH_DEPTH[t], maxResolution: SS_RES_CAP[t] };
}

/**
 * ssPreloadAction(state) — the bandwidth-discipline decision (Req 5.1-5.5;
 * design Property 4). The active clip ALWAYS wins the pipe.
 *   state = { activeReady, inFlight, warmed, preloadDepth }
 *   - active not ready            → 'pause'  (regardless of everything else)
 *   - inFlight > 1                → 'cancel' (single in-flight discipline)
 *   - warmed >= preloadDepth      → 'idle'   (look-ahead window full)
 *   - active ready, inFlight == 0 → 'start'  (begin/resume the single prefetch)
 *   - otherwise (one in flight)   → 'idle'   (let it finish)
 * Pure and total; non-numeric fields default to 0.
 */
function ssPreloadAction(state) {
  var s = (state && typeof state === 'object') ? state : {};
  var activeReady = !!s.activeReady;
  var inFlight = (typeof s.inFlight === 'number' && isFinite(s.inFlight) && s.inFlight > 0) ? s.inFlight : 0;
  var warmed = (typeof s.warmed === 'number' && isFinite(s.warmed) && s.warmed > 0) ? s.warmed : 0;
  var depth = (typeof s.preloadDepth === 'number' && isFinite(s.preloadDepth) && s.preloadDepth > 0) ? s.preloadDepth : 0;
  if (!activeReady) return 'pause';
  if (inFlight > 1) return 'cancel';
  if (warmed >= depth) return 'idle';
  if (inFlight === 0) return 'start';
  return 'idle';
}

/**
 * ssPreloadTier(distance, networkTier, depthByTier) — pure preload-priority
 * ladder for the feed (feed-clip-load-performance Phase 1, Req 1.1, 1.3, 1.5,
 * 1.6). Maps a clip's signed distance from the active clip to an HTML media
 * `preload` tier. The active clip is the ONLY clip ever 'auto'.
 *
 *   - distance === 0 (strict numeric)                 → 'auto'
 *   - 1 <= distance <= depth (finite number)          → 'metadata'
 *   - everything else (behind active, beyond depth,
 *     NaN/Infinity, non-number, garbage)              → 'none'
 *
 * Prefetch depth resolution (defensive, total):
 *   - depthByTier is a finite positive number         → use that number
 *   - depthByTier is an object                        → depthByTier[networkTier]
 *     (when it is a finite positive number)
 *   - otherwise                                       → ssNetworkPolicy(networkTier).preloadDepth
 *     (an unknown/garbage tier falls back to the medium row via ssNetworkPolicy).
 *
 * Pure: no DOM, no network, deterministic; never throws on any input.
 */
function ssPreloadTier(distance, networkTier, depthByTier) {
  // Resolve the prefetch depth from the most specific source available.
  var depth;
  if (typeof depthByTier === 'number' && isFinite(depthByTier) && depthByTier > 0) {
    depth = depthByTier;
  } else if (depthByTier !== null && typeof depthByTier === 'object') {
    // Only index by a primitive key — using an object as a property key coerces
    // it via toString(), which THROWS on a malformed object (totality bug).
    var tierKey = (typeof networkTier === 'string' || typeof networkTier === 'number') ? networkTier : undefined;
    var byTier = (tierKey !== undefined) ? depthByTier[tierKey] : undefined;
    if (typeof byTier === 'number' && isFinite(byTier) && byTier > 0) depth = byTier;
  }
  if (typeof depth !== 'number' || !isFinite(depth) || depth <= 0) {
    var pol = ssNetworkPolicy(networkTier);
    depth = (pol && typeof pol.preloadDepth === 'number' && isFinite(pol.preloadDepth) && pol.preloadDepth > 0)
      ? pol.preloadDepth
      : 2; // last-resort medium default; never reached for the documented tiers.
  }

  // The active clip (strict numeric 0) is the only surface that ever fully preloads.
  if (distance === 0) return 'auto';
  // Upcoming clips inside the tier's prefetch window get lightweight metadata.
  if (typeof distance === 'number' && isFinite(distance) && distance >= 1 && distance <= depth) return 'metadata';
  // Behind the active clip, beyond the window, or any non-finite/garbage input.
  return 'none';
}

/**
 * ssShouldDeepen(state) — progressive-deepening gate for the feed
 * (feed-clip-load-performance Phase 2, Req 2.1-2.5; design Property 3/4). Spare
 * bandwidth deepens an upcoming clip ONLY when EVERY gate passes; the active clip
 * always wins the pipe. Pure, total, deterministic; never throws.
 *
 *   state = { activeBufferSatisfied, distance, networkTier, budgetRemainingBytes,
 *             nextSegmentBytes, dwell, dwellThreshold, maxDistance }
 *
 * Returns TRUE iff ALL hold (else false; any missing/non-finite/wrong-type → false):
 *   - state is an object AND activeBufferSatisfied === true
 *   - distance is a finite number with 1 <= distance <= maxDistance (maxDistance finite)
 *   - distance <= ssNetworkPolicy(networkTier).preloadDepth
 *   - budgetRemainingBytes and nextSegmentBytes finite AND budgetRemainingBytes > nextSegmentBytes
 *   - dwell and dwellThreshold finite AND dwell >= dwellThreshold
 */
function ssShouldDeepen(state) {
  if (!state || typeof state !== 'object') return false;
  var isNum = function (x) { return typeof x === 'number' && isFinite(x); };

  // Gate 1 — the active clip's buffer must be satisfied (active always wins).
  if (state.activeBufferSatisfied !== true) return false;

  // Gate 2 — distance is a finite, in-range look-ahead position.
  if (!isNum(state.distance) || !isNum(state.maxDistance)) return false;
  if (!(state.distance >= 1 && state.distance <= state.maxDistance)) return false;

  // Gate 3 — distance is within the network tier's prefetch depth.
  var pol = ssNetworkPolicy(state.networkTier);
  var depth = (pol && isNum(pol.preloadDepth)) ? pol.preloadDepth : NaN;
  if (!isNum(depth)) return false;
  if (!(state.distance <= depth)) return false;

  // Gate 4 — the session byte budget must cover the next segment.
  if (!isNum(state.budgetRemainingBytes) || !isNum(state.nextSegmentBytes)) return false;
  if (!(state.budgetRemainingBytes > state.nextSegmentBytes)) return false;

  // Gate 5 — the viewer has dwelt long enough on the active clip.
  if (!isNum(state.dwell) || !isNum(state.dwellThreshold)) return false;
  if (!(state.dwell >= state.dwellThreshold)) return false;

  return true;
}

/**
 * ssSplashLift(state) — cold-start splash-lane decision
 * (feed-clip-load-performance Phase 3, Req 5.3-5.5; design Property 5).
 *
 *   state = { floorElapsed, clipReady, ceilingReached }   (booleans, coerced via !!)
 *
 * Returns 'lift' when ceilingReached OR (floorElapsed AND clipReady), else 'hold'.
 * Ceiling precedence guarantees the splash can never hang. Pure, total,
 * deterministic; never throws/blocks on null/garbage input (every field coerced).
 */
function ssSplashLift(state) {
  var s = (state && typeof state === 'object') ? state : {};
  var ceiling = !!s.ceilingReached;
  var floor   = !!s.floorElapsed;
  var ready   = !!s.clipReady;
  return (ceiling || (floor && ready)) ? 'lift' : 'hold';
}

/**
 * ssSegmentEvictionPlan(input) — service-worker Segment_Cache eviction planner
 * (feed-clip-load-performance Phase 4, Req 4.4-4.6, 9.1, 10.1; design Property
 * 6/7/8/9). Operates on a snapshot the SW passes in. Pure, total, deterministic;
 * never throws.
 *
 *   input = { segments:[{key,bytes,lastUsed,clipDistance}], ceilingBytes,
 *             windowAhead, windowBehind }
 *
 * Algorithm:
 *   (1) a segment is OUT-OF-WINDOW iff clipDistance < -windowBehind OR
 *       clipDistance > windowAhead → evict ALL of them first;
 *   (2) among IN-WINDOW segments, if total kept bytes > ceilingBytes, evict LRU
 *       (smallest/oldest lastUsed first) until kept bytes <= ceiling. Documented
 *       floor: a single in-window segment larger than the ceiling is kept (we
 *       never drop the last in-window segment), preferring the most-recently-used.
 *
 * Output partitions the input keys exactly: every well-formed input segment's key
 * appears in exactly one of evict/keep. Defensive: non-object input, non-array
 * segments, or non-finite ceilingBytes/windowAhead/windowBehind → { evict:[], keep:[] };
 * malformed segment entries are skipped safely.
 */
function ssSegmentEvictionPlan(input) {
  var empty = { evict: [], keep: [] };
  if (!input || typeof input !== 'object') return empty;
  var isNum = function (x) { return typeof x === 'number' && isFinite(x); };

  var segments = input.segments;
  if (!Array.isArray(segments)) return empty;
  if (!isNum(input.ceilingBytes) || !isNum(input.windowAhead) || !isNum(input.windowBehind)) return empty;

  var ceiling = input.ceilingBytes;
  var ahead   = input.windowAhead;
  var behind  = input.windowBehind;

  // Sanitize: skip malformed segment entries (never throw, never partition garbage).
  var valid = [];
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    if (!seg || typeof seg !== 'object') continue;
    if (typeof seg.key !== 'string') continue;
    if (!isNum(seg.bytes) || !isNum(seg.lastUsed) || !isNum(seg.clipDistance)) continue;
    valid.push(seg);
  }

  // Step 1 — evict every out-of-window segment.
  var evict = [];
  var inWindow = [];
  for (var j = 0; j < valid.length; j++) {
    var s = valid[j];
    if (s.clipDistance < -behind || s.clipDistance > ahead) evict.push(s);
    else inWindow.push(s);
  }

  // Step 2 — LRU-by-bytes among in-window: oldest lastUsed first, until within
  // the ceiling. Sort ascending so the front is the least-recently-used; never
  // shed the last remaining in-window segment (documented floor).
  inWindow.sort(function (a, b) { return a.lastUsed - b.lastUsed; });
  var keptBytes = 0;
  for (var k = 0; k < inWindow.length; k++) keptBytes += inWindow[k].bytes;
  var keep = inWindow.slice();
  while (keptBytes > ceiling && keep.length > 1) {
    var victim = keep.shift();   // oldest in-window
    evict.push(victim);
    keptBytes -= victim.bytes;
  }

  return {
    evict: evict.map(function (e) { return e.key; }),
    keep:  keep.map(function (e) { return e.key; })
  };
}

/* ═══════════════════════════════════════════════════════════════
   feed-follows ranker — pure helpers (no DOM, no network, no globals,
   never throw, Node-testable). Dual-exported (window.* + module.exports)
   below so the fast-check property tests can require them.
   See .kiro/specs/feed-follows (design.md).
   ═══════════════════════════════════════════════════════════════ */

// feed-follows ranker: a Fire (the like) is a stronger trust signal than a view.
var SS_FEED_FIRE_WEIGHT = 3;
var SS_FEED_VIEW_WEIGHT = 1;

/**
 * ssPopularityScore(clip) — popularity score from public signals only
 * (feed-follows ranker; Req 3.1, 1.4). Reads ONLY `fires_count` and
 * `views_count` (Public_Signals — scoreboard-safe), never any private metric.
 * Integer-valued (`f·3 + v·1`) so popularity comparison is exact; non-finite or
 * negative inputs clamp to 0. Pure, total, deterministic; never throws.
 */
function ssPopularityScore(clip) {
  var f = (clip && Number.isFinite(+clip.fires_count)) ? Math.max(0, +clip.fires_count) : 0;
  var v = (clip && Number.isFinite(+clip.views_count)) ? Math.max(0, +clip.views_count) : 0;
  return f * SS_FEED_FIRE_WEIGHT + v * SS_FEED_VIEW_WEIGHT;
}

/* Seeded PRNG (feed-follows ranker; Req 1.5, 6.4, 10.2) — a tiny, dependency-free
   pure PRNG that keeps Tier 5 deterministic and stable across pages for a fixed
   seed. Internal (underscore-prefixed) helpers; ssRankFeed calls them in-module. */

// xmur3: hash an arbitrary string seed → 32-bit unsigned integer (returns a generator).
function _ssXmur3(str) {
  var h = 1779033703 ^ String(str).length;
  for (var i = 0; i < String(str).length; i++) {
    h = Math.imul(h ^ String(str).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
}
// mulberry32: 32-bit seed → deterministic [0,1) generator.
function _ssMulberry32(seed) {
  var a = (typeof seed === 'number') ? (seed >>> 0) : _ssXmur3(seed)();
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Fisher–Yates over a COPY, driven by the seeded generator (NO input mutation).
function _ssSeededShuffle(arr, rng) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

// feed-follows ranker: Recency_Window — a clip is "recent" if its created_at is
// within the last 14 days relative to `now` (Glossary Recency_Window; Req 1.6).
var SS_FEED_RECENCY_MS = 1209600000; // 14 * 24 * 60 * 60 * 1000

// _ssFeedCreatedAtMs(clip) — coerce a clip's created_at to ms-epoch, total &
// never-throwing. Number → use if finite; string → Date.parse (NaN on garbage);
// anything else → NaN. NaN is treated as "not recent" by callers.
function _ssFeedCreatedAtMs(clip) {
  var ca = clip && clip.created_at;
  if (typeof ca === 'number') return isFinite(ca) ? ca : NaN;
  if (typeof ca === 'string') return Date.parse(ca); // NaN if unparseable
  return NaN;
}

/**
 * ssFeedTier(clip, { followIds, now }) — assign a single ELIGIBLE clip to exactly
 * one of 5 mutually-exclusive, exhaustive tiers (feed-follows ranker; Req 1.1,
 * 1.6, 2.2, 5.3). Assumes eligibility (status/deleted_at filtering + dedupe) is
 * handled by ssRankFeed — it does not re-check eligibility here.
 *
 *   followed = followIds has clip.creator_id
 *   recent   = createdAtMs is finite AND >= now - SS_FEED_RECENCY_MS
 *   popular  = ssPopularityScore(clip) > 0   (has any public engagement)
 *
 *   Tier 1: recent && followed                       (recent from followed)
 *   Tier 2: recent && !followed                      (recent from non-followed)
 *   Tier 3: !recent && followed                      (older from followed)
 *   Tier 4: !recent && !followed && popular          (older global popular)
 *   Tier 5: otherwise (!recent && !followed && !popular)  (long tail)
 *
 * Pure, total, deterministic; never throws (a null/garbage clip → followed=false,
 * createdAtMs=NaN→recent=false, popular=0 → Tier 5). Returns an integer 1..5.
 */
function ssFeedTier(clip, opts) {
  opts = opts || {};
  var followIds = opts.followIds;
  var now = _ssFeedSafeNum(opts.now); // crash-proof: hostile `now` can't throw (totality)
  if (!isFinite(now)) now = 0; // keep total: non-finite now ⇒ recent=false for positive timestamps

  var followed = !!(followIds && typeof followIds.has === 'function' && followIds.has(clip && clip.creator_id));
  var createdAtMs = _ssFeedCreatedAtMs(clip);
  var recent = isFinite(createdAtMs) && createdAtMs >= (now - SS_FEED_RECENCY_MS);
  var popular = ssPopularityScore(clip) > 0;

  if (recent && followed) return 1;
  if (recent && !followed) return 2;
  if (!recent && followed) return 3;
  if (!recent && !followed && popular) return 4;
  return 5; // !recent && !followed && !popular
}

/* ── ssRankFeed internal helpers (feed-follows ranker) ──────────────
   All pure, total, never-throwing. Used only by ssRankFeed. */

// Crash-proof numeric coercion (totality; Req 8.3/8.4/8.5). Number()/+v invokes
// ToPrimitive, which THROWS for hostile objects (e.g. { toString: 0 } — a
// non-callable toString poisons the conversion). Guard it so a malformed `now`
// (or any value) can never throw: returns a finite number when coercible, else NaN.
function _ssFeedSafeNum(v) {
  try { var n = Number(v); return isFinite(n) ? n : NaN; } catch (e) { return NaN; }
}

// Collect non-empty string ids from an Array or a Set into a Set<string>.
function _ssCollectStringIds(x) {
  var out = new Set();
  if (!x) return out;
  if (Array.isArray(x)) {
    for (var i = 0; i < x.length; i++) {
      var v = x[i];
      if (typeof v === 'string' && v.length > 0) out.add(v);
    }
    return out;
  }
  if (typeof Set !== 'undefined' && x instanceof Set) {
    x.forEach(function (v) { if (typeof v === 'string' && v.length > 0) out.add(v); });
    return out;
  }
  return out;
}

// Normalise any accepted Follow_Graph shape → Set<string> of creator ids
// (Req 5.2, 8.3). Accepts { creatorIds: [...]|Set }, a bare array, a bare Set,
// or null/garbage → empty Set.
function _ssNormalizeFollowIds(followGraph) {
  if (Array.isArray(followGraph) || (typeof Set !== 'undefined' && followGraph instanceof Set)) {
    return _ssCollectStringIds(followGraph);
  }
  if (followGraph && typeof followGraph === 'object') {
    var ci = followGraph.creatorIds;
    if (Array.isArray(ci) || (typeof Set !== 'undefined' && ci instanceof Set)) {
      return _ssCollectStringIds(ci);
    }
  }
  return new Set();
}

// Normalise any accepted Seen_State shape → { available:boolean, set:Set<string> }
// (Req 4.1, 4.5, 8.4). A bare array → available. { available:true, seen:[...]|Set }
// → available. null / { available:false } / malformed → unavailable.
function _ssNormalizeSeen(seenState) {
  var raw = null;
  var available = false;
  if (Array.isArray(seenState)) {
    raw = seenState; available = true;
  } else if (seenState && typeof seenState === 'object'
      && seenState.available === true
      && (Array.isArray(seenState.seen) || (typeof Set !== 'undefined' && seenState.seen instanceof Set))) {
    raw = seenState.seen; available = true;
  }
  return { available: available, set: available ? _ssCollectStringIds(raw) : new Set() };
}

// Ascending id comparator (string compare) — the universal tie-break.
function _ssCmpIdAsc(a, b) {
  return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
}
// Tiers 1 & 2: created_at DESC, id ASC tie-break. NaN created_at → -Infinity
// (sorts last) so the comparator stays total (recent tiers should never have NaN).
function _ssCmpRecencyDesc(a, b) {
  var am = _ssFeedCreatedAtMs(a); if (!isFinite(am)) am = -Infinity;
  var bm = _ssFeedCreatedAtMs(b); if (!isFinite(bm)) bm = -Infinity;
  if (am !== bm) return bm - am;
  return _ssCmpIdAsc(a, b);
}
// Tiers 3 & 4: ssPopularityScore DESC, id ASC tie-break.
function _ssCmpPopularityDesc(a, b) {
  var as = ssPopularityScore(a), bs = ssPopularityScore(b);
  if (as !== bs) return bs - as;
  return _ssCmpIdAsc(a, b);
}

/**
 * ssRankFeed(input) — the tiered, trust-weighted feed ranker (feed-follows core).
 *
 * @param {object} input
 *   candidateSet : Array<CandidateEntry>  — live clip candidates (may contain junk)
 *   followGraph  : { creatorIds:string[]|Set } | string[] | Set | null
 *   seenState    : { available:boolean, seen:string[]|Set } | string[] | Set | null
 *   seed         : number | string        — explicit randomization source (Req 10.2)
 *   now          : number                  — ranking reference time, ms epoch (Req 1.6)
 * @returns {string[]} Ranked_List — ordered, de-duplicated clip ids.
 *
 * PURE, TOTAL, DETERMINISTIC. Never mutates inputs (works on copies), performs no
 * DOM/network/global access, and never throws. Reads ONLY id, creator_id,
 * created_at, fires_count, views_count (+ status/deleted_at for eligibility) — never
 * any private metric (Req 3 scoreboard safety); foreign fields are inert (Req 3.5).
 * See .kiro/specs/feed-follows (design.md §"ssRankFeed(input)").
 */
function ssRankFeed(input) {
  input = (input && typeof input === 'object') ? input : {};

  // ── STEP 1: defensively normalise inputs (totality; Req 8.3/8.4/8.5) ──
  var now = _ssFeedSafeNum(input && input.now);
  if (!isFinite(now)) now = 0;                 // deterministic fallback
  var followIds = _ssNormalizeFollowIds(input.followGraph);
  var seen = _ssNormalizeSeen(input.seenState);
  var seed = (input.seed === undefined || input.seed === null) ? 0 : input.seed;
  if (typeof seed !== 'number' && typeof seed !== 'string') {
    // Coerce exotic seed values to a deterministic safe primitive; String() can
    // itself throw (e.g. an object with toString:false) so guard it (totality).
    try { seed = String(seed); } catch (_seedErr) { seed = 0; }
  }

  // ── STEP 2: filter to eligible + de-dup by id, first occurrence wins
  //    (Req 2.1, 9.2, 9.4, 8.5). Preserve input order for pre-sort stability. ──
  var candidateSet = Array.isArray(input.candidateSet) ? input.candidateSet : [];
  var eligible = [];
  var seenIds = new Set();
  for (var i = 0; i < candidateSet.length; i++) {
    var e = candidateSet[i];
    if (e === null || typeof e !== 'object') continue;
    // Eligibility honours status/deleted_at ONLY WHEN PRESENT (design §"CandidateEntry"):
    // the candidate query already filters to status='live' / deleted_at IS NULL and
    // selects neither column (Req 3.3 — public-signals-only), so a real candidate row
    // carries no `status` field. An ABSENT status (undefined) is therefore eligible;
    // a PRESENT status must equal 'live' exactly (case-sensitive) or the row is dropped.
    if (e.status !== undefined && e.status !== 'live') continue;         // present ⇒ must be exactly 'live'
    if (!(e.deleted_at === null || e.deleted_at === undefined)) continue; // present ⇒ must be null
    if (typeof e.id !== 'string' || e.id.length === 0) continue;
    if (seenIds.has(e.id)) continue;                                     // dedupe: keep first
    seenIds.add(e.id);
    eligible.push(e);
  }

  // ── STEP 3: assign each eligible clip to exactly one tier (Req 1.1, 2.2) ──
  var buckets = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  var tierOpts = { followIds: followIds, now: now };
  for (var j = 0; j < eligible.length; j++) {
    var clip = eligible[j];
    buckets[ssFeedTier(clip, tierOpts)].push(clip);
  }

  // Build the seeded RNG once; Tier 5 consumes its stream (deterministic per seed).
  var rng = _ssMulberry32(seed);

  // ── STEP 4: order WITHIN each tier, then optionally seen-partition ──
  // Produce a seen-INDEPENDENT base order per tier, then stable-partition it into
  // unseen-then-seen sub-blocks when seen-state is available. Because the base
  // order does not depend on seen-state, a newly-seen clip can only move from the
  // unseen block down into the seen block — never up (monotonicity, Req 4.6).
  function orderTier(tier) {
    var members = buckets[tier];
    var base;
    if (tier === 1 || tier === 2) {
      base = members.slice().sort(_ssCmpRecencyDesc);                    // created_at desc, id asc
    } else if (tier === 3 || tier === 4) {
      base = members.slice().sort(_ssCmpPopularityDesc);                 // score desc, id asc
    } else {
      // Tier 5: canonical id-sorted base, then deterministic seeded shuffle.
      var canonical = members.slice().sort(_ssCmpIdAsc);
      base = _ssSeededShuffle(canonical, rng);
    }
    if (!seen.available) return base;
    var unseenBlock = [];
    var seenBlock = [];
    for (var k = 0; k < base.length; k++) {
      if (seen.set.has(base[k].id)) seenBlock.push(base[k]);
      else unseenBlock.push(base[k]);
    }
    return unseenBlock.concat(seenBlock);
  }

  // ── STEP 5: concatenate tiers 1..5 and return the id array (Req 1.2, 2.3) ──
  var result = [];
  for (var t = 1; t <= 5; t++) {
    var ordered = orderTier(t);
    for (var m = 0; m < ordered.length; m++) result.push(ordered[m].id);
  }
  return result;
}

/**
 * ssSliceRankedPage(rankedIds, limit, offset) — turn a Ranked_List plus a
 * (limit, offset) into a contiguous page of ids (feed-follows; Req 6). Pure,
 * total, never throws: non-array input, non-positive/garbage limit,
 * negative/garbage offset, or an offset past the end all yield an empty page.
 * Because every page is a slice of the SAME cached rankedIds, consecutive pages
 * are contiguous, non-overlapping, and skip nothing (Req 6.2), and never
 * re-order or re-shuffle (Req 6.3). See .kiro/specs/feed-follows
 * (design.md §"ssSliceRankedPage").
 */
function ssSliceRankedPage(rankedIds, limit, offset) {
  if (!Array.isArray(rankedIds)) return [];
  var n = Number(limit), off = Number(offset);
  if (!Number.isInteger(n) || n <= 0) return [];          // non-positive/garbage limit
  if (!Number.isInteger(off) || off < 0) return [];        // negative/garbage offset
  if (off >= rankedIds.length) return [];                  // past the end
  return rankedIds.slice(off, off + n);
}

/* ═══════════════════════════════════════════════════════════════
   PWA Black Screen Load — Phase 1 pure helpers (no DOM, no network,
   never throw, Node-testable). They reconcile the three first-frame
   "stories" into exactly one coherent, non-black layer, and decide when
   the body must be revealed. Dual-exported (window.* + module.exports)
   below so the fast-check tests can require them.
   See .kiro/specs/pwa-black-screen-load (design.md, Phase 1).
   ═══════════════════════════════════════════════════════════════ */

/**
 * ssResolveFirstFrame — reconcile the splash / skeleton / shell first-frame
 * stories into exactly ONE coherent layer, with the body always revealed
 * (never a held-black document, no double-skeleton). Pure.
 *
 *   state = {
 *     navType:                'cold-launch' | 'internal-nav' | 'bfcache-restore',
 *     standalone:             boolean,   // installed-app display mode
 *     splashShownThisSession: boolean,   // splash already shown once this session
 *     haveFeedCache:          boolean,   // per-user feed cache present
 *     page:                   'feed'|'discover'|'watchlist'|'profile'|'settings'|'stack'
 *   }
 *
 * Decision rows (in order):
 *   visibleLayer = 'splash'   iff standalone && !splashShownThisSession && navType==='cold-launch'
 *   else         = 'skeleton' iff page==='feed' && !haveFeedCache
 *   else         = 'shell'
 *   revealBody   = true ALWAYS
 *
 * Defensive: missing/loose fields are coerced (booleans via !!, strings via String()).
 */
function ssResolveFirstFrame(state) {
  var s = state || {};
  var navType    = String(s.navType);
  var standalone = !!s.standalone;
  var splashShown = !!s.splashShownThisSession;
  var haveFeedCache = !!s.haveFeedCache;
  var page = String(s.page);

  var visibleLayer;
  if (standalone && !splashShown && navType === 'cold-launch') {
    visibleLayer = 'splash';
  } else if (page === 'feed' && !haveFeedCache) {
    visibleLayer = 'skeleton';
  } else {
    visibleLayer = 'shell';
  }

  return { visibleLayer: visibleLayer, revealBody: true };
}

/**
 * ssShouldRevealBody — return true for every real document-load reveal event,
 * so the body is revealed on internal MPA navigations and not only on persisted
 * bfcache restores. True for 'DOMContentLoaded' and for 'pageshow' regardless of
 * evt.persisted (true/false/undefined). Pure.
 */
function ssShouldRevealBody(evt) {
  var type = evt && evt.type;
  return type === 'DOMContentLoaded' || type === 'pageshow';
}

/**
 * ssNavStrategy — resolve the cross-document navigation strategy (Phase 2).
 * Pure: the env booleans are computed by the caller (matchMedia +
 * 'startViewTransition' detection); this helper never touches the DOM.
 *
 *   env = {
 *     supportsViewTransition: boolean,  // browser supports cross-document View Transitions
 *     reducedMotion:          boolean,  // prefers-reduced-motion: reduce
 *   }
 *
 * Returns 'view-transition' IFF (supportsViewTransition === true AND
 * reducedMotion === false); every other combination → 'instant'. When
 * 'view-transition' the caller skips the manual ssNavigate opacity fade (the
 * browser owns the animation); when 'instant' it degrades to today's instant
 * cut. Defensive: missing/loose fields coerce via !! so a bad env resolves to
 * 'instant' rather than throwing.
 */
function ssNavStrategy(env) {
  var e = env || {};
  var supportsViewTransition = !!e.supportsViewTransition;
  var reducedMotion = !!e.reducedMotion;
  return (supportsViewTransition && !reducedMotion) ? 'view-transition' : 'instant';
}

/**
 * ssResolveKillSwitches — resolve the effective on/off state of every Pipeline
 * capability from a (possibly partial / unreadable) raw flag map plus the
 * documented `defaults` (prefetch-cache-pipeline Property 8 / Req 10.2, 10.5).
 *
 * Pure: no DOM, no network, no localStorage. The impure shell reads the raw
 * `ss_ff_*` flags off storage and passes them in as `rawFlags`.
 *
 *   rawFlags — a map of `{ capability: boolean }`; may be partial, empty, or
 *              unreadable (null / non-object / array).
 *   defaults — the documented `{ capability: boolean }` defaults map; its key
 *              set defines exactly which capabilities are resolved.
 *
 * Rules:
 *   • Result carries an effective boolean for EVERY capability in `defaults`
 *     and no others (key set === keys(defaults)).
 *   • A flag PRESENT in a readable rawFlags overrides its default (coerced to
 *     boolean); an ABSENT flag takes its documented default (coerced to boolean).
 *   • When rawFlags is UNREADABLE (null / non-object / array) EVERY capability
 *     takes its documented default — never a mix of present + defaulted flags
 *     (the all-or-defaults rule that prevents a half-configured pipeline).
 *
 * Total, deterministic, never throws. A non-object `defaults` yields `{}`.
 */
function ssResolveKillSwitches(rawFlags, defaults) {
  var out = {};
  // A non-object/array defaults map has no capability set → nothing to resolve.
  if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults)) return out;
  // rawFlags is only "readable" when it is a plain object (not null/array).
  var readable = !!rawFlags && typeof rawFlags === 'object' && !Array.isArray(rawFlags);
  for (var cap in defaults) {
    if (!Object.prototype.hasOwnProperty.call(defaults, cap)) continue;
    var def = !!defaults[cap];
    if (readable && Object.prototype.hasOwnProperty.call(rawFlags, cap)) {
      out[cap] = !!rawFlags[cap];   // present flag overrides its default
    } else {
      out[cap] = def;               // absent (or unreadable path) → documented default
    }
  }
  return out;
}

/**
 * ssShouldPrewarm — the single cross-page prewarm gate (prefetch-cache-pipeline
 * Property 1 / Req 1.3, 3.3, 3.5). The idle loop calls this once per candidate
 * Target_Page to decide whether to warm it this Feed session.
 *
 * Pure: no DOM, no network, no localStorage. The impure shell (ssPrewarmPages)
 * supplies the current page and the session `doneSet`.
 *
 *   targetPage  — the page being considered for prewarm.
 *   currentPage — the page the viewer is on right now (skip it).
 *   doneSet     — a Set of Target_Page names already warmed this session.
 *
 * Returns `true` IFF ALL hold:
 *   • targetPage is a known Target_Page — a string in {'discover','watchlist'}
 *     (case-sensitive; the ONLY two pages eligible for cross-page prewarm), AND
 *   • targetPage !== currentPage (never prewarm the page already on screen), AND
 *   • targetPage is NOT already in `doneSet` (warm at most once per session).
 * Every other input — unknown / non-string page, target equal to current,
 * target already warmed, or a `doneSet` that is not a Set — returns `false`.
 *
 * Total, deterministic, never throws.
 */
function ssShouldPrewarm(targetPage, currentPage, doneSet) {
  // Known Target_Pages — the only two pages eligible for cross-page prewarm.
  var isKnown = (targetPage === 'discover' || targetPage === 'watchlist');
  if (!isKnown) return false;
  if (targetPage === currentPage) return false;             // skip the current page
  if ((doneSet instanceof Set) && doneSet.has(targetPage)) return false; // skip already-warmed
  return true;
}

/**
 * ssPosterPrewarmList — pick the poster URLs to decode for a Target_Page's
 * cross-page prewarm (prefetch-cache-pipeline Property 2 / Req 2.1, 2.4, 2.6).
 *
 * Pure: no DOM, no network, no localStorage. The impure shell (ssPrewarmPages)
 * feeds the result to `_ssWarmImage` to decode posters into the browser cache.
 *
 *   pageData — the Target_Page's Page_Data (an array of clip-shaped entries).
 *   count    — how many posters to decode (e.g. SS_PREWARM_POSTER_COUNT).
 *
 * Scans `pageData` IN ORDER, collecting the `posterUrl` of every entry that
 * HAS one — a non-null object whose `posterUrl` is a non-empty string — and
 * skipping every entry that does not (missing/empty/non-string posterUrl, or
 * non-object junk). Returns the FIRST `count` of those collected URLs, so the
 * result length is `min(count, number-of-entries-with-a-poster)`: it never
 * exceeds `count` (R2.6) and never pads beyond the posters that actually exist
 * (R2.4); every returned element is a real poster URL drawn in order (R2.1).
 *
 *   • Non-array `pageData` → `[]`.
 *   • Non-finite / non-number `count` → `[]`.
 *   • `count` is floored at 0 (negative or fractional counts are clamped).
 *
 * Total, deterministic, never throws.
 */
function ssPosterPrewarmList(pageData, count) {
  if (!Array.isArray(pageData)) return [];
  if (typeof count !== 'number' || !isFinite(count)) return [];
  var n = Math.max(0, Math.floor(count));
  var out = [];
  for (var i = 0; i < pageData.length && out.length < n; i++) {
    var e = pageData[i];
    if (e && typeof e === 'object' && typeof e.posterUrl === 'string' && e.posterUrl.length > 0) {
      out.push(e.posterUrl);
    }
  }
  return out;
}

/* The canonical Scoreboard denylist — the private engagement totals that MUST
   NEVER enter a cached/prefetched payload (prefetch-cache-pipeline Req 11.2).
   Defined as a named constant so the gate is auditable and trivial to extend:
   adding a new private total is a one-line edit here. Every field listed is
   stripped by ssPublicSignalsOnly before any write to any Storage_Tier. */
var SS_SCOREBOARD_DENYLIST = [
  'fires_received', 'fires_received_total', 'watch_taps', 'watch_it_taps',
];

/**
 * ssPublicSignalsOnly — the SACRED "hide the scoreboard" gate every cached /
 * prefetched payload passes through (prefetch-cache-pipeline Property 3 /
 * Req 11.1–11.4). Strips every Scoreboard field so private engagement totals
 * can never leak into a cache, while preserving every Public_Signal verbatim.
 *
 * Pure: no DOM, no network, no localStorage; never mutates its input.
 *
 *   record — a source clip/page record (may carry Public_Signals, Scoreboard
 *            fields, both, or neither).
 *
 * Returns a SHALLOW COPY of `record` with every field on SS_SCOREBOARD_DENYLIST
 * removed (fires_received, fires_received_total, watch_taps, watch_it_taps) and
 * every other field — all Public_Signals (fires_count, views_count, follower
 * counts, id, caption, posterUrl, muxPlaybackId, titleLinks) and any other
 * non-denylisted field — kept exactly as-is (R11.1, R11.2, R11.3). A record
 * carrying BOTH kinds returns its public fields rather than being skipped /
 * emptied (R11.4).
 *
 *   • Non-object input (null/undefined/number/string/boolean/array) → `{}`.
 *   • Idempotent: sanitizing an already-sanitized record is a fixpoint.
 *
 * Total, deterministic, never throws.
 */
function ssPublicSignalsOnly(record) {
  // Non-object (incl. null and arrays) → empty object: nothing public to keep.
  if (record === null || typeof record !== 'object' || Array.isArray(record)) return {};
  var out = {};
  var keys = Object.keys(record);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (SS_SCOREBOARD_DENYLIST.indexOf(k) === -1) {
      out[k] = record[k];
    }
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════
   DMCA / MODERATION SCAFFOLDING — Phase 1 pure correctness helpers
   (no DOM, no network, never throw, dual-exported; Node-testable).
   Mirror the ssStackCanView pattern: these decide UI/UX and feed the
   server-side re-validation — they are NEVER the security boundary
   (the database — RLS + SECURITY DEFINER RPCs + triggers — is).
   See .kiro/specs/dmca-moderation-scaffolding.
   ═══════════════════════════════════════════════════════════════ */

/* Parse a value into a finite epoch-ms timestamp, or null when it is not a
   valid/parseable finite timestamp. Accepts a finite number (epoch ms), a Date,
   or a Date-parseable string. Tolerant: anything else → null (never throws). */
function _ssParseTimestamp(v) {
  if (v == null) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (v instanceof Date) { var dt = v.getTime(); return isFinite(dt) ? dt : null; }
  if (typeof v === 'string') { var t = Date.parse(v); return isNaN(t) ? null : t; }
  return null;
}

/* Numeric/semantic-tolerant version compare → -1 | 0 | 1 (a vs b). Strips a
   leading 'v'/'V', splits on '.', pads the shorter with '0' segments, compares
   purely-numeric segments numerically and any other segment lexically. So
   '1' === '1.0', '1.2' < '1.10', and date labels ('2024-01-01') still order
   sensibly. Tolerant of null/number/string; never throws. */
function _ssCompareVersion(a, b) {
  function segs(v) {
    return String(v == null ? '' : v).trim().replace(/^[vV]/, '').split('.');
  }
  var pa = segs(a), pb = segs(b);
  var n = Math.max(pa.length, pb.length);
  for (var i = 0; i < n; i++) {
    var sa = pa[i] !== undefined ? pa[i] : '0';
    var sb = pb[i] !== undefined ? pb[i] : '0';
    var aNum = /^\d+$/.test(sa.trim());
    var bNum = /^\d+$/.test(sb.trim());
    if (aNum && bNum) {
      var na = parseInt(sa, 10), nb = parseInt(sb, 10);
      if (na !== nb) return na < nb ? -1 : 1;
    } else {
      if (sa < sb) return -1;
      if (sa > sb) return 1;
    }
  }
  return 0;
}

/* True iff `v` is a string whose trimmed length is within [min, max] inclusive.
   Whitespace-only strings have trimmed length 0 → fail a min of 1. */
function _ssTrimmedLenInBounds(v, min, max) {
  if (typeof v !== 'string') return false;
  var len = v.trim().length;
  return len >= min && len <= max;
}

/* Req 1.8 — Upload attestation completeness. Returns true IFF the attestation
   records a non-empty accepting user id, a valid acceptance timestamp, a
   non-empty ToS version, a non-empty attestation version, AND both recorded
   versions are >= requiredVersion. Null/undefined attestation → false. A
   missing requiredVersion (null/undefined/blank) is the lowest possible bound,
   so any recorded version satisfies it. Tolerant of malformed input; never
   throws. (Validates Req 1.8 — Property 1.) */
function ssAttestationComplete(attestation, requiredVersion) {
  if (!attestation || typeof attestation !== 'object') return false;
  var userId = attestation.curator_id || attestation.accepting_user_id;
  if (typeof userId !== 'string' || userId.trim() === '') return false;
  if (_ssParseTimestamp(attestation.accepted_at) === null) return false;
  var tos = attestation.tos_version;
  var att = attestation.attestation_version;
  if (typeof tos !== 'string' || tos.trim() === '') return false;
  if (typeof att !== 'string' || att.trim() === '') return false;
  var reqMissing = requiredVersion == null ||
    (typeof requiredVersion === 'string' && requiredVersion.trim() === '');
  if (reqMissing) return true;
  return _ssCompareVersion(tos, requiredVersion) >= 0 &&
         _ssCompareVersion(att, requiredVersion) >= 0;
}

/* Req 3.2/3.4/3.6 — DMCA takedown-notice well-formedness. PURE: no side effects,
   does NOT mutate `notice`. Returns { ok, missing } where `missing` lists the
   stable key of each failing element (work_identification | target |
   complainant_name | complainant_email | good_faith | accuracy_authority |
   signature) and ok === (missing.length === 0). Null/undefined notice → every
   key missing. Whitespace-only strings count as empty; over-bound strings fail.
   (Validates Req 3.2, 3.4, 3.6 — Property 2.) */
function ssDmcaNoticeWellFormed(notice) {
  var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  var missing = [];
  var n = (notice && typeof notice === 'object') ? notice : null;

  // work_identification: string, trimmed length 1..2000
  if (!n || !_ssTrimmedLenInBounds(n.work_identification, 1, 2000)) missing.push('work_identification');

  // target: a non-empty content_id OR a target_url string trimmed length 1..2000
  var contentIdOk = !!n && typeof n.content_id === 'string' && n.content_id.trim().length >= 1;
  var targetUrlOk = !!n && _ssTrimmedLenInBounds(n.target_url, 1, 2000);
  if (!(contentIdOk || targetUrlOk)) missing.push('target');

  // complainant_name: string, trimmed length 1..200
  if (!n || !_ssTrimmedLenInBounds(n.complainant_name, 1, 200)) missing.push('complainant_name');

  // complainant_email: matches local@domain.tld
  if (!n || typeof n.complainant_email !== 'string' || !EMAIL_RE.test(n.complainant_email)) missing.push('complainant_email');

  // good_faith / accuracy_authority: strict boolean true
  if (!n || n.good_faith !== true) missing.push('good_faith');
  if (!n || n.accuracy_authority !== true) missing.push('accuracy_authority');

  // signature: string, trimmed length 1..200
  if (!n || !_ssTrimmedLenInBounds(n.signature, 1, 200)) missing.push('signature');

  return { ok: missing.length === 0, missing: missing };
}

/* Req 4.9 — Public-surface visibility predicate, mirroring the read_live_content
   RLS policy. Returns true IFF content.status === 'live' AND content.deleted_at
   is unset (null/undefined); false otherwise (explicitly false when status is
   'removed' or deleted_at is set). Null/undefined content → false. `viewerId` is
   accepted for signature symmetry; visibility does not depend on it. (Validates
   Req 4.9 — Property 4.) */
function ssContentPubliclyVisible(content, viewerId) {
  if (!content || typeof content !== 'object') return false;
  return content.status === 'live' && content.deleted_at == null;
}

/* Req 5.1–5.8 — Onboarding consent completeness (beta-consent-gate Property 1-4).
   PURE: no side effects, does NOT mutate `consent`, deterministic, never throws.
   Returns the strict boolean `true` IFF `consent` is a non-null object AND
   consent.affirmative === true (strict) AND consent.age18plus === true (strict)
   AND consent.tos_version is a string with trimmed length >= 1 AND
   consent.privacy_version is a string with trimmed length >= 1; else strict
   `false`. Truthy non-booleans (1, 'true') are rejected via strict === true.
   null/undefined/non-object → false. This is the gate's enable condition and the
   spec the ss_record_consent RPC re-validation honors — never the security
   boundary. (Validates Req 5.1–5.8 — Properties 1-4.) */
function ssConsentComplete(consent) {
  if (!consent || typeof consent !== 'object') return false;
  if (consent.affirmative !== true) return false;
  if (consent.age18plus !== true) return false;
  if (typeof consent.tos_version !== 'string' || consent.tos_version.trim().length < 1) return false;
  if (typeof consent.privacy_version !== 'string' || consent.privacy_version.trim().length < 1) return false;
  return true;
}

/* Req 9.11 — Curator Terms acceptance validity (beta-consent-gate Property 6-7).
   PURE: no side effects, does NOT mutate `acceptance`, deterministic, never
   throws. Returns the strict boolean `true` IFF `acceptance` is a non-null object
   AND acceptance.affirmative === true (strict) AND acceptance.curator_version is a
   string with trimmed length >= 1; else strict `false`. Truthy non-booleans are
   rejected via strict === true. null/undefined/non-object → false. Sibling to
   ssConsentComplete; the spec the ss_record_curator_terms RPC re-validation
   honors — never the security boundary. (Validates Req 9.11 — Properties 6-7.) */
function ssCuratorTermsAccepted(acceptance) {
  if (!acceptance || typeof acceptance !== 'object') return false;
  if (acceptance.affirmative !== true) return false;
  if (typeof acceptance.curator_version !== 'string' || acceptance.curator_version.trim().length < 1) return false;
  return true;
}

/* Req 1.4 / 8.3 — Counsel-review marker decision (beta-consent-gate Property 5).
   PURE: no side effects, does NOT mutate `body`, deterministic, never throws.
   Returns the strict boolean `true` IFF `body` is NOT a non-empty string (i.e.
   not a string, or an empty string) OR `body` contains a bracketed [..]
   placeholder token (matches /\[[^\]]+\]/); otherwise `false`. The fail-safe on
   non-strings keeps the visible "counsel review required" banner up whenever the
   body cannot be confirmed bracket-free. (Validates Req 1.4, 8.3 — Property 5.) */
function ssPolicyNeedsCounselReview(body) {
  if (typeof body !== 'string' || body.length === 0) return true;
  return /\[[^\]]+\]/.test(body);
}

if (typeof window !== 'undefined') {
  window.ssAttestationComplete    = ssAttestationComplete;
  window.ssDmcaNoticeWellFormed   = ssDmcaNoticeWellFormed;
  window.ssContentPubliclyVisible = ssContentPubliclyVisible;
  window.ssConsentComplete         = ssConsentComplete;
  window.ssCuratorTermsAccepted    = ssCuratorTermsAccepted;
  window.ssPolicyNeedsCounselReview = ssPolicyNeedsCounselReview;
}

/* ── DMCA / Moderation Scaffolding — Phase 1 impure RPC-wrapper helpers ──
   IMPURE (touch the network) → window-only, NOT added to module.exports. They
   mirror the established RPC-wrapper shape (ssLoadSharedStackById / ssJoinStack /
   ssCheckUsernameAvailable): guard window.ssDB / window.ssCurrentUser, fail soft
   (no-op + return a safe value the caller can branch on), and NEVER throw. The
   database (SECURITY DEFINER RPCs + RLS + triggers) is the security boundary —
   these wrappers drive UI/UX only and feed the server's own re-validation. */

/* Record a curator's accepted attestation for a clip via the ss_record_attestation
   SECURITY DEFINER RPC (curator_id = auth.uid(), accepted_at = now() server-side).
   Returns { ok:true } on success, or { ok:false, error } on guest/invalid-id/RPC
   failure — the caller surfaces "attestation could not be saved" and leaves the
   clip in its current status (Req 1.4). Never throws. */
async function ssRecordAttestation(clipId, tosVersion, attestationVersion) {
  var fail = { ok: false, error: 'attestation could not be saved' };
  if (!window.ssDB || !window.ssCurrentUser) return fail;
  try {
    var me = window.ssCurrentUser();
    if (!me || !_ssIsUuid(clipId)) return fail;
    var res = await window.ssDB.rpc('ss_record_attestation', {
      p_clip_id: clipId,
      p_tos_version: tosVersion,
      p_attestation_version: attestationVersion
    });
    if (res.error) { console.warn('SS ss_record_attestation:', res.error.message); return fail; }
    return { ok: true };
  } catch (e) { return fail; }
}

/* Submit a copyright takedown notice. Gates FIRST with the pure
   ssDmcaNoticeWellFormed (UX only — the Edge Function and the RPC re-validate
   server-side); if not well-formed, returns { ok:false, missing } WITHOUT any
   network call. Otherwise POSTs the notice to the public submit-takedown Edge
   Function via the established functions.invoke channel (same call style as
   tmdb-providers / mux-upload-url). Returns { ok:true, confirmation_ref } on
   success, { ok:false, missing } when the server reports failing elements, or
   { ok:false, error } on any other failure. Never throws. */
async function ssSubmitTakedown(notice) {
  // Client-side well-formedness gate (no network call when it fails) — Req 3.4.
  var gate = (typeof ssDmcaNoticeWellFormed === 'function')
    ? ssDmcaNoticeWellFormed(notice)
    : { ok: false, missing: [] };
  if (!gate.ok) return { ok: false, missing: gate.missing || [] };

  var fail = { ok: false, error: 'takedown could not be submitted' };
  if (!window.ssDB || !window.ssDB.functions) return fail;
  try {
    var res = await window.ssDB.functions.invoke('submit-takedown', { body: notice });
    var data = res && res.data;
    // A server-side re-validation failure (rare — the client gate already passed)
    // surfaces the failing element keys so the caller can name them.
    if (data && data.ok === false && Array.isArray(data.missing)) {
      return { ok: false, missing: data.missing };
    }
    if (res && res.error) { console.warn('SS submit-takedown:', res.error.message); return fail; }
    if (data && data.confirmation_ref) return { ok: true, confirmation_ref: data.confirmation_ref };
    return fail;
  } catch (e) { return fail; }
}

/* Load an immutable, addressable policy version via the ss_get_policy_version
   RPC (returns the EXACT stored body/version/effective_date — never a
   substitute). Returns { ok:true, policy:{ doc, version, effective_date, body } }
   on success, or { ok:false, error } when the (doc, version) is unavailable
   (Req 2.8). Never throws. */
async function ssLoadPolicyVersion(doc, ver) {
  var fail = { ok: false, error: 'policy version unavailable' };
  if (!window.ssDB) return fail;
  try {
    var res = await window.ssDB.rpc('ss_get_policy_version', { p_doc: doc, p_version: ver });
    if (res.error || !res.data) {
      if (res.error) console.warn('SS ss_get_policy_version:', res.error.message);
      return fail;
    }
    // The RPC may return a single jsonb object or a single-row array; normalize.
    var row = Array.isArray(res.data) ? res.data[0] : res.data;
    if (!row) return fail;
    return {
      ok: true,
      policy: {
        doc: row.doc,
        version: row.version,
        effective_date: row.effective_date,
        body: row.body
      }
    };
  } catch (e) { return fail; }
}

/* ── beta-consent-gate (Req 6 / 9.5–9.8 / 4.1 / 9.3) ──────────────────────────
   Three IMPURE, window-only client wrappers. Like ssRecordAttestation /
   ssLoadPolicyVersion they drive UI/UX only — the database (SECURITY DEFINER
   RPCs + own-row RLS + per-kind check constraints in 0031) is the security
   boundary and re-validates every write. All three are fail-soft and NEVER
   throw, and are exposed on window.* ONLY (NOT in module.exports — impure). */

/* Record the onboarding DPDP affirmative consent + 18+ acknowledgement via the
   ss_record_consent SECURITY DEFINER RPC (subject_id = auth.uid(),
   accepted_at = now() server-side). Gates FIRST with the pure ssConsentComplete
   so a malformed consent makes NO network call (Req 6.5/6.6). Lazily mints an
   anonymous session when none exists (Design Decision 1 — only here, at
   advance). Returns { ok:true, id } on success (Req 6.2) or { ok:false, error }
   on a missing client / unresolved identity / RPC error (Req 6.3/6.4). Never
   throws (Req 6.7). */
async function ssRecordConsent(consent) {
  var fail = { ok: false, error: 'consent could not be saved' };
  // 1. Gate FIRST — no RPC when the consent is incomplete (Req 6.5/6.6).
  if (typeof ssConsentComplete !== 'function' || !ssConsentComplete(consent)) return fail;
  // 2. Require the client (Req 6.3).
  if (!window.ssDB || !window.ssCurrentUser) return fail;
  try {
    // 3. Resolve identity; lazily mint an anonymous session when none exists,
    //    then re-read. Still none ? fail with NO RPC (Req 6.3/3.6).
    var me = window.ssCurrentUser();
    if (!me) {
      try { await window.ssDB.auth.signInAnonymously(); } catch (e) { return fail; }
      me = window.ssCurrentUser();
    }
    if (!me) return fail;
    // 4. Record via the RPC (server re-validates + sets subject_id/accepted_at).
    var res = await window.ssDB.rpc('ss_record_consent', {
      p_affirmative: true,
      p_age18plus: true,
      p_tos_version: consent.tos_version,
      p_privacy_version: consent.privacy_version
    });
    // 5. RPC error ? fail (Req 6.4) ; else parse the jsonb result for the id.
    if (res.error) { console.warn('SS ss_record_consent:', res.error.message); return fail; }
    var row = Array.isArray(res.data) ? res.data[0] : res.data;
    return { ok: true, id: row && row.id };
  } catch (e) { return fail; }
}

/* Record the one-time Become-a-Curator Terms acceptance via the
   ss_record_curator_terms SECURITY DEFINER RPC. Mirrors ssRecordConsent: gates
   FIRST with the pure ssCuratorTermsAccepted (no RPC when invalid — Req 9.14),
   requires the client, and resolves identity via the SAME lazy
   ssCurrentUser() ? signInAnonymously() path (the curator step normally already
   has a permanent session; still null ? no RPC — Req 9.6/9.8). Returns
   { ok:true, id } on success (Req 9.5) or { ok:false, error } on RPC error
   (Req 9.8). Never throws — the caller (bcActivate) flips users.role ONLY on
   { ok:true }. */
async function ssRecordCuratorTerms(acceptance) {
  var fail = { ok: false, error: 'acceptance could not be saved' };
  // 1. Gate FIRST — no RPC when the acceptance is invalid (Req 9.14).
  if (typeof ssCuratorTermsAccepted !== 'function' || !ssCuratorTermsAccepted(acceptance)) return fail;
  // 2. Require the client.
  if (!window.ssDB || !window.ssCurrentUser) return fail;
  try {
    // 3. Resolve identity via the SAME lazy path ssRecordConsent uses (Req 9.6/9.8).
    var me = window.ssCurrentUser();
    if (!me) {
      try { await window.ssDB.auth.signInAnonymously(); } catch (e) { return fail; }
      me = window.ssCurrentUser();
    }
    if (!me) return fail;
    // 4. Record via the RPC (the RPC IS the affirmative act; server re-validates).
    var res = await window.ssDB.rpc('ss_record_curator_terms', {
      p_curator_version: acceptance.curator_version
    });
    // 5. RPC error ? fail (Req 9.8) ; else parse the jsonb result for the id.
    if (res.error) { console.warn('SS ss_record_curator_terms:', res.error.message); return fail; }
    var row = Array.isArray(res.data) ? res.data[0] : res.data;
    return { ok: true, id: row && row.id };
  } catch (e) { return fail; }
}

/* Resolve the SINGLE current policy versions ONCE for the version contract —
   a direct read of the world-readable policy_versions table (is_current = true,
   deleted_at is null). Default (no opts / opts.curator falsy) resolves
   ('tos','privacy') and returns { ok:true, tos, privacy } ONLY when BOTH resolve,
   else { ok:false } (Req 4.1). With { curator:true } it ALSO resolves 'curator'
   and returns ok:true only when the curator row resolves (including tos/privacy
   when present), else { ok:false } (Req 9.3/9.4). Fail-soft, never throws. */
async function ssCurrentPolicyVersions(opts) {
  var fail = { ok: false };
  if (!window.ssDB) return fail;
  var wantCurator = !!(opts && opts.curator === true);
  var docs = wantCurator ? ['tos', 'privacy', 'curator'] : ['tos', 'privacy'];
  try {
    var res = await window.ssDB
      .from('policy_versions')
      .select('doc, version, effective_date')
      .eq('is_current', true)
      .is('deleted_at', null)
      .in('doc', docs);
    if (res.error || !Array.isArray(res.data)) {
      if (res.error) console.warn('SS policy_versions:', res.error.message);
      return fail;
    }
    var byDoc = {};
    res.data.forEach(function (r) {
      if (r && r.doc) byDoc[r.doc] = { version: r.version, effective_date: r.effective_date };
    });
    var out = { ok: true };
    if (byDoc.tos) out.tos = byDoc.tos;
    if (byDoc.privacy) out.privacy = byDoc.privacy;
    if (byDoc.curator) out.curator = byDoc.curator;
    if (wantCurator) {
      // Curator step: ok only when the curator row resolves (Req 9.3/9.4).
      if (!byDoc.curator) return fail;
    } else {
      // Gate: ok only when BOTH tos and privacy resolve (Req 4.1).
      if (!byDoc.tos || !byDoc.privacy) return fail;
    }
    return out;
  } catch (e) { return fail; }
}

if (typeof window !== 'undefined') {
  window.ssRecordAttestation = ssRecordAttestation;
  window.ssSubmitTakedown    = ssSubmitTakedown;
  window.ssLoadPolicyVersion = ssLoadPolicyVersion;
  // beta-consent-gate impure wrappers — window-only (NOT in module.exports).
  window.ssRecordConsent        = ssRecordConsent;
  window.ssRecordCuratorTerms   = ssRecordCuratorTerms;
  window.ssCurrentPolicyVersions = ssCurrentPolicyVersions;
}

/* Expose consistently with the other ss* helpers (window in the browser),
   plus a guarded CommonJS export so the Node property tests can require these
   pure primitives — mirrors the data/showshak-data.js dual-export precedent. */
if (typeof window !== 'undefined') {
  window.ssResolveFirstFrame = ssResolveFirstFrame;
  window.ssShouldRevealBody = ssShouldRevealBody;
  window.ssNavStrategy = ssNavStrategy;
  window.ssResolveKillSwitches = ssResolveKillSwitches;
  window.ssShouldPrewarm = ssShouldPrewarm;
  window.ssPosterPrewarmList = ssPosterPrewarmList;
  window.ssPublicSignalsOnly = ssPublicSignalsOnly;
  window.SS_SCOREBOARD_DENYLIST = SS_SCOREBOARD_DENYLIST;
  window.ssClipProgress = ssClipProgress;
  window.ssSeekToTime = ssSeekToTime;
  window.ssSetMediaMuted = ssSetMediaMuted;
  window.ssGetMediaMuted = ssGetMediaMuted;
  window.ssMuteRoundTrip = ssMuteRoundTrip;
  window.ssShouldFetchNextWindow = ssShouldFetchNextWindow;
  window.ssMountedPlayerSet = ssMountedPlayerSet;
  window.ssResolveSurfaceMuted = ssResolveSurfaceMuted;
  window.ssPoolPlan = ssPoolPlan;
  window.ssNetworkTier = ssNetworkTier;
  window.ssNetworkPolicy = ssNetworkPolicy;
  window.ssPreloadAction = ssPreloadAction;
  window.ssPreloadTier = ssPreloadTier;
  window.ssShouldDeepen = ssShouldDeepen;
  window.ssSplashLift = ssSplashLift;
  window.ssSegmentEvictionPlan = ssSegmentEvictionPlan;
  // feed-follows ranker — pure helpers
  window.ssPopularityScore = ssPopularityScore;
  window.SS_FEED_FIRE_WEIGHT = SS_FEED_FIRE_WEIGHT;
  window.SS_FEED_VIEW_WEIGHT = SS_FEED_VIEW_WEIGHT;
  window.ssFeedTier = ssFeedTier;
  window.SS_FEED_RECENCY_MS = SS_FEED_RECENCY_MS;
  window.ssRankFeed = ssRankFeed;
  window.ssSliceRankedPage = ssSliceRankedPage;
}
if (typeof module !== 'undefined' && module.exports) {
  // PWA Black Screen Load — Phase 1 pure helpers
  module.exports.ssResolveFirstFrame = ssResolveFirstFrame;
  module.exports.ssShouldRevealBody = ssShouldRevealBody;
  module.exports.ssNavStrategy = ssNavStrategy;
  module.exports.ssResolveKillSwitches = ssResolveKillSwitches;
  module.exports.ssShouldPrewarm = ssShouldPrewarm;
  module.exports.ssPosterPrewarmList = ssPosterPrewarmList;
  module.exports.ssPublicSignalsOnly = ssPublicSignalsOnly;
  module.exports.SS_SCOREBOARD_DENYLIST = SS_SCOREBOARD_DENYLIST;
  module.exports.ssClipProgress = ssClipProgress;
  module.exports.ssSeekToTime = ssSeekToTime;
  module.exports.ssSetMediaMuted = ssSetMediaMuted;
  module.exports.ssGetMediaMuted = ssGetMediaMuted;
  module.exports.ssMuteRoundTrip = ssMuteRoundTrip;
  module.exports.ssMapContentRowsToClips = ssMapContentRowsToClips;
  module.exports.ssNormalizeCuratorUsername = ssNormalizeCuratorUsername;
  module.exports.ssResolveCuratorViewModel = ssResolveCuratorViewModel;
  module.exports.ssShouldFetchNextWindow = ssShouldFetchNextWindow;
  module.exports.ssMountedPlayerSet = ssMountedPlayerSet;
  module.exports.ssShouldShowTapToPlay = ssShouldShowTapToPlay;
  module.exports.ssResolveSurfaceMuted = ssResolveSurfaceMuted;
  module.exports.ssPoolPlan = ssPoolPlan;
  module.exports.ssNetworkTier = ssNetworkTier;
  module.exports.ssNetworkPolicy = ssNetworkPolicy;
  module.exports.ssPreloadAction = ssPreloadAction;
  module.exports.ssPreloadTier = ssPreloadTier;
  module.exports.ssShouldDeepen = ssShouldDeepen;
  module.exports.ssSplashLift = ssSplashLift;
  module.exports.ssSegmentEvictionPlan = ssSegmentEvictionPlan;
  // feed-follows ranker — pure helpers
  module.exports.ssPopularityScore = ssPopularityScore;
  module.exports.SS_FEED_FIRE_WEIGHT = SS_FEED_FIRE_WEIGHT;
  module.exports.SS_FEED_VIEW_WEIGHT = SS_FEED_VIEW_WEIGHT;
  module.exports.ssFeedTier = ssFeedTier;
  module.exports.SS_FEED_RECENCY_MS = SS_FEED_RECENCY_MS;
  module.exports.ssRankFeed = ssRankFeed;
  module.exports.ssSliceRankedPage = ssSliceRankedPage;
  module.exports.SS_CLIP_WINDOW = SS_CLIP_WINDOW;
  module.exports.SS_PRELOAD_AHEAD = SS_PRELOAD_AHEAD;
  module.exports.SS_MAX_LIVE_PLAYERS = SS_MAX_LIVE_PLAYERS;
  module.exports.ssCreateSurface = ssCreateSurface;
  module.exports.VideoSurface = VideoSurface;
  module.exports.GradientSurface = GradientSurface;
  // Curator Upload v2 — pure helpers
  module.exports.ssValidatePitch = ssValidatePitch;
  module.exports.SS_PITCH_MAX = SS_PITCH_MAX;
  module.exports.SS_PITCH_SWEET_MIN = SS_PITCH_SWEET_MIN;
  module.exports.SS_PITCH_SWEET_MAX = SS_PITCH_SWEET_MAX;
  module.exports.ssTrimDuration = ssTrimDuration;
  module.exports.ssValidateTrim = ssValidateTrim;
  module.exports.ssIsFullSourceTrim = ssIsFullSourceTrim;
  module.exports.SS_DURATION_CAP = SS_DURATION_CAP;
  module.exports.ssValidateMediaFile = ssValidateMediaFile;
  module.exports.SS_FILE_SIZE_CAP = SS_FILE_SIZE_CAP;
  module.exports.ssGenreUnion = ssGenreUnion;
  module.exports.ssBuildTitleLinks = ssBuildTitleLinks;
  module.exports.ssCanPublish = ssCanPublish;
  module.exports.ssCoverThumbUrl = ssCoverThumbUrl;
  module.exports.ssParseCoverTime = ssParseCoverTime;
  module.exports.ssResolveWatchOptions = ssResolveWatchOptions;
  module.exports.ssResolveWatchOptionsForTitles = ssResolveWatchOptionsForTitles;
  module.exports.ssDraftToRow = ssDraftToRow;
  module.exports.ssDraftToLinks = ssDraftToLinks;
  module.exports.ssRowToDraft = ssRowToDraft;
  module.exports.ssBuildEditPatch = ssBuildEditPatch;

  // Curator Role Persistence — pure onboarding patch builder
  module.exports.ssBuildOnboardingPatch = ssBuildOnboardingPatch;
  // Creator Analytics — Event_Recorder pure helpers
  module.exports.ssIsRecordableClipId = ssIsRecordableClipId;
  module.exports.ssResolveEventUserId = ssResolveEventUserId;
  module.exports.ssShouldRecordView = ssShouldRecordView;
  module.exports.ssBuildViewEvent = ssBuildViewEvent;
  module.exports.ssBuildShareEvent = ssBuildShareEvent;
  module.exports.ssBuildWatchEvent = ssBuildWatchEvent;
  // Stack Sharing — pure visibility / placement / collaboration rules
  module.exports.SS_STACK_MEMBER_CAP   = SS_STACK_MEMBER_CAP;
  module.exports.ssStackCanView        = ssStackCanView;
  module.exports.ssStackIsListed       = ssStackIsListed;
  module.exports.ssStackShelfPlacement = ssStackShelfPlacement;
  module.exports.ssCanContribute       = ssCanContribute;
  module.exports.ssCanJoinStack        = ssCanJoinStack;
  module.exports.ssCanRemoveStackItem  = ssCanRemoveStackItem;

  // Stack Folder View — pure preview / attribution / share-option rules
  module.exports.SS_STACK_PREVIEW_CAP    = SS_STACK_PREVIEW_CAP;
  module.exports.ssStackPreviewClips     = ssStackPreviewClips;
  module.exports.ssStackContributors     = ssStackContributors;
  module.exports.ssShareVisibilityOptions = ssShareVisibilityOptions;

  // Creator Analytics — Analytics_Reader counting-model helpers (exec spec of 0019)
  module.exports.ssCountWithSelfCollapse = ssCountWithSelfCollapse;
  module.exports.ssCountWatch = ssCountWatch;
  module.exports.ssCountFires = ssCountFires;
  module.exports.ssFilterOwnClips = ssFilterOwnClips;
  module.exports.ssWeeklyTrend = ssWeeklyTrend;
  module.exports.ssEventInsertAccepted = ssEventInsertAccepted;

  // DMCA / Moderation Scaffolding — Phase 1 pure correctness helpers
  module.exports.ssAttestationComplete    = ssAttestationComplete;
  module.exports.ssDmcaNoticeWellFormed   = ssDmcaNoticeWellFormed;
  module.exports.ssContentPubliclyVisible = ssContentPubliclyVisible;

  // beta-consent-gate — pure consent + curator-terms + counsel-review helpers
  module.exports.ssConsentComplete          = ssConsentComplete;
  module.exports.ssCuratorTermsAccepted     = ssCuratorTermsAccepted;
  module.exports.ssPolicyNeedsCounselReview = ssPolicyNeedsCounselReview;
}

/* ── Mute_Preference ─────────────────────────────
   Persisted muted-state module backed by localStorage (distinct from the
   Stacks/Following sessionStorage so the sound choice survives tab close).
   Default: sound ON (muted === false). Falls back to an in-memory value in
   private/blocked mode so sound still toggles for the session. */
var SS_MUTE_KEY = 'ss_mute_pref_v1';
var _ssMuteListeners = [];
var _ssMuteFallback = false;          // in-memory fallback (default: sound ON)

function ssGetMutePref() {
  try { return JSON.parse(localStorage.getItem(SS_MUTE_KEY)) === true; }
  catch (e) { return _ssMuteFallback; }   // private/blocked -> in-memory
}
function ssSetMutePref(muted) {
  try { localStorage.setItem(SS_MUTE_KEY, JSON.stringify(!!muted)); }
  catch (e) { _ssMuteFallback = !!muted; } // private mode -> in-memory
  _ssMuteListeners.forEach(function (fn) { try { fn(!!muted); } catch (e) {} });
}
function ssOnMuteChange(fn) {
  if (typeof fn === 'function') _ssMuteListeners.push(fn);
}

/**
 * ssMakeProgressBar — the single Progress_Bar factory, driven by Media_Surface
 * progress, used in both INLINE and FULLSCREEN modes. Produces
 * .ss-progress > .ss-progress-fill and exposes set(fraction) (clamped 0..1)
 * and el.
 */
function ssMakeProgressBar(container) {
  var wrap = document.createElement('div');
  wrap.className = 'ss-progress';
  var fill = document.createElement('div');
  fill.className = 'ss-progress-fill';
  fill.style.width = '0%';
  wrap.appendChild(fill);
  container.appendChild(wrap);
  return {
    set: function (fraction) {
      fill.style.width = (Math.max(0, Math.min(1, fraction)) * 100) + '%';
    },
    el: wrap,
  };
}
// Wiring (same in both modes):  surface.onTimeupdate(function (p) { progressBar.set(p); });

/**
 * ssAttachGestures — the unified Gesture_Handler used by both modes.
 *   single tap (deferred ~310ms) -> engine.togglePause(idx)
 *   double tap  (gap < 300ms, within 40px) -> engine.fire(idx, x, y)
 * Binds click + touchend. The FULLSCREEN viewer wires this per tap zone
 * (ssOpenClip); the old _ssvAttachDoubleTap has been removed.
 */
function ssAttachGestures(tapZoneEl, idx, engine) {
  var lastTap = 0, timer = null, lastX = 0, lastY = 0, lastTouch = 0;
  function onTap(x, y) {
    var now = Date.now(), gap = now - lastTap;
    var near = Math.abs(x - lastX) < 40 && Math.abs(y - lastY) < 40;
    lastX = x; lastY = y;
    if (gap > 0 && gap < 300 && near) {        // QUICK DOUBLE TAP -> fire
      clearTimeout(timer); timer = null;
      lastTap = 0;                              // reset so the next tap starts fresh
      engine.fire(idx, x, y);                   // guest-gated inside engine.fire
    } else {                                    // possible SINGLE -> wait briefly for a 2nd tap
      lastTap = now;
      clearTimeout(timer);
      timer = setTimeout(function () { engine.togglePause(idx); }, 260);
    }
  }
  // Touch path. We also record the touch time so the synthetic mouse "click"
  // the browser fires ~300ms later can be ignored — otherwise ONE physical
  // tap is counted twice and mis-registers as a double-tap (the fire bug).
  tapZoneEl.addEventListener('touchend', function (e) {
    lastTouch = Date.now();
    var t = e.changedTouches && e.changedTouches[0];
    if (t) onTap(t.clientX, t.clientY);
  }, { passive: true });
  // Mouse/desktop path. Ignore the click that is merely the echo of a touch.
  tapZoneEl.addEventListener('click', function (e) {
    if (Date.now() - lastTouch < 600) return;
    onTap(e.clientX, e.clientY);
  });
}

/**
 * ssClipOrdering — the Recommendation_Seam. The ONLY ordering entry point the
 * engine uses. Today it delegates to _ssvBuildList (start clip + genre-related
 * + rest); swap its body later (e.g. fetch a recommendation feed) without
 * touching engine internals.
 */
function ssClipOrdering(clicked, list) {
  return _ssvBuildList(clicked, list);   // today: genre-segment ordering
}

/* ── Mute_Preference live re-apply ───────────────
   Registered AFTER the Mute_Preference module (above) so _ssMuteListeners
   exists. Whenever the preference changes (from the corner mute control in
   either mode), re-apply it to the active surface and repaint the mute icon. */
ssOnMuteChange(function (muted) {
  if (typeof _ssvSurfaces !== 'undefined') {
    var surface = _ssvSurfaces[_ssvActiveIdx];
    if (surface) surface.setMuted(muted);
  }
  // INLINE host: re-apply to its active surface too (only once audio is
  // unlocked; before the first gesture the first clip stays forced-muted).
  if (typeof _inlineSurfaces !== 'undefined' && _ssAudioUnlocked) {
    var inlineSurface = _inlineSurfaces[_inlineActiveIdx];
    if (inlineSurface) inlineSurface.setMuted(muted);
  }
  // Paint from the active surface's REAL muted state when we have one (it was
  // just set above), falling back to the preference — so the icon always
  // reflects actual audio, never just intent.
  if (typeof _ssvPaintMuteBtn === 'function') {
    var act = (typeof _ssvSurfaces !== 'undefined') ? _ssvSurfaces[_ssvActiveIdx] : null;
    _ssvPaintMuteBtn(act && typeof act.isMuted === 'function' ? act.isMuted() : muted);
  }
  // Keep the inline feed's per-frame mute buttons in sync too.
  if (typeof _inlinePaintMuteBtns === 'function') _inlinePaintMuteBtns();
});
