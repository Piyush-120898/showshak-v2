/* ═══════════════════════════════════════════════════════════════
   showshak-stack-page.js — controller for the Stack Folder View
   (showshak-stack.html?stack=<id>). Part of the stack-folder-view feature.

   Boots from ?stack=, loads the stack via the shared (RLS/RPC-enforced)
   ssLoadSharedStackById, renders a title-blind grid + creator/contributor
   header, opens a clip into the universal viewer with the whole stack as the
   swipe playlist, runs the collaborative auto-join, and wires Share.
   Everything title-blind; the RPC is the only security boundary.
═══════════════════════════════════════════════════════════════ */
'use strict';

(function () {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function bodyEl() { return document.getElementById('sf-body'); }

  function stateHtml(icon, title, desc) {
    return '<div class="sf-state"><div class="sf-state-ic">' + icon + '</div>' +
           '<div class="sf-state-t">' + esc(title) + '</div>' +
           (desc ? '<div class="sf-state-d">' + esc(desc) + '</div>' : '') + '</div>';
  }

  function clipThumb(clip) {
    var poster = clip.poster ||
      (clip.muxPlaybackId && typeof ssCoverThumbUrl === 'function' ? ssCoverThumbUrl(clip.muxPlaybackId) : null);
    return poster ? '<img src="' + esc(poster) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '';
  }
  function creatorName(clip) {
    var c = clip.creator;
    if (c && typeof c === 'object') return c.name || c.username || 'curator';
    return (typeof c === 'string' && c) ? c : 'curator';
  }
  function fires(clip) {
    var n = (clip.litCount != null) ? clip.litCount : (clip.fires || 0);
    return (typeof fmtFires === 'function') ? fmtFires(n) : String(n);
  }

  var FIRE_SVG = '<svg width="11" height="11" viewBox="0 0 24 24" fill="#EA3B32"><path d="M12 2C12 2 8 6.5 8 10a4 4 0 0 0 8 0c0-1.5-.8-3-1.5-4C13.8 7.5 14 9 13 10c-.5.5-1 .8-1 .8S10 9.5 10 8c0-2 2-6 2-6z"/><path d="M12 14c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4z"/></svg>';

  function render(res, stackId) {
    var body = bodyEl(); if (!body) return;
    var stack = res.stack || {};
    var clips = res.clips || [];
    var members = res.members || [];

    // Owner identity (prefer the owner member row — it carries the @username).
    var ownerRow = members.filter(function (m) { return m.role === 'owner'; })[0]
                 || { user_id: stack.user_id, username: 'curator', role: 'owner' };
    var contributors = (typeof ssStackContributors === 'function')
      ? ssStackContributors(ownerRow, members) : [ownerRow];
    var collab = stack.mode === 'collaborative';

    var headerBlur = clips.length && clips[0].poster ? '' : '';
    var nameRow = '<div class="sf-name">' + esc(stack.name || 'Shared stack') +
      (collab ? '<span class="sf-badge">👥 Collaborative</span>' : '') + '</div>';
    var meta = '<div class="sf-meta">' + clips.length + ' clip' + (clips.length !== 1 ? 's' : '') +
      (collab ? ' · co-curated' : '') + '</div>';

    var contribHtml;
    if (collab && contributors.length > 1) {
      contribHtml = '<div class="sf-contrib"><span class="sf-contrib-label">Curated by</span>' +
        contributors.map(function (p, i) {
          return '<span class="sf-handle' + (i === 0 ? ' owner' : '') + '" data-handle="' + esc(p.username) + '">@' + esc(p.username) + '</span>';
        }).join('') + '</div>';
    } else {
      var oc = contributors[0] || ownerRow;
      contribHtml = '<div class="sf-contrib"><span class="sf-contrib-label">By</span>' +
        '<span class="sf-handle owner" data-handle="' + esc(oc.username) + '">@' + esc(oc.username) + '</span></div>';
    }

    var actions = '<div class="sf-actions"><button class="sf-share" id="sf-share-btn">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>' +
      'Share</button></div>';

    var header = '<div class="sf-head"><div class="sf-head-inner">' +
      '<button class="sf-back" id="sf-back">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>Back</button>' +
      nameRow + meta + contribHtml + actions + '</div></div>';

    var grid;
    if (!clips.length) {
      grid = stateHtml('📭', 'No clips yet', 'This stack doesn’t have any clips to show right now.');
    } else {
      grid = '<div class="sf-grid">' + clips.map(function (clip, i) {
        return '<div class="sf-card" data-idx="' + i + '">' +
          '<div class="sf-thumb">' + clipThumb(clip) +
          '<div class="sf-thumb-vig"></div>' +
          '<div class="sf-card-meta">' +
          '<div class="sf-card-creator">@' + esc(creatorName(clip)) + '</div>' +
          '<div class="sf-card-fires">' + FIRE_SVG + fires(clip) + '</div>' +
          '</div></div></div>';
      }).join('') + '</div>';
    }

    body.innerHTML = header + grid;

    // Wire: back
    var back = document.getElementById('sf-back');
    if (back) back.addEventListener('click', function () {
      if (history.length > 1) history.back();
      else if (typeof ssNavigate === 'function') ssNavigate('showshak-watchlist.html');
      else location.href = 'showshak-watchlist.html';
    });

    // Wire: open a clip into the universal viewer with the whole stack as playlist
    body.querySelectorAll('.sf-card').forEach(function (el) {
      el.addEventListener('click', function () {
        var idx = parseInt(el.getAttribute('data-idx'), 10) || 0;
        if (typeof ssOpenClip === 'function') ssOpenClip(clips[idx], clips);
      });
    });

    // Wire: contributor handles → open curator profile
    body.querySelectorAll('.sf-handle').forEach(function (el) {
      el.addEventListener('click', function () {
        var h = el.getAttribute('data-handle');
        if (h && typeof ssOpenCurator === 'function') ssOpenCurator(h);
      });
    });

    // Wire: share
    var shareBtn = document.getElementById('sf-share-btn');
    if (shareBtn) shareBtn.addEventListener('click', function () {
      var me = (typeof ssCurrentUser === 'function') ? ssCurrentUser() : null;
      var isOwner = !!(me && me.id && stack.user_id && me.id === stack.user_id);
      var stackObj = Object.assign({}, stack, { clips: clips });
      if (isOwner && typeof ssShareStack === 'function') {
        ssShareStack(stackObj);   // opens the visibility chooser
        return;
      }
      // Non-owner: the stack is already shareable (they can see it) → share the link directly.
      var url = (typeof ssStackShareUrl === 'function') ? ssStackShareUrl(stackObj) : null;
      if (!url) { if (typeof ssToast === 'function') ssToast('This stack can’t be shared'); return; }
      var text = 'Check out "' + (stack.name || 'this stack') + '" on ShowShak 🔥';
      if (navigator.share) navigator.share({ title: (stack.name || 'A ShowShak Stack'), text: text, url: url }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(text + '\n' + url).then(function () { if (typeof ssToast === 'function') ssToast('🔗 Link copied'); }).catch(function () {});
    });

    // Collaborative auto-join (relocated from the feed ?stack= handler).
    maybeAutoJoin(res, stackId);
  }

  function maybeAutoJoin(res, stackId) {
    var stack = res.stack || {};
    if (stack.mode !== 'collaborative') return;
    var signedIn = (typeof ssIsSignedUp === 'function') ? ssIsSignedUp() : false;
    if (!signedIn) { if (typeof ssToast === 'function') setTimeout(function () { ssToast('Sign in to join this collaborative stack'); }, 1200); return; }
    if (res.viewerIsMember) return;
    var cap = (typeof SS_STACK_MEMBER_CAP === 'number') ? SS_STACK_MEMBER_CAP : 6;
    var canJoin = (typeof ssCanJoinStack === 'function')
      ? ssCanJoinStack({ mode: 'collaborative' }, res.memberCount, cap, false)
      : (res.memberCount < cap);
    if (!canJoin) { if (typeof ssToast === 'function') setTimeout(function () { ssToast('This collaborative stack is full'); }, 1200); return; }
    if (typeof ssJoinStack !== 'function') return;
    ssJoinStack(stackId).then(function (r) {
      if (!r) return;
      if (r.ok && r.joined) setTimeout(function () { ssToast('✓ You joined this stack — add your picks'); }, 1200);
      else if (r.reason === 'full') setTimeout(function () { ssToast('This collaborative stack is full'); }, 1200);
    });
  }

  function boot() {
    var id;
    try { id = new URLSearchParams(location.search).get('stack'); } catch (e) { id = null; }
    var body = bodyEl();
    if (!id) {
      if (body) body.innerHTML = stateHtml('🔒', 'Stack unavailable', 'This link doesn’t point to a stack.');
      return;
    }
    if (typeof ssLoadSharedStackById !== 'function') {
      if (body) body.innerHTML = stateHtml('⚠️', 'Couldn’t load', 'Please try again in a moment.');
      return;
    }
    ssLoadSharedStackById(id).then(function (res) {
      // Fall back to the local cache for the viewer's OWN local-only stack
      // (guest / not-yet-mirrored / offline). Only ever surfaces the viewer's
      // own stacks (sessionStorage), so there is no cross-user leak.
      if (!res) res = localFallback(id);
      if (!res) {
        if (body) body.innerHTML = stateHtml('🔒', 'This stack isn’t available', 'It may be private, or the link may be wrong.');
        return;
      }
      render(res, id);
    }).catch(function () {
      var fb = localFallback(id);
      if (fb) { render(fb, id); return; }
      if (body) body.innerHTML = stateHtml('⚠️', 'Couldn’t load this stack', 'Please try again in a moment.');
    });
  }

  function localFallback(id) {
    try {
      if (typeof ssGetStacks !== 'function') return null;
      var s = ssGetStacks().filter(function (x) { return x.id === id; })[0];
      if (!s) return null;
      var me = (typeof ssCurrentUser === 'function') ? ssCurrentUser() : null;
      var ownerId = s.ownerId || (me && me.id) || null;
      return {
        stack: { id: s.id, name: s.name, user_id: ownerId,
                 visibility: s.visibility || 'private', highlighted: !!s.highlighted, mode: s.mode || 'view' },
        clips: s.clips || [],
        members: ownerId ? [{ user_id: ownerId, role: 'owner', username: 'you' }] : [],
        memberCount: ownerId ? 1 : 0, viewerIsMember: !!ownerId
      };
    } catch (e) { return null; }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
