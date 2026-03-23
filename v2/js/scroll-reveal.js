/**
 * Noteworthy News V2 — Scroll Reveal
 *
 * Lightweight IntersectionObserver utility. Elements with [data-reveal]
 * start hidden and animate in when they enter the viewport.
 * Respects prefers-reduced-motion by applying .revealed immediately.
 */

const THRESHOLD = 0.15;
const ROOT_MARGIN = '0px 0px -60px 0px';

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function onIntersect(entries, observer) {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const delay = el.dataset.revealDelay;
    if (delay) {
      el.style.transitionDelay = delay;
    }
    el.classList.add('revealed');
    observer.unobserve(el);
  });
}

export function initScrollReveal() {
  const els = document.querySelectorAll('[data-reveal]');
  if (els.length === 0) return;

  if (prefersReducedMotion) {
    els.forEach(el => el.classList.add('revealed'));
    return;
  }

  const observer = new IntersectionObserver(onIntersect, {
    threshold: THRESHOLD,
    rootMargin: ROOT_MARGIN,
  });

  els.forEach(el => observer.observe(el));
}
