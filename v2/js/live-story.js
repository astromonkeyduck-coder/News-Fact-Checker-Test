/**
 * Live Story client - Noteworthy News
 *
 * Renders a single live story + its timeline, polls for updates, and wires the
 * "Follow Live" button to the existing push subscription flow (window.PushNotifications)
 * plus the follow-live-story Netlify function.
 */
(function () {
  'use strict';

  var POLL_MS = 25000;
  var STATUS_LABELS = {
    breaking: 'Breaking',
    developing: 'Developing',
    verified: 'Verified',
    disputed: 'Disputed',
    resolved: 'Resolved',
    false_report: 'False report'
  };
  var KIND_LABELS = {
    major: 'Major update',
    minor: 'Update',
    correction: 'Correction',
    final: 'Final update'
  };

  var root = document.getElementById('ls-root');
  var toastEl = document.getElementById('ls-toast');
  var state = {
    slug: getSlug(),
    story: null,
    updates: [],
    knownIds: {},
    following: false,
    busy: false
  };

  function fnBase() {
    var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    return isLocal ? 'http://localhost:8888/.netlify/functions' : '/.netlify/functions';
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

  // textContent->innerHTML does not escape quotes, so use this when the value is
  // placed inside an HTML attribute value (e.g. href="...").
  function attrEsc(s) {
    return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Only allow http(s) links. Blocks javascript:/data: and other schemes that
  // could execute if an editor-authored source_url were ever crafted maliciously.
  function safeUrl(u) {
    if (!u) return null;
    try {
      var parsed = new URL(String(u), location.href);
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') ? parsed.href : null;
    } catch (e) {
      return null;
    }
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
    return new Date(iso).toLocaleDateString();
  }

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 3200);
  }

  /* ── Data ─────────────────────────────────────────── */

  async function loadStory(isPoll) {
    if (!state.slug) {
      root.innerHTML = '<div class="ls-state ls-error">No story specified.</div>';
      return;
    }
    try {
      var res = await fetch(fnBase() + '/live-stories?slug=' + encodeURIComponent(state.slug));
      if (res.status === 404) {
        root.innerHTML = '<div class="ls-state">This live story is no longer available.</div>';
        return;
      }
      if (!res.ok) throw new Error('Failed to load story');
      var data = await res.json();

      var prevStatus = state.story && state.story.status;
      state.story = data.story;
      state.updates = data.updates || [];

      render(isPoll);

      if (isPoll && prevStatus && prevStatus !== state.story.status) {
        toast('Status changed: ' + (STATUS_LABELS[state.story.status] || state.story.status));
      }
    } catch (err) {
      if (!isPoll) {
        root.innerHTML = '<div class="ls-state ls-error">Could not load this story. Please try again.</div>';
      }
      console.warn('[LiveStory]', err);
    }
  }

  /* ── Render ───────────────────────────────────────── */

  function render(isPoll) {
    var s = state.story;
    var statusLabel = STATUS_LABELS[s.status] || s.status;

    root.innerHTML =
      '<span class="ls-status" data-status="' + esc(s.status) + '"><span class="dot"></span>' + esc(statusLabel) + '</span>' +
      '<h1 class="ls-title">' + esc(s.title) + '</h1>' +
      (s.summary ? '<p class="ls-summary">' + esc(s.summary) + '</p>' : '') +
      '<div class="ls-meta">' +
        (s.category ? '<span><b>' + esc(s.category) + '</b></span>' : '') +
        '<span>Severity <b>' + esc(s.severity) + '/5</b></span>' +
        '<span>Confidence <b>' + esc(s.confidence) + '</b></span>' +
        '<span><b id="ls-follower-count">' + esc(s.follower_count || 0) + '</b> following</span>' +
      '</div>' +
      '<button class="ls-follow" id="ls-follow-btn" data-following="' + (state.following ? 'true' : 'false') + '">' +
        '<span class="live-dot"></span><span id="ls-follow-label">' + (state.following ? 'Following Live' : 'Follow Live') + '</span>' +
      '</button>' +
      '<p class="ls-hint" id="ls-follow-hint"></p>' +
      '<div class="ls-timeline-head">' +
        '<span class="ls-timeline-title">Live timeline</span>' +
        ((s.status !== 'resolved' && s.status !== 'false_report')
          ? '<span class="ls-live-tag"><span class="dot"></span>Live</span>' : '') +
      '</div>' +
      '<ul class="ls-timeline" id="ls-timeline"></ul>';

    renderTimeline(isPoll);

    document.getElementById('ls-follow-btn').addEventListener('click', onFollowClick);
    refreshFollowHint();
  }

  function renderTimeline(isPoll) {
    var list = document.getElementById('ls-timeline');
    if (!list) return;

    if (!state.updates.length) {
      list.innerHTML = '<li class="ls-state">No updates yet. Follow live to get notified.</li>';
      return;
    }

    list.innerHTML = state.updates.map(function (u) {
      var isNew = isPoll && !state.knownIds[u.id];
      var kind = u.kind || 'minor';
      var srcUrl = safeUrl(u.source_url);
      return '<li class="ls-update' + (isNew ? ' is-new' : '') + '" data-kind="' + attrEsc(kind) + '">' +
        '<div class="ls-update-meta">' +
          '<span class="ls-update-kind">' + esc(KIND_LABELS[kind] || 'Update') + '</span>' +
          '<span>&middot;</span>' +
          '<span>' + esc(relTime(u.created_at)) + '</span>' +
        '</div>' +
        '<div class="ls-update-body">' + esc(u.body) + '</div>' +
        (srcUrl
          ? '<a class="ls-update-source" href="' + attrEsc(srcUrl) + '" target="_blank" rel="noopener noreferrer">' +
              'Source: ' + esc(u.source_label || hostOf(srcUrl)) + '</a>'
          : '') +
      '</li>';
    }).join('');

    // Record what we've seen so subsequent polls can flag genuinely new items.
    state.updates.forEach(function (u) { state.knownIds[u.id] = true; });

    if (isPoll) {
      var added = list.querySelector('.ls-update.is-new');
      if (added) {
        toast('New update');
        try { added.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      }
    }
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return 'link'; }
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
    label.textContent = state.following ? 'Following Live' : 'Follow Live';
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
        hint.innerHTML = 'You can still follow on this page. Push alerts aren\u2019t supported in this browser.';
      }
      return;
    }
    if (api.getPermissionState() === 'denied') {
      hint.innerHTML = 'Notifications are blocked. Enable them in your browser settings to get live alerts.';
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
          refreshFollowHint();
          return;
        }
        sub = await api.getSubscription();
      }
      if (!sub) { toast('Could not enable alerts'); return; }

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
      refreshFollowHint();

      var countEl = document.getElementById('ls-follower-count');
      if (countEl && typeof data.followerCount === 'number') countEl.textContent = data.followerCount;

      toast(state.following ? 'Following live \u2014 alerts on' : 'Unfollowed');
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
