// Noteworthy News AI - shared page loader
// Drop-in: <script src="/src/widgets/noteworthy-chat-loader.js" defer></script>
// Lazily loads the chat widget after the page is idle, mounts it once, and
// wires any [data-open-chat] button to open the panel. Safe to include on any
// public page; it no-ops if the widget was already set up by inline code.
(function () {
  'use strict';

  if (window.__nnChatLoaderRan) return;
  window.__nnChatLoaderRan = true;

  var WIDGET_SRC = '/src/widgets/noteworthy-chat.js';
  var VOICE_SRC = '/src/widgets/voice-audio-engine.js';
  var booted = false;
  var mounted = false;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        if (existing.dataset.nnLoaded === 'true') { resolve(); return; }
        existing.addEventListener('load', resolve);
        existing.addEventListener('error', reject);
        // If it already finished loading before we attached, resolve shortly.
        setTimeout(resolve, 1500);
        return;
      }
      var s = document.createElement('script');
      s.src = src;
      s.defer = true;
      s.onload = function () { s.dataset.nnLoaded = 'true'; resolve(); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function mount() {
    if (mounted) return true;
    if (document.querySelector('noteworthy-chat-widget')) { mounted = true; return true; }
    if (!customElements.get('noteworthy-chat-widget')) return false;
    try {
      var el = document.createElement('noteworthy-chat-widget');
      el.setAttribute('data-endpoint', '/.netlify/functions/noteworthy-chat');
      el.setAttribute('data-open', 'false');
      el.setAttribute('data-brand-title', 'Noteworthy News AI');
      el.setAttribute('data-logo', '/IMG_5794.PNG');
      document.body.appendChild(el);
      mounted = true;
    } catch (err) {
      console.error('[NN Chat] mount error:', err);
    }
    return mounted;
  }

  function boot() {
    if (booted) return;
    booted = true;
    loadScript(VOICE_SRC)
      .catch(function () { /* voice engine is optional */ })
      .then(function () { return loadScript(WIDGET_SRC); })
      .then(function () {
        var tries = 0;
        (function tryMount() {
          if (!mount() && tries++ < 20) setTimeout(tryMount, 250);
        })();
      })
      .catch(function (err) {
        console.error('[NN Chat] failed to load widget:', err);
      });
  }

  // Load after the page settles so the widget never competes with content.
  if (document.readyState === 'complete') {
    setTimeout(boot, 800);
  } else {
    window.addEventListener('load', function () { setTimeout(boot, 800); });
  }

  // Any element with [data-open-chat] opens the chat panel.
  document.addEventListener('click', function (e) {
    var trigger = e.target && e.target.closest && e.target.closest('[data-open-chat]');
    if (!trigger) return;
    e.preventDefault();
    boot();
    var attempt = 0;
    (function tryOpen() {
      var widget = document.querySelector('noteworthy-chat-widget');
      var launcher = widget && widget.shadowRoot && widget.shadowRoot.querySelector('.launcher');
      if (launcher) {
        if (launcher.getAttribute('aria-expanded') !== 'true') launcher.click();
      } else if (attempt++ < 12) {
        setTimeout(tryOpen, 250);
      }
    })();
  });
})();
