/**
 * Developing Now: homepage live coverage section.
 *
 * Loads active live stories from /.netlify/functions/live-stories and renders
 * one flagship story plus compact secondary cards. Every value shown (status,
 * follower count, update time) comes from real story data. The section stays
 * hidden when there are no active stories, so it never shows an empty shell.
 */
(function () {
  'use strict';

  var section = document.getElementById('live-stories');
  var rail = document.getElementById('live-rail');
  if (!section || !rail) return;

  var STATUS_LABELS = {
    breaking: 'Breaking',
    developing: 'Developing',
    verified: 'Verified',
    disputed: 'Disputed',
    resolved: 'Resolved',
    false_report: 'False report'
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

  function metaLine(story) {
    var parts = [];
    var updated = timeAgo(story.last_update_at || story.updated_at);
    if (updated) parts.push('Updated ' + esc(updated));
    var followers = story.follower_count || 0;
    if (followers) parts.push(esc(String(followers)) + ' following');
    return parts.join(' &middot; ');
  }

  function statusPill(status) {
    var label = STATUS_LABELS[status] || 'Update';
    return '<span class="live-rail-status" data-status="' + esc(status) + '"><span class="dot"></span>' + esc(label) + '</span>';
  }

  function flagshipCard(story) {
    var status = story.status || 'developing';
    var meta = metaLine(story);
    return (
      '<a class="live-flagship" href="/story/' + esc(story.slug) + '" data-status="' + esc(status) + '">' +
        '<div class="live-flagship-top">' +
          statusPill(status) +
          (meta ? '<span class="live-flagship-meta">' + meta + '</span>' : '') +
        '</div>' +
        '<h3 class="live-flagship-title">' + esc(story.title) + '</h3>' +
        (story.summary ? '<p class="live-flagship-summary">' + esc(story.summary) + '</p>' : '') +
        '<span class="live-flagship-cta">Follow live coverage' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>' +
        '</span>' +
      '</a>'
    );
  }

  function secondaryCard(story) {
    var status = story.status || 'developing';
    var updated = timeAgo(story.last_update_at || story.updated_at);
    return (
      '<a class="live-rail-card" href="/story/' + esc(story.slug) + '" data-status="' + esc(status) + '">' +
        '<div class="live-rail-card-top">' +
          statusPill(status) +
          (updated ? '<span class="live-rail-follows">' + esc(updated) + '</span>' : '') +
        '</div>' +
        '<h3 class="live-rail-card-title">' + esc(story.title) + '</h3>' +
        (story.summary ? '<p class="live-rail-card-summary">' + esc(story.summary) + '</p>' : '') +
        '<span class="live-rail-cta">Follow live &rarr;</span>' +
      '</a>'
    );
  }

  async function load() {
    try {
      var res = await fetch(fnBase() + '/live-stories?limit=7');
      if (!res.ok) return;
      var data = await res.json();
      var stories = (data && data.stories) || [];
      if (!stories.length) return; // leave section hidden

      // Flagship: first pinned story if any, otherwise the most recent.
      var flagshipIndex = stories.findIndex(function (s) { return s.pinned; });
      if (flagshipIndex < 0) flagshipIndex = 0;
      var flagship = stories[flagshipIndex];
      var rest = stories.filter(function (_, i) { return i !== flagshipIndex; }).slice(0, 4);

      rail.innerHTML =
        flagshipCard(flagship) +
        (rest.length ? '<div class="live-rail-secondary">' + rest.map(secondaryCard).join('') + '</div>' : '');
      section.hidden = false;

      // Reveal the header "Live" nav link and point hero CTAs at live coverage.
      document.querySelectorAll('[data-nav-live]').forEach(function (link) {
        link.hidden = false;
      });
      document.querySelectorAll('[data-live-cta]').forEach(function (link) {
        link.setAttribute('href', '#live-stories');
      });
    } catch (e) {
      // Discovery surface is non-critical: fail silently, section stays hidden.
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
