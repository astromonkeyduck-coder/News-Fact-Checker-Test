/**
 * Noteworthy News — shared AdSense placement helper.
 *
 * One mount point per ad: <div class="nn-ad" data-nn-ad="in_article"></div>
 * The helper lazy-loads each unit as it nears the viewport, labels it,
 * and collapses it if Google returns no ad (so there are never empty boxes).
 *
 * To go live: paste the numeric slot ID for each placement into AD_SLOTS
 * below. Any placement left as "" stays hidden — nothing renders for it.
 */
(function () {
  'use strict';

  var AD_CLIENT = 'ca-pub-5427142458403577';

  // ─────────────────────────────────────────────────────────────
  //  SLOT IDS — the only thing you need to edit to go live.
  //  Create each unit in AdSense (Ads → By ad unit) and paste its
  //  numeric "data-ad-slot" value here. Leave "" to keep it dormant.
  // ─────────────────────────────────────────────────────────────
  var AD_SLOTS = {
    display: '1458252598',          // Display unit (responsive) — banners, top/bottom of lists
    display_sidebar: '7417197842',  // Display unit (responsive) — article sidebar (sticky)
    in_article: '3864965643',       // In-article unit (native) — inside long-form content
    multiplex: '1210840580',        // Multiplex unit ("Matched content") — recommendation grid
    in_feed: ''                     // In-feed unit (native) — between cards in a list/feed
  };

  // In-feed units ALSO need a layout key (from AdSense, alongside the slot ID).
  var AD_LAYOUT_KEYS = {
    in_feed: ''                     // paste the "data-ad-layout-key" value here
  };

  // How each placement type configures its <ins> element.
  var AD_TYPES = {
    display: function (ins) {
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
    },
    display_sidebar: function (ins) {
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
    },
    in_article: function (ins) {
      ins.setAttribute('data-ad-layout', 'in-article');
      ins.setAttribute('data-ad-format', 'fluid');
    },
    multiplex: function (ins) {
      ins.setAttribute('data-ad-format', 'autorelaxed');
    },
    in_feed: function (ins) {
      ins.setAttribute('data-ad-format', 'fluid');
      ins.setAttribute('data-ad-layout-key', AD_LAYOUT_KEYS.in_feed);
    }
  };

  function setState(wrap, state) {
    wrap.setAttribute('data-nn-ad-state', state);
  }

  function buildAd(wrap) {
    var type = wrap.getAttribute('data-nn-ad');
    var slot = AD_SLOTS[type];

    // No slot configured (or unknown type): keep it hidden, render nothing.
    if (!slot || !AD_TYPES[type]) {
      setState(wrap, 'disabled');
      return;
    }

    // In-feed units are useless without their layout key — stay dormant
    // until both are provided.
    if (type === 'in_feed' && !AD_LAYOUT_KEYS.in_feed) {
      setState(wrap, 'disabled');
      return;
    }

    // Don't initialize into a zero-width container (e.g. hidden sidebar on
    // mobile) — AdSense throws "No slot size for availableWidth=0".
    if (!wrap.offsetWidth) {
      setState(wrap, 'disabled');
      return;
    }

    var label = document.createElement('span');
    label.className = 'nn-ad__label';
    label.textContent = 'Advertisement';

    var ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.setAttribute('data-ad-client', AD_CLIENT);
    ins.setAttribute('data-ad-slot', slot);
    AD_TYPES[type](ins);

    wrap.appendChild(label);
    wrap.appendChild(ins);

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      if (window.console) console.warn('[ads] push failed (suppressed):', e && e.message);
    }

    watchFill(wrap, ins);
  }

  // Collapse the unit if Google reports it unfilled so we never show an empty
  // labeled box.
  function watchFill(wrap, ins) {
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      var status = ins.getAttribute('data-ad-status');
      if (status === 'filled' || ins.querySelector('iframe')) {
        setState(wrap, 'filled');
        clearInterval(timer);
      } else if (status === 'unfilled' || tries > 24) {
        setState(wrap, 'unfilled');
        clearInterval(timer);
      }
    }, 250);
  }

  function init() {
    var wraps = [].slice.call(document.querySelectorAll('[data-nn-ad]'));
    if (!wraps.length) return;

    if (!('IntersectionObserver' in window)) {
      wraps.forEach(buildAd);
      return;
    }

    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          obs.unobserve(entry.target);
          buildAd(entry.target);
        }
      });
    }, { rootMargin: '600px 0px' });

    wraps.forEach(function (w) { io.observe(w); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
