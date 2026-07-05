/**
 * Noteworthy News V4 - Shared behavior for static pages
 * (resources, company, legal). Header state, mobile nav,
 * scroll-to-top, and TOC scrollspy. No dependencies.
 */
(function () {
  'use strict';

  var header = document.querySelector('.site-header');
  var navToggle = document.querySelector('.nav-toggle');
  var navMenu = document.getElementById('nav-menu');
  var scrollBtn = document.getElementById('scrollTopBtn');

  /* ── Mobile nav ─────────────────────────────────── */
  function closeNav() {
    if (!navMenu || !navMenu.classList.contains('open')) return;
    navMenu.classList.remove('open');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', function () {
      var isOpen = navMenu.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    navMenu.addEventListener('click', function (e) {
      if (e.target === navMenu || e.target.closest('.nav-link, .btn')) closeNav();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navMenu.classList.contains('open')) {
        closeNav();
        navToggle.focus();
      }
    });
  }

  /* ── TOC scrollspy setup ────────────────────────── */
  var tocLinks = Array.prototype.slice.call(
    document.querySelectorAll('.pg-toc a[href^="#"]')
  );
  var tocSections = [];
  var linkById = {};

  tocLinks.forEach(function (link) {
    var id = link.getAttribute('href').slice(1);
    var section = document.getElementById(id);
    if (section) {
      linkById[id] = link;
      tocSections.push(section);
    }
  });

  var activeId = null;
  function setActive(id) {
    if (id === activeId) return;
    activeId = id;
    tocLinks.forEach(function (link) {
      link.classList.toggle('active', link === linkById[id]);
    });
  }

  /* ── Scroll frame: header, scroll-top, scrollspy ── */
  var ticking = false;

  function onScrollFrame() {
    ticking = false;
    var y = window.scrollY;

    if (header) {
      header.classList.toggle('scrolled', y > 8);
      header.classList.toggle('condensed', y > 140);
    }

    if (scrollBtn) {
      var show = y > 600;
      if (show && scrollBtn.hidden) scrollBtn.hidden = false;
      scrollBtn.classList.toggle('visible', show);
    }

    if (tocSections.length) {
      var probe = y + window.innerHeight * 0.28;
      var current = tocSections[0].id;
      for (var i = 0; i < tocSections.length; i++) {
        if (tocSections[i].offsetTop <= probe) current = tocSections[i].id;
      }
      // Bottom of page: force last section active.
      if (window.innerHeight + y >= document.documentElement.scrollHeight - 4) {
        current = tocSections[tocSections.length - 1].id;
      }
      setActive(current);
    }
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScrollFrame);
    }
  }, { passive: true });
  window.addEventListener('resize', onScrollFrame);
  onScrollFrame();

  if (scrollBtn) {
    scrollBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
})();
