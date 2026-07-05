/**
 * Noteworthy News V4 - Scroll Reveal
 *
 * IntersectionObserver utility. Elements with [data-reveal] start hidden
 * (see v4.css) and animate in when they enter the viewport.
 *
 * Variants:
 *   data-reveal            fade up
 *   data-reveal="left"     slide in from the left
 *   data-reveal="right"    slide in from the right
 *   data-reveal="rise"     rise with subtle depth (scale)
 *   data-reveal="phone"    phone stage: container glides, cards stack after
 *   data-reveal="stage"    container reveals, inner elements sequence via CSS
 *   data-reveal="stagger"  each direct child fades up in order
 *   data-reveal="steps"    children stagger and the container draws its line
 *
 * Respects prefers-reduced-motion by revealing everything immediately.
 */

const THRESHOLD = 0.15;
const ROOT_MARGIN = '0px 0px -60px 0px';
const STAGGER_DELAY = 90;

const CHILD_VARIANTS = new Set(['stagger', 'steps']);

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function revealChildren(el) {
  Array.from(el.children).forEach((child, i) => {
    child.style.transitionDelay = `${i * STAGGER_DELAY}ms`;
    child.classList.add('revealed');
  });
}

function onIntersect(entries, observer) {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const delay = el.dataset.revealDelay;

    if (CHILD_VARIANTS.has(el.dataset.reveal)) {
      revealChildren(el);
      el.classList.add('revealed');
    } else {
      if (delay) el.style.transitionDelay = delay;
      el.classList.add('revealed');
    }
    observer.unobserve(el);
  });
}

export function initScrollReveal() {
  const els = document.querySelectorAll('[data-reveal]');
  if (els.length === 0) return;

  if (prefersReducedMotion) {
    els.forEach(el => {
      el.classList.add('revealed');
      if (CHILD_VARIANTS.has(el.dataset.reveal)) {
        Array.from(el.children).forEach(child => child.classList.add('revealed'));
      }
    });
    return;
  }

  const observer = new IntersectionObserver(onIntersect, {
    threshold: THRESHOLD,
    rootMargin: ROOT_MARGIN,
  });

  els.forEach(el => observer.observe(el));
}
