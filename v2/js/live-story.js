/**
 * Live Story client - Noteworthy News
 *
 * Renders a live story as a premium timeline: status header, follow CTA,
 * newest-first updates with anchors and copy links, a source trail built
 * from the updates' real citations, other live stories, and recent
 * coverage. Polls for updates and keeps the follow flow wired to
 * window.PushNotifications plus the follow-live-story function.
 *
 * Page chrome behaviors (reading progress, share menu, reveals) come from
 * /js/article-v4.js which this page also loads.
 */
(function () {
  'use strict';

  var POLL_MS = 25000;
  var SITE_URL = 'https://noteworthynews.co';

  var STATUS_LABELS = {
    breaking: 'Breaking',
    developing: 'Developing',
    verified: 'Verified',
    disputed: 'Disputed',
    resolved: 'Resolved',
    false_report: 'False report'
  };
  var STATUS_NOTES = {
    breaking: 'This story is moving quickly. Details can change as sources confirm.',
    developing: 'This story is still developing. We publish what is confirmed and label what is not.',
    verified: 'The core facts of this story have been confirmed with primary sources or official data.',
    disputed: 'Key claims in this story are disputed. The timeline notes who says what.',
    resolved: 'This story has concluded. The timeline remains as a record.',
    false_report: 'The original report did not hold up. The correction stays visible below.'
  };
  var KIND_LABELS = {
    major: 'Major update',
    minor: 'Update',
    correction: 'Correction',
    final: 'Final update'
  };

  var root = document.getElementById('ls-root');
  var toastEl = document.getElementById('ls-toast');
  var jumpEl = document.getElementById('ls-jump');
  var state = {
    slug: getSlug(),
    story: null,
    updates: [],
    knownIds: {},
    following: false,
    busy: false,
    rendered: false,
    railDone: false
  };

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fnBase() {
    // Same-origin: works on production and under any local dev server that
    // serves or proxies the Netlify functions (netlify dev included).
    return '/.netlify/functions';
  }

  function getSlug() {
    var m = location.pathname.match(/\/story\/([^/?#]+)/);
    if (m && m[1]) return decodeURIComponent(m[1]);
    var qs = new URLSearchParams(location.search);
    return qs.get('slug') || '';
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  // textContent->innerHTML does not escape quotes, so use this when the value
  // is placed inside an HTML attribute value (e.g. href="...").
  function attrEsc(s) {
    return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Only allow http(s) links. Blocks javascript:/data: and other schemes.
  function safeUrl(u) {
    if (!u) return null;
    try {
      var parsed = new URL(String(u), location.href);
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') ? parsed.href : null;
    } catch (e) {
      return null;
    }
  }

  function domId(raw) {
    return 'update-' + String(raw).replace(/[^a-zA-Z0-9_-]/g, '');
  }

  function relTime(iso) {
    if (!iso) return '';
    var then = new Date(iso).getTime();
    if (isNaN(then)) return '';
    var diff = Math.max(0, Date.now() - then);
    var min = Math.floor(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return min + 'm ago';
    var hr = Math.floor(min / 60);
    if (hr < 24) return hr + 'h ago';
    var day = Math.floor(hr / 24);
    if (day < 7) return day + 'd ago';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function absTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) +
      ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function isoTime(iso) {
    var d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return 'link'; }
  }

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 3200);
  }

  function storyUrl() {
    return SITE_URL + '/story/' + encodeURIComponent(state.slug);
  }

  /* ── Data ─────────────────────────────────────────── */

  async function loadStory(isPoll) {
    if (!state.slug) {
      renderState('No story specified.', 'Head back to the front page for everything that is live right now.', true);
      return;
    }
    try {
      var res = await fetch(fnBase() + '/live-stories?slug=' + encodeURIComponent(state.slug));
      if (res.status === 404) {
        renderState('This live story is no longer available.', 'It may have been archived. The latest coverage is on the front page.', false);
        return;
      }
      if (!res.ok) throw new Error('Failed to load story');
      var data = await res.json();

      var prevStatus = state.story && state.story.status;
      state.story = data.story;
      state.updates = (data.updates || []).slice().sort(function (a, b) {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });

      render(isPoll);

      if (isPoll && prevStatus && prevStatus !== state.story.status) {
        toast('Status changed: ' + (STATUS_LABELS[state.story.status] || state.story.status));
      }
    } catch (err) {
      if (!isPoll) {
        renderState('Could not load this story.', 'Check your connection and try again in a moment.', true);
      }
      console.warn('[LiveStory]', err);
    }
  }

  function renderState(title, text, showRetry) {
    if (!root) return;
    root.setAttribute('aria-busy', 'false');
    root.innerHTML =
      '<div class="nn-state">' +
        '<h1 class="nn-state-title">' + esc(title) + '</h1>' +
        '<p class="nn-state-text">' + esc(text) + '</p>' +
        '<div class="nn-state-actions">' +
          (showRetry ? '<button type="button" class="utility-btn utility-btn--primary" onclick="location.reload()">Try again</button>' : '') +
          '<a class="utility-btn" href="/">Front page</a>' +
          '<a class="utility-btn" href="/archive.html">All stories</a>' +
        '</div>' +
      '</div>';
  }

  /* ── Render ───────────────────────────────────────── */

  function render(isPoll) {
    var s = state.story;
    var statusLabel = STATUS_LABELS[s.status] || s.status;
    var isLive = s.status !== 'resolved' && s.status !== 'false_report';
    var started = absTime(s.created_at);
    var updated = relTime(s.last_update_at || s.updated_at);
    var firstRender = !state.rendered;

    var metaBits = [];
    if (started) {
      metaBits.push('<span>Started <time datetime="' + attrEsc(isoTime(s.created_at)) + '">' + esc(started) + '</time></span>');
    }
    if (updated) {
      metaBits.push('<span class="meta-updated">Updated ' + esc(updated) + '</span>');
    }
    if (state.updates.length) {
      metaBits.push('<span><b>' + state.updates.length + '</b> update' + (state.updates.length === 1 ? '' : 's') + '</span>');
    }
    metaBits.push('<span><b id="ls-follower-count">' + esc(String(s.follower_count || 0)) + '</b> following</span>');

    root.setAttribute('aria-busy', 'false');
    root.innerHTML =
      '<header class="story-header" id="story-header">' +
        '<div class="story-kicker">' +
          '<span class="ls-status" data-status="' + attrEsc(s.status) + '"><span class="dot" aria-hidden="true"></span>' + esc(statusLabel) + '</span>' +
          (s.category ? '<span class="story-kicker-cat">' + esc(s.category) + '</span>' : '') +
        '</div>' +
        '<h1 class="story-headline" id="article-heading" tabindex="-1">' + esc(s.title) + '</h1>' +
        (s.summary ? '<p class="story-dek">' + esc(s.summary) + '</p>' : '') +
        '<div class="story-meta">' + metaBits.join('<span class="nn-meta__sep" aria-hidden="true">&middot;</span>') + '</div>' +
        '<div class="story-actions" role="group" aria-label="Story actions">' +
          '<button class="ls-follow" id="ls-follow-btn" type="button" data-following="' + (state.following ? 'true' : 'false') + '">' +
            '<span class="live-dot" aria-hidden="true"></span><span id="ls-follow-label">' + (state.following ? 'Following live' : 'Follow live') + '</span>' +
          '</button>' +
          '<button type="button" class="utility-btn" id="copy-link-btn" aria-label="Copy link to this story">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' +
            '<span>Copy link</span></button>' +
          '<button type="button" class="utility-btn" id="share-menu-btn" aria-label="Share this story" aria-haspopup="true" aria-expanded="false">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>' +
            '<span>Share</span></button>' +
          '<button type="button" class="utility-btn utility-btn--primary" data-open-chat aria-label="Ask Noteworthy News AI about this story">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg>' +
            '<span>Ask about this story</span></button>' +
          '<div class="share-menu" id="share-menu" role="menu" aria-hidden="true">' +
            '<a href="#" class="share-option" id="share-twitter" target="_blank" rel="noopener noreferrer" role="menuitem"><span>Share on X</span></a>' +
            '<a href="#" class="share-option" id="share-facebook" target="_blank" rel="noopener noreferrer" role="menuitem"><span>Facebook</span></a>' +
            '<a href="#" class="share-option" id="share-linkedin" target="_blank" rel="noopener noreferrer" role="menuitem"><span>LinkedIn</span></a>' +
            '<a href="#" class="share-option" id="share-reddit" target="_blank" rel="noopener noreferrer" role="menuitem"><span>Reddit</span></a>' +
            '<a href="#" class="share-option" id="share-email" role="menuitem"><span>Email</span></a>' +
          '</div>' +
        '</div>' +
        '<p class="ls-hint" id="ls-follow-hint"></p>' +
      '</header>' +
      '<div class="ls-timeline-head">' +
        '<h2 class="ls-timeline-title">Live timeline</h2>' +
        (isLive ? '<span class="ls-live-tag"><span class="dot" aria-hidden="true"></span>Live</span>' : '') +
      '</div>' +
      '<ol class="ls-timeline" id="ls-timeline" aria-label="Story updates, newest first"></ol>';

    renderTimeline(isPoll, firstRender);

    document.getElementById('ls-follow-btn').addEventListener('click', onFollowClick);
    refreshFollowHint();

    // Wire copy/share through the shared article controls.
    if (typeof window.updateShareMenu === 'function') {
      window.updateShareMenu(s.title, storyUrl());
    }
    if (typeof window.reinitArticlePageControls === 'function') {
      window.reinitArticlePageControls();
    }

    updateMeta(s);
    renderStatusRail(s);
    renderSourceTrail();

    if (firstRender) {
      state.rendered = true;
      loadRailExtras();
      handleDeepLink();
    }
  }

  function renderTimeline(isPoll, firstRender) {
    var list = document.getElementById('ls-timeline');
    if (!list) return;

    if (!state.updates.length) {
      list.innerHTML =
        '<li class="nn-state" style="max-width:none">' +
          '<p class="nn-state-title" style="font-size:1rem">No updates yet</p>' +
          '<p class="nn-state-text" style="margin-bottom:0">Follow live and the first update will reach you the moment it publishes.</p>' +
        '</li>';
      return;
    }

    list.innerHTML = state.updates.map(function (u, i) {
      var isNew = isPoll && !state.knownIds[u.id];
      var kind = u.kind || 'minor';
      var srcUrl = safeUrl(u.source_url);
      var anchorId = domId(u.id);
      var reveal = firstRender && !reducedMotion ? ' reveal-item' : '';
      var ri = firstRender ? ' style="--ri:' + Math.min(i, 8) + '"' : '';
      return '<li class="ls-update' + (isNew ? ' is-new' : '') + reveal + '" data-kind="' + attrEsc(kind) + '" id="' + attrEsc(anchorId) + '"' + ri + '>' +
        '<div class="ls-update-meta">' +
          (i === 0 ? '<span class="ls-latest-tag">Latest</span>' : '') +
          '<span class="ls-update-kind">' + esc(KIND_LABELS[kind] || 'Update') + '</span>' +
          '<span aria-hidden="true">&middot;</span>' +
          '<time class="ls-update-time" datetime="' + attrEsc(isoTime(u.created_at)) + '" title="' + attrEsc(absTime(u.created_at)) + '">' + esc(relTime(u.created_at)) + '</time>' +
          '<button type="button" class="ls-anchor-btn" data-anchor="' + attrEsc(anchorId) + '" aria-label="Copy link to this update">' +
            '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' +
            'Link</button>' +
        '</div>' +
        '<div class="ls-update-body">' + esc(u.body) + '</div>' +
        (srcUrl
          ? '<a class="ls-update-source" href="' + attrEsc(srcUrl) + '" target="_blank" rel="noopener noreferrer">' +
              'Source: ' + esc(u.source_label || hostOf(srcUrl)) + '</a>'
          : '') +
      '</li>';
    }).join('');

    // Record what we've seen so subsequent polls can flag genuinely new items.
    var hadNew = false;
    state.updates.forEach(function (u) {
      if (isPoll && !state.knownIds[u.id]) hadNew = true;
      state.knownIds[u.id] = true;
    });

    list.querySelectorAll('.ls-anchor-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var url = storyUrl() + '#' + btn.dataset.anchor;
        navigator.clipboard.writeText(url).then(
          function () { toast('Link to update copied'); },
          function () { window.prompt('Copy this link:', url); }
        );
      });
    });

    if (firstRender && typeof window.nnBindReveals === 'function') {
      window.nnBindReveals(list);
    }

    if (isPoll && hadNew) {
      toast('New update');
      maybeShowJump(true);
    }
  }

  /* ── Jump to latest ──────────────────────────────── */

  function timelineTop() {
    var head = document.querySelector('.ls-timeline-head');
    if (!head) return 0;
    return head.getBoundingClientRect().top + window.scrollY;
  }

  function maybeShowJump(hasNew) {
    if (!jumpEl) return;
    var label = document.getElementById('ls-jump-label');
    var far = window.scrollY > timelineTop() + 350;
    if (hasNew && far) {
      if (label) label.textContent = 'New update';
      jumpEl.hidden = false;
      jumpEl.classList.add('show');
    } else if (!far) {
      jumpEl.classList.remove('show');
      if (label) label.textContent = 'Jump to latest';
    }
  }

  function initJump() {
    if (!jumpEl) return;
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        if (!state.rendered) return;
        var far = window.scrollY > timelineTop() + 350;
        jumpEl.hidden = false;
        jumpEl.classList.toggle('show', far);
        if (!far) {
          var label = document.getElementById('ls-jump-label');
          if (label) label.textContent = 'Jump to latest';
        }
      });
    }, { passive: true });

    jumpEl.addEventListener('click', function () {
      var head = document.querySelector('.ls-timeline-head');
      if (head) {
        head.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      }
      var first = document.querySelector('.ls-timeline .ls-update');
      if (first) {
        first.setAttribute('tabindex', '-1');
        setTimeout(function () { first.focus({ preventScroll: true }); }, reducedMotion ? 0 : 450);
      }
      jumpEl.classList.remove('show');
    });
  }

  /* ── Deep links (#update-...) ────────────────────── */

  function handleDeepLink() {
    var hash = location.hash.replace(/^#/, '');
    if (!hash || hash.indexOf('update-') !== 0) return;
    var el = document.getElementById(hash);
    if (!el) return;
    setTimeout(function () {
      el.classList.add('is-target');
      el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    }, 150);
  }

  /* ── Rail: how we know + source trail ────────────── */

  function renderStatusRail(s) {
    var body = document.getElementById('ls-rail-status-body');
    if (!body) return;
    var facts = [];
    facts.push('<div class="rail-fact"><span>Status</span><b>' + esc(STATUS_LABELS[s.status] || s.status) + '</b></div>');
    if (s.confidence) {
      facts.push('<div class="rail-fact"><span>Confidence</span><b>' + esc(String(s.confidence)) + '</b></div>');
    }
    if (s.severity != null) {
      facts.push('<div class="rail-fact"><span>Severity</span><b>' + esc(String(s.severity)) + '/5</b></div>');
    }
    if (s.created_at) {
      facts.push('<div class="rail-fact"><span>Started</span><b>' + esc(new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) + '</b></div>');
    }
    facts.push('<div class="rail-fact"><span>Updates</span><b>' + state.updates.length + '</b></div>');

    var note = STATUS_NOTES[s.status] || '';
    body.innerHTML = facts.join('') + (note ? '<p class="rail-note" style="margin-top:0.7rem">' + esc(note) + '</p>' : '');
  }

  function renderSourceTrail() {
    var body = document.getElementById('ls-rail-trail-body');
    if (!body) return;

    var bySource = {};
    var order = [];
    state.updates.forEach(function (u) {
      var url = safeUrl(u.source_url);
      if (!url) return;
      if (!bySource[url]) {
        bySource[url] = { label: u.source_label || hostOf(url), count: 0, latest: u.created_at };
        order.push(url);
      }
      bySource[url].count++;
      if (new Date(u.created_at) > new Date(bySource[url].latest)) {
        bySource[url].latest = u.created_at;
      }
    });

    if (order.length === 0) {
      body.innerHTML =
        '<p class="rail-note">No external links cited yet. Updates that cite sources list them here automatically.</p>' +
        '<p class="rail-note"><a href="/how-we-verify.html">How we verify stories</a></p>';
      return;
    }

    body.innerHTML = '<ul class="trail-list">' + order.map(function (url) {
      var srec = bySource[url];
      var meta = srec.count > 1
        ? 'Cited in ' + srec.count + ' updates'
        : 'Cited ' + relTime(srec.latest);
      return '<li class="trail-item">' +
        '<a class="trail-link" href="' + attrEsc(url) + '" target="_blank" rel="noopener noreferrer">' +
          '<span class="trail-label">' + esc(srec.label) + '</span>' +
          '<span class="trail-host">' + esc(hostOf(url)) + '</span>' +
        '</a>' +
        '<span class="trail-meta">' + esc(meta) + '</span>' +
      '</li>';
    }).join('') + '</ul>';
  }

  /* ── Rail extras: other live stories + coverage ──── */

  async function loadRailExtras() {
    if (state.railDone) return;
    state.railDone = true;
    loadOtherLiveStories();
    loadRecentCoverage();
  }

  async function loadOtherLiveStories() {
    try {
      var res = await fetch(fnBase() + '/live-stories?limit=6');
      if (!res.ok) return;
      var data = await res.json();
      var others = ((data && data.stories) || []).filter(function (s) {
        return s.slug !== state.slug;
      }).slice(0, 4);
      if (!others.length) return;

      var wrap = document.getElementById('ls-rail-more');
      var body = document.getElementById('ls-rail-more-body');
      if (!wrap || !body) return;

      body.innerHTML = others.map(function (s) {
        var when = relTime(s.last_update_at || s.updated_at);
        return '<a class="rail-story rail-story--noimg" href="/story/' + attrEsc(encodeURIComponent(s.slug)) + '">' +
          '<span>' +
            '<span class="rail-story-title">' + esc(s.title) + '</span>' +
            '<span class="rail-story-time">' + esc(STATUS_LABELS[s.status] || s.status) + (when ? ' &middot; updated ' + esc(when) : '') + '</span>' +
          '</span>' +
        '</a>';
      }).join('');
      wrap.style.display = '';
    } catch (e) { /* non-critical */ }
  }

  async function loadRecentCoverage() {
    try {
      var res = await fetch(fnBase() + '/posts-read?limit=12');
      if (!res.ok) return;
      var posts = await res.json();
      if (!Array.isArray(posts) || posts.length === 0) return;

      var section = document.getElementById('ls-coverage');
      var grid = document.getElementById('ls-coverage-grid');
      if (!section || !grid) return;

      var cn = window.ContentNormalize || null;
      var pm = window.PostMedia || null;

      var cards = posts.slice(0, 3).map(function (post, i) {
        var id = post.id || post.postId || '';
        var url = '/article.html?id=' + encodeURIComponent(id);
        var title = (cn && cn.cleanHeadline) ? cn.cleanHeadline(post) : (post.title || post.text || 'Untitled');
        var shortTitle = title.length > 90 ? title.substring(0, 87) + '\u2026' : title;
        var when = relTime(post.datePosted || post.createdAt || post.created_at);
        var kicker = post.category || post.source || '';

        var mediaBlock = '';
        if (cn && pm && cn.getPrimaryMedia) {
          var media = cn.getPrimaryMedia(post);
          if (media.type === 'video') {
            mediaBlock = pm.mediaHtml({ videoSrc: media.url, image: media.poster, alt: shortTitle }, esc);
          } else if (media.type === 'image') {
            mediaBlock = pm.mediaHtml({ image: media.url, alt: shortTitle, href: url }, esc);
          }
        }

        return '<article class="next-card reveal-item" style="--ri:' + i + '">' +
          mediaBlock +
          '<div class="next-card-body">' +
            (kicker ? '<span class="next-card-kicker">' + esc(kicker) + '</span>' : '') +
            '<a class="next-card-link" href="' + attrEsc(url) + '"><h3 class="next-card-title">' + esc(shortTitle) + '</h3></a>' +
            (when ? '<span class="next-card-time">' + esc(when) + '</span>' : '') +
          '</div>' +
        '</article>';
      });

      grid.innerHTML = cards.join('');
      section.hidden = false;
      if (pm && pm.initPostMedia) pm.initPostMedia(grid);
      if (typeof window.nnBindReveals === 'function') window.nnBindReveals(section);
    } catch (e) { /* non-critical */ }
  }

  /* ── Metadata (client-side; real story data only) ── */

  function upsertMeta(attr, name, content) {
    var el = document.querySelector('meta[' + attr + '="' + name + '"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function updateMeta(s) {
    var url = storyUrl();
    var title = s.title + ' | Live | Noteworthy News';
    var desc = (s.summary && s.summary.trim()) ||
      ('Live updates: ' + s.title + '. Timestamped updates with source notes.');

    document.title = title;
    upsertMeta('name', 'description', desc);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', desc);
    upsertMeta('property', 'og:url', url);
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', desc);

    var canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', url);

    var jsonld = {
      '@context': 'https://schema.org',
      '@type': 'LiveBlogPosting',
      headline: s.title,
      url: url,
      coverageStartTime: s.created_at || undefined,
      dateModified: s.last_update_at || s.updated_at || undefined,
      description: desc,
      publisher: {
        '@type': 'Organization',
        name: 'Noteworthy News',
        logo: { '@type': 'ImageObject', url: SITE_URL + '/IMG_5794.PNG' }
      },
      liveBlogUpdate: state.updates.slice(0, 20).map(function (u) {
        return {
          '@type': 'BlogPosting',
          headline: KIND_LABELS[u.kind || 'minor'] || 'Update',
          articleBody: u.body,
          datePublished: u.created_at,
          url: url + '#' + domId(u.id)
        };
      })
    };

    var el = document.getElementById('ls-jsonld');
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = 'ls-jsonld';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(jsonld);
  }

  /* ── Follow flow ──────────────────────────────────── */

  function pushAPI() { return window.PushNotifications || null; }

  async function detectFollowing() {
    var api = pushAPI();
    if (!api || !api.isSupported()) return;
    try {
      var sub = await api.getSubscription();
      if (!sub) return;
      var endpoint = sub.toJSON().endpoint;
      var res = await fetch(fnBase() + '/follow-live-story?endpoint=' + encodeURIComponent(endpoint));
      if (!res.ok) return;
      var data = await res.json();
      state.following = (data.follows || []).some(function (f) { return f.slug === state.slug; });
      reflectFollowState();
    } catch (e) { /* non-fatal */ }
  }

  function reflectFollowState() {
    var btn = document.getElementById('ls-follow-btn');
    var label = document.getElementById('ls-follow-label');
    if (!btn || !label) return;
    btn.dataset.following = state.following ? 'true' : 'false';
    label.textContent = state.following ? 'Following live' : 'Follow live';
    refreshFollowHint();
  }

  function refreshFollowHint() {
    var hint = document.getElementById('ls-follow-hint');
    if (!hint) return;
    var api = pushAPI();
    if (!api || !api.isSupported()) {
      var isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      var standalone = window.navigator.standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches;
      if (isiOS && !standalone) {
        hint.innerHTML = 'To get alerts on iPhone, tap Share then <b>Add to Home Screen</b>, then open from your home screen.';
      } else {
        hint.innerHTML = 'You can still read live on this page. Push alerts aren\u2019t supported in this browser.';
      }
      return;
    }
    if (api.getPermissionState() === 'denied') {
      hint.textContent = 'Notifications are blocked. Enable them in your browser settings to get live alerts.';
      return;
    }
    hint.textContent = state.following
      ? 'You\u2019ll get push alerts for major updates. Manage in notification settings.'
      : 'Get push alerts when this story develops.';
  }

  async function onFollowClick() {
    if (state.busy) return;
    var api = pushAPI();
    var btn = document.getElementById('ls-follow-btn');
    var label = document.getElementById('ls-follow-label');

    // No push support: follow is push-driven, so guide the user instead.
    if (!api || !api.isSupported()) {
      refreshFollowHint();
      toast('Push alerts aren\u2019t available here');
      return;
    }

    state.busy = true;
    btn.disabled = true;
    var wasFollowing = state.following;
    label.textContent = wasFollowing ? 'Updating\u2026' : 'Enabling\u2026';

    try {
      // Ensure we have an active push subscription before following.
      var sub = await api.getSubscription();
      if (!sub && !wasFollowing) {
        var sres = await api.subscribe();
        if (!sres.success) {
          toast(sres.permission === 'denied' ? 'Notifications blocked' : 'Could not enable alerts');
          reflectFollowState();
          return;
        }
        sub = await api.getSubscription();
      }
      if (!sub) { toast('Could not enable alerts'); reflectFollowState(); return; }

      var action = wasFollowing ? 'unfollow' : 'follow';
      var res = await fetch(fnBase() + '/follow-live-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action, slug: state.slug, subscription: sub.toJSON() })
      });
      if (!res.ok) throw new Error('Follow request failed');
      var data = await res.json();

      state.following = !!data.following;
      reflectFollowState();

      var countEl = document.getElementById('ls-follower-count');
      if (countEl && typeof data.followerCount === 'number') countEl.textContent = data.followerCount;

      toast(state.following ? 'Following live. Alerts on.' : 'Unfollowed');
    } catch (err) {
      console.warn('[LiveStory] follow error', err);
      toast('Something went wrong. Try again.');
      reflectFollowState();
    } finally {
      state.busy = false;
      btn.disabled = false;
    }
  }

  /* ── Boot ─────────────────────────────────────────── */

  async function init() {
    initJump();
    await loadStory(false);
    await detectFollowing();
    setInterval(function () {
      if (document.visibilityState === 'visible') loadStory(true);
    }, POLL_MS);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') loadStory(true);
    });
  }

  init();
})();
