/**
 * Noteworthy News V4 - Hero astronaut rig
 *
 * One rAF loop drives a coordinated scene: the astronaut's outer rig
 * (position, roll, scale), a tensioned tether pinned to the pack, and the
 * story card's coupled sway. Scroll progress (--hp) and pointer parallax
 * (--mx/--my, set by main.js) fold into the same pose so the planet,
 * figure, cord, and card read as one system.
 */

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const BASE_ROLL = -6;
/* Top of the PLSS where the safety line clips in (figure space 0-1). */
const PACK = { x: 0.395, y: 0.205 };
/* Cord runs up-right toward the off-screen ship attachment. */
const PACK_DIR = { x: 0.42, y: -0.91 };
const HAND = { x: 0.93, y: 0.42 };
const SHADOW = { x: 0.58, y: 0.78 };

export function initHeroAstro() {
  const hero = document.querySelector('.hero');
  const body = document.getElementById('astro-body');
  const svg = document.getElementById('astro-tether');
  const svgFront = document.getElementById('astro-tether-front');
  const tetherBody = document.getElementById('tether-body');
  const tetherUnder = document.getElementById('tether-under');
  const tetherShine = document.getElementById('tether-shine');
  const hook = document.getElementById('tether-hook');
  const card = document.getElementById('hero-card');
  if (!hero || !body || !svg || !tetherBody) return;

  let W = 0;
  let H = 0;
  let baseX = 0;
  let baseY = 0;
  let figW = 0;
  let figH = 0;
  let cardBaseX = 0;
  let cardBaseY = 0;
  let cardW = 600;
  let cardH = 400;
  let handOn = 0;
  let castOn = 0;
  let castEl = null;

  let running = false;
  let rafId = null;
  let visible = true;
  let ropeX = 0;
  let ropeY = 0;
  let swayX = 0;
  let swayY = 0;
  let impulseAt = 0;
  let impulse = null;

  function measure() {
    W = hero.clientWidth;
    H = hero.clientHeight;
    const viewBox = `0 0 ${W} ${H}`;
    svg.setAttribute('viewBox', viewBox);
    if (svgFront) svgFront.setAttribute('viewBox', viewBox);
    baseX = body.offsetLeft;
    baseY = body.offsetTop;
    figW = body.offsetWidth;
    figH = body.offsetHeight;
    if (card) {
      const grid = card.offsetParent;
      cardBaseX = card.offsetLeft + (grid ? grid.offsetLeft : 0);
      cardBaseY = card.offsetTop + (grid ? grid.offsetTop : 0);
      cardW = card.offsetWidth || 600;
      cardH = card.offsetHeight || 400;
      if (!castEl) {
        castEl = document.createElement('div');
        castEl.className = 'hero-astro-cast';
        castEl.setAttribute('aria-hidden', 'true');
        card.appendChild(castEl);
      }
    }
  }

  function readVar(el, name) {
    const v = parseFloat(el.style.getPropertyValue(name));
    return Number.isFinite(v) ? v : 0;
  }

  function figPoint(fx, fy, x, y, rollRad) {
    const cx = figW / 2;
    const cy = figH / 2;
    const lx = figW * fx - cx;
    const ly = figH * fy - cy;
    const cos = Math.cos(rollRad);
    const sin = Math.sin(rollRad);
    return {
      x: baseX + cx + x + lx * cos - ly * sin,
      y: baseY + cy + y + lx * sin + ly * cos,
    };
  }

  function packDir(rollRad) {
    const cos = Math.cos(rollRad);
    const sin = Math.sin(rollRad);
    return {
      x: cos * PACK_DIR.x - sin * PACK_DIR.y,
      y: sin * PACK_DIR.x + cos * PACK_DIR.y,
    };
  }

  /**
   * EVA umbilical: a tapered ribbon polygon, thick where it leaves the pack
   * and thinning with a soft fade as it recedes to the ship off-screen.
   * The variable width plus the fade gradient is what sells the perspective;
   * uniform-stroke lines always read as flat decoration.
   */
  const SEGS = 26;
  function drawTether(anchor, dir, t, hp) {
    const shipX = W + 70;
    const shipY = H * (0.015 - hp * 0.03);
    const wob = prefersReducedMotion ? 0 : Math.sin(t * 0.33 + 1.2) * 4;

    // Centerline: leaves the pack along the ring normal, sags, then rises
    // toward the ship anchor point.
    const c1 = { x: anchor.x + dir.x * 62, y: anchor.y + dir.y * 62 };
    const c2 = {
      x: anchor.x + 180 + ropeX * 0.35,
      y: anchor.y - 72 + ropeY * 0.45 + wob,
    };

    const pts = [];
    for (let i = 0; i <= SEGS; i++) {
      const u = i / SEGS;
      const m = 1 - u;
      pts.push({
        u,
        x: m * m * m * anchor.x + 3 * m * m * u * c1.x + 3 * m * u * u * c2.x + u * u * u * shipX,
        y: m * m * m * anchor.y + 3 * m * m * u * c1.y + 3 * m * u * u * c2.y + u * u * u * shipY,
      });
    }

    // Ribbon edges: half-width eases from 5.5px at the pack to 1.2px far out
    const top = [];
    const bot = [];
    for (let i = 0; i <= SEGS; i++) {
      const p = pts[i];
      const q = pts[Math.min(i + 1, SEGS)];
      const r = pts[Math.max(i - 1, 0)];
      let tx = q.x - r.x;
      let ty = q.y - r.y;
      const len = Math.hypot(tx, ty) || 1;
      tx /= len;
      ty /= len;
      const halfW = 5.5 * (1 - p.u) * (1 - p.u) + 1.2;
      top.push({ x: p.x - ty * halfW, y: p.y + tx * halfW });
      bot.push({ x: p.x + ty * halfW, y: p.y - tx * halfW });
    }

    let d = `M ${top[0].x.toFixed(1)} ${top[0].y.toFixed(1)}`;
    for (let i = 1; i <= SEGS; i++) d += ` L ${top[i].x.toFixed(1)} ${top[i].y.toFixed(1)}`;
    for (let i = SEGS; i >= 0; i--) d += ` L ${bot[i].x.toFixed(1)} ${bot[i].y.toFixed(1)}`;
    tetherBody.setAttribute('d', d + ' Z');

    // Specular ridge along the sunward edge, near half only
    if (tetherShine) {
      const cut = Math.floor(SEGS * 0.55);
      let s = '';
      for (let i = 0; i <= cut; i++) {
        const p = pts[i];
        const e = top[i];
        const x = p.x + (e.x - p.x) * 0.45;
        const y = p.y + (e.y - p.y) * 0.45;
        s += `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
      }
      tetherShine.setAttribute('d', s.trim());
    }

    // Core shadow along the shaded edge, tighter span
    if (tetherUnder) {
      const cut = Math.floor(SEGS * 0.4);
      let s = '';
      for (let i = 0; i <= cut; i++) {
        const p = pts[i];
        const e = bot[i];
        const x = p.x + (e.x - p.x) * 0.5;
        const y = p.y + (e.y - p.y) * 0.5;
        s += `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
      }
      tetherUnder.setAttribute('d', s.trim());
    }

    // Connector fitting on the pack, aligned with the outgoing cord
    if (hook) {
      const deg = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
      hook.setAttribute(
        'transform',
        `translate(${anchor.x.toFixed(1)} ${anchor.y.toFixed(1)}) rotate(${deg.toFixed(2)})`,
      );
    }
  }

  function updateCast(shadowPt, cardX, cardY) {
    if (!castEl) return;

    const lx = shadowPt.x - cardX;
    const ly = shadowPt.y - cardY;
    const onCard =
      lx > -20 && lx < cardW + 30 &&
      ly > -10 && ly < cardH + 20;

    castOn += ((onCard ? 1 : 0) - castOn) * 0.08;
    castEl.style.left = `${lx.toFixed(1)}px`;
    castEl.style.top = `${ly.toFixed(1)}px`;
    castEl.style.opacity = (castOn * 0.55).toFixed(3);
  }

  function pose(t) {
    const mxv = readVar(hero, '--mx');
    const myv = readVar(hero, '--my');
    const hp = readVar(hero, '--hp');

    let dx =
      Math.sin(t * 0.24) * 8 +
      Math.sin(t * 0.055 + 2.1) * 13;
    let dy =
      Math.sin(t * 0.17 + 0.8) * 10 +
      Math.sin(t * 0.078 + 4.2) * 8;
    let roll =
      BASE_ROLL +
      Math.sin(t * 0.11 + 0.6) * 3.6 +
      Math.sin(t * 0.043 + 1.9) * 1.6 +
      mxv * 2.4;

    if (!impulseAt) impulseAt = t + 4;
    if (!impulse && t >= impulseAt) {
      impulse = {
        t0: t,
        dur: 2.4,
        x: (Math.random() * 2 - 1) * 12,
        y: (Math.random() * 2 - 1) * 9,
        r: (Math.random() * 2 - 1) * 1.8,
      };
      impulseAt = t + 7 + Math.random() * 6;
    }
    if (impulse) {
      const p = (t - impulse.t0) / impulse.dur;
      if (p >= 1) {
        impulse = null;
      } else {
        const e = Math.sin(Math.PI * p);
        dx += impulse.x * e;
        dy += impulse.y * e;
        roll += impulse.r * e;
      }
    }

    const x = dx + mxv * 16 - hp * 40;
    const y = dy + myv * 10 - hp * 130;
    const scale = 1 - hp * 0.05;
    const rollRad = (roll * Math.PI) / 180;

    body.style.setProperty('--astro-x', `${x.toFixed(2)}px`);
    body.style.setProperty('--astro-y', `${y.toFixed(2)}px`);
    body.style.setProperty('--astro-r', `${roll.toFixed(3)}deg`);
    body.style.setProperty('--astro-s', scale.toFixed(4));

    ropeX += (dx - ropeX) * 0.045;
    ropeY += (dy - ropeY) * 0.045;

    const anchor = figPoint(PACK.x, PACK.y, x, y, rollRad);
    drawTether(anchor, packDir(rollRad), t, hp);

    if (card) {
      swayX += (dx * 0.24 - swayX) * 0.05;
      swayY += (dy * 0.30 - swayY) * 0.05;
      card.style.setProperty('--sway-x', `${swayX.toFixed(2)}px`);
      card.style.setProperty('--sway-y', `${swayY.toFixed(2)}px`);

      const cardX = cardBaseX + swayX;
      const cardY = cardBaseY - hp * 46 + swayY;

      const hand = figPoint(HAND.x, HAND.y, x, y, rollRad);
      const lx = hand.x - cardX;
      const ly = hand.y - cardY;
      const inside = lx > -40 && lx < cardW + 40 && ly > -85 && ly < 260;
      handOn += ((inside ? 0.85 : 0) - handOn) * 0.06;
      card.style.setProperty('--hand-x', `${lx.toFixed(1)}px`);
      card.style.setProperty('--hand-y', `${ly.toFixed(1)}px`);
      card.style.setProperty('--hand-on', handOn.toFixed(3));

      updateCast(figPoint(SHADOW.x, SHADOW.y, x, y, rollRad), cardX, cardY);
    }
  }

  function frame(now) {
    rafId = null;
    if (!running) return;
    pose(now / 1000);
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

  function staticPose() {
    measure();
    const rollRad = (BASE_ROLL * Math.PI) / 180;
    body.style.setProperty('--astro-r', `${BASE_ROLL}deg`);
    const anchor = figPoint(PACK.x, PACK.y, 0, 0, rollRad);
    drawTether(anchor, packDir(rollRad), 0, 0);
    if (card && castEl) {
      updateCast(figPoint(SHADOW.x, SHADOW.y, 0, 0, rollRad), cardBaseX, cardBaseY);
    }
  }

  const active = window.matchMedia('(min-width: 900px)');

  function boot() {
    if (!active.matches) {
      stop();
      return;
    }
    measure();
    if (prefersReducedMotion) staticPose();
    else start();
  }

  const img = body.querySelector('img');
  if (img && !img.complete) {
    img.addEventListener('load', boot, { once: true });
  }
  boot();

  if (!prefersReducedMotion) {
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !document.hidden && active.matches) start();
      else stop();
    }, { threshold: 0 });
    io.observe(hero);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else if (visible && active.matches) start();
    });
  }

  active.addEventListener('change', boot);

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!active.matches) {
        stop();
        return;
      }
      measure();
      if (prefersReducedMotion) staticPose();
      else if (!running && visible && !document.hidden) start();
    }, 160);
  });
}
