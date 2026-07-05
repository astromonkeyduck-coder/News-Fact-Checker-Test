/**
 * Live stories on the V4 homepage.
 *
 * Loads active live stories from /.netlify/functions/live-stories and:
 *   1. fills the header live chip with a real count
 *   2. claims the hero flagship card for the top live story
 *   3. renders highlighted live cards at the front of the Developing Now strip
 *
 * Every value shown (status, update time, follower count) comes from real
 * story data. All surfaces stay hidden when nothing is live.
 */
(function () {
  'use strict';

  var STATUS_LABELS = {
    breaking: 'Breaking',
    developing: 'Developing',
    verified: 'Verified',
    disputed: 'Disputed',
    resolved: 'Resolved',
    false_report: 'False report'
  };

  var STATUS_BADGE = {
    breaking: 'badge-live',
    developing: 'badge-warning',
    verified: 'badge-accent',
    disputed: 'badge-warning',
    resolved: 'badge-accent',
    false_report: 'badge-warning'
  };

  function fnBase() {
    var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    return isLocal ? 'http://localhost:8888/.netlify/functions' : '/.netlify/functions';
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function timeAgo(raw) {
    if (!raw) return '';
    var d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    var mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    return Math.floor(hours / 24) + 'd ago';
  }

  function statusBadge(status) {
    var label = STATUS_LABELS[status] || 'Live';
    var cls = STATUS_BADGE[status] || 'badge-live';
    return '<span class="badge ' + cls + '">' + esc(label) + '</span>';
  }

  function heroCard(story) {
    var status = story.status || 'developing';
    var updated = timeAgo(story.last_update_at || story.updated_at);
    var followers = story.follower_count || 0;
    var metaBits = [];
    if (updated) metaBits.push('Updated ' + esc(updated));
    if (followers) metaBits.push(esc(String(followers)) + ' following');

    return (
      '<a class="hero-card-link" href="/story/' + esc(story.slug) + '" aria-label="' + esc(story.title) + '">' +
        '<div class="hero-card-top">' +
          statusBadge(status) +
          (metaBits.length ? '<span class="hero-card-meta">' + metaBits.join(' &middot; ') + '</span>' : '') +
        '</div>' +
        '<div class="hero-card-row">' +
          '<h3 class="hero-card-title">' + esc(story.title) + '</h3>' +
        '</div>' +
        (story.summary ? '<p class="hero-card-summary">' + esc(story.summary) + '</p>' : '') +
        '<span class="hero-card-cta">Follow live' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>' +
        '</span>' +
      '</a>'
    );
  }

  function stripCard(story, i) {
    var status = story.status || 'developing';
    var updated = timeAgo(story.last_update_at || story.updated_at);
    var followers = story.follower_count || 0;

    return (
      '<a class="dev-card dev-card--live" style="--i:' + i + '" href="/story/' + esc(story.slug) + '" aria-label="' + esc(story.title) + '">' +
        '<div class="dev-card-top">' +
          statusBadge(status) +
          (updated ? '<span class="dev-card-time">' + esc(updated) + '</span>' : '') +
        '</div>' +
        '<h3 class="dev-card-title">' + esc(story.title) + '</h3>' +
        '<span class="dev-card-foot">Follow live' + (followers ? ' &middot; ' + esc(String(followers)) + ' following' : '') + '</span>' +
      '</a>'
    );
  }

  async function load() {
    try {
      var res = await fetch(fnBase() + '/live-stories?limit=7');
      if (!res.ok) return;
      var data = await res.json();
      var stories = (data && data.stories) || [];
      if (!stories.length) return; // all live surfaces stay hidden

      // Flagship: first pinned story if any, otherwise the most recent.
      var flagshipIndex = stories.findIndex(function (s) { return s.pinned; });
      if (flagshipIndex < 0) flagshipIndex = 0;
      var flagship = stories[flagshipIndex];

      // 1. Hero card: live story takes the slot over regular posts.
      var slot = document.getElementById('hero-card');
      if (slot) {
        slot.innerHTML = heroCard(flagship);
        slot.dataset.heroSource = 'live';
        slot.dataset.status = flagship.status || 'developing';
      }

      // 2. Developing Now strip: all live stories, flagship first.
      var track = document.getElementById('strip-live');
      if (track) {
        var ordered = [flagship].concat(stories.filter(function (_, i) { return i !== flagshipIndex; }));
        track.innerHTML = ordered.map(function (s, i) { return stripCard(s, i); }).join('');
        document.dispatchEvent(new CustomEvent('nn:strip-updated'));
      }

      // 3. Header live chip + "Live" nav link + hero CTA target.
      var chip = document.getElementById('nav-live-chip');
      var count = document.getElementById('nav-live-count');
      if (chip) {
        if (count) {
          count.textContent = stories.length === 1
            ? '1 story live'
            : stories.length + ' stories live';
        }
        chip.hidden = false;
      }
      document.querySelectorAll('[data-nav-live]').forEach(function (link) {
        link.hidden = false;
      });
      document.querySelectorAll('[data-live-cta]').forEach(function (link) {
        link.setAttribute('href', '#developing');
      });
    } catch (e) {
      // Live surfaces are non-critical: fail silently, they stay hidden.
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
