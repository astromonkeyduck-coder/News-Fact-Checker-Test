/**
 * Article V4 page behaviors
 *
 * Reading progress, image lightbox, share (native sheet with menu fallback),
 * copy link, text size persistence, reveal-on-scroll, hero parallax, and
 * TOC scroll-spy. Exposes the same globals article-loader.js already calls:
 * window.updateShareMenu, window.reinitArticlePageControls,
 * window.initArticleTocScrollSpy, plus window.nnBindReveals for re-renders.
 */
(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Reading progress ─────────────────────────── */

  function updateReadingProgress() {
    var article = document.querySelector('.article-main');
    var bar = document.getElementById('reading-progress-bar');
    var wrap = document.getElementById('reading-progress');
    if (!article || !bar || !wrap) return;

    var rect = article.getBoundingClientRect();
    var top = rect.top + window.scrollY;
    var height = rect.height;
    var winH = window.innerHeight;
    var scrollTop = window.scrollY;

    var progress = 0;
    var total = height - winH;
    if (total <= 0) {
      progress = scrollTop > top ? 100 : 0;
    } else {
      progress = Math.min(100, Math.max(0, ((scrollTop - top) / total) * 100));
    }

    bar.style.width = progress + '%';
    wrap.setAttribute('aria-valuenow', String(Math.round(progress)));
  }

  var progressTick = false;
  function onProgressScroll() {
    if (progressTick) return;
    progressTick = true;
    requestAnimationFrame(function () {
      progressTick = false;
      updateReadingProgress();
    });
  }

  /* ── Lightbox ─────────────────────────────────── */

  var lastLightboxTrigger = null;

  function openLightbox(src, alt, caption) {
    var lightbox = document.getElementById('image-lightbox');
    var img = document.getElementById('lightbox-image');
    var cap = document.getElementById('lightbox-caption');
    if (!lightbox || !img) return;
    img.src = src;
    img.alt = alt || 'Story image';
    if (cap) {
      cap.textContent = caption || '';
      cap.hidden = !caption;
    }
    lightbox.classList.add('active');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    var close = document.getElementById('lightbox-close');
    if (close) close.focus();
  }

  function closeLightbox() {
    var lightbox = document.getElementById('image-lightbox');
    if (!lightbox) return;
    lightbox.classList.remove('active');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastLightboxTrigger && lastLightboxTrigger.focus) {
      try { lastLightboxTrigger.focus(); } catch (e) { /* ignore */ }
    }
    lastLightboxTrigger = null;
  }

  function initLightbox() {
    var lightbox = document.getElementById('image-lightbox');
    if (!lightbox) return;

    // Delegated: works for media injected by the loader, galleries included.
    document.addEventListener('click', function (e) {
      var img = e.target.closest('.article-main .pm-media img, .article-body img');
      if (!img) return;
      if (img.closest('a')) return;
      lastLightboxTrigger = img;
      var figure = img.closest('figure');
      var capEl = figure ? figure.querySelector('.pm-caption') : null;
      openLightbox(img.currentSrc || img.src, img.alt, capEl ? capEl.textContent : '');
    });

    // Make loader-injected images announce their zoom affordance.
    var zoomHintObserver = new MutationObserver(function () {
      document.querySelectorAll('.article-main .pm-media img:not([data-zoomable])').forEach(function (img) {
        img.dataset.zoomable = 'true';
        img.style.cursor = 'zoom-in';
      });
    });
    var main = document.querySelector('.article-main');
    if (main) zoomHintObserver.observe(main, { childList: true, subtree: true });

    var close = document.getElementById('lightbox-close');
    if (close) close.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lightbox.classList.contains('active')) closeLightbox();
    });
  }

  /* ── Share ────────────────────────────────────── */

  var shareState = { text: document.title, url: location.href };

  window.updateShareMenu = function (shareText, shareUrl) {
    shareState.text = shareText || document.title;
    shareState.url = shareUrl || location.href;

    var links = {
      twitter: 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareState.text) + '&url=' + encodeURIComponent(shareState.url),
      facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(shareState.url),
      linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(shareState.url),
      reddit: 'https://reddit.com/submit?url=' + encodeURIComponent(shareState.url) + '&title=' + encodeURIComponent(shareState.text),
      email: 'mailto:?subject=' + encodeURIComponent(shareState.text) + '&body=' + encodeURIComponent(shareState.text + '\n\n' + shareState.url)
    };
    Object.keys(links).forEach(function (platform) {
      var link = document.getElementById('share-' + platform);
      if (!link) return;
      link.href = links[platform];
      if (platform !== 'email') {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
    });
  };

  function toggleShareMenu(open) {
    var menu = document.getElementById('share-menu');
    var btn = document.getElementById('share-menu-btn');
    if (!menu || !btn) return;
    var willOpen = typeof open === 'boolean' ? open : !menu.classList.contains('open');
    menu.classList.toggle('open', willOpen);
    menu.setAttribute('aria-hidden', willOpen ? 'false' : 'true');
    btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  }

  function bindShare() {
    var btn = document.getElementById('share-menu-btn');
    if (!btn || btn.dataset.nnBound === '1') return;
    btn.dataset.nnBound = '1';

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      // Prefer the native share sheet where it exists (mobile).
      if (navigator.share) {
        navigator.share({ title: shareState.text, text: shareState.text, url: shareState.url })
          .catch(function () { /* user cancelled */ });
        return;
      }
      toggleShareMenu();
    });

    document.addEventListener('click', function (e) {
      var menu = document.getElementById('share-menu');
      if (!menu || !menu.classList.contains('open')) return;
      if (e.target.closest('.share-option')) return;
      if (!menu.contains(e.target) && e.target !== btn) toggleShareMenu(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') toggleShareMenu(false);
    });
  }

  /* ── Copy link ────────────────────────────────── */

  function bindCopyLink() {
    var copyBtn = document.getElementById('copy-link-btn');
    if (!copyBtn || copyBtn.dataset.nnBound === '1') return;
    copyBtn.dataset.nnBound = '1';
    copyBtn.addEventListener('click', function () {
      var url = shareState.url || window.location.href;
      navigator.clipboard.writeText(url).then(
        function () {
          var label = copyBtn.querySelector('span');
          if (!label) return;
          var original = label.textContent;
          label.textContent = 'Copied';
          copyBtn.classList.add('utility-btn--primary');
          setTimeout(function () {
            label.textContent = original;
            copyBtn.classList.remove('utility-btn--primary');
          }, 1800);
        },
        function () {
          window.prompt('Copy this link:', url);
        }
      );
    });
  }

  /* ── Text size ────────────────────────────────── */

  var SIZES = ['text-small', '', 'text-large', 'text-xlarge'];

  function applyTextSize(index) {
    var body = document.querySelector('.article-body');
    if (!body) return;
    SIZES.forEach(function (cls) { if (cls) body.classList.remove(cls); });
    if (SIZES[index]) body.classList.add(SIZES[index]);
  }

  function bindTextSize() {
    var dec = document.getElementById('text-size-decrease');
    var inc = document.getElementById('text-size-increase');
    if ((!dec && !inc)) return;

    var current = parseInt(localStorage.getItem('article-text-size') || '1', 10);
    if (isNaN(current) || current < 0 || current >= SIZES.length) current = 1;
    applyTextSize(current);

    function step(delta) {
      current = Math.max(0, Math.min(SIZES.length - 1, current + delta));
      localStorage.setItem('article-text-size', String(current));
      applyTextSize(current);
    }

    if (dec && dec.dataset.nnBound !== '1') {
      dec.dataset.nnBound = '1';
      dec.addEventListener('click', function () { step(-1); });
    }
    if (inc && inc.dataset.nnBound !== '1') {
      inc.dataset.nnBound = '1';
      inc.addEventListener('click', function () { step(1); });
    }
  }

  /* ── Reveal on scroll ─────────────────────────── */

  var revealObserver = null;

  function getRevealObserver() {
    if (revealObserver) return revealObserver;
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    return revealObserver;
  }

  window.nnBindReveals = function (root) {
    var scope = root || document;
    var items = scope.querySelectorAll('.reveal-item:not(.in-view)');
    if (reducedMotion || typeof IntersectionObserver === 'undefined') {
      items.forEach(function (el) { el.classList.add('in-view'); });
      return;
    }
    items.forEach(function (el, i) {
      // Anything already in the viewport shows instantly with a small stagger.
      el.style.setProperty('--ri', String(Math.min(i, 6)));
      getRevealObserver().observe(el);
    });
    // Safety net: content must never stay hidden if observer callbacks are
    // delayed (background tabs, throttled webviews, odd embedders).
    setTimeout(function () {
      items.forEach(function (el) { el.classList.add('in-view'); });
    }, 2500);
  };

  /* ── Hero parallax (single hero figure only) ──── */

  var parallaxImg = null;
  var parallaxTick = false;

  function findParallaxTarget() {
    parallaxImg = document.querySelector('.article-main .pm-figure.article-hero .pm-media img');
  }

  function onParallaxScroll() {
    if (!parallaxImg || reducedMotion) return;
    if (parallaxTick) return;
    parallaxTick = true;
    requestAnimationFrame(function () {
      parallaxTick = false;
      if (!parallaxImg || !parallaxImg.isConnected) return;
      var rect = parallaxImg.getBoundingClientRect();
      var vh = window.innerHeight;
      if (rect.bottom < 0 || rect.top > vh) return;
      var center = rect.top + rect.height / 2 - vh / 2;
      var shift = Math.max(-18, Math.min(18, center * -0.05));
      parallaxImg.style.transform = 'scale(1.07) translateY(' + shift.toFixed(1) + 'px)';
    });
  }

  /* ── TOC scroll-spy ───────────────────────────── */

  function initTocScrollSpy() {
    var tocNav = document.getElementById('article-toc');
    var articleBody = document.querySelector('.article-body');
    if (!tocNav || !articleBody) return;

    var links = tocNav.querySelectorAll('.article-toc__item[href^="#"]');
    if (links.length === 0) return;

    var ticking = false;
    function updateActive() {
      var viewportMid = window.scrollY + window.innerHeight * 0.35;
      var currentId = null;
      var headings = articleBody.querySelectorAll('h2[id], h3[id]');
      for (var i = headings.length - 1; i >= 0; i--) {
        var h = headings[i];
        var top = h.getBoundingClientRect().top + window.scrollY;
        if (top <= viewportMid) {
          currentId = h.id;
          break;
        }
      }
      links.forEach(function (a) {
        var id = (a.getAttribute('href') || '').replace(/^#/, '');
        a.classList.toggle('is-active', id === currentId);
      });
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(updateActive);
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    updateActive();
  }

  window.initArticleTocScrollSpy = initTocScrollSpy;

  /* ── Rebind hook for the loader ───────────────── */

  window.reinitArticlePageControls = function () {
    bindCopyLink();
    bindShare();
    bindTextSize();
    findParallaxTarget();
    window.nnBindReveals(document);
    updateReadingProgress();
  };

  /* ── Boot ─────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', function () {
    initLightbox();
    bindCopyLink();
    bindShare();
    bindTextSize();
    window.nnBindReveals(document);

    // Fallback share URL before the loader supplies real data.
    var articleId = new URLSearchParams(window.location.search).get('id');
    if (articleId) {
      var articleUrl = window.location.origin + '/article.html?id=' + encodeURIComponent(articleId);
      window.updateShareMenu('Noteworthy News', articleUrl);
    }

    window.addEventListener('scroll', function () {
      onProgressScroll();
      onParallaxScroll();
    }, { passive: true });
    window.addEventListener('resize', onProgressScroll);
    updateReadingProgress();

    // Header scroll shadow.
    var topbar = document.getElementById('nn-topbar');
    if (topbar) {
      window.addEventListener('scroll', function () {
        topbar.classList.toggle('scrolled', window.scrollY > 8);
      }, { passive: true });
    }
  });
})();
