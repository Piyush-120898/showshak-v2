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
function ssOpenSheet(show) {
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

  const opts = document.getElementById('sheet-options');
  if (opts && show.platforms) {
    opts.innerHTML = show.platforms.map(p => `
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

  document.getElementById('watch-sheet-overlay')?.classList.add('open');
  document.getElementById('watch-sheet')?.classList.add('open');
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
async function ssLoadClips(limit){
  if(!window.ssDB) return [];
  try{
    var res = await window.ssDB.from("content")
      .select("id, description, fires_count, meta, status, creator:creator_id(username,name,avatar_url), title:title_id(name,year,synopsis), platform:platform_id(name,color,abbr)")
      .eq("status","live").is("deleted_at",null).order("created_at",{ascending:false}).limit(limit||50);
    if(res.error || !res.data || !res.data.length) return [];
    return res.data.map(function(row){
      var meta=row.meta||{}, p=row.platform||{}, t=row.title||{}, cr=row.creator||{};
      var mood=[]; try{ mood=JSON.parse(meta.mood||"[]"); }catch(e){}
      var uname=cr.username||"curator";
      return {
        id: row.id,
        title: t.name||"", year: t.year||"", synopsis: t.synopsis||"",
        caption: row.description||"", fires: row.fires_count||0,
        genre: [], mood: mood, lang: meta.lang||"", season: meta.season||"",
        bg: meta.bg||"linear-gradient(160deg,#1a0505,#2d0808,#0d0d0d,#000)",
        platLabel: p.name||"Streaming", platColor: p.color||"#EA3B32",
        platAbbr: p.abbr||(p.name?p.name.charAt(0):"▶"), platRgb: _ssHexRgb(p.color),
        creator: { name: uname, letter: uname.charAt(0).toUpperCase(), bg: "#EA3B32", avatar: cr.avatar_url||null }
      };
    });
  }catch(e){ return []; }
}
/* FEED shape: titles shown, full platforms[] for the Watch It sheet. */
function ssClipsForFeed(base){ return base.map(function(c){ return {
  id:c.id, title:(c.title||"").toUpperCase(), year:c.year, genre:c.genre, lang:c.lang,
  season:c.season, synopsis:c.synopsis, caption:c.caption, creator:c.creator, litCount:c.fires,
  platforms: c.platLabel? [{name:c.platLabel,color:c.platColor,label:c.platAbbr,sub:"Available to stream",included:false}] : [],
  platLabel:c.platLabel, platColor:c.platColor, platRgb:c.platRgb, bg:c.bg }; }); }
/* DISCOVER shape: title hidden, mood[] kept. */
function ssClipsForDiscover(base){ return base.map(function(c){ return {
  id:c.id, caption:c.caption, genre:c.genre, lang:c.lang, platLabel:c.platLabel, platColor:c.platColor,
  platAbbr:c.platAbbr, platRgb:c.platRgb, creator:c.creator, fires:c.fires, bg:c.bg, mood:c.mood }; }); }
window.ssLoadClips=ssLoadClips; window.ssClipsForFeed=ssClipsForFeed; window.ssClipsForDiscover=ssClipsForDiscover;

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
    .ssv-bg {
      position: absolute; inset: 0;
      background-size: cover; background-position: center;
      transform: scale(1.04); transition: transform 0.6s var(--ease-smooth);
    }
    .ssv-clip.active .ssv-bg { transform: scale(1); }
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

/* ── Render one clip ────────────────────────────── */
function _ssvClipHTML(c, i) {
  const fired = _ssvFired.has(i);
  const tags = [...(c.genre || []), c.lang].filter(Boolean)
    .map(t => `<span class="tag">${t}</span>`).join('');
  const caption = c.caption || `A pick from <em>@${c.creator.name}</em>`;
  return `
    <div class="ssv-clip" id="ssv-clip-${i}" data-ssv-idx="${i}">
      <div class="ssv-bg" style="background:${c.bg}"></div>
      <div class="ssv-vig"></div>

      <div class="ssv-tap" id="ssv-tap-${i}"></div>
      <div class="ssv-burst" id="ssv-burst-${i}">
        <svg width="110" height="110" viewBox="0 0 24 24" fill="#EA3B32"><path d="M12 2C12 2 8 6.5 8 10a4 4 0 0 0 8 0c0-1.5-.8-3-1.5-4C13.8 7.5 14 9 13 10c-.5.5-1 .8-1 .8S10 9.5 10 8c0-2 2-6 2-6z"/><path d="M12 14c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4z"/></svg>
      </div>

      <div class="ssv-rail">
        <div class="ssv-act ssv-fire ${fired ? 'lit' : ''}" id="ssv-fire-${i}" onclick="_ssvToggleFire(${i})">
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

  _ssvClips = _ssvBuildList(clicked, list);
  _ssvFired = new Set();

  const feed = document.getElementById('ssv-feed');
  if (!feed) return;
  feed.innerHTML = _ssvClips.map((c, i) => _ssvClipHTML(c, i)).join('');

  // Lock background scroll
  _ssvPrevScroll = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const viewer = document.getElementById('ss-clip-viewer');
  viewer.classList.add('open');

  // First clip active + observer for the rest
  feed.scrollTop = 0;
  _ssvSetupObserver(feed);
  document.getElementById('ssv-clip-0')?.classList.add('active');
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
  _ssvAttachDoubleTap(feed);
}

/* ── Double-tap / double-click to fire (Instagram-style) ──────────
   Works inside the universal viewer, so it behaves identically on
   Discover, Watchlist and Profile clips — not just the Feed. The tap
   zone (.ssv-tap) sits below the rail/Watch It, so those still work.
   Double tap fires (never un-fires) and plays a heart-style burst at
   the tap point. A single tap is left alone (no pause UI here). */
function _ssvAttachDoubleTap(feed) {
  let lastTap = 0, lastX = 0, lastY = 0;

  const onZone = (e) => {
    const zone = e.target.closest && e.target.closest('.ssv-tap');
    if (!zone) return null;
    const clipEl = zone.closest('.ssv-clip');
    return clipEl ? { idx: parseInt(clipEl.dataset.ssvIdx, 10), zone } : null;
  };

  // Touch: detect two quick taps near the same point.
  feed.addEventListener('touchend', (e) => {
    const hit = onZone(e);
    if (!hit) return;
    const t = e.changedTouches[0];
    const now = Date.now();
    const near = Math.abs(t.clientX - lastX) < 40 && Math.abs(t.clientY - lastY) < 40;
    if (now - lastTap < 300 && near) {
      e.preventDefault();
      _ssvFireOn(hit.idx, t.clientX, t.clientY, hit.zone);
      lastTap = 0;
    } else {
      lastTap = now; lastX = t.clientX; lastY = t.clientY;
    }
  }, { passive: false });

  // Desktop: native double-click.
  feed.addEventListener('dblclick', (e) => {
    const hit = onZone(e);
    if (!hit) return;
    _ssvFireOn(hit.idx, e.clientX, e.clientY, hit.zone);
  });
}

/* Fire a clip via double-tap: only turns fire ON (never off), syncs the
   rail button, flashes the Watch It CTA, and bursts a flame at (x,y). */
function _ssvFireOn(i, x, y, zone) {
  // Guest gate: double-tap-to-fire is a reaction → prompt sign-up first.
  if (typeof ssGuestGuard === 'function' && ssGuestGuard('fire')) return;
  if (!_ssvFired.has(i)) _ssvToggleFire(i);   // toggle on (no-op visual if already lit)

  // Burst at the tap point, positioned relative to the clip.
  const burst = document.getElementById(`ssv-burst-${i}`);
  if (burst && zone) {
    const r = zone.getBoundingClientRect();
    burst.style.left = (x - r.left) + 'px';
    burst.style.top  = (y - r.top)  + 'px';
    burst.classList.remove('go'); void burst.offsetWidth; burst.classList.add('go');
  }
  // Fire energy → flash the Watch It CTA on this clip.
  const watch = document.querySelector(`#ssv-clip-${i} .ssv-watch`);
  if (watch) { watch.style.filter = 'brightness(1.5) saturate(1.3)'; setTimeout(() => watch.style.filter = '', 360); }
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
      }
    });
  }, { root: feed, threshold: 0.6 });
  feed.querySelectorAll('.ssv-clip').forEach(c => _ssvObserver.observe(c));
}

/* ── Fire toggle inside the viewer ──────────────── */
function _ssvToggleFire(i) {
  const clip = _ssvClips[i];
  if (!clip) return;
  const fired = !_ssvFired.has(i);
  fired ? _ssvFired.add(i) : _ssvFired.delete(i);

  const btn = document.getElementById(`ssv-fire-${i}`);
  if (btn) {
    btn.classList.toggle('lit', fired);
    const ico = btn.querySelector('.ssv-ico');
    if (ico) { ico.classList.remove('pulse'); void ico.offsetWidth; ico.classList.add('pulse'); }
  }
  const count = document.getElementById(`ssv-fire-count-${i}`);
  if (count) count.textContent = fmtFires(clip.fires + (fired ? 1 : 0));

  _ssDbFire(clip.id, fired);   // persist to DB (fire-and-forget)

  // Fire energy → flash the Watch It CTA on this clip
  if (fired) {
    const watch = document.querySelector(`#ssv-clip-${i} .ssv-watch`);
    if (watch) { watch.style.filter = 'brightness(1.5) saturate(1.3)'; setTimeout(() => watch.style.filter = '', 360); }
  }
}



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
    if (_ssSession) return true;
    try {
      if (sessionStorage.getItem(SIGNED_UP_KEY) === '1') return true;
      if (localStorage.getItem(PROFILE_KEY)) return true;
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
