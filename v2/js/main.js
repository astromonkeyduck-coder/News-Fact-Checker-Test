/**
 * Noteworthy News V4 - Homepage Entry Point
 *
 * Orchestrates: nav, feed, auth, newsletter, scroll motion.
 * Loaded as type="module" - no globals polluted.
 */

import { initFeed } from './feed.js';
import { initAuth, login, signup, logout } from './auth.js';
import { initAmbientAudio } from './ambient-audio.js';
import { initScrollReveal } from './scroll-reveal.js';
import { initPhoneStage } from './phone-stage.js';
import { initStarfield, setStarfieldScroll } from './starfield.js';
import { UISounds } from './ui-sounds.js';

(function () {
  'use strict';

  const header = document.querySelector('.site-header');
  const navToggle = document.querySelector('.nav-toggle');
  const navMenu = document.querySelector('.nav-menu');
  const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Mobile nav toggle ────────────────────────────
  function closeNav() {
    if (!navMenu.classList.contains('open')) return;
    UISounds.tap();
    navMenu.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      UISounds.tap();
      const isOpen = navMenu.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    navMenu.addEventListener('click', (e) => {
      if (e.target === navMenu || e.target.closest('.nav-link, .btn')) {
        closeNav();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navMenu.classList.contains('open')) {
        closeNav();
        navToggle.focus();
      }
    });
  }

  // ── Scroll motion: header states + hero scroll progress ─
  // --hp (0..1 through the hero) no longer tracks the wheel directly. A rAF
  // loop eases it toward the live scroll position with a frame-rate
  // independent exponential, so the planet, veil, and parallax glide through
  // momentum scrolling instead of stepping with each wheel tick. --spin adds
  // a slow ambient rotation so the planet is never frozen while the hero is
  // on screen. Both feed compositor-only properties in v4.css.
  const heroEl = document.querySelector('.hero');
  const planetEl = document.querySelector('.hero-planet');
  let heroSpan = 1;
  let targetHp = 0;
  let currentHp = -1; // -1: snap to target on the first frame (no intro sweep)
  let targetMx = 0, targetMy = 0;
  let curMx = 0, curMy = 0;
  let spinDeg = 0;
  let motionRaf = 0;
  let lastT = 0;
  let heroOnScreen = true;

  function measureHero() {
    if (!heroEl) return;
    heroSpan = Math.max(heroEl.offsetHeight - window.innerHeight * 0.25, 320);
  }

  function motionFrame(t) {
    // Clamp dt so a background-tab pause cannot produce a jump cut.
    const dt = Math.min(Math.max((t - lastT) / 1000, 0), 0.05);
    lastT = t;

    // ~110ms time constant: fast enough to feel connected to the wheel,
    // slow enough to swallow discrete scroll steps.
    const k = 1 - Math.exp(-dt * 9);
    currentHp = currentHp < 0 ? targetHp : currentHp + (targetHp - currentHp) * k;
    if (Math.abs(targetHp - currentHp) < 0.0003) currentHp = targetHp;

    // Pointer depth eases through the same loop, so mouse drift and the
    // return-to-center on pointerleave glide instead of snapping.
    const kp = 1 - Math.exp(-dt * 6);
    curMx += (targetMx - curMx) * kp;
    curMy += (targetMy - curMy) * kp;
    if (Math.abs(targetMx - curMx) < 0.001) curMx = targetMx;
    if (Math.abs(targetMy - curMy) < 0.001) curMy = targetMy;

    // Ambient drift: 0.4deg/s, visible over seconds, never distracting.
    spinDeg = (spinDeg + dt * 0.4) % 360;

    heroEl.style.setProperty('--hp', currentHp.toFixed(4));
    heroEl.style.setProperty('--mx', curMx.toFixed(4));
    heroEl.style.setProperty('--my', curMy.toFixed(4));
    if (planetEl) planetEl.style.setProperty('--spin', spinDeg.toFixed(3) + 'deg');
    setStarfieldScroll(currentHp * heroSpan);

    if (heroOnScreen && !document.hidden) {
      motionRaf = requestAnimationFrame(motionFrame);
    } else {
      motionRaf = 0;
    }
  }

  function startMotion() {
    if (motionRaf || prefersReducedMotion || !heroEl) return;
    lastT = performance.now();
    motionRaf = requestAnimationFrame(motionFrame);
  }

  function onScroll() {
    const y = window.scrollY;
    if (header) {
      header.classList.toggle('scrolled', y > 8);
      header.classList.toggle('condensed', y > 140);
    }
    if (heroEl && !prefersReducedMotion) {
      targetHp = Math.min(Math.max(y / heroSpan, 0), 1);
      startMotion();
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', measureHero);

  if (heroEl && !prefersReducedMotion) {
    // Run the loop only while the planet can actually be seen.
    const heroWatcher = new IntersectionObserver((entries) => {
      heroOnScreen = entries[0].isIntersecting;
      if (heroOnScreen) {
        startMotion();
      } else if (currentHp !== targetHp) {
        // Offscreen: settle instantly, nobody is watching.
        currentHp = targetHp;
        heroEl.style.setProperty('--hp', currentHp.toFixed(4));
      }
    }, { rootMargin: '80px 0px 80px 0px' });
    heroWatcher.observe(heroEl);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) startMotion();
    });
  }

  measureHero();
  onScroll();
  startMotion();

  // ── Hero pointer depth: planet/nebula drift + story-card glare ──
  // Targets only; the eased values are written by motionFrame above.
  if (heroEl && !prefersReducedMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const heroCard = document.getElementById('hero-card');
    let pointerEvt = null;
    let pointerRaf = null;

    function onPointerFrame() {
      pointerRaf = null;
      if (!pointerEvt) return;
      const r = heroEl.getBoundingClientRect();
      targetMx = ((pointerEvt.clientX - r.left) / r.width - 0.5) * 2;
      targetMy = ((pointerEvt.clientY - r.top) / r.height - 0.5) * 2;
      startMotion();

      if (heroCard) {
        const cr = heroCard.getBoundingClientRect();
        if (cr.width > 0) {
          heroCard.style.setProperty('--cx', `${(((pointerEvt.clientX - cr.left) / cr.width) * 100).toFixed(1)}%`);
          heroCard.style.setProperty('--cy', `${(((pointerEvt.clientY - cr.top) / cr.height) * 100).toFixed(1)}%`);
        }
      }
    }

    heroEl.addEventListener('pointermove', (e) => {
      pointerEvt = e;
      if (!pointerRaf) pointerRaf = requestAnimationFrame(onPointerFrame);
    }, { passive: true });

    heroEl.addEventListener('pointerleave', () => {
      pointerEvt = null;
      targetMx = 0;
      targetMy = 0;
      startMotion();
    });
  }

  // ── Developing Now strip: arrows + empty state ───
  const strip = document.getElementById('dev-strip');
  const stripLive = document.getElementById('strip-live');
  const stripPosts = document.getElementById('strip-posts');
  const stripEmpty = document.getElementById('strip-empty');
  const arrows = document.querySelector('.dev-arrows');
  const prevBtn = document.getElementById('dev-prev');
  const nextBtn = document.getElementById('dev-next');

  function syncStrip() {
    if (!strip) return;
    const hasCards =
      (stripLive && stripLive.children.length > 0) ||
      (stripPosts && stripPosts.children.length > 0);
    if (stripEmpty) stripEmpty.hidden = hasCards;
    if (arrows) arrows.hidden = !hasCards || strip.scrollWidth <= strip.clientWidth + 8;
  }

  document.addEventListener('nn:strip-updated', syncStrip);
  window.addEventListener('resize', syncStrip);
  // Feeds can fail silently; make sure the empty state eventually shows.
  setTimeout(syncStrip, 4000);

  function scrollStrip(dir) {
    if (!strip) return;
    strip.scrollBy({ left: dir * Math.max(strip.clientWidth * 0.7, 280), behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }

  if (prevBtn) prevBtn.addEventListener('click', () => { UISounds.tap(); scrollStrip(-1); });
  if (nextBtn) nextBtn.addEventListener('click', () => { UISounds.tap(); scrollStrip(1); });

  // ── Newsletter signup ────────────────────────────
  const nlForm = document.querySelector('.newsletter-form');
  if (nlForm) {
    nlForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = nlForm.querySelector('.newsletter-input');
      const btn = nlForm.querySelector('button[type="submit"]');
      const hint = document.querySelector('.newsletter-hint');
      const email = input?.value?.trim();
      if (!email) return;

      btn.disabled = true;
      btn.textContent = 'Subscribing\u2026';

      try {
        const res = await fetch('/.netlify/functions/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (data.success) {
          input.value = '';
          if (hint) {
            hint.textContent = data.message || 'Subscribed! Check your inbox.';
            hint.classList.remove('is-error');
            hint.classList.add('is-success');
          }
          UISounds.success();
        } else {
          if (hint) {
            hint.textContent = data.message || 'Something went wrong. Please try again.';
            hint.classList.remove('is-success');
            hint.classList.add('is-error');
          }
          UISounds.error();
        }
      } catch {
        if (hint) {
          hint.textContent = 'Network error. Please try again.';
          hint.classList.remove('is-success');
          hint.classList.add('is-error');
        }
        UISounds.error();
      } finally {
        btn.disabled = false;
        btn.textContent = 'Get the brief';
      }
    });
  }

  // ── Active nav section tracking ──────────────────
  if (navLinks.length > 0) {
    const sections = Array.from(navLinks)
      .map(link => document.querySelector(link.getAttribute('href')))
      .filter(Boolean);

    if (sections.length > 0) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const id = entry.target.id;
              navLinks.forEach(link => {
                link.classList.toggle(
                  'active',
                  link.getAttribute('href') === `#${id}`
                );
              });
            }
          });
        },
        { rootMargin: '-20% 0px -60% 0px' }
      );

      sections.forEach(section => observer.observe(section));
    }
  }

  // ── Auth UI wiring ───────────────────────────────
  const authOutEl = document.getElementById('nav-auth-out');
  const authInEl = document.getElementById('nav-auth-in');
  const userNameEl = document.getElementById('nav-user-name');
  const signinBtn = document.getElementById('signinBtn');
  const signupBtn = document.getElementById('signupBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  function onAuthChange(user) {
    if (user) {
      const name = user.name || user.nickname || user.email?.split('@')[0] || 'User';
      if (authOutEl) authOutEl.hidden = true;
      if (authInEl) authInEl.hidden = false;
      if (userNameEl) userNameEl.textContent = name;

      // Auto-fill newsletter email if logged in
      const nlInput = document.getElementById('newsletter-email');
      if (nlInput && user.email && !nlInput.value) {
        nlInput.value = user.email;
      }
    } else {
      if (authOutEl) authOutEl.hidden = false;
      if (authInEl) authInEl.hidden = true;
      if (userNameEl) userNameEl.textContent = '';
    }
  }

  if (signinBtn) signinBtn.addEventListener('click', () => { UISounds.tap(); login(); });
  if (signupBtn) signupBtn.addEventListener('click', () => { UISounds.tap(); signup(); });
  if (logoutBtn) logoutBtn.addEventListener('click', () => { UISounds.tap(); logout(); });

  // ── Service worker registration ──────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('[SW] Registered:', reg.scope))
        .catch(err => console.warn('[SW] Registration failed:', err));
    });
  }

  // ── Live timestamp in hero ──────────────────────
  const heroTime = document.getElementById('hero-time');
  if (heroTime) {
    const tick = () => {
      const now = new Date();
      heroTime.textContent = now.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short'
      });
    };
    tick();
    setInterval(tick, 30000);
  }

  // ── Scroll-to-top button ───────────────────────────
  const scrollTopBtn = document.getElementById('scrollTopBtn');
  if (scrollTopBtn) {
    scrollTopBtn.hidden = false;
    const heroSection = document.querySelector('.hero');
    const updateScrollTop = () => {
      const pastHero = heroSection
        ? window.scrollY > heroSection.offsetHeight
        : window.scrollY > 400;
      scrollTopBtn.classList.toggle('visible', pastHero);
    };
    window.addEventListener('scroll', updateScrollTop, { passive: true });
    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ── Mobile nav: swipe-right to close ──────────────
  if (navMenu && navToggle) {
    let touchStartX = 0;
    navMenu.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    navMenu.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (dx > 60 && navMenu.classList.contains('open')) {
        closeNav();
      }
    }, { passive: true });
  }

  // ── Initialize modules ─────────────────────────────
  initFeed();
  initAuth(onAuthChange);
  initAmbientAudio();
  initScrollReveal();
  initStarfield();
  initPhoneStage();

})();
