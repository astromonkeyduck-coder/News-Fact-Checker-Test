/**
 * Noteworthy News V4 - Hero starfield
 *
 * One canvas, painted with three depth layers of stars that parallax
 * against scroll, twinkle gently, and, once in a while, let a meteor
 * cross the top of the frame. Everything is cheap 2D canvas work:
 * a few hundred arc() calls per frame, DPR-aware, paused while the
 * hero is offscreen or the tab is hidden.
 *
 * prefers-reduced-motion: stars render once, statically. No loop.
 */

const STAR_DENSITY = 1 / 9000;   // stars per px^2 of hero area
const LAYERS = [
  { depth: 0.12, sizeMin: 0.4, sizeMax: 0.9, alpha: 0.5 },  // far
  { depth: 0.28, sizeMin: 0.6, sizeMax: 1.3, alpha: 0.7 },  // mid
  { depth: 0.5,  sizeMin: 0.9, sizeMax: 1.7, alpha: 0.9 },  // near
];
const BRIGHT_EVERY = 26;          // every Nth star gets a glow cross
const METEOR_MIN_GAP = 9000;      // ms between meteors (min)
const METEOR_MAX_GAP = 22000;     // ms between meteors (max)
const METEOR_LIFE = 900;          // ms

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Eased scroll position, fed by main.js's motion loop so star parallax
// glides in sync with the planet instead of stepping with raw scrollY.
let easedScroll = null;

export function setStarfieldScroll(y) {
  easedScroll = y;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

export function initStarfield() {
  const canvas = document.querySelector('.hero-starfield');
  const hero = document.querySelector('.hero');
  if (!canvas || !hero || !canvas.getContext) return;

  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;
  let dpr = 1;
  let stars = [];
  let running = false;
  let rafId = null;
  let heroVisible = true;
  let meteor = null;
  let nextMeteorAt = performance.now() + rand(METEOR_MIN_GAP, METEOR_MAX_GAP);

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = hero.clientWidth;
    H = hero.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.min(Math.round(W * H * STAR_DENSITY), 320);
    stars = [];
    for (let i = 0; i < count; i++) {
      const layer = LAYERS[i % LAYERS.length];
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: rand(layer.sizeMin, layer.sizeMax),
        depth: layer.depth,
        base: layer.alpha * rand(0.55, 1),
        phase: Math.random() * Math.PI * 2,
        speed: rand(0.4, 1.4),
        bright: i % BRIGHT_EVERY === 0,
      });
    }
  }

  function spawnMeteor(now) {
    const fromLeft = Math.random() > 0.5;
    meteor = {
      born: now,
      x0: fromLeft ? rand(-0.1, 0.25) * W : rand(0.75, 1.1) * W,
      y0: rand(0.04, 0.3) * H,
      dx: (fromLeft ? 1 : -1) * rand(320, 520),
      dy: rand(60, 140),
    };
    nextMeteorAt = now + rand(METEOR_MIN_GAP, METEOR_MAX_GAP);
  }

  function paint(now, scrollY) {
    ctx.clearRect(0, 0, W, H);

    for (const s of stars) {
      // Parallax: deeper layers drift less than the page
      let y = s.y - scrollY * s.depth;
      y = ((y % H) + H) % H;

      const tw = prefersReducedMotion
        ? 0
        : Math.sin(now / 1000 * s.speed + s.phase) * 0.28;
      const a = Math.max(0.05, Math.min(1, s.base + tw));

      ctx.globalAlpha = a;
      ctx.fillStyle = s.bright ? '#DCE9FF' : '#C6D4EA';
      ctx.beginPath();
      ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
      ctx.fill();

      if (s.bright) {
        ctx.globalAlpha = a * 0.35;
        ctx.fillRect(s.x - s.r * 4, y - 0.4, s.r * 8, 0.8);
        ctx.fillRect(s.x - 0.4, y - s.r * 4, 0.8, s.r * 8);
      }
    }

    // Meteor: a short, quiet streak
    if (!prefersReducedMotion) {
      if (!meteor && now >= nextMeteorAt && scrollY < H * 0.6) spawnMeteor(now);
      if (meteor) {
        const t = (now - meteor.born) / METEOR_LIFE;
        if (t >= 1) {
          meteor = null;
        } else {
          const x = meteor.x0 + meteor.dx * t;
          const y = meteor.y0 + meteor.dy * t;
          const fade = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
          const grad = ctx.createLinearGradient(
            x, y, x - meteor.dx * 0.16, y - meteor.dy * 0.16
          );
          grad.addColorStop(0, `rgba(214, 230, 255, ${0.85 * fade})`);
          grad.addColorStop(1, 'rgba(214, 230, 255, 0)');
          ctx.globalAlpha = 1;
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - meteor.dx * 0.16, y - meteor.dy * 0.16);
          ctx.stroke();
        }
      }
    }

    ctx.globalAlpha = 1;
  }

  function frame(now) {
    rafId = null;
    if (!running) return;
    paint(now, easedScroll ?? window.scrollY);
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running || prefersReducedMotion) return;
    running = true;
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  build();

  if (prefersReducedMotion) {
    // One static pass: depth and stillness, no animation loop.
    paint(performance.now(), 0);
  } else {
    const io = new IntersectionObserver((entries) => {
      heroVisible = entries[0]?.isIntersecting ?? true;
      if (heroVisible && !document.hidden) start();
      else stop();
    }, { threshold: 0 });
    io.observe(hero);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else if (heroVisible) start();
    });

    start();
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      build();
      if (prefersReducedMotion) paint(performance.now(), 0);
    }, 160);
  });
}
