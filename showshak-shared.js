/* ═══════════════════════════════════════════════════════════════
   SHOWSHAK — SHARED JAVASCRIPT
   All utilities shared across every page.
   ─────────────────────────────────────────────────────────────
   Include at end of <body> on every page:
   <script src="../shared/showshak-shared.js"></script>
═══════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════
   SVG MARK — injected once into every page
   The ShowShak logo symbol, defined as a reusable SVG.
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

// Inject the SVG mark at the top of body
document.body.insertAdjacentHTML('afterbegin', SS_MARK_SVG);


/* ════════════════════════════════════════════════
   TOAST
   Usage: ssToast('🔖 Added to Watchlist')
   Automatically creates #ss-toast element if absent.
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

// Backwards compat alias — some pages use showToast()
function showToast(msg) { ssToast(msg); }


/* ════════════════════════════════════════════════
   PAGE FADE-IN
   Smooth opacity transition on every page load.
   Call ssPageFadeIn() at the very bottom of each page,
   or it self-executes on DOMContentLoaded.
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


/* ════════════════════════════════════════════════
   WATCH IT SHEET
   Shared bottom sheet for "Watch It" on any page.
   Requires: #watch-sheet-overlay and #watch-sheet
   elements in the HTML (from showshak-components.css).

   Usage:
     ssOpenSheet(show)        — open with show data
     ssCloseSheet()           — close
     ssHandleWatchNow(p, t)   — platform selected callback
════════════════════════════════════════════════ */
function ssOpenSheet(show) {
  if (!show) return;

  // Build header
  const header = document.getElementById('sheet-header');
  if (header) {
    header.innerHTML = `
      <div class="sheet-thumb" style="background:${show.bg}">
        <span>${show.title}</span>
      </div>
      <div class="sheet-info">
        <div class="sheet-show-title">${show.title}</div>
        <div class="sheet-meta">${show.year} · ${show.season}<br>${show.genre.join(' · ')}</div>
      </div>
    `;
  }

  // Build platform options
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

// Legacy aliases
function openSheet(idx)   { if (typeof SHOWS !== 'undefined') ssOpenSheet(SHOWS[idx]); }
function closeSheet()     { ssCloseSheet(); }
function handleWatchNow(p, t) { ssHandleWatchNow(p, t); }


/* ════════════════════════════════════════════════
   SHARED NAVIGATION HELPERS
   Highlights the correct nav item based on current page.
   Called automatically on load.
════════════════════════════════════════════════ */
(function highlightActiveNav() {
  const path = window.location.pathname.toLowerCase();

  // Map filename keywords → which nav item to mark active
  const navMap = {
    'feed':     '[data-nav="feed"]',
    'discover': '[data-nav="discover"]',
    'watchlist':'[data-nav="watchlist"]',
    'profile':  '[data-nav="profile"]',
  };

  for (const [key, selector] of Object.entries(navMap)) {
    if (path.includes(key)) {
      // Sidebar
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      document.querySelectorAll(selector).forEach(el => el.classList.add('active'));
      // Mobile nav
      document.querySelectorAll('.mob-nav-item').forEach(el => el.classList.remove('active'));
      document.querySelectorAll(`[data-mob-nav="${key}"]`).forEach(el => el.classList.add('active'));
      break;
    }
  }
})();


/* ════════════════════════════════════════════════
   FORMAT HELPERS
════════════════════════════════════════════════ */

/**
 * Format a fire/like count for display.
 * 1240 → "1.2k", 500 → "500"
 */
function fmtFires(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

/**
 * Scroll any element to top smoothly.
 * Usage: ssScrollToTop('feed')
 */
function ssScrollToTop(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
}

// Legacy alias
function scrollFeedToTop() { ssScrollToTop('feed'); }


/* ════════════════════════════════════════════════
   SHARE UTILITY
   Uses Web Share API or clipboard fallback.
   Usage: ssShare(show)
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

// Legacy alias used in feed page
function shareClip(idx) {
  if (typeof SHOWS !== 'undefined') ssShare(SHOWS[idx]);
}
/* ════════════════════════════════════════════════
   SMOOTH PAGE NAVIGATION
   Fade out → navigate → new page fades in via
   ssPageFadeIn() which already runs on every page.
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

  // Ignore: empty, hash-only, external, or has onclick handler
  if (!href || href === '#' || href.startsWith('http') || link.hasAttribute('onclick')) return;

  // Only intercept sidebar nav, mobile nav, and the logo link
  const inNav = link.closest('.sidebar-nav') ||
                link.closest('.mobile-bottom-nav') ||
                link.closest('.sidebar-logo');
  if (!inNav) return;

  e.preventDefault();
  ssNavigate(href);
});