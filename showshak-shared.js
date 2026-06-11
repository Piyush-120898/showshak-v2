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
function ssPageFadeIn() {
  document.body.style.opacity = '0';
  document.body.style.transition = 'none';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.style.transition = 'opacity 0.55s ease';
      document.body.style.opacity = '1';
    });
  });
}

document.addEventListener('DOMContentLoaded', ssPageFadeIn);

// bfcache guard: when a page is restored from the back-forward cache
// (e.g. the user swipes/navigates BACK to it), DOMContentLoaded does NOT
// fire again — which previously left the body stuck at opacity:0 (black
// screen). Force it visible on restore.
window.addEventListener('pageshow', (e) => {
  if (e.persisted) {
    document.body.style.transition = 'none';
    document.body.style.opacity = '1';
  }
});


/* ════════════════════════════════════════════════
   WATCH IT SHEET
════════════════════════════════════════════════ */
async function ssOpenSheet(show) {
  if (!show) return;

  const header = document.getElementById('sheet-header');
  if (header) {
    // Title is revealed only at the Watch It moment. Some clip data
    // (Discover/Watchlist/Profile) has no title yet — degrade gracefully.
    const title = show.title || 'Ready to watch';
    const metaTop = [show.year, show.season].filter(Boolean).join(' · ');
    const genres  = (show.genre || []).join(' · ');
    const meta    = [metaTop, genres].filter(Boolean).join('<br>') || 'Choose where to watch it';
    header.innerHTML = `
      <div class="sheet-thumb" style="background:${show.bg}">
        <span>${show.title || '▶'}</span>
      </div>
      <div class="sheet-info">
        <div class="sheet-show-title">${title}</div>
        <div class="sheet-meta">${meta}</div>
      </div>
    `;
  }

  // Open the overlay immediately (runs synchronously before the first await)
  // so the sheet appears at once; options resolve via the cached lookups below.
  document.getElementById('watch-sheet-overlay')?.classList.add('open');
  document.getElementById('watch-sheet')?.classList.add('open');

  // Resolve region + subscriptions (cached), run the resolver, then render
  // either the option list or the neutral fallback message (R6.2).
  const opts = document.getElementById('sheet-options');
  if (!opts) return;
  const region = await ssGetRegion();
  const subs   = await ssGetSubscribedPlatformIds();
  const res    = ssResolveWatchOptions(show, region, subs);

  if (res.message) {
    opts.innerHTML = '<div class="sheet-empty">' + res.message + '</div>';
  } else {
    opts.innerHTML = res.options.map(p => `
      <div class="sheet-option" onclick="ssHandleWatchNow('${p.name}', '${show.title}')">
        <div class="sheet-plat-logo" style="background:${p.color}">${p.label}</div>
        <div class="sheet-option-info">
          <div class="sheet-option-name">${p.name}</div>
          <div class="sheet-option-sub">${p.sub}</div>
          ${p.included ? '<span class="sheet-included">✓ In your plan</span>' : ''}
        </div>
        <span class="sheet-option-arrow">›</span>
      </div>
    `).join('');
  }
}

function ssCloseSheet() {
  document.getElementById('watch-sheet')?.classList.remove('open');
  document.getElementById('watch-sheet-overlay')?.classList.remove('open');
}

function ssHandleWatchNow(platform, showTitle) {
  ssCloseSheet();
  setTimeout(() => ssToast(`▶ Opening ${showTitle} on ${platform}`), 200);
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
    <a class="nav-item-settings" data-nav="settings" href="showshak-settings.html"><div class="nav-item-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></div><span class="nav-item-label">Settings</span></a>
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
}

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
function ssShare(show) {
  if (!show) return;
  if (navigator.share) {
    navigator.share({
      title: `Watch ${show.title} on ${show.platLabel}`,
      text: `Found this on ShowShak — ${show.title}\nSwipe. Discover. Watch It.`,
      url: window.location.href
    });
  } else {
    navigator.clipboard
      .writeText(`Check out ${show.title} on ShowShak — ${window.location.href}`)
      .then(() => ssToast('🔗 Link copied'));
  }
}

function shareClip(idx) {
  if (typeof SHOWS !== 'undefined') ssShare(SHOWS[idx]);
}

/* Share a whole Stack / collection. Native share sheet on mobile,
   clipboard fallback on desktop. Used by Watchlist (and later the
   profile Highlights shelf). Pass the stack object from ssGetStacks(). */
function ssShareStack(stack) {
  if (!stack) return;
  const n = stack.clips ? stack.clips.length : 0;
  const countTxt = n ? `${n} hand-picked clip${n !== 1 ? 's' : ''}` : 'a collection';
  const title = `${stack.name} — a ShowShak Stack`;
  const text  = `Check out "${stack.name}" on ShowShak — ${countTxt} of what to watch next. 🔥`;
  // Stack-specific deep link (route not built yet; harmless + future-proof).
  const url = `${location.origin}${location.pathname}#stack=${encodeURIComponent(stack.id)}`;

  if (navigator.share) {
    navigator.share({ title, text, url }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(`${text}\n${url}`)
      .then(() => ssToast(`🔗 “${stack.name}” link copied`))
      .catch(() => ssToast('Could not copy link'));
  } else {
    ssToast('Sharing not supported on this browser');
  }
}


/* ════════════════════════════════════════════════
   SMOOTH PAGE NAVIGATION
════════════════════════════════════════════════ */
function ssNavigate(url) {
  document.body.style.transition = 'opacity 0.22s ease';
  document.body.style.opacity = '0';
  setTimeout(() => { window.location.href = url; }, 230);
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
   Single source of truth for all saved clips.
   Uses sessionStorage — survives page navigation
   within the same tab, resets when tab is closed.

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
  const stack  = { id: id, name: name.trim(), createdAt: Date.now(), clips: [] };
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
async function _ssDbAddClip(stackId,clipId){ try{ if(!window.ssDB||!window.ssCurrentUser)return; const me=window.ssCurrentUser(); if(!me||!_ssIsUuid(stackId)||!_ssIsUuid(clipId))return; if(_ssStackCreates[stackId])await _ssStackCreates[stackId]; const {error}=await window.ssDB.from('stack_items').insert({stack_id:stackId,content_id:clipId}); if(error&&error.code!=='23505')console.warn('SS stack add:',error.message);}catch(e){} }
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
      .select('id, name, created_at, stack_items(content_id, content:content_id(id, description, fires_count, meta, creator:creator_id(username), platform:platform_id(name,color,abbr)))')
      .eq('user_id', me.id).is('deleted_at', null);
    if (error || !stacks) return;
    const mapped = stacks.map(st => ({
      id: st.id, name: st.name, createdAt: st.created_at ? Date.parse(st.created_at) : Date.now(),
      clips: (st.stack_items || []).filter(it => it.content).map(it => {
        const c = it.content, meta = c.meta || {}, p = c.platform || {}, cr = c.creator || {};
        return { id: c.id, title: '', bg: meta.bg || 'linear-gradient(160deg,#1a0505,#2d0808,#0d0d0d,#000)',
          platColor: p.color || '#EA3B32', platLabel: p.name || '', platAbbr: p.abbr || '', platRgb: _ssHexToRgb(p.color) || '234,59,50',
          caption: c.description || '', genre: [], lang: meta.lang || '', fires: c.fires_count || 0,
          creator: { name: cr.username || 'curator', letter: (cr.username||'C').charAt(0).toUpperCase(), bg: '#EA3B32' } };
      })
    }));
    try { sessionStorage.setItem(SS_STACKS_KEY, JSON.stringify(mapped)); } catch (e) {}
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
window.ssGetRegion = ssGetRegion;
window.ssGetSubscribedPlatformIds = ssGetSubscribedPlatformIds;

/* The one resolver that turns a clip's cached providers into sheet options.
   Feed, Discover, and the unified viewer all funnel through it so Watch It
   behaves identically everywhere. It never throws on missing providers,
   region, or subs (R6.3, R8.3). */
function ssResolveWatchOptions(clip, region, subscribedPlatformIds) {
  region = region || 'IN';
  const subs = subscribedPlatformIds || new Set();
  const regionProviders = (clip && clip.providers && clip.providers[region]) || [];

  // 1. Region has cached flatrate providers → map each to a sheet option.
  if (regionProviders.length) {
    const options = regionProviders.map(function (e) {
      const matched  = !!e.color;                                       // catalog-matched → branded (R11.1)
      const included = !!(e.platform_id && subs.has(e.platform_id));    // R5.2
      return {
        name:        e.catalog_name || e.provider_name,
        color:       matched ? e.color : 'var(--ss-neutral, #2a2a2a)',  // R11.2 neutral default
        label:       e.abbr || (e.provider_name ? e.provider_name.charAt(0) : '▶'),
        sub:         included ? 'In your plan' : 'Available to stream',
        included:    included,
        platform_id: e.platform_id || null
      };
    });
    // R5.3 — In_Your_Plan first, otherwise stable order.
    options.sort(function (a, b) { return (b.included ? 1 : 0) - (a.included ? 1 : 0); });
    return { options: options, fallback: false, message: null };
  }

  // 2. Fallback chain — curator's chosen platform as a single option (R6.1).
  if (clip && clip.curatorPlat) {
    const cp = clip.curatorPlat;
    const included = !!(cp.platform_id && subs.has(cp.platform_id));
    return {
      options: [{
        name:  cp.name,
        color: cp.color || 'var(--ss-neutral, #2a2a2a)',
        label: cp.abbr || (cp.name ? cp.name.charAt(0) : '▶'),
        sub:   included ? 'In your plan' : 'Available to stream',
        included: included,
        platform_id: cp.platform_id || null
      }],
      fallback: true, message: null
    };
  }

  // 3. Neutral message — nothing cached, no curator platform (R6.2).
  return { options: [], fallback: true, message: 'Not available to stream in your region' };
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
    var mood=[]; try{ mood=JSON.parse(meta.mood||"[]"); }catch(e){}
    var uname=cr.username||"curator";
    return {
      id: row.id,
      title: t.name||"", year: t.year||"", synopsis: t.synopsis||"",
      caption: row.description||"", fires: row.fires_count||0,
      genre: [], mood: mood, lang: meta.lang||"", season: meta.season||"",
      bg: meta.bg||"linear-gradient(160deg,#1a0505,#2d0808,#0d0d0d,#000)",
      // Mux playback fields: null muxPlaybackId → GradientSurface fallback (Req 4.2, 4.4).
      muxPlaybackId: row.mux_playback_id || null,
      poster: row.thumbnail_url || null,
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

async function ssLoadClips(limit, offset){
  if(!window.ssDB) return [];
  var n = limit||50, off = offset||0;
  try{
    var res = await window.ssDB.from("content")
      .select("id, description, fires_count, meta, status, mux_playback_id, url, thumbnail_url, duration_sec, creator:creator_id(username,name,avatar_url), title:title_id(name,year,synopsis,providers,cached_at), platform:platform_id(id,name,color,abbr)")
      .eq("status","live").is("deleted_at",null).order("created_at",{ascending:false}).range(off, off + n - 1);
    if(res.error || !res.data || !res.data.length) return [];
    // Filter + projection delegated to the pure helper (the SQL filter above
    // remains an efficient DB-side pre-filter; the helper re-enforces it).
    return ssMapContentRowsToClips(res.data);
  }catch(e){ return []; }
}
/* FEED shape: titles shown, raw cache carried for the Watch It sheet resolver. */
function ssClipsForFeed(base){ return base.map(function(c){ return {
  id:c.id, title:(c.title||"").toUpperCase(), year:c.year, genre:c.genre, lang:c.lang,
  season:c.season, synopsis:c.synopsis, caption:c.caption, creator:c.creator, litCount:c.fires,
  providers:c.providers, curatorPlat:c.curatorPlat,
  muxPlaybackId:c.muxPlaybackId, poster:c.poster,
  platLabel:(c.curatorPlat&&c.curatorPlat.name)||c.platLabel, platColor:(c.curatorPlat&&c.curatorPlat.color)||c.platColor, platRgb:c.platRgb, bg:c.bg }; }); }
/* DISCOVER shape: title hidden, mood[] kept, raw cache carried for the resolver. */
function ssClipsForDiscover(base){ return base.map(function(c){ return {
  id:c.id, caption:c.caption, genre:c.genre, lang:c.lang, platLabel:c.platLabel, platColor:c.platColor,
  platAbbr:c.platAbbr, platRgb:c.platRgb, creator:c.creator, fires:c.fires, bg:c.bg, mood:c.mood,
  muxPlaybackId:c.muxPlaybackId, poster:c.poster,
  providers:c.providers, curatorPlat:c.curatorPlat }; }); }
window.ssLoadClips=ssLoadClips; window.ssClipsForFeed=ssClipsForFeed; window.ssClipsForDiscover=ssClipsForDiscover; window.ssMapContentRowsToClips=ssMapContentRowsToClips;

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
      .select("id, description, fires_count, meta, status, mux_playback_id, url, thumbnail_url, duration_sec, created_at, creator:creator_id(username,name,avatar_url), title:title_id(name,year,synopsis,providers,cached_at), platform:platform_id(id,name,color,abbr)")
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
        caption: row.description||"", fires: row.fires_count||0,
        genre: [], mood: mood, lang: meta.lang||"", season: meta.season||"",
        bg: meta.bg||"linear-gradient(160deg,#1a0505,#2d0808,#0d0d0d,#000)",
        muxPlaybackId: row.mux_playback_id || null,
        poster: row.thumbnail_url || null,
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
let _inlineAwaitingGesture = false;

/* resolveMuted(mode) — the single sound-resolution rule (design: Sound model).
   INLINE while awaiting the first gesture → forced muted (autoplay policy);
   otherwise (and always for FULLSCREEN) → the persisted Mute_Preference. */
function _ssvResolveMuted(mode) {
  if (mode === 'INLINE' && _inlineAwaitingGesture) return true;
  return ssGetMutePref();
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
    creator = { name: raw.creator.name, letter: raw.creator.letter, bg: raw.creator.bg };
  } else if (typeof raw.creator === 'string') {
    creator = {
      name:   raw.creator,
      letter: raw.creatorLetter || raw.creator.charAt(0).toUpperCase(),
      bg:     raw.creatorBg || '#EA3B32',
    };
  } else {
    creator = { name: 'showshak', letter: 'S', bg: '#EA3B32' };
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
    .ssv-media { position: absolute; inset: 0; z-index: 0; }
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
    .ssv-vig {
      position: absolute; inset: 0; pointer-events: none;
      background: linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 30%, rgba(0,0,0,0) 58%, rgba(0,0,0,0.35) 100%);
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
      position: absolute; top: 14px; left: 14px; z-index: 40;
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
      position: absolute; top: 14px; right: 14px; z-index: 40;
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
      position: absolute; top: 18px; left: 50%; transform: translateX(-50%);
      z-index: 35; display: flex; align-items: center; gap: 6px;
      background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.12);
      border-radius: 100px; padding: 5px 12px;
      font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.85);
      backdrop-filter: blur(8px); pointer-events: none;
    }

    /* Right action rail */
    .ssv-rail {
      position: absolute; right: 12px; bottom: 96px; z-index: 30;
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
      position: absolute; left: 14px; right: 72px; bottom: 84px; z-index: 20;
    }
    .ssv-creator-row { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
    .ssv-avatar {
      width: 28px; height: 28px; border-radius: 50%;
      border: 1.5px solid rgba(255,255,255,0.35); flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; color: #fff; text-transform: uppercase;
    }
    .ssv-handle { font-size: 13px; font-weight: 600; color: #fff; text-shadow: 0 1px 6px rgba(0,0,0,0.9); }
    .ssv-follow {
      font-size: 10px; color: var(--red); font-weight: 700; cursor: pointer;
      padding: 2px 9px; border: 1px solid var(--red); border-radius: 100px;
      transition: background 0.15s;
    }
    .ssv-follow:hover { background: rgba(234,59,50,0.15); }
    .ssv-follow.is-following { background: var(--red); color: #fff; border-color: var(--red); }
    .ssv-tags { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin-bottom: 7px; }
    .ssv-caption {
      font-size: 13px; color: rgba(255,255,255,0.78); line-height: 1.45;
      text-shadow: 0 1px 8px rgba(0,0,0,0.7);
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
    }
    .ssv-caption em { color: #fff; font-style: normal; font-weight: 600; }

    /* Watch It button */
    .ssv-watch {
      position: absolute; left: 14px; right: 72px; bottom: 16px; z-index: 30;
      display: flex; align-items: center; justify-content: center;
      height: 52px; border-radius: 16px;
      font-family: var(--font-body); color: #fff; border: none; cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      box-shadow: 0 6px 28px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.18);
      transition: transform 0.15s, filter 0.15s;
      animation: ssvWatchBreathe 2.8s ease-in-out infinite;
    }
    @keyframes ssvWatchBreathe {
      0%,100% { box-shadow: 0 0 0 0 rgba(var(--ssv-rgb,234,59,50),0), 0 6px 28px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.18); }
      50%     { box-shadow: 0 0 20px 6px rgba(var(--ssv-rgb,234,59,50),0.4), 0 0 44px 14px rgba(var(--ssv-rgb,234,59,50),0.15), 0 6px 28px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.18); }
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
    } else {
      surface._ssPaused = true;
      surface.pause();
      if (clipEl) clipEl.classList.add('ssv-paused');
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
    if (prevEl) prevEl.classList.remove('ssv-paused');

    _ssvActiveIdx = idx;
    const surface = _ssvSurfaces[idx];
    if (!surface) return;

    const muted = _ssvResolveMuted(m);
    surface.setMuted(muted);
    surface._ssPaused = false;
    surface.play().catch(() => {
      // Autoplay-with-audio rejected → retry muted (keeps playback alive).
      surface.setMuted(true);
      surface.play().catch(() => {});
    });

    // Preload the NEXT clip while this one loops, so scrolling to it is
    // instant (smooth viewing). No-op for gradients / when there is no next.
    const nextSurface = _ssvSurfaces[idx + 1];
    if (nextSurface && typeof nextSurface.preload === 'function') nextSurface.preload();
  },

  /* mountInline(container, clips, opts) — the INLINE render mode. Rebuilds the
     Feed on the shared engine: renders the ordered clips into `container`
     (#feed) reusing the Feed's existing scroll-snap `.clip` / `.clip-column`
     layout and class names, gives each clip a Media_Surface + Progress_Bar,
     wires the unified gesture handler, drives the active clip with an
     IntersectionObserver, owns the mobile per-clip rail + the fixed desktop
     #action-rail (positionRail), and the arrow/j/k keyboard navigation.

     The first clip plays MUTED (browser autoplay policy) via
     _inlineAwaitingGesture until the first user interaction (tap/scroll/key),
     which then applies the persisted Mute_Preference. No-ops if container or
     clips are absent. */
  mountInline(container, clips, opts) {
    if (!container || !Array.isArray(clips) || !clips.length) return;  // no-op guard

    // Tear down any previous inline mount (no surface/observer/timer leaks).
    _inlineSurfaces.forEach(s => { try { s.destroy(); } catch (e) {} });
    if (_inlineObserver) { _inlineObserver.disconnect(); _inlineObserver = null; }
    if (typeof _inlineInteractionCleanup === 'function') { _inlineInteractionCleanup(); _inlineInteractionCleanup = null; }

    // Ordering goes ONLY through the Recommendation_Seam (Req 7.5). For the
    // Feed, the "clicked" clip is simply the first clip — ssClipOrdering keeps
    // it first and de-dupes the rest, so the Feed's natural order is preserved.
    _inlineClips    = ssClipOrdering(clips[0], clips);
    _inlineSurfaces = [];
    _inlineBars     = [];
    _inlineFired    = new Set();
    _inlineActiveIdx = -1;
    // First clip is forced muted until the first user interaction (Req 4.2).
    _inlineAwaitingGesture = true;

    // Render the clip frames (Feed's existing classes/ids).
    container.innerHTML = _inlineClips.map((c, i) => _inlineClipHTML(c, i)).join('');

    // Build one Media_Surface + one Progress_Bar per clip via the shared
    // per-clip wiring (_inlineWireClip), which appendInline reuses for the
    // sliding window. The engine speaks ONLY the Media_Surface contract here.
    _inlineClips.forEach((clip, i) => _inlineWireClip(i));

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
    fresh.forEach((c, k) => _inlineWireClip(startIdx + k));
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

  /* pruneInlineSurfaces() — ADDITIVE bounded-concurrency step (Req 9.5).
     Keeps only the sliding band of mounted Media_Surfaces around the active
     clip (ssMountedPlayerSet): re-mounts any in-band clip that was pruned and
     destroys out-of-band players, so the number of live <mux-player>s stays
     bounded no matter how many windows have been appended. Contract-only — it
     never branches on surface type. */
  pruneInlineSurfaces(activeIdx) {
    const a = (activeIdx == null) ? _inlineActiveIdx : activeIdx;
    const keep = ssMountedPlayerSet(a, _inlineClips.length, SS_MAX_LIVE_PLAYERS);
    const keepSet = new Set(keep);
    keep.forEach(i => { if (!_inlineSurfaces[i]) _inlineWireClip(i); });
    for (let i = 0; i < _inlineSurfaces.length; i++) {
      if (!keepSet.has(i) && _inlineSurfaces[i]) {
        try { _inlineSurfaces[i].destroy(); } catch (e) {}
        _inlineSurfaces[i] = null;
      }
    }
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
  const next = !ssGetMutePref();
  ssSetMutePref(next);   // persists + fires ssOnMuteChange (re-applies + repaints)
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
  const platAbbr = (c.platforms && c.platforms[0] && c.platforms[0].label) || c.platAbbr;
  return `
    <div class="clip${i === 0 ? ' active' : ''}" id="clip-${i}" data-ss-idx="${i}">
      <div class="clip-media" id="clip-media-${i}"></div>
      <div class="clip-vignette"></div>
      <div class="clip-grain"></div>
      <div class="clip-logo-float">
        <div class="clip-logo-mark"><svg viewBox="0 0 1254 1254" xmlns="http://www.w3.org/2000/svg"><use href="#ss-mark"/></svg></div>
      </div>
      <div class="clip-tap" id="tap-${i}">
        <div class="clip-pause-icon" id="pause-icon-${i}">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        </div>
      </div>
      <div class="fire-burst" id="burst-${i}">
        <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill="#EA3B32" d="M40 6C40 6 26 22 26 34a14 14 0 0 0 28 0c0-5.5-2.8-11-5-15C46 24 47 30 43 34c-1.5 2-3 3-3 3S32 32 32 26c0-8 8-20 8-20z"/>
          <path fill="#FF4D42" d="M40 46c-7.7 0-14 6.3-14 14s6.3 14 14 14 14-6.3 14-14-6.3-14-14-14z"/>
          <circle cx="40" cy="60" r="6" fill="#FFB800" opacity="0.7"/>
        </svg>
      </div>
      <div class="mobile-action-rail" id="m-rail-${i}">
        <div class="m-act-btn" id="m-lit-${i}" onclick="event.stopPropagation(); ClipEngine.fire(${i}, null, null, 'INLINE')">
          <div class="m-act-icon">
            <svg class="m-fire-outline" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C12 2 8 6.5 8 10a4 4 0 0 0 8 0c0-1.5-.8-3-1.5-4C13.8 7.5 14 9 13 10c-.5.5-1 .8-1 .8S10 9.5 10 8c0-2 2-6 2-6z"/><path d="M12 14c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4z"/></svg>
            <svg class="m-fire-filled" width="30" height="30" viewBox="0 0 24 24"><path fill="#EA3B32" stroke="#EA3B32" stroke-width="0.5" d="M12 2C12 2 8 6.5 8 10a4 4 0 0 0 8 0c0-1.5-.8-3-1.5-4C13.8 7.5 14 9 13 10c-.5.5-1 .8-1 .8S10 9.5 10 8c0-2 2-6 2-6z"/><path fill="#EA3B32" stroke="#EA3B32" stroke-width="0.5" d="M12 14c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4z"/></svg>
          </div>
          <span class="m-act-label" id="m-lit-count-${i}">${fmtFires(c.fires + (fired ? 1 : 0))}</span>
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
        style="background:${c.platColor}; --btn-rgb:${c.platRgb}"
        onclick="event.stopPropagation(); ssOpenSheet(_inlineClips[${i}])">
        <div class="mobile-watch-btn-inner">
          <div class="mobile-watch-plat-logo">${platAbbr}</div>
          <div class="mobile-watch-text">
            <span class="mobile-watch-text-main">Watch It</span>
            <span class="mobile-watch-text-sub">on ${c.platLabel}</span>
          </div>
          <div class="mobile-watch-arrow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </div>
        </div>
      </button>
      <div class="clip-bottom">
        <div class="creator-row">
          <div class="creator-avatar" style="background:${c.creator.bg}" data-curator="${c.creator.name}" data-curator-name="${c.creator.name}" data-curator-letter="${c.creator.letter}" data-curator-bg="${c.creator.bg}">${c.creator.letter}</div>
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

  const muted = _ssvResolveMuted('INLINE');
  surface.setMuted(muted);
  surface._ssPaused = false;
  surface.play().catch(() => {
    surface.setMuted(true);
    surface.play().catch(() => {});
  });

  // Preload the NEXT clip while this one loops, for smooth scrolling.
  const nextSurface = _inlineSurfaces[idx + 1];
  if (nextSurface && typeof nextSurface.preload === 'function') nextSurface.preload();

  _inlineSyncRail(idx);
  _inlineAnimateRailIn();
}

/* Sync the single fixed desktop #action-rail to the active clip (mirrors the
   Feed's old syncRail). The mobile rail is per-clip so it needs no sync. */
function _inlineSyncRail(idx) {
  const clip = _inlineClips[idx];
  if (!clip) return;
  const fired = _inlineFired.has(idx);

  const litBtn   = document.getElementById('rail-lit');
  const litCount = document.getElementById('rail-lit-count');
  if (litCount) litCount.textContent = fmtFires(clip.fires + (fired ? 1 : 0));
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
  if (pill) { pill.style.background = clip.platColor; pill.style.setProperty('--pill-rgb', clip.platRgb); }
  if (plat) plat.textContent = clip.platLabel;

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
    if (!_inlineAwaitingGesture) return;
    _inlineAwaitingGesture = false;
    const surface = _inlineSurfaces[_inlineActiveIdx];
    if (surface) surface.setMuted(ssGetMutePref());
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
  return `
    <div class="${rootCls}" id="ssv-clip-${i}" data-ssv-idx="${i}">
      <div class="ssv-media" id="ssv-media-${i}"></div>
      <div class="ssv-vig"></div>

      <div class="ssv-tap" id="ssv-tap-${i}"></div>
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
          <div class="ssv-avatar" style="background:${c.creator.bg}" data-curator="${c.creator.name}" data-curator-name="${c.creator.name}" data-curator-letter="${c.creator.letter}" data-curator-bg="${c.creator.bg}">${c.creator.letter}</div>
          <span class="ssv-handle" data-curator="${c.creator.name}" data-curator-name="${c.creator.name}" data-curator-letter="${c.creator.letter}" data-curator-bg="${c.creator.bg}">@${c.creator.name}</span>
          <span class="ssv-follow" data-follow="${c.creator.name}" data-follow-plus data-follow-name="${c.creator.name}" data-follow-letter="${c.creator.letter}" data-follow-bg="${c.creator.bg}">+ Follow</span>
        </div>
        <div class="ssv-tags">${tags}</div>
        <div class="ssv-caption">${caption}</div>
      </div>

      <button class="ssv-watch" style="background:${c.platColor}; --ssv-rgb:${c.platRgb}" onclick="ssOpenSheet(_ssvClips[${i}])">
        <div class="ssv-watch-inner">
          <div class="ssv-watch-logo">${c.platAbbr}</div>
          <div class="ssv-watch-text">
            <span class="ssv-watch-main">Watch It</span>
            <span class="ssv-watch-sub">on ${c.platLabel}</span>
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

  // Build one Media_Surface + one Progress_Bar per clip, and wire progress.
  // The engine speaks ONLY the Media_Surface contract here — no medium logic.
  _ssvClips.forEach((clip, i) => {
    const mediaEl = document.getElementById(`ssv-media-${i}`);
    const clipEl  = document.getElementById(`ssv-clip-${i}`);
    if (!mediaEl || !clipEl) return;
    const surface = ssCreateSurface(clip, { bgClass: 'ssv-bg' });
    surface.mount(mediaEl);
    const bar = ssMakeProgressBar(clipEl);
    surface.onTimeupdate(p => bar.set(p));
    _ssvSurfaces[i] = surface;
    _ssvBars[i] = bar;
    // Unified gesture model: single tap → pause/resume, double tap → fire+burst.
    const tapZone = document.getElementById(`ssv-tap-${i}`);
    if (tapZone) ssAttachGestures(tapZone, i, ClipEngine);
  });

  // Lock background scroll
  _ssvPrevScroll = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const viewer = document.getElementById('ss-clip-viewer');
  viewer.classList.add('open');

  // First clip active + observer for the rest
  feed.scrollTop = 0;
  _ssvSetupObserver(feed);
  document.getElementById('ssv-clip-0')?.classList.add('active');
  // FULLSCREEN opens are gesture-initiated → start playback (sound per pref).
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
        if (!isNaN(idx)) ClipEngine.setActive(idx, 'FULLSCREEN');
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
      if (_ssSession && typeof _ssRepaintAllFollowButtons === 'function') _ssRepaintAllFollowButtons();
      if (typeof ssSyncAllSaveBtns === 'function') ssSyncAllSaveBtns();
      if (_ssSession && typeof ssHydrateStacks === 'function') ssHydrateStacks();
    }).catch(() => {});
    // Live updates: login, logout, token refresh, OAuth redirect return.
    window.ssDB.auth.onAuthStateChange((_event, session) => {
      const wasLoggedOut = !_ssSession;
      _ssSession = session || null;
      // Watch It region + subscription caches must re-resolve after any
      // sign-in / sign-out / token change.
      _ssRegion = null; _ssSubIds = null;
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
    try {
      const { data, error } = await window.ssDB
        .from('users').select('username, gender, genres, avatar_url, meta').eq('id', user.id).single();
      if (error) { console.warn('ShowShak onboarding: profile read failed', error.message); _welcome(); return; }
      const done = data && data.meta && data.meta.onboarded === true;
      if (done) { _welcome(); return; }   // already onboarded → just greet
      // Pre-fill the auto-generated username + any provider avatar.
      _obData.username   = (data && data.username) || '';
      _obData.name       = (data && data.name) || (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || '';
      _obData.avatar_url = (data && data.avatar_url) || (user.user_metadata && user.user_metadata.avatar_url) || '';
      _obData.gender     = (data && data.gender) || '';
      _openOnboarding();
    } catch (e) { console.warn('ShowShak onboarding error', e); _welcome(); }
  };

  function _welcome() { if (typeof ssToast === 'function') ssToast('🎉 Welcome to ShowShak'); }
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
      const { data, error } = await window.ssDB.from('users').select('id').eq('username', u).neq('id', _obUser.id).limit(1);
      if (error) throw error;
      if (data && data.length) { msg.className = 'ss-ob-uname-msg bad'; msg.textContent = '@' + u + ' is taken.'; _obUsernameOk = false; }
      else { msg.className = 'ss-ob-uname-msg ok'; msg.textContent = '@' + u + ' is available ✓'; _obUsernameOk = true; }
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
  var onTick = [], onEnd = [];
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
    setMuted: function (m) { muted = !!m; },   // gradient has no audio track
    isMuted: function () { return muted; },
    preload: function () {},                   // nothing to buffer for a gradient
    getProgress: function () {
      return Math.max(0, Math.min(1, elapsedBase / DURATION_MS));
    },
    seek: function (f) { elapsedBase = Math.max(0, Math.min(1, f)) * DURATION_MS; },
    onTimeupdate: function (cb) { onTick.push(cb); },
    onEnded: function (cb) { onEnd.push(cb); },
    destroy: function () { cancelAnimationFrame(raf); if (el) el.remove(); el = null; },
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
  var onTick = [], onEnd = [];
  var muted = true, errored = false;
  var loopClip = !opts || opts.loop !== false;   // active clip loops by default

  function handleTimeupdate() {
    var p = ssClipProgress(el && el.currentTime, el && el.duration);
    onTick.forEach(function (cb) { cb(p); });
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

  return {
    mount: function (container) {
      el = document.createElement('mux-player');
      el.setAttribute('playback-id', clip.muxPlaybackId);
      el.setAttribute('stream-type', 'on-demand');
      el.setAttribute('playsinline', '');
      el.setAttribute('preload', 'auto');  // mounted = look-ahead band → buffer ahead (Req 9.2)
      // Loop the active clip (TikTok/Reels-style) so it replays until the
      // viewer scrolls to another clip. Native loop never fires 'ended', so
      // the error→advance path (handleError) is unaffected.
      if (loopClip) { el.loop = true; el.setAttribute('loop', ''); }
      el.muted = muted;
      // Poster from the Mux image CDN when present, else paint the clip's
      // gradient as the loading background so the frame is never blank (Req 7).
      if (clip.poster) el.setAttribute('poster', clip.poster);
      else container.style.background = clip.bg || '#000';
      // Match GradientSurface's mount node so the feed/viewer CSS is unchanged.
      el.className = (opts && opts.bgClass) || 'clip-bg';
      el.style.width = '100%';
      el.style.height = '100%';
      el.addEventListener('timeupdate', handleTimeupdate);
      el.addEventListener('ended', handleEnded);
      el.addEventListener('error', handleError);
      container.appendChild(el);
      return el;
    },
    play: function () { return el ? (el.play() || Promise.resolve()) : Promise.resolve(); },
    pause: function () { if (el) { try { el.pause(); } catch (e) {} } },
    // Eagerly buffer this (not-yet-active) clip so the NEXT clip is ready to
    // play instantly when the viewer scrolls to it (smooth viewing). Safe to
    // call repeatedly; never interrupts the currently-playing surface.
    preload: function () {
      if (el) { try { el.preload = 'auto'; el.setAttribute('preload', 'auto'); } catch (e) {} }
    },
    setMuted: function (m) { muted = !!m; if (el) el.muted = muted; },
    isMuted: function () { return el ? !!el.muted : muted; },
    getProgress: function () { return ssClipProgress(el && el.currentTime, el && el.duration); },
    seek: function (f) { if (el && isFinite(el.duration)) el.currentTime = ssSeekToTime(f, el.duration); },
    onTimeupdate: function (cb) { onTick.push(cb); },
    onEnded: function (cb) { onEnd.push(cb); },
    destroy: function () {
      if (el) {
        el.removeEventListener('timeupdate', handleTimeupdate);
        el.removeEventListener('ended', handleEnded);
        el.removeEventListener('error', handleError);
        try { el.pause(); } catch (e) {}
        el.remove();
      }
      el = null; onTick = []; onEnd = [];
    },
  };
}

/**
 * ssCreateSurface — the single factory. The ONLY place that decides which
 * Media_Surface a clip gets. The engine never branches on surface type
 * elsewhere; both arms satisfy the same MediaSurfaceContract.
 */
function ssCreateSurface(clip, opts) {
  return (clip && clip.muxPlaybackId)
    ? VideoSurface(clip, opts)      // real Mux video (HLS via <mux-player>)
    : GradientSurface(clip, opts);  // gradient fallback (no playback id)
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
var SS_MAX_LIVE_PLAYERS = 4;   // cap on concurrently mounted players (Req 9.5)

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

/* Expose consistently with the other ss* helpers (window in the browser),
   plus a guarded CommonJS export so the Node property tests can require these
   pure primitives — mirrors the data/showshak-data.js dual-export precedent. */
if (typeof window !== 'undefined') {
  window.ssClipProgress = ssClipProgress;
  window.ssSeekToTime = ssSeekToTime;
  window.ssSetMediaMuted = ssSetMediaMuted;
  window.ssGetMediaMuted = ssGetMediaMuted;
  window.ssMuteRoundTrip = ssMuteRoundTrip;
  window.ssShouldFetchNextWindow = ssShouldFetchNextWindow;
  window.ssMountedPlayerSet = ssMountedPlayerSet;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports.ssClipProgress = ssClipProgress;
  module.exports.ssSeekToTime = ssSeekToTime;
  module.exports.ssSetMediaMuted = ssSetMediaMuted;
  module.exports.ssGetMediaMuted = ssGetMediaMuted;
  module.exports.ssMuteRoundTrip = ssMuteRoundTrip;
  module.exports.ssMapContentRowsToClips = ssMapContentRowsToClips;
  module.exports.ssShouldFetchNextWindow = ssShouldFetchNextWindow;
  module.exports.ssMountedPlayerSet = ssMountedPlayerSet;
  module.exports.SS_CLIP_WINDOW = SS_CLIP_WINDOW;
  module.exports.SS_PRELOAD_AHEAD = SS_PRELOAD_AHEAD;
  module.exports.SS_MAX_LIVE_PLAYERS = SS_MAX_LIVE_PLAYERS;
  module.exports.ssCreateSurface = ssCreateSurface;
  module.exports.VideoSurface = VideoSurface;
  module.exports.GradientSurface = GradientSurface;
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
  // INLINE host: re-apply to its active surface too (unless still awaiting the
  // first gesture, where the first clip stays forced-muted).
  if (typeof _inlineSurfaces !== 'undefined' && !_inlineAwaitingGesture) {
    var inlineSurface = _inlineSurfaces[_inlineActiveIdx];
    if (inlineSurface) inlineSurface.setMuted(muted);
  }
  if (typeof _ssvPaintMuteBtn === 'function') _ssvPaintMuteBtn(muted);
});
