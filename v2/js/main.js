/**
 * Noteworthy News V2 — Homepage Entry Point
 *
 * Orchestrates: nav, feed, auth, newsletter, scroll behavior.
 * Loaded as type="module" — no globals polluted.
 */

import { initFeed } from './feed.js';
import { initAuth, login, signup, logout } from './auth.js';

(function () {
  'use strict';

  const header = document.querySelector('.site-header');
  const navToggle = document.querySelector('.nav-toggle');
  const navMenu = document.querySelector('.nav-menu');
  const navLinks = document.querySelectorAll('.nav-link[href^="#"]');

  // ── Mobile nav toggle ────────────────────────────
  function closeNav() {
    navMenu.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
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

  // ── Scroll-aware header shadow ───────────────────
  if (header) {
    const onScroll = () => {
      header.classList.toggle('scrolled', window.scrollY > 10);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

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
        } else {
          if (hint) {
            hint.textContent = data.message || 'Something went wrong. Please try again.';
            hint.classList.remove('is-success');
            hint.classList.add('is-error');
          }
        }
      } catch {
        if (hint) {
          hint.textContent = 'Network error. Please try again.';
          hint.classList.remove('is-success');
          hint.classList.add('is-error');
        }
      } finally {
        btn.disabled = false;
        btn.textContent = 'Subscribe';
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

  if (signinBtn) signinBtn.addEventListener('click', () => login());
  if (signupBtn) signupBtn.addEventListener('click', () => signup());
  if (logoutBtn) logoutBtn.addEventListener('click', () => logout());

  // ── Service worker registration ──────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('[SW] Registered:', reg.scope))
        .catch(err => console.warn('[SW] Registration failed:', err));
    });
  }

  // ── Initialize feed and auth ─────────────────────
  initFeed();
  initAuth(onAuthChange);

})();
