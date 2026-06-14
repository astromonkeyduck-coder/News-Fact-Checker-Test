/**
 * Live Stories Rail — homepage discovery surface
 *
 * Loads active live stories from /.netlify/functions/live-stories and renders a
 * horizontal rail of cards that link into /story/<slug>. The section stays
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

  function card(story) {
    var status = story.status || 'developing';
    var label = STATUS_LABELS[status] || 'Update';
    var followers = story.follower_count || 0;
    return (
      '<a class="live-rail-card" href="/story/' + esc(story.slug) + '" data-status="' + esc(status) + '">' +
        '<div class="live-rail-card-top">' +
          '<span class="live-rail-status" data-status="' + esc(status) + '"><span class="dot"></span>' + esc(label) + '</span>' +
          (followers ? '<span class="live-rail-follows">' + esc(followers) + ' following</span>' : '') +
        '</div>' +
        '<h3 class="live-rail-card-title">' + esc(story.title) + '</h3>' +
        (story.summary ? '<p class="live-rail-card-summary">' + esc(story.summary) + '</p>' : '') +
        '<span class="live-rail-cta">Follow live \u2192</span>' +
      '</a>'
    );
  }

  async function load() {
    try {
      var res = await fetch(fnBase() + '/live-stories?limit=12');
      if (!res.ok) return;
      var data = await res.json();
      var stories = (data && data.stories) || [];
      if (!stories.length) return; // leave section hidden

      rail.innerHTML = stories.map(card).join('');
      section.hidden = false;
    } catch (e) {
      // Discovery surface is non-critical — fail silently.
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
