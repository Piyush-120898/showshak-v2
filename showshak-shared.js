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
   NAV HIGHLIGHT
════════════════════════════════════════════════ */
(function highlightActiveNav() {
  const path = window.location.pathname.toLowerCase();
  const navMap = {
    'feed':      '[data-nav="feed"]',
    'discover':  '[data-nav="discover"]',
    'watchlist': '[data-nav="watchlist"]',
    'profile':   '[data-nav="profile"]',
  };
  for (const [key, selector] of Object.entries(navMap)) {
    if (path.includes(key)) {
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      document.querySelectorAll(selector).forEach(el => el.classList.add('active'));
      document.querySelectorAll('.mob-nav-item').forEach(el => el.classList.remove('active'));
      document.querySelectorAll(`[data-mob-nav="${key}"]`).forEach(el => el.classList.add('active'));
      break;
    }
  }
})();


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
}

/* ── Read helpers ──────────────────────────────── */

function ssIsClipSaved(clipId) {
  return ssGetStacks().some(s => s.clips.some(c => c.id === clipId));
}

/* ── Stack operations ──────────────────────────── */

function ssCreateStack(name) {
  const stacks = ssGetStacks();
  const stack  = { id: 'stack_' + Date.now(), name: name.trim(), createdAt: Date.now(), clips: [] };
  stacks.push(stack);
  _ss_writeStacks(stacks);
  return stack;
}

function ssAddClipToStack(stackId, clip) {
  const stacks = ssGetStacks();
  const stack  = stacks.find(s => s.id === stackId);
  if (!stack) return;
  if (stack.clips.some(c => c.id === clip.id)) return; // no duplicates
  stack.clips.unshift(clip);                            // newest first
  _ss_writeStacks(stacks);
}

function ssRemoveClipFromStack(stackId, clipId) {
  const stacks = ssGetStacks();
  const stack  = stacks.find(s => s.id === stackId);
  if (!stack) return;
  stack.clips = stack.clips.filter(c => c.id !== clipId);
  _ss_writeStacks(stacks);
}

function ssRemoveClipFromAllStacks(clipId) {
  const stacks = ssGetStacks();
  stacks.forEach(s => { s.clips = s.clips.filter(c => c.id !== clipId); });
  _ss_writeStacks(stacks);
}

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

  if (alreadyIn) {
    stack.clips = stack.clips.filter(c => String(c.id) !== String(_ssSheetClip.id));
    _ss_writeStacks(stacks);
    ssToast(`Removed from ${stack.name}`);
  } else {
    stack.clips.unshift(_ssSheetClip);
    _ss_writeStacks(stacks);
    ssToast(`🔖 Saved to ${stack.name}`);
  }

  // Re-render list and sync all save buttons for this clip
  _ssRenderStackList();
  ssSyncSaveBtn(_ssSheetClip.id);
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
    <div class="ssv-close" onclick="ssCloseClip()">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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
          <div class="ssv-avatar" style="background:${c.creator.bg}">${c.creator.letter}</div>
          <span class="ssv-handle">@${c.creator.name}</span>
          <span class="ssv-follow">+ Follow</span>
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

  document.addEventListener('keydown', _ssvKeydown);
}

function ssCloseClip() {
  const viewer = document.getElementById('ss-clip-viewer');
  if (viewer) viewer.classList.remove('open');
  document.body.style.overflow = _ssvPrevScroll || '';
  if (_ssvObserver) { _ssvObserver.disconnect(); _ssvObserver = null; }
  document.removeEventListener('keydown', _ssvKeydown);
  // Re-sync any save buttons on the underlying page
  setTimeout(ssSyncAllSaveBtns, 50);
}

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

  // Fire energy → flash the Watch It CTA on this clip
  if (fired) {
    const watch = document.querySelector(`#ssv-clip-${i} .ssv-watch`);
    if (watch) { watch.style.filter = 'brightness(1.5) saturate(1.3)'; setTimeout(() => watch.style.filter = '', 360); }
  }
}
